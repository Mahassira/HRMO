/* HRMO — core schema for Azure SQL Database (phase 1: organisation, employees, leave, approvals, policy, audit).
   Run as a member of the SQL admin Entra group. Idempotency: run once on an empty database.

   Security model
   - No SQL logins. The API connects with its managed identity (step 0).
   - The API sets the caller on every connection:
       EXEC sys.sp_set_session_context N'employee_id', @id, @read_only = 1;
       EXEC sys.sp_set_session_context N'role', @role, @read_only = 1;   -- EMPLOYEE | MANAGER | HR | CD
   - Row-level security (section 7) filters every query by that context, so a bug in the API cannot leak other rows.
   - Salary and other sensitive fields live in separate tables that MANAGER and EMPLOYEE (others) cannot read.
   - Core tables are system-versioned (temporal): every change keeps its previous version.
   - Power BI reads through the rpt schema with its own read-only roles (db/reporting.sql); it has no access to base tables.
*/

-- 0. API identity -------------------------------------------------------------------------------------------------
-- Replace <api-app-name> with the "apiIdentityName" output of infra/main.bicep, then run:
--   CREATE USER [<api-app-name>] FROM EXTERNAL PROVIDER;
--   ALTER ROLE hrmo_api ADD MEMBER [<api-app-name>];

CREATE ROLE hrmo_api;
GO
-- Read-only roles for Power BI (see db/reporting.sql). They can read the rpt schema only.
CREATE ROLE hrmo_reporting;            -- workforce data without pay or private fields
GO
CREATE ROLE hrmo_reporting_sensitive;  -- adds pay; give only to the finance/HR reporting identity
GO
CREATE SCHEMA org;
GO
CREATE SCHEMA hr;
GO
CREATE SCHEMA lv;
GO
CREATE SCHEMA wf;
GO
CREATE SCHEMA cfg;
GO
CREATE SCHEMA audit;
GO
CREATE SCHEMA sec;
GO

-- 1. Organisation -------------------------------------------------------------------------------------------------
CREATE TABLE org.Country (
  CountryId     int IDENTITY PRIMARY KEY,
  Code          varchar(8)    NOT NULL UNIQUE,
  NameEn        nvarchar(120) NOT NULL,
  NameAr        nvarchar(120) NOT NULL,
  Currency      char(3)       NOT NULL DEFAULT 'USD'
);

CREATE TABLE org.Office (
  OfficeId      int IDENTITY PRIMARY KEY,
  CountryId     int           NOT NULL REFERENCES org.Country,
  Code          varchar(8)    NOT NULL,
  NameEn        nvarchar(120) NOT NULL,
  NameAr        nvarchar(120) NOT NULL,
  HardshipLevel char(1)       NOT NULL DEFAULT 'A' CHECK (HardshipLevel IN ('A','B','C')),
  UNIQUE (CountryId, Code)
);

CREATE TABLE org.Department (
  DepartmentId  int IDENTITY PRIMARY KEY,
  CountryId     int           NOT NULL REFERENCES org.Country,
  Code          varchar(16)   NOT NULL,
  NameEn        nvarchar(120) NOT NULL,
  NameAr        nvarchar(120) NOT NULL,
  UNIQUE (CountryId, Code)
);

CREATE TABLE org.[Grant] (
  GrantId       int IDENTITY PRIMARY KEY,
  CountryId     int           NOT NULL REFERENCES org.Country,
  Code          varchar(16)   NOT NULL,
  Name          nvarchar(160) NOT NULL,
  StartDate     date          NOT NULL,
  EndDate       date          NOT NULL,
  StaffBudget   decimal(14,2) NULL,
  UNIQUE (CountryId, Code),
  CHECK (EndDate >= StartDate)
);

-- Position control (PC-001): recruitment needs an approved, funded position.
CREATE TABLE org.Position (
  PositionId    int IDENTITY PRIMARY KEY,
  OfficeId      int           NOT NULL REFERENCES org.Office,
  DepartmentId  int           NOT NULL REFERENCES org.Department,
  TitleEn       nvarchar(160) NOT NULL,
  TitleAr       nvarchar(160) NOT NULL,
  Grade         tinyint       NOT NULL,
  GrantId       int           NULL REFERENCES org.[Grant],
  Status        varchar(12)   NOT NULL DEFAULT 'APPROVED' CHECK (Status IN ('DRAFT','APPROVED','FROZEN','CLOSED')),
  RequiresLicence bit         NOT NULL DEFAULT 0
);

-- 2. Employees ----------------------------------------------------------------------------------------------------
CREATE TABLE hr.Employee (
  EmployeeId    int IDENTITY PRIMARY KEY,
  StaffNo       varchar(16)   NOT NULL UNIQUE,
  EntraObjectId uniqueidentifier NULL,            -- links the record to the Microsoft 365 account
  NameEn        nvarchar(160) NOT NULL,
  NameAr        nvarchar(160) NOT NULL,
  Email         nvarchar(256) NULL,
  Gender        char(1)       NULL CHECK (Gender IN ('F','M')),
  Category      varchar(16)   NOT NULL CHECK (Category IN ('REGULAR','TEMPORARY','CONSULTANT','INTERN','VOLUNTEER')),
  StaffType     varchar(8)    NOT NULL DEFAULT 'NATIONAL' CHECK (StaffType IN ('NATIONAL','INTL')),
  PositionId    int           NOT NULL REFERENCES org.Position,
  OfficeId      int           NOT NULL REFERENCES org.Office,
  DepartmentId  int           NOT NULL REFERENCES org.Department,
  ManagerId     int           NULL REFERENCES hr.Employee,
  HireDate      date          NOT NULL,
  ContractEnd   date          NULL,
  ProbationEnd  date          NULL,
  Status        varchar(12)   NOT NULL DEFAULT 'ACTIVE' CHECK (Status IN ('ONBOARDING','ACTIVE','SUSPENDED','SEPARATED')),
  ValidFrom     datetime2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
  ValidTo       datetime2 GENERATED ALWAYS AS ROW END   HIDDEN NOT NULL,
  PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo),
  CHECK (ManagerId IS NULL OR ManagerId <> EmployeeId)
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = hr.EmployeeHistory));

CREATE UNIQUE INDEX UX_Employee_Entra ON hr.Employee (EntraObjectId) WHERE EntraObjectId IS NOT NULL;
CREATE INDEX IX_Employee_Manager ON hr.Employee (ManagerId);
CREATE INDEX IX_Employee_Office  ON hr.Employee (OfficeId, Status);

-- Sensitive data is separated so that it can be denied as a whole (MG-004).
CREATE TABLE hr.EmployeeCompensation (
  EmployeeId    int           NOT NULL PRIMARY KEY REFERENCES hr.Employee,
  BaseSalary    decimal(12,2) NOT NULL,
  Currency      char(3)       NOT NULL DEFAULT 'USD',
  BankName      nvarchar(160) NULL,
  Iban          varchar(64)   MASKED WITH (FUNCTION = 'partial(0,"****",4)') NULL,
  ValidFrom     datetime2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
  ValidTo       datetime2 GENERATED ALWAYS AS ROW END   HIDDEN NOT NULL,
  PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo)
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = hr.EmployeeCompensationHistory));

CREATE TABLE hr.EmployeePrivate (
  EmployeeId        int           NOT NULL PRIMARY KEY REFERENCES hr.Employee,
  NationalId        varchar(32)   MASKED WITH (FUNCTION = 'partial(0,"****",3)') NULL,
  BirthDate         date          NULL,
  Phone             varchar(32)   NULL,
  EmergencyName     nvarchar(160) NULL,   -- DC-006
  EmergencyPhone    varchar(32)   NULL,
  DisabilityDeclared bit          NULL    -- DI-003: voluntary, reported only in aggregate (DI-004)
);

CREATE TABLE hr.GrantAllocation (
  EmployeeId    int          NOT NULL REFERENCES hr.Employee,
  GrantId       int          NOT NULL REFERENCES org.[Grant],
  Percentage    decimal(5,2) NOT NULL CHECK (Percentage > 0 AND Percentage <= 100),
  StartDate     date         NOT NULL,
  EndDate       date         NULL,
  PRIMARY KEY (EmployeeId, GrantId, StartDate)
);

-- 3. Roles --------------------------------------------------------------------------------------------------------
-- MANAGER is derived from hr.Employee.ManagerId (MG-001); HR and CD are assigned here, scoped to a country.
CREATE TABLE sec.RoleAssignment (
  EmployeeId    int         NOT NULL REFERENCES hr.Employee,
  Role          varchar(8)  NOT NULL CHECK (Role IN ('HR','CD','SECURITY','STAFFCARE')),
  CountryId     int         NOT NULL REFERENCES org.Country,
  GrantedBy     int         NOT NULL REFERENCES hr.Employee,
  GrantedAt     datetime2   NOT NULL DEFAULT sysutcdatetime(),
  PRIMARY KEY (EmployeeId, Role, CountryId)
);

-- 4. Policy -------------------------------------------------------------------------------------------------------
-- One policy set per country, versioned by validity dates. Value holds the JSON of policy-defaults.json.
CREATE TABLE cfg.PolicySet (
  PolicySetId   int IDENTITY PRIMARY KEY,
  CountryId     int           NOT NULL REFERENCES org.Country,
  ValidFrom     date          NOT NULL,
  ValidTo       date          NULL,
  Value         nvarchar(max) NOT NULL CHECK (ISJSON(Value) = 1),
  ApprovedBy    int           NULL REFERENCES hr.Employee,
  CreatedAt     datetime2     NOT NULL DEFAULT sysutcdatetime(),
  UNIQUE (CountryId, ValidFrom)
);

CREATE TABLE cfg.Holiday (
  CountryId     int           NOT NULL REFERENCES org.Country,
  [Date]        date          NOT NULL,
  NameEn        nvarchar(120) NOT NULL,
  NameAr        nvarchar(120) NOT NULL,
  PRIMARY KEY (CountryId, [Date])
);

-- 5. Leave --------------------------------------------------------------------------------------------------------
CREATE TABLE lv.LeaveType (
  LeaveTypeId   int IDENTITY PRIMARY KEY,
  Code          varchar(16)   NOT NULL UNIQUE,   -- ANNUAL, SICK, MATERNITY ...
  NameEn        nvarchar(80)  NOT NULL,
  NameAr        nvarchar(80)  NOT NULL,
  Paid          bit           NOT NULL DEFAULT 1,
  Accrues       bit           NOT NULL DEFAULT 0
);

-- Balances are a ledger: the balance is the sum of entries, so every change is traceable (LV-010..015).
CREATE TABLE lv.LeaveLedger (
  LedgerId      bigint IDENTITY PRIMARY KEY,
  EmployeeId    int           NOT NULL REFERENCES hr.Employee,
  LeaveTypeId   int           NOT NULL REFERENCES lv.LeaveType,
  EntryDate     date          NOT NULL,
  Days          decimal(6,2)  NOT NULL,          -- + accrual / carry-over, − taken / forfeited
  Kind          varchar(12)   NOT NULL CHECK (Kind IN ('ACCRUAL','CARRYOVER','TAKEN','FORFEIT','ADJUST','PAYOUT')),
  RequestId     int           NULL,
  Note          nvarchar(240) NULL,
  CreatedBy     int           NULL REFERENCES hr.Employee,
  CreatedAt     datetime2     NOT NULL DEFAULT sysutcdatetime()
);
CREATE INDEX IX_Ledger_Emp ON lv.LeaveLedger (EmployeeId, LeaveTypeId, EntryDate) INCLUDE (Days);

CREATE TABLE lv.LeaveRequest (
  RequestId     int IDENTITY PRIMARY KEY,
  EmployeeId    int           NOT NULL REFERENCES hr.Employee,
  LeaveTypeId   int           NOT NULL REFERENCES lv.LeaveType,
  StartDate     date          NOT NULL,
  EndDate       date          NOT NULL,
  WorkingDays   decimal(5,2)  NOT NULL,          -- computed by the API from the calendar and holidays
  Reason        nvarchar(400) NULL,
  Status        varchar(12)   NOT NULL DEFAULT 'PENDING' CHECK (Status IN ('PENDING','MANAGER_OK','APPROVED','REJECTED','CANCELLED')),
  PolicyChecks  nvarchar(max) NULL CHECK (PolicyChecks IS NULL OR ISJSON(PolicyChecks) = 1), -- rule IDs evaluated at submit time
  CreatedAt     datetime2     NOT NULL DEFAULT sysutcdatetime(),
  CHECK (EndDate >= StartDate)
);
CREATE INDEX IX_Request_Emp    ON lv.LeaveRequest (EmployeeId, StartDate);
CREATE INDEX IX_Request_Status ON lv.LeaveRequest (Status) INCLUDE (EmployeeId, StartDate, EndDate);

-- 6. Approvals and audit -------------------------------------------------------------------------------------------
-- Generic approval record used by every module (leave, change of status, hire, sanction, position ...).
CREATE TABLE wf.Approval (
  ApprovalId    int IDENTITY PRIMARY KEY,
  Type          varchar(16)   NOT NULL,          -- LEAVE, COS, HIRE, SANCTION, POSITION, OVERTIME, TRAVEL
  SubjectId     int           NOT NULL REFERENCES hr.Employee,
  RefTable      sysname       NULL,
  RefId         int           NULL,
  Payload       nvarchar(max) NULL CHECK (Payload IS NULL OR ISJSON(Payload) = 1),
  Status        varchar(12)   NOT NULL DEFAULT 'PENDING' CHECK (Status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  CreatedBy     int           NOT NULL REFERENCES hr.Employee,
  CreatedAt     datetime2     NOT NULL DEFAULT sysutcdatetime()
);

CREATE TABLE wf.ApprovalStep (
  ApprovalId    int           NOT NULL REFERENCES wf.Approval,
  StepNo        tinyint       NOT NULL,
  ApproverRole  varchar(8)    NOT NULL CHECK (ApproverRole IN ('MANAGER','HR','CD')),
  ApproverId    int           NULL REFERENCES hr.Employee,  -- set for MANAGER steps; role-based otherwise
  Decision      varchar(12)   NULL CHECK (Decision IN ('APPROVED','REJECTED')),
  Comment       nvarchar(400) NULL,
  DecidedBy     int           NULL REFERENCES hr.Employee,
  DecidedAt     datetime2     NULL,
  Channel       varchar(8)    NULL CHECK (Channel IN ('WEB','TEAMS','OUTLOOK')),
  PRIMARY KEY (ApprovalId, StepNo)
);
CREATE INDEX IX_Step_Open ON wf.ApprovalStep (ApproverId, ApproverRole) WHERE Decision IS NULL;

-- Append-only audit trail (RD-006). The API role can insert and read but never update or delete.
CREATE TABLE audit.Event (
  EventId       bigint IDENTITY PRIMARY KEY,
  At            datetime2     NOT NULL DEFAULT sysutcdatetime(),
  ActorId       int           NULL,
  ActorRole     varchar(8)    NULL,
  Action        varchar(48)   NOT NULL,          -- e.g. leave.approve, employee.update, policy.change
  Entity        varchar(48)   NULL,
  EntityId      varchar(48)   NULL,
  RuleId        varchar(12)   NULL,              -- rule that allowed or blocked the action
  Detail        nvarchar(max) NULL CHECK (Detail IS NULL OR ISJSON(Detail) = 1)
);
CREATE INDEX IX_Event_Entity ON audit.Event (Entity, EntityId, At);
GO

-- 7. Row-level security --------------------------------------------------------------------------------------------
-- Who may see an employee row: the employee, their line manager, HR and CD.
CREATE FUNCTION sec.fn_employee_visible (@EmployeeId int, @ManagerId int)
RETURNS TABLE WITH SCHEMABINDING AS
RETURN SELECT 1 AS ok
WHERE @EmployeeId = CAST(SESSION_CONTEXT(N'employee_id') AS int)
   OR @ManagerId  = CAST(SESSION_CONTEXT(N'employee_id') AS int)
   OR CAST(SESSION_CONTEXT(N'role') AS varchar(8)) IN ('HR', 'CD')
   OR IS_ROLEMEMBER(N'hrmo_reporting') = 1 OR IS_ROLEMEMBER(N'hrmo_reporting_sensitive') = 1;
GO

-- Sensitive tables: the employee (own row) and HR/CD only. Managers are excluded on purpose.
CREATE FUNCTION sec.fn_sensitive_visible (@EmployeeId int)
RETURNS TABLE WITH SCHEMABINDING AS
RETURN SELECT 1 AS ok
WHERE @EmployeeId = CAST(SESSION_CONTEXT(N'employee_id') AS int)
   OR CAST(SESSION_CONTEXT(N'role') AS varchar(8)) IN ('HR', 'CD')
   OR IS_ROLEMEMBER(N'hrmo_reporting_sensitive') = 1;
GO

-- Rows that belong to an employee (leave, ledger): self, HR/CD, or the employee's line manager.
CREATE FUNCTION sec.fn_owned_visible (@EmployeeId int)
RETURNS TABLE WITH SCHEMABINDING AS
RETURN SELECT 1 AS ok
WHERE @EmployeeId = CAST(SESSION_CONTEXT(N'employee_id') AS int)
   OR CAST(SESSION_CONTEXT(N'role') AS varchar(8)) IN ('HR', 'CD')
   OR IS_ROLEMEMBER(N'hrmo_reporting') = 1 OR IS_ROLEMEMBER(N'hrmo_reporting_sensitive') = 1
   OR EXISTS (SELECT 1 FROM hr.Employee e
              WHERE e.EmployeeId = @EmployeeId
                AND e.ManagerId = CAST(SESSION_CONTEXT(N'employee_id') AS int));
GO

CREATE SECURITY POLICY sec.EmployeePolicy
  ADD FILTER PREDICATE sec.fn_employee_visible(EmployeeId, ManagerId) ON hr.Employee,
  ADD FILTER PREDICATE sec.fn_sensitive_visible(EmployeeId) ON hr.EmployeeCompensation,
  ADD FILTER PREDICATE sec.fn_sensitive_visible(EmployeeId) ON hr.EmployeePrivate,
  ADD FILTER PREDICATE sec.fn_owned_visible(EmployeeId)     ON lv.LeaveRequest,
  ADD BLOCK  PREDICATE sec.fn_owned_visible(EmployeeId)     ON lv.LeaveRequest AFTER INSERT,
  ADD FILTER PREDICATE sec.fn_owned_visible(EmployeeId)     ON lv.LeaveLedger
  WITH (STATE = ON, SCHEMABINDING = ON);
GO

-- Approvals and audit rows are filtered in the API (an approver's scope depends on the step), not by RLS.

-- 8. Permissions ---------------------------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON SCHEMA::org TO hrmo_api;
GRANT SELECT, INSERT, UPDATE ON SCHEMA::hr  TO hrmo_api;
GRANT SELECT, INSERT, UPDATE ON SCHEMA::lv  TO hrmo_api;
GRANT SELECT, INSERT, UPDATE ON SCHEMA::wf  TO hrmo_api;
GRANT SELECT, INSERT, UPDATE ON SCHEMA::cfg TO hrmo_api;
GRANT SELECT, INSERT         ON SCHEMA::audit TO hrmo_api;   -- append-only
GRANT SELECT                 ON SCHEMA::sec TO hrmo_api;
GRANT UNMASK ON hr.EmployeeCompensation TO hrmo_api;         -- masking protects ad-hoc readers, not the API
GRANT UNMASK ON hr.EmployeePrivate      TO hrmo_api;
DENY  DELETE ON SCHEMA::audit TO hrmo_api;
DENY  UPDATE ON SCHEMA::audit TO hrmo_api;
GO
