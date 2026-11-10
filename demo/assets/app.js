/* HR Suite demo — application (vanilla JS, no dependencies).
 * Three workspaces: Employee self-service, HR, Country Director.
 * Business rules reference IDs in docs/en/system-reference.md. */
(function () {
  'use strict';
  const D = window.HRDATA;
  const STORE_KEY = 'hrsuite-demo-v2';
  const DEFAULT_POLICY = JSON.parse(JSON.stringify(D.POLICY));

  // ======================================================================
  // State & persistence
  // ======================================================================
  const S = {
    role: 'EMPLOYEE',
    lang: 'ar',
    theme: 'light',
    view: { EMPLOYEE: 'home', HR: 'dashboard', CD: 'dashboard' },
    overlay: null,
    dir: { q: '', office: '', dept: '', cat: '', flag: '', page: 1, per: 20, sort: { k: 'name', dir: 1 }, sel: [] },
    collapsed: false, navOpen: false, collapsedSubs: [], confirm: null, hrSel: [], effDate: D.todayISO.slice(0, 8) + '01',
    vacancy: 'VAC-033',
    apFilter: 'PENDING',
    leaveDraft: { type: 'ANNUAL', from: '', to: '', reason: '' },
    timesheet: null,
    readActivity: []
  };
  const empById = new Map(D.employees.map((e) => [e.id, e]));
  const me = () => empById.get(D.personas.EMPLOYEE);
  const persona = () => empById.get(D.personas[S.role]);

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        role: S.role, lang: S.lang, theme: S.theme, view: S.view, collapsed: S.collapsed,
        leaveRequests: D.leaveRequests, approvals: D.approvals, candidates: D.candidates, activity: D.activity,
        policy: D.POLICY, timesheet: S.timesheet, readActivity: S.readActivity,
        me: { ackMissing: me().ackMissing, leave: me().leave }
      }));
    } catch (e) { /* storage unavailable: demo keeps working in memory */ }
  }
  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
    if (!saved) {
      try { if (matchMedia('(prefers-color-scheme: dark)').matches) S.theme = 'dark'; } catch (e) { /* ignore */ }
      return;
    }
    Object.assign(S, { role: saved.role || S.role, lang: saved.lang || S.lang, theme: saved.theme || S.theme, view: Object.assign(S.view, saved.view || {}), collapsed: !!saved.collapsed });
    if (saved.leaveRequests) D.leaveRequests = saved.leaveRequests;
    if (saved.approvals) D.approvals = saved.approvals;
    if (saved.candidates) D.candidates = saved.candidates;
    if (saved.activity) D.activity = saved.activity;
    if (saved.policy) D.POLICY = saved.policy;
    if (saved.timesheet) S.timesheet = saved.timesheet;
    if (saved.readActivity) S.readActivity = saved.readActivity;
    if (saved.me) Object.assign(me(), saved.me);
  }
  function resetDemo() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  }

  // ======================================================================
  // i18n & formatting
  // ======================================================================
  const L = (ar, en) => (S.lang === 'ar' ? ar : en);
  const T = (o) => (o == null ? '' : typeof o === 'string' ? o : (S.lang === 'ar' ? o.ar : o.en));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const locale = () => (S.lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB');
  const fmtN = (n, d = 0) => new Intl.NumberFormat(locale(), { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
  const money = (n, c = 'USD') => `${fmtN(Math.round(n))} ${c === 'USD' ? (S.lang === 'ar' ? 'دولار' : 'USD') : c}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const TODAY = parse(D.todayISO);
  const fmtD = (s) => (s ? new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(parse(s)) : '—');
  const fmtDs = (s) => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(parse(s));
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const initials = (name) => { const p = T(name.short || name).split(' '); return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase(); };
  const officeName = (id) => T(D.OFFICES.find((o) => o.id === id));
  const grant = (id) => D.GRANTS.find((g) => g.id === id);

  const CAT = {
    REGULAR: { ar: 'دائم', en: 'Regular' }, FIXED_SHORT: { ar: 'عقد قصير', en: 'Short fixed-term' },
    DAILY: { ar: 'عامل يومي', en: 'Daily worker' }, INTERN: { ar: 'متدرب', en: 'Intern' }
  };
  const LEAVE = {
    ANNUAL: { ar: 'إجازة سنوية', en: 'Annual leave' }, SICK: { ar: 'إجازة مرضية', en: 'Sick leave' },
    COMP: { ar: 'إجازة تعويضية', en: 'Compensatory leave' }, BEREAVEMENT: { ar: 'إجازة وفاة', en: 'Bereavement leave' },
    UNPAID: { ar: 'إجازة بدون راتب', en: 'Leave without pay' }, MATERNITY: { ar: 'إجازة أمومة', en: 'Maternity leave' },
    PATERNITY: { ar: 'إجازة أبوة', en: 'Paternity leave' }
  };
  const LSTATUS = {
    PENDING_MANAGER: { ar: 'بانتظار المدير المباشر', en: 'Awaiting line manager', b: 'b-warn' },
    PENDING_HR: { ar: 'بانتظار الموارد البشرية', en: 'Awaiting HR', b: 'b-warn' },
    PENDING_CD: { ar: 'بانتظار المدير القُطري', en: 'Awaiting Country Director', b: 'b-warn' },
    APPROVED: { ar: 'معتمدة', en: 'Approved', b: 'b-ok' },
    REJECTED: { ar: 'مرفوضة', en: 'Rejected', b: 'b-bad' }
  };
  const RATING = {
    OUTSTANDING: { ar: 'متميز', en: 'Outstanding' }, VERY_GOOD: { ar: 'جيد جداً', en: 'Very good' }, SATISFACTORY: { ar: 'مرضٍ', en: 'Satisfactory' },
    NEEDS_IMPROVEMENT: { ar: 'يحتاج إلى تحسين', en: 'Needs improvement' }, UNSATISFACTORY: { ar: 'غير مرضٍ', en: 'Unsatisfactory' }
  };
  const STAGE = {
    APPLIED: { ar: 'متقدمون', en: 'Applied' }, SHORTLISTED: { ar: 'القائمة القصيرة', en: 'Shortlisted' }, INTERVIEW: { ar: 'المقابلة', en: 'Interview' },
    EVALUATION: { ar: 'تقييم اللجنة', en: 'Panel evaluation' }, SCREENING: { ar: 'المراجع والفحص', en: 'References & screening' }, OFFER: { ar: 'العرض', en: 'Offer' }
  };
  const APTYPE = {
    HIRE: { ar: 'اعتماد تعيين', en: 'Hiring approval' }, SALARY_INCREASE: { ar: 'زيادة راتب', en: 'Salary increase' },
    UNPAID_LEAVE: { ar: 'إجازة بدون راتب', en: 'Leave without pay' }, NEW_POSITION: { ar: 'وظيفة جديدة', en: 'New position' },
    WARNING: { ar: 'إنذار كتابي', en: 'Written warning' }, ACTING: { ar: 'تكليف مؤقت', en: 'Acting appointment' }
  };
  const DAYNAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const DAYLABEL = { SUN: { ar: 'الأحد', en: 'Sun' }, MON: { ar: 'الاثنين', en: 'Mon' }, TUE: { ar: 'الثلاثاء', en: 'Tue' }, WED: { ar: 'الأربعاء', en: 'Wed' }, THU: { ar: 'الخميس', en: 'Thu' }, FRI: { ar: 'الجمعة', en: 'Fri' }, SAT: { ar: 'السبت', en: 'Sat' } };

  // ======================================================================
  // Icons (simple 20px Fluent-like strokes)
  // ======================================================================
  const P = {
    home: 'M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z',
    cal: 'M4 5h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 8.5h14M7 3v3M13 3v3',
    clock: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 6v4l2.5 2',
    money: 'M3 6h14v9H3zM10 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 8.5v.01M14.5 12.5v.01',
    shield: 'M10 3 4 5.5V10c0 3.5 2.6 6 6 7 3.4-1 6-3.5 6-7V5.5zM7.5 10l2 2 3.5-4',
    person: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c.6-3 3-4.5 6-4.5s5.4 1.5 6 4.5',
    people: 'M7.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2.5 16c.5-2.5 2.5-3.8 5-3.8s4.5 1.3 5 3.8M13 9.5a2 2 0 1 0 0-4M14 12.3c1.8.3 3 1.5 3.5 3.7',
    brief: 'M3 7h14v9H3zM7 7V5h6v2M3 11h14',
    chart: 'M4 16V9M8 16V5M12 16v-5M16 16V7M3 16.5h14',
    check: 'M4.5 10.5 8 14l7.5-8',
    x: 'M5 5l10 10M15 5 5 15',
    bell: 'M6 8a4 4 0 1 1 8 0v3.5l1.5 2.5h-11L6 11.5zM8.5 16a1.5 1.5 0 0 0 3 0',
    chat: 'M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3V5a1 1 0 0 1 1-1z',
    teams: 'M3 6h8v8H3zM5 8.5h4M7 8.5V12M13 7.5a1.8 1.8 0 1 0 0-3.6M12.5 9h3.5v3.5a2.5 2.5 0 0 1-3.5 2.3',
    gear: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4',
    search: 'M8.5 14a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM12.5 12.5 17 17',
    mail: 'M3 5h14v10H3zM3 5.5l7 5.5 7-5.5',
    warn: 'M10 3 2.5 16h15zM10 8v4M10 14.2v.1',
    info: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 9v4.5M10 6.5v.1',
    lock: 'M5 9h10v8H5zM7 9V6.5a3 3 0 0 1 6 0V9',
    moon: 'M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z',
    sun: 'M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.3 4.3l1 1M14.7 14.7l1 1M4.3 15.7l1-1M14.7 5.3l1-1',
    globe: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM3 10h14M10 3c2 2 2.8 4.5 2.8 7S12 15 10 17c-2-2-2.8-4.5-2.8-7S8 5 10 3z',
    list: 'M7 6h9M7 10h9M7 14h9M4 6v.01M4 10v.01M4 14v.01',
    approve: 'M4 4h12v12H4zM7 10l2 2 4-4',
    apps: 'M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z',
    reset: 'M4 10a6 6 0 1 0 2-4.5M4 4v3.5h3.5',
    doc: 'M6 3h6l3 3v11H6zM12 3v3h3M8 10h5M8 13h5',
    up: 'M10 15V5M6 9l4-4 4 4',
    down: 'M4 7l6 6 6-6',
    flag: 'M5 17V4M5 4h9l-2 3 2 3H5',
    send: 'M3 10l14-6-5 13-2.5-5.5z',
    menu: 'M3.5 5.5h13M3.5 10h13M3.5 14.5h13',
    panel: 'M3.5 4.5h13v11h-13zM8 4.5v11',
    chevR: 'M8 5l5 5-5 5',
    chevL: 'M12 5l-5 5 5 5',
    help: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8 8.2a2 2 0 1 1 2.9 1.8c-.6.3-.9.8-.9 1.4v.3M10 13.9v.1',
    more: 'M4.5 10h.5M9.75 10h.5M15 10h.5',
    sort: 'M7 8l3-3 3 3M7 12l3 3 3-3',
    sortUp: 'M10 15V5M6.5 8.5 10 5l3.5 3.5',
    sortDown: 'M10 5v10M6.5 11.5 10 15l3.5-3.5',
    download: 'M10 3.5v9M6 9l4 4 4-4M4 16.5h12',
    plus: 'M10 4v12M4 10h12'
  };
  const icon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n] || ''}"/></svg>`;

  // ======================================================================
  // Policy engine
  // ======================================================================
  const holidaySet = () => new Set(D.HOLIDAYS.map((h) => h.date));
  function isWorkDay(d) { return D.POLICY.workWeek.days.includes(DAYNAMES[d.getDay()]) && !holidaySet().has(iso(d)); }
  function workingDays(fromS, toS) {
    let n = 0; let d = parse(fromS); const end = parse(toS);
    while (d <= end) { if (isWorkDay(d)) n++; d = addDays(d, 1); }
    return n;
  }
  function businessDaysUntil(toS) { // working days from tomorrow up to the day before "toS"
    let n = 0; let d = addDays(TODAY, 1); const end = parse(toS);
    while (d < end) { if (isWorkDay(d)) n++; d = addDays(d, 1); }
    return n;
  }
  const serviceDays = (e) => daysBetween(e.hireDate, D.todayISO);
  const serviceMonths = (e) => Math.floor(serviceDays(e) / 30.44);
  function monthsAccruedThisYear(e) {
    const hire = parse(e.hireDate); const jan = new Date(TODAY.getFullYear(), 0, 1);
    const start = hire > jan ? hire : jan;
    return Math.max(0, (TODAY.getFullYear() - start.getFullYear()) * 12 + TODAY.getMonth() - start.getMonth() + 1);
  }
  function leaveUsed(e, type, statuses) {
    return D.leaveRequests.filter((r) => r.empId === e.id && r.type === type && statuses.includes(r.status) && parse(r.from).getFullYear() === TODAY.getFullYear()).reduce((s, r) => s + r.days, 0);
  }
  function balances(e) {
    const P2 = D.POLICY.leave;
    const ent = P2.ANNUAL.entitlementDays;
    const accrued = e.category !== 'REGULAR' ? 0 : P2.ANNUAL.accrual === 'ANNUAL_GRANT' ? ent : +(monthsAccruedThisYear(e) * ent / 12).toFixed(2);
    const pending = ['PENDING_MANAGER', 'PENDING_HR', 'PENDING_CD'];
    const annualTaken = e.leave.annualUsed + leaveUsed(e, 'ANNUAL', ['APPROVED']) - (e.id === me().id ? 3 : 0); // seeded history already counted
    const annualPending = leaveUsed(e, 'ANNUAL', pending);
    const sickTaken = e.leave.sickUsed + leaveUsed(e, 'SICK', ['APPROVED']) - (e.id === me().id ? 2 : 0);
    return {
      annual: { entitlement: ent, accrued, taken: Math.max(0, annualTaken), pending: annualPending, available: +(accrued - Math.max(0, annualTaken) - annualPending).toFixed(2) },
      sick: { full: Math.max(0, P2.SICK.fullPayDays - sickTaken), half: P2.SICK.halfPayDays, taken: sickTaken },
      comp: { available: e.leave.compDays - leaveUsed(e, 'COMP', ['APPROVED', ...pending]) },
      unpaid: { used: e.leave.unpaidUsed + leaveUsed(e, 'UNPAID', ['APPROVED', ...pending]), max: P2.UNPAID.maxDaysPerYear }
    };
  }
  const R = (rule, ar, en) => ({ rule, ar, en });

  function validateLeave(e, req, ignoreId) {
    const out = { errors: [], warnings: [], info: [], days: 0 };
    const P2 = D.POLICY.leave;
    if (!req.from || !req.to) return out;
    if (parse(req.to) < parse(req.from)) { out.errors.push(R('LV-004', 'تاريخ النهاية قبل تاريخ البداية.', 'End date is before start date.')); return out; }
    out.days = workingDays(req.from, req.to);
    if (out.days === 0) out.errors.push(R('LV-003', 'الفترة المختارة لا تحتوي على أيام عمل (عطلة أسبوعية أو رسمية).', 'The selected range has no working days (weekend or public holiday).'));
    const overlap = D.leaveRequests.find((r) => r.empId === e.id && r.id !== ignoreId && r.status !== 'REJECTED' && parse(r.from) <= parse(req.to) && parse(r.to) >= parse(req.from));
    if (overlap) out.errors.push(R('LV-004', `تتداخل مع طلب ${overlap.id} (${fmtD(overlap.from)}).`, `Overlaps request ${overlap.id} (${fmtD(overlap.from)}).`));
    const retro = ['SICK', 'BEREAVEMENT'].includes(req.type);
    if (!retro && parse(req.from) < TODAY) out.errors.push(R('LV-001', 'يجب تقديم هذا النوع من الإجازات قبل أخذها.', 'This leave type must be requested before it is taken.'));
    const b = balances(e);
    if (e.inProbation && (req.type !== 'SICK' || !D.POLICY.flags.sickInProbation)) out.warnings.push(R('LC-005', 'أنت في فترة التجربة: ستُسجَّل هذه الإجازة بدون راتب.', 'You are on probation: this leave will be recorded as unpaid.'));
    switch (req.type) {
      case 'ANNUAL':
        if (serviceMonths(e) < P2.ANNUAL.minServiceMonths) out.errors.push(R('LV-012', `الإجازة السنوية متاحة بعد ${P2.ANNUAL.minServiceMonths} أشهر من الخدمة.`, `Annual leave is available after ${P2.ANNUAL.minServiceMonths} months of service.`));
        if (out.days > b.annual.available) out.errors.push(R('LV-004', `الرصيد المتاح ${fmtN(b.annual.available, 2)} يوم فقط.`, `Only ${fmtN(b.annual.available, 2)} days available.`));
        else if (out.days) out.info.push(R('LV-011', `الرصيد بعد الطلب: ${fmtN(b.annual.available - out.days, 2)} يوم.`, `Balance after request: ${fmtN(b.annual.available - out.days, 2)} days.`));
        break;
      case 'SICK':
        out.info.push(R('LV-021', 'يجب إرفاق تقرير طبي.', 'A medical certificate is required.'));
        if (daysBetween(req.from, D.todayISO) > 2) out.warnings.push(R('LV-020', 'يجب إبلاغ المدير خلال 48 ساعة، وإلا يُعتبر الغياب غير مصرّح به.', 'Your manager must be informed within 48 hours, otherwise the absence is unauthorized.'));
        if (out.days > b.sick.full) out.warnings.push(R('LV-022', `${fmtN(out.days - b.sick.full)} يوم سيُحتسب بنصف راتب.`, `${fmtN(out.days - b.sick.full)} day(s) will be at half pay.`));
        break;
      case 'COMP':
        if (out.days > b.comp.available) out.errors.push(R('LV-080', `رصيدك التعويضي ${fmtN(b.comp.available)} يوم.`, `Your compensatory balance is ${fmtN(b.comp.available)} day(s).`));
        out.info.push(R('LV-081', `تسقط الإجازة التعويضية بعد ${P2.COMP.expiresAfterDays} أيام من العمل الإضافي.`, `Compensatory leave expires ${P2.COMP.expiresAfterDays} days after the extra work.`));
        break;
      case 'BEREAVEMENT':
        if (out.days > P2.BEREAVEMENT.daysPerEvent) out.errors.push(R('LV-030', `الحد الأقصى ${P2.BEREAVEMENT.daysPerEvent} أيام لكل حالة.`, `Maximum ${P2.BEREAVEMENT.daysPerEvent} days per event.`));
        break;
      case 'UNPAID':
        if (serviceMonths(e) < P2.UNPAID.minServiceMonths) out.errors.push(R('LV-060', `تتطلب خدمة لا تقل عن ${P2.UNPAID.minServiceMonths} أشهر.`, `Requires at least ${P2.UNPAID.minServiceMonths} months of service.`));
        if (businessDaysUntil(req.from) < P2.UNPAID.noticeBusinessDays) out.errors.push(R('LV-062', `يجب التقديم قبل ${P2.UNPAID.noticeBusinessDays} أيام عمل على الأقل.`, `Must be requested at least ${P2.UNPAID.noticeBusinessDays} working days in advance.`));
        if (b.unpaid.used + out.days > b.unpaid.max) out.errors.push(R('LV-061', `الحد السنوي ${b.unpaid.max} يوماً، استخدمت ${b.unpaid.used}.`, `Annual limit is ${b.unpaid.max} days; ${b.unpaid.used} already used.`));
        out.info.push(R('LV-063', 'مسار الموافقة: المدير المباشر ← الموارد البشرية ← المدير القُطري.', 'Approval: line manager → HR → Country Director.'));
        break;
      case 'MATERNITY':
        if (e.gender !== 'F') out.errors.push(R('LV-040', 'هذا النوع غير متاح لك.', 'This leave type is not available to you.'));
        else if (serviceDays(e) < P2.MATERNITY.minServiceDays) out.errors.push(R('LV-040', `تتطلب ${P2.MATERNITY.minServiceDays} يوماً من الخدمة قبل الولادة.`, `Requires ${P2.MATERNITY.minServiceDays} days of service before delivery.`));
        out.info.push(R('LV-041', `المدة ${P2.MATERNITY.durationWeeks} أسبوعاً، ويمكن أخذ نصفها قبل الولادة. يلزم تقرير طبي بالموعد المتوقع.`, `${P2.MATERNITY.durationWeeks} weeks; up to half before birth. Medical certificate with expected date required.`));
        break;
      case 'PATERNITY':
        if (e.gender !== 'M') out.errors.push(R('LV-050', 'هذا النوع غير متاح لك.', 'This leave type is not available to you.'));
        break;
      default: break;
    }
    return out;
  }
  const leaveTypesFor = (e) => ['ANNUAL', 'SICK', 'COMP', 'BEREAVEMENT', 'UNPAID', e.gender === 'F' ? 'MATERNITY' : 'PATERNITY'];

  // ======================================================================
  // Small UI builders
  // ======================================================================
  const rule = (id) => `<span class="rule" title="${esc(L('معرّف القاعدة في المرجع الوظيفي', 'Rule ID in the system reference'))}">${esc(id)}</span>`;
  const badge = (cls, text, ic) => `<span class="badge ${cls}">${ic ? icon(ic, 12) : ''}${esc(text)}</span>`;
  const statusBadge = (s) => badge(LSTATUS[s].b, T(LSTATUS[s]), s === 'APPROVED' ? 'check' : s === 'REJECTED' ? 'x' : 'clock');
  const avatar = (e, cls = '') => `<span class="avatar ${cls}" aria-hidden="true">${esc(initials(e.name))}</span>`;
  const who = (e, sub) => `<div class="who">${avatar(e, 'sm')}<div><div class="n">${esc(T(e.name.short))}</div>${sub ? `<div class="subtle">${esc(sub)}</div>` : ''}</div></div>`;
  const tile = (label, value, hint, act, ic) => `<${act ? `button class="tile clickable" data-act="${act}"` : 'div class="tile"'}><span class="label">${ic ? icon(ic, 16) : ''}${esc(label)}</span><span class="value">${value}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</${act ? 'button' : 'div'}>`;
  function msgs(v) {
    const row = (cls, ic, m) => `<div class="msg ${cls}">${icon(ic, 16)}<div>${esc(T(m))} ${rule(m.rule)}</div></div>`;
    return `<div class="msgs">${v.errors.map((m) => row('bad', 'warn', m)).join('')}${v.warnings.map((m) => row('warn', 'warn', m)).join('')}${v.info.map((m) => row('info', 'info', m)).join('')}</div>`;
  }
  function bars(items, opts = {}) { // single-series horizontal bars, values direct-labeled, hover tooltip
    const max = Math.max(...items.map((i) => i.value), 1);
    const fmt = opts.fmt || ((v) => fmtN(v));
    const rows = items.map((i) => `<div class="bar-row"><span class="bl" title="${esc(i.label)}">${esc(i.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${(i.value / max) * 100}%"></div><span class="bar-hit" data-tip="${esc(`<div>${esc(i.label)}</div><b>${esc(fmt(i.value))}</b>${i.tip ? `<div>${esc(i.tip)}</div>` : ''}`)}"></span></div><span class="bv">${esc(fmt(i.value))}</span></div>`).join('');
    const table = `<table class="sr-only"><caption>${esc(opts.title || '')}</caption><tbody>${items.map((i) => `<tr><th>${esc(i.label)}</th><td>${esc(fmt(i.value))}</td></tr>`).join('')}</tbody></table>`;
    return `<div class="bars" role="img" aria-label="${esc(opts.title || '')}">${rows}</div>${table}`;
  }
  const meter = (pct, cls = '') => `<div class="meter ${cls}" role="meter" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
  function toast(text, kind = '') {
    const host = document.getElementById('toast-host');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `${icon(kind === 'bad' ? 'warn' : 'check', 16)}<span>${esc(text)}</span>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }
  function addActivity(role, ch, ar, en, go) {
    D.activity.unshift({ id: `A${Date.now()}${Math.floor(Math.random() * 99)}`, role, ch, at: D.todayISO, ar, en, go });
  }

  // ======================================================================
  // Shell
  // ======================================================================
  const NAV = {
    EMPLOYEE: [
      { g: 'overview', ar: 'نظرة عامة', en: 'Overview', items: [{ v: 'home', ic: 'home', ar: 'الرئيسية', en: 'Home' }] },
      { g: 'time', ar: 'الوقت والإجازات', en: 'Time & leave', items: [{ v: 'leave', ic: 'cal', ar: 'إجازاتي', en: 'My leave' }, { v: 'timesheet', ic: 'clock', ar: 'كشف الدوام', en: 'Timesheet' }] },
      { g: 'pay', ar: 'الرواتب', en: 'Pay', items: [{ v: 'pay', ic: 'money', ar: 'قسائم الراتب', en: 'Payslips' }] },
      { g: 'me', ar: 'حسابي', en: 'My account', items: [{ v: 'policies', ic: 'shield', ar: 'السياسات والإقرارات', en: 'Policies' }, { v: 'profile', ic: 'person', ar: 'ملفي الشخصي', en: 'My profile' }] }
    ],
    HR: [
      { g: 'overview', ar: 'نظرة عامة', en: 'Overview', items: [{ v: 'dashboard', ic: 'chart', ar: 'لوحة المتابعة', en: 'Dashboard' }] },
      { g: 'people', ar: 'الموظفون', en: 'People', items: [{ v: 'employees', ic: 'people', ar: 'سجل الموظفين', en: 'Employees', sub: [{ k: '', ar: 'كل الموظفين', en: 'All employees' }, { k: 'probation', ar: 'في فترة التجربة', en: 'On probation' }, { k: 'contracts', ar: 'عقود تنتهي قريباً', en: 'Contracts ending' }, { k: 'flags', ar: 'بحاجة لمتابعة', en: 'Needs attention' }] }] },
      { g: 'time', ar: 'الوقت والإجازات', en: 'Time & leave', items: [{ v: 'leave', ic: 'cal', ar: 'طلبات الإجازة', en: 'Leave requests', badge: true }] },
      { g: 'talent', ar: 'المواهب', en: 'Talent', items: [{ v: 'recruitment', ic: 'brief', ar: 'التوظيف', en: 'Recruitment', sub: D.vacancies.map((x) => ({ k: x.id, ar: `${x.id} · ${x.ar}`, en: `${x.id} · ${x.en}` })) }] },
      { g: 'gov', ar: 'الحوكمة', en: 'Governance', items: [{ v: 'compliance', ic: 'shield', ar: 'الامتثال', en: 'Compliance' }, { v: 'settings', ic: 'gear', ar: 'إعدادات السياسات', en: 'Policy settings' }] }
    ],
    CD: [
      { g: 'overview', ar: 'نظرة عامة', en: 'Overview', items: [{ v: 'dashboard', ic: 'chart', ar: 'اللوحة التنفيذية', en: 'Executive dashboard' }] },
      { g: 'decisions', ar: 'القرارات', en: 'Decisions', items: [{ v: 'approvals', ic: 'approve', ar: 'الموافقات', en: 'Approvals', badge: true, sub: [{ k: 'PENDING', ar: 'بانتظاري', en: 'Pending' }, { k: 'DONE', ar: 'تم البت فيها', en: 'Decided' }] }] },
      { g: 'insights', ar: 'التحليلات', en: 'Insights', items: [{ v: 'workforce', ic: 'people', ar: 'القوى العاملة', en: 'Workforce' }, { v: 'compliance', ic: 'shield', ar: 'الامتثال', en: 'Compliance' }] }
    ]
  };
  const ROLES = [['EMPLOYEE', 'الموظف', 'Employee', 'الخدمة الذاتية', 'Self-service'], ['HR', 'الموارد البشرية', 'HR', 'عمليات الموارد البشرية', 'HR operations'], ['CD', 'المدير القُطري', 'Country Director', 'القرارات والتحليلات', 'Decisions & insights']];
  const roleLabel = (r) => { const x = ROLES.find((y) => y[0] === r); return L(x[1], x[2]); };

  function unreadCount() { return D.activity.filter((a) => a.role === S.role && !S.readActivity.includes(a.id)).length; }
  function pendingBadge() {
    if (S.role === 'CD') return D.approvals.filter((a) => a.status === 'PENDING').length;
    if (S.role === 'HR') return D.leaveRequests.filter((r) => r.status === 'PENDING_HR').length;
    return 0;
  }
  function findNav(v) {
    for (const g of NAV[S.role]) for (const it of g.items) if (it.v === (v || S.view[S.role])) return { g, it };
    return { g: NAV[S.role][0], it: NAV[S.role][0].items[0] };
  }
  function subCurrent(v) { return v === 'employees' ? S.dir.flag : v === 'recruitment' ? S.vacancy : v === 'approvals' ? S.apFilter : ''; }
  function applySub(v, k) {
    if (v === 'employees') { S.dir.flag = k; S.dir.page = 1; S.dir.sel = []; }
    if (v === 'recruitment') S.vacancy = k;
    if (v === 'approvals') S.apFilter = k;
  }
  function navItem(it) {
    const active = S.view[S.role] === it.v;
    const open = it.sub && active && !S.collapsedSubs.includes(it.v);
    const b = it.badge ? pendingBadge() : 0;
    const label = L(it.ar, it.en);
    return `<div><button class="nav-item ${active ? 'active' : ''}" data-act="nav" data-v="${it.v}" aria-current="${active ? 'page' : 'false'}" ${it.sub ? `aria-expanded="${!!open}"` : ''} ${S.collapsed ? `data-tip="${esc(esc(label))}"` : ''}>${icon(it.ic, 18)}<span class="nav-label">${esc(label)}</span>${b ? `<span class="nav-count">${b}</span>` : ''}${it.sub ? `<span class="nav-chev ${open ? 'open' : ''}">${icon('chevR', 14)}</span>` : ''}</button>
      ${it.sub && open && !S.collapsed ? `<div class="nav-sub">${it.sub.map((sb) => `<button class="nav-subitem ${active && subCurrent(it.v) === sb.k ? 'active' : ''}" data-act="nav-sub" data-v="${it.v}" data-k="${sb.k}" title="${esc(L(sb.ar, sb.en))}">${esc(L(sb.ar, sb.en))}</button>`).join('')}</div>` : ''}</div>`;
  }
  function crumbs() {
    const { g, it } = findNav();
    const parts = [`<button data-act="home-app">${esc(roleLabel(S.role))}</button>`, `<span>${esc(L(g.ar, g.en))}</span>`];
    if (it.sub) {
      const sb = it.sub.find((x) => x.k === subCurrent(it.v));
      parts.push(`<button data-act="nav-sub" data-v="${it.v}" data-k="${it.sub[0].k}">${esc(L(it.ar, it.en))}</button>`);
      if (sb) parts.push(`<span class="cur">${esc(L(sb.ar, sb.en))}</span>`);
    } else parts.push(`<span class="cur">${esc(L(it.ar, it.en))}</span>`);
    return `<nav class="crumbs" aria-label="${esc(L('مسار التنقل', 'Breadcrumb'))}">${parts.join(`<span class="flip-rtl" aria-hidden="true">${icon('chevR', 12)}</span>`)}</nav>`;
  }

  function shell(content) {
    const p = persona();
    const n = unreadCount();
    const side = NAV[S.role].map((gr) => `<div class="nav-group"><div class="nav-group-label">${esc(L(gr.ar, gr.en))}</div>${gr.items.map(navItem).join('')}</div>`).join('');
    return `
    <header class="topbar">
      <button class="iconbtn only-sm" data-act="nav-toggle" aria-label="${esc(L('القائمة', 'Menu'))}" aria-expanded="${S.navOpen}">${icon('menu')}</button>
      <button class="iconbtn hide-md" data-act="collapse" aria-label="${esc(L('طي القائمة الجانبية', 'Collapse sidebar'))}" data-tip="${esc(esc(S.collapsed ? L('توسيع القائمة', 'Expand menu') : L('طي القائمة', 'Collapse menu')))}">${icon('panel')}</button>
      <div class="brand"><span class="logo" aria-hidden="true">HR</span><span>HR Suite</span></div>
      <button class="ws-switch" data-act="menu-ws" aria-haspopup="menu" title="${esc(L('تبديل مساحة العمل', 'Switch workspace'))}">${icon(S.role === 'CD' ? 'chart' : S.role === 'HR' ? 'people' : 'person', 14)}<span class="wl">${esc(roleLabel(S.role))}</span>${icon('down', 12)}</button>
      <span class="demo-pill">${esc(L('بيانات تجريبية', 'Demo data'))}</span>
      <label class="search">${icon('search', 16)}<span class="sr-only">${esc(L('بحث', 'Search'))}</span><input type="search" id="gsearch" placeholder="${esc(L('ابحث عن موظف أو رقم وظيفي…', 'Search employees or staff numbers…'))}" data-act="global-search"><kbd>/</kbd></label>
      <div class="tools">
        <button class="iconbtn" data-act="activity" aria-label="${esc(L('الإشعارات', 'Notifications'))}" data-tip="${esc(esc(L('الإشعارات', 'Notifications')))}">${icon('bell')}${n ? `<span class="count">${n}</span>` : ''}</button>
        <button class="iconbtn hide-sm" data-act="help" aria-label="${esc(L('المساعدة', 'Help'))}" data-tip="${esc(esc(L('المساعدة', 'Help')))}">${icon('help')}</button>
        <button class="iconbtn hide-sm" data-act="prefs" aria-label="${esc(L('الإعدادات', 'Settings'))}" data-tip="${esc(esc(L('التفضيلات', 'Preferences')))}">${icon('gear')}</button>
        <button class="userbtn" data-act="menu-user" aria-haspopup="menu" aria-label="${esc(T(p.name))}">${avatar(p)}<span class="ut hide-sm"><span class="un" style="display:block">${esc(T(p.name.short))}</span><span class="ur">${esc(T(p.position))}</span></span>${icon('down', 12)}</button>
      </div>
    </header>
    <div class="shell ${S.collapsed ? 'collapsed' : ''} ${S.navOpen ? 'nav-open' : ''}">
      <aside class="sidebar" aria-label="${esc(L('التنقل الرئيسي', 'Main navigation'))}">${side}<div class="sidebar-foot">${esc(T(D.ORG))}</div></aside>
      <div class="scrim-nav" data-act="nav-toggle"></div>
      <main class="content" id="content"><div class="page">${crumbs()}${content}</div></main>
    </div>`;
  }

  // ---------- Dropdown menus (rendered outside the main tree) ----------
  let menuState = null;
  function openMenu(anchor, html, align, key) {
    const host = document.getElementById('menu-host');
    if (menuState && menuState.key === key) { closeMenu(); return; }
    host.innerHTML = `<div class="menu" role="menu">${html}</div>`;
    const m = host.firstElementChild; const r = anchor.getBoundingClientRect(); const w = m.offsetWidth; const rtl = S.lang === 'ar';
    const atEnd = align === 'end';
    let left = (atEnd ? !rtl : rtl) ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, innerWidth - w - 8));
    let top = r.bottom + 4; if (top + m.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - m.offsetHeight - 4);
    m.style.left = `${left}px`; m.style.top = `${top}px`;
    menuState = { key };
    const first = m.querySelector('.menu-item'); if (first) first.focus();
  }
  function closeMenu() { const host = document.getElementById('menu-host'); if (host) host.innerHTML = ''; menuState = null; }
  const mItem = (act, ic, label, extra = '', desc = '', checked = false, cls = '') => `<button class="menu-item ${cls}" role="menuitem" data-act="${act}" ${extra}>${ic ? icon(ic, 16) : ''}<span>${esc(label)}${desc ? `<span class="md">${esc(desc)}</span>` : ''}</span>${checked ? `<span class="ck">${icon('check', 16)}</span>` : ''}</button>`;
  function wsMenu() {
    return `<div class="menu-label">${esc(L('مساحة العمل', 'Workspace'))}</div>${ROLES.map(([r, ar, en, dar, den]) => mItem('role', r === 'CD' ? 'chart' : r === 'HR' ? 'people' : 'person', L(ar, en), `data-v="${r}"`, L(dar, den), S.role === r)).join('')}`;
  }
  function userMenu() {
    const p = persona();
    return `<div class="menu-head">${avatar(p)}<div style="min-width:0"><div class="n">${esc(T(p.name))}</div><div class="subtle" style="direction:ltr;text-align:start;overflow:hidden;text-overflow:ellipsis">${esc(p.email)}</div></div></div><div class="menu-sep"></div>
      ${mItem('my-profile', 'person', L('ملفي الشخصي', 'My profile'))}${mItem('prefs', 'gear', L('التفضيلات', 'Preferences'))}${mItem('help', 'help', L('المساعدة', 'Help'))}
      <div class="menu-sep"></div><div class="menu-label">${esc(L('تبديل مساحة العمل', 'Switch workspace'))}</div>${ROLES.map(([r, ar, en]) => mItem('role', '', L(ar, en), `data-v="${r}"`, '', S.role === r)).join('')}
      <div class="menu-sep"></div>${mItem('reset', 'reset', L('إعادة ضبط البيانات التجريبية', 'Reset demo data'), '', '', false, 'danger')}`;
  }
  function rowMenu(id) {
    const e = empById.get(id);
    return `<div class="menu-label">${esc(T(e.name.short))}</div>${mItem('emp', 'person', L('فتح الملف', 'Open profile'), `data-id="${id}"`)}${mItem('toast', 'doc', L('تغيير حالة', 'Change of status'), `data-msg="${esc(L('أُنشئ تغيير حالة جديد (مسودة).', 'New change of status created (draft).'))}"`)}${mItem('toast', 'doc', L('إصدار شهادة خبرة', 'Issue employment certificate'), `data-msg="${esc(L('أُنشئت شهادة الخبرة من القالب.', 'Employment certificate generated from template.'))}"`)}${mItem('toast', 'teams', L('مراسلة عبر Teams', 'Message in Teams'), `data-msg="${esc(L('فُتحت محادثة Teams مع الموظف.', 'Teams chat opened with the employee.'))}"`)}`;
  }
  function emptyState(ic, title, text, action) {
    return `<div class="empty-state"><span class="ei">${icon(ic, 22)}</span><b>${esc(title)}</b>${text ? `<span class="subtle">${esc(text)}</span>` : ''}${action || ''}</div>`;
  }
  function skeletonHTML() {
    const t = '<div class="tile"><div class="sk line" style="width:50%"></div><div class="sk kpi" style="margin-top:8px"></div><div class="sk line" style="width:40%;margin-top:8px"></div></div>';
    return `<div class="page-head"><div><div class="sk title"></div><div class="sk line" style="width:320px;margin-top:8px"></div></div></div><div class="grid g-4">${t}${t}${t}${t}</div><div class="card">${'<div class="sk line" style="margin:10px 0"></div>'.repeat(6)}</div>`;
  }


  // ======================================================================
  // EMPLOYEE views
  // ======================================================================
  function myRequests() { return D.leaveRequests.filter((r) => r.empId === me().id).sort((a, b) => (a.submitted < b.submitted ? 1 : -1)); }
  function tsState() {
    const ym = D.todayISO.slice(0, 7);
    if (!S.timesheet || S.timesheet.month !== ym) S.timesheet = { month: ym, status: 'DRAFT', alloc: me().alloc.map((a) => ({ ...a })) };
    return S.timesheet;
  }
  function lastWorkingDayOfMonth() { let d = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0); while (!isWorkDay(d)) d = addDays(d, -1); return d; }

  function vEmpHome() {
    const e = me(); const b = balances(e); const mgr = empById.get(e.managerId);
    const pend = myRequests().filter((r) => r.status.startsWith('PENDING'));
    const ts = tsState();
    const lwd = lastWorkingDayOfMonth(); const tsDays = daysBetween(D.todayISO, iso(lwd));
    const tasks = [];
    e.ackMissing.forEach((c) => { const p = D.POLICIES.find((x) => x.code === c); tasks.push({ ic: 'shield', t: L(`الإقرار بسياسة: ${p.ar}`, `Acknowledge policy: ${p.en}`), s: L('مطلوب للامتثال', 'Required for compliance'), r: 'ON-004', act: 'nav', v: 'policies' }); });
    if (ts.status === 'DRAFT') tasks.push({ ic: 'clock', t: L('تسليم كشف الدوام الشهري', 'Submit monthly timesheet'), s: L(`الموعد: ${fmtD(iso(lwd))} (بعد ${tsDays} يوم)`, `Due ${fmtD(iso(lwd))} (in ${tsDays} days)`), r: 'TS-003', act: 'nav', v: 'timesheet' });
    tasks.push({ ic: 'flag', t: L('مراجعة الأهداف الربعية مع المدير', 'Quarterly objectives review with your manager'), s: L('ضمن دورة الأداء', 'Part of the performance cycle'), r: 'PF-010' });
    const upcoming = D.HOLIDAYS.filter((h) => h.date >= D.todayISO).slice(0, 3);
    return `
      <div class="page-head"><div><h1>${esc(L(`مرحباً ${e.name.ar.split(' ')[0]}`, `Welcome, ${e.name.en.split(' ')[0]}`))}</h1><p>${esc(`${T(e.position)} · ${T(e.deptName)} · ${officeName(e.office)}`)}</p></div>
        <div class="btn-row"><button class="btn primary" data-act="nav" data-v="leave">${icon('cal', 16)}${esc(L('طلب إجازة', 'Request leave'))}</button></div></div>
      <div class="grid g-4 keep2">
        ${tile(L('الإجازة السنوية المتاحة', 'Annual leave available'), `${fmtN(b.annual.available, 2)}`, L(`من ${fmtN(b.annual.accrued, 2)} مستحقة هذا العام`, `of ${fmtN(b.annual.accrued, 2)} accrued this year`), 'nav-leave', 'cal')}
        ${tile(L('المرضية براتب كامل', 'Sick leave (full pay)'), fmtN(b.sick.full), L(`+ ${b.sick.half} بنصف راتب`, `+ ${b.sick.half} at half pay`), 'nav-leave', 'cal')}
        ${tile(L('الرصيد التعويضي', 'Compensatory balance'), fmtN(b.comp.available), L('يسقط بعد 10 أيام', 'Expires after 10 days'), 'nav-leave', 'clock')}
        ${tile(L('طلبات قيد الموافقة', 'Requests pending'), fmtN(pend.length), pend.length ? T(LSTATUS[pend[0].status]) : L('لا يوجد', 'None'), 'nav-leave', 'approve')}
      </div>
      <div class="grid g-21">
        <section class="card"><h2>${esc(L('مهامي', 'My tasks'))} <span class="count">${tasks.length}</span></h2>
          <div class="list">${tasks.map((t) => `<div class="list-item">${icon(t.ic)}<div class="grow"><div class="t">${esc(t.t)}</div><div class="subtle">${esc(t.s)}</div></div>${rule(t.r)}${t.act ? `<button class="btn sm" data-act="${t.act}" data-v="${t.v}">${esc(L('فتح', 'Open'))}</button>` : ''}</div>`).join('')}</div>
        </section>
        <section class="card"><h2>${esc(L('مديري المباشر', 'My line manager'))}</h2>
          <div class="list-item" style="border:0">${avatar(mgr)}<div class="grow"><div class="t">${esc(T(mgr.name))}</div><div class="subtle">${esc(T(mgr.position))}</div></div><button class="iconbtn" data-act="decor" title="${esc(L('دردشة', 'Chat'))}">${icon('chat')}</button></div>
          <h2 style="margin-top:12px">${esc(L('العطل القادمة', 'Upcoming holidays'))}</h2>
          <div class="list">${upcoming.map((h) => `<div class="list-item">${icon('cal')}<div class="grow"><div class="t">${esc(T(h))}</div><div class="subtle">${esc(fmtD(h.date))}</div></div></div>`).join('') || `<div class="empty">—</div>`}</div>
        </section>
      </div>
      <section class="card"><div class="card-head"><h2>${esc(L('آخر طلباتي', 'My recent requests'))}</h2><button class="btn subtle sm" data-act="nav" data-v="leave">${esc(L('عرض الكل', 'View all'))}</button></div>${reqTable(myRequests().slice(0, 4), false)}</section>`;
  }

  function reqTable(list, showEmp, actions) {
    if (!list.length) return `<div class="empty">${esc(L('لا توجد طلبات', 'No requests'))}</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>${esc(L('الرقم', 'ID'))}</th>${showEmp ? `<th>${esc(L('الموظف', 'Employee'))}</th>` : ''}<th>${esc(L('النوع', 'Type'))}</th><th>${esc(L('من', 'From'))}</th><th>${esc(L('إلى', 'To'))}</th><th>${esc(L('الأيام', 'Days'))}</th><th>${esc(L('الحالة', 'Status'))}</th>${actions ? '<th></th>' : ''}</tr></thead><tbody>
      ${list.map((r) => { const e = empById.get(r.empId); return `<tr><td class="num">${esc(r.id)}</td>${showEmp ? `<td>${who(e, T(e.position))}</td>` : ''}<td>${esc(T(LEAVE[r.type]))}</td><td>${esc(fmtD(r.from))}</td><td>${esc(fmtD(r.to))}</td><td class="num">${fmtN(r.days)}</td><td>${statusBadge(r.status)}</td>${actions ? `<td>${actions(r)}</td>` : ''}</tr>`; }).join('')}
    </tbody></table></div>`;
  }

  function vEmpLeave() {
    const e = me(); const b = balances(e); const d = S.leaveDraft;
    const v = validateLeave(e, d);
    const canSubmit = d.from && d.to && !v.errors.length && v.days > 0;
    return `
      <div class="page-head"><div><h1>${esc(L('إجازاتي', 'My leave'))}</h1><p>${esc(L('الأرصدة محسوبة وفق سياسات المؤسسة الحالية.', 'Balances are calculated from your organization\'s current policy.'))}</p></div></div>
      <div class="grid g-4 keep2">
        <div class="card balance"><span class="muted">${esc(T(LEAVE.ANNUAL))} ${rule('LV-010')}</span><span class="big">${fmtN(b.annual.available, 2)} <small>${esc(L('يوم متاح', 'days available'))}</small></span>${meter((b.annual.taken / Math.max(b.annual.entitlement, 1)) * 100)}<span class="subtle">${esc(L(`مستحق ${fmtN(b.annual.accrued, 2)} · مأخوذ ${fmtN(b.annual.taken)} · معلّق ${fmtN(b.annual.pending)}`, `Accrued ${fmtN(b.annual.accrued, 2)} · taken ${fmtN(b.annual.taken)} · pending ${fmtN(b.annual.pending)}`))}</span></div>
        <div class="card balance"><span class="muted">${esc(T(LEAVE.SICK))} ${rule('LV-022')}</span><span class="big">${fmtN(b.sick.full)} <small>${esc(L('براتب كامل', 'full pay'))}</small></span>${meter((b.sick.taken / 21) * 100)}<span class="subtle">${esc(L(`+ ${b.sick.half} يوم بنصف راتب`, `+ ${b.sick.half} days at half pay`))}</span></div>
        <div class="card balance"><span class="muted">${esc(T(LEAVE.COMP))} ${rule('LV-081')}</span><span class="big">${fmtN(b.comp.available)} <small>${esc(L('يوم', 'days'))}</small></span><span class="subtle">${esc(L('عن العمل في العطلة المعتمد مسبقاً', 'For pre-approved holiday work'))}</span></div>
        <div class="card balance"><span class="muted">${esc(T(LEAVE.UNPAID))} ${rule('LV-061')}</span><span class="big">${fmtN(b.unpaid.max - b.unpaid.used)} <small>${esc(L('يوم متبقٍ هذا العام', 'days left this year'))}</small></span>${meter((b.unpaid.used / b.unpaid.max) * 100)}</div>
      </div>
      <div class="grid g-12">
        <section class="card"><h2>${esc(L('طلب إجازة جديد', 'New leave request'))}</h2>
          <form class="form-grid" data-form="leave" onsubmit="return false">
            <div class="field full"><label for="lt">${esc(L('نوع الإجازة', 'Leave type'))}</label><select id="lt" class="select" data-bind="type">${leaveTypesFor(e).map((t) => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${esc(T(LEAVE[t]))}</option>`).join('')}</select></div>
            <div class="field"><label for="lf">${esc(L('من', 'From'))}</label><input id="lf" type="date" class="input" data-bind="from" value="${esc(d.from)}"></div>
            <div class="field"><label for="lto">${esc(L('إلى', 'To'))}</label><input id="lto" type="date" class="input" data-bind="to" value="${esc(d.to)}"></div>
            <div class="field full"><label for="lr">${esc(L('ملاحظات (اختياري)', 'Notes (optional)'))}</label><textarea id="lr" class="textarea" data-bind="reason">${esc(d.reason)}</textarea></div>
            <div class="full" id="leave-check">${leaveCheck(v, d)}</div>
            <div class="full btn-row"><button class="btn primary" data-act="submit-leave" ${canSubmit ? '' : 'disabled'} id="leave-submit">${icon('send', 16)}${esc(L('إرسال إلى المدير المباشر', 'Send to line manager'))}</button><span class="subtle">${esc(L('سيصل الطلب كبطاقة موافقة في Teams وOutlook.', 'Arrives as an approval card in Teams and Outlook.'))}</span></div>
          </form>
        </section>
        <section class="card"><h2>${esc(L('سجل الطلبات', 'Request history'))}</h2>${reqTable(myRequests(), false, (r) => (r.status === 'PENDING_MANAGER' ? `<button class="btn sm" data-act="preview-leave" data-id="${r.id}">${icon('teams', 14)}${esc(L('عرض بطاقة المدير', 'Manager\'s card'))}</button>` : ''))}</section>
      </div>`;
  }
  function leaveCheck(v, d) {
    if (!d.from || !d.to) return `<div class="msg info">${icon('info', 16)}<div>${esc(L('اختر التواريخ ليتحقق النظام من الأهلية والرصيد فوراً.', 'Pick dates and the system checks eligibility and balance instantly.'))}</div></div>`;
    return `<div class="subtle" style="margin-bottom:6px">${esc(L(`أيام العمل المحتسبة: ${v.days} (تُستثنى العطل الأسبوعية والرسمية)`, `Working days counted: ${v.days} (weekends and public holidays excluded)`))} ${rule('LV-003')}</div>${msgs(v)}${!v.errors.length && !v.warnings.length && !v.info.length ? `<div class="msg ok">${icon('check', 16)}<div>${esc(L('الطلب مطابق للسياسة.', 'Request complies with policy.'))}</div></div>` : ''}`;
  }

  function vEmpTimesheet() {
    const e = me(); const ts = tsState();
    const y = TODAY.getFullYear(); const m = TODAY.getMonth();
    const first = new Date(y, m, 1); const last = new Date(y, m + 1, 0);
    const myLeave = D.leaveRequests.filter((r) => r.empId === e.id && r.status === 'APPROVED');
    const onLeave = (d) => myLeave.find((r) => parse(r.from) <= d && parse(r.to) >= d);
    const hol = holidaySet();
    let work = 0, lv = 0, hd = 0;
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push('<div class="d blank"></div>');
    for (let d = new Date(first); d <= last; d = addDays(d, 1)) {
      const s = iso(d); const wd = D.POLICY.workWeek.days.includes(DAYNAMES[d.getDay()]);
      let cls = 'd'; let lab = '';
      if (hol.has(s) && wd) { cls += ' hol'; lab = L('عطلة', 'Holiday'); hd++; }
      else if (!wd) { cls += ' off'; lab = L('راحة', 'Off'); }
      else if (onLeave(d)) { cls += ' lv'; lab = L('إجازة', 'Leave'); lv++; }
      else { work++; lab = d <= TODAY ? `${D.POLICY.workWeek.hoursPerDay}h` : ''; if (d.getDate() === 7 && d <= TODAY) { cls += ' late'; lab = L('تأخير', 'Late'); } }
      if (s === D.todayISO) cls += ' today';
      cells.push(`<div class="${cls}"><span class="dn">${d.getDate()}</span><span>${esc(lab)}</span></div>`);
    }
    const total = ts.alloc.reduce((s, a) => s + (Number(a.pct) || 0), 0);
    const ok = total === 100;
    const st = { DRAFT: ['b-neutral', L('مسودة', 'Draft')], SUBMITTED: ['b-warn', L('بانتظار المدير', 'Awaiting manager')], APPROVED: ['b-ok', L('معتمد', 'Approved')] }[ts.status];
    const locked = ts.status !== 'DRAFT';
    const monthName = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(TODAY);
    const grants = D.GRANTS.filter((g) => ['GR-101', 'GR-104', 'GR-105'].includes(g.id));
    return `
      <div class="page-head"><div><h1>${esc(L('كشف الدوام', 'Timesheet'))} · ${esc(monthName)}</h1><p>${esc(L('يُولَّد تلقائياً من الحضور والإجازات المعتمدة والعطل.', 'Generated automatically from attendance, approved leave and holidays.'))} ${rule('TS-001')}</p></div><span class="badge ${st[0]}">${esc(st[1])}</span></div>
      <div class="grid g-21">
        <section class="card"><h2>${esc(L('أيام الشهر', 'Days of the month'))}</h2>
          <div class="cal">${D.POLICY.workWeek.days.length ? DAYNAMES.map((dn) => `<div class="dh">${esc(T(DAYLABEL[dn]))}</div>`).join('') : ''}${cells.join('')}</div>
          <div class="legend" style="margin-top:10px"><span><i style="background:var(--surface)"></i>${esc(L('يوم عمل', 'Work day'))}</span><span><i style="background:var(--brand-bg)"></i>${esc(L('إجازة معتمدة', 'Approved leave'))}</span><span><i style="background:var(--info-bg)"></i>${esc(L('عطلة رسمية', 'Public holiday'))}</span><span><i style="background:var(--warn-bg)"></i>${esc(L('علامة تأخير', 'Late mark'))} ${rule('WT-012')}</span></div>
        </section>
        <section class="card"><h2>${esc(L('الملخص', 'Summary'))}</h2>
          <dl class="kv"><dt>${esc(L('أيام العمل', 'Work days'))}</dt><dd class="num">${work}</dd><dt>${esc(L('أيام الإجازة', 'Leave days'))}</dt><dd class="num">${lv}</dd><dt>${esc(L('العطل الرسمية', 'Public holidays'))}</dt><dd class="num">${hd}</dd><dt>${esc(L('الساعات', 'Hours'))}</dt><dd class="num">${fmtN(work * D.POLICY.workWeek.hoursPerDay)}</dd><dt>${esc(L('علامات التأخير', 'Late marks'))}</dt><dd class="num">${e.lateMarks} / ${D.POLICY.lateMarksThreshold} ${rule('WT-013')}</dd></dl>
        </section>
      </div>
      <section class="card"><div class="card-head"><h2>${esc(L('توزيع الوقت على المنح', 'Time allocation by grant'))} ${rule('TS-002')}</h2><span class="subtle">${esc(L('المجموع يجب أن يساوي 100%', 'Total must equal 100%'))}</span></div>
        <div class="table-wrap"><table><thead><tr><th>${esc(L('المنحة', 'Grant'))}</th><th>${esc(L('المانح', 'Donor'))}</th><th>${esc(L('النسبة %', 'Percent %'))}</th><th>${esc(L('الساعات', 'Hours'))}</th></tr></thead><tbody>
          ${grants.map((g) => { const a = ts.alloc.find((x) => x.grant === g.id); const pct = a ? a.pct : 0; return `<tr><td><b>${esc(g.id)}</b> · ${esc(T(g))}</td><td>${esc(T(g.donor))}</td><td><input type="number" min="0" max="100" step="5" class="input num" style="width:96px" data-ts-grant="${g.id}" value="${pct}" ${locked ? 'disabled' : ''} aria-label="${esc(g.id)}"></td><td class="num">${fmtN((work * D.POLICY.workWeek.hoursPerDay * pct) / 100, 1)}</td></tr>`; }).join('')}
          <tr><td colspan="2"><b>${esc(L('المجموع', 'Total'))}</b></td><td class="num"><b id="ts-total">${total}%</b></td><td></td></tr>
        </tbody></table></div>
        <div style="margin-top:12px" class="msgs" id="ts-msg">${ok ? `<div class="msg ok">${icon('check', 16)}<div>${esc(L('التوزيع صحيح.', 'Allocation is valid.'))}</div></div>` : `<div class="msg bad">${icon('warn', 16)}<div>${esc(L(`المجموع ${total}%، ويجب أن يساوي 100% قبل التسليم.`, `Total is ${total}%; it must equal 100% before submitting.`))} ${rule('TS-002')}</div></div>`}
          <div class="msg info">${icon('info', 16)}<div>${esc(L('لا يُصرف راتب شهر دون كشف دوام معتمد.', 'Salary is not released for a month without an approved timesheet.'))} ${rule('TS-005')}</div></div></div>
        <div class="btn-row" style="margin-top:12px">
          ${ts.status === 'DRAFT' ? `<button class="btn primary" data-act="ts-submit" id="ts-submit" ${ok ? '' : 'disabled'}>${icon('send', 16)}${esc(L('تسليم للمدير المباشر', 'Submit to line manager'))}</button>` : ''}
          ${ts.status === 'SUBMITTED' ? `<button class="btn" data-act="ts-approve">${icon('teams', 16)}${esc(L('محاكاة اعتماد المدير من Teams', 'Simulate manager approval in Teams'))}</button>` : ''}
          ${ts.status !== 'DRAFT' ? `<button class="btn subtle" data-act="ts-reopen">${esc(L('طلب إعادة فتح', 'Request reopen'))}</button> ${rule('TS-007')}` : ''}
        </div>
      </section>`;
  }

  function vEmpPay() {
    const e = me();
    const months = [1, 2, 3].map((k) => new Date(TODAY.getFullYear(), TODAY.getMonth() - k, 1));
    const sel = months[0];
    const unpaid = 0; const daily = e.baseSalary / D.POLICY.workingDaysPerMonth;
    const tax = Math.round(e.baseSalary * 0.05);
    const net = e.baseSalary - tax - unpaid * daily;
    const mName = (d) => new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(d);
    return `
      <div class="page-head"><div><h1>${esc(L('قسائم الراتب', 'Payslips'))}</h1><p>${esc(L('تُصرف الرواتب قبل اليوم 5 من الشهر التالي.', 'Salaries are paid by the 5th of the following month.'))} ${rule('CP-003')}</p></div></div>
      <div class="grid g-12">
        <section class="card"><h2>${esc(L('الفترات', 'Periods'))}</h2><div class="list">${months.map((d, i) => `<div class="list-item">${icon('doc')}<div class="grow"><div class="t">${esc(mName(d))}</div><div class="subtle">${esc(L('تحويل بنكي', 'Bank transfer'))}</div></div>${i === 0 ? badge('b-brand', L('معروضة', 'Shown')) : ''}</div>`).join('')}</div></section>
        <section class="card"><div class="card-head"><h2>${esc(mName(sel))}</h2>${badge('b-neutral', L('نموذج توضيحي', 'Illustrative'))}</div>
          <div class="table-wrap"><table><tbody>
            <tr><td>${esc(L('الراتب الأساسي', 'Base salary'))}</td><td class="num" style="text-align:end">${money(e.baseSalary)}</td></tr>
            <tr><td>${esc(L('أيام بدون راتب', 'Unpaid days'))} ${rule('WT-014')}</td><td class="num" style="text-align:end">− ${money(unpaid * daily)}</td></tr>
            <tr><td>${esc(L('ضريبة الدخل (من نظام الرواتب)', 'Income tax (from payroll system)'))}</td><td class="num" style="text-align:end">− ${money(tax)}</td></tr>
            <tr><td><b>${esc(L('صافي الراتب', 'Net pay'))}</b></td><td class="num" style="text-align:end"><b>${money(net)}</b></td></tr>
          </tbody></table></div>
          <div class="msg info" style="margin-top:12px">${icon('info', 16)}<div>${esc(L('لديك 5 أيام عمل للاستفسار عن القسيمة، و7 أيام للاعتراض على أي خصم.', 'You have 5 working days to query a payslip and 7 days to dispute a deduction.'))} ${rule('CP-006')} ${rule('CP-007')}</div></div>
          <div class="btn-row" style="margin-top:12px"><button class="btn" data-act="toast" data-msg="${esc(L('تم إرسال استفسارك إلى الموارد البشرية والمالية.', 'Your query was sent to HR and Finance.'))}">${esc(L('استفسار عن القسيمة', 'Query this payslip'))}</button></div>
        </section>
      </div>`;
  }

  function vEmpPolicies() {
    const e = me();
    return `
      <div class="page-head"><div><h1>${esc(L('السياسات والإقرارات', 'Policies & acknowledgements'))}</h1><p>${esc(L('يُطلب الإقرار من جديد عند صدور إصدار جديد من أي سياسة.', 'You are asked again whenever a policy has a new version.'))} ${rule('ON-004')}</p></div></div>
      <section class="card"><div class="list">${D.POLICIES.map((p) => { const missing = e.ackMissing.includes(p.code); return `<div class="list-item">${icon('doc')}<div class="grow"><div class="t">${esc(T(p))}</div><div class="subtle">${esc(L(`الإصدار ${p.v}`, `Version ${p.v}`))}</div></div>${missing ? `${badge('b-warn', L('بانتظار إقرارك', 'Awaiting your acknowledgement'), 'clock')}<button class="btn primary sm" data-act="ack-open" data-id="${p.code}">${esc(L('قراءة وإقرار', 'Read & acknowledge'))}</button>` : badge('b-ok', L('تم الإقرار', 'Acknowledged'), 'check')}</div>`; }).join('')}</div></section>
      <section class="card"><h2>${icon('shield')} ${esc(L('قناة البلاغات المستقلة', 'Independent reporting channel'))}</h2><p class="muted" style="margin:0">${esc(L('للإبلاغ عن التحرش أو الاحتيال أو الاستغلال بسرية تامة، ويمكن الإبلاغ دون ذكر الاسم. لا يستقبل هذا النظام البلاغات حمايةً لسريتها.', 'Report harassment, fraud or exploitation confidentially, anonymously if you wish. This system does not collect reports, to protect their confidentiality.'))} ${rule('CC-002')}</p><div class="btn-row" style="margin-top:12px"><button class="btn" data-act="toast" data-msg="${esc(L('في النسخة الفعلية يفتح هذا رابط قناة البلاغات الخاصة بمؤسستك.', 'In production this opens your organization\'s reporting channel.'))}">${esc(L('فتح قناة البلاغات', 'Open reporting channel'))}</button></div></section>`;
  }

  function vEmpProfile() {
    const e = me(); const mgr = empById.get(e.managerId);
    return `
      <div class="page-head"><div style="display:flex;gap:12px;align-items:center">${avatar(e, 'lg')}<div><h1>${esc(T(e.name))}</h1><p>${esc(`${e.staffNo} · ${T(e.position)}`)}</p></div></div><button class="btn" data-act="toast" data-msg="${esc(L('أُرسل طلب التحديث للموارد البشرية للتحقق.', 'Update request sent to HR for verification.'))}">${esc(L('طلب تحديث البيانات', 'Request data update'))}</button></div>
      <div class="grid g-2">
        <section class="card"><h2>${esc(L('بيانات التوظيف', 'Employment'))}</h2><dl class="kv">
          <dt>${esc(L('القسم', 'Department'))}</dt><dd>${esc(T(e.deptName))}</dd><dt>${esc(L('موقع العمل', 'Duty station'))}</dt><dd>${esc(officeName(e.office))}</dd>
          <dt>${esc(L('الفئة', 'Category'))}</dt><dd>${esc(T(CAT[e.category]))}</dd><dt>${esc(L('الدرجة', 'Grade'))}</dt><dd>G${e.grade}</dd>
          <dt>${esc(L('تاريخ التعيين', 'Hire date'))}</dt><dd>${esc(fmtD(e.hireDate))}</dd><dt>${esc(L('نهاية العقد', 'Contract end'))}</dt><dd>${esc(fmtD(e.contractEnd))}</dd>
          <dt>${esc(L('المدير المباشر', 'Line manager'))}</dt><dd>${esc(T(mgr.name))}</dd><dt>${esc(L('آخر تقييم', 'Last rating'))}</dt><dd>${esc(T(RATING[e.rating]))}</dd></dl></section>
        <section class="card"><h2>${esc(L('البيانات الشخصية', 'Personal data'))}</h2><dl class="kv">
          <dt>${esc(L('البريد', 'E-mail'))}</dt><dd style="direction:ltr;text-align:start">${esc(e.email)}</dd><dt>${esc(L('الهاتف', 'Phone'))}</dt><dd class="num" style="direction:ltr;text-align:start">${esc(e.phone)}</dd>
          <dt>${esc(L('جهة اتصال للطوارئ', 'Emergency contact'))}</dt><dd>${esc(L('مسجّلة', 'On file'))}</dd><dt>${esc(L('المعالون', 'Dependants'))}</dt><dd>2</dd></dl>
          <div class="msg info" style="margin-top:12px">${icon('info', 16)}<div>${esc(L('حدّث بياناتك خلال 30 يوماً من أي تغيير.', 'Update your data within 30 days of any change.'))} ${rule('RD-002')}</div></div></section>
      </div>`;
  }

  // ======================================================================
  // HR views
  // ======================================================================
  const active = () => D.employees;
  const probEnding = () => active().filter((e) => e.inProbation && daysBetween(D.todayISO, e.probationEnd) >= 0 && daysBetween(D.todayISO, e.probationEnd) <= 14).sort((a, b) => (a.probationEnd > b.probationEnd ? 1 : -1));
  const contractsEnding = (days) => active().filter((e) => { const x = daysBetween(D.todayISO, e.contractEnd); return x >= 0 && x <= days; }).sort((a, b) => (a.contractEnd > b.contractEnd ? 1 : -1));
  const lateCases = () => active().filter((e) => e.lateMarks >= D.POLICY.lateMarksThreshold);
  const missingAck = () => active().filter((e) => e.ackMissing.length);

  function vHrDash() {
    const pe = probEnding(); const ce = contractsEnding(30);
    const byOffice = D.OFFICES.map((o) => ({ label: T(o), value: active().filter((e) => e.office === o.id).length })).sort((a, b) => b.value - a.value);
    const byCat = Object.keys(CAT).map((c) => ({ label: T(CAT[c]), value: active().filter((e) => e.category === c).length }));
    const pendHR = D.leaveRequests.filter((r) => r.status === 'PENDING_HR').length;
    return `
      <div class="page-head"><div><h1>${esc(L('لوحة متابعة الموارد البشرية', 'HR dashboard'))}</h1><p>${esc(`${T(D.ORG)} · ${fmtD(D.todayISO)}`)}</p></div><div class="btn-row"><button class="btn" data-act="nav" data-v="recruitment">${icon('brief', 16)}${esc(L('نشر وظيفة', 'Post vacancy'))}</button><button class="btn primary" data-act="nav" data-v="employees">${icon('people', 16)}${esc(L('سجل الموظفين', 'Open register'))}</button></div></div>
      <div class="grid g-4 keep2">
        ${tile(L('إجمالي الموظفين', 'Total staff'), fmtN(active().length), L(`${active().filter((e) => e.category === 'REGULAR').length} دائم`, `${active().filter((e) => e.category === 'REGULAR').length} regular`), 'nav-employees', 'people')}
        ${tile(L('تنتهي تجربتهم خلال 14 يوماً', 'Probation ending ≤ 14 days'), fmtN(pe.length), rule('LC-006'), null, 'clock')}
        ${tile(L('عقود تنتهي خلال 30 يوماً', 'Contracts ending ≤ 30 days'), fmtN(ce.length), rule('LC-040'), null, 'doc')}
        ${tile(L('إجازات بانتظار الموارد البشرية', 'Leave awaiting HR'), fmtN(pendHR), rule('LV-001'), 'nav-leave', 'cal')}
        ${tile(L('بلغوا حد التأخير', 'Reached late-mark threshold'), fmtN(lateCases().length), rule('WT-013'), null, 'warn')}
        ${tile(L('إقرارات ناقصة', 'Missing acknowledgements'), fmtN(missingAck().length), rule('ON-003'), 'nav-compliance', 'shield')}
        ${tile(L('فحص امتثال مستحق', 'Screening due'), fmtN(active().filter((e) => e.screening !== 'CLEARED').length), rule('CC-005'), 'nav-compliance', 'shield')}
        ${tile(L('وظائف شاغرة مفتوحة', 'Open vacancies'), fmtN(D.vacancies.length), L(`${D.candidates.length} مرشحاً`, `${D.candidates.length} candidates`), 'nav-recruitment', 'brief')}
      </div>
      <div class="grid g-2">
        <section class="card"><h2>${esc(L('فترات تجربة تنتهي قريباً', 'Probation ending soon'))} <span class="count">${pe.length}</span></h2>${empMiniTable(pe, (e) => fmtD(e.probationEnd), (e) => `<button class="btn sm" data-act="toast" data-msg="${esc(L(`أُرسل تقييم التجربة إلى مدير ${T(e.name.short)} عبر Teams.`, `Probation appraisal sent to ${T(e.name.short)}'s manager in Teams.`))}">${esc(L('بدء التقييم', 'Start appraisal'))}</button>`)}</section>
        <section class="card"><h2>${esc(L('عقود تنتهي خلال 30 يوماً', 'Contracts ending in 30 days'))} <span class="count">${ce.length}</span></h2>${empMiniTable(ce.slice(0, 8), (e) => fmtD(e.contractEnd), (e) => `<button class="btn sm" data-act="toast" data-msg="${esc(L('أُنشئ طلب تجديد عقد كتغيير حالة.', 'Contract renewal created as a change of status.'))}">${esc(L('تجديد', 'Renew'))}</button>`)}</section>
      </div>
      <div class="grid g-2">
        <section class="card"><h2>${esc(L('الموظفون حسب المكتب', 'Staff by office'))}</h2>${bars(byOffice, { title: L('الموظفون حسب المكتب', 'Staff by office') })}</section>
        <section class="card"><h2>${esc(L('الموظفون حسب فئة التوظيف', 'Staff by employment category'))}</h2>${bars(byCat, { title: L('حسب الفئة', 'By category') })}</section>
      </div>
      <div class="grid g-2">
        <section class="card"><h2>${esc(L('إجراءات سريعة', 'Quick actions'))}</h2><div class="quick">${[['brief', L('نشر وظيفة شاغرة', 'Post a vacancy'), 'nav', 'recruitment'], ['cal', L('مراجعة طلبات الإجازة', 'Review leave requests'), 'nav', 'leave'], ['download', L('تصدير مدخلات الرواتب', 'Export payroll inputs'), 'toast', L('صُدّرت مدخلات رواتب الشهر للمالية (محاكاة).', 'Monthly payroll inputs exported to Finance (simulated).')], ['teams', L('تذكير الإقرارات الناقصة', 'Remind missing acknowledgements'), 'remind-acks', '']].map(([ic, l, act, x]) => `<button data-act="${act}" ${act === 'nav' ? `data-v="${x}"` : act === 'toast' ? `data-msg="${esc(x)}"` : ''}><span class="qi">${icon(ic, 16)}</span><span>${esc(l)}</span></button>`).join('')}</div></section>
        <section class="card"><div class="card-head"><h2>${esc(L('آخر النشاطات', 'Recent activity'))}</h2><button class="btn subtle sm" data-act="activity">${esc(L('عرض الكل', 'View all'))}</button></div><div class="list">${D.activity.slice(0, 5).map((a) => `<div class="list-item">${icon(a.ch === 'outlook' ? 'mail' : 'teams')}<div class="grow"><div class="t" style="font-weight:400">${esc(T(a))}</div><div class="subtle">${esc(`${a.ch === 'outlook' ? 'Outlook' : 'Teams'} · ${fmtD(a.at)}`)}</div></div></div>`).join('')}</div></section>
      </div>`;
  }
  function empMiniTable(list, dateFn, actFn) {
    if (!list.length) return `<div class="empty">${esc(L('لا يوجد', 'None'))}</div>`;
    return `<div class="table-wrap"><table><tbody>${list.map((e) => `<tr class="clickable" data-act="emp" data-id="${e.id}"><td>${who(e, T(e.position))}</td><td class="hide-sm">${esc(officeName(e.office))}</td><td>${esc(dateFn(e))}</td><td style="text-align:end">${actFn(e)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function flagList(e) {
    const f = [];
    if (e.inProbation) f.push(['b-info', L('تجربة', 'Probation')]);
    if (daysBetween(D.todayISO, e.contractEnd) <= 30) f.push(['b-warn', L('عقد ينتهي', 'Contract ending')]);
    if (e.lateMarks >= D.POLICY.lateMarksThreshold) f.push(['b-warn', L('تأخير', 'Lateness')]);
    if (e.screening !== 'CLEARED') f.push(['b-bad', L('فحص', 'Screening')]);
    if (e.ackMissing.length) f.push(['b-neutral', L('إقرار', 'Ack')]);
    return f;
  }
  function flags(e) { const f = flagList(e); return `<div class="btn-row" style="gap:4px;flex-wrap:nowrap">${f.map(([c, l]) => badge(c, l)).join('') || '<span class="subtle">—</span>'}</div>`; }
  function dirFiltered() {
    const f = S.dir; const q = f.q.trim().toLowerCase(); const qr = f.q.trim();
    const list = active().filter((e) => (!f.office || e.office === f.office) && (!f.dept || e.dept === f.dept) && (!f.cat || e.category === f.cat) &&
      (!f.flag || (f.flag === 'probation' && e.inProbation) || (f.flag === 'contracts' && daysBetween(D.todayISO, e.contractEnd) <= 60) || (f.flag === 'flags' && flagList(e).length)) &&
      (!q || e.name.en.toLowerCase().includes(q) || e.name.ar.includes(qr) || e.staffNo.toLowerCase().includes(q) || e.position.en.toLowerCase().includes(q) || e.position.ar.includes(qr)));
    const k = f.sort.k; const d = f.sort.dir;
    const val = (e) => (k === 'name' ? T(e.name) : k === 'position' ? T(e.position) : k === 'dept' ? T(e.deptName) : k === 'office' ? officeName(e.office) : k === 'cat' ? T(CAT[e.category]) : e.hireDate);
    return list.sort((a, b) => val(a).localeCompare(val(b), S.lang) * d);
  }
  function dirTable() {
    const f = S.dir; const list = dirFiltered(); const per = f.per; const pages = Math.max(1, Math.ceil(list.length / per));
    f.page = Math.min(f.page, pages);
    const start = (f.page - 1) * per; const rows = list.slice(start, start + per);
    const allSel = rows.length > 0 && rows.every((e) => f.sel.includes(e.id));
    const someSel = rows.some((e) => f.sel.includes(e.id));
    const th = (k, ar, en, cls = '') => `<th class="${cls}" aria-sort="${f.sort.k === k ? (f.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button class="th-sort" data-act="sort" data-v="${k}">${esc(L(ar, en))}${icon(f.sort.k === k ? (f.sort.dir > 0 ? 'sortUp' : 'sortDown') : 'sort', 14)}</button></th>`;
    const bulk = f.sel.length ? `<div class="bulkbar" role="region" aria-label="${esc(L('إجراءات جماعية', 'Bulk actions'))}"><span><b class="num">${f.sel.length}</b> ${esc(L('محدد', 'selected'))}</span>
      <button class="btn sm secondary" data-act="bulk" data-v="remind">${icon('teams', 14)}${esc(L('تذكير عبر Teams', 'Remind in Teams'))}</button>
      <button class="btn sm secondary" data-act="bulk" data-v="training">${icon('flag', 14)}${esc(L('تسجيل في تدريب', 'Enrol in training'))}</button>
      <button class="btn sm secondary" data-act="bulk" data-v="export">${icon('download', 14)}${esc(L('تصدير المحدد', 'Export selected'))}</button>
      <button class="btn sm subtle" data-act="bulk" data-v="clear">${esc(L('إلغاء التحديد', 'Clear'))}</button></div>` : '';
    if (!list.length) return emptyState('search', L('لا توجد نتائج', 'No matching employees'), L('جرّب تغيير البحث أو الفلاتر.', 'Try changing the search or filters.'), `<button class="btn sm" data-act="dir-clear">${esc(L('مسح الفلاتر', 'Clear filters'))}</button>`);
    const nums = []; const lo = Math.max(1, Math.min(f.page - 2, pages - 4)); for (let i = lo; i <= Math.min(pages, lo + 4); i++) nums.push(i);
    return `${bulk}<div class="table-wrap"><table><thead><tr>
        <th class="cb"><input type="checkbox" class="cbx" data-act="sel-page" ${allSel ? 'checked' : ''} ${!allSel && someSel ? 'data-indeterminate="1"' : ''} aria-label="${esc(L('تحديد الصفحة', 'Select page'))}"></th>
        ${th('name', 'الموظف', 'Employee')}${th('position', 'الوظيفة', 'Position')}${th('dept', 'القسم', 'Department', 'hide-sm')}${th('office', 'المكتب', 'Office', 'hide-sm')}${th('cat', 'الفئة', 'Category')}${th('hire', 'تاريخ التعيين', 'Hire date', 'hide-sm')}<th>${esc(L('تنبيهات', 'Flags'))}</th><th class="actions"><span class="sr-only">${esc(L('إجراءات', 'Actions'))}</span></th></tr></thead><tbody>
      ${rows.map((e) => { const sel = f.sel.includes(e.id); return `<tr class="clickable ${sel ? 'selected' : ''}" data-act="emp" data-id="${e.id}"><td class="cb"><input type="checkbox" class="cbx" data-act="sel-row" data-id="${e.id}" ${sel ? 'checked' : ''} aria-label="${esc(T(e.name))}"></td><td>${who(e, e.staffNo)}</td><td>${esc(T(e.position))}</td><td class="hide-sm">${esc(T(e.deptName))}</td><td class="hide-sm">${esc(officeName(e.office))}</td><td>${badge('b-neutral', T(CAT[e.category]))}</td><td class="hide-sm num">${esc(fmtD(e.hireDate))}</td><td>${flags(e)}</td><td class="actions"><button class="iconbtn sm" data-act="row-menu" data-id="${e.id}" aria-haspopup="menu" aria-label="${esc(L('مزيد من الإجراءات', 'More actions'))}">${icon('more', 16)}</button></td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="pager"><div class="pager-l"><label>${esc(L('صفوف لكل صفحة', 'Rows per page'))} <select class="select sm" data-dir="per">${[10, 20, 50].map((n) => `<option ${n === per ? 'selected' : ''}>${n}</option>`).join('')}</select></label><span class="num">${fmtN(start + 1)}–${fmtN(Math.min(start + per, list.length))} ${esc(L('من', 'of'))} ${fmtN(list.length)}</span></div>
      <div class="pager-r"><button class="iconbtn sm" data-act="page" data-v="-1" ${f.page <= 1 ? 'disabled' : ''} aria-label="${esc(L('السابق', 'Previous'))}"><span class="flip-rtl" style="display:grid">${icon('chevL', 16)}</span></button>${nums.map((i) => `<button class="pg" data-act="page-go" data-v="${i}" ${i === f.page ? 'aria-current="page"' : ''}>${fmtN(i)}</button>`).join('')}<button class="iconbtn sm" data-act="page" data-v="1" ${f.page >= pages ? 'disabled' : ''} aria-label="${esc(L('التالي', 'Next'))}"><span class="flip-rtl" style="display:grid">${icon('chevR', 16)}</span></button></div></div>`;
  }
  function refreshDir() { const el = document.getElementById('dir-table'); if (el) { el.innerHTML = dirTable(); syncIndeterminate(); } }
  function syncIndeterminate() { document.querySelectorAll('[data-indeterminate]').forEach((x) => { x.indeterminate = true; }); }
  function vHrEmployees() {
    const f = S.dir;
    const chips = [['', 'الكل', 'All'], ['probation', 'في فترة التجربة', 'On probation'], ['contracts', 'عقود تنتهي ≤ 60 يوماً', 'Contracts ≤ 60 days'], ['flags', 'بحاجة لمتابعة', 'Needs attention']];
    return `
      <div class="page-head"><div><h1>${esc(L('سجل الموظفين', 'Employees'))}</h1><p>${esc(L('السجل الموحّد للموظفين مع الفرز والتصفية والإجراءات الجماعية.', 'Unified staff register with sorting, filtering and bulk actions.'))}</p></div>
        <div class="btn-row"><button class="btn" data-act="bulk" data-v="export-all" id="export-btn">${icon('download', 16)}${esc(L('تصدير', 'Export'))}</button><button class="btn primary" data-act="toast" data-msg="${esc(L('في النسخة الفعلية يفتح نموذج تعيين جديد يبدأ من طلب احتياج معتمد.', 'In production this opens a new-hire form that starts from an approved requisition.'))}">${icon('plus', 16)}${esc(L('إضافة موظف', 'Add employee'))}</button></div></div>
      <section class="card flush">
        <div class="table-toolbar">
          <div class="seg" role="group" aria-label="${esc(L('عرض', 'View'))}">${chips.map(([k, ar, en]) => `<button aria-pressed="${f.flag === k}" data-act="nav-sub" data-v="employees" data-k="${k}">${esc(L(ar, en))}</button>`).join('')}</div>
          <div class="toolbar">
            <label class="search-inline">${icon('search', 14)}<input type="search" class="input" placeholder="${esc(L('بحث بالاسم أو الرقم أو الوظيفة', 'Search name, number, position'))}" value="${esc(f.q)}" data-dir="q" aria-label="${esc(L('بحث', 'Search'))}"></label>
            <select class="select" data-dir="office" aria-label="${esc(L('المكتب', 'Office'))}"><option value="">${esc(L('كل المكاتب', 'All offices'))}</option>${D.OFFICES.map((o) => `<option value="${o.id}" ${f.office === o.id ? 'selected' : ''}>${esc(T(o))}</option>`).join('')}</select>
            <select class="select" data-dir="dept" aria-label="${esc(L('القسم', 'Department'))}"><option value="">${esc(L('كل الأقسام', 'All departments'))}</option>${D.DEPTS.map((o) => `<option value="${o.id}" ${f.dept === o.id ? 'selected' : ''}>${esc(T(o))}</option>`).join('')}</select>
            <select class="select" data-dir="cat" aria-label="${esc(L('الفئة', 'Category'))}"><option value="">${esc(L('كل الفئات', 'All categories'))}</option>${Object.keys(CAT).map((c) => `<option value="${c}" ${f.cat === c ? 'selected' : ''}>${esc(T(CAT[c]))}</option>`).join('')}</select>
          </div>
        </div>
        <div id="dir-table">${dirTable()}</div>
      </section>`;
  }

  function vHrLeave() {
    const q = D.leaveRequests.filter((r) => r.status === 'PENDING_HR');
    S.hrSel = S.hrSel.filter((id) => q.some((r) => r.id === id));
    const waiting = D.leaveRequests.filter((r) => r.status === 'PENDING_MANAGER');
    const recent = D.leaveRequests.filter((r) => ['APPROVED', 'REJECTED', 'PENDING_CD'].includes(r.status)).sort((a, b) => (a.submitted < b.submitted ? 1 : -1)).slice(0, 8);
    const allSel = q.length > 0 && q.every((r) => S.hrSel.includes(r.id));
    const rows = q.map((r) => {
      const e = empById.get(r.empId); const v = validateLeave(e, r, r.id); const sel = S.hrSel.includes(r.id);
      return `<tr class="${sel ? 'selected' : ''}"><td class="cb"><input type="checkbox" class="cbx" data-act="hr-sel" data-id="${r.id}" ${sel ? 'checked' : ''} aria-label="${esc(r.id)}"></td><td class="num">${esc(r.id)}</td><td>${who(e, T(e.position))}</td><td>${esc(T(LEAVE[r.type]))}</td><td class="hide-sm">${esc(fmtD(r.from))} – ${esc(fmtD(r.to))}</td><td class="num">${fmtN(r.days)}</td><td>${v.errors.length ? badge('b-bad', L(`${v.errors.length} مخالفة`, `${v.errors.length} issue(s)`), 'warn') : badge('b-ok', L('مطابق', 'Compliant'), 'check')}</td><td style="text-align:end"><div class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn primary sm" data-act="hr-approve" data-id="${r.id}">${esc(L('اعتماد', 'Approve'))}</button><button class="btn sm danger" data-act="hr-reject" data-id="${r.id}">${esc(L('رفض', 'Reject'))}</button></div></td></tr>`;
    }).join('');
    return `
      <div class="page-head"><div><h1>${esc(L('طلبات الإجازة', 'Leave requests'))}</h1><p>${esc(L('المسار: المدير المباشر ← الموارد البشرية (والمدير القُطري للإجازة بدون راتب).', 'Route: line manager → HR (and Country Director for leave without pay).'))} ${rule('LV-001')} ${rule('LV-063')}</p></div></div>
      <section class="card flush">
        <div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('بانتظار اعتمادك', 'Awaiting your approval'))} <span class="subtle">${q.length}</span></h2></div>
        ${S.hrSel.length ? `<div class="bulkbar"><span><b class="num">${S.hrSel.length}</b> ${esc(L('محدد', 'selected'))}</span><button class="btn sm primary" data-act="hr-bulk-approve">${icon('check', 14)}${esc(L('اعتماد المحدد', 'Approve selected'))}</button><button class="btn sm subtle" data-act="hr-sel-clear">${esc(L('إلغاء التحديد', 'Clear'))}</button></div>` : ''}
        ${q.length ? `<div class="table-wrap"><table><thead><tr><th class="cb"><input type="checkbox" class="cbx" data-act="hr-sel-all" ${allSel ? 'checked' : ''} aria-label="${esc(L('تحديد الكل', 'Select all'))}"></th><th>${esc(L('الرقم', 'ID'))}</th><th>${esc(L('الموظف', 'Employee'))}</th><th>${esc(L('النوع', 'Type'))}</th><th class="hide-sm">${esc(L('الفترة', 'Period'))}</th><th>${esc(L('الأيام', 'Days'))}</th><th>${esc(L('فحص السياسة', 'Policy check'))}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState('check', L('لا توجد طلبات معلّقة', 'You are all caught up'), L('ستظهر هنا الطلبات بعد موافقة المدير المباشر.', 'Requests appear here after line-manager approval.'))}
      </section>
      <div class="grid g-2">
        <section class="card"><h2>${esc(L('بانتظار المدير المباشر', 'With line managers'))} <span class="count">${waiting.length}</span></h2>${reqTable(waiting.slice(0, 8), true)}</section>
        <section class="card"><h2>${esc(L('آخر القرارات', 'Recent decisions'))}</h2>${reqTable(recent, true)}</section>
      </div>`;
  }

  function gate(c) { // what blocks moving the candidate forward (RC rules)
    const next = D.STAGES[D.STAGES.indexOf(c.stage) + 1];
    if (c.stage === 'INTERVIEW' && c.score == null) return R('RC-008', 'يجب تسجيل نتيجة المقابلة.', 'Interview score must be recorded.');
    if (c.stage === 'EVALUATION' && c.evals.submitted < c.evals.required) return R('RC-008', `نماذج التقييم ${c.evals.submitted}/${c.evals.required}: كل عضو في اللجنة يجب أن يقدّم نموذجه.`, `Evaluations ${c.evals.submitted}/${c.evals.required}: every panel member must submit a form.`);
    if (c.stage === 'SCREENING' && c.refs < 2) return R('RC-014', `المراجع ${c.refs}/2.`, `References ${c.refs}/2.`);
    if (c.stage === 'SCREENING' && c.screening !== 'CLEARED') return R('RC-015', 'لا يصدر عرض قبل اجتياز فحص الامتثال.', 'No offer before compliance screening is cleared.');
    if (!next) return null;
    return null;
  }
  function vHrRecruit() {
    const v = D.vacancies.find((x) => x.id === S.vacancy) || D.vacancies[0];
    const cands = D.candidates.filter((c) => c.vacancy === v.id);
    const scr = { NOT_STARTED: ['b-neutral', L('لم يبدأ', 'Not started')], PENDING: ['b-warn', L('قيد الفحص', 'Pending')], CLEARED: ['b-ok', L('مُجاز', 'Cleared')], ESCALATED: ['b-bad', L('مُصعَّد', 'Escalated')] };
    const card = (c) => {
      const g = gate(c); const isLast = c.stage === 'OFFER';
      return `<div class="cand"><div class="t">${esc(T(c.name))}</div>
        <div class="row">${c.score != null ? badge('b-brand', L(`النتيجة ${c.score}`, `Score ${c.score}`)) : ''}${c.internal ? badge('b-info', L('داخلي', 'Internal')) : ''}<span class="subtle">${esc(L(`${c.years} سنوات خبرة`, `${c.years} yrs exp.`))}</span></div>
        ${['EVALUATION', 'SCREENING', 'OFFER'].includes(c.stage) ? `<div class="row subtle">${esc(L(`التقييمات ${c.evals.submitted}/${c.evals.required} · المراجع ${c.refs}/2`, `Evals ${c.evals.submitted}/${c.evals.required} · refs ${c.refs}/2`))}</div>` : ''}
        ${['SCREENING', 'OFFER'].includes(c.stage) ? `<div class="row"><span class="subtle">${esc(L('فحص الامتثال:', 'Screening:'))}</span>${badge(scr[c.screening][0], scr[c.screening][1])}</div>` : ''}
        ${g ? `<div class="msg warn" style="padding:6px 8px">${icon('lock', 14)}<div>${esc(T(g))} ${rule(g.rule)}</div></div>` : ''}
        <div class="row">
          ${c.stage === 'SCREENING' && c.screening === 'PENDING' ? `<button class="btn sm" data-act="screen" data-id="${c.id}">${esc(L('تسجيل نتيجة الفحص', 'Record screening result'))}</button>` : ''}
          ${c.stage === 'EVALUATION' && c.evals.submitted < c.evals.required ? `<button class="btn sm" data-act="remind-panel" data-id="${c.id}">${icon('teams', 14)}${esc(L('تذكير اللجنة', 'Remind panel'))}</button>` : ''}
          ${!isLast ? `<button class="btn sm primary" data-act="advance" data-id="${c.id}" ${g ? 'disabled' : ''}>${esc(L('نقل للمرحلة التالية', 'Move forward'))}</button>` : `<button class="btn sm primary" data-act="to-cd" data-id="${c.id}" ${c.sentToCd ? 'disabled' : ''}>${icon('send', 14)}${esc(c.sentToCd ? L('أُرسل للاعتماد', 'Sent for approval') : L('إرسال للمدير القُطري', 'Send to Country Director'))}</button>`}
        </div></div>`;
    };
    return `
      <div class="page-head"><div><h1>${esc(L('التوظيف', 'Recruitment'))}</h1><p>${esc(L('النظام يمنع تجاوز أي خطوة إلزامية في مسار الاختيار.', 'The system blocks skipping any mandatory selection step.'))}</p></div></div>
      <div class="seg" role="group" aria-label="${esc(L('الوظائف الشاغرة', 'Vacancies'))}" style="flex-wrap:wrap;width:max-content;max-width:100%">${D.vacancies.map((x) => `<button aria-pressed="${x.id === v.id}" data-act="vac" data-v="${x.id}">${esc(x.id)} · ${esc(T(x))}</button>`).join('')}</div>
      <section class="card"><div class="card-head"><h2>${esc(T(v))} <span class="count">${esc(`${officeName(v.office)} · G${v.grade}`)}</span></h2><span class="subtle">${esc(L(`يُغلق ${fmtD(v.closes)} · لجنة من 3 أعضاء`, `Closes ${fmtD(v.closes)} · 3-member panel`))} ${rule('RC-007')}</span></div>
        <div class="kanban">${D.STAGES.map((s) => { const cs = cands.filter((c) => c.stage === s); return `<div class="lane"><h3><span>${esc(T(STAGE[s]))}</span><span>${cs.length}</span></h3>${cs.map(card).join('') || `<div class="subtle" style="text-align:center;padding:12px">—</div>`}</div>`; }).join('')}</div>
      </section>`;
  }

  function complianceBody(readOnly) {
    const n = active().length;
    const perPolicy = D.POLICIES.map((p) => { const miss = active().filter((e) => e.ackMissing.includes(p.code)).length; return { p, pct: ((n - miss) / n) * 100, miss }; });
    const scr = { CLEARED: active().filter((e) => e.screening === 'CLEARED').length, DUE: active().filter((e) => e.screening === 'DUE').length, ESCALATED: active().filter((e) => e.screening === 'ESCALATED').length };
    const tr = D.TRAININGS.map((t) => { const done = active().filter((e) => e.trainingsDone.includes(t.code)).length; return { t, pct: (done / n) * 100, miss: n - done }; });
    const cls = (pct) => (pct >= 95 ? 'ok' : pct >= 85 ? 'warn' : 'bad');
    const st = (pct) => (pct >= 95 ? badge('b-ok', L('جيد', 'Good'), 'check') : pct >= 85 ? badge('b-warn', L('يحتاج متابعة', 'Needs follow-up'), 'warn') : badge('b-bad', L('حرج', 'Critical'), 'warn'));
    return `
      <div class="grid g-3">
        ${tile(L('فحص الامتثال: مُجاز', 'Screening: cleared'), fmtN(scr.CLEARED), rule('RC-015'), null, 'shield')}
        ${tile(L('فحص الامتثال: مستحق', 'Screening: due'), fmtN(scr.DUE), rule('CC-005'), null, 'clock')}
        ${tile(L('فحص الامتثال: مُصعَّد', 'Screening: escalated'), fmtN(scr.ESCALATED), L('نتائج مقيّدة الوصول', 'Restricted results'), null, 'lock')}
      </div>
      <div class="grid g-2">
        <section class="card"><div class="card-head"><h2>${esc(L('الإقرار بالسياسات', 'Policy acknowledgements'))} ${rule('ON-003')}</h2>${readOnly ? '' : `<button class="btn sm" data-act="remind-acks">${icon('teams', 14)}${esc(L('تذكير عبر Teams', 'Remind in Teams'))}</button>`}</div>
          <div class="list">${perPolicy.map((x) => `<div class="list-item"><div class="grow"><div class="t">${esc(T(x.p))}</div>${meter(x.pct, cls(x.pct))}<div class="subtle">${esc(L(`${fmtN(x.pct, 1)}% · ${x.miss} لم يُقرّوا`, `${fmtN(x.pct, 1)}% · ${x.miss} pending`))}</div></div>${st(x.pct)}</div>`).join('')}</div></section>
        <section class="card"><div class="card-head"><h2>${esc(L('التدريبات الإلزامية', 'Mandatory trainings'))} ${rule('CC-009')}</h2>${readOnly ? '' : `<button class="btn sm" data-act="toast" data-msg="${esc(L('سُجّل الموظفون الناقصون في الدورة القادمة.', 'Pending staff enrolled in the next session.'))}">${esc(L('تسجيل في الدورة القادمة', 'Enrol in next session'))}</button>`}</div>
          <div class="list">${tr.map((x) => `<div class="list-item"><div class="grow"><div class="t">${esc(T(x.t))}</div>${meter(x.pct, cls(x.pct))}<div class="subtle">${esc(L(`${fmtN(x.pct, 1)}% · ${x.miss} لم يُكملوا`, `${fmtN(x.pct, 1)}% · ${x.miss} not completed`))}</div></div>${st(x.pct)}</div>`).join('')}</div></section>
      </div>
      <section class="card"><h2>${icon('lock')} ${esc(L('ملاحظة أمنية', 'Security note'))}</h2><p class="muted" style="margin:0">${esc(L('نتائج الفحص التفصيلية لا يراها إلا مسؤول الامتثال ومدير الموارد البشرية والمدير القُطري، وبقية المستخدمين يرون الحالة فقط.', 'Detailed screening results are visible only to the compliance officer, HR manager and Country Director; others see the status only.'))} ${rule('RC-016')}</p></section>`;
  }
  function vHrCompliance() {
    return `<div class="page-head"><div><h1>${esc(L('الامتثال', 'Compliance'))}</h1><p>${esc(L('الإقرارات والتدريبات الإلزامية وفحص الأطراف المحظورة.', 'Acknowledgements, mandatory trainings and prohibited-party screening.'))}</p></div></div>${complianceBody(false)}`;
  }

  const PARAMS = [
    { k: 'leave.ANNUAL.entitlementDays', rule: 'LV-010', ar: 'الإجازة السنوية (أيام عمل)', en: 'Annual leave (working days)', type: 'number', min: 0, max: 60 },
    { k: 'leave.ANNUAL.accrual', rule: 'LV-011', ar: 'طريقة استحقاق الإجازة السنوية', en: 'Annual leave accrual', type: 'radio', opts: [['MONTHLY', 'شهري', 'Monthly'], ['ANNUAL_GRANT', 'منحة سنوية كاملة', 'Full annual grant']] },
    { k: 'leave.ANNUAL.minServiceMonths', rule: 'LV-012', ar: 'أشهر الخدمة قبل استخدام السنوية', en: 'Service months before annual leave', type: 'number', min: 0, max: 12 },
    { k: 'leave.UNPAID.maxDaysPerYear', rule: 'LV-061', ar: 'الحد السنوي للإجازة بدون راتب', en: 'Unpaid leave annual maximum', type: 'number', min: 0, max: 365 },
    { k: 'leave.UNPAID.noticeBusinessDays', rule: 'LV-062', ar: 'الإشعار المسبق للإجازة بدون راتب (أيام عمل)', en: 'Unpaid leave notice (working days)', type: 'number', min: 0, max: 30 },
    { k: 'leave.BEREAVEMENT.daysPerEvent', rule: 'LV-030', ar: 'أيام إجازة الوفاة لكل حالة', en: 'Bereavement days per event', type: 'number', min: 0, max: 15 },
    { k: 'probationMonths', rule: 'LC-002', ar: 'مدة فترة التجربة (أشهر)', en: 'Probation (months)', type: 'number', min: 0, max: 12 },
    { k: 'lateMarksThreshold', rule: 'WT-013', ar: 'حد علامات التأخير الشهرية', en: 'Monthly late-mark threshold', type: 'number', min: 1, max: 20 },
    { k: 'overtimeMultiplier', rule: 'WT-021', ar: 'معامل أجر العمل الإضافي', en: 'Overtime rate multiplier', type: 'number', min: 1, max: 3, step: 0.25 },
    { k: 'meritMaxPercent', rule: 'CP-010', ar: 'الحد الأقصى للزيادة السنوية %', en: 'Merit increase maximum %', type: 'number', min: 0, max: 20 }
  ];
  const getP = (k) => k.split('.').reduce((o, p) => o[p], D.POLICY);
  const setP = (k, v) => { const ps = k.split('.'); const last = ps.pop(); ps.reduce((o, p) => o[p], D.POLICY)[last] = v; };
  const TOGGLES = [
    { k: 'flags.sickInProbation', rule: 'LV-025', ar: 'السماح بالإجازة المرضية المدفوعة خلال فترة التجربة', en: 'Allow paid sick leave during probation' },
    { k: 'flags.overtimePreApproval', rule: 'WT-020', ar: 'العمل الإضافي يتطلب موافقة مسبقة', en: 'Overtime requires prior approval' },
    { k: 'flags.reackOnNewVersion', rule: 'ON-004', ar: 'طلب الإقرار مجدداً عند صدور إصدار جديد من السياسة', en: 'Re-request acknowledgement on new policy versions' },
    { k: 'flags.deemedResignationAuto', rule: 'WT-015', ar: 'اعتبار الغياب المتتالي استقالة تلقائياً (غير مستحسن)', en: 'Treat consecutive absence as resignation automatically (not recommended)' }
  ];
  function vHrSettings() {
    const changedP = (k) => JSON.stringify(getP(k)) !== JSON.stringify(k.split('.').reduce((o, x) => (o ? o[x] : undefined), DEFAULT_POLICY));
    const sw = (t) => `<label class="switch"><input type="checkbox" role="switch" data-toggle="${t.k}" ${getP(t.k) ? 'checked' : ''} aria-label="${esc(L(t.ar, t.en))}"><span class="track"><span class="thumb"></span></span></label>`;
    return `
      <div class="page-head"><div><h1>${esc(L('إعدادات السياسات', 'Policy settings'))}</h1><p>${esc(L('كل رقم في السياسات إعداد قابل للتعديل دون برمجة، ويُطبَّق فوراً. جرّب تعديل قيمة ثم قدّم إجازة من مساحة الموظف.', 'Every policy number is a setting, editable without code and applied immediately. Change a value, then request leave from the Employee workspace.'))}</p></div>
        <div class="btn-row"><button class="btn subtle" data-act="reset-policy">${icon('reset', 16)}${esc(L('استعادة الافتراضي', 'Restore defaults'))}</button><button class="btn" data-act="export-policy">${icon('download', 16)}${esc(L('تصدير JSON', 'Export JSON'))}</button></div></div>
      <div class="grid g-21">
        <div class="grid">
          <section class="card"><div class="card-head"><h2>${esc(L('مجموعة السياسات القُطرية: نموذجية', 'Country policy set: Sample'))}</h2>
            <div class="field" style="grid-template-columns:auto 160px;align-items:center;gap:8px"><label for="eff">${esc(L('سارية من', 'Effective from'))}</label><input id="eff" type="date" class="input" value="${esc(S.effDate)}" data-eff="1"></div></div>
            ${PARAMS.map((p) => { const val = getP(p.k); return `<div class="param"><div class="pl"><b>${esc(L(p.ar, p.en))} ${changedP(p.k) ? badge('b-brand', L('معدّل', 'Changed')) : ''}</b><span class="subtle">${rule(p.rule)} <bdi style="direction:ltr">${esc(p.k)}</bdi></span></div>
              ${p.type === 'radio' ? `<div class="radio-group" role="radiogroup" aria-label="${esc(L(p.ar, p.en))}">${p.opts.map((o) => `<label class="radio"><input type="radio" name="${p.k}" value="${o[0]}" data-param="${p.k}" ${val === o[0] ? 'checked' : ''}><span>${esc(L(o[1], o[2]))}</span></label>`).join('')}</div>` : `<input class="input num" type="number" min="${p.min}" max="${p.max}" step="${p.step || 1}" value="${val}" data-param="${p.k}" aria-label="${esc(L(p.ar, p.en))}">`}</div>`; }).join('')}
            <div class="param wide"><div class="pl"><b>${esc(L('أيام العمل الأسبوعية', 'Working days of the week'))}</b><span class="subtle">${rule('WT-001')}</span></div><div class="days-pick">${DAYNAMES.map((dn) => `<label><input type="checkbox" data-wday="${dn}" ${D.POLICY.workWeek.days.includes(dn) ? 'checked' : ''}>${esc(T(DAYLABEL[dn]))}</label>`).join('')}</div></div>
          </section>
          <section class="card"><h2>${esc(L('قواعد التشغيل', 'Operating rules'))}</h2>
            ${TOGGLES.map((t) => `<div class="param wide"><div class="pl"><b>${esc(L(t.ar, t.en))} ${changedP(t.k) ? badge('b-brand', L('معدّل', 'Changed')) : ''}</b><span class="subtle">${rule(t.rule)}</span></div>${sw(t)}</div>`).join('')}
          </section>
        </div>
        <section class="card" style="align-self:start"><h2>${esc(L('كيف يعمل', 'How it works'))}</h2>
          <div class="list">
            <div class="list-item">${icon('cal')}<div class="grow"><div class="t">${esc(L('مؤرخة السريان', 'Effective-dated'))}</div><div class="subtle">${esc(L('لكل قيمة تاريخ بداية ونهاية، فتبقى الحسابات السابقة صحيحة.', 'Each value has a start and end date, so past calculations stay correct.'))}</div></div></div>
            <div class="list-item">${icon('globe')}<div class="grow"><div class="t">${esc(L('لكل دولة', 'Per country'))}</div><div class="subtle">${esc(L('كل مكتب قُطري يتبع مجموعة سياسات حسب قانون العمل المحلي.', 'Each country office follows its own policy set per local labor law.'))}</div></div></div>
            <div class="list-item">${icon('doc')}<div class="grow"><div class="t">${esc(L('قابلة للتتبع', 'Traceable'))}</div><div class="subtle">${esc(L('كل إعداد مرتبط بمعرّف قاعدة في المرجع الوظيفي، وكل تعديل يُسجَّل في سجل التدقيق.', 'Every setting maps to a rule ID in the functional reference, and every change is audited.'))}</div></div></div>
          </div>
        </section>
      </div>`;
  }

  // ======================================================================
  // COUNTRY DIRECTOR views
  // ======================================================================
  function costByGrant() {
    const m = {}; D.GRANTS.forEach((g) => { m[g.id] = { cost: 0, staff: 0 }; });
    active().forEach((e) => e.alloc.forEach((a) => { m[a.grant].cost += (e.baseSalary * a.pct) / 100; m[a.grant].staff += a.pct / 100; }));
    return m;
  }
  function vCdDash() {
    const n = active().length;
    const payroll = active().reduce((s, e) => s + e.baseSalary, 0);
    const pend = D.approvals.filter((a) => a.status === 'PENDING').length;
    const turnover = (D.separations.length / ((n + n + D.separations.length) / 2)) * 100;
    const liability = active().filter((e) => e.category === 'REGULAR').reduce((s, e) => s + Math.max(0, balances(e).annual.available) * (e.baseSalary / D.POLICY.workingDaysPerMonth), 0);
    const cg = costByGrant();
    const grantBars = D.GRANTS.map((g) => ({ label: `${g.id} · ${T(g)}`, value: cg[g.id].cost, tip: L(`${fmtN(cg[g.id].staff, 1)} موظف (مكافئ دوام كامل)`, `${fmtN(cg[g.id].staff, 1)} FTE`) })).sort((a, b) => b.value - a.value);
    const risk = D.GRANTS.filter((g) => daysBetween(D.todayISO, g.end) <= 120).map((g) => ({ g, staff: active().filter((e) => e.alloc.some((a) => a.grant === g.id)), cost: cg[g.id].cost }));
    return `
      <div class="page-head"><div><h1>${esc(L('اللوحة التنفيذية', 'Executive dashboard'))}</h1><p>${esc(`${T(D.ORG)} · ${fmtD(D.todayISO)}`)}</p></div><button class="btn primary" data-act="nav" data-v="approvals">${icon('approve', 16)}${esc(L(`الموافقات (${pend})`, `Approvals (${pend})`))}</button></div>
      <div class="grid g-4 keep2">
        ${tile(L('القوى العاملة', 'Workforce'), fmtN(n), L(`${D.OFFICES.length} مكاتب`, `${D.OFFICES.length} offices`), 'nav-workforce', 'people')}
        ${tile(L('كلفة الرواتب الشهرية', 'Monthly payroll cost'), money(payroll), L('الرواتب الأساسية', 'Base salaries'), null, 'money')}
        ${tile(L('معدل الدوران (12 شهراً)', 'Turnover (12 months)'), `${fmtN(turnover, 1)}%`, L(`${D.separations.length} حالة انفصال`, `${D.separations.length} separations`), null, 'chart')}
        ${tile(L('التزام الإجازات المستحقة', 'Accrued leave liability'), money(liability), rule('LV-015'), null, 'cal')}
      </div>
      <div class="grid g-21">
        <section class="card"><h2>${esc(L('كلفة الرواتب الشهرية حسب المنحة', 'Monthly staff cost by grant'))}</h2>${bars(grantBars, { fmt: (v) => money(v), title: L('الكلفة حسب المنحة', 'Cost by grant') })}<p class="subtle" style="margin:10px 0 0">${esc(L('محسوبة من نسب توزيع الوظائف على المنح.', 'Calculated from position-to-grant allocation percentages.'))} ${rule('ORG-004')}</p></section>
        <section class="card"><h2>${icon('warn')} ${esc(L('مخاطر التمويل', 'Funding risk'))}</h2>
          ${risk.length ? risk.map((r) => `<div class="msg warn" style="margin-bottom:8px">${icon('warn', 16)}<div><b>${esc(r.g.id)} · ${esc(T(r.g))}</b><br>${esc(L(`تنتهي ${fmtD(r.g.end)} · ${r.staff.length} موظفاً مموّلون منها · ${money(r.cost)} شهرياً`, `Ends ${fmtD(r.g.end)} · ${r.staff.length} staff funded · ${money(r.cost)}/month`))}</div></div>`).join('') : `<div class="empty">—</div>`}
          <p class="subtle" style="margin:0">${esc(L('خطط للتجديد أو النقل أو التقليص قبل انتهاء المنحة.', 'Plan renewal, transfer or redundancy before the grant ends.'))} ${rule('SP-010')}</p>
        </section>
      </div>
      <section class="card"><div class="card-head"><h2>${esc(L('بانتظار اعتمادك', 'Awaiting your approval'))} <span class="count">${pend}</span></h2><button class="btn subtle sm" data-act="nav" data-v="approvals">${esc(L('عرض الكل', 'View all'))}</button></div>${apList(D.approvals.filter((a) => a.status === 'PENDING').slice(0, 4))}</section>`;
  }

  function apSubject(a) {
    if (a.type === 'HIRE') return T(a.data.candidate);
    if (a.type === 'NEW_POSITION') return T(a.data.title);
    const e = empById.get(a.subject); return e ? T(e.name) : '';
  }
  function apChecks(a) { // policy checks shown to the approver
    const out = { errors: [], warnings: [], info: [] };
    const d = a.data;
    if (a.type === 'SALARY_INCREASE') {
      if (d.percent > D.POLICY.meritMaxPercent) out.errors.push(R('CP-010', `الزيادة ${d.percent}% تتجاوز الحد الأقصى ${D.POLICY.meritMaxPercent}%.`, `${d.percent}% exceeds the ${D.POLICY.meritMaxPercent}% maximum.`));
      else out.info.push(R('CP-010', `ضمن النطاق 1–${D.POLICY.meritMaxPercent}%.`, `Within the 1–${D.POLICY.meritMaxPercent}% range.`));
      out.info.push(R('CP-011', `أكمل عقد ${d.months} شهراً وجُدّد ${d.renewed} شهراً · التقييم: ${RATING[d.rating].ar}`, `Completed ${d.months}-month contract, renewed ${d.renewed} months · rating: ${RATING[d.rating].en}`));
    }
    if (a.type === 'HIRE') {
      out.info.push(R('RC-008', `نماذج تقييم اللجنة ${d.evals}`, `Panel evaluations ${d.evals}`));
      out.info.push(R('RC-014', `المراجع ${d.refs}`, `References ${d.refs}`));
      if (d.screening === 'CLEARED') out.info.push(R('RC-015', 'اجتاز فحص الامتثال.', 'Compliance screening cleared.')); else out.errors.push(R('RC-015', 'فحص الامتثال لم يكتمل.', 'Compliance screening not cleared.'));
    }
    if (a.type === 'UNPAID_LEAVE') {
      out.info.push(R('LV-060', `مدة الخدمة ${d.service} شهراً (الحد الأدنى ${D.POLICY.leave.UNPAID.minServiceMonths}).`, `Service ${d.service} months (minimum ${D.POLICY.leave.UNPAID.minServiceMonths}).`));
      if (d.usedThisYear + d.days > D.POLICY.leave.UNPAID.maxDaysPerYear) out.errors.push(R('LV-061', 'يتجاوز الحد السنوي.', 'Exceeds the annual limit.'));
      else out.info.push(R('LV-061', `${d.usedThisYear + d.days} من ${D.POLICY.leave.UNPAID.maxDaysPerYear} يوماً هذا العام.`, `${d.usedThisYear + d.days} of ${D.POLICY.leave.UNPAID.maxDaysPerYear} days this year.`));
    }
    if (a.type === 'WARNING') {
      out.info.push(R('DG-002', d.response ? 'قدّم الموظف رده وهو مرفق.' : 'لم يُسجَّل رد الموظف.', d.response ? 'Employee response recorded and attached.' : 'No employee response recorded.'));
      out.info.push(R('DG-006', `يسقط الإنذار بعد ${D.POLICY.warningValidityMonths} شهراً.`, `Warning expires after ${D.POLICY.warningValidityMonths} months.`));
    }
    if (a.type === 'ACTING') {
      if (d.months > D.POLICY.actingMaxMonths) out.errors.push(R('LC-031', 'تتجاوز المدة القصوى.', 'Exceeds maximum duration.'));
      else out.info.push(R('LC-031', `${d.months} أشهر من حد أقصى ${D.POLICY.actingMaxMonths}.`, `${d.months} of max ${D.POLICY.actingMaxMonths} months.`));
      out.info.push(R('LC-032', `بدل تكليف ${d.allowance}% من الراتب الأساسي.`, `Acting allowance ${d.allowance}% of base salary.`));
    }
    if (a.type === 'NEW_POSITION') {
      const g = grant(d.grant);
      out.info.push(R('RC-002', `ممولة من ${g.id} · ${T(g)} حتى ${fmtD(g.end)}`, `Funded by ${g.id} · ${T(g)} until ${fmtD(g.end)}`));
    }
    return out;
  }
  function apFacts(a) {
    const d = a.data; const f = [];
    const e = a.subject ? empById.get(a.subject) : null;
    if (e) f.push([L('الموظف', 'Employee'), `${T(e.name)} · ${T(e.position)}`]);
    if (a.type === 'HIRE') { const v = D.vacancies.find((x) => x.id === d.vacancy); f.push([L('الوظيفة', 'Position'), `${v ? T(v) : d.vacancy} (${d.vacancy})`], [L('الترتيب والنتيجة', 'Rank & score'), `#${d.rank} · ${d.score}`], [L('الراتب المقترح', 'Proposed salary'), money(d.salary)], [L('تاريخ البدء', 'Start date'), fmtD(d.start)]); }
    if (a.type === 'SALARY_INCREASE') f.push([L('الزيادة', 'Increase'), `${d.percent}%`], [L('الراتب', 'Salary'), `${money(d.from)} → ${money(d.from * (1 + d.percent / 100))}`]);
    if (a.type === 'UNPAID_LEAVE') f.push([L('المدة', 'Duration'), L(`${d.days} يوماً`, `${d.days} days`)], [L('من', 'From'), fmtD(d.from)]);
    if (a.type === 'NEW_POSITION') f.push([L('الدرجة', 'Grade'), `G${d.grade}`], [L('المكتب', 'Office'), officeName(d.office)], [L('المدة', 'Duration'), L(`${d.months} شهراً`, `${d.months} months`)], [L('الكلفة الشهرية', 'Monthly cost'), money(d.budget)]);
    if (a.type === 'WARNING') f.push([L('المستوى', 'Level'), L('إنذار كتابي أول', 'First written warning')], [L('السبب', 'Reason'), T(d.reason)]);
    if (a.type === 'ACTING') f.push([L('الوظيفة', 'Position'), T(d.position)], [L('المدة', 'Duration'), L(`${d.months} أشهر`, `${d.months} months`)], [L('البدل', 'Allowance'), money((e.baseSalary * d.allowance) / 100)]);
    const rq = empById.get(a.requester); if (rq) f.push([L('مقدّم الطلب', 'Requested by'), T(rq.name.short)]);
    return f;
  }
  function apList(list) {
    if (!list.length) return `<div class="empty">${esc(L('لا توجد طلبات', 'Nothing here'))}</div>`;
    return `<div class="list">${list.map((a) => { const c = apChecks(a); return `<div class="list-item" style="cursor:pointer" data-act="ap-open" data-id="${a.id}">${icon(a.type === 'HIRE' || a.type === 'NEW_POSITION' ? 'brief' : a.type === 'WARNING' ? 'warn' : a.type === 'UNPAID_LEAVE' ? 'cal' : 'money')}<div class="grow"><div class="t">${esc(T(APTYPE[a.type]))} · ${esc(apSubject(a))}</div><div class="subtle"><bdi>${esc(a.id)}</bdi> · <bdi>${esc(fmtD(a.created))}</bdi></div></div>${c.errors.length ? badge('b-bad', L('مخالفة للسياسة', 'Policy exception'), 'warn') : badge('b-ok', L('مطابق', 'Compliant'), 'check')}${a.status !== 'PENDING' ? badge(a.status === 'APPROVED' ? 'b-ok' : 'b-bad', a.status === 'APPROVED' ? L('معتمد', 'Approved') : L('مرفوض', 'Rejected')) : ''}</div>`; }).join('')}</div>`;
  }
  function vCdApprovals() {
    const f = S.apFilter;
    const list = D.approvals.filter((a) => (f === 'PENDING' ? a.status === 'PENDING' : a.status !== 'PENDING'));
    return `
      <div class="page-head"><div><h1>${esc(L('الموافقات', 'Approvals'))}</h1><p>${esc(L('الطلبات نفسها تصلك كبطاقات تفاعلية في Teams وOutlook.', 'The same requests reach you as actionable cards in Teams and Outlook.'))}</p></div>
        <span class="seg" role="group">${[['PENDING', 'بانتظاري', 'Pending'], ['DONE', 'تم البت فيها', 'Decided']].map(([k, ar, en]) => `<button aria-pressed="${f === k}" data-act="apf" data-v="${k}">${esc(L(ar, en))}</button>`).join('')}</span></div>
      <section class="card">${apList(list)}</section>`;
  }

  function vCdWorkforce() {
    const byDept = D.DEPTS.map((d) => ({ label: T(d), value: active().filter((e) => e.dept === d.id).length })).sort((a, b) => b.value - a.value);
    const buckets = [[0, 1, L('أقل من سنة', '< 1 year')], [1, 3, L('1–3 سنوات', '1–3 years')], [3, 5, L('3–5 سنوات', '3–5 years')], [5, 99, L('أكثر من 5 سنوات', '5+ years')]];
    const bySvc = buckets.map(([a, b, l]) => ({ label: l, value: active().filter((e) => { const y = serviceDays(e) / 365; return y >= a && y < b; }).length }));
    const f = active().filter((e) => e.gender === 'F').length;
    const sepByType = ['RESIGNATION', 'CONTRACT_END', 'REDUNDANCY', 'DISCIPLINARY'].map((t) => ({ label: { RESIGNATION: L('استقالة', 'Resignation'), CONTRACT_END: L('انتهاء عقد', 'Contract end'), REDUNDANCY: L('تقليص', 'Redundancy'), DISCIPLINARY: L('فصل تأديبي', 'Disciplinary') }[t], value: D.separations.filter((s) => s.type === t).length }));
    return `
      <div class="page-head"><div><h1>${esc(L('القوى العاملة', 'Workforce'))}</h1><p>${esc(L('صورة شاملة للموظفين حسب القسم ومدة الخدمة والانفصال.', 'Staff by department, length of service and separations.'))}</p></div></div>
      <div class="grid g-4 keep2">
        ${tile(L('الموظفات', 'Women'), `${fmtN((f / active().length) * 100, 1)}%`, fmtN(f))}
        ${tile(L('الموظفون', 'Men'), `${fmtN(((active().length - f) / active().length) * 100, 1)}%`, fmtN(active().length - f))}
        ${tile(L('في فترة التجربة', 'On probation'), fmtN(active().filter((e) => e.inProbation).length), rule('LC-002'))}
        ${tile(L('متوسط مدة الخدمة', 'Average service'), L(`${fmtN(active().reduce((s, e) => s + serviceDays(e), 0) / active().length / 365, 1)} سنة`, `${fmtN(active().reduce((s, e) => s + serviceDays(e), 0) / active().length / 365, 1)} yrs`))}
      </div>
      <div class="grid g-2">
        <section class="card"><h2>${esc(L('الموظفون حسب القسم', 'Staff by department'))}</h2>${bars(byDept, { title: L('حسب القسم', 'By department') })}</section>
        <div class="grid">
          <section class="card"><h2>${esc(L('مدة الخدمة', 'Length of service'))}</h2>${bars(bySvc, { title: L('مدة الخدمة', 'Length of service') })}</section>
          <section class="card"><h2>${esc(L('حالات الانفصال (12 شهراً) حسب النوع', 'Separations (12 months) by type'))}</h2>${bars(sepByType, { title: L('الانفصال', 'Separations') })}</section>
        </div>
      </div>`;
  }
  function vCdCompliance() {
    return `<div class="page-head"><div><h1>${esc(L('نظرة على الامتثال', 'Compliance overview'))}</h1><p>${esc(L('للاطلاع: المتابعة التنفيذية يتولاها قسم الموارد البشرية.', 'Read-only: follow-up is handled by HR.'))}</p></div></div>${complianceBody(true)}`;
  }

  // ======================================================================
  // Overlays: employee drawer, approval drawer, channel previews, activity, ack
  // ======================================================================
  function drawer(title, body, footer, head) {
    return `<div class="scrim" data-act="close-overlay" data-self="1"><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header>${head || ''}<h2>${esc(title)}</h2><button class="iconbtn" data-act="close-overlay" aria-label="${esc(L('إغلاق', 'Close'))}">${icon('x')}</button></header>
      <div class="dbody">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</aside></div>`;
  }
  function modal(title, body, footer) {
    return `<div class="scrim" data-act="close-overlay" data-self="1"><div class="modal-wrap" data-act="close-overlay" data-self="1"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button class="iconbtn" data-act="close-overlay" aria-label="${esc(L('إغلاق', 'Close'))}">${icon('x')}</button></header>
      <div class="mbody">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div></div></div>`;
  }

  function empDrawer(id) {
    const e = empById.get(id); const b = balances(e); const mgr = e.managerId ? empById.get(e.managerId) : null;
    const canSeePay = S.role === 'HR' || S.role === 'CD';
    const body = `
      <dl class="kv"><dt>${esc(L('الرقم الوظيفي', 'Staff no.'))}</dt><dd class="num">${esc(e.staffNo)}</dd><dt>${esc(L('الوظيفة', 'Position'))}</dt><dd>${esc(T(e.position))} · G${e.grade}</dd>
        <dt>${esc(L('القسم', 'Department'))}</dt><dd>${esc(T(e.deptName))}</dd><dt>${esc(L('المكتب', 'Office'))}</dt><dd>${esc(officeName(e.office))}</dd>
        <dt>${esc(L('الفئة', 'Category'))}</dt><dd>${esc(T(CAT[e.category]))}</dd><dt>${esc(L('المدير المباشر', 'Line manager'))}</dt><dd>${mgr ? esc(T(mgr.name.short)) : '—'}</dd>
        <dt>${esc(L('التعيين', 'Hired'))}</dt><dd>${esc(fmtD(e.hireDate))} (${esc(L(`${fmtN(serviceDays(e) / 365, 1)} سنة`, `${fmtN(serviceDays(e) / 365, 1)} yrs`))})</dd><dt>${esc(L('نهاية العقد', 'Contract end'))}</dt><dd>${esc(fmtD(e.contractEnd))}</dd>
        ${e.inProbation ? `<dt>${esc(L('نهاية التجربة', 'Probation end'))}</dt><dd>${esc(fmtD(e.probationEnd))}</dd>` : ''}</dl>
      <div><p class="section-title">${esc(L('التمويل', 'Funding'))} ${rule('ORG-004')}</p>${e.alloc.map((a) => `<div class="list-item"><div class="grow"><div class="t">${esc(a.grant)} · ${esc(T(grant(a.grant)))}</div>${meter(a.pct)}</div><span class="num">${a.pct}%</span></div>`).join('')}</div>
      ${e.category === 'REGULAR' ? `<div><p class="section-title">${esc(L('أرصدة الإجازات', 'Leave balances'))}</p><dl class="kv"><dt>${esc(T(LEAVE.ANNUAL))}</dt><dd class="num">${fmtN(b.annual.available, 2)}</dd><dt>${esc(L('مرضية (كامل)', 'Sick (full pay)'))}</dt><dd class="num">${fmtN(b.sick.full)}</dd><dt>${esc(L('علامات التأخير هذا الشهر', 'Late marks this month'))}</dt><dd class="num">${e.lateMarks}</dd></dl></div>` : ''}
      <div><p class="section-title">${esc(L('الامتثال', 'Compliance'))}</p><div class="btn-row">${e.screening === 'CLEARED' ? badge('b-ok', L('الفحص: مُجاز', 'Screening: cleared'), 'check') : badge('b-bad', L('الفحص: مستحق', 'Screening: due'), 'warn')}${e.ackMissing.length ? badge('b-warn', L(`${e.ackMissing.length} إقرار ناقص`, `${e.ackMissing.length} ack pending`)) : badge('b-ok', L('الإقرارات مكتملة', 'Acknowledgements complete'), 'check')}${badge('b-neutral', L(`التدريبات ${e.trainingsDone.length}/${D.TRAININGS.length}`, `Trainings ${e.trainingsDone.length}/${D.TRAININGS.length}`))}</div></div>
      <div><p class="section-title">${esc(L('التعويضات', 'Compensation'))} ${rule('RD-003')}</p>${canSeePay ? `<dl class="kv"><dt>${esc(L('الراتب الأساسي', 'Base salary'))}</dt><dd class="num">${money(e.baseSalary)}</dd><dt>${esc(L('آخر تقييم', 'Last rating'))}</dt><dd>${esc(T(RATING[e.rating]))}</dd></dl><p class="subtle" style="margin:6px 0 0">${icon('lock', 12)} ${esc(L('حقل محمي: يظهر لمدير الموارد البشرية والمالية والمدير القُطري فقط.', 'Protected field: visible to HR manager, Finance and Country Director only.'))}</p>` : `<span class="locked">${icon('lock', 14)}${esc(L('محمي', 'Protected'))}</span>`}</div>`;
    const footer = S.role === 'HR' ? `<button class="btn" data-act="toast" data-msg="${esc(L('أُنشئ تغيير حالة جديد (مسودة).', 'New change of status created (draft).'))}">${esc(L('تغيير حالة', 'Change of status'))}</button><button class="btn" data-act="toast" data-msg="${esc(L('أُنشئت شهادة الخبرة من القالب.', 'Employment certificate generated from template.'))}">${esc(L('شهادة خبرة', 'Employment certificate'))}</button>` : '';
    return drawer(T(e.name), body, footer, avatar(e));
  }

  function apDrawer(id) {
    const a = D.approvals.find((x) => x.id === id);
    const c = apChecks(a);
    const body = `
      <div class="btn-row">${badge('b-brand', T(APTYPE[a.type]))}<span class="subtle"><bdi>${esc(a.id)}</bdi> · <bdi>${esc(fmtD(a.created))}</bdi></span></div>
      <dl class="kv">${apFacts(a).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <div><p class="section-title">${esc(L('فحص السياسة التلقائي', 'Automatic policy check'))}</p>${msgs(c)}</div>
      ${a.status === 'PENDING' ? `<div class="field"><label for="ap-comment">${esc(L('تعليق (اختياري)', 'Comment (optional)'))}</label><textarea id="ap-comment" class="textarea"></textarea></div>` : `<div class="msg ${a.status === 'APPROVED' ? 'ok' : 'bad'}">${icon(a.status === 'APPROVED' ? 'check' : 'x', 16)}<div>${esc(a.status === 'APPROVED' ? L('تم الاعتماد', 'Approved') : L('تم الرفض', 'Rejected'))}${a.decidedVia ? ` · ${esc(a.decidedVia)}` : ''}</div></div>`}`;
    const footer = `<button class="btn subtle" data-act="preview-ap" data-id="${a.id}">${icon('teams', 16)}${esc(L('عرض في Teams / Outlook', 'View in Teams / Outlook'))}</button>${a.status === 'PENDING' ? `<button class="btn danger" data-act="ap-decide" data-id="${a.id}" data-v="REJECTED">${esc(L('رفض', 'Reject'))}</button><button class="btn primary" data-act="ap-decide" data-id="${a.id}" data-v="APPROVED">${icon('check', 16)}${esc(c.errors.length ? L('اعتماد كاستثناء', 'Approve as exception') : L('اعتماد', 'Approve'))}</button>` : ''}`;
    return drawer(`${T(APTYPE[a.type])}: ${apSubject(a)}`, body, footer);
  }

  // Adaptive-card style rendering shared by Teams and Outlook previews
  function acard(title, facts, actions, note) {
    return `<div class="acard"><div class="ah">${icon('approve', 18)}${esc(title)}</div><dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${note ? `<div class="subtle">${note}</div>` : ''}<div class="btn-row">${actions}</div></div>`;
  }
  function channelPreview(kind, from, to, subject, card) {
    const tabs = `<div class="channel-tabs seg" role="group"><button aria-pressed="${S.channel !== 'outlook'}" data-act="channel" data-v="teams">${icon('teams', 14)} Teams</button><button aria-pressed="${S.channel === 'outlook'}" data-act="channel" data-v="outlook">${icon('mail', 14)} Outlook</button></div>`;
    if (S.channel === 'outlook') {
      return `${tabs}<div class="preview"><div class="chrome">${icon('mail', 14)}<b>Outlook</b> · ${esc(L('البريد الوارد', 'Inbox'))}</div><div class="mail"><div class="mh"><span class="subj">${esc(subject)}</span><span class="subtle">${esc(L(`من: HR Suite نيابة عن ${from}`, `From: HR Suite on behalf of ${from}`))} · ${esc(L(`إلى: ${to}`, `To: ${to}`))}</span></div><div class="mbody2"><span>${esc(L('يمكنك الاعتماد مباشرة من هذه الرسالة:', 'You can act directly from this message:'))}</span>${card}</div></div></div>`;
    }
    return `${tabs}<div class="preview"><div class="chrome">${icon('teams', 14)}<b>Teams</b> · ${esc(L('دردشة مع HR Suite', 'Chat with HR Suite'))}</div><div class="teams-msg"><span class="avatar sm" style="background:var(--brand);color:var(--brand-fg-on)">HR</span><div class="bubble"><div class="meta"><b>HR Suite</b>${esc(L('الآن', 'Now'))}</div>${card}</div></div></div>`;
  }
  function leavePreview(id) {
    const r = D.leaveRequests.find((x) => x.id === id); const e = empById.get(r.empId); const mgr = empById.get(e.managerId);
    const done = r.status !== 'PENDING_MANAGER';
    const card = acard(L('طلب إجازة بحاجة لموافقتك', 'Leave request needs your approval'),
      [[L('الموظف', 'Employee'), T(e.name.short)], [L('النوع', 'Type'), T(LEAVE[r.type])], [L('الفترة', 'Period'), `${fmtDs(r.from)} – ${fmtDs(r.to)}`], [L('أيام العمل', 'Working days'), String(r.days)], [L('الرصيد بعد الطلب', 'Balance after'), r.type === 'ANNUAL' ? fmtN(balances(e).annual.available, 2) : '—']],
      done ? statusBadge(r.status) : `<button class="btn primary sm" data-act="mgr-decide" data-id="${r.id}" data-v="APPROVE">${esc(L('موافقة', 'Approve'))}</button><button class="btn sm" data-act="mgr-decide" data-id="${r.id}" data-v="REJECT">${esc(L('رفض', 'Reject'))}</button>`,
      `${rule('LV-001')} ${esc(L('تم التحقق من الرصيد والتداخل تلقائياً.', 'Balance and overlap checked automatically.'))}`);
    return modal(L(`ما يراه ${T(mgr.name.short)} (المدير المباشر)`, `What ${T(mgr.name.short)} (line manager) sees`), channelPreview('leave', T(e.name.short), T(mgr.name.short), L(`طلب إجازة: ${T(e.name.short)}`, `Leave request: ${T(e.name.short)}`), card));
  }
  function apPreview(id) {
    const a = D.approvals.find((x) => x.id === id); const cd = empById.get(D.personas.CD); const rq = empById.get(a.requester);
    const c = apChecks(a);
    const card = acard(`${T(APTYPE[a.type])}: ${apSubject(a)}`, apFacts(a).slice(0, 5),
      a.status !== 'PENDING' ? badge(a.status === 'APPROVED' ? 'b-ok' : 'b-bad', a.status === 'APPROVED' ? L('معتمد', 'Approved') : L('مرفوض', 'Rejected')) : `<button class="btn primary sm" data-act="ap-decide" data-id="${a.id}" data-v="APPROVED" data-via="${S.channel === 'outlook' ? 'Outlook' : 'Teams'}">${esc(L('اعتماد', 'Approve'))}</button><button class="btn sm" data-act="ap-decide" data-id="${a.id}" data-v="REJECTED" data-via="${S.channel === 'outlook' ? 'Outlook' : 'Teams'}">${esc(L('رفض', 'Reject'))}</button><button class="btn subtle sm" data-act="ap-open" data-id="${a.id}">${esc(L('التفاصيل', 'Details'))}</button>`,
      c.errors.length ? `<span class="badge b-bad">${icon('warn', 12)}${esc(L('مخالفة للسياسة', 'Policy exception'))}</span> ${c.errors.map((x) => rule(x.rule)).join(' ')}` : `<span class="badge b-ok">${icon('check', 12)}${esc(L('مطابق للسياسة', 'Policy compliant'))}</span>`);
    return modal(L('بطاقة الموافقة كما تصل للمدير القُطري', 'Approval card as delivered to the Country Director'), channelPreview('ap', rq ? T(rq.name.short) : 'HR', T(cd.name.short), `${T(APTYPE[a.type])}: ${apSubject(a)}`, card));
  }
  function ackModal(code) {
    const p = D.POLICIES.find((x) => x.code === code);
    return modal(T(p), `<div class="msg info">${icon('doc', 16)}<div>${esc(L('في النسخة الفعلية تُعرض هنا وثيقة السياسة التي رفعتها مؤسستك.', 'In production, your organization\'s uploaded policy document is displayed here.'))}</div></div>
      <div class="card" style="box-shadow:none;border:1px solid var(--stroke);min-height:120px;display:grid;place-items:center;color:var(--text-3)">${icon('doc', 32)}<span>${esc(`${T(p)} · v${p.v}.pdf`)}</span></div>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ack-check" style="accent-color:var(--brand)"> ${esc(L('قرأت السياسة وفهمتها وألتزم بها.', 'I have read, understood and will comply with this policy.'))}</label>`,
      `<button class="btn" data-act="close-overlay">${esc(L('لاحقاً', 'Later'))}</button><button class="btn primary" data-act="ack-confirm" data-id="${code}">${esc(L('تأكيد الإقرار', 'Confirm acknowledgement'))}</button>`);
  }
  function activityPanel() {
    const list = D.activity.filter((a) => a.role === S.role);
    const body = `<div class="feed">${list.map((a) => `<div class="feed-item ${S.readActivity.includes(a.id) ? '' : 'unread'}" data-act="feed" data-id="${a.id}">${icon(a.ch === 'outlook' ? 'mail' : 'teams')}<div class="grow"><div class="t">${esc(T(a))}</div><div class="src">${esc(a.ch === 'outlook' ? 'Outlook' : 'Teams')} · ${esc(fmtD(a.at))}</div></div></div>`).join('') || `<div class="empty">${esc(L('لا يوجد نشاط', 'No activity'))}</div>`}</div>`;
    return drawer(L('النشاط', 'Activity'), body, `<button class="btn subtle" data-act="read-all">${esc(L('تعليم الكل كمقروء', 'Mark all as read'))}</button>`);
  }
  function confirmModal() {
    const c = S.confirm; if (!c) return '';
    let title = ''; let text = ''; let ok = ''; let danger = false; let reason = false;
    if (c.kind === 'hr-reject') { const r = D.leaveRequests.find((x) => x.id === c.id); const e = empById.get(r.empId); title = L('رفض طلب الإجازة؟', 'Reject leave request?'); text = L(`سيُبلَّغ ${T(e.name.short)} بالرفض عبر Teams مع السبب.`, `${T(e.name.short)} will be notified in Teams with the reason.`); ok = L('رفض الطلب', 'Reject request'); danger = true; reason = true; }
    if (c.kind === 'hr-bulk') { title = L(`اعتماد ${c.ids.length} طلبات؟`, `Approve ${c.ids.length} requests?`); text = L('ستُحدَّث الأرصدة وكشوف الدوام ويُبلَّغ الموظفون. الإجازات بدون راتب تُحال للمدير القُطري.', 'Balances and timesheets will be updated and employees notified. Leave without pay is forwarded to the Country Director.'); ok = L('اعتماد الكل', 'Approve all'); }
    if (c.kind === 'ap-reject') { const a = D.approvals.find((x) => x.id === c.id); title = L('رفض الطلب؟', 'Reject this request?'); text = L(`${T(APTYPE[a.type])}: ${apSubject(a)}. سيُبلَّغ مقدّم الطلب.`, `${T(APTYPE[a.type])}: ${apSubject(a)}. The requester will be notified.`); ok = L('رفض', 'Reject'); danger = true; reason = true; }
    return `<div class="scrim" data-act="close-overlay" data-self="1"><div class="modal-wrap" data-act="close-overlay" data-self="1"><div class="modal sm" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
      <header><span style="color:${danger ? 'var(--danger-text)' : 'var(--primary)'};display:grid">${icon(danger ? 'warn' : 'info')}</span><h2>${esc(title)}</h2></header>
      <div class="mbody"><p style="margin:0" class="muted">${esc(text)}</p>${reason ? `<div class="field"><label for="cf-reason">${esc(L('السبب', 'Reason'))}</label><textarea id="cf-reason" class="textarea" placeholder="${esc(L('اكتب سبباً واضحاً…', 'Write a clear reason…'))}"></textarea></div>` : ''}</div>
      <footer><button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn ${danger ? 'danger-solid' : 'primary'}" data-act="confirm-ok">${esc(ok)}</button></footer></div></div></div>`;
  }
  function helpModal() {
    const row = (k, ar, en) => `<div class="list-item"><span class="kbd">${k}</span><div class="grow">${esc(L(ar, en))}</div></div>`;
    return modal(L('المساعدة', 'Help'), `
      <div class="msg info">${icon('info', 16)}<div>${esc(L('هذه نسخة عرض ببيانات وهمية. بدّل مساحة العمل من الزر بجانب اسم النظام لترى النظام كموظف أو كقسم موارد بشرية أو كمدير قُطري.', 'This is a demo with fictitious data. Use the workspace switcher next to the product name to view the system as an employee, HR or the Country Director.'))}</div></div>
      <div><p class="section-title">${esc(L('اختصارات لوحة المفاتيح', 'Keyboard shortcuts'))}</p><div class="list">${row('/', 'البحث عن موظف', 'Search employees')}${row('Esc', 'إغلاق النافذة أو القائمة', 'Close dialog or menu')}${row('Tab', 'التنقل بين العناصر', 'Move between controls')}</div></div>
      <div><p class="section-title">${esc(L('معرّفات القواعد', 'Rule IDs'))}</p><p class="muted" style="margin:0">${esc(L('الرموز مثل', 'Codes such as'))} ${rule('LV-062')} ${esc(L('تشير إلى قاعدة في المرجع الوظيفي للنظام (docs/ar/system-reference.md)، فيمكن تتبّع كل قرار يتخذه النظام إلى سياسة محددة.', 'refer to a rule in the functional reference (docs/en/system-reference.md), so every system decision traces back to a specific policy.'))}</p></div>`,
      `<button class="btn primary" data-act="close-overlay">${esc(L('تم', 'Done'))}</button>`);
  }
  function prefsModal() {
    const sw = (key, on, label) => `<div class="param wide"><div class="pl"><b>${esc(label)}</b></div><label class="switch"><input type="checkbox" role="switch" data-pref="${key}" ${on ? 'checked' : ''} aria-label="${esc(label)}"><span class="track"><span class="thumb"></span></span></label></div>`;
    return modal(L('التفضيلات', 'Preferences'), `
      <div class="param wide"><div class="pl"><b>${esc(L('اللغة', 'Language'))}</b><span class="subtle">${esc(L('تتغير الواجهة واتجاهها فوراً', 'Interface and direction change instantly'))}</span></div><div class="radio-group" role="radiogroup"><label class="radio"><input type="radio" name="pref-lang" value="ar" data-pref="lang" ${S.lang === 'ar' ? 'checked' : ''}><span>العربية</span></label><label class="radio"><input type="radio" name="pref-lang" value="en" data-pref="lang" ${S.lang === 'en' ? 'checked' : ''}><span>English</span></label></div></div>
      ${sw('theme', S.theme === 'dark', L('الوضع الداكن', 'Dark mode'))}
      ${sw('collapsed', S.collapsed, L('قائمة جانبية مختصرة', 'Compact sidebar'))}`,
      `<button class="btn primary" data-act="close-overlay">${esc(L('تم', 'Done'))}</button>`);
  }
  function overlayHTML() {
    const o = S.overlay; if (!o) return '';
    if (o.type === 'emp') return empDrawer(o.id);
    if (o.type === 'ap') return apDrawer(o.id);
    if (o.type === 'leave-preview') return leavePreview(o.id);
    if (o.type === 'ap-preview') return apPreview(o.id);
    if (o.type === 'ack') return ackModal(o.id);
    if (o.type === 'activity') return activityPanel();
    if (o.type === 'confirm') return confirmModal();
    if (o.type === 'help') return helpModal();
    if (o.type === 'prefs') return prefsModal();
    return '';
  }

  // ======================================================================
  // Render
  // ======================================================================
  const VIEWS = {
    EMPLOYEE: { home: vEmpHome, leave: vEmpLeave, timesheet: vEmpTimesheet, pay: vEmpPay, policies: vEmpPolicies, profile: vEmpProfile },
    HR: { dashboard: vHrDash, employees: vHrEmployees, leave: vHrLeave, recruitment: vHrRecruit, compliance: vHrCompliance, settings: vHrSettings },
    CD: { dashboard: vCdDash, approvals: vCdApprovals, workforce: vCdWorkforce, compliance: vCdCompliance }
  };
  let lastKey = '';
  function render() {
    document.documentElement.lang = S.lang;
    document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = S.theme;
    document.title = `HR Suite — ${roleLabel(S.role)}`;
    const key = `${S.role}:${S.view[S.role]}`;
    const content = document.getElementById('content');
    const scroll = content && key === lastKey ? content.scrollTop : 0;
    document.getElementById('app').innerHTML = shell(VIEWS[S.role][S.view[S.role]]()) + overlayHTML();
    const c2 = document.getElementById('content'); if (c2) c2.scrollTop = scroll;
    syncIndeterminate();
    lastKey = key;
    save();
  }
  function openOverlay(o) { S.overlay = o; render(); setTimeout(() => { const f = document.querySelector('.drawer, .modal'); if (f) { const b = f.querySelector('button, input, textarea, select'); if (b) b.focus(); } }, 0); }
  function closeOverlay() { S.overlay = null; render(); }

  // ======================================================================
  // Actions
  // ======================================================================
  function setView(v) { S.view[S.role] = v; S.overlay = null; S.navOpen = false; closeMenu(); render(); const c = document.getElementById('content'); if (c) c.scrollTop = 0; }

  function submitLeave() {
    const e = me(); const d = S.leaveDraft; const v = validateLeave(e, d);
    if (v.errors.length || !v.days) return;
    const id = `LR-${2500 + D.leaveRequests.length}`;
    D.leaveRequests.push({ id, empId: e.id, type: d.type, from: d.from, to: d.to, days: v.days, status: 'PENDING_MANAGER', reason: d.reason, submitted: D.todayISO, unpaidProbation: e.inProbation && d.type !== 'SICK' });
    S.leaveDraft = { type: d.type, from: '', to: '', reason: '' };
    addActivity('EMPLOYEE', 'teams', `أُرسل طلبك ${id} إلى مديرك المباشر`, `Your request ${id} was sent to your line manager`, 'leave');
    S.channel = 'teams';
    openOverlay({ type: 'leave-preview', id });
    toast(L('أُرسل الطلب. هذه البطاقة التي تصل لمديرك في Teams.', 'Request sent. This is the card your manager receives in Teams.'), 'ok');
  }
  function managerDecide(id, v) {
    const r = D.leaveRequests.find((x) => x.id === id);
    if (v === 'REJECT') { r.status = 'REJECTED'; addActivity('EMPLOYEE', 'teams', `رفض المدير طلبك ${id}`, `Your manager rejected ${id}`, 'leave'); }
    else { r.status = 'PENDING_HR'; addActivity('HR', 'teams', `طلب إجازة ${id} بانتظار اعتماد الموارد البشرية`, `Leave ${id} awaiting HR approval`, 'leave'); addActivity('EMPLOYEE', 'teams', `وافق مديرك على ${id}، والطلب الآن لدى الموارد البشرية`, `Your manager approved ${id}; now with HR`, 'leave'); }
    render();
    toast(v === 'REJECT' ? L('تم الرفض.', 'Rejected.') : L('وافق المدير، والطلب الآن في قائمة الموارد البشرية.', 'Manager approved; request is now in the HR queue.'), v === 'REJECT' ? 'bad' : 'ok');
  }
  function hrDecide(id, approve, quiet) {
    const say = quiet ? () => {} : toast;
    const r = D.leaveRequests.find((x) => x.id === id); const e = empById.get(r.empId);
    if (!approve) { r.status = 'REJECTED'; say(L('تم رفض الطلب وإبلاغ الموظف عبر Teams.', 'Rejected; employee notified in Teams.'), 'bad'); }
    else if (r.type === 'UNPAID') {
      r.status = 'PENDING_CD';
      const apId = `AP-${600 + D.approvals.length}`;
      D.approvals.unshift({ id: apId, type: 'UNPAID_LEAVE', requester: D.personas.HR, subject: e.id, created: D.todayISO, status: 'PENDING', leaveId: r.id, data: { days: r.days, from: r.from, usedThisYear: Math.max(0, balances(e).unpaid.used - r.days), service: serviceMonths(e) }, rules: ['LV-063'] });
      addActivity('CD', 'teams', `إجازة بدون راتب لـ ${e.name.ar} بانتظار اعتمادك`, `Leave without pay for ${e.name.en} awaiting your approval`, 'approvals');
      say(L('أُحيل الطلب إلى المدير القُطري حسب السياسة.', 'Forwarded to the Country Director per policy.'), 'ok');
    } else { r.status = 'APPROVED'; say(L('تم الاعتماد وتحديث الرصيد وكشف الدوام.', 'Approved; balance and timesheet updated.'), 'ok'); }
    if (e.id === me().id) addActivity('EMPLOYEE', 'teams', `تحديث على طلبك ${id}: ${LSTATUS[r.status].ar}`, `Update on ${id}: ${LSTATUS[r.status].en}`, 'leave');
    render();
  }
  function apDecide(id, status, via) {
    const a = D.approvals.find((x) => x.id === id);
    a.status = status; a.decidedVia = via || 'HR Suite';
    if (a.leaveId) { const r = D.leaveRequests.find((x) => x.id === a.leaveId); if (r) r.status = status === 'APPROVED' ? 'APPROVED' : 'REJECTED'; }
    addActivity('HR', 'outlook', `${status === 'APPROVED' ? 'اعتمد' : 'رفض'} المدير القُطري ${APTYPE[a.type].ar}: ${a.id}`, `Country Director ${status === 'APPROVED' ? 'approved' : 'rejected'} ${APTYPE[a.type].en}: ${a.id}`, a.type === 'HIRE' ? 'recruitment' : 'dashboard');
    S.overlay = null; render();
    toast(status === 'APPROVED' ? L(`تم الاعتماد${via ? ` من ${via}` : ''}، وأُبلغ مقدّم الطلب.`, `Approved${via ? ` from ${via}` : ''}; requester notified.`) : L('تم الرفض وأُبلغ مقدّم الطلب.', 'Rejected; requester notified.'), status === 'APPROVED' ? 'ok' : 'bad');
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    const inMenu = ev.target.closest('#menu-host');
    if (menuState && !inMenu && !(t && ['menu-ws', 'menu-user', 'row-menu'].includes(t.dataset.act))) closeMenu();
    if (!t) return;
    const act = t.dataset.act;
    if (inMenu) closeMenu();
    if (act === 'close-overlay') { if (t.dataset.self && ev.target !== t) return; closeOverlay(); return; }
    if (t.tagName === 'TR' && ev.target.closest('button')) return;
    const id = t.dataset.id; const v = t.dataset.v;
    switch (act) {
      case 'nav': { const it = findNav(v).it; if (it.sub && S.view[S.role] === v && !S.collapsed && t.classList.contains('nav-item')) { S.collapsedSubs = S.collapsedSubs.includes(v) ? S.collapsedSubs.filter((x) => x !== v) : [...S.collapsedSubs, v]; render(); } else { S.collapsedSubs = S.collapsedSubs.filter((x) => x !== v); setView(v); } break; }
      case 'nav-leave': setView('leave'); break;
      case 'nav-employees': setView('employees'); break;
      case 'nav-compliance': setView('compliance'); break;
      case 'nav-recruitment': setView('recruitment'); break;
      case 'nav-workforce': setView('workforce'); break;
      case 'role': S.role = v; S.overlay = null; S.navOpen = false; render(); toast(L(`مساحة العمل: ${roleLabel(v)}`, `Workspace: ${roleLabel(v)}`)); break;
      case 'lang': S.lang = S.lang === 'ar' ? 'en' : 'ar'; render(); break;
      case 'theme': S.theme = S.theme === 'dark' ? 'light' : 'dark'; render(); break;
      case 'reset': resetDemo(); break;
      case 'decor': toast(L('هذا جزء من واجهة Teams. HR Suite يعمل كتطبيق داخلها.', 'This is part of Teams. HR Suite runs as an app inside it.')); break;
      case 'home-app': setView(Object.keys(VIEWS[S.role])[0]); break;
      case 'activity': openOverlay({ type: 'activity' }); break;
      case 'feed': { const a = D.activity.find((x) => x.id === id); if (!S.readActivity.includes(id)) S.readActivity.push(id); if (a && a.go) setView(a.go); break; }
      case 'read-all': D.activity.filter((a) => a.role === S.role).forEach((a) => { if (!S.readActivity.includes(a.id)) S.readActivity.push(a.id); }); render(); break;
      case 'toast': toast(t.dataset.msg, 'ok'); break;
      case 'submit-leave': submitLeave(); break;
      case 'preview-leave': S.channel = 'teams'; openOverlay({ type: 'leave-preview', id }); break;
      case 'mgr-decide': managerDecide(id, v); break;
      case 'channel': S.channel = v; render(); break;
      case 'ts-submit': tsState().status = 'SUBMITTED'; addActivity('EMPLOYEE', 'teams', 'أُرسل كشف الدوام إلى مديرك', 'Timesheet sent to your manager', 'timesheet'); render(); toast(L('أُرسل كشف الدوام إلى المدير المباشر.', 'Timesheet sent to your line manager.'), 'ok'); break;
      case 'ts-approve': tsState().status = 'APPROVED'; render(); toast(L('اعتمد المدير كشف الدوام من Teams.', 'Manager approved the timesheet in Teams.'), 'ok'); break;
      case 'ts-reopen': tsState().status = 'DRAFT'; render(); toast(L('أُعيد فتح الكشف وسُجّل ذلك في سجل التدقيق.', 'Timesheet reopened; logged in the audit trail.')); break;
      case 'ack-open': openOverlay({ type: 'ack', id }); break;
      case 'ack-confirm': { const cb = document.getElementById('ack-check'); if (!cb || !cb.checked) { toast(L('يرجى تأكيد القراءة أولاً.', 'Please confirm you have read it.'), 'bad'); return; } me().ackMissing = me().ackMissing.filter((c) => c !== id); S.overlay = null; render(); toast(L('شكراً، سُجّل إقرارك مع التاريخ والإصدار.', 'Thank you. Your acknowledgement was recorded with date and version.'), 'ok'); break; }
      case 'emp': openOverlay({ type: 'emp', id }); break;
      case 'page': S.dir.page += Number(v); refreshDir(); break;
      case 'hr-approve': hrDecide(id, true); break;
      case 'hr-reject': S.confirm = { kind: 'hr-reject', id }; openOverlay({ type: 'confirm' }); break;
      case 'vac': S.vacancy = v; render(); break;
      case 'advance': { const c = D.candidates.find((x) => x.id === id); if (gate(c)) return; const i = D.STAGES.indexOf(c.stage); c.stage = D.STAGES[i + 1]; if (c.stage === 'INTERVIEW' && c.score == null) c.score = 70 + (c.years % 20); if (c.stage === 'SCREENING' && c.screening === 'NOT_STARTED') c.screening = 'PENDING'; if (c.stage === 'EVALUATION' && !c.evals.submitted) c.evals.submitted = 1; render(); break; }
      case 'screen': { const c = D.candidates.find((x) => x.id === id); c.screening = 'CLEARED'; if (c.refs < 2) c.refs = 2; render(); toast(L('سُجّل اجتياز فحص الامتثال (النتيجة التفصيلية مقيّدة).', 'Screening recorded as cleared (details restricted).'), 'ok'); break; }
      case 'remind-panel': { const c = D.candidates.find((x) => x.id === id); c.evals.submitted = c.evals.required; render(); toast(L('أُرسل التذكير، وقدّم أعضاء اللجنة نماذجهم (محاكاة).', 'Reminder sent; panel submitted their forms (simulated).'), 'ok'); break; }
      case 'to-cd': { const c = D.candidates.find((x) => x.id === id); c.sentToCd = true; const vac = D.vacancies.find((x) => x.id === c.vacancy); D.approvals.unshift({ id: `AP-${600 + D.approvals.length}`, type: 'HIRE', requester: D.personas.HR, created: D.todayISO, status: 'PENDING', data: { candidate: c.name, vacancy: c.vacancy, rank: 1, score: c.score, panel: 3, evals: `${c.evals.submitted}/${c.evals.required}`, refs: `${c.refs}/2`, screening: c.screening, salary: Math.round(({ 5: 1050, 6: 1300, 7: 1650 }[vac.grade] || 1000)), start: iso(addDays(TODAY, 14)) }, rules: ['RC-013'] }); addActivity('CD', 'teams', `اعتماد تعيين: ${c.name.ar}`, `Hiring approval: ${c.name.en}`, 'approvals'); render(); toast(L('أُرسل للمدير القُطري كبطاقة في Teams وOutlook.', 'Sent to the Country Director as a Teams and Outlook card.'), 'ok'); break; }
      case 'remind-acks': { const n = missingAck().length; addActivity('HR', 'teams', `أُرسلت تذكيرات إلى ${n} موظفاً`, `Reminders sent to ${n} employees`, 'compliance'); render(); toast(L(`أُرسل تذكير عبر Teams إلى ${n} موظفاً.`, `Teams reminder sent to ${n} employees.`), 'ok'); break; }
      case 'export-policy': { try { const blob = new Blob([JSON.stringify(D.POLICY, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'policy-set.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); } catch (e) { toast('Export failed', 'bad'); } break; }
      case 'reset-policy': D.POLICY = JSON.parse(JSON.stringify(DEFAULT_POLICY)); render(); toast(L('استُعيدت القيم الافتراضية.', 'Defaults restored.'), 'ok'); break;
      case 'apf': S.apFilter = v; render(); break;
      case 'ap-open': openOverlay({ type: 'ap', id }); break;
      case 'ap-decide': if (v === 'REJECTED') { S.confirm = { kind: 'ap-reject', id, via: t.dataset.via }; openOverlay({ type: 'confirm' }); } else apDecide(id, v, t.dataset.via); break;
      case 'preview-ap': S.channel = S.channel || 'teams'; openOverlay({ type: 'ap-preview', id }); break;
      case 'nav-sub': applySub(v, t.dataset.k); S.collapsedSubs = S.collapsedSubs.filter((x) => x !== v); if (S.view[S.role] !== v) setView(v); else { S.navOpen = false; render(); } break;
      case 'nav-toggle': S.navOpen = !S.navOpen; render(); break;
      case 'collapse': S.collapsed = !S.collapsed; render(); break;
      case 'menu-ws': openMenu(t, wsMenu(), 'start', 'ws'); break;
      case 'menu-user': openMenu(t, userMenu(), 'end', 'user'); break;
      case 'row-menu': openMenu(t, rowMenu(id), 'end', `row-${id}`); break;
      case 'my-profile': if (S.role === 'EMPLOYEE') setView('profile'); else openOverlay({ type: 'emp', id: persona().id }); break;
      case 'help': openOverlay({ type: 'help' }); break;
      case 'prefs': openOverlay({ type: 'prefs' }); break;
      case 'sort': { const so = S.dir.sort; if (so.k === v) so.dir *= -1; else { so.k = v; so.dir = 1; } refreshDir(); break; }
      case 'sel-row': { const sel = S.dir.sel; S.dir.sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]; refreshDir(); break; }
      case 'sel-page': { const f = S.dir; const ids = dirFiltered().slice((f.page - 1) * f.per, f.page * f.per).map((e) => e.id); const all = ids.every((x) => f.sel.includes(x)); f.sel = all ? f.sel.filter((x) => !ids.includes(x)) : [...new Set([...f.sel, ...ids])]; refreshDir(); break; }
      case 'page-go': S.dir.page = Number(v); refreshDir(); break;
      case 'dir-clear': Object.assign(S.dir, { q: '', office: '', dept: '', cat: '', flag: '', page: 1 }); render(); break;
      case 'bulk': bulkAction(v, t); break;
      case 'hr-sel': S.hrSel = S.hrSel.includes(id) ? S.hrSel.filter((x) => x !== id) : [...S.hrSel, id]; render(); break;
      case 'hr-sel-all': { const ids = D.leaveRequests.filter((r) => r.status === 'PENDING_HR').map((r) => r.id); S.hrSel = ids.every((x) => S.hrSel.includes(x)) ? [] : ids; render(); break; }
      case 'hr-sel-clear': S.hrSel = []; render(); break;
      case 'hr-bulk-approve': S.confirm = { kind: 'hr-bulk', ids: [...S.hrSel] }; openOverlay({ type: 'confirm' }); break;
      case 'confirm-ok': runConfirm(); break;
      default: break;
    }
  });
  function runConfirm() {
    const c = S.confirm; if (!c) return;
    S.confirm = null; S.overlay = null;
    if (c.kind === 'hr-reject') hrDecide(c.id, false);
    if (c.kind === 'hr-bulk') { c.ids.forEach((x) => hrDecide(x, true, true)); S.hrSel = []; render(); toast(L(`اعتُمد ${c.ids.length} طلبات وأُبلغ الموظفون.`, `${c.ids.length} requests approved; employees notified.`), 'ok'); }
    if (c.kind === 'ap-reject') apDecide(c.id, 'REJECTED', c.via);
  }
  function bulkAction(v, btn) {
    const n = S.dir.sel.length;
    if (v === 'clear') { S.dir.sel = []; refreshDir(); return; }
    if (v === 'remind') { addActivity('HR', 'teams', `أُرسل تذكير إلى ${n} موظفاً`, `Reminder sent to ${n} employees`, 'employees'); S.dir.sel = []; render(); toast(L(`أُرسل تذكير عبر Teams إلى ${n} موظفاً.`, `Teams reminder sent to ${n} employees.`), 'ok'); return; }
    if (v === 'training') { S.dir.sel = []; refreshDir(); toast(L(`سُجّل ${n} موظفاً في الدورة القادمة.`, `${n} employees enrolled in the next session.`), 'ok'); return; }
    const count = v === 'export' ? n : dirFiltered().length;
    const orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>${esc(L('جارٍ التصدير…', 'Exporting…'))}`;
    setTimeout(() => { btn.disabled = false; btn.innerHTML = orig; toast(L(`صُدّر ${fmtN(count)} سجلاً إلى Excel.`, `${fmtN(count)} records exported to Excel.`), 'ok'); }, 900);
  }

  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.bind) {
      S.leaveDraft[t.dataset.bind] = t.value;
      if (t.dataset.bind === 'reason') return;
      if (t.dataset.bind === 'from' && (!S.leaveDraft.to || S.leaveDraft.to < t.value)) { S.leaveDraft.to = t.value; const to = document.getElementById('lto'); if (to) to.value = t.value; }
      const v = validateLeave(me(), S.leaveDraft);
      document.getElementById('leave-check').innerHTML = leaveCheck(v, S.leaveDraft);
      document.getElementById('leave-submit').disabled = !(S.leaveDraft.from && S.leaveDraft.to && !v.errors.length && v.days > 0);
    }
    if (t.dataset.dir === 'q') { S.dir.q = t.value; S.dir.page = 1; refreshDir(); }
    if (t.dataset.tsGrant) {
      const ts = tsState(); const val = Math.max(0, Math.min(100, Number(t.value) || 0));
      const a = ts.alloc.find((x) => x.grant === t.dataset.tsGrant);
      if (a) a.pct = val; else ts.alloc.push({ grant: t.dataset.tsGrant, pct: val });
      ts.alloc = ts.alloc.filter((x) => x.pct > 0 || x.grant === t.dataset.tsGrant);
      const total = ts.alloc.reduce((s, x) => s + x.pct, 0);
      document.getElementById('ts-total').textContent = `${total}%`;
      const btn = document.getElementById('ts-submit'); if (btn) btn.disabled = total !== 100;
      const m = document.getElementById('ts-msg').firstElementChild;
      m.outerHTML = total === 100 ? `<div class="msg ok">${icon('check', 16)}<div>${esc(L('التوزيع صحيح.', 'Allocation is valid.'))}</div></div>` : `<div class="msg bad">${icon('warn', 16)}<div>${esc(L(`المجموع ${total}%، ويجب أن يساوي 100% قبل التسليم.`, `Total is ${total}%; it must equal 100% before submitting.`))} ${rule('TS-002')}</div></div>`;
      save();
    }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.toggle) { setP(t.dataset.toggle, t.checked); render(); toast(L('حُفظ الإعداد وطُبّق فوراً.', 'Setting saved and applied immediately.'), 'ok'); return; }
    if (t.dataset.pref === 'lang') { S.lang = t.value; render(); return; }
    if (t.dataset.pref === 'theme') { S.theme = t.checked ? 'dark' : 'light'; render(); return; }
    if (t.dataset.pref === 'collapsed') { S.collapsed = t.checked; render(); return; }
    if (t.dataset.eff) { S.effDate = t.value; toast(L(`ستسري التعديلات من ${fmtD(t.value)}.`, `Changes take effect from ${fmtD(t.value)}.`), 'ok'); return; }
    if (t.dataset.bind === 'type') { S.leaveDraft.type = t.value; render(); }
    if (t.dataset.dir && t.dataset.dir !== 'q') { S.dir[t.dataset.dir] = t.dataset.dir === 'per' ? Number(t.value) : t.value; S.dir.page = 1; refreshDir(); }
    if (t.dataset.param) { const p = PARAMS.find((x) => x.k === t.dataset.param); const val = p.type === 'number' ? Math.max(p.min, Math.min(p.max, Number(t.value))) : t.value; setP(p.k, val); render(); toast(L('حُفظ الإعداد وطُبّق فوراً.', 'Setting saved and applied immediately.'), 'ok'); }
    if (t.dataset.wday) { const days = DAYNAMES.filter((dn) => document.querySelector(`[data-wday="${dn}"]`).checked); if (!days.length) { t.checked = true; return; } D.POLICY.workWeek.days = days; render(); toast(L('حُدّث أسبوع العمل.', 'Work week updated.'), 'ok'); }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { if (menuState) { closeMenu(); return; } if (S.overlay) { S.confirm = null; closeOverlay(); return; } if (S.navOpen) { S.navOpen = false; render(); } }
    if (ev.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { ev.preventDefault(); const g = document.getElementById('gsearch'); if (g) g.focus(); }
    if (ev.key === 'Enter' && ev.target.dataset.act === 'global-search') {
      const q = ev.target.value.trim(); if (!q) return;
      if (S.role === 'EMPLOYEE') { toast(L('البحث في الدليل متاح لفريق الموارد البشرية والمدير القُطري.', 'Directory search is available to HR and the Country Director.')); return; }
      if (S.role === 'CD') { const hit = dirFilteredFor(q)[0]; if (hit) openOverlay({ type: 'emp', id: hit.id }); else toast(L('لا نتائج', 'No results'), 'bad'); return; }
      S.dir.q = q; S.dir.page = 1; setView('employees');
    }
  });
  function dirFilteredFor(q) { const ql = q.toLowerCase(); return active().filter((e) => e.name.en.toLowerCase().includes(ql) || e.name.ar.includes(q) || e.staffNo.toLowerCase().includes(ql)); }

  // Tooltip for chart marks
  const tip = document.getElementById('tooltip');
  document.addEventListener('mousemove', (ev) => {
    const t = ev.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.innerHTML = t.dataset.tip; tip.hidden = false;
    const w = tip.offsetWidth; const h = tip.offsetHeight;
    let x = ev.clientX + 12; if (x + w > innerWidth - 8) x = ev.clientX - w - 12;
    let y = ev.clientY - h - 10; if (y < 8) y = ev.clientY + 16;
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  });

  addEventListener('resize', closeMenu);
  document.addEventListener('scroll', () => { if (menuState) closeMenu(); }, true);
  load();
  document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr'; document.documentElement.dataset.theme = S.theme;
  document.getElementById('app').innerHTML = shell(skeletonHTML());
  setTimeout(render, 350);
  window.__hrsuite = { S, D, render, validateLeave, balances };
})();
