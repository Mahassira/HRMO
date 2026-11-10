# HR Suite — Functional System Reference

> **Version:** 0.1 (baseline) · **Status:** Draft for review · **Language:** English ([العربية](../ar/system-reference.md))
>
> **Companion file:** [`data/config-defaults/policy-defaults.json`](../../data/config-defaults/policy-defaults.json)

---

## 0. About this document

### 0.1 Purpose
This document is the **functional reference** for HR Suite, a configurable human-resources management system for humanitarian and non-profit organizations of up to ~800 employees, built on Microsoft Power Platform (Dataverse, Power Apps, Power Automate, Power BI).

It defines **what the system must do**: business rules, workflows, approvals, forms, notifications and the configuration parameters behind them. Technical design (tables, columns, security roles, flows) is derived from this document in separate design documents.

### 0.2 Source and treatment
The rules were derived from a real national-staff policy manual of an international humanitarian NGO. To make the product generic and to respect the source owner's rights:

- No organization name, branding, people, contact details, URLs, or internal system names are included.
- No policy text is reproduced. Rules were **extracted and rewritten** as system requirements.
- Country-specific values (working week, holidays, per-diem locations, statutory references) are treated as **sample values** inside a configurable *Country Policy Set*.
- Narrative policies (code of conduct, harassment, fraud, safeguarding, etc.) are **not shipped as text**. The system provides a *Policy Library* in which each customer uploads its own documents and tracks acknowledgements.

> ⚠️ **Default values are examples, not legal advice.** Each customer must verify them against its own policies and the labor law of each country it operates in.

### 0.3 How to read the rules
Each rule has:

| Field | Meaning |
|---|---|
| **ID** | Stable identifier, e.g. `LV-012`. Used in code comments, tests and change requests. |
| **Rule** | What the system enforces or supports. |
| **Parameter** | Configuration key in `policy-defaults.json` (dot notation). |
| **Default** | Value shipped with the default template. |
| **Enforcement** | `Block` = the system prevents the action · `Warn` = allowed with a warning and justification · `Track` = recorded and reported only · `Notify` = triggers a notification. |

All parameters are **effective-dated** (`validFrom` / `validTo`) and scoped to a **Country Policy Set**, optionally overridden per **Employment Category**.

---

## 1. Organization model

| ID | Rule | Parameter | Default |
|---|---|---|---|
| ORG-001 | The system supports one **Organization** with multiple **Country Offices**. Each Country Office is linked to exactly one **Country Policy Set**. | `organization.multiCountry` | `true` |
| ORG-002 | Each Country Office contains **Sites** (main office, field sites). Employees have one **Duty Station** (site). | — | — |
| ORG-003 | **Departments/Sectors** and **Positions** are defined per Country Office. A position has a grade, a job description and one or more funding sources. | — | — |
| ORG-004 | **Grants/Projects** are master data with donor, start/end date, budget code and status. Positions and timesheets allocate percentages to grants. | `organization.grantAllocationEnabled` | `true` |
| ORG-005 | Organization name, logo, colors, reporting-channel URL and contact e-mails are settings, not code. | `organization.branding.*` | placeholders |
| ORG-006 | All UI and generated documents support **Arabic (RTL)** and **English**. Default language per user. | `organization.languages` | `["en","ar"]` |
| ORG-007 | Multiple currencies are supported per Country Office. Salary is stored in the contract currency. | `countryPolicy.currencies` | `["USD","ILS"]` (sample) |

---

## 2. Roles catalog

Role names are configurable labels; the system logic uses the role **keys** below.

| Key | Default label | Responsibilities in the system |
|---|---|---|
| `EMPLOYEE` | Employee | Self-service: profile updates, leave, timesheets, objectives, self-assessment, declarations, acknowledgements, resignation. |
| `LINE_MANAGER` | Line manager (1st line) | Approves leave, timesheets, overtime, travel; appraises; raises performance and conduct issues. |
| `SECOND_LINE_MANAGER` | Second-line manager | Countersigns appraisals; escalation point for grievances. |
| `DEPARTMENT_HEAD` | Head of department | Recommends hiring, approves position needs, reviews appraisal disputes. |
| `SITE_MANAGER` | Site / area manager | Approves for field sites (travel, flexible hours, LWOP recommendation). |
| `HR_OFFICER` | HR / recruitment officer | Operates recruitment, onboarding, records, attendance checks. |
| `HR_MANAGER` | HR manager | Owns HR processes, approves HR actions, configures policy within limits. |
| `FINANCE` | Finance | Payroll inputs, advances, deductions, exit clearance, per diem payments. |
| `FINANCE_DIRECTOR` | Finance & admin director | Approves new positions, salary changes, meeting expenses. |
| `LOGISTICS` | Logistics / facilities | Assets, keys, vehicles, exit clearance. |
| `SECURITY_FOCAL` | Security focal point | Approves field travel; receives incident reports. |
| `COMPLIANCE` | Compliance / screening officer | Runs prohibited-party screening; restricted access to results. |
| `HEAD_OF_OFFICE` | Head of office / country director | Final authority for hiring, promotion, separation, discipline, salary increases, policy exceptions. |
| `HQ_HR` | HQ / regional HR | Escalation when the Head of Office is party to a case; receives restricted reports. |
| `SYSTEM_ADMIN` | System administrator | Technical configuration, security roles, integrations. |

| ID | Rule | Parameter | Default |
|---|---|---|---|
| ROL-001 | A user may hold several roles. Approval steps resolve roles **relative to the requester** (e.g. *the requester's* line manager). | — | — |
| ROL-002 | **Delegation**: an approver can delegate approvals for a date range; delegation is logged. | `approvals.delegationEnabled` | `true` |
| ROL-003 | **Acting appointments** (see LC-030) automatically grant the approval rights of the acting position for its duration. | — | — |
| ROL-004 | Approvals pending longer than the escalation period escalate to the approver's manager and notify HR. | `approvals.escalationAfterBusinessDays` | `3` |

---

## 3. Employment categories

| Key | Default label | Employee? | Benefits | Time recording | Notes |
|---|---|---|---|---|---|
| `REGULAR` | Regular staff | Yes | Full | Monthly timesheet + daily attendance | Contract longer than the minimum regular duration. |
| `FIXED_SHORT` | Short fixed-term | Yes | Pro-rata / limited | Monthly timesheet | Contract ≤ regular minimum duration. |
| `DAILY` | Casual / daily worker | Yes (daily) | None | Daily attendance only | Paid per day worked. |
| `SERVICE` | Service contractor | No | None | Time report or invoice | Paid for working days and observed holidays only. |
| `CONSULTANT` | Consultant | No | None | Deliverables + invoice | Paid against scope of work. |
| `INTERN` | Intern | No | Stipend only | Daily attendance | Fixed monthly stipend; certificate on completion. |

| ID | Rule | Parameter | Default |
|---|---|---|---|
| CAT-001 | Minimum contract duration to be classified as regular. | `employmentCategories.regular.minContractMonths` | `3` |
| CAT-002 | Each category defines eligibility for: annual leave, sick leave, other leave types, overtime, 13th-month payment, health insurance, severance, relocation allowance. | `employmentCategories.<key>.eligibility.*` | see JSON |
| CAT-003 | Overtime eligibility is set per category **and** per position (special schedules such as guards and drivers can be excluded). | `employmentCategories.<key>.eligibility.overtime`, position flag `specialSchedule` | Regular: `true` |
| CAT-004 | Consultant and service invoices are not accepted after the submission deadline following completion. | `employmentCategories.consultant.invoiceDeadlineDays` | `60` |
| CAT-005 | Target processing time for complete consultant invoices (tracked KPI). | `employmentCategories.consultant.paymentSlaBusinessDays` | `10` |
| CAT-006 | Interns: fixed stipend, default duration, maximum total duration including extensions, supervisor TOR required, written evaluation at end, certificate issued by HR if performance satisfactory. | `employmentCategories.intern.*` | stipend `150`, 3 months, max 6 |

---

## 4. Recruitment and selection

### 4.1 Workflow

```
Staff requisition ─► Approval ─► Vacancy announcement ─► Applications
     ─► Long list (HR) ─► Short list (Dept + hiring manager)
     ─► Interview panel + tests ─► Individual evaluation forms
     ─► Ranking & recommendation ─► Head of Office approval
     ─► Reference checks ─► Compliance screening ─► Offer
     ─► Contract & job description ─► Onboarding
```

### 4.2 Rules

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| RC-001 | Recruitment starts only from an **approved staff requisition** linked to an approved position and funding. | — | — | Block |
| RC-002 | A **new position** requires approval by Head of Office and Finance Director, based on funding and an approved job description/TOR. | `recruitment.newPositionApprovers` | `["HEAD_OF_OFFICE","FINANCE_DIRECTOR"]` | Block |
| RC-003 | Vacancies are published through configurable channels (website, job boards, partners). In emergencies, direct requests to partner organizations are allowed and flagged. | `recruitment.channels`, `recruitment.allowEmergencyDirectSourcing` | list, `true` | Track |
| RC-004 | HR builds a **long list** from new applications, the existing CV bank and former employees, then shares it with the department for **short-listing**. | — | — | — |
| RC-005 | Minimum age for employment. | `recruitment.minimumAge` | `18` | Block |
| RC-006 | **Conflict screening of candidates**: immediate family of current staff may be hired only if no direct reporting/supervisory line exists; persons tied to entities with business transactions with the organization (incl. government employees, where configured) are flagged. | `recruitment.familyRelationRule`, `recruitment.flagBusinessRelatedCandidates` | `noDirectReporting`, `true` | Warn |
| RC-007 | **Interview panel** size: standard and emergency minimum. Must include an HR representative and a department representative. | `recruitment.panel.standardSize`, `recruitment.panel.minSize` | `3`, `2` | Block |
| RC-008 | **Each panel member** completes and signs an individual interview evaluation form with a clear recommendation. An offer cannot be issued until all forms are submitted and reviewed. | — | — | Block |
| RC-009 | Remote interviews (phone/video) are allowed and recorded as such. | `recruitment.allowRemoteInterviews` | `true` | Track |
| RC-010 | Candidate travel costs to interviews are not reimbursed (configurable). | `recruitment.reimburseCandidateTravel` | `false` | — |
| RC-011 | Skills tests can be attached to a vacancy; results are stored per candidate. | — | — | — |
| RC-012 | The panel **ranks** candidates and recommends to the Head of Office. Specialist/senior positions may require an additional interview with the Head of Office. | `recruitment.seniorPositionsRequireHeadInterview` | `true` | Warn |
| RC-013 | **Final hiring authority** is the Head of Office (or delegate). | `recruitment.hiringAuthority` | `HEAD_OF_OFFICE` | Block |
| RC-014 | **Reference checks**: minimum number, of which at least one from a previous employer. In emergency hiring, references may be completed after start but within probation. | `recruitment.references.min`, `.minFromPreviousEmployer`, `.allowPostHireInEmergency` | `2`, `1`, `true` | Block / Warn |
| RC-015 | **Compliance screening** (prohibited-party / anti-terrorism lists) must be **cleared before** an offer or contract is issued and before the start date — for all hires, re-hires, interns, volunteers and consultants. | `compliance.screening.requiredBeforeOffer` | `true` | **Block** |
| RC-016 | Screening results are visible only to `COMPLIANCE`, `HR_MANAGER` and `HEAD_OF_OFFICE`. Other users see only *Cleared / Pending / Escalated*. | — | — | Security |
| RC-017 | **Internal candidates** may apply only after notifying their line manager. Equally qualified internal candidates are preferred (promotion), then former employees in good standing (re-hire). | `recruitment.internalPreference`, `recruitment.formerEmployeePreference` | `true`, `true` | Track |
| RC-018 | The **offer** includes start date, title, duty station, grade and salary. It is generated from a template. | `documents.templates.offerLetter` | template | — |
| RC-019 | The system keeps a **CV bank**; candidates not selected may be retained for future vacancies, subject to data-retention settings (RD-004). | `recruitment.cvBankRetentionMonths` | `24` | — |

---

## 5. Onboarding and acknowledgements

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| ON-001 | Before the start date, a **contract** is signed by the Head of Office (or delegate) and the employee. A copy goes to the employee; the original goes in the personnel file. | — | — | Block |
| ON-002 | The **job description** is given by the supervisor at start, signed by the employee and attached to the contract. | — | — | Block (for payroll activation) |
| ON-003 | **Mandatory acknowledgements** at hire (configurable list): employee handbook, code of conduct, safeguarding/PSEA, anti-harassment, confidentiality/non-disclosure, employment-terms statement, data-privacy notice. | `onboarding.requiredAcknowledgements` | see JSON | Block (for payroll activation) |
| ON-004 | Acknowledgements are re-requested when a policy document gets a **new version**. | `policyLibrary.reacknowledgeOnNewVersion` | `true` | Notify |
| ON-005 | HR **orientation** must take place within the first week; the line manager provides technical orientation. | `onboarding.orientationWithinDays` | `5` business days | Notify |
| ON-006 | New hires are enrolled in the next **mandatory induction training** session (e.g. safeguarding, harassment prevention), run at a configurable frequency. | `onboarding.mandatoryTrainingFrequency` | `monthly` | Notify |
| ON-007 | The employee completes personal data, dependants, emergency contacts, bank details and required documents (personnel-file checklist). | `onboarding.personnelFileChecklist` | see JSON | Warn |
| ON-008 | **Objective setting** form is opened at hire (see PF-010). | — | — | Notify |
| ON-009 | An **ID card** is issued and recorded as an asset assignment (see AS-004). | — | — | Track |
| ON-010 | Bank account: HR can generate a bank-introduction letter. If no account yet, payment method is set to cheque/cash until updated. | — | — | — |

---

## 6. Probation and employment lifecycle

### 6.1 Probation

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| LC-001 | Probation applies to first contracts, new hires, re-hires **and promotions**. | `probation.appliesTo` | `["NEW","REHIRE","PROMOTION"]` | — |
| LC-002 | Probation duration (cannot exceed the contract length). | `probation.durationMonths` | `3` | Block |
| LC-003 | Probation may be extended once, in writing. | `probation.maxExtensions`, `probation.extensionMonths` | `1`, `1` | Block |
| LC-004 | During probation either party may end the contract without notice. | `probation.noticeDays` | `0` | — |
| LC-005 | During probation, leave requests other than sick leave are recorded as **unpaid**. | `probation.nonSickLeaveAsUnpaid` | `true` | Block / auto-convert |
| LC-006 | Before probation ends, the line manager completes a **probation appraisal**. Outcome: confirm, extend or terminate; a letter is generated. | `probation.reminderDaysBefore` | `14` | Notify |

### 6.2 Changes of status

All changes go through a **Change of Status (COS)** record with effective date, before/after values, justification and approvals. COS types:

| COS type | Typical approvals | Rule IDs |
|---|---|---|
| Transfer (lateral / duty-station reassignment) | Line manager → HR → Head of Office | LC-010 – LC-014 |
| Promotion | Panel/selection → HR → Finance Director → Head of Office | LC-020 – LC-022 |
| Demotion / downward transfer | HR → Head of Office | LC-015 |
| Salary adjustment (increment, grade change) | Line manager → Dept head/Site manager → HR → Finance Director → Head of Office | CP-010 – CP-013 |
| Acting appointment | Line manager → HR → Head of Office | LC-030 – LC-034 |
| Contract renewal / extension | Line manager → HR → Head of Office | LC-040 |
| Category or funding change | HR → Finance → Head of Office | ORG-004 |

| ID | Rule | Parameter | Default |
|---|---|---|---|
| LC-010 | The organization may transfer regular employees between locations; the employee is informed and a COS is approved by the Head of Office. | — | — |
| LC-011 | A one-time **relocation allowance** is payable for an official duty-station change, **not** when the transfer is at the employee's own request. | `lifecycle.relocationAllowance.enabled`, `.excludeSelfRequested` | `true`, `true` |
| LC-012 | Temporary transfers up to a threshold duration are paid **per diem** instead of being a COS. | `lifecycle.temporaryTransferMaxMonths` | `1` |
| LC-013 | Transfer does not imply a salary increase. | — | — |
| LC-014 | Employees may request a duty-station change; approval depends on program needs. | — | — |
| LC-015 | Demotion is possible on employee request or when the position is discontinued and a lower qualified position exists; salary is adjusted to the new grade. An interview may be required. | — | — |
| LC-020 | Promotion requires a vacant approved position and a competitive selection. | — | Block |
| LC-021 | On promotion, salary is adjusted to the new grade and a new probation starts (LC-001). | — | — |
| LC-022 | Re-hire: former employees with a positive exit recommendation (SP-021) are eligible but go through standard selection. | — | Warn if "not eligible for rehire" |
| LC-030 | Acting appointments apply only to existing regular positions. | — | Block |
| LC-031 | Maximum acting duration, unless extended by Head of Office. | `lifecycle.acting.maxMonths` | `4` |
| LC-032 | Acting allowance as % of base salary, payable only if acting lasts at least the minimum period. | `lifecycle.acting.allowancePercent`, `.minMonthsForAllowance` | `10`, `1` |
| LC-033 | Acting appointments are reviewed periodically. | `lifecycle.acting.reviewEveryMonths` | `3` |
| LC-034 | Merit increases during acting are calculated on the original base salary; at the end the salary returns to the original base plus any merit increase. | — | — |
| LC-040 | Contract-end reminders are sent to HR and the line manager before expiry. | `lifecycle.contractExpiryReminderDays` | `[60,30,14]` |
| LC-041 | Employees working away from their contract location are attached to the field office; recruiting non-local staff to a field site requires a written justification on the requisition. Round-trip travel from point of hire and periodic leave travel may be covered. | `lifecycle.relocatableStaff.*` | see JSON |
| LC-042 | A relocatable employee who ends the contract early may be asked to reimburse travel costs. | `lifecycle.relocatableStaff.recoverTravelOnEarlyExit` | `true` |

---

## 7. Working time and attendance

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| WT-001 | Working days of the week (Country Policy Set). | `countryPolicy.workWeek.days` | `["SUN","MON","TUE","WED","THU"]` (sample) | — |
| WT-002 | Standard daily hours and start/end times. | `countryPolicy.workWeek.hoursPerDay`, `.startTime`, `.endTime` | `8`, `08:00`, `16:00` | — |
| WT-003 | Breaks within the working day. | `countryPolicy.workWeek.breaks` | lunch 30 min + break 15 min | — |
| WT-004 | Weekly hours cap. | `countryPolicy.workWeek.maxWeeklyHours` | `40` | Warn |
| WT-005 | Positions with **special schedules** (e.g. guards, drivers) may have a custom schedule within the weekly cap, without overtime. | position `specialSchedule` | — | — |
| WT-010 | **Daily attendance** is recorded (check-in/out) through self-service, a site attendance officer, or an imported device file. Offline capture is supported and synchronized later. | `attendance.captureModes` | `["SELF","OFFICER","IMPORT"]` | — |
| WT-011 | Employees must notify their line manager by a cut-off time if they will be late or absent. | `attendance.absenceNotificationCutoff` | `09:00` | Track |
| WT-012 | Arrival after the start time plus grace period is marked **late** ("red mark"). | `attendance.lateGraceMinutes` | `0` | Track |
| WT-013 | Late marks in a calendar month at or above the threshold open a **conduct case** proposal (coaching → warning) for the line manager and HR. | `attendance.lateMarksPerMonthThreshold` | `3` | Notify |
| WT-014 | **Unauthorized absence** (no approved leave and no notification) is recorded as **unpaid**, per day. | `attendance.unauthorizedAbsenceUnpaidDaysPerDay` | `1` | Auto |
| WT-015 | **Consecutive absence without notice**: at the threshold, the system opens an **absence case** for HR; HR verifies and the Head of Office decides (deemed resignation, unpaid leave, paid leave, suspension). Events beyond the employee's control (disaster, curfew, detention, abduction) can be classified as authorized absence. | `attendance.consecutiveAbsenceCaseDays`, `attendance.deemedResignationEnabled` | `5`, `true` (decision required) | Notify |
| WT-016 | **Flexible hours**: an employee may request a small schedule change in advance; approved by line manager and site manager/department head; time must be made up and recorded. | `attendance.flexibleHours.enabled` | `true` | — |
| WT-020 | **Overtime** must be approved **in advance** by the line manager and communicated to HR before it is worked. | `overtime.requiresPreApproval` | `true` | Block (unapproved hours not paid) |
| WT-021 | Overtime rate multiplier. | `overtime.rateMultiplier` | `1.5` | — |
| WT-022 | Maximum overtime hours per day. | `overtime.maxHoursPerDay` | `2` | Block |
| WT-023 | Approved overtime can be paid or converted to compensatory leave (LV-080). | `overtime.compensationModes` | `["PAY","COMP_LEAVE"]` | — |
| WT-030 | **Public holidays** calendar per Country Policy Set, proposed by HR annually and approved by Head of Office. Additional official holidays can be added during the year. | `countryPolicy.holidays.approval` | `HEAD_OF_OFFICE` | — |
| WT-031 | Public holidays are not carried over unless approved. | `countryPolicy.holidays.allowCarryOver` | `false` | Block |

---

## 8. Timesheets and grant allocation

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| TS-001 | Monthly timesheet is generated automatically from attendance, approved leave, public holidays and approved overtime. | — | — | — |
| TS-002 | Each timesheet shows **percentage allocation per grant**; total must equal 100%. Default allocation comes from the position funding; the employee can adjust within allowed grants. | `timesheets.requireGrantAllocation` | `true` | Block |
| TS-003 | Submission deadline: last working day of the month. | `timesheets.submitOn` | `LAST_WORKING_DAY` | Notify |
| TS-004 | Timesheet must be approved by the line manager, then received by HR. | `timesheets.approvalChain` | `["LINE_MANAGER","HR_OFFICER"]` | Block |
| TS-005 | **Salary is not released** for a month without an approved timesheet. | `timesheets.blockPayWithoutApproval` | `true` | Block |
| TS-006 | HR submits payroll inputs to Finance between the last working day and a cut-off day of the next month. | `payroll.inputsCutoffDayOfNextMonth` | `2` | Notify |
| TS-007 | Approved timesheets are locked; corrections require a reopen request with justification (audited). | — | — | Block |
| TS-008 | Daily workers and interns use daily attendance sheets instead of monthly timesheets. | `employmentCategories.<key>.timeRecording` | see §3 | — |

---

## 9. Leave management

### 9.1 General rules

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| LV-001 | Every leave is requested through the system (Request for Leave), approved by the line manager and received by HR **before** it is taken. | `leave.defaultApprovalChain` | `["LINE_MANAGER","HR_OFFICER"]` | Block |
| LV-002 | **Exceptions**: sick and bereavement leave may be recorded after return; the employee informs the manager as soon as possible. | `leave.types.<key>.allowRetroactive` | sick/bereavement `true` | — |
| LV-003 | Weekly rest days and public holidays inside a leave period are not counted as leave days. | `leave.excludeNonWorkingDays` | `true` | Auto |
| LV-004 | The system checks balance, eligibility, overlap with other leave, and notice period at submission. | — | — | Block |
| LV-005 | Leave types, their rules and their service bands are configuration data (see JSON). | `leave.types` | see below | — |
| LV-006 | Balances are calculated by a scheduled job and on demand; every movement (accrual, use, adjustment, expiry, payout) is a ledger entry. | — | — | Audit |

### 9.2 Default leave types

| Key | Leave | Default entitlement | Eligibility | Pay | Carry-over / cash-out | IDs |
|---|---|---|---|---|---|---|
| `ANNUAL` | Annual leave | 21 working days per year, accrued monthly (1.75/month) | Usable after 3 months of service; pro-rata on separation after 3 months | 100% | Carry-over cap configurable (default 0); unused balance paid at separation | LV-010 – LV-015 |
| `SICK` | Sick leave | Service band 1: 21 days full pay + 21 days half pay per calendar year | From start (also during probation) with medical certificate | 100% then 50% | No carry-over, no cash-out | LV-020 – LV-025 |
| `BEREAVEMENT` | Compassionate / bereavement | 5 days per event | Death of parent, spouse, sibling, child, parent-in-law, sibling-in-law (configurable list) | 100% | No | LV-030 |
| `MATERNITY` | Maternity leave | 3 months (≈ 13 weeks); up to half before delivery | Female employees with ≥ 180 days of service before delivery; medical certificate with expected date | 100% | No | LV-040 – LV-043 |
| `NURSING` | Nursing hour | 1 hour/day reduction | Full-time employees, for 24 months after maternity leave | 100% | No | LV-044 |
| `PATERNITY` | Paternity leave | 5 working days | Regular male employees; within 4 weeks of birth | 100% | No | LV-050 |
| `UNPAID` | Leave without pay (LWOP) | Max 20 days per calendar year | Regular full-time, > 6 months of service; request ≥ 5 working days in advance | 0% | — | LV-060 – LV-064 |
| `COMP` | Compensatory leave | Equal to approved extra days worked | Prior written approval of the extra work | 100% | Must be taken within 10 days | LV-080 – LV-083 |
| `EXT_TRAINING` | External training leave | Max 5 working days per year | Training not funded by the organization and related to current job | 100% | No | LD-020 |
| `TRAVEL_DAYS` | Leave travel days | 2 days each way when proceeding on annual leave | Configurable (e.g. relocatable staff only) | 100% | No | LV-016 |

### 9.3 Detailed rules

| ID | Rule | Parameter | Default |
|---|---|---|---|
| LV-010 | Annual entitlement (working days). | `leave.types.ANNUAL.entitlementDays` | `21` |
| LV-011 | Accrual method. | `leave.types.ANNUAL.accrual` | `MONTHLY` |
| LV-012 | Minimum service before annual leave can be used. | `leave.types.ANNUAL.minServiceMonths` | `3` |
| LV-013 | Short non-renewable contracts (≤ regular minimum) may be excluded. | `employmentCategories.fixedShort.eligibility.annualLeave` | `false` |
| LV-014 | Carry-over cap into the next year (days). Source is silent → default `0`, flagged for customer decision. | `leave.types.ANNUAL.carryOverMaxDays` | `0` |
| LV-015 | Unused accrued annual leave is paid at separation (also for disciplinary dismissal). | `leave.types.ANNUAL.payoutOnSeparation` | `true` |
| LV-016 | Travel days added when proceeding on annual leave. | `leave.types.TRAVEL_DAYS.daysEachWay`, `.appliesTo` | `2`, `RELOCATABLE` |
| LV-020 | Sick leave requires notification to the line manager within the deadline (phone, e-mail or text), otherwise the absence is unauthorized and deducted. | `leave.types.SICK.notifyWithinHours` | `48` |
| LV-021 | Medical certificate required (configurable minimum days without certificate). | `leave.types.SICK.certificateRequiredFromDay` | `1` |
| LV-022 | Service bands for sick leave. The source defines one band only; higher bands default to the same values and must be confirmed. | `leave.types.SICK.serviceBands` | `[{fromYears:0, fullPayDays:21, halfPayDays:21}]` |
| LV-023 | Sick-leave accrual mode. Source states leave is approved only once accrued → default `MONTHLY`; can be switched to `ANNUAL_GRANT`. | `leave.types.SICK.accrual` | `MONTHLY` |
| LV-024 | When sick entitlements are exhausted, the employee may request unpaid leave. | — | — |
| LV-025 | Sick leave is allowed during probation after confirmation of illness. | `leave.types.SICK.allowedInProbation` | `true` |
| LV-030 | Bereavement days per event and qualifying relationships. | `leave.types.BEREAVEMENT.*` | `5`, list |
| LV-040 | Minimum service before delivery for maternity. | `leave.types.MATERNITY.minServiceDays` | `180` |
| LV-041 | Maternity duration and max portion before birth. | `leave.types.MATERNITY.durationWeeks`, `.maxPrenatalShare` | `13`, `0.5` |
| LV-042 | Upon written notice of pregnancy and risk to health in the current role, HR is prompted to look for a suitable temporary alternative position. | — | Notify |
| LV-043 | Maternity leave does not accrue as a balance and cannot be carried over. | — | — |
| LV-044 | Nursing hour duration and period. | `leave.types.NURSING.minutesPerDay`, `.months` | `60`, `24` |
| LV-050 | Paternity days and usage window. | `leave.types.PATERNITY.days`, `.useWithinWeeks` | `5`, `4` |
| LV-060 | LWOP minimum service. | `leave.types.UNPAID.minServiceMonths` | `6` |
| LV-061 | LWOP annual maximum. | `leave.types.UNPAID.maxDaysPerYear` | `20` |
| LV-062 | LWOP advance notice. | `leave.types.UNPAID.noticeBusinessDays` | `5` |
| LV-063 | LWOP approval chain: line manager recommends, site manager/department head authorizes, Head of Office approves in consultation with HR. | `leave.types.UNPAID.approvalChain` | see JSON |
| LV-064 | During LWOP no other leave accrues; health-insurance contribution continues (configurable). | `leave.types.UNPAID.suspendAccruals`, `.continueHealthInsurance` | `true`, `true` |
| LV-080 | Compensatory leave requires prior written authorization of the weekend/holiday work. | `leave.types.COMP.requiresPriorApproval` | `true` |
| LV-081 | Compensatory leave must be taken within the window, otherwise it expires. | `leave.types.COMP.expiresAfterDays` | `10` |
| LV-082 | No employee should work more than the maximum consecutive days without a full rest day. | `attendance.maxConsecutiveWorkDays` | `10` (Warn) |
| LV-083 | For managers and program staff, compensatory leave is granted only for extraordinary required overtime. | `leave.types.COMP.managersExtraordinaryOnly` | `true` |

---

## 10. Compensation and payroll inputs

> **Scope:** the system prepares and validates **payroll inputs** and exports them to the customer's payroll/finance system. Statutory tax calculation is **out of scope** in the baseline (pluggable later).

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| CP-001 | Salary is defined by the contract: base salary from the salary scale (grade/step) per site, plus configurable allowances. | `compensation.payComponents` | `BASE` + optional | — |
| CP-002 | Daily rate is base salary divided by the configured working days per month. | `compensation.workingDaysPerMonth` | `22` | — |
| CP-003 | Pay date: on or before day N of the following month; if the cut-off falls on a weekend, process before it. | `payroll.payByDayOfNextMonth` | `5` | Notify |
| CP-004 | Payment methods: bank transfer, cheque or cash; currency per contract and availability. | `payroll.paymentMethods` | `["BANK","CHEQUE"]` | — |
| CP-005 | Each employee receives a payslip per pay period (self-service). | — | — | — |
| CP-006 | Payslip queries must be raised within N working days. | `payroll.payslipQueryWindowBusinessDays` | `5` | Track |
| CP-007 | Improper-deduction claims must be raised within N days of payment; HR and Finance review and correct. | `payroll.deductionClaimWindowDays` | `7` | Track |
| CP-008 | Employees must update bank details immediately; changes require HR verification before the next payroll (four-eyes). | — | — | Block |
| CP-010 | **Annual merit increase** linked to appraisal: range and dependency on funds. | `compensation.meritIncrease.minPercent`, `.maxPercent` | `1`, `5` | Block (> max) |
| CP-011 | Merit eligibility: completed a 12-month contract **and** renewed in the same position for 6–12 months **and** rated satisfactory or better **and** recommended by the line manager. | `compensation.meritIncrease.eligibility` | see JSON | Block |
| CP-012 | Salary increases are possible only as annual step increases or grade changes; all approved by Head of Office through a COS. | — | — | Block |
| CP-013 | **Performance bonus**: recommended by line manager, approved by Head of Office, as % of salary, annual cap. | `compensation.performanceBonus.maxPercentPerYear` | `5` | Block |
| CP-020 | **Salary advances** are exceptional, require justification and Head of Office approval; uncleared personal advances are deducted from the next salary. | `compensation.advances.*` | see JSON | Block |
| CP-021 | **Operational advances** not cleared by month-end can put the salary on hold. | `compensation.advances.holdSalaryIfOperationalUncleared` | `true` | Warn |
| CP-022 | Any financial obligation of the employee to the organization requires a signed acknowledgement when incurred. | — | — | Block |
| CP-023 | Outstanding advances/obligations are deducted from final pay. | — | — | Auto |
| CP-030 | **Permitted deduction types** (configurable list): unpaid absence, collective unauthorized absence (cap days), loss/damage due to proven negligence, accommodation, advance recovery/overpayment, income tax, court/authority orders, approved schemes, personal use of equipment. | `compensation.deductionTypes` | see JSON | — |
| CP-031 | Garnishment/attachment orders are received only by Finance/HR; the employee is notified before deduction; an employee is never dismissed because of garnishment. | — | — | Security |
| CP-040 | **Suspension during investigation**: with pay by default; without pay only in configured serious cases. | `discipline.suspension.defaultPayPercent` | `100` | — |
| CP-041 | **Administrative leave**: at Head of Office discretion, with written notice of reason and duration; pay % and max duration configurable; benefits continue. If cleared, the employee is treated as on duty and back-paid. | `discipline.administrativeLeave.payPercent`, `.maxMonths` | `50`, `1` | Block (> max) |
| CP-042 | **Operational suspension for security reasons**: month 1 full pay; month 2 remaining annual leave is used, then unpaid; max duration; staff informed in advance. | `security.operationalSuspension.*` | see JSON | — |

---

## 11. Benefits

| ID | Rule | Parameter | Default |
|---|---|---|---|
| BN-001 | **13th-month payment**: after N months of continuous employment, subject to funds; amount = average monthly salary of the preceding year; paid at the end of the employment year. | `benefits.thirteenthMonth.*` | enabled, `12`, `AVERAGE_PRECEDING_YEAR` |
| BN-002 | **Health insurance**: optional group plan; enrolment and dependants recorded; subject to funds. | `benefits.healthInsurance.enabled` | `true` |
| BN-003 | **Accident insurance** for work-related accidents during working hours; claims linked to incident reports (AS-020). | `benefits.accidentInsurance.enabled` | `true` |
| BN-004 | Benefit eligibility follows the employment category (CAT-002). | — | — |

---

## 12. Performance management

### 12.1 Appraisal workflow

```
HR opens appraisal ─► Employee self-assessment ─► 1st-line assessment
   ─► 2nd-line countersign & comments ─► HR review
   ─► Appraisal meeting ─► Employee comments ─► Signatures (employee + supervisors)
   ─► Optional review request ─► Closed → feeds pay, training, promotion, contract decisions
```

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| PF-001 | Annual appraisal on the **employment anniversary** (or within a grace period). | `performance.cycle`, `.graceDays` | `ANNIVERSARY`, `30` | Notify |
| PF-002 | Appraisals can be **paused** during a declared emergency-response phase at country level. | `performance.pauseDuringEmergency` | `true` | — |
| PF-003 | Interim reviews may be opened as often as quarterly when needed; a probation appraisal is mandatory before confirmation (LC-006). | `performance.interimMinIntervalMonths` | `3` | — |
| PF-004 | Assessment factors (configurable competency library): job knowledge, quantity and quality of work, timeliness, cooperation, initiative, reliability, attendance, judgment, conduct, responsibility, plus achievement of objectives. | `performance.competencies` | list | — |
| PF-005 | Rating scale (configurable). | `performance.ratingScale` | 5-point | — |
| PF-006 | The employee can add written comments and request a review by the department head or HR. | — | — | — |
| PF-007 | Disagreements not resolved at supervisor level escalate in writing to the next level, copied to Head of Office; after N business days unresolved, Head of Office decides (final). | `performance.disputeEscalationBusinessDays` | `7` | Notify |
| PF-008 | Verbal appraisals are allowed when approved by HR (recorded with a short form). | `performance.allowVerbal` | `true` | Track |
| PF-009 | Outcomes: confirmation, merit increase, bonus, promotion recommendation, no change, improvement plan, demotion or termination (the last two require Head of Office approval). | — | — | Block |
| PF-010 | **Objectives** are SMART, set at hire and at each cycle, signed by employee and line manager, and reviewed quarterly. | `performance.objectives.reviewEveryMonths` | `3` | Notify |
| PF-011 | After each appraisal, the job description is reviewed and re-signed if updated. | — | — | Notify |
| PF-012 | **Performance improvement plan (PIP)**: when performance is below requirements, the line manager issues a PIP and reports progress to HR; with no progress after N weeks, the disciplinary process starts. | `performance.pip.durationWeeks` | `4` | Notify |

---

## 13. Learning and development

| ID | Rule | Parameter | Default |
|---|---|---|---|
| LD-001 | Training needs are identified through a **Training Needs Assessment (TNA)** completed by the employee with the line manager; HR consolidates and plans. | `learning.tnaCycle` | `ANNUAL` |
| LD-002 | Individual Development Plan (IDP) per employee, linked to the appraisal. | — | — |
| LD-003 | Training catalog: internal, e-learning (link to the customer's learning platform), external, refresher, on-the-job (committees, exposure visits, job rotation, special projects, job expansion). | `learning.types` | list |
| LD-004 | Attendance, completion, certificates and expiry dates are recorded; mandatory trainings show compliance status per employee. | — | — |
| LD-010 | Time spent on e-learning during working hours requires line-manager agreement. | — | — |
| LD-020 | External training leave: max days per year, only if not funded by the organization, related to current job, on working days, approved by the line manager. | `leave.types.EXT_TRAINING.maxDaysPerYear` | `5` |
| LD-030 | Professional associations and civic memberships: sponsorship requests, approvals, reimbursable fees, repayment of refundable fees on exit, and the need for prior approval to hold an official position or speak on behalf of the organization. | `memberships.*` | see JSON |

---

## 14. Conduct, compliance and declarations

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| CC-001 | **Policy Library**: the customer uploads its own policies (code of conduct, safeguarding/PSEA, anti-harassment, anti-fraud, anti-bribery, anti-trafficking, whistleblowing, conflict of interest, data protection, IT acceptable use, social media, alcohol and drugs, smoking, dress code, media relations, branding, security). Each has version, owner, effective date, audience and acknowledgement requirement. | `policyLibrary.defaultPolicies` | list (titles only) | — |
| CC-002 | **Independent reporting channel**: the system shows the customer's external hotline/URL on every page footer and in self-service. **The system does not collect misconduct reports**, to protect confidentiality and anonymity. | `organization.branding.reportingChannelUrl` | placeholder | — |
| CC-003 | **Conflict-of-interest declarations**: annual and ad-hoc; covers financial interests, outside employment/consulting, family relationships with suppliers/partners/competitors. Reviewed by HR; outcome recorded. | `compliance.coi.annualDeclaration` | `true` | Notify |
| CC-004 | **Gifts and hospitality register**: offered/received, value, counterpart, decision; cash gifts are always flagged as prohibited. | `compliance.gifts.nominalValueThreshold` | `50` (currency of office) | Warn |
| CC-005 | **Prohibited-party screening** for staff (RC-015). Re-screening frequency configurable. | `compliance.screening.rescreenEveryMonths` | `12` | Notify |
| CC-006 | **Self-reporting of criminal drug conviction** within N days; compliance is notified to inform donors within their deadline where required. | `compliance.drugConvictionSelfReportDays`, `.donorNotificationDays` | `5`, `10` | Notify |
| CC-007 | **Donor personal-information requests**: employees administering certain donor funds may be asked to provide identification data; tracked as a compliance task. | — | Track |
| CC-008 | **Political neutrality**: employees declare engagement in political activity where required (configurable declaration). | `compliance.politicalActivityDeclaration` | `false` | — |
| CC-009 | **Mandatory compliance trainings** (e.g. safeguarding, anti-trafficking, anti-fraud) with completion tracking (LD-004). | `compliance.mandatoryTrainings` | list | Notify |

---

## 15. Discipline and grievance

### 15.1 Discipline

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| DG-001 | A **conduct case** can be opened by the line manager or HR from: attendance threshold (WT-013), PIP failure (PF-012), policy breach, asset negligence, or other. | — | — | — |
| DG-002 | The employee is given the opportunity to **respond/defend** before any sanction; the response is recorded. | `discipline.requireEmployeeResponse` | `true` | Block |
| DG-003 | Verbal and written warnings are issued by the supervisor after approval by HR Manager and Head of Office. | `discipline.warningApprovers` | `["HR_MANAGER","HEAD_OF_OFFICE"]` | Block |
| DG-004 | **Progressive ladder** (configurable): coaching/counseling → verbal warning → written warning 1 → written warning 2 → written warning 3 → suspension → dismissal. | `discipline.ladder` | see JSON | — |
| DG-005 | After N written warnings, a further offence within the window allows suspension up to the maximum days. | `discipline.suspensionAfterWarnings`, `.windowMonths`, `.maxSuspensionDays` | `3`, `12`, `5` | Block (> max) |
| DG-006 | Warnings **expire** after N months and stop counting toward the ladder (kept in history). | `discipline.warningValidityMonths` | `12` | Auto |
| DG-007 | **Gross misconduct**: configurable offence catalog (e.g. theft, falsification of time records, being under the influence on duty, fighting, gross insubordination, serious negligence, concealment of contagious disease, conduct seriously harming the organization). Allows suspension pending investigation and summary dismissal. | `discipline.grossMisconductCatalog` | list | — |
| DG-008 | Suspension pending criminal/disciplinary proceedings: pay % configurable; if not followed by dismissal, the balance is paid. | `discipline.suspensionPendingProceedings.payPercent` | `50` | Auto |
| DG-009 | **Disciplinary dismissal** is justified in writing by the line manager, endorsed by the program/field coordinator and approved by Head of Office; no notice or pay in lieu; only salary due and unused annual leave are paid. | — | — | Block |
| DG-010 | Labor-authority notification step where required by the Country Policy Set. | `countryPolicy.laborAuthorityNotification.*` | `true` for dismissal | Notify |
| DG-011 | Case files are restricted to HR Manager, Head of Office and HQ HR; the employee sees only issued letters. | — | — | Security |
| DG-012 | Investigation evidence and drug/alcohol test results are stored with field-level security. | — | — | Security |

### 15.2 Grievance

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| DG-020 | Employees raise grievances in writing through self-service; resolution is attempted at the lowest level first. | — | — | — |
| DG-021 | Unresolved grievances escalate to the next management level, copied to Head of Office. | — | — | Notify |
| DG-022 | If unresolved within N business days, the grievance goes to Head of Office, whose decision is final. | `grievance.escalationBusinessDays` | `7` | Auto-escalate |
| DG-023 | If Head of Office is the subject, the case is routed directly to HQ HR. | `grievance.routeToHqIfHeadIsSubject` | `true` | Auto |
| DG-024 | Grievances about harassment, abuse, fraud or safeguarding are redirected to the independent reporting channel (CC-002). | — | — | Warn |
| DG-025 | Non-retaliation: grievance and case parties are flagged; adverse actions against a flagged employee within N months require HR Manager review. | `grievance.nonRetaliationWatchMonths` | `12` | Warn |

---

## 16. Travel and expenses

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| TR-001 | Official travel requires a **travel request** before departure, approved by the line manager (or site/program manager) **and** the security focal point. Unauthorized travel is not reimbursed. | `travel.approvalChain` | `["LINE_MANAGER","SECURITY_FOCAL"]` | Block |
| TR-002 | Trip report may be required after travel (configurable by trip type / emergency phase). | `travel.tripReportRequired` | `true` | Notify |
| TR-003 | **Per diem** by location group, per night; also payable for stays above N hours without overnight. Rates are reviewed periodically. | `travel.perDiem.rates`, `.minHoursWithoutOvernight` | sample groups, `8` | Auto |
| TR-004 | Accommodation: organization guest houses first; otherwise arranged accommodation within limits; above-limit booking needs management approval with justification (e.g. security). | `travel.accommodation.*` | see JSON | Warn |
| TR-005 | Non-reimbursable items (configurable): tips, porters. | `travel.nonReimbursable` | `["TIPS","PORTERS"]` | Block |
| TR-006 | Meeting expenses with meals require prior approval by Finance Director or Head of Office and an allocated budget. | `travel.meetingExpenseApprovers` | see JSON | Block |
| TR-007 | Miscellaneous travel costs (taxi, rental, communication, visa) reimbursed against receipts. | — | — | Block without receipt |
| TR-008 | Public transport reimbursed only if no vehicle available, cheapest safe option used, receipts provided, supervisor approval. | — | — | Block |
| TR-009 | Vehicle requests go to Logistics in advance; personal diversion is not allowed; family transport only in emergencies with a signed liability waiver. | — | — | Track |
| TR-010 | Business communication: monthly airtime allowance by justification; internet/phone outside premises reimbursed against receipts with prior approval. | `travel.communication.*` | see JSON | — |
| TR-011 | Missed pre-booked international travel for personal reasons may be recovered from the employee. | `travel.recoverMissedTickets` | `true` | Track |

---

## 17. Assets, ID cards, keys and incidents

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| AS-001 | Assets assigned to employees are recorded with an **asset assignment form** (handover), signed and kept in the asset/personnel file. | — | — | Block |
| AS-002 | Asset inventory review at least N times per year. | `assets.inventoryReviewsPerYear` | `2` | Notify |
| AS-003 | Removing assets from premises requires supervisor authorization. | — | — | Track |
| AS-004 | **ID card**, office/residence **keys**, uniforms/PPE are tracked as assigned items. Unauthorized key copies are prohibited; extra keys requested from Facilities. | — | — | Track |
| AS-005 | All assigned items must be returned before final pay (SP-030). | — | — | Block |
| AS-006 | Personal use of equipment (phone, printer, copier) can be charged to the employee (CP-030). | — | — | — |
| AS-020 | **Incident report** (loss, theft, damage, vehicle accident, security incident): filed immediately to supervisor, Head of Office and Security focal; includes particulars, photos, police report where needed, recommendations. | `assets.incidentNotifyRoles` | see JSON | Notify |
| AS-021 | If **gross negligence** is proven, restitution can be required through a deduction (CP-030) with an acknowledgement. | — | — | — |
| AS-022 | Vehicle rules acknowledgement for drivers (seat belts, no texting, helmets, waivers for non-staff passengers). | `policyLibrary.driverRulesAcknowledgement` | `true` | Block for driver role |
| AS-030 | **Visitors** log (optional module): visitor card issued and returned. | `operations.visitorLog.enabled` | `false` | — |

---

## 18. Separation and termination

### 18.1 Separation types

| Key | Type | Notice | Default final pay elements | IDs |
|---|---|---|---|---|
| `RESIGNATION` | Resignation | 0 during probation; 1 month after confirmation | Salary due, unused annual leave, severance per policy | SP-001 – SP-004 |
| `PROBATION_END` | Termination during probation | 0 | Salary due | LC-004 |
| `REDUNDANCY` | End of funding / position eliminated / layoff | 1 month or pay in lieu | Salary due, notice pay, unused leave, severance | SP-010 – SP-014 |
| `CONTRACT_END` | Contract expiry | per contract | Salary due, unused leave, severance per completed years | SP-004 |
| `DISCIPLINARY` | Dismissal (gross misconduct) | 0 | Salary due, unused annual leave only | DG-009 |
| `PERFORMANCE` | Dismissal for low performance | per policy | Salary due, unused leave | PF-012 |
| `MEDICAL` | Medically unfit | per policy | All sick & annual leave must be exhausted first | SP-016 |
| `DEATH` | Death | — | All dues paid to legally designated heirs | SP-017 |
| `COURT` | Court conviction | — | Per labor-authority decision | SP-018 |
| `ABANDONMENT` | Deemed resignation (absence) | — | Salary due, unused leave | WT-015 |

### 18.2 Rules

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| SP-001 | Resignation notice after confirmation. | `separation.resignationNoticeDays` | `30` | Warn |
| SP-002 | The resignation is submitted in self-service; HR confirms the last working day. | — | — | — |
| SP-003 | A **handover plan** is prepared with the line manager. | — | — | Block (for clearance) |
| SP-004 | Severance/end-of-service benefit: N month(s) of latest basic salary per completed year of service, per Country Policy Set. | `countryPolicy.severance.monthsPerYear`, `.basis` | `1`, `LAST_BASIC` | Auto calc |
| SP-005 | Once severance is paid and documented for an ended contract, no further obligation remains for that period (supports pay-out at project end and re-hire). | `countryPolicy.severance.settleAtProjectEnd` | `true` | — |
| SP-010 | Redundancy: employees are notified in advance; one month notice or one month salary in lieu, plus salary due and unused annual leave (and remaining-contract pay where the Country Policy Set requires). | `separation.redundancy.*` | see JSON | — |
| SP-011 | Before redundancy, alternative positions are explored (HR task). | — | Notify |
| SP-012 | When several staff in the same position are affected, selection criteria are applied and recorded: disciplinary record, performance, length of service, site assignment. | `separation.redundancy.selectionCriteria` | list | Track |
| SP-013 | Labor-authority approval step for redundancy where configured. | `countryPolicy.laborAuthorityNotification.redundancy` | `true` | Block |
| SP-014 | Program suspension due to insecurity: transfer to another project if available, otherwise case-by-case (CP-042). | — | — | — |
| SP-016 | Medical discharge requires a certified medical report; for work-related illness/injury, HR must record efforts to find a suitable alternative position first. | — | — | Block |
| SP-017 | Death ends the contract on the date of death; dues are paid to the person designated by the competent court. | — | — | — |
| SP-018 | Court conviction with sentence ends employment, subject to labor-authority approval where configured. | — | — | — |
| SP-020 | **Exit interview** with the employee (self-service survey). | `separation.exitInterview.enabled` | `true` | Notify |
| SP-021 | **Exit evaluation** by the supervisor within N days of departure, including **rehire eligibility** (Yes / No / Conditional). | `separation.exitEvaluationDays` | `5` | Notify |
| SP-030 | **Clearance checklist**: return of assets, ID card, keys, documents, confidential information; clearance of advances; sign-off by Logistics, HR and Finance (configurable departments). Final pay is **blocked** until all mandatory items are cleared. | `separation.clearanceDepartments` | `["LOGISTICS","HR","FINANCE"]` | Block |
| SP-031 | Exit report (handover/deliverables) when applicable. | — | — | — |
| SP-032 | Access deactivation tasks (e-mail, systems) are triggered on the last working day. | — | — | Notify |
| SP-033 | Final settlement statement is generated (salary due, leave pay-out, notice pay, severance, deductions) for Finance. | — | — | — |

---

## 19. Records, data protection and retention

| ID | Rule | Parameter | Default | Enforcement |
|---|---|---|---|---|
| RD-001 | **Personnel file checklist** per employee with document status (required, received, expired). | `onboarding.personnelFileChecklist` | list | Warn |
| RD-002 | Employees update personal data (name, address, phones, emergency contacts, marital status, dependants, beneficiaries) **within N days** of a change. Sensitive changes require HR verification. | `records.personalDataUpdateDays` | `30` | Notify |
| RD-003 | **Need-to-know access**: salary, medical, disciplinary, screening and investigation data are protected with field-level security and audited reads where supported. | — | — | Security |
| RD-004 | **Retention schedule** per record type with trigger event (e.g. termination + N years) and disposal action; the longer period wins in conflicts; legal hold suspends disposal. | `records.retentionSchedule` | see JSON | Auto (with review) |
| RD-005 | Employment verification and references for current/former staff are issued **only by HR** through the system (template + log). | — | — | Block |
| RD-006 | Full audit trail on create/update/delete of HR records and approvals. | — | — | Audit |
| RD-007 | Documents are stored in a document library linked to each record (Dataverse + SharePoint), not as e-mail attachments. | — | — | — |
| RD-008 | Policy amendments between review periods are published to staff and kept in the Policy Library with history. | — | — | Notify |

---

## 20. Scheduled jobs and notifications catalog

| Job / trigger | Frequency | Audience | Related rules |
|---|---|---|---|
| Leave accrual run | Monthly (1st day) | System | LV-011, LV-023 |
| Year-end leave carry-over / expiry | Annually | HR | LV-014 |
| Compensatory leave expiry | Daily | Employee, Line manager | LV-081 |
| Probation ending | Daily (N days before) | Line manager, HR | LC-006 |
| Contract expiry | Daily | HR, Line manager | LC-040 |
| Acting appointment review / max duration | Daily | HR, Head of Office | LC-031, LC-033 |
| Appraisal due (anniversary) | Daily | Employee, Line manager, HR | PF-001 |
| Quarterly objectives review | Quarterly | Employee, Line manager | PF-010 |
| PIP end date | Daily | Line manager, HR | PF-012 |
| Warning expiry | Daily | HR (silent) | DG-006 |
| Grievance escalation | Hourly / daily | Next level, Head of Office | DG-022 |
| Approval escalation | Daily | Approver's manager, HR | ROL-004 |
| Late marks threshold | Daily | Line manager, HR | WT-013 |
| Consecutive absence | Daily | HR | WT-015 |
| Timesheet submission reminder | Last 3 working days | Employee | TS-003 |
| Timesheet approval reminder | After deadline | Line manager | TS-004 |
| Payroll inputs cut-off | Monthly | HR, Finance | TS-006 |
| Orientation within first week | On hire + daily | HR | ON-005 |
| Missing acknowledgements | Weekly | Employee, HR | ON-003, ON-004 |
| Screening re-check due | Monthly | Compliance | CC-005 |
| Annual COI declaration | Annually | All employees | CC-003 |
| Personnel documents expiring | Weekly | HR | RD-001 |
| Exit evaluation due | Daily | Line manager | SP-021 |
| Asset inventory review | Semi-annually | Logistics | AS-002 |
| Retention disposal review | Quarterly | HR | RD-004 |

---

## 21. Forms catalog

| Form | Module | Generated document | Signatures |
|---|---|---|---|
| Staff requisition | Recruitment | — | Requester, Dept head, Finance, Head of Office |
| Vacancy announcement | Recruitment | Yes (ar/en) | HR |
| Interview evaluation (per panel member) | Recruitment | Yes | Each panel member |
| Reference check | Recruitment | — | HR |
| Offer letter | Recruitment | Yes | HR / Head of Office |
| Employment contract | Onboarding | Yes | Head of Office, Employee |
| Job description | Onboarding / Performance | Yes | Employee, Line manager |
| Policy acknowledgements | Onboarding | Yes | Employee |
| Personal data & dependants | Onboarding | — | Employee |
| Probation appraisal & confirmation/extension letter | Lifecycle | Yes | Line manager, HR |
| Change of status | Lifecycle | Yes | Per COS type |
| Request for leave | Leave | — | Employee, approvers |
| Overtime request | Attendance | — | Line manager, HR |
| Monthly timesheet with grant allocation | Timesheets | Yes (PDF for audit) | Employee, Line manager |
| Salary advance request & acknowledgement | Compensation | Yes | Employee, Head of Office |
| Performance appraisal | Performance | Yes | Employee, 1st & 2nd line |
| Objective setting | Performance | Yes | Employee, Line manager |
| Performance improvement plan | Performance | Yes | Employee, Line manager, HR |
| Training needs assessment / IDP | Learning | — | Employee, Line manager |
| Conflict-of-interest declaration | Compliance | Yes | Employee, HR |
| Gift & hospitality declaration | Compliance | — | Employee |
| Warning / suspension letter | Discipline | Yes | Supervisor, HR, Head of Office |
| Grievance | Grievance | — | Employee |
| Travel request | Travel | — | Employee, Line manager, Security |
| Per diem / expense claim | Travel | — | Employee, Line manager, Finance |
| Asset assignment / return | Assets | Yes | Employee, Logistics |
| Incident report | Assets | Yes | Reporter, Supervisor |
| Resignation | Separation | — | Employee |
| Handover plan | Separation | Yes | Employee, Line manager |
| Clearance checklist | Separation | Yes | Logistics, HR, Finance |
| Exit interview / exit evaluation | Separation | — | Employee / Supervisor |
| Final settlement statement | Separation | Yes | HR, Finance |
| Employment certificate / reference letter | Records | Yes | HR |

---

## 22. Source gaps and default decisions

The source manual contained gaps and contradictions. The baseline resolves them as follows; each remains configurable.

| # | Gap in source | Default decision | Parameter |
|---|---|---|---|
| G-01 | Annual leave stated both as "after 12 months" and "pro-rata after 3 months". | Monthly accrual of 21/12; usable after 3 months; pro-rata on exit after 3 months. | `leave.types.ANNUAL.*` |
| G-02 | Annual leave carry-over not defined. | No carry-over (`0`), flagged for customer decision. | `leave.types.ANNUAL.carryOverMaxDays` |
| G-03 | Sick leave defined for one service band only (1–5 years). | Single band from 0 years applies to all; additional bands can be added. | `leave.types.SICK.serviceBands` |
| G-04 | Sick leave "approved only when accrued" vs. "per calendar year". | Monthly accrual; switchable to annual grant. | `leave.types.SICK.accrual` |
| G-05 | "Casual leave" referenced but not defined. | No separate casual leave type; references map to **annual leave**. | `security.operationalSuspension.useLeaveType` |
| G-06 | Internship "may be extended but should not exceed three months". | Default 3 months; extensions allowed up to 6 months total. | `employmentCategories.intern.*` |
| G-07 | 5-day absence: "refer to Head of Office for decision" vs. "considered resignation". | Open an absence case; deemed resignation is a decision option, never automatic. | `attendance.*` |
| G-08 | Overtime "for all employees" vs. guards/drivers on special schedules without overtime. | Eligibility by category and position flag. | `employmentCategories.<key>.eligibility.overtime` |
| G-09 | Disciplinary text refers to a union and to articles of an external agreement. | Removed; replaced by a generic investigation + employee-response step and optional labor-authority step. | `discipline.*` |
| G-10 | Administrative leave marked "confirm if applicable by law"; grievance section incomplete. | Implemented as configurable, disabled per country if not lawful. | `discipline.administrativeLeave.enabled` |
| G-11 | Redundancy: "one month notice" vs. "salary for the remaining contract period". | Notice/pay in lieu by default; remaining-contract pay is an optional Country Policy Set switch. | `separation.redundancy.payRemainingContract` |
| G-12 | Code of conduct described as applying to internationally recruited staff only. | Policy audiences are configurable per policy; default **all staff**. | `policyLibrary.defaultPolicies[].audience` |
| G-13 | Section numbering and cross-references inconsistent. | Not applicable to the system; Rule IDs replace section numbers. | — |

---

## 23. Out of scope (baseline)

- Statutory payroll calculation (income tax, social security). The system exports validated payroll inputs instead.
- Collection or investigation of whistleblowing, safeguarding, fraud or trafficking reports (handled by the customer's independent channel).
- Procurement, vendor screening and finance ledgers (the screening module covers **staff** only).
- Branding/visibility, media relations and export-control processes (covered only as policies in the Policy Library).
- Biometric device drivers (the system imports device files; vendor connectors are optional add-ons).

---

*End of document.*
