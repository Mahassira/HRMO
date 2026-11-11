-- 01 · Setup. Runs once on an empty database.
-- Schemas are the layers of the warehouse:
--   bronze  raw data exactly as received (everything is text)
--   silver  cleaned, typed, de-duplicated
--   gold    star schema for reports
--   etl     pipeline bookkeeping        dq  data-quality results

CREATE SCHEMA bronze;
GO
CREATE SCHEMA silver;
GO
CREATE SCHEMA gold;
GO
CREATE SCHEMA etl;
GO
CREATE SCHEMA dq;
GO

-- Bronze: one table per source. All columns are text so that a bad value never stops the load.
-- The three _columns say where each row came from.
CREATE TABLE bronze.employees (
  staff_no VARCHAR(200), full_name NVARCHAR(200), gender VARCHAR(200), category VARCHAR(200), grade VARCHAR(200),
  office VARCHAR(200), department VARCHAR(200), hire_date VARCHAR(200), base_salary VARCHAR(200), updated_at VARCHAR(200),
  _source_file VARCHAR(200) NOT NULL, _row_no INT NOT NULL, _loaded_at VARCHAR(30) NOT NULL
);
GO
CREATE TABLE bronze.attendance (
  staff_no VARCHAR(200), work_date VARCHAR(200), check_in VARCHAR(200), check_out VARCHAR(200),
  _source_file VARCHAR(200) NOT NULL, _row_no INT NOT NULL, _loaded_at VARCHAR(30) NOT NULL
);
GO
CREATE TABLE bronze.payroll (
  staff_no VARCHAR(200), pay_month VARCHAR(200), gross VARCHAR(200), deductions VARCHAR(200), net VARCHAR(200), currency VARCHAR(200),
  _source_file VARCHAR(200) NOT NULL, _row_no INT NOT NULL, _loaded_at VARCHAR(30) NOT NULL
);
GO

-- Every file loaded, with a fingerprint of its content. A file with the same fingerprint is never loaded twice.
CREATE TABLE etl.file_log (
  file_name VARCHAR(200) NOT NULL, file_hash CHAR(64) NOT NULL PRIMARY KEY, target_table VARCHAR(60) NOT NULL,
  row_count INT NOT NULL, loaded_at VARCHAR(30) NOT NULL
);
GO
-- One row per pipeline step per run: what ran, how long it took, how many rows.
CREATE TABLE etl.run_log (
  run_id VARCHAR(20) NOT NULL, step VARCHAR(60) NOT NULL, status VARCHAR(10) NOT NULL,
  row_count INT NULL, seconds DECIMAL(9,3) NULL, message VARCHAR(400) NULL, finished_at VARCHAR(30) NOT NULL
);
GO
CREATE TABLE dq.results (
  run_id VARCHAR(20) NOT NULL, check_name VARCHAR(80) NOT NULL, severity VARCHAR(5) NOT NULL,
  failed_rows INT NOT NULL, status VARCHAR(5) NOT NULL, description VARCHAR(300) NOT NULL
);
GO
