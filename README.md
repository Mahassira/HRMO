# HR Suite

Configurable HR management system for humanitarian and non-profit organizations (up to ~800 employees), designed to run inside **Microsoft Teams and Outlook**.

نظام قابل للتهيئة لإدارة الموارد البشرية في المؤسسات الإنسانية وغير الربحية (حتى نحو 800 موظف)، مصمَّم ليعمل داخل **Microsoft Teams وOutlook**.

![HR Suite — Country Director](docs/images/en-country-director.png)

## Live demo / العرض التفاعلي

The demo in [`demo/`](demo/) runs entirely on GitHub Pages with fictitious data for 800 employees. No server, no sign-in.

نسخة العرض في مجلد `demo/` تعمل بالكامل على GitHub Pages ببيانات وهمية لـ 800 موظف، دون خادم أو تسجيل دخول.

| Workspace / الواجهة | What it shows / ما تعرضه |
|---|---|
| **Employee** / الموظف | Leave balances and requests with instant policy checks, monthly timesheet with grant allocation, payslips, policy acknowledgements, profile |
| **HR** / الموارد البشرية | Dashboard, 800-employee directory, leave approval queue, recruitment pipeline with mandatory gates (panel evaluations, references, compliance screening), compliance tracking, **live policy settings** |
| **Country Director** / المدير القُطري | Executive dashboard (payroll cost by grant, funding risk, turnover, leave liability), approvals with automatic policy checks, workforce analytics |

Approvals are shown as they arrive in **Teams chat** and **Outlook** as actionable cards. The demo supports Arabic (RTL) and English, light and dark themes, and phone screens.

تظهر الموافقات كما تصل في **دردشة Teams** و**Outlook** كبطاقات تفاعلية. يدعم العرض العربية والإنجليزية، والوضعين الفاتح والداكن، وشاشات الهاتف.

### Design system / نظام التصميم
A clean, information-dense enterprise design system defined by central tokens in [`demo/assets/styles.css`](demo/assets/styles.css): colors (primary `#2878D0`, navy `#1F2937`, background `#F5F7FA`), typography (Inter / IBM Plex Sans Arabic), 4px spacing grid, radius, elevation, component dimensions, icon sizes and interaction states. Components include a top bar with workspace switcher, notifications, help, preferences and user menu; a collapsible grouped sidebar with sub-menus; breadcrumbs; data tables with sorting, multi-select, bulk actions, row menus and pagination; confirmation dialogs, toasts, tooltips, toggles, radios, date pickers, empty states and loading skeletons.

نظام تصميم مؤسسي واضح وكثيف المعلومات، معرَّف بمتغيرات مركزية: الألوان والخطوط والمسافات والزوايا والظلال وأبعاد المكونات وأحجام الأيقونات وحالات التفاعل.

### Publish the demo / نشر العرض
1. Push this repository to GitHub. / ارفع المستودع إلى GitHub.
2. **Settings → Pages → Source: GitHub Actions**.
3. Push to `main`; the workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes `demo/`. / عند الرفع إلى `main` يُنشر مجلد `demo/` تلقائياً.

To run locally, open `demo/index.html` in a browser. / للتشغيل محلياً افتح `demo/index.html` في المتصفح.

| | |
|---|---|
| ![Employee](docs/images/ar-employee.png) | ![HR](docs/images/ar-hr.png) |
| ![Teams card](docs/images/en-teams-card.png) | ![Country Director](docs/images/ar-country-director.png) |

## Documentation / التوثيق

| | English | العربية |
|---|---|---|
| Functional system reference / المرجع الوظيفي | [docs/en/system-reference.md](docs/en/system-reference.md) | [docs/ar/system-reference.md](docs/ar/system-reference.md) |

Every rule shown in the demo (e.g. `LV-062`) links back to a rule ID in the system reference. / كل قاعدة تظهر في العرض (مثل `LV-062`) مرتبطة بمعرّف في المرجع الوظيفي.

## Configuration / الإعداد

[`data/config-defaults/policy-defaults.json`](data/config-defaults/policy-defaults.json) is the default policy template. Every key maps to a rule ID in the system reference.

القالب الافتراضي للسياسات، وكل مفتاح فيه مرتبط بمعرّف قاعدة في المرجع.

> Default values are examples and must be verified against each customer's policies and local labor law.
> القيم الافتراضية أمثلة، ويجب مطابقتها مع سياسات كل عميل وقانون العمل المحلي.

## Repository structure / هيكل المستودع

```
demo/              interactive demo (GitHub Pages) — no dependencies
docs/              functional reference (en/ar) + screenshots
data/              policy defaults
.github/workflows  Pages deployment
```

Planned: production Teams/Outlook app package, backend, and schema scripts.
مخطط لاحقاً: حزمة تطبيق Teams/Outlook للإنتاج، والخادم، وسكربتات قاعدة البيانات.

---
*Microsoft, Teams and Outlook are trademarks of Microsoft. This project is not affiliated with or endorsed by Microsoft.*
