<p align="center"><img src="demo/assets/brand/logo-dark.png" alt="HRMO — Human Resource Systems" width="260"></p>

# HRMO

**English** · [العربية](#العربية)

HRMO is a configurable human resources management system for humanitarian and non-profit organizations. It is built on Microsoft Azure and runs entirely within the Microsoft ecosystem: staff sign in with their work account and use it from the browser, Microsoft Teams and Outlook.

![HRMO — Country Director](docs/images/en-country-director.png)

## Why HRMO

Humanitarian organizations manage staff across field offices, grants and hardship locations, under donor rules and local labor law. HRMO puts the whole employee lifecycle in one place and applies the organization's own policies automatically, so that every request is checked the same way and every decision is recorded.

- **Policy-driven.** Leave entitlements, notice periods, approval levels, probation, overtime and every other rule are settings, not code. Each organization, and each country office, has its own policy set.
- **Built for the field.** Grants and funding lines, hardship duty stations, rest and recuperation, staff safety check-ins and emergency surge rosters are part of the system.
- **Inside Microsoft.** Sign-in, approvals in Teams and Outlook, documents and data all stay within the organization's Microsoft environment.
- **Arabic and English.** Full right-to-left support, on desktop and phone.

## Who uses it

| Workspace | What it covers |
|---|---|
| **Employee** | Leave requests with instant policy checks, timesheets with grant allocation, overtime, payslips, letters and certificates, performance and objectives, learning, travel, equipment, declarations, HR helpdesk, wellbeing and confidential support |
| **Line manager** | Team overview, one inbox for all approvals, team leave calendar, performance reviews and improvement plans, organization chart |
| **HR** | Employee directory, recruitment, onboarding, changes of status, separations and final settlement, positions and budget, leave and attendance, performance cycle, learning, staff safety, wellbeing, professional licences, cases and grievances, travel, assets, audit log and policy settings |
| **Country Director** | Executive dashboard, approvals, workforce cost by grant, funding risk, liabilities, diversity and localization, staff safety |

## Modules

**Employee lifecycle**
- Recruitment with mandatory steps: funded position, panel evaluation, reference checks, compliance and misconduct screening
- Onboarding checklists, probation follow-up and contract renewals
- Changes of status: promotion, transfer, salary and funding changes, with approval
- Separation: resignation, clearance by department, final settlement and exit evaluation

**Time and pay**
- Leave of all types, with balances, carry-over and holiday calendars
- Daily attendance, monthly timesheets split by grant, overtime
- Payslips and validated payroll inputs for the finance system

**Performance and learning**
- Annual and probation appraisals, objectives and improvement plans
- Training catalogue, mandatory courses and training needs

**Duty of care**
- Safety check-ins after an incident, with live headcount by office
- Rest and recuperation, burnout watch and hardship allowance
- Confidential psychosocial support requests
- Professional licence tracking for medical and technical staff

**Employee relations**
- Disciplinary cases with a warning ladder and expiry dates
- Grievances with escalation deadlines
- Conflict of interest and gift declarations
- HR helpdesk with response targets

**Organization**
- Positions and budget against grants
- Organization chart, travel and security clearance, assets
- Emergency surge roster
- HR indicators and reports for management and donors

## Approvals in Teams and Outlook

Every request reaches its approver as a card in Teams and Outlook. The card shows the request, the result of the policy checks and the approve and reject buttons, so a manager can decide without opening the system. Each decision is recorded with who made it, when and from where.

![Approval card in Teams](docs/images/en-teams-card.png)

## Security and privacy

- Data stays in the organization's own Azure subscription, in the region it chooses.
- Sign-in uses Microsoft Entra ID, so the organization's own security rules apply.
- Each person sees only what their role allows: employees see their own record, managers see their team, and salary and private data are restricted to HR and management.
- Every change keeps its history, and the audit log cannot be edited.
- Reports of harassment, fraud and safeguarding are not collected in the system. Staff are directed to the organization's independent reporting channel.

## Screens

| | |
|---|---|
| ![Employee](docs/images/ar-employee.png) | ![HR](docs/images/ar-hr.png) |
| ![Line manager](docs/images/en-manager.png) | ![Staff safety](docs/images/ar-safety.png) |

## Documentation

| | English | العربية |
|---|---|---|
| System reference: every rule and setting | [system-reference.md](docs/en/system-reference.md) | [system-reference.md](docs/ar/system-reference.md) |
| Architecture on Azure | [architecture.md](docs/en/architecture.md) | [architecture.md](docs/ar/architecture.md) |
| Security and confidentiality policy | [security.md](docs/en/security.md) | [security.md](docs/ar/security.md) |
| Deployment guide | [azure-setup.md](docs/en/azure-setup.md) | [azure-setup.md](docs/ar/azure-setup.md) |
| Data pipeline, warehouse and data quality | [data-pipeline.md](docs/en/data-pipeline.md) | [data-pipeline.md](docs/ar/data-pipeline.md) |
| Default policy set | [policy-defaults.json](data/config-defaults/policy-defaults.json) | |

Default policy values are examples. Each organization reviews them against its own policies and local labor law.

---

<div dir="rtl">

## العربية

HRMO نظام قابل للتهيئة لإدارة الموارد البشرية في المؤسسات الإنسانية وغير الربحية. مبني على Microsoft Azure ويعمل داخل نظام مايكروسوفت بالكامل: يدخل الموظف بحساب العمل ويستخدم النظام من المتصفح ومن Microsoft Teams وOutlook.

### لماذا HRMO

المؤسسات الإنسانية تدير موظفين موزعين على مكاتب ميدانية ومنح ومواقع عمل شاقة، وتلتزم بشروط المانحين وقانون العمل المحلي. يجمع HRMO دورة حياة الموظف كلها في مكان واحد ويطبق سياسات المؤسسة تلقائيا، فيفحص كل طلب بالطريقة نفسها ويوثق كل قرار.

- **يعمل بالسياسات.** استحقاقات الإجازات ومدد الإشعار ومستويات الموافقة وفترة التجربة والعمل الإضافي وكل قاعدة أخرى هي إعدادات وليست برمجة. لكل مؤسسة ولكل مكتب قطري مجموعة سياسات خاصة.
- **مصمم للعمل الميداني.** المنح وخطوط التمويل ومراكز العمل الشاقة والراحة والتعافي واستطلاعات سلامة الموظفين وقوائم الانتشار السريع جزء من النظام.
- **داخل مايكروسوفت.** تسجيل الدخول والموافقات في Teams وOutlook والمستندات والبيانات تبقى كلها داخل بيئة مايكروسوفت الخاصة بالمؤسسة.
- **بالعربية والإنجليزية.** دعم كامل للكتابة من اليمين إلى اليسار على الحاسوب والهاتف.

### من يستخدمه

| الواجهة | ما تغطيه |
|---|---|
| **الموظف** | طلبات الإجازة مع فحص فوري للسياسات، كشوف الدوام مع توزيع المنح، العمل الإضافي، قسائم الراتب، الخطابات والشهادات، الأداء والأهداف، التعلم، السفر، العهد، الإقرارات، مكتب مساعدة الموارد البشرية، الرفاه والدعم السري |
| **المدير المباشر** | نظرة على الفريق، صندوق واحد لكل الموافقات، تقويم إجازات الفريق، تقييمات الأداء وخطط التحسين، الهيكل التنظيمي |
| **الموارد البشرية** | سجل الموظفين، التوظيف، الاستقبال، تغيير الحالة الوظيفية، إنهاء الخدمة والتسوية النهائية، الوظائف والميزانية، الإجازات والحضور، دورة الأداء، التعلم، سلامة الموظفين، الرفاه، التراخيص المهنية، القضايا والتظلمات، السفر، العهد، سجل التدقيق وإعدادات السياسات |
| **المدير القطري** | لوحة تنفيذية، الموافقات، كلفة القوى العاملة حسب المنحة، مخاطر التمويل، الالتزامات، التنوع والتوطين، سلامة الموظفين |

### الوحدات

**دورة حياة الموظف**
- التوظيف بخطوات إلزامية: وظيفة ممولة، تقييم اللجنة، التحقق من المراجع، فحص الامتثال وسوء السلوك
- قوائم الاستقبال ومتابعة فترة التجربة وتجديد العقود
- تغيير الحالة الوظيفية: الترقية والنقل وتعديل الراتب والتمويل، بموافقة
- إنهاء الخدمة: الاستقالة، المخالصة حسب القسم، التسوية النهائية وتقييم الخروج

**الوقت والرواتب**
- الإجازات بكل أنواعها، مع الأرصدة والترحيل وتقويم العطل
- الحضور اليومي، كشوف الدوام الشهرية موزعة على المنح، العمل الإضافي
- قسائم الراتب ومدخلات رواتب مدققة للنظام المالي

**الأداء والتعلم**
- التقييم السنوي وتقييم فترة التجربة، الأهداف وخطط تحسين الأداء
- دليل الدورات، الدورات الإلزامية والاحتياجات التدريبية

**واجب الرعاية**
- استطلاعات السلامة بعد الحوادث، مع عد حي حسب المكتب
- الراحة والتعافي، رصد الإنهاك وبدل المشقة
- طلبات الدعم النفسي الاجتماعي السرية
- متابعة التراخيص المهنية للكوادر الطبية والفنية

**علاقات العمل**
- القضايا التأديبية مع سلم الإنذارات وتواريخ انتهائها
- التظلمات مع مهل التصعيد
- إقرارات تضارب المصالح والهدايا
- مكتب مساعدة الموارد البشرية بمهل رد محددة

**المؤسسة**
- الوظائف والميزانية مقابل المنح
- الهيكل التنظيمي، السفر والتصريح الأمني، العهد
- قائمة الانتشار السريع للطوارئ
- مؤشرات وتقارير الموارد البشرية للإدارة والمانحين

### الموافقات في Teams وOutlook

يصل كل طلب إلى صاحب القرار كبطاقة في Teams وOutlook. تعرض البطاقة الطلب ونتيجة فحص السياسات وزري الموافقة والرفض، فيقرر المدير دون فتح النظام. يسجل كل قرار مع صاحبه ووقته ومصدره.

### الأمان والخصوصية

- البيانات تبقى في اشتراك Azure الخاص بالمؤسسة وفي المنطقة التي تختارها.
- الدخول عبر Microsoft Entra ID، فتسري قواعد الأمان الخاصة بالمؤسسة.
- كل شخص يرى ما يسمح به دوره فقط: الموظف يرى سجله، والمدير يرى فريقه، وبيانات الرواتب والبيانات الخاصة محصورة في الموارد البشرية والإدارة.
- كل تغيير يحتفظ بتاريخه، وسجل التدقيق لا يقبل التعديل.
- لا يستقبل النظام بلاغات التحرش والاحتيال والحماية، ويوجه الموظف إلى قناة الإبلاغ المستقلة في المؤسسة.

### التوثيق

| | العربية | English |
|---|---|---|
| المرجع الوظيفي: كل القواعد والإعدادات | [system-reference.md](docs/ar/system-reference.md) | [system-reference.md](docs/en/system-reference.md) |
| المعمارية على Azure | [architecture.md](docs/ar/architecture.md) | [architecture.md](docs/en/architecture.md) |
| سياسة الأمن والسرية | [security.md](docs/ar/security.md) | [security.md](docs/en/security.md) |
| دليل النشر | [azure-setup.md](docs/ar/azure-setup.md) | [azure-setup.md](docs/en/azure-setup.md) |
| مسار البيانات والمستودع وجودة البيانات | [data-pipeline.md](docs/ar/data-pipeline.md) | [data-pipeline.md](docs/en/data-pipeline.md) |
| مجموعة السياسات الافتراضية | [policy-defaults.json](data/config-defaults/policy-defaults.json) | |

القيم الافتراضية للسياسات أمثلة، وتراجعها كل مؤسسة حسب سياساتها وقانون العمل المحلي.

</div>

---
*Microsoft, Azure, Teams and Outlook are trademarks of Microsoft. This project is not affiliated with or endorsed by Microsoft.*
