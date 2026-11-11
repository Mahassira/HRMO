"""Database access for the pipeline.

The SQL files in ../sql are written for SQL Server (T-SQL), which is the production target.
To run and test the same files on any laptop with no server, this module can also run them on
SQLite. It does that with a few small translations, listed in one place below:

    bronze.table            ->  bronze_table        (SQLite has no schemas)
    TRY_CAST(x AS DATE)     ->  try_date(x)         (a Python function registered in SQLite)
    DATEDIFF(minute, a, b)  ->  datediff_minute(a, b)
    YEAR(d), MONTH(d), ...  ->  Python functions with the same names

Nothing else is changed, so what is tested locally is the same logic that runs on SQL Server.
"""
import os
import re
import sqlite3
from datetime import date, time

SCHEMAS = ("bronze", "silver", "gold", "etl", "dq")


# ---------- safe conversions: return None instead of failing, like TRY_CAST in SQL Server ----------
def try_int(value):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def try_decimal(value):
    try:
        return round(float(str(value).strip()), 2)
    except (TypeError, ValueError):
        return None


def try_date(value):
    try:
        return date.fromisoformat(str(value).strip()[:10]).isoformat()
    except (TypeError, ValueError):
        return None


def try_time(value):
    try:
        text = str(value).strip()
        return time.fromisoformat(text if len(text) > 5 else text + ":00").isoformat()
    except (TypeError, ValueError):
        return None


def datediff_minute(start, end):
    if start is None or end is None:
        return None
    a, b = time.fromisoformat(start), time.fromisoformat(end)
    return (b.hour * 60 + b.minute) - (a.hour * 60 + a.minute)


TRY_CAST = {"INT": "try_int", "DECIMAL": "try_decimal", "DATE": "try_date", "TIME": "try_time"}


def to_sqlite(sql):
    """Translate one T-SQL statement to SQLite. See the module docstring for the full list."""
    sql = re.sub(rf"\b({'|'.join(SCHEMAS)})\.", r"\1_", sql)
    sql = re.sub(r"TRY_CAST\((.+?) AS (INT|DECIMAL|DATE|TIME)(\(\d+,\s*\d+\))?\)",
                 lambda m: f"{TRY_CAST[m.group(2)]}({m.group(1)})", sql)
    sql = re.sub(r"DATEDIFF\(minute,", "datediff_minute(", sql, flags=re.I)
    return sql


class Database:
    """One connection, either SQLite (default) or SQL Server."""

    def __init__(self, engine="sqlite", target="warehouse.db"):
        self.engine = engine
        if engine == "sqlite":
            self.conn = sqlite3.connect(target)
            f = self.conn.create_function
            f("try_int", 1, try_int)
            f("try_decimal", 1, try_decimal)
            f("try_date", 1, try_date)
            f("try_time", 1, try_time)
            f("datediff_minute", 2, datediff_minute)
            f("YEAR", 1, lambda d: int(d[0:4]) if d else None)
            f("MONTH", 1, lambda d: int(d[5:7]) if d else None)
            f("DAY", 1, lambda d: int(d[8:10]) if d else None)
        elif engine == "mssql":
            import pyodbc  # pip install pyodbc, plus the Microsoft ODBC Driver 18 for SQL Server
            self.conn = pyodbc.connect(target or os.environ["HRMO_DW_CONNECTION"])
            self.conn.cursor().fast_executemany = True
        else:
            raise ValueError(f"Unknown engine: {engine}")

    def _sql(self, sql):
        return to_sqlite(sql) if self.engine == "sqlite" else sql

    def execute(self, sql, params=()):
        cursor = self.conn.cursor()
        cursor.execute(self._sql(sql), params)
        return cursor

    def scalar(self, sql, params=()):
        row = self.execute(sql, params).fetchone()
        return row[0] if row else None

    def insert_many(self, table, columns, rows):
        marks = ", ".join("?" for _ in columns)
        sql = self._sql(f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({marks})")
        cursor = self.conn.cursor()
        cursor.executemany(sql, rows)
        return len(rows)

    def run_script(self, path):
        """Run a .sql file. Statements are separated by a line containing only GO, as in SQL Server tools."""
        text = open(path, encoding="utf-8").read()
        for statement in re.split(r"^\s*GO\s*$", text, flags=re.M | re.I):
            body = "\n".join(l for l in statement.splitlines() if not l.strip().startswith("--")).strip()
            if not body:
                continue
            if self.engine == "sqlite" and body.upper().startswith("CREATE SCHEMA"):
                continue
            self.execute(statement)
        self.conn.commit()

    def table_exists(self, name):
        if self.engine == "sqlite":
            return self.scalar("SELECT COUNT(*) FROM sqlite_master WHERE name = ?", (to_sqlite(name),)) > 0
        return self.scalar("SELECT COUNT(*) FROM sys.tables WHERE object_id = OBJECT_ID(?)", (name,)) > 0

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()
