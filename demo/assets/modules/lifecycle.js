/* HRMO module — Onboarding, separation & final settlement, change of status, employee letters.
 * Rules: ON-001..011, SP-001..033, LC-010..042, CP-010..012, RD-005. */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, VIEWS, APTYPE, L, T, esc, icon, fmtN, fmtD, money, parse, iso, addDays, daysBetween, TODAY, badge, rule, avatar, who, toast, addActivity, emptyState, empById, persona, me, balances, render, openOverlay, closeOverlay, pageHead, table, store, addNav, audit, msgs, R, drawer, modal, officeName, serviceDays, serviceMonths, workingDays, kpi } = H;
  const CATL = H.CAT;

  EXT.overlays.doc = (o) => H.docModal(o.title, o.body, o.ref);

  // =====================================================================
  // Onboarding
  // =====================================================================
  const ONB_ITEMS = [
    { k: 'SCREEN', ar: 'اجتياز فحص الامتثال', en: 'Compliance screening cleared', owner: 'COMPLIANCE', rule: 'RC-015', req: true },
    { k: 'CONTRACT', ar: 'توقيع عقد العمل', en: 'Employment contract signed', owner: 'HR', rule: 'ON-001', req: true },
    { k: 'JD', ar: 'توقيع الوصف الوظيفي', en: 'Job description signed', owner: 'MANAGER', rule: 'ON-002', req: true },
    { k: 'ACKS', ar: 'الإقرار بالسياسات الإلزامية', en: 'Mandatory policy acknowledgements', owner: 'EMPLOYEE', rule: 'ON-003', req: true },
    { k: 'BANK', ar: 'البيانات البنكية', en: 'Bank details', owner: 'EMPLOYEE', rule: 'ON-010', req: true },
    { k: 'DOCS', ar: 'مستندات الملف الشخصي', en: 'Personnel file documents', owner: 'EMPLOYEE', rule: 'ON-007' },
    { k: 'ORIENT', ar: 'التعريف خلال الأسبوع الأول', en: 'Orientation in the first week', owner: 'HR', rule: 'ON-005' },
    { k: 'TRAIN', ar: 'التسجيل في التدريب الإلزامي', en: 'Enrolled in mandatory training', owner: 'HR', rule: 'ON-006' },
    { k: 'OBJ', ar: 'تحديد الأهداف مع المدير', en: 'Objectives agreed with manager', owner: 'MANAGER', rule: 'ON-008' },
    { k: 'ID', ar: 'بطاقة التعريف والعهد', en: 'ID card and equipment issued', owner: 'LOGISTICS', rule: 'ON-009' },
    { k: 'IT', ar: 'البريد الإلكتروني والحسابات', en: 'E-mail and system accounts', owner: 'IT', rule: 'ON-011' }
  ];
  const OWNER = { HR: ['الموارد البشرية', 'HR'], MANAGER: ['المدير المباشر', 'Line manager'], EMPLOYEE: ['الموظف', 'Employee'], LOGISTICS: ['اللوجستيات', 'Logistics'], IT: ['تقنية المعلومات', 'IT'], COMPLIANCE: ['الامتثال', 'Compliance'], FINANCE: ['المالية', 'Finance'] };
  const ONB = store('onboarding', () => [
    { id: 'ONB-1001', name: { ar: 'رنا سعيد درويش', en: 'Rana Saeed Darwish' }, gender: 'F', position: { ar: 'قابلة', en: 'Midwife' }, dept: 'HEA', office: 'NF', grade: 5, start: iso(addDays(TODAY, 5)), managerId: D.personas.MANAGER, done: ['SCREEN', 'CONTRACT'], payroll: false },
    { id: 'ONB-1002', name: { ar: 'باسل حسن قاسم', en: 'Basel Hasan Qasem' }, gender: 'M', position: { ar: 'مسؤول لوجستيات', en: 'Logistics Officer' }, dept: 'LOG', office: 'MO', grade: 6, start: iso(addDays(TODAY, -8)), managerId: D.personas.HR, done: ['SCREEN', 'CONTRACT', 'JD', 'BANK', 'DOCS', 'ID', 'IT', 'TRAIN'], payroll: false },
    { id: 'ONB-1003', name: { ar: 'ياسمين علي النجار', en: 'Yasmin Ali Al-Najjar' }, gender: 'F', position: { ar: 'مديرة حالة', en: 'Case Manager' }, dept: 'PRO', office: 'CF', grade: 5, start: iso(addDays(TODAY, 12)), managerId: D.personas.HR, done: ['SCREEN'], payroll: false }
  ]);
  const onbReqMissing = (c) => ONB_ITEMS.filter((i) => i.req && !c.done.includes(i.k));
  const orientOverdue = (c) => !c.done.includes('ORIENT') && daysBetween(c.start, D.todayISO) > D.POLICY.workWeek.days.length;
  EXT.onDecide.push((a, status) => {
    if (a.type !== 'HIRE' || status !== 'APPROVED') return;
    const v = D.vacancies.find((x) => x.id === a.data.vacancy) || {};
    ONB.unshift({ id: `ONB-${1001 + ONB.length}`, name: a.data.candidate, position: { ar: v.ar || '', en: v.en || '' }, dept: v.dept || 'ADM', office: v.office || 'MO', grade: v.grade || 5, start: a.data.start, managerId: D.personas.HR, done: a.data.screening === 'CLEARED' ? ['SCREEN'] : [], payroll: false });
    addActivity('HR', 'teams', `بدأ استقبال موظف جديد: ${a.data.candidate.ar}`, `Onboarding started: ${a.data.candidate.en}`, 'onboarding');
  });

  function vOnboarding() {
    const rows = ONB.map((c) => {
      const n = c.done.length; const miss = onbReqMissing(c); const d = daysBetween(D.todayISO, c.start);
      return `<tr class="clickable" data-act="onb-open" data-id="${c.id}"><td><div class="who"><span class="avatar sm">${esc(H.initials(c.name))}</span><div><div class="n">${esc(T(c.name))}</div><div class="subtle">${esc(c.id)}</div></div></div></td><td>${esc(T(c.position))}</td><td class="hide-sm">${esc(officeName(c.office))}</td><td>${esc(fmtD(c.start))} <span class="subtle">${d > 0 ? esc(L(`بعد ${d} يوم`, `in ${d}d`)) : d === 0 ? esc(L('اليوم', 'today')) : esc(L(`منذ ${-d} يوم`, `${-d}d ago`))}</span></td><td style="min-width:140px">${H.meter((n / ONB_ITEMS.length) * 100, n === ONB_ITEMS.length ? 'ok' : '')}<span class="subtle">${n}/${ONB_ITEMS.length}</span></td><td>${c.payroll ? badge('b-ok', L('الراتب مفعّل', 'Payroll active'), 'check') : miss.length ? badge('b-warn', L(`${miss.length} شرط للراتب`, `${miss.length} payroll blocker(s)`), 'lock') : badge('b-info', L('جاهز للتفعيل', 'Ready to activate'))}${orientOverdue(c) ? ' ' + badge('b-bad', L('التعريف متأخر', 'Orientation overdue'), 'warn') : ''}</td></tr>`;
    });
    return `${pageHead(L('استقبال الموظفين الجدد', 'Onboarding'), esc(L('يبدأ تلقائياً عند اعتماد التعيين، ولا يُفعَّل الراتب قبل اكتمال الشروط الإلزامية.', 'Starts automatically when a hire is approved; payroll stays locked until mandatory items are complete.')) + ' ' + rule('ON-003'))}
      <div class="grid g-3">${kpi(L('قيد الاستقبال', 'In onboarding'), fmtN(ONB.filter((c) => !c.payroll).length), '', 'person')}${kpi(L('يبدأون خلال 14 يوماً', 'Starting within 14 days'), fmtN(ONB.filter((c) => { const d = daysBetween(D.todayISO, c.start); return d >= 0 && d <= 14; }).length), '', 'cal')}${kpi(L('تعريف متأخر', 'Orientation overdue'), fmtN(ONB.filter(orientOverdue).length), rule('ON-005'), 'warn')}</div>
      <section class="card flush">${table([L('الموظف الجديد', 'New hire'), L('الوظيفة', 'Position'), [L('المكتب', 'Office'), 'hide-sm'], L('تاريخ البدء', 'Start'), L('التقدم', 'Progress'), L('الحالة', 'Status')], rows, emptyState('person', L('لا يوجد موظفون جدد', 'No new hires')))}</section>`;
  }
  function onbDrawer(o) {
    const c = ONB.find((x) => x.id === o.id); const miss = onbReqMissing(c); const mgr = empById.get(c.managerId);
    const body = `<dl class="kv"><dt>${esc(L('الوظيفة', 'Position'))}</dt><dd>${esc(T(c.position))} · G${c.grade}</dd><dt>${esc(L('المكتب', 'Office'))}</dt><dd>${esc(officeName(c.office))}</dd><dt>${esc(L('تاريخ البدء', 'Start date'))}</dt><dd>${esc(fmtD(c.start))}</dd><dt>${esc(L('المدير المباشر', 'Line manager'))}</dt><dd>${mgr ? esc(T(mgr.name.short)) : '—'}</dd></dl>
      <div><p class="section-title">${esc(L('قائمة الاستقبال', 'Onboarding checklist'))}</p><div class="checklist">${ONB_ITEMS.map((i) => { const dn = c.done.includes(i.k); return `<label class="check-item ${dn ? 'done' : ''}"><input type="checkbox" class="cbx" data-onb="${c.id}" data-k="${i.k}" ${dn ? 'checked' : ''}><div class="grow"><div class="t">${esc(L(i.ar, i.en))}${i.req ? ` <span class="badge b-neutral">${esc(L('شرط للراتب', 'Payroll gate'))}</span>` : ''}</div><div class="owner">${esc(L(...OWNER[i.owner]))}</div></div>${rule(i.rule)}</label>`; }).join('')}</div></div>
      ${c.payroll ? `<div class="msg ok">${icon('check', 16)}<div>${esc(L('فُعّل الراتب وأُنشئ سجل الموظف.', 'Payroll activated and employee record created.'))}</div></div>` : miss.length ? `<div class="msg warn">${icon('lock', 16)}<div>${esc(L('لا يمكن تفعيل الراتب قبل: ', 'Payroll cannot be activated until: '))}${miss.map((i) => esc(L(i.ar, i.en))).join('، ')} ${rule('ON-002')}</div></div>` : ''}`;
    const footer = `<button class="btn" data-act="onb-contract" data-id="${c.id}">${icon('doc', 16)}${esc(L('إنشاء العقد', 'Generate contract'))}</button><button class="btn primary" data-act="onb-activate" data-id="${c.id}" ${miss.length || c.payroll ? 'disabled' : ''}>${icon('money', 16)}${esc(L('تفعيل الراتب', 'Activate payroll'))}</button>`;
    return drawer(T(c.name), body, footer, `<span class="avatar">${esc(H.initials(c.name))}</span>`);
  }
  EXT.overlays.onb = onbDrawer;

  // =====================================================================
  // Separation, clearance and final settlement
  // =====================================================================
  const SEP_TYPES = { RESIGNATION: ['استقالة', 'Resignation'], CONTRACT_END: ['انتهاء عقد', 'Contract end'], REDUNDANCY: ['تقليص (انتهاء تمويل)', 'Redundancy (funding end)'], DISCIPLINARY: ['فصل تأديبي', 'Disciplinary dismissal'], PERFORMANCE: ['ضعف الأداء', 'Low performance'], ABANDONMENT: ['اعتبار الغياب استقالة', 'Deemed resignation'] };
  const CLEAR = [
    { k: 'L_ASSETS', g: 'LOGISTICS', ar: 'إعادة الحاسوب والهاتف والعهد', en: 'Laptop, phone and equipment returned', rule: 'AS-005' },
    { k: 'L_ID', g: 'LOGISTICS', ar: 'إعادة بطاقة التعريف والمفاتيح', en: 'ID card and keys returned', rule: 'AS-004' },
    { k: 'H_HANDOVER', g: 'HR', ar: 'اعتماد خطة تسليم المهام', en: 'Handover plan approved', rule: 'SP-003' },
    { k: 'H_EXIT', g: 'HR', ar: 'إجراء مقابلة الخروج', en: 'Exit interview completed', rule: 'SP-020' },
    { k: 'F_ADV', g: 'FINANCE', ar: 'تسوية السلف والالتزامات', en: 'Advances and obligations cleared', rule: 'CP-023' },
    { k: 'F_TS', g: 'FINANCE', ar: 'اعتماد آخر كشف دوام', en: 'Final timesheet approved', rule: 'TS-005' },
    { k: 'I_ACCESS', g: 'IT', ar: 'إيقاف البريد والصلاحيات في آخر يوم', en: 'E-mail and access disabled on last day', rule: 'SP-032' }
  ];
  const pickEmp = (i) => D.employees.filter((e) => e.category === 'REGULAR' && !Object.values(D.personas).includes(e.id))[i];
  const SEP = store('separations', () => [
    { id: 'SEP-1001', empId: pickEmp(30).id, type: 'RESIGNATION', submitted: iso(addDays(TODAY, -12)), lastDay: iso(addDays(TODAY, 18)), reason: { ar: 'فرصة عمل أخرى', en: 'Another job offer' }, cleared: ['H_HANDOVER'], exitEval: null, advances: 0, status: 'OPEN' },
    { id: 'SEP-1002', empId: pickEmp(55).id, type: 'CONTRACT_END', submitted: iso(addDays(TODAY, -25)), lastDay: iso(addDays(TODAY, 4)), reason: { ar: 'انتهاء مدة العقد', en: 'Contract expiry' }, cleared: ['L_ASSETS', 'L_ID', 'H_HANDOVER', 'H_EXIT', 'F_TS'], exitEval: { rehire: 'YES', comment: '' }, advances: 120, status: 'OPEN' },
    { id: 'SEP-1003', empId: pickEmp(80).id, type: 'REDUNDANCY', submitted: iso(addDays(TODAY, -3)), lastDay: iso(addDays(TODAY, 40)), reason: { ar: 'انتهاء المنحة GR-102', en: 'Grant GR-102 ends' }, cleared: [], exitEval: null, advances: 0, status: 'OPEN' }
  ]);
  const sepEmp = (c) => empById.get(c.empId);
  const sepCleared = (c) => CLEAR.every((i) => c.cleared.includes(i.k));
  function settlement(c) {
    const e = sepEmp(c); const daily = e.baseSalary / D.POLICY.workingDaysPerMonth;
    const last = parse(c.lastDay); const first = iso(new Date(last.getFullYear(), last.getMonth(), 1));
    const worked = Math.min(D.POLICY.workingDaysPerMonth, workingDays(first, c.lastDay));
    const years = Math.floor(serviceDays(e) / 365.25);
    const leaveDays = e.category === 'REGULAR' ? Math.max(0, balances(e).annual.available) : 0;
    const lines = [
      [L('الراتب المستحق عن الشهر الأخير', 'Salary due for final month'), worked * daily, `${worked} ${L('يوم عمل', 'working days')}`, 'SP-033'],
      [L('بدل الإجازة السنوية غير المستخدمة', 'Unused annual leave'), leaveDays * daily, `${fmtN(leaveDays, 2)} ${L('يوم', 'days')}`, 'LV-015'],
      [L('بدل الإشعار', 'Pay in lieu of notice'), c.type === 'REDUNDANCY' && c.payInLieu ? e.baseSalary : 0, c.type === 'REDUNDANCY' ? L('عند إنهاء العمل قبل انقضاء الإشعار', 'If released before notice ends') : '—', 'SP-010'],
      [L('مكافأة نهاية الخدمة', 'End-of-service benefit'), c.type === 'DISCIPLINARY' || e.category !== 'REGULAR' ? 0 : years * D.POLICY.separation.severanceMonthsPerYear * e.baseSalary, `${years} ${L('سنة كاملة', 'completed years')} × ${D.POLICY.separation.severanceMonthsPerYear} ${L('شهر', 'month')}`, 'SP-004']
    ];
    const gross = lines.reduce((s, l) => s + l[1], 0);
    return { lines, deductions: c.advances || 0, net: gross - (c.advances || 0), gross };
  }
  function sepStatus(c) {
    if (c.status === 'PAID') return badge('b-ok', L('صُرفت المستحقات', 'Final pay released'), 'check');
    if (!sepCleared(c) || !c.exitEval) return badge('b-warn', L('المستحقات موقوفة', 'Final pay on hold'), 'lock');
    return badge('b-info', L('جاهز للصرف', 'Ready to pay'));
  }
  function vSeparations() {
    const rows = SEP.map((c) => { const e = sepEmp(c); const d = daysBetween(D.todayISO, c.lastDay); const n = c.cleared.length; return `<tr class="clickable" data-act="sep-open" data-id="${c.id}"><td>${who(e, T(e.position))}</td><td>${badge('b-neutral', L(...SEP_TYPES[c.type]))}</td><td>${esc(fmtD(c.lastDay))} <span class="subtle">${d >= 0 ? esc(L(`بعد ${d} يوم`, `in ${d}d`)) : esc(L('انتهى', 'passed'))}</span></td><td style="min-width:130px">${H.meter((n / CLEAR.length) * 100, n === CLEAR.length ? 'ok' : '')}<span class="subtle">${n}/${CLEAR.length}</span></td><td>${c.exitEval ? badge('b-ok', L('تقييم الخروج تم', 'Exit evaluation done'), 'check') : badge('b-neutral', L('تقييم الخروج معلّق', 'Exit evaluation pending'))}</td><td>${sepStatus(c)}</td></tr>`; });
    return `${pageHead(L('إنهاء الخدمة', 'Separations'), esc(L('إخلاء الطرف ومقابلة الخروج والمستحقات النهائية في مسار واحد. لا تُصرف المستحقات قبل اكتمال إخلاء الطرف.', 'Clearance, exit interview and final settlement in one flow. Final pay is held until clearance is complete.')) + ' ' + rule('SP-030'), `<button class="btn primary" data-act="sep-new">${icon('plus', 16)}${esc(L('حالة انفصال جديدة', 'New separation'))}</button>`)}
      <section class="card flush">${table([L('الموظف', 'Employee'), L('النوع', 'Type'), L('آخر يوم عمل', 'Last day'), L('إخلاء الطرف', 'Clearance'), L('تقييم الخروج', 'Exit evaluation'), L('المستحقات', 'Final pay')], rows, emptyState('flag', L('لا توجد حالات انفصال', 'No separations')))}</section>`;
  }
  function sepDrawer(o) {
    const c = SEP.find((x) => x.id === o.id); const e = sepEmp(c); const st = settlement(c);
    const groups = ['LOGISTICS', 'HR', 'FINANCE', 'IT'];
    const body = `<dl class="kv"><dt>${esc(L('النوع', 'Type'))}</dt><dd>${esc(L(...SEP_TYPES[c.type]))}</dd><dt>${esc(L('تاريخ التقديم', 'Submitted'))}</dt><dd>${esc(fmtD(c.submitted))}</dd><dt>${esc(L('آخر يوم عمل', 'Last working day'))}</dt><dd>${esc(fmtD(c.lastDay))}</dd><dt>${esc(L('السبب', 'Reason'))}</dt><dd>${esc(T(c.reason) || '—')}</dd></dl>
      ${c.type === 'REDUNDANCY' ? `<label class="check-item"><input type="checkbox" class="cbx" data-sep-pil="${c.id}" ${c.payInLieu ? 'checked' : ''}><div class="grow"><div class="t">${esc(L('إنهاء فوري مع بدل إشعار شهر', 'Release immediately with one month pay in lieu'))}</div></div>${rule('SP-010')}</label>` : ''}
      <div><p class="section-title">${esc(L('إخلاء الطرف', 'Clearance'))} ${rule('SP-030')}</p>${groups.map((g) => `<div class="subtle" style="margin:6px 0 2px;font-weight:600">${esc(L(...OWNER[g] || [g, g]))}</div><div class="checklist">${CLEAR.filter((i) => i.g === g).map((i) => { const dn = c.cleared.includes(i.k); return `<label class="check-item ${dn ? 'done' : ''}"><input type="checkbox" class="cbx" data-sep="${c.id}" data-k="${i.k}" ${dn ? 'checked' : ''} ${c.status === 'PAID' ? 'disabled' : ''}><div class="grow"><div class="t">${esc(L(i.ar, i.en))}</div></div>${rule(i.rule)}</label>`; }).join('')}</div>`).join('')}</div>
      <div><p class="section-title">${esc(L('تقييم الخروج من المشرف', 'Supervisor exit evaluation'))} ${rule('SP-021')}</p>${c.exitEval ? `<div class="msg ok">${icon('check', 16)}<div>${esc(L('أهلية إعادة التوظيف: ', 'Rehire eligibility: '))}<b>${esc({ YES: L('نعم', 'Yes'), NO: L('لا', 'No'), CONDITIONAL: L('مشروطة', 'Conditional') }[c.exitEval.rehire])}</b></div></div>` : `<div class="radio-group" role="radiogroup">${[['YES', 'نعم', 'Yes'], ['CONDITIONAL', 'مشروطة', 'Conditional'], ['NO', 'لا', 'No']].map(([k, ar, en]) => `<label class="radio"><input type="radio" name="rehire-${c.id}" value="${k}" data-rehire="${c.id}"><span>${esc(L(ar, en))}</span></label>`).join('')}</div><p class="subtle" style="margin:6px 0 0">${esc(L(`مستحق خلال ${D.POLICY.workWeek.days.length} أيام من آخر يوم عمل.`, `Due within ${D.POLICY.workWeek.days.length} days of the last working day.`))}</p>`}</div>
      <div><p class="section-title">${esc(L('كشف التسوية النهائية', 'Final settlement'))}</p>${settleTable(st)}</div>
      ${!sepCleared(c) || !c.exitEval ? `<div class="msg warn">${icon('lock', 16)}<div>${esc(L('المستحقات موقوفة حتى يكتمل إخلاء الطرف وتقييم الخروج.', 'Final pay is held until clearance and exit evaluation are complete.'))} ${rule('SP-030')}</div></div>` : ''}`;
    const footer = `<button class="btn" data-act="sep-doc" data-id="${c.id}">${icon('doc', 16)}${esc(L('كشف التسوية', 'Settlement statement'))}</button><button class="btn primary" data-act="sep-pay" data-id="${c.id}" ${!sepCleared(c) || !c.exitEval || c.status === 'PAID' ? 'disabled' : ''}>${icon('money', 16)}${esc(L('صرف المستحقات', 'Release final pay'))}</button>`;
    return drawer(`${L(...SEP_TYPES[c.type])}: ${T(e.name.short)}`, body, footer, H.avatar(e));
  }
  const settleTable = (st) => `<div class="table-wrap"><table><tbody>${st.lines.map((l) => `<tr><td>${esc(l[0])} ${rule(l[3])}<div class="subtle">${esc(l[2])}</div></td><td class="num" style="text-align:end">${money(l[1])}</td></tr>`).join('')}<tr><td>${esc(L('خصم: سلف والتزامات', 'Less: advances and obligations'))} ${rule('CP-023')}</td><td class="num" style="text-align:end">− ${money(st.deductions)}</td></tr><tr><td><b>${esc(L('صافي المستحقات', 'Net final pay'))}</b></td><td class="num" style="text-align:end"><b>${money(st.net)}</b></td></tr></tbody></table></div>`;
  EXT.overlays.sep = sepDrawer;

  S.resign = S.resign || { lastDay: iso(addDays(TODAY, 30)), reason: 'CAREER', note: '' };
  const REASONS = { CAREER: ['فرصة مهنية أخرى', 'Another career opportunity'], STUDY: ['الدراسة', 'Studies'], FAMILY: ['أسباب عائلية', 'Family reasons'], RELOCATION: ['الانتقال لمكان آخر', 'Relocation'], OTHER: ['أخرى', 'Other'] };
  function resignCheck() {
    const e = me(); const out = { errors: [], warnings: [], info: [] };
    const notice = daysBetween(D.todayISO, S.resign.lastDay);
    if (notice < 0) out.errors.push(R('SP-001', 'آخر يوم عمل لا يمكن أن يكون في الماضي.', 'The last working day cannot be in the past.'));
    else if (!e.inProbation && notice < D.POLICY.resignationNoticeDays) out.warnings.push(R('SP-001', `مدة الإشعار ${notice} يوماً وهي أقل من ${D.POLICY.resignationNoticeDays} يوماً المطلوبة. يمكن للمؤسسة قبولها أو خصم الفرق.`, `Notice is ${notice} days, below the required ${D.POLICY.resignationNoticeDays}. The organization may accept it or deduct the difference.`));
    else out.info.push(R('SP-001', `مدة الإشعار ${notice} يوماً.`, `Notice period: ${notice} days.`));
    out.info.push(R('SP-030', 'بعد الاعتماد تبدأ قائمة إخلاء الطرف، وتُصرف المستحقات بعد اكتمالها.', 'After acceptance, clearance starts; final pay is released once it is complete.'));
    return out;
  }
  EXT.overlays.resign = () => {
    const existing = SEP.find((c) => c.empId === me().id && c.status !== 'PAID');
    if (existing) return modal(L('الاستقالة', 'Resignation'), `<div class="msg info">${icon('info', 16)}<div>${esc(L(`لديك طلب قائم ${existing.id}، وآخر يوم عمل ${fmtD(existing.lastDay)}.`, `You already have ${existing.id}; last working day ${fmtD(existing.lastDay)}.`))}</div></div>`, `<button class="btn primary" data-act="close-overlay">${esc(L('تم', 'Done'))}</button>`);
    return modal(L('تقديم استقالة', 'Submit resignation'), `<div class="form-grid"><div class="field"><label for="rs-ld">${esc(L('آخر يوم عمل', 'Last working day'))}</label><input id="rs-ld" type="date" class="input" data-resign="lastDay" value="${esc(S.resign.lastDay)}"></div><div class="field"><label for="rs-r">${esc(L('السبب', 'Reason'))}</label><select id="rs-r" class="select" data-resign="reason">${Object.entries(REASONS).map(([k, v]) => `<option value="${k}" ${S.resign.reason === k ? 'selected' : ''}>${esc(L(...v))}</option>`).join('')}</select></div><div class="field full"><label for="rs-n">${esc(L('ملاحظات (اختياري)', 'Notes (optional)'))}</label><textarea id="rs-n" class="textarea" data-resign="note">${esc(S.resign.note)}</textarea></div><div class="full" id="rs-check">${msgs(resignCheck())}</div></div>`,
      `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn danger-solid" data-act="resign-submit">${esc(L('تقديم الاستقالة', 'Submit resignation'))}</button>`);
  };
  S.sepNew = S.sepNew || { empId: '', type: 'CONTRACT_END', lastDay: iso(addDays(TODAY, 30)) };
  EXT.overlays['sep-new'] = () => modal(L('حالة انفصال جديدة', 'New separation'), `<div class="form-grid"><div class="field full"><label for="sn-e">${esc(L('الموظف', 'Employee'))}</label>${empSelect('sn-e', 'data-sepnew="empId"', S.sepNew.empId)}</div><div class="field"><label for="sn-t">${esc(L('النوع', 'Type'))}</label><select id="sn-t" class="select" data-sepnew="type">${Object.entries(SEP_TYPES).filter(([k]) => k !== 'RESIGNATION').map(([k, v]) => `<option value="${k}" ${S.sepNew.type === k ? 'selected' : ''}>${esc(L(...v))}</option>`).join('')}</select></div><div class="field"><label for="sn-d">${esc(L('آخر يوم عمل', 'Last working day'))}</label><input id="sn-d" type="date" class="input" data-sepnew="lastDay" value="${esc(S.sepNew.lastDay)}"></div><div class="full msg info">${icon('info', 16)}<div>${esc(L('الفصل التأديبي يتطلب قضية معتمدة من المدير القُطري، وتقليص الوظائف يتطلب إخطار جهة العمل حيث تفرض المجموعة القُطرية ذلك.', 'Disciplinary dismissal requires a case approved by the Country Director; redundancy requires labor-authority notice where the country policy set says so.'))} ${rule('DG-009')} ${rule('SP-013')}</div></div></div>`,
    `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="sep-create">${esc(L('إنشاء', 'Create'))}</button>`);
  function empSelect(id, attr, val) {
    const list = D.employees.slice().sort((a, b) => T(a.name).localeCompare(T(b.name), S.lang));
    return `<select id="${id}" class="select" ${attr}><option value="">${esc(L('اختر موظفاً…', 'Choose an employee…'))}</option>${list.map((e) => `<option value="${e.id}" ${val === e.id ? 'selected' : ''}>${esc(`${T(e.name)} · ${e.staffNo}`)}</option>`).join('')}</select>`;
  }
  H.empSelect = empSelect;

  // =====================================================================
  // Change of status (COS) → Country Director approval
  // =====================================================================
  const COS_TYPES = { RENEWAL: ['تجديد عقد', 'Contract renewal'], TRANSFER: ['نقل', 'Transfer'], PROMOTION: ['ترقية', 'Promotion'], SALARY: ['زيادة راتب', 'Salary increase'], ACTING: ['تكليف مؤقت', 'Acting appointment'], FUNDING: ['تغيير التمويل', 'Funding change'] };
  APTYPE.COS = { ar: 'تغيير حالة', en: 'Change of status' };
  const COS = store('cos', () => []);
  function cosInit(empId, type) {
    const e = empById.get(empId);
    S.cosDraft = { empId, type: type || 'RENEWAL', effective: type === 'RENEWAL' ? e.contractEnd : iso(addDays(TODAY, 14)), months: 12, office: e.office, selfReq: false, position: '', grade: Math.min(9, e.grade + 1), pct: 3, actMonths: 3, alloc: e.alloc.map((a) => ({ ...a })), reason: '' };
  }
  function cosCheck(d) {
    const e = empById.get(d.empId); const out = { errors: [], warnings: [], info: [] }; if (!e) return out;
    if (d.type === 'RENEWAL') { const end = H.parse(e.contractEnd); end.setMonth(end.getMonth() + Number(d.months)); out.info.push(R('LC-040', `نهاية العقد الجديدة: ${fmtD(iso(end))}.`, `New contract end: ${fmtD(iso(end))}.`)); if (e.rating === 'UNSATISFACTORY' || e.rating === 'NEEDS_IMPROVEMENT') out.warnings.push(R('PF-009', 'آخر تقييم أقل من مرضٍ.', 'Last appraisal is below satisfactory.')); }
    if (d.type === 'TRANSFER') { if (d.office === e.office) out.errors.push(R('LC-010', 'اختر موقع عمل مختلفاً.', 'Choose a different duty station.')); else if (d.selfReq) out.info.push(R('LC-011', 'نقل بطلب الموظف: لا يُستحق بدل انتقال.', 'Transfer at employee request: no relocation allowance.')); else out.info.push(R('LC-011', 'يُستحق بدل انتقال لمرة واحدة.', 'One-time relocation allowance applies.')); out.info.push(R('LC-013', 'النقل لا يعني زيادة في الراتب.', 'Transfer does not imply a salary increase.')); }
    if (d.type === 'PROMOTION') { if (Number(d.grade) <= e.grade) out.errors.push(R('LC-020', 'الترقية تتطلب درجة أعلى من الحالية.', 'Promotion requires a higher grade.')); if (!d.position.trim()) out.errors.push(R('LC-020', 'أدخل الوظيفة الجديدة.', 'Enter the new position.')); out.warnings.push(R('LC-020', 'تأكد أن الوظيفة شاغرة ومعتمدة وتم الاختيار تنافسياً.', 'Confirm the position is approved and vacant and selection was competitive.')); out.info.push(R('LC-021', 'تبدأ فترة تجربة جديدة بعد الترقية.', 'A new probation period starts after promotion.')); }
    if (d.type === 'SALARY') { const p = Number(d.pct); if (p > D.POLICY.meritMaxPercent) out.errors.push(R('CP-010', `الحد الأقصى للزيادة ${D.POLICY.meritMaxPercent}%.`, `Maximum increase is ${D.POLICY.meritMaxPercent}%.`)); if (p < 1) out.errors.push(R('CP-010', 'الحد الأدنى 1%.', 'Minimum is 1%.')); if (serviceMonths(e) < 12) out.errors.push(R('CP-011', 'يشترط إكمال عقد 12 شهراً.', 'Requires a completed 12-month contract.')); if (['UNSATISFACTORY', 'NEEDS_IMPROVEMENT'].includes(e.rating)) out.errors.push(R('CP-011', 'يشترط تقييم مرضٍ أو أعلى.', 'Requires a satisfactory rating or better.')); out.info.push(R('CP-012', `الراتب الجديد ${money(e.baseSalary * (1 + p / 100))}.`, `New salary ${money(e.baseSalary * (1 + p / 100))}.`)); }
    if (d.type === 'ACTING') { if (Number(d.actMonths) > D.POLICY.actingMaxMonths) out.errors.push(R('LC-031', `الحد الأقصى ${D.POLICY.actingMaxMonths} أشهر.`, `Maximum ${D.POLICY.actingMaxMonths} months.`)); if (!d.position.trim()) out.errors.push(R('LC-030', 'أدخل الوظيفة المكلَّف بها.', 'Enter the acting position.')); out.info.push(R('LC-032', `بدل تكليف ${D.POLICY.actingAllowancePercent}%: ${money(e.baseSalary * D.POLICY.actingAllowancePercent / 100)} شهرياً.`, `Acting allowance ${D.POLICY.actingAllowancePercent}%: ${money(e.baseSalary * D.POLICY.actingAllowancePercent / 100)} per month.`)); }
    if (d.type === 'FUNDING') { const tot = d.alloc.reduce((s, a) => s + (Number(a.pct) || 0), 0); if (tot !== 100) out.errors.push(R('ORG-004', `مجموع التوزيع ${tot}% ويجب أن يساوي 100%.`, `Allocation totals ${tot}%; it must be 100%.`)); }
    if (!d.reason.trim()) out.warnings.push(R('LC-010', 'أضف مبرراً مختصراً للمعتمِدين.', 'Add a short justification for approvers.'));
    return out;
  }
  function cosSummary(c) {
    const e = empById.get(c.empId); const d = c.draft;
    if (c.type === 'RENEWAL') return L(`تمديد ${d.months} شهراً`, `Extend ${d.months} months`);
    if (c.type === 'TRANSFER') return `${officeName(e.office === d.office ? c.before.office : c.before.office)} → ${officeName(d.office)}`;
    if (c.type === 'PROMOTION') return `G${c.before.grade} → G${d.grade} · ${d.position}`;
    if (c.type === 'SALARY') return `+${d.pct}% · ${money(c.before.base)} → ${money(c.before.base * (1 + d.pct / 100))}`;
    if (c.type === 'ACTING') return `${d.position} · ${d.actMonths} ${L('أشهر', 'months')}`;
    if (c.type === 'FUNDING') return d.alloc.filter((a) => a.pct > 0).map((a) => `${a.grant} ${a.pct}%`).join(' · ');
    return '';
  }
  EXT.apTypes.COS = {
    subject: (a) => { const c = COS.find((x) => x.id === a.data.cosId); const e = c && empById.get(c.empId); return e ? `${L(...COS_TYPES[c.type])} · ${T(e.name)}` : ''; },
    facts: (a) => { const c = COS.find((x) => x.id === a.data.cosId); const e = empById.get(c.empId); return [[L('الموظف', 'Employee'), `${T(e.name)} · ${T(e.position)}`], [L('النوع', 'Type'), L(...COS_TYPES[c.type])], [L('التغيير', 'Change'), cosSummary(c)], [L('تاريخ السريان', 'Effective'), fmtD(c.draft.effective)], [L('المبرر', 'Justification'), c.draft.reason || '—'], [L('مقدّم الطلب', 'Requested by'), T(empById.get(a.requester).name.short)]]; },
    checks: (a, out) => { const c = COS.find((x) => x.id === a.data.cosId); const v = cosCheck(c.draft); out.errors.push(...v.errors); out.warnings.push(...v.warnings); out.info.push(...v.info); return out; }
  };
  EXT.onDecide.push((a, status) => {
    if (a.type !== 'COS') return;
    const c = COS.find((x) => x.id === a.data.cosId); c.status = status; if (status !== 'APPROVED') return;
    const e = empById.get(c.empId); const d = c.draft;
    if (c.type === 'RENEWAL') { const end = parse(e.contractEnd); end.setMonth(end.getMonth() + Number(d.months)); e.contractEnd = iso(end); }
    if (c.type === 'TRANSFER') e.office = d.office;
    if (c.type === 'PROMOTION') { e.grade = Number(d.grade); e.position = { ar: d.position, en: d.position }; e.inProbation = true; e.probationEnd = iso(addDays(parse(d.effective), 91)); }
    if (c.type === 'SALARY') e.baseSalary = Math.round(e.baseSalary * (1 + d.pct / 100) / 5) * 5;
    if (c.type === 'FUNDING') e.alloc = d.alloc.filter((x) => x.pct > 0).map((x) => ({ grant: x.grant, pct: Number(x.pct) }));
  });
  EXT.overlays.cos = () => {
    const d = S.cosDraft; const e = empById.get(d.empId); const v = cosCheck(d);
    const typeSel = `<div class="seg" role="group" style="flex-wrap:wrap">${Object.entries(COS_TYPES).map(([k, t]) => `<button aria-pressed="${d.type === k}" data-act="cos-type" data-v="${k}">${esc(L(...t))}</button>`).join('')}</div>`;
    let fields = '';
    if (d.type === 'RENEWAL') fields = `<div class="field"><label>${esc(L('مدة التجديد', 'Renewal period'))}</label><select class="select" data-cos="months">${[3, 6, 12].map((m) => `<option ${Number(d.months) === m ? 'selected' : ''} value="${m}">${m} ${esc(L('أشهر', 'months'))}</option>`).join('')}</select></div>`;
    if (d.type === 'TRANSFER') fields = `<div class="field"><label>${esc(L('موقع العمل الجديد', 'New duty station'))}</label><select class="select" data-cos="office">${D.OFFICES.map((o) => `<option value="${o.id}" ${d.office === o.id ? 'selected' : ''}>${esc(T(o))}</option>`).join('')}</select></div><label class="check-item" style="align-self:end"><input type="checkbox" class="cbx" data-cos="selfReq" ${d.selfReq ? 'checked' : ''}><span>${esc(L('النقل بطلب الموظف', 'At employee request'))}</span></label>`;
    if (d.type === 'PROMOTION' || d.type === 'ACTING') fields = `<div class="field"><label>${esc(d.type === 'ACTING' ? L('الوظيفة المكلَّف بها', 'Acting position') : L('الوظيفة الجديدة', 'New position'))}</label><input class="input" data-cos="position" value="${esc(d.position)}"></div>${d.type === 'PROMOTION' ? `<div class="field"><label>${esc(L('الدرجة الجديدة', 'New grade'))}</label><select class="select" data-cos="grade">${[3, 4, 5, 6, 7, 8, 9].map((g) => `<option value="${g}" ${Number(d.grade) === g ? 'selected' : ''}>G${g}</option>`).join('')}</select></div>` : `<div class="field"><label>${esc(L('المدة (أشهر)', 'Duration (months)'))}</label><input type="number" min="1" max="12" class="input num" data-cos="actMonths" value="${d.actMonths}"></div>`}`;
    if (d.type === 'SALARY') fields = `<div class="field"><label>${esc(L('نسبة الزيادة %', 'Increase %'))}</label><input type="number" min="0" max="20" step="0.5" class="input num" data-cos="pct" value="${d.pct}"></div><div class="field"><span class="flabel">${esc(L('آخر تقييم', 'Last rating'))}</span><div style="padding-top:6px">${esc(T(H.RATING[e.rating]))}</div></div>`;
    if (d.type === 'FUNDING') fields = `<div class="field full"><span class="flabel">${esc(L('توزيع التمويل', 'Funding allocation'))} ${rule('ORG-004')}</span>${D.GRANTS.map((g) => { const a = d.alloc.find((x) => x.grant === g.id); return `<div class="param wide" style="padding:4px 0"><span>${esc(g.id)} · ${esc(T(g))}</span><input type="number" min="0" max="100" step="5" class="input num" style="width:90px" data-cos-alloc="${g.id}" value="${a ? a.pct : 0}"></div>`; }).join('')}</div>`;
    return modal(L('تغيير حالة', 'Change of status'), `<div class="list-item" style="padding-top:0">${avatar(e)}<div class="grow"><div class="t">${esc(T(e.name))}</div><div class="subtle">${esc(`${T(e.position)} · G${e.grade} · ${officeName(e.office)} · ${L('العقد حتى', 'contract to')} ${fmtD(e.contractEnd)}`)}</div></div></div>${typeSel}
      <div class="form-grid">${fields}<div class="field"><label>${esc(L('تاريخ السريان', 'Effective date'))}</label><input type="date" class="input" data-cos="effective" value="${esc(d.effective)}"></div><div class="field full"><label>${esc(L('المبرر', 'Justification'))}</label><textarea class="textarea" data-cos="reason">${esc(d.reason)}</textarea></div></div>
      <div id="cos-check">${msgs(v)}</div><div class="msg info">${icon('info', 16)}<div>${esc(L('المسار: الموارد البشرية ← المدير القُطري (بطاقة في Teams وOutlook).', 'Route: HR → Country Director (card in Teams and Outlook).'))}</div></div>`,
      `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="cos-submit" id="cos-submit" ${v.errors.length ? 'disabled' : ''}>${icon('send', 16)}${esc(L('إرسال للاعتماد', 'Send for approval'))}</button>`);
  };
  function vChanges() {
    const st = { PENDING: ['b-warn', L('بانتظار المدير القُطري', 'Awaiting Country Director')], APPROVED: ['b-ok', L('معتمد ومطبَّق', 'Approved & applied')], REJECTED: ['b-bad', L('مرفوض', 'Rejected')] };
    const rows = COS.map((c) => { const e = empById.get(c.empId); return `<tr class="clickable" data-act="emp" data-id="${e.id}"><td class="num">${esc(c.id)}</td><td>${who(e, T(e.position))}</td><td>${badge('b-neutral', L(...COS_TYPES[c.type]))}</td><td>${esc(cosSummary(c))}</td><td>${esc(fmtD(c.draft.effective))}</td><td>${badge(st[c.status][0], st[c.status][1])}</td></tr>`; });
    const exp = D.employees.filter((e) => { const d = daysBetween(D.todayISO, e.contractEnd); return d >= 0 && d <= 30 && e.category === 'REGULAR'; }).length;
    return `${pageHead(L('تغييرات الحالة', 'Changes of status'), esc(L('التجديد والنقل والترقية والزيادة والتكليف وتغيير التمويل: كل تغيير مؤرخ وموثّق ومعتمد.', 'Renewals, transfers, promotions, increases, acting and funding changes, each dated, documented and approved.')) + ' ' + rule('LC-010'), `<button class="btn primary" data-act="cos-pick">${icon('plus', 16)}${esc(L('تغيير جديد', 'New change'))}</button>`)}
      ${exp ? `<div class="banner info"><span class="bi">${icon('doc', 18)}</span><div class="grow"><b>${esc(L(`${exp} عقداً دائماً تنتهي خلال 30 يوماً`, `${exp} regular contracts end within 30 days`))}</b><div class="subtle">${esc(L('ابدأ التجديد من لوحة المتابعة أو من ملف الموظف.', 'Start renewals from the dashboard or the employee file.'))} ${rule('LC-040')}</div></div><button class="btn sm" data-act="nav-sub" data-v="employees" data-k="contracts">${esc(L('عرض العقود', 'View contracts'))}</button></div>` : ''}
      <section class="card flush">${table([L('الرقم', 'ID'), L('الموظف', 'Employee'), L('النوع', 'Type'), L('التغيير', 'Change'), L('السريان', 'Effective'), L('الحالة', 'Status')], rows, emptyState('doc', L('لا توجد تغييرات بعد', 'No changes yet'), L('ابدأ من ملف أي موظف أو من زر "تغيير جديد".', 'Start from any employee file or the "New change" button.')))}</section>`;
  }
  EXT.overlays['cos-pick'] = () => modal(L('تغيير جديد', 'New change'), `<div class="field"><label for="cp-e">${esc(L('الموظف', 'Employee'))}</label>${empSelect('cp-e', 'data-cospick="1"', '')}</div>`, `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button>`);

  // =====================================================================
  // Letters (employee self-service → HR issues from template)
  // =====================================================================
  const LTYPES = { EMPLOYMENT_CERT: ['شهادة عمل', 'Employment certificate'], SALARY_CERT: ['شهادة راتب', 'Salary certificate'], TO_WHOM: ['إلى من يهمه الأمر', 'To whom it may concern'], BANK_INTRO: ['خطاب تعريف للبنك', 'Bank introduction letter'], EMBASSY: ['خطاب لسفارة', 'Embassy letter'] };
  const LETTERS = store('letters', () => {
    const r = H.rng(31); const pick = () => D.employees[4 + Math.floor(r() * 700)];
    return [
      { id: 'LTR-1001', empId: pick().id, type: 'SALARY_CERT', to: { ar: 'بنك تجاري', en: 'Commercial bank' }, lang: 'ar', purpose: { ar: 'طلب قرض', en: 'Loan application' }, status: 'REQUESTED', requested: iso(addDays(TODAY, -2)) },
      { id: 'LTR-1002', empId: pick().id, type: 'EMPLOYMENT_CERT', to: { ar: 'جامعة', en: 'University' }, lang: 'en', purpose: { ar: 'تسجيل دراسات عليا', en: 'Graduate admission' }, status: 'REQUESTED', requested: iso(addDays(TODAY, -1)) },
      { id: 'LTR-1003', empId: pick().id, type: 'EMBASSY', to: { ar: 'سفارة', en: 'Embassy' }, lang: 'en', purpose: { ar: 'تأشيرة تدريب', en: 'Training visa' }, status: 'REQUESTED', requested: D.todayISO },
      { id: 'LTR-1004', empId: D.personas.EMPLOYEE, type: 'EMPLOYMENT_CERT', to: { ar: 'إلى من يهمه الأمر', en: 'To whom it may concern' }, lang: 'ar', purpose: { ar: 'ملف شخصي', en: 'Personal records' }, status: 'ISSUED', requested: iso(addDays(TODAY, -20)), issued: iso(addDays(TODAY, -19)) }
    ].map((x) => ({ ...x, to: typeof x.to === 'string' ? x.to : x.to }));
  });
  function letterBody(l) {
    const e = empById.get(l.empId); const ar = l.lang === 'ar'; const org = ar ? D.ORG.ar : D.ORG.en;
    const nm = ar ? e.name.ar : e.name.en; const pos = ar ? e.position.ar : e.position.en; const off = (D.OFFICES.find((o) => o.id === e.office) || {})[ar ? 'ar' : 'en'];
    const since = new Intl.DateTimeFormat(ar ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(parse(e.hireDate));
    const sal = `${new Intl.NumberFormat('en-US').format(e.baseSalary)} ${ar ? 'دولار أمريكي' : 'USD'}`;
    const title = ar ? LTYPES[l.type][0] : LTYPES[l.type][1]; const g = (f, m) => (e.gender === 'F' ? f : m);
    let p = ar ? `تشهد مؤسسة ${org} بأن ${e.gender === 'F' ? 'السيدة' : 'السيد'} <b>${esc(nm)}</b>، الرقم الوظيفي ${esc(e.staffNo)}، ${e.gender === 'F' ? 'تعمل' : 'يعمل'} لديها بوظيفة <b>${esc(pos)}</b> في ${esc(off)} منذ ${esc(since)}، وما ${e.gender === 'F' ? 'زالت' : 'زال'} على رأس ${g('عملها', 'عمله')} حتى تاريخه.` : `This is to certify that <b>${esc(nm)}</b>, staff number ${esc(e.staffNo)}, has been employed by ${esc(org)} as <b>${esc(pos)}</b> at the ${esc(off)} since ${esc(since)}, and remains in service as of the date of this letter.`;
    if (l.type === 'SALARY_CERT' || l.type === 'BANK_INTRO') p += ar ? ` ${g('وتتقاضى', 'ويتقاضى')} راتباً أساسياً شهرياً قدره ${sal}${l.type === 'BANK_INTRO' ? `، ونرجو تسهيل فتح حساب بنكي ${g('لها لتحويل راتبها', 'له لتحويل راتبه')}` : ''}.` : ` The monthly base salary is ${sal}.${l.type === 'BANK_INTRO' ? ' We kindly request that a bank account be opened for salary transfer.' : ''}`;
    if (l.type === 'EMBASSY') p += ar ? ` ونؤكد أن ${g('سفرها', 'سفره')} لأغراض العمل أو التدريب، ${g('وأنها ستعود لاستئناف عملها', 'وأنه سيعود لاستئناف عمله')}.` : ' We confirm the travel is for work or training purposes and that the employee will return to resume duties.';
    const close = ar ? `أُعطي هذا الخطاب بناءً على ${g('طلبها', 'طلبه')} لتقديمه إلى الجهة المذكورة، دون أي مسؤولية على المؤسسة.` : 'This letter is issued at the employee\'s request for submission to the addressee, without any liability on the organization.';
    return `<div style="direction:${ar ? 'rtl' : 'ltr'};text-align:${ar ? 'right' : 'left'};display:grid;gap:12px"><div>${ar ? 'إلى' : 'To'}: <b>${esc(l.to && typeof l.to === 'object' ? l.to[l.lang] : l.to)}</b></div><h3>${esc(title)}</h3><p style="margin:0">${p}</p><p style="margin:0">${close}</p></div>`;
  }
  S.ltrDraft = S.ltrDraft || { type: 'EMPLOYMENT_CERT', to: '', lang: S.lang, purpose: '' };
  const LST = { REQUESTED: ['b-warn', ['قيد الإصدار', 'Being prepared']], ISSUED: ['b-ok', ['صدر', 'Issued']] };
  function vEmpLetters() {
    const d = S.ltrDraft; const mine = LETTERS.filter((x) => x.empId === me().id);
    return `${pageHead(L('الخطابات والشهادات', 'Letters & certificates'), esc(L('اطلب خطابك وستصدره الموارد البشرية من قالب معتمد، ويصلك إشعار عند جاهزيته.', 'Request a letter; HR issues it from an approved template and notifies you when it is ready.')) + ' ' + rule('RD-005'))}
      <div class="grid g-12">
        <section class="card"><h2>${esc(L('طلب جديد', 'New request'))}</h2><div class="form-grid">
          <div class="field full"><label for="lt-t">${esc(L('نوع الخطاب', 'Letter type'))}</label><select id="lt-t" class="select" data-ltr="type">${Object.entries(LTYPES).map(([k, v]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${esc(L(...v))}</option>`).join('')}</select></div>
          <div class="field full"><label for="lt-to">${esc(L('موجّه إلى', 'Addressed to'))}</label><input id="lt-to" class="input" data-ltr="to" value="${esc(d.to)}" placeholder="${esc(L('مثال: البنك، الجامعة، السفارة', 'e.g. bank, university, embassy'))}"></div>
          <div class="field full"><span class="flabel">${esc(L('لغة الخطاب', 'Language'))}</span><div class="radio-group"><label class="radio"><input type="radio" name="lt-lang" value="ar" data-ltr="lang" ${d.lang === 'ar' ? 'checked' : ''}><span>العربية</span></label><label class="radio"><input type="radio" name="lt-lang" value="en" data-ltr="lang" ${d.lang === 'en' ? 'checked' : ''}><span>English</span></label></div></div>
          <div class="field full"><label for="lt-p">${esc(L('الغرض', 'Purpose'))}</label><input id="lt-p" class="input" data-ltr="purpose" value="${esc(d.purpose)}"></div>
          <div class="full"><button class="btn primary" data-act="ltr-submit">${icon('send', 16)}${esc(L('إرسال الطلب', 'Submit request'))}</button></div></div></section>
        <section class="card"><h2>${esc(L('طلباتي', 'My requests'))}</h2>${table([L('الرقم', 'ID'), L('النوع', 'Type'), L('التاريخ', 'Date'), L('الحالة', 'Status'), ''], mine.map((l) => `<tr><td class="num">${esc(l.id)}</td><td>${esc(L(...LTYPES[l.type]))}</td><td>${esc(fmtD(l.requested))}</td><td>${badge(LST[l.status][0], L(...LST[l.status][1]))}</td><td>${l.status === 'ISSUED' ? `<button class="btn sm" data-act="ltr-view" data-id="${l.id}">${esc(L('عرض', 'View'))}</button>` : ''}</td></tr>`), emptyState('mail', L('لا توجد طلبات', 'No requests yet')))}</section>
      </div>`;
  }
  function vLetters() {
    const q = LETTERS.filter((l) => l.status === 'REQUESTED'); const done = LETTERS.filter((l) => l.status === 'ISSUED');
    const row = (l, act) => { const e = empById.get(l.empId); return `<tr><td class="num">${esc(l.id)}</td><td>${who(e, e.staffNo)}</td><td>${esc(L(...LTYPES[l.type]))}</td><td>${esc(T(l.to))}</td><td>${esc(l.lang === 'ar' ? 'العربية' : 'English')}</td><td>${esc(fmtD(l.requested))}</td><td style="text-align:end"><div class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn sm" data-act="ltr-view" data-id="${l.id}">${esc(L('معاينة', 'Preview'))}</button>${act ? `<button class="btn sm primary" data-act="ltr-issue" data-id="${l.id}">${esc(L('إصدار', 'Issue'))}</button>` : ''}</div></td></tr>`; };
    const head = [L('الرقم', 'ID'), L('الموظف', 'Employee'), L('النوع', 'Type'), L('موجّه إلى', 'To'), L('اللغة', 'Lang.'), L('الطلب', 'Requested'), ''];
    return `${pageHead(L('الخطابات والشهادات', 'Letters & certificates'), esc(L('تصدر من قوالب معتمدة، ولا يصدر أي تأكيد توظيف أو مرجع إلا من الموارد البشرية.', 'Issued from approved templates; employment verification and references come only from HR.')) + ' ' + rule('RD-005'))}
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('بانتظار الإصدار', 'To issue'))} <span class="subtle">${q.length}</span></h2></div>${table(head, q.map((l) => row(l, true)), emptyState('check', L('لا توجد طلبات معلّقة', 'All caught up')))}</section>
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('صدرت مؤخراً', 'Recently issued'))}</h2></div>${table(head, done.slice(0, 10).map((l) => row(l, false)))}</section>`;
  }

  // =====================================================================
  // Registration
  // =====================================================================
  addNav('HR', 'people', ['الموظفون', 'People'], { v: 'onboarding', ic: 'person', ar: 'الاستقبال', en: 'Onboarding' });
  addNav('HR', 'people', ['الموظفون', 'People'], { v: 'changes', ic: 'doc', ar: 'تغييرات الحالة', en: 'Changes of status' });
  addNav('HR', 'people', ['الموظفون', 'People'], { v: 'separations', ic: 'flag', ar: 'إنهاء الخدمة', en: 'Separations' });
  addNav('HR', 'services', ['الخدمات', 'Services'], { v: 'letters', ic: 'mail', ar: 'الخطابات', en: 'Letters' }, 3);
  Object.assign(VIEWS.HR, { onboarding: vOnboarding, changes: vChanges, separations: vSeparations, letters: vLetters });
  addNav('EMPLOYEE', 'me', ['حسابي', 'My account'], { v: 'letters', ic: 'mail', ar: 'الخطابات والشهادات', en: 'Letters' });
  VIEWS.EMPLOYEE.letters = vEmpLetters;

  EXT.hrDash.push(() => `<div class="grid g-4 keep2">
    ${kpi(L('قيد الاستقبال', 'In onboarding'), fmtN(ONB.filter((c) => !c.payroll).length), L(`${ONB.filter((c) => onbReqMissing(c).length).length} بشروط راتب ناقصة`, `${ONB.filter((c) => onbReqMissing(c).length).length} with payroll blockers`), 'person', 'onboarding')}
    ${kpi(L('حالات إنهاء خدمة مفتوحة', 'Open separations'), fmtN(SEP.filter((c) => c.status !== 'PAID').length), L(`${SEP.filter((c) => !sepCleared(c)).length} بإخلاء طرف ناقص`, `${SEP.filter((c) => !sepCleared(c)).length} with clearance pending`), 'flag', 'separations')}
    ${kpi(L('تغييرات بانتظار الاعتماد', 'Changes awaiting approval'), fmtN(COS.filter((c) => c.status === 'PENDING').length), rule('LC-010'), 'doc', 'changes')}
    ${kpi(L('خطابات بانتظار الإصدار', 'Letters to issue'), fmtN(LETTERS.filter((l) => l.status === 'REQUESTED').length), rule('RD-005'), 'mail', 'letters')}</div>`);

  Object.assign(EXT.actions, {
    'onb-open': (t) => openOverlay({ type: 'onb', id: t.dataset.id }),
    'onb-activate': (t) => { const c = ONB.find((x) => x.id === t.dataset.id); if (onbReqMissing(c).length) return; c.payroll = true; audit(`تفعيل راتب ${c.id}`, `Payroll activated for ${c.id}`); addActivity('HR', 'teams', `فُعّل راتب ${c.name.ar}`, `Payroll activated: ${c.name.en}`, 'onboarding'); render(); toast(L('فُعّل الراتب.', 'Payroll activated.'), 'ok'); },
    'onb-contract': (t) => { const c = ONB.find((x) => x.id === t.dataset.id); openOverlay({ type: 'doc', title: L('عقد عمل', 'Employment contract'), ref: c.id, body: `<h3>${esc(L('عقد عمل محدد المدة', 'Fixed-term employment contract'))}</h3><p style="margin:0">${esc(L(`أُبرم هذا العقد بين ${T(D.ORG)} والموظف/ة ${T(c.name)} لشغل وظيفة ${T(c.position)} بالدرجة G${c.grade} في ${officeName(c.office)}، ابتداءً من ${fmtD(c.start)}، مع فترة تجربة مدتها ${D.POLICY.probationMonths} أشهر.`, `This contract is made between ${T(D.ORG)} and ${T(c.name)} for the position of ${T(c.position)}, grade G${c.grade}, at ${officeName(c.office)}, starting ${fmtD(c.start)}, with a probation period of ${D.POLICY.probationMonths} months.`))}</p><p style="margin:0" class="subtle">${esc(L('تُرفق به: الوصف الوظيفي، ودليل الموظف، ومدونة السلوك، وإقرار السرية.', 'Annexes: job description, employee handbook, code of conduct, confidentiality statement.'))}</p>` }); },
    'sep-open': (t) => openOverlay({ type: 'sep', id: t.dataset.id }),
    'sep-doc': (t) => { const c = SEP.find((x) => x.id === t.dataset.id); const e = sepEmp(c); openOverlay({ type: 'doc', title: L('كشف التسوية النهائية', 'Final settlement statement'), ref: c.id, body: `<h3>${esc(L('كشف التسوية النهائية', 'Final settlement statement'))}</h3><dl class="kv"><dt>${esc(L('الموظف', 'Employee'))}</dt><dd>${esc(T(e.name))} · ${esc(e.staffNo)}</dd><dt>${esc(L('النوع', 'Type'))}</dt><dd>${esc(L(...SEP_TYPES[c.type]))}</dd><dt>${esc(L('آخر يوم عمل', 'Last working day'))}</dt><dd>${esc(fmtD(c.lastDay))}</dd></dl>${settleTable(settlement(c))}` }); },
    'sep-pay': (t) => { const c = SEP.find((x) => x.id === t.dataset.id); if (!sepCleared(c) || !c.exitEval) return; c.status = 'PAID'; audit(`صرف مستحقات ${c.id}`, `Final pay released for ${c.id}`); S.overlay = null; render(); toast(L('أُرسلت المستحقات النهائية للمالية للصرف.', 'Final pay sent to Finance for payment.'), 'ok'); },
    'sep-new': () => openOverlay({ type: 'sep-new' }),
    'sep-create': () => { const d = S.sepNew; if (!d.empId) { toast(L('اختر موظفاً.', 'Choose an employee.'), 'bad'); return; } const id = `SEP-${1001 + SEP.length}`; SEP.unshift({ id, empId: d.empId, type: d.type, submitted: D.todayISO, lastDay: d.lastDay, reason: '', cleared: [], exitEval: null, advances: 0, status: 'OPEN' }); audit(`إنشاء حالة انفصال ${id}`, `Separation ${id} created`); S.overlay = { type: 'sep', id }; render(); },
    'resign-open': () => openOverlay({ type: 'resign' }),
    'resign-submit': () => { if (resignCheck().errors.length) return; const id = `SEP-${1001 + SEP.length}`; SEP.unshift({ id, empId: me().id, type: 'RESIGNATION', submitted: D.todayISO, lastDay: S.resign.lastDay, reason: L(...REASONS[S.resign.reason]), cleared: [], exitEval: null, advances: 0, status: 'OPEN' }); addActivity('HR', 'outlook', `استقالة جديدة من ${me().name.ar}`, `New resignation from ${me().name.en}`, 'separations'); addActivity('MANAGER', 'teams', `قدّمت ${me().name.ar} استقالتها`, `${me().name.en} submitted a resignation`, 'team'); audit(`تقديم استقالة ${id}`, `Resignation ${id} submitted`); S.overlay = null; render(); toast(L('أُرسلت الاستقالة إلى مديرك والموارد البشرية.', 'Resignation sent to your manager and HR.'), 'ok'); },
    'cos-new': (t) => { cosInit(t.dataset.id, t.dataset.type); openOverlay({ type: 'cos' }); },
    'cos-pick': () => openOverlay({ type: 'cos-pick' }),
    'cos-type': (t) => { S.cosDraft.type = t.dataset.v; if (t.dataset.v === 'RENEWAL') S.cosDraft.effective = empById.get(S.cosDraft.empId).contractEnd; render(); },
    'cos-submit': () => {
      const d = S.cosDraft; if (cosCheck(d).errors.length) return; const e = empById.get(d.empId);
      const id = `COS-${1001 + COS.length}`; const apId = `AP-${700 + D.approvals.length}`;
      COS.unshift({ id, empId: d.empId, type: d.type, draft: JSON.parse(JSON.stringify(d)), before: { office: e.office, grade: e.grade, base: e.baseSalary, end: e.contractEnd }, status: 'PENDING', apId });
      D.approvals.unshift({ id: apId, type: 'COS', requester: D.personas.HR, subject: e.id, created: D.todayISO, status: 'PENDING', data: { cosId: id }, rules: ['LC-010'] });
      addActivity('CD', 'teams', `تغيير حالة بانتظار اعتمادك: ${e.name.ar}`, `Change of status awaiting your approval: ${e.name.en}`, 'approvals');
      audit(`إنشاء تغيير حالة ${id}`, `Change of status ${id} created`);
      S.overlay = null; render(); toast(L('أُرسل للمدير القُطري كبطاقة في Teams وOutlook.', 'Sent to the Country Director as a Teams and Outlook card.'), 'ok');
    },
    'ltr-submit': () => { const d = S.ltrDraft; if (!d.to.trim()) { toast(L('أدخل الجهة الموجّه إليها الخطاب.', 'Enter the addressee.'), 'bad'); return; } const id = `LTR-${1001 + LETTERS.length}`; LETTERS.unshift({ id, empId: me().id, type: d.type, to: d.to, lang: d.lang, purpose: d.purpose, status: 'REQUESTED', requested: D.todayISO }); addActivity('HR', 'teams', `طلب خطاب ${id}`, `Letter request ${id}`, 'letters'); audit(`طلب خطاب ${id}`, `Letter ${id} requested`); S.ltrDraft = { type: d.type, to: '', lang: d.lang, purpose: '' }; render(); toast(L('أُرسل الطلب للموارد البشرية.', 'Request sent to HR.'), 'ok'); },
    'ltr-view': (t) => { const l = LETTERS.find((x) => x.id === t.dataset.id); openOverlay({ type: 'doc', title: L(...LTYPES[l.type]), ref: l.id, body: letterBody(l) }); },
    'ltr-issue': (t) => { const l = LETTERS.find((x) => x.id === t.dataset.id); l.status = 'ISSUED'; l.issued = D.todayISO; if (l.empId === me().id) addActivity('EMPLOYEE', 'teams', `خطابك ${l.id} جاهز`, `Your letter ${l.id} is ready`, 'letters'); audit(`إصدار خطاب ${l.id}`, `Letter ${l.id} issued`); render(); toast(L('صدر الخطاب وأُبلغ الموظف عبر Teams.', 'Letter issued; employee notified in Teams.'), 'ok'); }
  });
  EXT.onChange.push((t) => {
    if (t.dataset.onb) { const c = ONB.find((x) => x.id === t.dataset.onb); c.done = t.checked ? [...new Set([...c.done, t.dataset.k])] : c.done.filter((k) => k !== t.dataset.k); audit(`استقبال ${c.id}: ${t.dataset.k}`, `Onboarding ${c.id}: ${t.dataset.k} ${t.checked ? 'done' : 'reopened'}`); render(); return true; }
    if (t.dataset.sep) { const c = SEP.find((x) => x.id === t.dataset.sep); c.cleared = t.checked ? [...new Set([...c.cleared, t.dataset.k])] : c.cleared.filter((k) => k !== t.dataset.k); audit(`إخلاء طرف ${c.id}: ${t.dataset.k}`, `Clearance ${c.id}: ${t.dataset.k}`); render(); return true; }
    if (t.dataset.sepPil) { const c = SEP.find((x) => x.id === t.dataset.sepPil); c.payInLieu = t.checked; render(); return true; }
    if (t.dataset.rehire) { const c = SEP.find((x) => x.id === t.dataset.rehire); c.exitEval = { rehire: t.value }; audit(`تقييم خروج ${c.id}: ${t.value}`, `Exit evaluation ${c.id}: ${t.value}`); render(); toast(L('حُفظ تقييم الخروج.', 'Exit evaluation saved.'), 'ok'); return true; }
    if (t.dataset.resign) { S.resign[t.dataset.resign] = t.value; const c = document.getElementById('rs-check'); if (c) c.innerHTML = msgs(resignCheck()); return true; }
    if (t.dataset.sepnew) { S.sepNew[t.dataset.sepnew] = t.value; return true; }
    if (t.dataset.cospick) { if (!t.value) return true; cosInit(t.value); S.overlay = { type: 'cos' }; render(); return true; }
    if (t.dataset.cos) { const k = t.dataset.cos; S.cosDraft[k] = t.type === 'checkbox' ? t.checked : t.value; render(); return true; }
    if (t.dataset.cosAlloc) { const g = t.dataset.cosAlloc; const a = S.cosDraft.alloc.find((x) => x.grant === g); const v = Math.max(0, Math.min(100, Number(t.value) || 0)); if (a) a.pct = v; else S.cosDraft.alloc.push({ grant: g, pct: v }); render(); return true; }
    if (t.dataset.ltr) { S.ltrDraft[t.dataset.ltr] = t.value; return true; }
    return false;
  });
  EXT.onInput.push((t) => {
    if (t.dataset.ltr && t.type !== 'radio') { S.ltrDraft[t.dataset.ltr] = t.value; return true; }
    if (t.dataset.resign && t.tagName === 'TEXTAREA') { S.resign.note = t.value; return true; }
    if (t.dataset.cos === 'reason' || t.dataset.cos === 'position') { S.cosDraft[t.dataset.cos] = t.value; const c = document.getElementById('cos-check'); if (c) c.innerHTML = msgs(cosCheck(S.cosDraft)); const b = document.getElementById('cos-submit'); if (b) b.disabled = !!cosCheck(S.cosDraft).errors.length; return true; }
    return false;
  });
})();
