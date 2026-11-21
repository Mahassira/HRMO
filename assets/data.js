/* HRMO demo — synthetic data generator.
 * Everything here is fictitious. A seeded PRNG makes the dataset identical on every load,
 * while dates are generated relative to "today" so the demo always looks current. */
(function () {
  'use strict';

  // ---------- Seeded PRNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20261110);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const chance = (p) => rnd() < p;
  function weighted(pairs) { // [[value, weight], ...]
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = rnd() * total;
    for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
    return pairs[pairs.length - 1][0];
  }

  // ---------- Date helpers (local, date-only) ----------
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const daysSince = (s) => Math.round((today - new Date(s + 'T00:00:00')) / 86400000);
  const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

  // ---------- Policy sets ----------
  // One set per country of operation. Values are starting defaults drawn from the labour law of each
  // country and must be reviewed by legal counsel before production use. Every value is editable.
  const BASE_POLICY = {
    country: 'EG', currency: 'EGP',
    workWeek: { days: ['SUN', 'MON', 'TUE', 'WED', 'THU'], hoursPerDay: 8, startTime: '08:00' },
    workingDaysPerMonth: 22,
    probationMonths: 3,
    lateMarksThreshold: 3,
    consecutiveAbsenceCaseDays: 5,
    overtimeMultiplier: 1.35,
    overtimeMaxHoursPerDay: 2,
    meritMaxPercent: 10,
    bonusMaxPercent: 10,
    actingAllowancePercent: 10,
    actingMaxMonths: 4,
    warningValidityMonths: 12,
    resignationNoticeDays: 90,
    giftThreshold: 1500,
    travel: { perNight: { STANDARD: 900, HIGH: 1400 }, minHoursWithoutOvernight: 8 },
    flags: { sickInProbation: true, overtimePreApproval: true, reackOnNewVersion: true, deemedResignationAuto: false },
    care: { rrEveryWeeks: 6, rrDays: 5, burnoutNoLeaveMonths: 6, hardship: { A: 0, B: 10, C: 20 }, safetyEscalateMinutes: 60 },
    licenses: { alertDays: 60 },
    helpdesk: { slaBusinessDays: 3 },
    separation: { severanceMonthsPerYear: 0.5, redundancyNoticeDays: 90 },
    leave: {
      ANNUAL: { entitlementDays: 21, accrual: 'MONTHLY', minServiceMonths: 6, carryOverMaxDays: 0 },
      SICK: { fullPayDays: 30, halfPayDays: 60, notifyWithinHours: 48 },
      BEREAVEMENT: { daysPerEvent: 3 },
      MATERNITY: { durationWeeks: 17, minServiceDays: 0 },
      PATERNITY: { days: 1, useWithinWeeks: 1 },
      UNPAID: { minServiceMonths: 6, maxDaysPerYear: 20, noticeBusinessDays: 5 },
      COMP: { expiresAfterDays: 10 }
    }
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const POLICY_SETS = { EG: clone(BASE_POLICY), AE: clone(BASE_POLICY) };
  Object.assign(POLICY_SETS.AE, {
    country: 'AE', currency: 'AED',
    workWeek: { days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], hoursPerDay: 8, startTime: '08:30' },
    probationMonths: 6, overtimeMultiplier: 1.25, resignationNoticeDays: 30, giftThreshold: 200,
    travel: { perNight: { STANDARD: 250, HIGH: 400 }, minHoursWithoutOvernight: 8 },
    separation: { severanceMonthsPerYear: 0.7, redundancyNoticeDays: 30 }
  });
  Object.assign(POLICY_SETS.AE.leave, {
    ANNUAL: { entitlementDays: 30, accrual: 'MONTHLY', minServiceMonths: 6, carryOverMaxDays: 0 },
    SICK: { fullPayDays: 15, halfPayDays: 30, notifyWithinHours: 72 },
    BEREAVEMENT: { daysPerEvent: 5 },
    MATERNITY: { durationWeeks: 9, minServiceDays: 0 },
    PATERNITY: { days: 5, useWithinWeeks: 26 }
  });
  const POLICY = POLICY_SETS.EG;                 // company default = head-office country
  const COUNTRIES = [
    { id: 'EG', ar: 'مصر', en: 'Egypt', currency: 'EGP', law: { ar: 'قانون العمل المصري', en: 'Egyptian Labour Law' } },
    { id: 'AE', ar: 'الإمارات', en: 'United Arab Emirates', currency: 'AED', law: { ar: 'قانون العمل الإماراتي', en: 'UAE Labour Law' } }
  ];
  const BASE_CUR = 'EGP';
  const FX = { EGP: 1, AED: 13 };                 // illustrative rate for consolidated figures; editable

  // ---------- Reference data ----------
  const ORG = { ar: 'HRMO', en: 'HRMO' };
  // All branches report directly to the Cairo head office. `hardship` is the site-allowance band.
  const OFFICES = [
    { id: 'CAI', ar: 'القاهرة (الرئيسي)', en: 'Cairo Head Office', country: 'EG', head: true, hardship: 'A' },
    { id: 'DAM', ar: 'فرع دمياط', en: 'Damietta Branch', country: 'EG', parent: 'CAI', hardship: 'B' },
    { id: 'SOK', ar: 'فرع السخنة', en: 'Ain Sokhna Branch', country: 'EG', parent: 'CAI', hardship: 'B' },
    { id: 'SAF', ar: 'فرع سفاجا', en: 'Safaga Branch', country: 'EG', parent: 'CAI', hardship: 'C' },
    { id: 'DXB', ar: 'فرع دبي', en: 'Dubai Branch', country: 'AE', parent: 'CAI', hardship: 'A' }
  ];
  // Cost centres. A cost centre backed by a client contract has a near end date (staffing risk).
  const far = iso(addMonths(today, 60));
  const GRANTS = [
    { id: 'CC-101', ar: 'الشحن البحري والجوي', en: 'Sea & Air Freight', kind: { ar: 'خط أعمال', en: 'Business line' }, end: far },
    { id: 'CC-102', ar: 'عقد تشغيل محطة الحاويات', en: 'Container Terminal Handling Contract', kind: { ar: 'عقد عميل', en: 'Client contract' }, end: iso(addMonths(today, 2)) },
    { id: 'CC-103', ar: 'التخليص الجمركي', en: 'Customs Clearance', kind: { ar: 'خط أعمال', en: 'Business line' }, end: far },
    { id: 'CC-104', ar: 'النقل البري والتخزين', en: 'Inland Transport & Warehousing', kind: { ar: 'عقد عميل', en: 'Client contract' }, end: iso(addMonths(today, 9)) },
    { id: 'CC-105', ar: 'الإدارة العامة', en: 'Corporate Overhead', kind: { ar: 'مصروفات عامة', en: 'Overhead' }, end: far }
  ];
  // dept: [id, ar, en, weight, primary cost centre, positions[[ar,en,grade]], office weights]
  const DEPTS = [
    ['OPS', 'عمليات الشحن', 'Freight Operations', 22, 'CC-101', [['منسق/ة عمليات شحن', 'Freight Operations Coordinator', 5], ['مسؤول/ة شحن بحري', 'Sea Freight Officer', 6], ['مسؤول/ة شحن جوي', 'Air Freight Officer', 6], ['موظف/ة مستندات شحن', 'Shipping Documentation Clerk', 4], ['مشرف/ة عمليات', 'Operations Supervisor', 7]], { CAI: 12, DAM: 4, SOK: 4, SAF: 2, DXB: 5 }],
    ['CUS', 'التخليص الجمركي', 'Customs Clearance', 15, 'CC-103', [['مخلص/ة جمركي/ة', 'Customs Broker', 6], ['مندوب/ة تخليص', 'Clearance Agent', 4], ['موظف/ة تعريفة جمركية', 'Tariff Clerk', 5], ['مشرف/ة تخليص', 'Clearance Supervisor', 7]], { CAI: 4, DAM: 4, SOK: 4, SAF: 2, DXB: 2 }],
    ['PRT', 'عمليات الموانئ', 'Port Operations', 24, 'CC-102', [['مشرف/ة ساحة', 'Yard Supervisor', 7], ['مخطط/ة سفن', 'Vessel Planner', 6], ['مشغل ونش', 'Crane Operator', 5], ['مراقب/ة حاويات', 'Container Tally Clerk', 3], ['مشغل رافعة شوكية', 'Forklift Operator', 3], ['عامل شحن وتفريغ', 'Stevedore', 2]], { CAI: 1, DAM: 9, SOK: 9, SAF: 6 }],
    ['TRN', 'النقل البري', 'Inland Transport', 15, 'CC-104', [['مشرف/ة أسطول', 'Fleet Supervisor', 7], ['منسق/ة حركة', 'Dispatcher', 4], ['سائق شاحنة', 'Truck Driver', 3], ['فني صيانة', 'Maintenance Technician', 4]], { CAI: 3, DAM: 4, SOK: 5, SAF: 2, DXB: 1 }],
    ['WHS', 'المستودعات', 'Warehousing', 11, 'CC-104', [['مشرف/ة مستودع', 'Warehouse Supervisor', 7], ['أمين/ة مستودع', 'Storekeeper', 4], ['عامل مستودع', 'Warehouse Worker', 2]], { CAI: 3, DAM: 2, SOK: 3, SAF: 1, DXB: 3 }],
    ['FIN', 'المالية', 'Finance', 11, 'CC-105', [['رئيس/ة حسابات', 'Chief Accountant', 7], ['محاسب/ة', 'Accountant', 5], ['مسؤول/ة مالي/ة', 'Finance Officer', 6], ['محصل/ة', 'Collections Officer', 4]], { CAI: 8, DAM: 1, SOK: 1, DXB: 2 }],
    ['HRM', 'الموارد البشرية', 'Human Resources', 5, 'CC-105', [['مسؤول/ة موارد بشرية', 'HR Officer', 6], ['مساعد/ة موارد بشرية', 'HR Assistant', 4]], { CAI: 4, DXB: 1 }],
    ['COM', 'المبيعات وخدمة العملاء', 'Sales & Customer Service', 16, 'CC-101', [['مدير/ة حسابات عملاء', 'Key Account Manager', 7], ['مسؤول/ة مبيعات', 'Sales Executive', 6], ['مسؤول/ة تسعير', 'Pricing Officer', 5], ['موظف/ة خدمة عملاء', 'Customer Service Agent', 4]], { CAI: 9, DAM: 1, SOK: 1, DXB: 5 }],
    ['HSE', 'السلامة والأمن', 'HSE & Security', 10, 'CC-105', [['مسؤول/ة بضائع خطرة', 'Dangerous Goods Officer', 7], ['مسؤول/ة سلامة وصحة مهنية', 'HSE Officer', 6], ['مسؤول أمن ميناء', 'Port Security Officer', 5], ['حارس', 'Guard', 2]], { CAI: 1, DAM: 3, SOK: 3, SAF: 2, DXB: 1 }],
    ['ADM', 'الإدارة وتقنية المعلومات', 'Administration & IT', 9, 'CC-105', [['مسؤول/ة تقنية معلومات', 'IT Officer', 6], ['مسؤول/ة إداري/ة', 'Admin Officer', 5], ['مساعد/ة إداري/ة', 'Admin Assistant', 4], ['موظف/ة استقبال', 'Receptionist', 3]], { CAI: 6, DAM: 1, SOK: 1, SAF: 1, DXB: 2 }]
  ];
  // Monthly base pay by grade, in the currency of the country of employment (fictitious scales).
  const GRADE_BASE = {
    EGP: { 1: 7000, 2: 8500, 3: 10500, 4: 13500, 5: 18000, 6: 25000, 7: 36000, 8: 55000, 9: 85000 },
    AED: { 1: 2200, 2: 2800, 3: 3600, 4: 4800, 5: 6500, 6: 9000, 7: 13000, 8: 19000, 9: 28000 }
  };
  const STIPEND = { EGP: { INTERN: 5000, DAILY: 7000 }, AED: { INTERN: 2000, DAILY: 2200 } };
  const MALE_ONLY = new Set(['مشغل ونش', 'مشغل رافعة شوكية', 'عامل شحن وتفريغ', 'سائق شاحنة', 'فني صيانة', 'عامل مستودع', 'مسؤول أمن ميناء', 'حارس']);

  const MALE = [['أحمد', 'Ahmed'], ['محمد', 'Mohamed'], ['عمر', 'Omar'], ['خالد', 'Khaled'], ['يوسف', 'Youssef'], ['إبراهيم', 'Ibrahim'], ['سامي', 'Sami'], ['كريم', 'Karim'], ['طارق', 'Tarek'], ['حسن', 'Hassan'], ['علي', 'Ali'], ['مازن', 'Mazen'], ['رامي', 'Rami'], ['هاني', 'Hany'], ['نبيل', 'Nabil'], ['زياد', 'Ziad'], ['وليد', 'Walid'], ['ماهر', 'Maher'], ['مصطفى', 'Mostafa'], ['محمود', 'Mahmoud'], ['حسام', 'Hossam'], ['شريف', 'Sherif'], ['تامر', 'Tamer'], ['عماد', 'Emad']];
  const FEMALE = [['لينا', 'Lina'], ['سارة', 'Sara'], ['مريم', 'Mariam'], ['نور', 'Nour'], ['هبة', 'Heba'], ['ريم', 'Reem'], ['دينا', 'Dina'], ['رنا', 'Rana'], ['ياسمين', 'Yasmin'], ['آلاء', 'Alaa'], ['منى', 'Mona'], ['سلمى', 'Salma'], ['هالة', 'Hala'], ['أسماء', 'Asmaa'], ['إيمان', 'Iman'], ['نادية', 'Nadia'], ['جنى', 'Jana'], ['ليلى', 'Layla'], ['شيماء', 'Shaimaa'], ['ندى', 'Nada']];
  const FAMILY = [['حداد', 'Haddad'], ['منصور', 'Mansour'], ['صالح', 'Saleh'], ['خليل', 'Khalil'], ['ناصر', 'Nasser'], ['عيسى', 'Eissa'], ['يونس', 'Younis'], ['سليمان', 'Soliman'], ['حمدان', 'Hamdan'], ['بكر', 'Bakr'], ['شاهين', 'Shaheen'], ['الخطيب', 'Al-Khatib'], ['النجار', 'El-Naggar'], ['دياب', 'Diab'], ['فارس', 'Fares'], ['زيدان', 'Zidan'], ['رضوان', 'Radwan'], ['سعيد', 'Saeed'], ['جابر', 'Gaber'], ['قاسم', 'Kassem'], ['عثمان', 'Othman'], ['مصطفى', 'Mostafa'], ['درويش', 'Darwish'], ['الشناوي', 'El-Shenawy'], ['السيد', 'El-Sayed'], ['فهمي', 'Fahmy'], ['غنيم', 'Ghoneim'], ['البنا', 'El-Banna'], ['عبد الرحمن', 'Abdelrahman'], ['الجمال', 'El-Gammal']];

  const POLICIES = [
    { code: 'EMPLOYEE_HANDBOOK', ar: 'دليل الموظف', en: 'Employee Handbook', v: '2.1' },
    { code: 'CODE_OF_CONDUCT', ar: 'مدونة السلوك والأخلاقيات', en: 'Code of Conduct and Ethics', v: '3.0' },
    { code: 'HSE_POLICY', ar: 'السلامة والصحة المهنية وأمن الموانئ', en: 'Health, Safety & Port Security', v: '1.4' },
    { code: 'ANTI_HARASSMENT', ar: 'مكافحة التحرش', en: 'Anti-Harassment', v: '1.2' },
    { code: 'CONFIDENTIALITY_NDA', ar: 'السرية وعدم الإفصاح', en: 'Confidentiality & Non-Disclosure', v: '1.0' },
    { code: 'ANTI_FRAUD', ar: 'مكافحة الرشوة والنزاهة الجمركية', en: 'Anti-Bribery & Customs Integrity', v: '2.0' },
    { code: 'DATA_PRIVACY_NOTICE', ar: 'حماية البيانات', en: 'Data Protection Notice', v: '1.1' }
  ];
  const TRAININGS = [
    { code: 'HSE', ar: 'أساسيات السلامة والصحة المهنية', en: 'Occupational health & safety essentials' },
    { code: 'HARASS', ar: 'منع التحرش في بيئة العمل', en: 'Preventing workplace harassment' },
    { code: 'FRAUD', ar: 'مكافحة الرشوة والنزاهة الجمركية', en: 'Anti-bribery & customs integrity' },
    { code: 'ISPS', ar: 'التوعية بأمن الموانئ (ISPS)', en: 'Port security awareness (ISPS)' }
  ];

  const Y = today.getFullYear();
  const HOLIDAYS = [
    { date: `${Y}-01-07`, ar: 'عيد الميلاد المجيد', en: 'Coptic Christmas', country: 'EG' },
    { date: `${Y}-01-25`, ar: 'عيد الشرطة وثورة 25 يناير', en: 'Revolution & Police Day', country: 'EG' },
    { date: `${Y}-04-25`, ar: 'عيد تحرير سيناء', en: 'Sinai Liberation Day', country: 'EG' },
    { date: `${Y}-05-01`, ar: 'عيد العمال', en: 'Labour Day', country: 'EG' },
    { date: `${Y}-07-23`, ar: 'ذكرى ثورة 23 يوليو', en: 'Revolution Day (23 July)', country: 'EG' },
    { date: `${Y}-10-06`, ar: 'عيد القوات المسلحة', en: 'Armed Forces Day', country: 'EG' },
    { date: `${Y}-01-01`, ar: 'رأس السنة الميلادية', en: "New Year's Day", country: 'AE' },
    { date: `${Y}-12-02`, ar: 'عيد الاتحاد', en: 'UAE National Day', country: 'AE' },
    { date: `${Y}-12-03`, ar: 'عيد الاتحاد', en: 'UAE National Day', country: 'AE' },
    { date: iso(addDays(today, 12)), ar: 'عطلة رسمية (نموذجية)', en: 'Public holiday (sample)' },
    { date: iso(addDays(today, 40)), ar: 'عطلة رسمية (نموذجية)', en: 'Public holiday (sample)' }
  ].sort((a, b) => (a.date < b.date ? -1 : 1));

  // ---------- Employees ----------
  const N = 150;
  const employees = [];
  const usedNames = new Set();
  function makeName(g) {
    for (let k = 0; k < 50; k++) {
      const f = pick(g === 'F' ? FEMALE : MALE), m = pick(MALE), l = pick(FAMILY);
      const key = f[1] + m[1] + l[1];
      if (!usedNames.has(key) || k === 49) { usedNames.add(key); return { ar: `${f[0]} ${m[0]} ${l[0]}`, en: `${f[1]} ${m[1]} ${l[1]}`, short: { ar: `${f[0]} ${l[0]}`, en: `${f[1]} ${l[1]}` } }; }
    }
  }
  const deptPairs = DEPTS.map((d) => [d, d[3]]);
  const officeById = (id) => OFFICES.find((o) => o.id === id);
  const curOf = (officeId) => POLICY_SETS[officeById(officeId).country].currency;
  const round = (v, cur) => { const step = cur === 'EGP' ? 50 : 10; return Math.round(v / step) * step; };

  for (let i = 0; i < N; i++) {
    const d = weighted(deptPairs);
    const pos = pick(d[5]);
    const g = MALE_ONLY.has(pos[0]) ? 'M' : (chance(0.36) ? 'F' : 'M');
    const office = officeById(weighted(Object.entries(d[6])));
    const pol = POLICY_SETS[office.country]; const cur = pol.currency;
    const category = weighted([['REGULAR', 80], ['FIXED_SHORT', 8], ['DAILY', 8], ['INTERN', 4]]);
    const serviceDays = category === 'INTERN' ? int(10, 85) : weighted([[int(5, 89), 8], [int(90, 365), 22], [int(366, 1460), 45], [int(1461, 3300), 25]]);
    const hire = addDays(today, -serviceDays);
    const contractMonths = category === 'REGULAR' ? pick([12, 12, 12, 24]) : category === 'INTERN' ? 3 : pick([1, 2, 3]);
    let contractEnd = addMonths(hire, contractMonths);
    while (contractEnd <= today) contractEnd = addMonths(contractEnd, contractMonths);
    const grade = category === 'INTERN' ? 0 : category === 'DAILY' ? Math.min(pos[2], 2) : pos[2];
    const base = category === 'INTERN' ? STIPEND[cur].INTERN : category === 'DAILY' ? STIPEND[cur].DAILY
      : round(GRADE_BASE[cur][grade] * (1 + Math.min(serviceDays / 365, 8) * 0.03) * (0.96 + rnd() * 0.08), cur);
    const primary = d[4];
    let alloc;
    if (primary === 'CC-105') alloc = [{ grant: 'CC-105', pct: 100 }];
    else if (chance(0.3)) { const p = pick([60, 70, 80]); alloc = [{ grant: primary, pct: p }, { grant: 'CC-105', pct: 100 - p }]; }
    else alloc = [{ grant: primary, pct: 100 }];
    const name = makeName(g);
    const monthsThisYear = Math.min(today.getMonth() + 1, Math.ceil(serviceDays / 30.4));
    const perMonth = pol.leave.ANNUAL.entitlementDays / 12;
    const annualAccrued = category === 'REGULAR' ? +(monthsThisYear * perMonth).toFixed(2) : 0;
    const annualUsed = category === 'REGULAR' ? Math.min(Math.floor(annualAccrued), int(0, Math.floor(annualAccrued))) : 0;
    const sickUsed = chance(0.45) ? int(1, 6) : 0;
    employees.push({
      id: `E${String(i + 1).padStart(4, '0')}`,
      staffNo: `HRMO-${String(1000 + i)}`,
      name, gender: g,
      dept: d[0], deptName: { ar: d[1], en: d[2] },
      position: { ar: pos[0].replace(/\/ة/g, g === 'F' ? 'ة' : ''), en: pos[1] }, grade,
      office: office.id, country: office.country,
      category,
      hireDate: iso(hire), contractEnd: iso(contractEnd),
      probationEnd: iso(addMonths(hire, pol.probationMonths)),
      inProbation: addMonths(hire, pol.probationMonths) > today,
      baseSalary: base, currency: cur,
      alloc,
      leave: { annualAccrued, annualUsed, sickUsed, compDays: chance(0.08) ? int(1, 2) : 0, unpaidUsed: chance(0.05) ? int(1, 5) : 0 },
      lateMarks: weighted([[0, 70], [1, 14], [2, 9], [3, 5], [4, 2]]),
      ackMissing: POLICIES.filter(() => chance(0.035)).map((p) => p.code),
      trainingsDone: TRAININGS.filter(() => chance(0.88)).map((t) => t.code),
      screening: weighted([['CLEARED', 92], ['DUE', 7], ['ESCALATED', 1]]),
      warnings: chance(0.03) ? 1 : 0,
      rating: weighted([['OUTSTANDING', 10], ['VERY_GOOD', 30], ['SATISFACTORY', 48], ['NEEDS_IMPROVEMENT', 10], ['UNSATISFACTORY', 2]]),
      phone: `+000 10 ${int(100, 999)} ${int(1000, 9999)}`,
      email: '',
      managerId: null,
      staffType: office.country === 'AE' ? (chance(0.15) ? 'NATL' : 'INTL') : (chance(0.02) ? 'INTL' : 'NATL'),
      disability: chance(0.03)
    });
  }

  // ---------- Personas (fixed records so the demo story is stable) ----------
  function setPersona(idx, patch) { Object.assign(employees[idx], { category: 'REGULAR', inProbation: false, country: 'EG', currency: 'EGP', ackMissing: [], screening: 'CLEARED', lateMarks: 0, warnings: 0, staffType: 'NATL' }, patch); return employees[idx]; }
  const cd = setPersona(0, {
    name: { ar: 'سارة يوسف منصور', en: 'Sara Youssef Mansour', short: { ar: 'سارة منصور', en: 'Sara Mansour' } }, gender: 'F',
    dept: 'ADM', deptName: { ar: 'الإدارة العليا', en: 'Executive Management' }, position: { ar: 'المديرة العامة', en: 'General Manager' }, grade: 9,
    office: 'CAI', hireDate: iso(addDays(today, -1900)), contractEnd: iso(addMonths(today, 11)),
    baseSalary: 120000, alloc: [{ grant: 'CC-105', pct: 100 }], disability: false
  });
  const hrm = setPersona(1, {
    name: { ar: 'عمر خالد صالح', en: 'Omar Khaled Saleh', short: { ar: 'عمر صالح', en: 'Omar Saleh' } }, gender: 'M',
    dept: 'HRM', deptName: { ar: 'الموارد البشرية', en: 'Human Resources' }, position: { ar: 'مدير الموارد البشرية', en: 'HR Manager' }, grade: 8,
    office: 'CAI', hireDate: iso(addDays(today, -1400)), contractEnd: iso(addMonths(today, 9)),
    baseSalary: 62000, alloc: [{ grant: 'CC-105', pct: 100 }]
  });
  const hmgr = setPersona(2, {
    name: { ar: 'خليل إبراهيم الخطيب', en: 'Khalil Ibrahim Al-Khatib', short: { ar: 'خليل الخطيب', en: 'Khalil Al-Khatib' } }, gender: 'M',
    dept: 'OPS', deptName: { ar: 'عمليات الشحن', en: 'Freight Operations' }, position: { ar: 'مدير عمليات الشحن', en: 'Freight Operations Manager' }, grade: 8,
    office: 'CAI', hireDate: iso(addDays(today, -2200)), contractEnd: iso(addMonths(today, 14)), baseSalary: 64000,
    alloc: [{ grant: 'CC-101', pct: 80 }, { grant: 'CC-105', pct: 20 }]
  });
  const me = setPersona(3, {
    name: { ar: 'لينا محمد حداد', en: 'Lina Mohamed Haddad', short: { ar: 'لينا حداد', en: 'Lina Haddad' } }, gender: 'F',
    dept: 'OPS', deptName: { ar: 'عمليات الشحن', en: 'Freight Operations' }, position: { ar: 'مسؤولة شحن بحري', en: 'Sea Freight Officer' }, grade: 6,
    office: 'CAI', hireDate: iso(addDays(today, -790)), contractEnd: iso(addMonths(today, 5)),
    baseSalary: 27500, alloc: [{ grant: 'CC-101', pct: 70 }, { grant: 'CC-105', pct: 30 }],
    leave: { annualAccrued: +((today.getMonth() + 1) * 1.75).toFixed(2), annualUsed: 6, sickUsed: 2, compDays: 1, unpaidUsed: 0 },
    lateMarks: 1, ackMissing: ['HSE_POLICY'], trainingsDone: ['HSE', 'HARASS', 'ISPS'], rating: 'VERY_GOOD', disability: false
  });
  // Branch managers: each branch reports directly to the head office (the General Manager).
  const BM = [
    ['DAM', 4, 'M', ['طارق', 'Tarek'], ['محمود', 'Mahmoud'], ['الشناوي', 'El-Shenawy'], 58000, -2100],
    ['SOK', 5, 'M', ['حسام', 'Hossam'], ['علي', 'Ali'], ['غنيم', 'Ghoneim'], 60000, -1650],
    ['SAF', 6, 'M', ['وليد', 'Walid'], ['أحمد', 'Ahmed'], ['رضوان', 'Radwan'], 56000, -1200],
    ['DXB', 7, 'F', ['هالة', 'Hala'], ['سامي', 'Sami'], ['فهمي', 'Fahmy'], 21000, -980]
  ];
  const branchMgr = {};
  BM.forEach(([off, idx, g, f, m, l, pay, hired]) => {
    const o = officeById(off); const fem = g === 'F';
    branchMgr[off] = setPersona(idx, {
      name: { ar: `${f[0]} ${m[0]} ${l[0]}`, en: `${f[1]} ${m[1]} ${l[1]}`, short: { ar: `${f[0]} ${l[0]}`, en: `${f[1]} ${l[1]}` } }, gender: g,
      dept: 'OPS', deptName: { ar: 'إدارة الفروع', en: 'Branch Management' },
      position: { ar: `${fem ? 'مديرة' : 'مدير'} ${o.ar}`, en: `${o.en} Manager` }, grade: 8,
      office: off, country: o.country, currency: curOf(off), baseSalary: pay,
      hireDate: iso(addDays(today, hired)), contractEnd: iso(addMonths(today, 10 + idx)),
      alloc: [{ grant: 'CC-105', pct: 100 }], staffType: off === 'DXB' ? 'INTL' : 'NATL', disability: false
    });
  });

  // Hierarchy: General Manager → head-office department heads and branch managers → supervisors → staff.
  const fixed = new Set([cd, hrm, hmgr, me, ...Object.values(branchMgr)].map((x) => x.id));
  const heads = { OPS: hmgr.id, HRM: hrm.id };
  [7, 6, 5].forEach((g) => employees.forEach((e) => {
    if (!heads[e.dept] && e.grade >= g && !fixed.has(e.id) && e.country === 'EG' && e.category === 'REGULAR') { heads[e.dept] = e.id; e.office = 'CAI'; }
  }));
  const headIds = new Set(Object.values(heads));
  DEPTS.forEach((d) => { const h = employees.find((x) => x.id === heads[d[0]]); if (!h || fixed.has(h.id)) return;
    Object.assign(h, { position: { ar: `${h.gender === 'F' ? 'مديرة' : 'مدير'} ${d[1]}`, en: `${d[2]} Manager` }, grade: 8, baseSalary: round(GRADE_BASE.EGP[8] * (0.97 + (h.id.charCodeAt(4) % 7) / 100), 'EGP'), inProbation: false, alloc: [{ grant: d[4], pct: 100 }] });
    if (daysSince(h.hireDate) < 400) { h.hireDate = iso(addDays(today, -(700 + h.id.charCodeAt(4) * 9))); h.probationEnd = iso(addMonths(new Date(h.hireDate), 3)); } });
  const groups = {};
  employees.forEach((e) => { if (!fixed.has(e.id) && !headIds.has(e.id)) (groups[e.dept + e.office] = groups[e.dept + e.office] || []).push(e); });
  Object.values(groups).forEach((g) => {
    g.sort((a, b) => b.grade - a.grade);
    const parent = g[0].office === 'CAI' ? (heads[g[0].dept] || cd.id) : branchMgr[g[0].office].id;
    const sup = g.length >= 4 && g[0].grade >= 4 && g[0].category === 'REGULAR' ? g[0] : null;
    g.forEach((e) => { e.managerId = sup && e !== sup ? sup.id : parent; });
  });
  headIds.forEach((id) => { employees.find((x) => x.id === id).managerId = cd.id; });
  Object.values(branchMgr).forEach((b) => { b.managerId = cd.id; });
  // The freight operations manager's own team (the "Line manager" persona)
  employees.filter((e) => e.dept === 'OPS' && e.office === 'CAI' && !fixed.has(e.id)).forEach((e) => { e.managerId = hmgr.id; });
  me.managerId = hmgr.id; hmgr.managerId = cd.id; hrm.managerId = cd.id; cd.managerId = null;

  // A few deliberate cases so dashboards always have something to show
  employees.filter((e, i) => i >= 10 && e.country === 'EG' && !headIds.has(e.id)).slice(0, 6).forEach((e, k) => { e.category = 'REGULAR'; e.inProbation = true; e.hireDate = iso(addDays(today, -(80 + k))); e.probationEnd = iso(addDays(today, 10 - k)); if (!e.grade) { e.grade = 3; e.baseSalary = GRADE_BASE.EGP[3]; } });
  employees.slice(20, 34).forEach((e, k) => { e.contractEnd = iso(addDays(today, 8 + k * 4)); });
  employees.slice(40, 44).forEach((e) => { e.lateMarks = 3 + (e.id.charCodeAt(4) % 2); });

  // ---------- Leave requests ----------
  const LT = ['ANNUAL', 'ANNUAL', 'ANNUAL', 'SICK', 'SICK', 'COMP', 'BEREAVEMENT', 'UNPAID'];
  const leaveRequests = [];
  for (let k = 0; k < 30; k++) {
    const e = employees[int(8, N - 1)];
    if (e.category !== 'REGULAR') continue;
    const type = pick(LT);
    const start = addDays(today, int(-20, 30));
    const days = type === 'SICK' ? int(1, 3) : type === 'BEREAVEMENT' ? int(2, 3) : int(1, 6);
    const status = start < today ? weighted([['APPROVED', 9], ['REJECTED', 1]]) : weighted([['PENDING_MANAGER', 4], ['PENDING_HR', 5], ['APPROVED', 6]]);
    leaveRequests.push({ id: `LR-${String(2400 + k)}`, empId: e.id, type, from: iso(start), days, to: iso(addDays(start, days + Math.floor(days / 5) * 2)), status, reason: '', submitted: iso(addDays(start, -int(2, 12))) });
  }
  leaveRequests.push({ id: 'LR-2399', empId: me.id, type: 'ANNUAL', from: iso(addDays(today, -48)), to: iso(addDays(today, -44)), days: 3, status: 'APPROVED', submitted: iso(addDays(today, -60)), reason: '' });
  leaveRequests.push({ id: 'LR-2398', empId: me.id, type: 'SICK', from: iso(addDays(today, -21)), to: iso(addDays(today, -20)), days: 2, status: 'APPROVED', submitted: iso(addDays(today, -19)), reason: '' });

  // ---------- Recruitment ----------
  const STAGES = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'EVALUATION', 'SCREENING', 'OFFER'];
  const vacancies = [
    { id: 'VAC-031', ar: 'مخلص/ة جمركي/ة', en: 'Customs Broker', dept: 'CUS', office: 'DAM', grade: 6, opened: iso(addDays(today, -26)), closes: iso(addDays(today, 4)) },
    { id: 'VAC-032', ar: 'مسؤول/ة مبيعات', en: 'Sales Executive', dept: 'COM', office: 'DXB', grade: 6, opened: iso(addDays(today, -18)), closes: iso(addDays(today, 10)) },
    { id: 'VAC-033', ar: 'محاسب/ة', en: 'Accountant', dept: 'FIN', office: 'CAI', grade: 5, opened: iso(addDays(today, -35)), closes: iso(addDays(today, -5)) },
    { id: 'VAC-034', ar: 'مشرف/ة ساحة', en: 'Yard Supervisor', dept: 'PRT', office: 'SOK', grade: 7, opened: iso(addDays(today, -9)), closes: iso(addDays(today, 19)) }
  ];
  const candidates = [];
  vacancies.forEach((v, vi) => {
    const n = [11, 8, 9, 6][vi];
    for (let k = 0; k < n; k++) {
      const g = chance(0.4) ? 'F' : 'M';
      const stage = weighted([['APPLIED', 4], ['SHORTLISTED', 3], ['INTERVIEW', 2], ['EVALUATION', 1.4], ['SCREENING', 1], ['OFFER', 0.5]]);
      const si = STAGES.indexOf(stage);
      candidates.push({
        id: `C-${v.id.slice(4)}-${k + 1}`, vacancy: v.id, name: makeName(g), gender: g, stage,
        score: si >= 2 ? int(58, 92) : null,
        evals: si >= 3 ? { submitted: si >= 4 ? 3 : int(1, 3), required: 3 } : { submitted: 0, required: 3 },
        refs: si >= 4 ? int(1, 2) : 0,
        screening: si >= 5 ? 'CLEARED' : si === 4 ? weighted([['PENDING', 3], ['CLEARED', 2]]) : 'NOT_STARTED',
        internal: chance(0.12),
        years: int(1, 12)
      });
    }
  });
  // Guarantee one candidate blocked at screening and one ready for offer (story)
  const c33 = candidates.filter((c) => c.vacancy === 'VAC-033');
  Object.assign(c33[0], { stage: 'SCREENING', screening: 'PENDING', evals: { submitted: 3, required: 3 }, refs: 2, score: 86, mds: false });
  Object.assign(c33[1], { stage: 'SCREENING', screening: 'CLEARED', evals: { submitted: 3, required: 3 }, refs: 2, score: 81 });
  Object.assign(c33[2], { stage: 'EVALUATION', screening: 'NOT_STARTED', evals: { submitted: 2, required: 3 }, refs: 0, score: 77 });

  // ---------- General Manager approvals ----------
  const reg = employees.filter((x, i) => i >= 8 && x.category === 'REGULAR' && !x.inProbation && x.country === 'EG' && !headIds.has(x.id));
  const e = (i) => reg[i % reg.length];
  const approvals = [
    { id: 'AP-501', type: 'HIRE', requester: hrm.id, created: iso(addDays(today, -1)), status: 'PENDING',
      data: { candidate: { ar: 'نور سليمان فهمي', en: 'Nour Soliman Fahmy' }, vacancy: 'VAC-031', rank: 1, score: 88, panel: 3, evals: '3/3', refs: '2/2', screening: 'CLEARED', salary: 26000, start: iso(addDays(today, 14)) },
      rules: ['RC-008', 'RC-013', 'RC-014', 'RC-015'] },
    { id: 'AP-502', type: 'SALARY_INCREASE', requester: hmgr.id, subject: e(11).id, created: iso(addDays(today, -2)), status: 'PENDING',
      data: { percent: 8, rating: 'VERY_GOOD', months: 12, renewed: 12, from: e(11).baseSalary }, rules: ['CP-010', 'CP-011', 'CP-012'] },
    { id: 'AP-503', type: 'UNPAID_LEAVE', requester: e(37).managerId, subject: e(37).id, created: iso(addDays(today, -1)), status: 'PENDING',
      data: { days: 12, from: iso(addDays(today, 9)), usedThisYear: 0, service: 26 }, rules: ['LV-060', 'LV-061', 'LV-062', 'LV-063'] },
    { id: 'AP-504', type: 'NEW_POSITION', requester: branchMgr.SOK.id, created: iso(addDays(today, -3)), status: 'PENDING',
      data: { title: { ar: 'مشرف/ة وردية', en: 'Shift Supervisor' }, grade: 7, office: 'SOK', grant: 'CC-102', months: 12, budget: 36000 }, rules: ['RC-001', 'RC-002'] },
    { id: 'AP-505', type: 'WARNING', requester: hrm.id, subject: employees[41].id, created: iso(addDays(today, -1)), status: 'PENDING',
      data: { level: 'WRITTEN_WARNING_1', reason: { ar: 'تكرار التأخير: 4 علامات هذا الشهر', en: 'Repeated lateness: 4 late marks this month' }, response: true }, rules: ['WT-013', 'DG-002', 'DG-003'] },
    { id: 'AP-506', type: 'ACTING', requester: hrm.id, subject: e(23).id, created: iso(addDays(today, -4)), status: 'PENDING',
      data: { months: 3, allowance: 10, position: { ar: 'مشرف/ة مستودع (بالتكليف)', en: 'Warehouse Supervisor (acting)' } }, rules: ['LC-030', 'LC-031', 'LC-032'] },
    { id: 'AP-507', type: 'SALARY_INCREASE', requester: e(52).managerId, subject: e(52).id, created: iso(addDays(today, -5)), status: 'PENDING',
      data: { percent: 14, rating: 'OUTSTANDING', months: 12, renewed: 12, from: e(52).baseSalary }, rules: ['CP-010', 'CP-011'] }
  ];

  // ---------- Separations (last 12 months, for turnover) ----------
  const separations = [];
  for (let k = 0; k < 14; k++) separations.push({ date: iso(addDays(today, -int(5, 360))), type: weighted([['RESIGNATION', 6], ['CONTRACT_END', 5], ['REDUNDANCY', 1], ['DISCIPLINARY', 0.5]]), dept: weighted(deptPairs)[0] });
  { const spread = ['CAI', 'CAI', 'CAI', 'CAI', 'DAM', 'DAM', 'SOK', 'SOK', 'SAF', 'DXB']; separations.forEach((s, k) => { s.office = spread[(k * 7) % 10]; }); }

  // E-mail follows the final name (the demo personas are renamed after generation).
  employees.forEach((x, i) => { const w = x.name.en.split(' '); x.email = `${w[0].toLowerCase()}.${w[w.length - 1].toLowerCase().replace(/[^a-z]/g, '')}${i}@example.com`; });

  // ---------- Activity feed seed ----------
  const activity = [
    { id: 'A1', role: 'EMPLOYEE', ch: 'teams', at: iso(addDays(today, -1)), ar: 'تذكير: الإقرار بسياسة السلامة والصحة المهنية وأمن الموانئ (إصدار 1.4)', en: 'Reminder: acknowledge the Health, Safety & Port Security policy (v1.4)', go: 'policies' },
    { id: 'A2', role: 'EMPLOYEE', ch: 'outlook', at: iso(addDays(today, -6)), ar: 'قسيمة الراتب متاحة الآن', en: 'Your payslip is available', go: 'pay' },
    { id: 'A3', role: 'HR', ch: 'teams', at: iso(today), ar: '6 موظفين تنتهي فترة تجربتهم خلال 14 يوماً', en: '6 employees finish probation within 14 days', go: 'dashboard' },
    { id: 'A4', role: 'HR', ch: 'outlook', at: iso(addDays(today, -1)), ar: 'المرشح للوظيفة VAC-033 بانتظار نتيجة الفحص الأمني', en: 'VAC-033 candidate awaiting background screening', go: 'recruitment' },
    { id: 'A5', role: 'CD', ch: 'teams', at: iso(today), ar: '7 طلبات بانتظار اعتمادك', en: '7 requests awaiting your approval', go: 'approvals' },
    { id: 'A6', role: 'CD', ch: 'outlook', at: iso(addDays(today, -2)), ar: 'عقد تشغيل محطة الحاويات CC-102 ينتهي خلال شهرين: وظائف مرتبطة به', en: 'Terminal handling contract CC-102 ends in 2 months: linked positions', go: 'dashboard' }
  ];

  window.HRDATA = {
    ORG, OFFICES, COUNTRIES, POLICY_SETS, BASE_CUR, FX, GRANTS, DEPTS: DEPTS.map((d) => ({ id: d[0], ar: d[1], en: d[2] })), POLICY, POLICIES, TRAININGS, HOLIDAYS,
    employees, leaveRequests, vacancies, candidates, STAGES, approvals, separations, activity,
    personas: { EMPLOYEE: me.id, HR: hrm.id, CD: cd.id, MANAGER: hmgr.id },
    branchManagers: Object.fromEntries(Object.entries(branchMgr).map(([k, v]) => [k, v.id])),
    todayISO: iso(today)
  };
})();
