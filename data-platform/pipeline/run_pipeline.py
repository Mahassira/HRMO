"""HRMO data pipeline: sources -> bronze -> silver -> gold -> quality checks.

    python pipeline/run_pipeline.py                          # SQLite file warehouse.db (no server needed)
    python pipeline/run_pipeline.py --engine mssql --target "<ODBC connection string>"

Each step is timed and written to etl.run_log. The run fails (exit code 1) if a quality check
with severity ERROR does not pass.
"""
import argparse
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from db import Database          # noqa: E402
from extract import SOURCES, file_hash  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SQL = ROOT / "sql"


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class Pipeline:
    def __init__(self, db, sources_dir):
        self.db = db
        self.sources_dir = Path(sources_dir)
        self.run_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        self.steps = []

    def step(self, name, action):
        """Run one step, time it and record the result. A failed step stops the pipeline."""
        started = time.perf_counter()
        try:
            rows = action()
            status, message = "OK", None
        except Exception as error:
            rows, status, message = None, "FAILED", str(error)[:400]
        seconds = round(time.perf_counter() - started, 3)
        self.db.execute("INSERT INTO etl.run_log (run_id, step, status, row_count, seconds, message, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (self.run_id, name, status, rows, seconds, message, now()))
        self.db.commit()
        self.steps.append((name, status, rows, seconds))
        print(f"  {name:<28} {status:<7} {'' if rows is None else rows:>8}  {seconds:>7.3f}s")
        if status == "FAILED":
            raise RuntimeError(f"Step {name} failed: {message}")

    # ---------------------------------------------------------------- steps
    def setup(self):
        if not self.db.table_exists("etl.file_log"):
            self.db.run_script(SQL / "01_setup.sql")

    def extract(self):
        """Load new files into bronze. A file whose content was already loaded is skipped."""
        loaded = 0
        for pattern, table, columns, reader in SOURCES:
            for path in sorted(self.sources_dir.glob(pattern)):
                fingerprint = file_hash(path)
                if self.db.scalar("SELECT COUNT(*) FROM etl.file_log WHERE file_hash = ?", (fingerprint,)):
                    continue
                stamp = now()
                rows = [row + [path.name, i, stamp] for i, row in enumerate(reader(path), start=1)]
                self.db.insert_many(table, columns + ["_source_file", "_row_no", "_loaded_at"], rows)
                self.db.execute("INSERT INTO etl.file_log (file_name, file_hash, target_table, row_count, loaded_at) VALUES (?, ?, ?, ?, ?)",
                                (path.name, fingerprint, table, len(rows), stamp))
                loaded += len(rows)
        return loaded

    def silver(self):
        self.db.run_script(SQL / "02_silver.sql")
        return sum(self.db.scalar(f"SELECT COUNT(*) FROM silver.{t}") for t in ("employee", "attendance", "payroll"))

    def dim_date(self):
        """One row per calendar day, covering every year that appears in the data."""
        first = self.db.scalar("SELECT MIN(hire_date) FROM silver.employee") or "2020-01-01"
        last = self.db.scalar("SELECT MAX(work_date) FROM silver.attendance") or date.today().isoformat()
        day, end = date(int(str(first)[:4]), 1, 1), date(int(str(last)[:4]), 12, 31)
        rows = []
        while day <= end:
            rows.append((day.year * 10000 + day.month * 100 + day.day, day.isoformat(), day.year, (day.month - 1) // 3 + 1,
                         day.month, day.strftime("%B"), day.strftime("%Y-%m"), day.isoweekday(), 1 if day.weekday() >= 5 else 0))
            day += timedelta(days=1)
        self.db.execute("DROP TABLE IF EXISTS gold.DimDate")
        self.db.execute("""CREATE TABLE gold.DimDate (
            DateKey INT NOT NULL PRIMARY KEY, FullDate DATE NOT NULL, CalendarYear INT NOT NULL, CalendarQuarter INT NOT NULL,
            MonthNumber INT NOT NULL, MonthName VARCHAR(12) NOT NULL, YearMonth CHAR(7) NOT NULL,
            DayOfWeek INT NOT NULL, IsWeekend INT NOT NULL)""")
        return self.db.insert_many("gold.DimDate", ["DateKey", "FullDate", "CalendarYear", "CalendarQuarter", "MonthNumber",
                                                     "MonthName", "YearMonth", "DayOfWeek", "IsWeekend"], rows)

    def gold(self):
        self.db.run_script(SQL / "03_gold.sql")
        return sum(self.db.scalar(f"SELECT COUNT(*) FROM gold.{t}") for t in ("FactAttendance", "FactPayroll"))

    def quality(self):
        """Run every check in 04_quality_checks.sql and store the result in dq.results."""
        text = (SQL / "04_quality_checks.sql").read_text(encoding="utf-8")
        self.checks = []
        for block in re.split(r"^\s*GO\s*$", text, flags=re.M):
            header = re.search(r"--\s*check:\s*(\w+)\s*\|\s*(ERROR|WARN)\s*\|\s*(.+)", block)
            if not header:
                continue
            name, severity, description = header.group(1), header.group(2), header.group(3).strip()
            query = "\n".join(l for l in block.splitlines() if not l.strip().startswith("--"))
            failed = int(self.db.scalar(query) or 0)
            status = "PASS" if failed == 0 else ("FAIL" if severity == "ERROR" else "WARN")
            self.db.execute("INSERT INTO dq.results (run_id, check_name, severity, failed_rows, status, description) VALUES (?, ?, ?, ?, ?, ?)",
                            (self.run_id, name, severity, failed, status, description))
            self.checks.append((name, severity, failed, status, description))
        return len(self.checks)

    # ---------------------------------------------------------------- report
    def report(self, path):
        count = lambda table, where="": self.db.scalar(f"SELECT COUNT(*) FROM {table} {where}")
        lines = [f"# Pipeline run {self.run_id}", "", "## Steps", "", "| Step | Status | Rows | Seconds |", "|---|---|---:|---:|"]
        lines += [f"| {n} | {s} | {'' if r is None else r} | {t} |" for n, s, r, t in self.steps]
        lines += ["", "## Row counts by layer", "", "| Source | Bronze | Silver | Rejected | Duplicates |", "|---|---:|---:|---:|---:|"]
        for source, bronze, silver in (("employees", "employees", "employee"), ("attendance", "attendance", "attendance"), ("payroll", "payroll", "payroll")):
            lines.append(f"| {source} | {count('bronze.' + bronze)} | {count('silver.' + silver)} | "
                         f"{count('silver.reject', f"WHERE source = '{source}' AND reason <> 'duplicate'")} | "
                         f"{count('silver.reject', f"WHERE source = '{source}' AND reason = 'duplicate'")} |")
        lines += ["", "## Reject reasons", "", "| Source | Reason | Rows |", "|---|---|---:|"]
        for source, reason, rows in self.db.execute("SELECT source, reason, COUNT(*) FROM silver.reject GROUP BY source, reason ORDER BY source, reason").fetchall():
            lines.append(f"| {source} | {reason} | {rows} |")
        lines += ["", "## Quality checks", "", "| Check | Severity | Result | Rows | Rule |", "|---|---|---|---:|---|"]
        lines += [f"| {n} | {sev} | {st} | {f} | {d} |" for n, sev, f, st, d in self.checks]
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")

    def run(self, report_path):
        print(f"Run {self.run_id}")
        self.setup()
        self.step("extract to bronze", self.extract)
        self.step("bronze to silver", self.silver)
        self.step("date dimension", self.dim_date)
        self.step("silver to gold", self.gold)
        self.step("quality checks", self.quality)
        self.report(report_path)
        failed = [c for c in self.checks if c[3] == "FAIL"]
        warned = [c for c in self.checks if c[3] == "WARN"]
        print(f"Quality: {len(self.checks) - len(failed) - len(warned)} passed, {len(warned)} warnings, {len(failed)} failed. Report: {report_path}")
        for name, _, rows, _, description in failed:
            print(f"  FAILED {name}: {rows} - {description}")
        return 1 if failed else 0


def main():
    parser = argparse.ArgumentParser(description="Run the HRMO data pipeline.")
    parser.add_argument("--engine", choices=["sqlite", "mssql"], default="sqlite")
    parser.add_argument("--target", default=str(ROOT / "warehouse.db"), help="SQLite file, or ODBC connection string for mssql")
    parser.add_argument("--sources", default=str(ROOT / "sources"))
    parser.add_argument("--report", default=str(ROOT / "out" / "quality_report.md"))
    args = parser.parse_args()
    db = Database(args.engine, args.target)
    try:
        return Pipeline(db, args.sources).run(args.report)
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
