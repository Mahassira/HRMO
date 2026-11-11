"""Extract: read each source file and return its rows as text, without changing anything.

Cleaning is not done here on purpose. Bronze keeps the data exactly as it arrived, so that a
cleaning rule can be changed later and the data re-processed without asking for the files again.
"""
import csv
import hashlib
import json
from pathlib import Path

from openpyxl import load_workbook


def file_hash(path):
    """Fingerprint of the file content. The same content always gives the same value."""
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def text(value):
    return None if value is None else str(value)


def read_employees_json(path):
    """HR system export. In production this is the response of the REST API (GET /employees)."""
    items = json.loads(Path(path).read_text(encoding="utf-8"))["items"]
    keys = ["staffNo", "name", "gender", "category", "grade", "office", "department", "hireDate", "baseSalary", "updatedAt"]
    return [[text(item.get(k)) for k in keys] for item in items]


def read_attendance_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # header
        return [row[:4] for row in reader if row]


def read_payroll_xlsx(path):
    rows = []
    book = load_workbook(path, read_only=True, data_only=True)
    for sheet in book.worksheets:
        for i, row in enumerate(sheet.iter_rows(values_only=True)):
            if i == 0 or row[0] is None:  # header or empty line
                continue
            rows.append([text(v) for v in row[:6]])
    return rows


# file name pattern -> (bronze table, its columns, reader)
SOURCES = [
    ("employees_api*.json", "bronze.employees",
     ["staff_no", "full_name", "gender", "category", "grade", "office", "department", "hire_date", "base_salary", "updated_at"],
     read_employees_json),
    ("attendance_*.csv", "bronze.attendance",
     ["staff_no", "work_date", "check_in", "check_out"],
     read_attendance_csv),
    ("payroll_*.xlsx", "bronze.payroll",
     ["staff_no", "pay_month", "gross", "deductions", "net", "currency"],
     read_payroll_xlsx),
]
