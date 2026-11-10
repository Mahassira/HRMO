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
  const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

  // ---------- Default policy (subset of data/config-defaults/policy-defaults.json) ----------
  const POLICY = {
    workWeek: { days: ['SUN', 'MON', 'TUE', 'WED', 'THU'], hoursPerDay: 8, startTime: '08:00' },
    workingDaysPerMonth: 22,
    probationMonths: 3,
    lateMarksThreshold: 3,
    consecutiveAbsenceCaseDays: 5,
    overtimeMultiplier: 1.5,
    overtimeMaxHoursPerDay: 2,
    meritMaxPercent: 5,
    bonusMaxPercent: 5,
    actingAllowancePercent: 10,
    actingMaxMonths: 4,
    warningValidityMonths: 12,
    resignationNoticeDays: 30,
    flags: { sickInProbation: true, overtimePreApproval: true, reackOnNewVersion: true, deemedResignationAuto: false },
    leave: {
      ANNUAL: { entitlementDays: 21, accrual: 'MONTHLY', minServiceMonths: 3, carryOverMaxDays: 0 },
      SICK: { fullPayDays: 21, halfPayDays: 21, notifyWithinHours: 48 },
      BEREAVEMENT: { daysPerEvent: 5 },
      MATERNITY: { durationWeeks: 13, minServiceDays: 180 },
      PATERNITY: { days: 5, useWithinWeeks: 4 },
      UNPAID: { minServiceMonths: 6, maxDaysPerYear: 20, noticeBusinessDays: 5 },
      COMP: { expiresAfterDays: 10 }
    }
  };

  // ---------- Reference data ----------
  const ORG = { ar: 'منظمة نموذجية للإغاثة', en: 'Sample Relief Organization' };
  const OFFICES = [
    { id: 'MO', ar: 'المكتب الرئيسي', en: 'Main Office', w: 34 },
    { id: 'NF', ar: 'المكتب الميداني الشمالي', en: 'North Field Office', w: 20 },
    { id: 'SF', ar: 'المكتب الميداني الجنوبي', en: 'South Field Office', w: 20 },
    { id: 'CF', ar: 'المكتب الميداني الأوسط', en: 'Central Field Office', w: 15 },
    { id: 'EF', ar: 'المكتب الميداني الشرقي', en: 'East Field Office', w: 11 }
  ];
  const GRANTS = [
    { id: 'GR-101', ar: 'الرعاية الصحية الأولية', en: 'Primary Health Care', donor: { ar: 'المانح أ', en: 'Donor A' }, end: iso(addMonths(today, 14)) },
    { id: 'GR-102', ar: 'التغذية الطارئة', en: 'Emergency Nutrition', donor: { ar: 'المانح ب', en: 'Donor B' }, end: iso(addMonths(today, 2)) },
    { id: 'GR-103', ar: 'المياه والصرف الصحي', en: 'WASH', donor: { ar: 'المانح ج', en: 'Donor C' }, end: iso(addMonths(today, 9)) },
    { id: 'GR-104', ar: 'الحماية والدعم النفسي', en: 'Protection & MHPSS', donor: { ar: 'المانح أ', en: 'Donor A' }, end: iso(addMonths(today, 20)) },
    { id: 'GR-105', ar: 'دعم التكاليف الأساسية', en: 'Core Support', donor: { ar: 'تمويل غير مقيد', en: 'Unrestricted' }, end: iso(addMonths(today, 30)) }
  ];
  // dept: [id, ar, en, weight, primary grant, positions[[ar,en,grade]]]
  const DEPTS = [
    ['HEA', 'الصحة', 'Health', 26, 'GR-101', [['طبيب عام', 'General Practitioner', 7], ['ممرض/ة', 'Nurse', 5], ['قابلة', 'Midwife', 5], ['صيدلاني/ة', 'Pharmacist', 6], ['مسؤول/ة صحي/ة', 'Health Officer', 6], ['عامل/ة صحة مجتمعية', 'Community Health Worker', 3], ['فني/ة مختبر', 'Lab Technician', 4]]],
    ['NUT', 'التغذية', 'Nutrition', 12, 'GR-102', [['مسؤول/ة تغذية', 'Nutrition Officer', 6], ['مساعد/ة تغذية', 'Nutrition Assistant', 4], ['مثقف/ة تغذية', 'Nutrition Educator', 3]]],
    ['WSH', 'المياه والإصحاح', 'WASH', 10, 'GR-103', [['مهندس/ة مياه', 'WASH Engineer', 7], ['مسؤول/ة إصحاح', 'Hygiene Promotion Officer', 5], ['فني/ة صيانة', 'Maintenance Technician', 4]]],
    ['PRO', 'الحماية', 'Protection', 9, 'GR-104', [['مسؤول/ة حماية', 'Protection Officer', 6], ['مدير/ة حالة', 'Case Manager', 5], ['أخصائي/ة نفسي/ة', 'Psychologist', 6], ['ميسّر/ة مجتمعي/ة', 'Community Facilitator', 3]]],
    ['MEL', 'المتابعة والتقييم', 'MEAL', 5, 'GR-105', [['مسؤول/ة متابعة وتقييم', 'MEAL Officer', 6], ['مساعد/ة بيانات', 'Data Assistant', 4]]],
    ['FIN', 'المالية', 'Finance', 5, 'GR-105', [['محاسب/ة', 'Accountant', 5], ['مسؤول/ة مالي/ة', 'Finance Officer', 6], ['أمين/ة صندوق', 'Cashier', 4]]],
    ['HRM', 'الموارد البشرية', 'Human Resources', 4, 'GR-105', [['مسؤول/ة موارد بشرية', 'HR Officer', 6], ['مساعد/ة موارد بشرية', 'HR Assistant', 4]]],
    ['LOG', 'اللوجستيات', 'Logistics', 12, 'GR-105', [['مسؤول/ة لوجستيات', 'Logistics Officer', 6], ['أمين/ة مستودع', 'Storekeeper', 4], ['سائق', 'Driver', 3], ['مسؤول/ة مشتريات', 'Procurement Officer', 5]]],
    ['SEC', 'الأمن والخدمات', 'Security & Support', 12, 'GR-105', [['حارس', 'Guard', 2], ['عامل/ة نظافة', 'Cleaner', 1], ['مسؤول/ة أمن', 'Security Officer', 5]]],
    ['ADM', 'الإدارة', 'Administration', 5, 'GR-105', [['مساعد/ة إداري/ة', 'Admin Assistant', 4], ['مسؤول/ة إداري/ة', 'Admin Officer', 5], ['موظف/ة استقبال', 'Receptionist', 3]]]
  ];
  const GRADE_BASE = { 1: 520, 2: 600, 3: 700, 4: 850, 5: 1050, 6: 1300, 7: 1650, 8: 2100, 9: 2700 };
  const SINGLE_GENDER = { 'قابلة': 'F', 'سائق': 'M', 'حارس': 'M' };

  const MALE = [['أحمد', 'Ahmad'], ['محمد', 'Mohammad'], ['عمر', 'Omar'], ['خالد', 'Khaled'], ['يوسف', 'Yousef'], ['إبراهيم', 'Ibrahim'], ['سامي', 'Sami'], ['كريم', 'Karim'], ['طارق', 'Tareq'], ['حسن', 'Hasan'], ['علي', 'Ali'], ['مازن', 'Mazen'], ['رامي', 'Rami'], ['فادي', 'Fadi'], ['باسل', 'Basel'], ['نبيل', 'Nabil'], ['زياد', 'Ziad'], ['هاني', 'Hani'], ['وليد', 'Walid'], ['ماهر', 'Maher'], ['أنس', 'Anas'], ['معاذ', 'Moath']];
  const FEMALE = [['لينا', 'Lina'], ['سارة', 'Sara'], ['مريم', 'Mariam'], ['نور', 'Nour'], ['هبة', 'Heba'], ['ريم', 'Reem'], ['دينا', 'Dina'], ['رنا', 'Rana'], ['ياسمين', 'Yasmin'], ['آلاء', 'Alaa'], ['منى', 'Mona'], ['سلمى', 'Salma'], ['هالة', 'Hala'], ['رهف', 'Rahaf'], ['أسماء', 'Asmaa'], ['إيمان', 'Iman'], ['نادية', 'Nadia'], ['جنى', 'Jana'], ['ليلى', 'Layla'], ['تسنيم', 'Tasneem']];
  const FAMILY = [['حداد', 'Haddad'], ['منصور', 'Mansour'], ['صالح', 'Saleh'], ['خليل', 'Khalil'], ['ناصر', 'Nasser'], ['عيسى', 'Issa'], ['يونس', 'Younis'], ['سليمان', 'Suleiman'], ['عودة', 'Odeh'], ['حمدان', 'Hamdan'], ['بكر', 'Bakr'], ['شاهين', 'Shaheen'], ['الخطيب', 'Al-Khatib'], ['النجار', 'Al-Najjar'], ['العلي', 'Al-Ali'], ['دياب', 'Diab'], ['فارس', 'Fares'], ['زيدان', 'Zidan'], ['رضوان', 'Radwan'], ['سعيد', 'Saeed'], ['جابر', 'Jaber'], ['قاسم', 'Qasem'], ['عثمان', 'Othman'], ['الشامي', 'Al-Shami'], ['مصطفى', 'Mustafa'], ['درويش', 'Darwish']];

  const POLICIES = [
    { code: 'EMPLOYEE_HANDBOOK', ar: 'دليل الموظف', en: 'Employee Handbook', v: '2.1' },
    { code: 'CODE_OF_CONDUCT', ar: 'مدونة السلوك والأخلاقيات', en: 'Code of Conduct and Ethics', v: '3.0' },
    { code: 'SAFEGUARDING_PSEA', ar: 'الحماية من الاستغلال والانتهاك الجنسي', en: 'Safeguarding / PSEA', v: '1.4' },
    { code: 'ANTI_HARASSMENT', ar: 'مكافحة التحرش', en: 'Anti-Harassment', v: '1.2' },
    { code: 'CONFIDENTIALITY_NDA', ar: 'السرية وعدم الإفصاح', en: 'Confidentiality & Non-Disclosure', v: '1.0' },
    { code: 'ANTI_FRAUD', ar: 'مكافحة الاحتيال والرشوة', en: 'Anti-Fraud & Anti-Bribery', v: '2.0' },
    { code: 'DATA_PRIVACY_NOTICE', ar: 'حماية البيانات', en: 'Data Protection Notice', v: '1.1' }
  ];
  const TRAININGS = [
    { code: 'PSEA', ar: 'الحماية من الاستغلال والانتهاك الجنسي', en: 'PSEA essentials' },
    { code: 'HARASS', ar: 'منع التحرش في بيئة العمل', en: 'Preventing workplace harassment' },
    { code: 'FRAUD', ar: 'التوعية بالاحتيال', en: 'Fraud awareness' },
    { code: 'SECURITY', ar: 'الأمن والسلامة الميدانية', en: 'Field safety & security' }
  ];

  const HOLIDAYS = [
    { date: `${today.getFullYear()}-01-01`, ar: 'رأس السنة الميلادية', en: "New Year's Day" },
    { date: `${today.getFullYear()}-05-01`, ar: 'عيد العمال', en: 'Labour Day' },
    { date: iso(addDays(today, 12)), ar: 'عطلة رسمية (نموذجية)', en: 'Public holiday (sample)' },
    { date: iso(addDays(today, 40)), ar: 'عطلة رسمية (نموذجية)', en: 'Public holiday (sample)' },
    { date: `${today.getFullYear()}-12-25`, ar: 'عيد الميلاد', en: 'Christmas Day' }
  ];

  // ---------- Employees ----------
  const N = 800;
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
  const officePairs = OFFICES.map((o) => [o, o.w]);

  for (let i = 0; i < N; i++) {
    const d = weighted(deptPairs);
    const pos = pick(d[5]);
    let g = SINGLE_GENDER[pos[0]] || (chance(0.52) ? 'F' : 'M');
    const office = d[0] === 'HRM' || d[0] === 'FIN' || d[0] === 'MEL' ? (chance(0.7) ? OFFICES[0] : weighted(officePairs)) : weighted(officePairs);
    const category = weighted([['REGULAR', 86], ['FIXED_SHORT', 7], ['DAILY', 4], ['INTERN', 3]]);
    const serviceDays = category === 'INTERN' ? int(10, 85) : weighted([[int(5, 89), 8], [int(90, 365), 22], [int(366, 1460), 45], [int(1461, 3300), 25]]);
    const hire = addDays(today, -serviceDays);
    const contractMonths = category === 'REGULAR' ? pick([6, 12, 12, 12]) : category === 'INTERN' ? 3 : pick([1, 2, 3]);
    let contractEnd = addMonths(hire, contractMonths);
    while (contractEnd <= today) contractEnd = addMonths(contractEnd, contractMonths);
    const grade = category === 'INTERN' ? 0 : pos[2];
    const base = category === 'INTERN' ? 150 : Math.round((GRADE_BASE[grade] * (1 + Math.min(serviceDays / 365, 8) * 0.025) * (0.96 + rnd() * 0.08)) / 5) * 5;
    const primaryGrant = d[4];
    let alloc;
    if (primaryGrant === 'GR-105') alloc = [{ grant: 'GR-105', pct: 100 }];
    else if (chance(0.35)) { const p = pick([60, 70, 80]); alloc = [{ grant: primaryGrant, pct: p }, { grant: 'GR-105', pct: 100 - p }]; }
    else alloc = [{ grant: primaryGrant, pct: 100 }];
    const name = makeName(g);
    const monthsThisYear = Math.min(today.getMonth() + 1, Math.ceil(serviceDays / 30.4));
    const annualAccrued = category === 'REGULAR' ? +(monthsThisYear * 1.75).toFixed(2) : 0;
    const annualUsed = category === 'REGULAR' ? Math.min(Math.floor(annualAccrued), int(0, Math.floor(annualAccrued))) : 0;
    const sickUsed = chance(0.45) ? int(1, 6) : 0;
    const emp = {
      id: `E${String(i + 1).padStart(4, '0')}`,
      staffNo: `SRO-${String(1000 + i)}`,
      name, gender: g,
      dept: d[0], deptName: { ar: d[1], en: d[2] },
      position: { ar: g === 'F' ? pos[0].replace(/\/ة/g, 'ة') : pos[0].replace(/\/ة/g, ''), en: pos[1] }, grade,
      office: office.id,
      category,
      hireDate: iso(hire), contractEnd: iso(contractEnd),
      probationEnd: iso(addMonths(hire, POLICY.probationMonths)),
      inProbation: serviceDays < 91,
      baseSalary: base, currency: 'USD',
      alloc,
      leave: { annualAccrued, annualUsed, sickUsed, compDays: chance(0.08) ? int(1, 2) : 0, unpaidUsed: chance(0.05) ? int(1, 5) : 0 },
      lateMarks: weighted([[0, 70], [1, 14], [2, 9], [3, 5], [4, 2]]),
      ackMissing: POLICIES.filter(() => chance(0.035)).map((p) => p.code),
      trainingsDone: TRAININGS.filter(() => chance(0.88)).map((t) => t.code),
      screening: weighted([['CLEARED', 92], ['DUE', 7], ['ESCALATED', 1]]),
      warnings: chance(0.03) ? 1 : 0,
      rating: weighted([['OUTSTANDING', 10], ['VERY_GOOD', 30], ['SATISFACTORY', 48], ['NEEDS_IMPROVEMENT', 10], ['UNSATISFACTORY', 2]]),
      phone: `+000 59 ${int(100, 999)} ${int(1000, 9999)}`,
      email: `${name.en.split(' ')[0].toLowerCase()}.${name.en.split(' ').slice(-1)[0].toLowerCase().replace(/[^a-z]/g, '')}${i}@example.org`,
      managerId: null
    };
    employees.push(emp);
  }

  // ---------- Personas (fixed records so the demo story is stable) ----------
  function setPersona(idx, patch) { Object.assign(employees[idx], patch); return employees[idx]; }
  const cd = setPersona(0, {
    name: { ar: 'سارة يوسف منصور', en: 'Sara Yousef Mansour', short: { ar: 'سارة منصور', en: 'Sara Mansour' } }, gender: 'F',
    dept: 'ADM', deptName: { ar: 'الإدارة', en: 'Administration' }, position: { ar: 'المديرة القُطرية', en: 'Country Director' }, grade: 9,
    office: 'MO', category: 'REGULAR', hireDate: iso(addDays(today, -1900)), contractEnd: iso(addMonths(today, 11)), inProbation: false,
    baseSalary: 3400, alloc: [{ grant: 'GR-105', pct: 100 }], ackMissing: [], screening: 'CLEARED', lateMarks: 0, warnings: 0
  });
  const hrm = setPersona(1, {
    name: { ar: 'عمر خالد صالح', en: 'Omar Khaled Saleh', short: { ar: 'عمر صالح', en: 'Omar Saleh' } }, gender: 'M',
    dept: 'HRM', deptName: { ar: 'الموارد البشرية', en: 'Human Resources' }, position: { ar: 'مدير الموارد البشرية', en: 'HR Manager' }, grade: 8,
    office: 'MO', category: 'REGULAR', hireDate: iso(addDays(today, -1400)), contractEnd: iso(addMonths(today, 9)), inProbation: false,
    baseSalary: 2250, alloc: [{ grant: 'GR-105', pct: 100 }], ackMissing: [], screening: 'CLEARED', lateMarks: 0, warnings: 0, managerId: 'E0001'
  });
  const hmgr = setPersona(2, {
    name: { ar: 'خليل إبراهيم الخطيب', en: 'Khalil Ibrahim Al-Khatib', short: { ar: 'خليل الخطيب', en: 'Khalil Al-Khatib' } }, gender: 'M',
    dept: 'HEA', deptName: { ar: 'الصحة', en: 'Health' }, position: { ar: 'منسق برنامج الصحة', en: 'Health Program Coordinator' }, grade: 8,
    office: 'MO', category: 'REGULAR', hireDate: iso(addDays(today, -2200)), inProbation: false, baseSalary: 2300,
    alloc: [{ grant: 'GR-101', pct: 80 }, { grant: 'GR-105', pct: 20 }], managerId: 'E0001', ackMissing: [], lateMarks: 0
  });
  const me = setPersona(3, {
    name: { ar: 'لينا محمد حداد', en: 'Lina Mohammad Haddad', short: { ar: 'لينا حداد', en: 'Lina Haddad' } }, gender: 'F',
    dept: 'HEA', deptName: { ar: 'الصحة', en: 'Health' }, position: { ar: 'مسؤولة صحية', en: 'Health Officer' }, grade: 6,
    office: 'MO', category: 'REGULAR', hireDate: iso(addDays(today, -790)), contractEnd: iso(addMonths(today, 5)), inProbation: false,
    baseSalary: 1420, alloc: [{ grant: 'GR-101', pct: 70 }, { grant: 'GR-105', pct: 30 }],
    leave: { annualAccrued: +((today.getMonth() + 1) * 1.75).toFixed(2), annualUsed: 6, sickUsed: 2, compDays: 1, unpaidUsed: 0 },
    lateMarks: 1, ackMissing: ['SAFEGUARDING_PSEA'], trainingsDone: ['PSEA', 'HARASS', 'SECURITY'], screening: 'CLEARED', warnings: 0, rating: 'VERY_GOOD',
    managerId: 'E0003'
  });

  // Managers: department heads per dept (first senior found), else the HR manager
  const heads = {};
  employees.forEach((e) => { if (!heads[e.dept] && e.grade >= 6 && e.id !== cd.id) heads[e.dept] = e.id; });
  heads.HEA = hmgr.id; heads.HRM = hrm.id;
  employees.forEach((e) => { if (!e.managerId) e.managerId = e.id === heads[e.dept] ? cd.id : (heads[e.dept] || hrm.id); });
  cd.managerId = null;

  // A few deliberate cases so dashboards always have something to show
  employees.slice(10, 16).forEach((e, k) => { e.category = 'REGULAR'; e.inProbation = true; e.hireDate = iso(addDays(today, -(80 + k))); e.probationEnd = iso(addDays(today, 10 - k)); });
  employees.slice(20, 34).forEach((e, k) => { e.contractEnd = iso(addDays(today, 8 + k * 4)); });
  employees.slice(40, 44).forEach((e) => { e.lateMarks = 3 + (e.id.charCodeAt(4) % 2); });

  // ---------- Leave requests ----------
  const LT = ['ANNUAL', 'ANNUAL', 'ANNUAL', 'SICK', 'SICK', 'COMP', 'BEREAVEMENT', 'UNPAID'];
  const leaveRequests = [];
  for (let k = 0; k < 46; k++) {
    const e = employees[int(4, N - 1)];
    if (e.category !== 'REGULAR') continue;
    const type = pick(LT);
    const start = addDays(today, int(-20, 30));
    const days = type === 'SICK' ? int(1, 3) : type === 'BEREAVEMENT' ? int(3, 5) : int(1, 6);
    const status = start < today ? weighted([['APPROVED', 9], ['REJECTED', 1]]) : weighted([['PENDING_MANAGER', 4], ['PENDING_HR', 5], ['APPROVED', 6]]);
    leaveRequests.push({ id: `LR-${String(2400 + k)}`, empId: e.id, type, from: iso(start), days, to: iso(addDays(start, days + Math.floor(days / 5) * 2)), status, reason: '', submitted: iso(addDays(start, -int(2, 12))) });
  }
  leaveRequests.push({ id: 'LR-2399', empId: me.id, type: 'ANNUAL', from: iso(addDays(today, -48)), to: iso(addDays(today, -44)), days: 3, status: 'APPROVED', submitted: iso(addDays(today, -60)), reason: '' });
  leaveRequests.push({ id: 'LR-2398', empId: me.id, type: 'SICK', from: iso(addDays(today, -21)), to: iso(addDays(today, -20)), days: 2, status: 'APPROVED', submitted: iso(addDays(today, -19)), reason: '' });

  // ---------- Recruitment ----------
  const STAGES = ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'EVALUATION', 'SCREENING', 'OFFER'];
  const vacancies = [
    { id: 'VAC-031', ar: 'طبيب/ة عام', en: 'General Practitioner', dept: 'HEA', office: 'NF', grade: 7, opened: iso(addDays(today, -26)), closes: iso(addDays(today, 4)) },
    { id: 'VAC-032', ar: 'مسؤول/ة تغذية', en: 'Nutrition Officer', dept: 'NUT', office: 'SF', grade: 6, opened: iso(addDays(today, -18)), closes: iso(addDays(today, 10)) },
    { id: 'VAC-033', ar: 'محاسب/ة', en: 'Accountant', dept: 'FIN', office: 'MO', grade: 5, opened: iso(addDays(today, -35)), closes: iso(addDays(today, -5)) },
    { id: 'VAC-034', ar: 'مدير/ة حالة', en: 'Case Manager', dept: 'PRO', office: 'CF', grade: 5, opened: iso(addDays(today, -9)), closes: iso(addDays(today, 19)) }
  ];
  const candidates = [];
  vacancies.forEach((v, vi) => {
    const n = [11, 8, 9, 6][vi];
    for (let k = 0; k < n; k++) {
      const g = chance(0.5) ? 'F' : 'M';
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
  Object.assign(c33[0], { stage: 'SCREENING', screening: 'PENDING', evals: { submitted: 3, required: 3 }, refs: 2, score: 86 });
  Object.assign(c33[1], { stage: 'SCREENING', screening: 'CLEARED', evals: { submitted: 3, required: 3 }, refs: 2, score: 81 });
  Object.assign(c33[2], { stage: 'EVALUATION', screening: 'NOT_STARTED', evals: { submitted: 2, required: 3 }, refs: 0, score: 77 });

  // ---------- Country Director approvals ----------
  const e = (i) => employees[i];
  const approvals = [
    { id: 'AP-501', type: 'HIRE', requester: hrm.id, created: iso(addDays(today, -1)), status: 'PENDING',
      data: { candidate: { ar: 'نور سليمان عودة', en: 'Nour Suleiman Odeh' }, vacancy: 'VAC-031', rank: 1, score: 88, panel: 3, evals: '3/3', refs: '2/2', screening: 'CLEARED', salary: 1700, start: iso(addDays(today, 14)) },
      rules: ['RC-008', 'RC-013', 'RC-014', 'RC-015'] },
    { id: 'AP-502', type: 'SALARY_INCREASE', requester: hmgr.id, subject: e(57).id, created: iso(addDays(today, -2)), status: 'PENDING',
      data: { percent: 4, rating: 'VERY_GOOD', months: 12, renewed: 12, from: e(57).baseSalary }, rules: ['CP-010', 'CP-011', 'CP-012'] },
    { id: 'AP-503', type: 'UNPAID_LEAVE', requester: e(120).managerId, subject: e(120).id, created: iso(addDays(today, -1)), status: 'PENDING',
      data: { days: 12, from: iso(addDays(today, 9)), usedThisYear: 0, service: 26 }, rules: ['LV-060', 'LV-061', 'LV-062', 'LV-063'] },
    { id: 'AP-504', type: 'NEW_POSITION', requester: hmgr.id, created: iso(addDays(today, -3)), status: 'PENDING',
      data: { title: { ar: 'مشرف/ة تمريض', en: 'Nursing Supervisor' }, grade: 7, office: 'SF', grant: 'GR-101', months: 12, budget: 1650 }, rules: ['RC-001', 'RC-002'] },
    { id: 'AP-505', type: 'WARNING', requester: hrm.id, subject: e(41).id, created: iso(addDays(today, -1)), status: 'PENDING',
      data: { level: 'WRITTEN_WARNING_1', reason: { ar: 'تكرار التأخير: 4 علامات هذا الشهر', en: 'Repeated lateness: 4 late marks this month' }, response: true }, rules: ['WT-013', 'DG-002', 'DG-003'] },
    { id: 'AP-506', type: 'ACTING', requester: hrm.id, subject: e(88).id, created: iso(addDays(today, -4)), status: 'PENDING',
      data: { months: 3, allowance: 10, position: { ar: 'مسؤول/ة لوجستيات (بالتكليف)', en: 'Logistics Officer (acting)' } }, rules: ['LC-030', 'LC-031', 'LC-032'] },
    { id: 'AP-507', type: 'SALARY_INCREASE', requester: e(200).managerId, subject: e(200).id, created: iso(addDays(today, -5)), status: 'PENDING',
      data: { percent: 7, rating: 'OUTSTANDING', months: 12, renewed: 12, from: e(200).baseSalary }, rules: ['CP-010', 'CP-011'] }
  ];

  // ---------- Separations (last 12 months, for turnover) ----------
  const separations = [];
  for (let k = 0; k < 58; k++) separations.push({ date: iso(addDays(today, -int(5, 360))), type: weighted([['RESIGNATION', 5], ['CONTRACT_END', 6], ['REDUNDANCY', 2], ['DISCIPLINARY', 0.4]]), dept: weighted(deptPairs)[0] });

  // ---------- Activity feed seed ----------
  const activity = [
    { id: 'A1', role: 'EMPLOYEE', ch: 'teams', at: iso(addDays(today, -1)), ar: 'تذكير: الإقرار بسياسة الحماية من الاستغلال والانتهاك الجنسي (إصدار 1.4)', en: 'Reminder: acknowledge Safeguarding / PSEA policy (v1.4)', go: 'policies' },
    { id: 'A2', role: 'EMPLOYEE', ch: 'outlook', at: iso(addDays(today, -6)), ar: 'قسيمة الراتب متاحة الآن', en: 'Your payslip is available', go: 'pay' },
    { id: 'A3', role: 'HR', ch: 'teams', at: iso(today), ar: '6 موظفين تنتهي فترة تجربتهم خلال 14 يوماً', en: '6 employees finish probation within 14 days', go: 'dashboard' },
    { id: 'A4', role: 'HR', ch: 'outlook', at: iso(addDays(today, -1)), ar: 'المرشح للوظيفة VAC-033 بانتظار نتيجة فحص الامتثال', en: 'VAC-033 candidate awaiting compliance screening', go: 'recruitment' },
    { id: 'A5', role: 'CD', ch: 'teams', at: iso(today), ar: '7 طلبات بانتظار اعتمادك', en: '7 requests awaiting your approval', go: 'approvals' },
    { id: 'A6', role: 'CD', ch: 'outlook', at: iso(addDays(today, -2)), ar: 'المنحة GR-102 تنتهي خلال شهرين: عقود مرتبطة بها', en: 'Grant GR-102 ends in 2 months: linked contracts', go: 'dashboard' }
  ];

  window.HRDATA = {
    ORG, OFFICES, GRANTS, DEPTS: DEPTS.map((d) => ({ id: d[0], ar: d[1], en: d[2] })), POLICY, POLICIES, TRAININGS, HOLIDAYS,
    employees, leaveRequests, vacancies, candidates, STAGES, approvals, separations, activity,
    personas: { EMPLOYEE: me.id, HR: hrm.id, CD: cd.id, MANAGER: hmgr.id },
    todayISO: iso(today)
  };
})();
