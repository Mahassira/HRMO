"""Measure what the indexes on the fact table are worth.

Runs the same report query with and without the indexes and prints the average time.
Run the pipeline first:  python pipeline/run_pipeline.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "pipeline"))
from db import Database  # noqa: E402

# Attendance of one employee over the whole period - what an employee's page in a report asks for.
QUERY = """
SELECT d.YearMonth, COUNT(*) AS days, SUM(f.HoursWorked) AS hours, SUM(f.IsLate) AS late_days
FROM gold.FactAttendance f
JOIN gold.DimDate d ON d.DateKey = f.DateKey
WHERE f.EmployeeKey = ?
GROUP BY d.YearMonth
"""
INDEXES = {
    "IX_FactAttendance_Employee": "CREATE INDEX IX_FactAttendance_Employee ON gold.FactAttendance (EmployeeKey, DateKey)",
    "IX_FactAttendance_Office": "CREATE INDEX IX_FactAttendance_Office ON gold.FactAttendance (OfficeKey, DateKey)",
}
REPEAT = 300


def average_ms(db):
    started = time.perf_counter()
    for i in range(REPEAT):
        db.execute(QUERY, (i % 700 + 1,)).fetchall()
    return (time.perf_counter() - started) / REPEAT * 1000


def main():
    db = Database("sqlite", str(Path(__file__).parent / "warehouse.db"))
    for name in INDEXES:
        db.execute(f"DROP INDEX IF EXISTS {name}")
    without = average_ms(db)
    for statement in INDEXES.values():
        db.execute(statement)
    db.commit()
    with_index = average_ms(db)
    rows = db.scalar("SELECT COUNT(*) FROM gold.FactAttendance")
    print(f"Fact rows: {rows}")
    print(f"Without index: {without:.3f} ms per query")
    print(f"With index:    {with_index:.3f} ms per query  ({without / with_index:.0f}x faster)")
    db.close()


if __name__ == "__main__":
    main()
