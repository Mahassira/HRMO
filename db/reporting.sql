/* HRMO — reporting layer for Power BI. Run after db/schema.sql.

   A star schema exposed as views in the rpt schema, inside the same database:
     dimensions  rpt.DimDate, DimEmployee, DimOffice, DimDepartment, DimGrant, DimLeaveType
     facts       rpt.FactHeadcountMonthly, FactLeave, FactLeaveBalance, FactApproval, FactGrantAllocation
     sensitive   rpt.FactCompensation, rpt.FactGrantCost

   Why views and not a separate warehouse: one source and a small volume. The views can later be
   materialised into tables, or moved to a warehouse fed by Azure Data Factory, without changing the
   Power BI model, because the names and columns stay the same.

   Access
   - Power BI signs in with its own Entra identity (a service principal or the gateway account):
       CREATE USER [<powerbi-identity>] FROM EXTERNAL PROVIDER;
       ALTER ROLE hrmo_reporting ADD MEMBER [<powerbi-identity>];
   - hrmo_reporting reads workforce views only: no pay, no national ID, no bank, no phone, no case files.
   - hrmo_reporting_sensitive adds the two pay views. Use a separate identity and a separate, restricted workspace.
   - Neither role has any permission on base tables.
   - Who sees which office or country inside a report is set with row-level security roles in the Power BI model.
*/

CREATE SCHEMA rpt;
GO

-- Dimensions ------------------------------------------------------------------------------------------------------
CREATE TABLE rpt.DimDate (
  DateKey     int       NOT NULL PRIMARY KEY,   -- yyyymmdd
  [Date]      date      NOT NULL UNIQUE,
  [Year]      smallint  NOT NULL,
  [Quarter]   tinyint   NOT NULL,
  [Month]     tinyint   NOT NULL,
  MonthStart  date      NOT NULL,
  YearMonth   char(7)   NOT NULL,               -- 2026-11
  IsMonthEnd  bit       NOT NULL
);
GO
WITH n AS (
  SELECT TOP (DATEDIFF(day, '2015-01-01', '2040-12-31') + 1)
         ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS i
  FROM sys.all_objects a CROSS JOIN sys.all_objects b
), d AS (SELECT DATEADD(day, i, CAST('2015-01-01' AS date)) AS dt FROM n)
INSERT rpt.DimDate (DateKey, [Date], [Year], [Quarter], [Month], MonthStart, YearMonth, IsMonthEnd)
SELECT YEAR(dt) * 10000 + MONTH(dt) * 100 + DAY(dt), dt, YEAR(dt), DATEPART(quarter, dt), MONTH(dt),
       DATEFROMPARTS(YEAR(dt), MONTH(dt), 1), CONVERT(char(7), dt, 126), IIF(dt = EOMONTH(dt), 1, 0)
FROM d;
GO

CREATE VIEW rpt.DimOffice AS
SELECT o.OfficeId AS OfficeKey, o.Code AS OfficeCode, o.NameEn AS OfficeEn, o.NameAr AS OfficeAr,
       o.HardshipLevel, c.Code AS CountryCode, c.NameEn AS CountryEn, c.NameAr AS CountryAr
FROM org.Office o JOIN org.Country c ON c.CountryId = o.CountryId;
GO

CREATE VIEW rpt.DimDepartment AS
SELECT DepartmentId AS DepartmentKey, Code AS DepartmentCode, NameEn AS DepartmentEn, NameAr AS DepartmentAr
FROM org.Department;
GO

CREATE VIEW rpt.DimGrant AS
SELECT GrantId AS GrantKey, Code AS GrantCode, Name AS GrantName, StartDate, EndDate,
       DATEDIFF(day, CAST(sysutcdatetime() AS date), EndDate) AS DaysToEnd
FROM org.[Grant];
GO

CREATE VIEW rpt.DimLeaveType AS
SELECT LeaveTypeId AS LeaveTypeKey, Code AS LeaveTypeCode, NameEn AS LeaveTypeEn, NameAr AS LeaveTypeAr, Paid
FROM lv.LeaveType;
GO

-- No pay, national ID, bank, phone or emergency contact here.
CREATE VIEW rpt.DimEmployee AS
SELECT e.EmployeeId AS EmployeeKey, e.StaffNo, e.NameEn, e.NameAr, e.Gender, e.Category, e.StaffType,
       p.Grade, p.TitleEn, p.TitleAr,
       IIF(p.Grade >= 8, 1, 0) AS IsLeadership,   -- threshold: policy key diversity.leadershipMinGrade
       e.OfficeId AS OfficeKey, e.DepartmentId AS DepartmentKey, e.ManagerId AS ManagerKey,
       e.HireDate, e.ContractEnd, e.ProbationEnd, e.Status,
       DATEDIFF(month, e.HireDate, CAST(sysutcdatetime() AS date)) / 12.0 AS ServiceYears,
       DATEDIFF(day, CAST(sysutcdatetime() AS date), e.ContractEnd) AS DaysToContractEnd
FROM hr.Employee e JOIN org.Position p ON p.PositionId = e.PositionId;
GO

-- Facts -----------------------------------------------------------------------------------------------------------
-- One row per employee per month end, rebuilt from the temporal history: headcount, turnover and movement trends.
CREATE VIEW rpt.FactHeadcountMonthly AS
SELECT d.DateKey, v.EmployeeId AS EmployeeKey, v.OfficeId AS OfficeKey, v.DepartmentId AS DepartmentKey,
       v.Category, v.StaffType, v.Status, 1 AS Headcount
FROM rpt.DimDate d
JOIN (SELECT EmployeeId, OfficeId, DepartmentId, Category, StaffType, Status, HireDate, ValidFrom, ValidTo
      FROM hr.Employee FOR SYSTEM_TIME ALL) v
  ON v.ValidFrom <= d.[Date] AND v.ValidTo > d.[Date] AND v.HireDate <= d.[Date]
WHERE d.IsMonthEnd = 1
  AND d.[Date] <= CAST(sysutcdatetime() AS date)
  AND v.Status IN ('ACTIVE', 'SUSPENDED');
GO

-- One row per leave request. The reason text is left out on purpose.
CREATE VIEW rpt.FactLeave AS
SELECT r.RequestId, r.EmployeeId AS EmployeeKey, r.LeaveTypeId AS LeaveTypeKey,
       YEAR(r.StartDate) * 10000 + MONTH(r.StartDate) * 100 + DAY(r.StartDate) AS StartDateKey,
       r.StartDate, r.EndDate, r.WorkingDays, r.Status,
       YEAR(r.CreatedAt) * 10000 + MONTH(r.CreatedAt) * 100 + DAY(r.CreatedAt) AS RequestedDateKey
FROM lv.LeaveRequest r;
GO

CREATE VIEW rpt.FactLeaveBalance AS
SELECT l.EmployeeId AS EmployeeKey, l.LeaveTypeId AS LeaveTypeKey,
       SUM(IIF(l.Days > 0, l.Days, 0)) AS DaysCredited,
       -SUM(IIF(l.Days < 0, l.Days, 0)) AS DaysUsed,
       SUM(l.Days) AS DaysAvailable
FROM lv.LeaveLedger l
GROUP BY l.EmployeeId, l.LeaveTypeId;
GO

-- One row per approval step: volumes, decision time, and how many are decided from Teams or Outlook.
CREATE VIEW rpt.FactApproval AS
SELECT a.ApprovalId, s.StepNo, a.Type AS ApprovalType, a.SubjectId AS EmployeeKey, s.ApproverRole,
       YEAR(a.CreatedAt) * 10000 + MONTH(a.CreatedAt) * 100 + DAY(a.CreatedAt) AS CreatedDateKey,
       s.Decision, s.Channel, a.Status AS ApprovalStatus,
       DATEDIFF(minute, a.CreatedAt, s.DecidedAt) / 60.0 AS HoursToDecision,
       IIF(s.Decision IS NULL, 1, 0) AS IsOpen
FROM wf.Approval a JOIN wf.ApprovalStep s ON s.ApprovalId = a.ApprovalId;
GO

CREATE VIEW rpt.FactGrantAllocation AS
SELECT g.EmployeeId AS EmployeeKey, g.GrantId AS GrantKey, g.Percentage, g.StartDate, g.EndDate,
       IIF(g.EndDate IS NULL OR g.EndDate >= CAST(sysutcdatetime() AS date), 1, 0) AS IsCurrent
FROM hr.GrantAllocation g;
GO

-- Sensitive facts (hrmo_reporting_sensitive only) -----------------------------------------------------------------
CREATE VIEW rpt.FactCompensation AS
SELECT c.EmployeeId AS EmployeeKey, c.BaseSalary, c.Currency
FROM hr.EmployeeCompensation c;
GO

-- Monthly staff cost charged to each grant.
CREATE VIEW rpt.FactGrantCost AS
SELECT g.EmployeeId AS EmployeeKey, g.GrantId AS GrantKey, c.Currency,
       c.BaseSalary * g.Percentage / 100.0 AS MonthlyCost
FROM hr.GrantAllocation g JOIN hr.EmployeeCompensation c ON c.EmployeeId = g.EmployeeId
WHERE g.EndDate IS NULL OR g.EndDate >= CAST(sysutcdatetime() AS date);
GO

-- Permissions -----------------------------------------------------------------------------------------------------
GRANT SELECT ON rpt.DimDate              TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.DimOffice            TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.DimDepartment        TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.DimGrant             TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.DimLeaveType         TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.DimEmployee          TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.FactHeadcountMonthly TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.FactLeave            TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.FactLeaveBalance     TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.FactApproval         TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.FactGrantAllocation  TO hrmo_reporting, hrmo_reporting_sensitive;
GRANT SELECT ON rpt.FactCompensation     TO hrmo_reporting_sensitive;
GRANT SELECT ON rpt.FactGrantCost        TO hrmo_reporting_sensitive;
GO
