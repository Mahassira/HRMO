# HRMO — Security and confidentiality policy

HRMO holds salaries, identity documents, medical leave and disciplinary files. This document says how that data is protected, who is responsible for what, and what has to be true before real data is loaded.

No system is immune. The aim is that an attack is hard and visible, that damage can be undone, and that each person sees only what their work requires.

**State of this document:** the controls marked *In the template* are written in the repository (`infra/main.bicep`, `db/schema.sql`) and have not yet been run in an Azure subscription. Controls marked *Organisation* are settings and procedures the organisation applies in its own Microsoft environment. Controls marked *Planned* are not built yet.

## 1. Principles

1. **The organisation owns its data.** HRMO runs in the organisation's own Azure subscription. No copy is kept elsewhere.
2. **Least privilege.** Access follows the role and the reporting line, nothing more.
3. **No secrets to steal.** No passwords or keys in code or settings; services identify themselves with managed identities.
4. **Everything leaves a trace.** Changes keep their history, and reads of sensitive data are logged.
5. **Recoverable.** Deletion and corruption can be undone within the retention period.
6. **Separate what must be separate.** The people who run the platform do not read the data. Reports of harassment, fraud and safeguarding stay outside HRMO, in the organisation's independent channel.

## 2. Controls

### 2.1 Access

| Control | How | State |
|---|---|---|
| Sign-in with the work account only | Microsoft Entra ID, single tenant | In the template |
| Multi-factor authentication for every user (SE-001) | Entra security defaults or conditional access | Organisation |
| Session ends when idle (SE-002) | Token lifetime and API check | Planned |
| Each person sees their own record; managers see their team | Row-level security inside the database | In the template |
| Salary and private data hidden from line managers | Separate tables, denied to the manager role | In the template |
| National ID and bank account masked for ad-hoc readers | Dynamic data masking | In the template |
| Rules cannot be bypassed from the browser | All rules evaluated in the API | Planned with the API |

### 2.2 Protection against attack

| Control | How | State |
|---|---|---|
| No passwords or keys | SQL accepts Entra sign-in only; storage keys disabled; managed identity | In the template |
| Encryption in transit | TLS 1.2 minimum everywhere | In the template |
| Encryption at rest | Transparent data encryption, storage encryption | In the template |
| Database not reachable from the internet | Private endpoints and virtual-network integration | Planned, extra cost |
| Web application firewall and rate limiting | Azure Front Door or equivalent | Planned, extra cost |
| Threat detection on the database | Microsoft Defender for SQL | Planned, extra cost |
| Independent penetration test (SE-012) | Before go-live, then yearly | Organisation |

### 2.3 Protection against deletion and damage

| Control | How | State |
|---|---|---|
| Resources cannot be deleted by mistake (SE-009) | Delete locks on the database server, storage account and key vault | In the template |
| Every change keeps the previous version | System-versioned (temporal) tables | In the template |
| Restore the database to any moment | Point-in-time restore, 7 days by default, up to 35 | In the template |
| Recover deleted or overwritten documents | Blob versioning, 14-day soft delete for blobs and containers | In the template |
| Secrets cannot be purged | Key Vault soft delete and purge protection | In the template |
| Audit trail cannot be edited | The API can insert and read, never update or delete | In the template |
| Survive the loss of a region | Geo-redundant backups | Planned, extra cost |
| Backups that actually restore (SE-010) | Full restore test every 6 months | Organisation |

### 2.4 Confidentiality and traceability

| Control | How | State |
|---|---|---|
| Log who read sensitive data (SE-005) | `audit.SensitiveAccess`: reader, subject, category, time, channel | In the template |
| Exports need a purpose; large exports need approval (SE-006) | Checked by the API, logged | Planned with the API |
| Reporting cannot reach raw tables | Power BI reads the `rpt` schema only; pay behind a second role | In the template |
| Database activity audited | SQL auditing to Log Analytics | In the template |
| Retention of former staff records (SE-011) | Kept 7 years by default, then anonymised | Planned |

## 3. Roles and separation of duties

| Role | Can | Cannot |
|---|---|---|
| Employee | See and update their own record and requests | See anyone else |
| Line manager | See the team's work data and decide their requests | See salary, private data or case files |
| HR | Manage records, cases and policy settings | Approve their own changes; administer Azure |
| Country Director | Approve; see management figures | Edit records directly |
| Platform administrator (IT) | Deploy, monitor, restore | Hold any role inside HRMO; read HR data in normal operation |
| Database administrators group | Emergency access to the database | Use it without a logged reason and a second person informed |

Administrator access is granted for a limited time when needed (just in time) and every use is logged (SE-004). No shared accounts (SE-003).

## 4. Joiners, movers and leavers

| Event | Action | When |
|---|---|---|
| New employee | Account and role created from the approved hire | Before the first day |
| Change of role or manager | Access follows the new reporting line automatically | Same day |
| Separation | Account disabled as a step of the clearance checklist (SE-007) | Last working day |
| HR or director role granted | Recorded with who granted it and when | At the time |
| Review of all roles and of the access log (SE-008) | HR lead and IT together | Every 3 months |

## 5. What technology does not solve

Most leaks of staff data come from inside, not from an outside attacker.

- An authorised person can photograph a screen or forward an export. Controls: confidentiality undertakings, least privilege, purpose on every export, review of the access log.
- A convincing phishing message can still get a user to approve a sign-in. Controls: training, phishing-resistant sign-in methods for HR and directors.
- A laptop left unlocked. Controls: device encryption and screen lock, managed by the organisation's IT.

## 6. Incident response

1. **Contain.** Disable the affected account or revoke the identity. Do not delete anything.
2. **Preserve.** Export the relevant audit, access and sign-in logs.
3. **Assess.** Whose data, which categories, from when to when. The access log answers this.
4. **Notify.** Management, the data-protection contact, affected staff and regulators as the applicable law requires.
5. **Recover.** Restore from history or backup if data was changed or removed.
6. **Learn.** Record the cause and the change made to prevent it.

The organisation names the person responsible for each step before go-live.

## 7. Before real data is loaded

- [ ] Multi-factor authentication enforced for every user
- [ ] Platform administrators hold no HRMO role; database administrators group has at most three named members
- [ ] Delete locks present on the database server, storage account and key vault
- [ ] A restore of the database and of a deleted document has been done successfully
- [ ] Sensitive-access logging verified: open a salary, find the row in the log
- [ ] Independent penetration test done and findings closed
- [ ] Data-protection review against local law done; retention period confirmed
- [ ] Incident contacts named
- [ ] Every user has signed the confidentiality undertaking

## 8. Recurring tasks

| Task | Frequency | Owner |
|---|---|---|
| Review roles and the sensitive-access log | Every 3 months | HR lead + IT |
| Restore test | Every 6 months | IT |
| Penetration test | Every 12 months and after major changes | Independent party |
| Review of this policy | Every 12 months | Management |

## 9. Not covered

HRMO does not secure the devices staff use, the organisation's e-mail, or the finance and payroll systems it exchanges data with. Those remain under the organisation's own IT policy.

Rules SE-001 to SE-012 and their settings are listed in the [system reference](system-reference.md).
