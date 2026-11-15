# Company profile: shipping and logistics edition

This edition of HRMO is configured for a fictitious shipping and logistics company. All names, salaries and figures in the demo are invented.

## Locations

| Id | Location | Country | Reports to | Policy set | Currency | Staff |
|---|---|---|---|---|---|---|
| CAI | Cairo, head office | Egypt | n/a | Egypt | EGP | 50 |
| DAM | Damietta branch | Egypt | Cairo | Egypt | EGP | 29 |
| SOK | Ain Sokhna branch | Egypt | Cairo | Egypt | EGP | 32 |
| SAF | Safaga branch | Egypt | Cairo | Egypt | EGP | 17 |
| DXB | Dubai branch | UAE | Cairo | UAE | AED | 22 |

Every branch manager reports to the General Manager in Cairo. Department heads at the head office also report to the General Manager. Branch supervisors report to their branch manager. The organization chart is drawn from each employee's line manager, so a transfer or a new hire changes it immediately.

## Departments

Freight operations, customs clearance, port operations, inland transport, warehousing, sales and customer service, finance, human resources, HSE and security, administration and IT.

## Cost centres

| Id | Cost centre | Type |
|---|---|---|
| CC-101 | Sea and air freight | Business line |
| CC-102 | Container terminal handling contract | Client contract, ends within months |
| CC-103 | Customs clearance | Business line |
| CC-104 | Inland transport and warehousing | Client contract |
| CC-105 | Corporate overhead | Overhead |

An employee's time and salary cost are split across cost centres by percentage. The executive dashboard warns when a client contract is about to end and lists the staff assigned to it.

## Two policy sets

| Rule | Egypt | UAE |
|---|---|---|
| Working week | Sunday to Thursday | Monday to Friday |
| Probation | 3 months | 6 months |
| Annual leave | 21 days | 30 days |
| Sick leave | 30 full pay, 60 half pay | 15 full pay, 30 half pay |
| Maternity | 17 weeks | 9 weeks |
| Paternity | 1 day | 5 days |
| Bereavement | 3 days | 5 days |
| Overtime multiplier | 1.35 | 1.25 |
| Resignation notice | 90 days | 30 days |
| Public holidays | Egyptian | UAE |
| Currency | EGP | AED |

The leave balance, leave validation, working-day count, payslip, final settlement and letters of an employee all use the policy set of the country where the employee works. The policy screen has one tab per country, and each value can be edited. Group figures are converted to Egyptian pounds at an illustrative rate (1 AED = 13 EGP) that is stored with the configuration.

## Sources and review

Starting values follow the Egyptian Labour Law No. 14 of 2025 and the UAE Federal Decree-Law No. 33 of 2021 as summarised in public guidance, plus common company practice. The full set is in [policy-sets-shipping.json](../../data/config-defaults/policy-sets-shipping.json) with notes on where the statute differs from the single value used. These are defaults only. Legal counsel must review them before production use.

## Duty of care in this edition

- Safety check-ins after an incident in a yard or a port, with live headcount by branch.
- Site allowance bands and rotation rest for remote ports.
- Licence tracking: customs broker, heavy vehicle driving, crane and forklift, dangerous goods, port security.
- Branch support pool: staff ready to move to another branch within 72 hours.
- Reports of harassment, fraud and bribery are not collected in the system. Staff are directed to the independent reporting channel.
