"""Generate three fictitious source files for the pipeline.

    sources/employees_api.json      what an HR system's REST API would return
    sources/attendance_YYYY-MM.csv  one file per month from the attendance devices
    sources/payroll_2026.xlsx       the payroll workbook from Finance, one sheet per month

The data is random but repeatable (fixed seed). Mistakes are added on purpose - duplicates,
bad dates, unknown staff numbers, wrong totals - so that the pipeline has something to clean.
"""
import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

from openpyxl import Workbook

SEED = 2026
EMPLOYEES = 800
MONTHS = [(2026, 8), (2026, 9), (2026, 10)]
OFFICES = ["MO", "NF", "SF", "CF", "EF"]
DEPARTMENTS = ["PRG", "HLT", "LOG", "FIN", "HR", "SEC", "MEAL", "ADM"]
CATEGORIES = ["REGULAR"] * 8 + ["TEMPORARY", "CONSULTANT"]
FIRST = ["Sara", "Omar", "Lina", "Khalil", "Maya", "Yousef", "Nour", "Hadi", "Rana", "Sami", "Dina", "Tariq"]
LAST = ["Mansour", "Saleh", "Haddad", "Nasser", "Khoury", "Aziz", "Farah", "Jaber", "Salem", "Karim"]


def working_days(year, month):
    day = date(year, month, 1)
    while day.month == month:
        if day.weekday() < 5:  # Monday to Friday
            yield day
        day += timedelta(days=1)


def make_employees(rng):
    rows = []
    for i in range(1, EMPLOYEES + 1):
        hired = date(2015, 1, 1) + timedelta(days=rng.randrange(0, 4100))
        rows.append({
            "staffNo": f"E{i:04d}",
            "name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
            "gender": rng.choice(["F", "M"]),
            "category": rng.choice(CATEGORIES),
            "grade": rng.randint(2, 10),
            "office": rng.choice(OFFICES),
            "department": rng.choice(DEPARTMENTS),
            "hireDate": hired.isoformat(),
            "baseSalary": rng.randrange(450, 3200, 25),
            "updatedAt": "2026-10-31T09:00:00",
        })
    # --- mistakes on purpose ---
    for row in rng.sample(rows, 40):                      # untidy codes: " mo ", "nf"
        row["office"] = f" {row['office'].lower()} "
    for row in rng.sample(rows, 6):                       # gender not recorded
        row["gender"] = ""
    for row in rng.sample(rows, 5):                       # impossible dates
        row["hireDate"] = rng.choice(["2026-13-01", "31/12/2020", "unknown"])
    for row in rng.sample(rows, 12):                      # an older copy of the same record
        rows.append(dict(row, grade=max(1, row["grade"] - 1), updatedAt="2026-03-01T09:00:00"))
    for _ in range(3):                                    # records without a staff number
        rows.append(dict(rng.choice(rows), staffNo=""))
    rng.shuffle(rows)
    return rows


def make_attendance(rng, employees, year, month):
    staff = sorted({e["staffNo"] for e in employees if e["staffNo"]})
    rows = []
    for day in working_days(year, month):
        for staff_no in staff:
            if rng.random() < 0.06:                       # on leave or absent
                continue
            start = 7 * 60 + 40 + rng.randrange(0, 50)    # between 07:40 and 08:30
            end = start + 8 * 60 + rng.randrange(-20, 60)
            rows.append([staff_no, day.isoformat(), f"{start // 60:02d}:{start % 60:02d}", f"{end // 60:02d}:{end % 60:02d}"])
    # --- mistakes on purpose ---
    rows += [list(r) for r in rng.sample(rows, 50)]       # the device sent the row twice
    for row in rng.sample(rows, 27):                      # forgot to check out
        row[3] = ""
    for row in rng.sample(rows, 10):                      # staff number not in the HR system
        row[0] = f"X{rng.randrange(1000, 9999)}"
    for row in rng.sample(rows, 7):                       # check-out before check-in
        row[2], row[3] = "17:05", "08:01"
    for row in rng.sample(rows, 4):                       # wrong date format
        y, m, d = row[1].split("-")
        row[1] = f"{d}/{m}/{y}"
    rng.shuffle(rows)
    return rows


def make_payroll(rng, employees, year, month):
    seen, rows = set(), []
    for e in employees:
        if not e["staffNo"] or e["staffNo"] in seen:
            continue
        seen.add(e["staffNo"])
        gross = float(e["baseSalary"])
        deductions = round(gross * 0.07, 2)
        rows.append([e["staffNo"], f"{year}-{month:02d}", gross, deductions, round(gross - deductions, 2), "USD"])
    # --- mistakes on purpose ---
    for row in rng.sample(rows, 30):                      # typed as text with a thousands separator
        row[2] = f"{row[2]:,.2f}"
    for row in rng.sample(rows, 3):                       # zero or negative pay
        row[2], row[4] = 0, 0
    for row in rng.sample(rows, 2):                       # net does not equal gross minus deductions
        row[4] = row[4] + 50
    for row in rng.sample(rows, 2):                       # staff number not in the HR system
        row[0] = f"X{rng.randrange(1000, 9999)}"
    return rows


def main(out_dir="sources"):
    rng = random.Random(SEED)
    out = Path(out_dir)
    out.mkdir(exist_ok=True)

    employees = make_employees(rng)
    (out / "employees_api.json").write_text(json.dumps({"count": len(employees), "items": employees}, indent=1), encoding="utf-8")

    for year, month in MONTHS:
        with open(out / f"attendance_{year}-{month:02d}.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["staff_no", "work_date", "check_in", "check_out"])
            writer.writerows(make_attendance(rng, employees, year, month))

    book = Workbook()
    book.remove(book.active)
    for year, month in MONTHS:
        sheet = book.create_sheet(f"{year}-{month:02d}")
        sheet.append(["Staff No", "Month", "Gross", "Deductions", "Net", "Currency"])
        for row in make_payroll(rng, employees, year, month):
            sheet.append(row)
    book.save(out / "payroll_2026.xlsx")
    print(f"Sources written to {out}/")


if __name__ == "__main__":
    main()
