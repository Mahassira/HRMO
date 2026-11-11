"""End-to-end test: generate the sources, run the pipeline twice, check the results.

    python -m unittest discover -s tests -v
"""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "pipeline"))

import generate_sources                      # noqa: E402
from db import Database, to_sqlite           # noqa: E402
from run_pipeline import Pipeline            # noqa: E402


class PipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.sources = Path(cls.tmp.name) / "sources"
        generate_sources.main(cls.sources)
        cls.db = Database("sqlite", str(Path(cls.tmp.name) / "test.db"))
        cls.report = Path(cls.tmp.name) / "report.md"
        cls.first = Pipeline(cls.db, cls.sources)
        cls.exit_code = cls.first.run(cls.report)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        cls.tmp.cleanup()

    def count(self, table, where=""):
        return self.db.scalar(f"SELECT COUNT(*) FROM {table} {where}")

    def test_run_succeeds_and_no_error_check_fails(self):
        self.assertEqual(self.exit_code, 0)
        self.assertEqual(self.count("dq.results", "WHERE status = 'FAIL'"), 0)
        self.assertTrue(self.report.exists())

    def test_every_source_row_is_accounted_for(self):
        for source, bronze, silver in (("employees", "employees", "employee"), ("attendance", "attendance", "attendance"), ("payroll", "payroll", "payroll")):
            rejected = self.count("silver.reject", f"WHERE source = '{source}'")
            self.assertEqual(self.count(f"bronze.{bronze}"), self.count(f"silver.{silver}") + rejected, source)

    def test_duplicates_keep_the_newest_record(self):
        self.assertEqual(self.count("silver.reject", "WHERE source = 'employees' AND reason = 'duplicate'"), 12)
        self.assertEqual(self.count("gold.DimEmployee"), self.db.scalar("SELECT COUNT(DISTINCT StaffNo) FROM gold.DimEmployee"))

    def test_bad_rows_are_rejected_with_a_reason(self):
        self.assertEqual(self.count("silver.reject", "WHERE reason = 'missing staff_no'"), 3)
        self.assertEqual(self.count("silver.reject", "WHERE reason = 'invalid hire_date'"), 5)
        self.assertGreater(self.count("silver.reject", "WHERE reason = 'check_out before check_in'"), 0)
        self.assertGreater(self.count("silver.reject", "WHERE reason = 'net does not match'"), 0)

    def test_codes_are_cleaned(self):
        self.assertEqual(self.count("gold.DimOffice"), 5)
        self.assertEqual(self.count("gold.DimOffice", "WHERE OfficeCode <> UPPER(TRIM(OfficeCode))"), 0)

    def test_amounts_typed_as_text_are_read(self):
        self.assertEqual(self.count("silver.reject", "WHERE reason = 'invalid amount'"), 0)
        self.assertGreater(self.db.scalar("SELECT SUM(Net) FROM gold.FactPayroll"), 0)

    def test_second_run_loads_nothing_new_and_gives_the_same_result(self):
        before = (self.count("bronze.attendance"), self.count("gold.FactAttendance"), self.count("gold.FactPayroll"))
        second = Pipeline(self.db, self.sources)
        second.run_id += "-2"
        self.assertEqual(second.run(self.report), 0)
        self.assertEqual(second.steps[0][2], 0)  # extract loaded 0 rows
        after = (self.count("bronze.attendance"), self.count("gold.FactAttendance"), self.count("gold.FactPayroll"))
        self.assertEqual(before, after)

    def test_tsql_translation(self):
        self.assertEqual(to_sqlite("SELECT TRY_CAST(REPLACE(b.gross, ',', '') AS DECIMAL(12,2)) FROM bronze.payroll b"),
                         "SELECT try_decimal(REPLACE(b.gross, ',', '')) FROM bronze_payroll b")
        self.assertEqual(to_sqlite("DATEDIFF(minute, check_in, check_out)"), "datediff_minute( check_in, check_out)")


if __name__ == "__main__":
    unittest.main()
