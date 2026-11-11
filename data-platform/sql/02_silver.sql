-- 02 · Silver: clean, convert to real types, remove duplicates.
-- Rebuilt in full on every run. The pattern is the same for each source:
--   1. stage   convert each column with TRY_CAST and write down the first reason a row is invalid
--   2. keep    valid rows, one per business key (the newest wins)
--   3. reject  everything else goes to silver.reject with its reason, so no row disappears silently

DROP TABLE IF EXISTS silver.reject;
GO
CREATE TABLE silver.reject (
  source VARCHAR(20) NOT NULL, source_file VARCHAR(200) NOT NULL, row_no INT NOT NULL, reason VARCHAR(60) NOT NULL
);
GO

-- ====================================================================== employees
DROP TABLE IF EXISTS silver.employee_stage;
GO
CREATE TABLE silver.employee_stage (
  staff_no VARCHAR(16), full_name NVARCHAR(160), gender CHAR(1), category VARCHAR(16), grade INT,
  office VARCHAR(8), department VARCHAR(16), hire_date DATE, base_salary DECIMAL(12,2), updated_at VARCHAR(30),
  source_file VARCHAR(200), row_no INT, reason VARCHAR(60)
);
GO
INSERT INTO silver.employee_stage
SELECT
  UPPER(TRIM(staff_no)),
  TRIM(full_name),
  CASE WHEN UPPER(TRIM(gender)) IN ('F', 'M') THEN UPPER(TRIM(gender)) ELSE 'U' END,   -- U = unknown
  UPPER(TRIM(category)),
  TRY_CAST(grade AS INT),
  UPPER(TRIM(office)),
  UPPER(TRIM(department)),
  TRY_CAST(hire_date AS DATE),
  TRY_CAST(base_salary AS DECIMAL(12,2)),
  updated_at,
  _source_file,
  _row_no,
  CASE
    WHEN staff_no IS NULL OR TRIM(staff_no) = ''      THEN 'missing staff_no'
    WHEN TRY_CAST(hire_date AS DATE) IS NULL          THEN 'invalid hire_date'
    WHEN TRY_CAST(grade AS INT) IS NULL               THEN 'invalid grade'
    WHEN TRY_CAST(base_salary AS DECIMAL(12,2)) IS NULL
      OR TRY_CAST(base_salary AS DECIMAL(12,2)) <= 0  THEN 'invalid base_salary'
  END
FROM bronze.employees;
GO

DROP TABLE IF EXISTS silver.employee;
GO
CREATE TABLE silver.employee (
  staff_no VARCHAR(16) NOT NULL PRIMARY KEY, full_name NVARCHAR(160) NOT NULL, gender CHAR(1) NOT NULL,
  category VARCHAR(16) NOT NULL, grade INT NOT NULL, office VARCHAR(8) NOT NULL, department VARCHAR(16) NOT NULL,
  hire_date DATE NOT NULL, base_salary DECIMAL(12,2) NOT NULL
);
GO
-- ROW_NUMBER gives 1 to the newest copy of each staff number; only that copy is kept.
INSERT INTO silver.employee
SELECT staff_no, full_name, gender, category, grade, office, department, hire_date, base_salary
FROM (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY staff_no ORDER BY updated_at DESC, row_no DESC) AS rn
  FROM silver.employee_stage s
  WHERE reason IS NULL
) ranked
WHERE rn = 1;
GO
INSERT INTO silver.reject
SELECT 'employees', source_file, row_no, reason FROM silver.employee_stage WHERE reason IS NOT NULL;
GO
INSERT INTO silver.reject
SELECT 'employees', source_file, row_no, 'duplicate'
FROM (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY staff_no ORDER BY updated_at DESC, row_no DESC) AS rn
  FROM silver.employee_stage s
  WHERE reason IS NULL
) ranked
WHERE rn > 1;
GO

-- ====================================================================== attendance
DROP TABLE IF EXISTS silver.attendance_stage;
GO
CREATE TABLE silver.attendance_stage (
  staff_no VARCHAR(16), work_date DATE, check_in TIME, check_out TIME,
  source_file VARCHAR(200), row_no INT, reason VARCHAR(60)
);
GO
INSERT INTO silver.attendance_stage
SELECT
  UPPER(TRIM(b.staff_no)),
  TRY_CAST(b.work_date AS DATE),
  TRY_CAST(b.check_in AS TIME),
  TRY_CAST(b.check_out AS TIME),
  b._source_file,
  b._row_no,
  CASE
    WHEN e.staff_no IS NULL                                        THEN 'unknown employee'
    WHEN TRY_CAST(b.work_date AS DATE) IS NULL                     THEN 'invalid work_date'
    WHEN TRY_CAST(b.check_in AS TIME) IS NULL                      THEN 'invalid check_in'
    WHEN TRY_CAST(b.check_out AS TIME) < TRY_CAST(b.check_in AS TIME) THEN 'check_out before check_in'
  END
FROM bronze.attendance b
LEFT JOIN silver.employee e ON e.staff_no = UPPER(TRIM(b.staff_no));
GO

DROP TABLE IF EXISTS silver.attendance;
GO
CREATE TABLE silver.attendance (
  staff_no VARCHAR(16) NOT NULL, work_date DATE NOT NULL, check_in TIME NOT NULL, check_out TIME NULL,
  hours_worked DECIMAL(5,2) NULL,     -- NULL when the employee did not check out
  is_late INT NOT NULL,               -- 1 when check-in is after 08:15
  is_incomplete INT NOT NULL,         -- 1 when there is no check-out
  PRIMARY KEY (staff_no, work_date)
);
GO
INSERT INTO silver.attendance
SELECT staff_no, work_date, check_in, check_out,
       ROUND(DATEDIFF(minute, check_in, check_out) / 60.0, 2),
       CASE WHEN check_in > '08:15:00' THEN 1 ELSE 0 END,
       CASE WHEN check_out IS NULL THEN 1 ELSE 0 END
FROM (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY staff_no, work_date ORDER BY row_no DESC) AS rn
  FROM silver.attendance_stage s
  WHERE reason IS NULL
) ranked
WHERE rn = 1;
GO
INSERT INTO silver.reject
SELECT 'attendance', source_file, row_no, reason FROM silver.attendance_stage WHERE reason IS NOT NULL;
GO
INSERT INTO silver.reject
SELECT 'attendance', source_file, row_no, 'duplicate'
FROM (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY staff_no, work_date ORDER BY row_no DESC) AS rn
  FROM silver.attendance_stage s
  WHERE reason IS NULL
) ranked
WHERE rn > 1;
GO

-- ====================================================================== payroll
-- Finance sometimes types amounts as text with a thousands separator ("1,250.00"), so commas are removed first.
DROP TABLE IF EXISTS silver.payroll_stage;
GO
CREATE TABLE silver.payroll_stage (
  staff_no VARCHAR(16), pay_month CHAR(7), gross DECIMAL(12,2), deductions DECIMAL(12,2), net DECIMAL(12,2), currency CHAR(3),
  source_file VARCHAR(200), row_no INT, reason VARCHAR(60)
);
GO
INSERT INTO silver.payroll_stage
SELECT
  UPPER(TRIM(b.staff_no)),
  TRIM(b.pay_month),
  TRY_CAST(REPLACE(b.gross, ',', '') AS DECIMAL(12,2)),
  TRY_CAST(REPLACE(b.deductions, ',', '') AS DECIMAL(12,2)),
  TRY_CAST(REPLACE(b.net, ',', '') AS DECIMAL(12,2)),
  UPPER(TRIM(b.currency)),
  b._source_file,
  b._row_no,
  CASE
    WHEN e.staff_no IS NULL                                               THEN 'unknown employee'
    WHEN TRIM(b.pay_month) NOT LIKE '____-__'                             THEN 'invalid pay_month'
    WHEN TRY_CAST(REPLACE(b.gross, ',', '') AS DECIMAL(12,2)) IS NULL
      OR TRY_CAST(REPLACE(b.deductions, ',', '') AS DECIMAL(12,2)) IS NULL
      OR TRY_CAST(REPLACE(b.net, ',', '') AS DECIMAL(12,2)) IS NULL       THEN 'invalid amount'
    WHEN TRY_CAST(REPLACE(b.gross, ',', '') AS DECIMAL(12,2)) <= 0        THEN 'gross not positive'
    WHEN ABS(TRY_CAST(REPLACE(b.gross, ',', '') AS DECIMAL(12,2))
           - TRY_CAST(REPLACE(b.deductions, ',', '') AS DECIMAL(12,2))
           - TRY_CAST(REPLACE(b.net, ',', '') AS DECIMAL(12,2))) > 0.01   THEN 'net does not match'
  END
FROM bronze.payroll b
LEFT JOIN silver.employee e ON e.staff_no = UPPER(TRIM(b.staff_no));
GO

DROP TABLE IF EXISTS silver.payroll;
GO
CREATE TABLE silver.payroll (
  staff_no VARCHAR(16) NOT NULL, pay_month CHAR(7) NOT NULL, gross DECIMAL(12,2) NOT NULL,
  deductions DECIMAL(12,2) NOT NULL, net DECIMAL(12,2) NOT NULL, currency CHAR(3) NOT NULL,
  PRIMARY KEY (staff_no, pay_month)
);
GO
INSERT INTO silver.payroll
SELECT staff_no, pay_month, gross, deductions, net, currency
FROM (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY staff_no, pay_month ORDER BY row_no DESC) AS rn
  FROM silver.payroll_stage s
  WHERE reason IS NULL
) ranked
WHERE rn = 1;
GO
INSERT INTO silver.reject
SELECT 'payroll', source_file, row_no, reason FROM silver.payroll_stage WHERE reason IS NOT NULL;
GO
INSERT INTO silver.reject
SELECT 'payroll', source_file, row_no, 'duplicate'
FROM (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY staff_no, pay_month ORDER BY row_no DESC) AS rn
  FROM silver.payroll_stage s
  WHERE reason IS NULL
) ranked
WHERE rn > 1;
GO

DROP TABLE IF EXISTS silver.employee_stage;
GO
DROP TABLE IF EXISTS silver.attendance_stage;
GO
DROP TABLE IF EXISTS silver.payroll_stage;
GO
