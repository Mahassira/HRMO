-- 03 · Gold: the star schema that Power BI reads.
-- Dimensions describe (who, where, when). Facts measure (hours, pay).
-- Facts point to dimensions with integer keys. gold.DimDate is filled by the pipeline before this file runs.
-- Rebuilt in full on every run.

DROP TABLE IF EXISTS gold.FactAttendance;
GO
DROP TABLE IF EXISTS gold.FactPayroll;
GO
DROP TABLE IF EXISTS gold.DimEmployee;
GO
DROP TABLE IF EXISTS gold.DimOffice;
GO
DROP TABLE IF EXISTS gold.DimDepartment;
GO

-- ---------------------------------------------------------------------- dimensions
CREATE TABLE gold.DimOffice (OfficeKey INT NOT NULL PRIMARY KEY, OfficeCode VARCHAR(8) NOT NULL UNIQUE);
GO
INSERT INTO gold.DimOffice
SELECT ROW_NUMBER() OVER (ORDER BY office), office
FROM (SELECT DISTINCT office FROM silver.employee) o;
GO

CREATE TABLE gold.DimDepartment (DepartmentKey INT NOT NULL PRIMARY KEY, DepartmentCode VARCHAR(16) NOT NULL UNIQUE);
GO
INSERT INTO gold.DimDepartment
SELECT ROW_NUMBER() OVER (ORDER BY department), department
FROM (SELECT DISTINCT department FROM silver.employee) d;
GO

-- No salary here: pay lives only in the fact table, so access to it can be restricted separately.
CREATE TABLE gold.DimEmployee (
  EmployeeKey INT NOT NULL PRIMARY KEY, StaffNo VARCHAR(16) NOT NULL UNIQUE, FullName NVARCHAR(160) NOT NULL,
  Gender CHAR(1) NOT NULL, Category VARCHAR(16) NOT NULL, Grade INT NOT NULL,
  OfficeKey INT NOT NULL, DepartmentKey INT NOT NULL, HireDate DATE NOT NULL, HireDateKey INT NOT NULL
);
GO
INSERT INTO gold.DimEmployee
SELECT ROW_NUMBER() OVER (ORDER BY e.staff_no), e.staff_no, e.full_name, e.gender, e.category, e.grade,
       o.OfficeKey, d.DepartmentKey, e.hire_date,
       YEAR(e.hire_date) * 10000 + MONTH(e.hire_date) * 100 + DAY(e.hire_date)
FROM silver.employee e
JOIN gold.DimOffice o ON o.OfficeCode = e.office
JOIN gold.DimDepartment d ON d.DepartmentCode = e.department;
GO

-- ---------------------------------------------------------------------- facts
-- Grain: one row per employee per working day.
CREATE TABLE gold.FactAttendance (
  DateKey INT NOT NULL, EmployeeKey INT NOT NULL, OfficeKey INT NOT NULL, DepartmentKey INT NOT NULL,
  HoursWorked DECIMAL(5,2) NULL, IsLate INT NOT NULL, IsIncomplete INT NOT NULL,
  PRIMARY KEY (DateKey, EmployeeKey)
);
GO
INSERT INTO gold.FactAttendance
SELECT YEAR(a.work_date) * 10000 + MONTH(a.work_date) * 100 + DAY(a.work_date),
       e.EmployeeKey, e.OfficeKey, e.DepartmentKey, a.hours_worked, a.is_late, a.is_incomplete
FROM silver.attendance a
JOIN gold.DimEmployee e ON e.StaffNo = a.staff_no;
GO

-- Grain: one row per employee per month. MonthKey is the DateKey of the first day of the month.
CREATE TABLE gold.FactPayroll (
  MonthKey INT NOT NULL, EmployeeKey INT NOT NULL, OfficeKey INT NOT NULL, DepartmentKey INT NOT NULL,
  Gross DECIMAL(12,2) NOT NULL, Deductions DECIMAL(12,2) NOT NULL, Net DECIMAL(12,2) NOT NULL, Currency CHAR(3) NOT NULL,
  PRIMARY KEY (MonthKey, EmployeeKey)
);
GO
INSERT INTO gold.FactPayroll
SELECT CAST(REPLACE(p.pay_month, '-', '') AS INT) * 100 + 1,
       e.EmployeeKey, e.OfficeKey, e.DepartmentKey, p.gross, p.deductions, p.net, p.currency
FROM silver.payroll p
JOIN gold.DimEmployee e ON e.StaffNo = p.staff_no;
GO

-- Reports filter by employee and by office, so those columns are indexed. See benchmark.py for the effect.
CREATE INDEX IX_FactAttendance_Employee ON gold.FactAttendance (EmployeeKey, DateKey);
GO
CREATE INDEX IX_FactAttendance_Office ON gold.FactAttendance (OfficeKey, DateKey);
GO
CREATE INDEX IX_FactPayroll_Employee ON gold.FactPayroll (EmployeeKey, MonthKey);
GO
