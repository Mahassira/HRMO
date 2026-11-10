/* HRMO module — Employee relations: conduct/absence cases, warning ladder, grievances,
 * HR helpdesk, conflict-of-interest and gift declarations.
 * Rules: DG-001..025, WT-013, WT-015, HD-001..004, CC-003, CC-004. */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, VIEWS, APTYPE, L, T, esc, icon, fmtN, fmtD, money, parse, iso, addDays, daysBetween, TODAY, badge, rule, who, toast, addActivity, emptyState, empById, persona, me, render, openOverlay, pageHead, table, store, addNav, audit, drawer, modal, msgs, R, kpi, meter, officeName, isWorkDay } = H;
  const addBiz = (from, n) => { let d = parse(from); let k = 0; while (k < n) { d = addDays(d, 1); if (isWorkDay(d)) k++; } return iso(d); };
  const pick = (i) => D.employees.filter((e) => e.category === 'REGULAR' && !Object.values(D.personas).includes(e.id))[i];

  // =====================================================================
  // Cases and warnings
  // =====================================================================
  const LADDER = [['COACHING', 'توجيه وإرشاد', 'Coaching'], ['VERBAL', 'إنذار شفهي', 'Verbal warning'], ['WRITTEN_1', 'إنذار كتابي أول', 'First written warning'], ['WRITTEN_2', 'إنذار كتابي ثانٍ', 'Second written warning'], ['WRITTEN_3', 'إنذار كتابي نهائي', 'Final written warning'], ['SUSPENSION', 'إيقاف عن العمل', 'Suspension'], ['DISMISSAL', 'فصل', 'Dismissal']];
  const ABS_DECISIONS = [['AUTHORIZED', 'غياب مبرَّر (ظرف قاهر)', 'Authorized absence (force majeure)'], ['UNPAID', 'خصم الأيام بدون راتب', 'Deduct as unpaid days'], ['DEEMED_RESIGNATION', 'اعتباره استقالة', 'Treat as resignation']];
  const ladderIdx = (k) => LADDER.findIndex((x) => x[0] === k);
  const WARN = store('warnings', () => [
    { id: 'WRN-1', empId: pick(12).id, level: 'WRITTEN_1', issued: iso(addDays(TODAY, -120)), reason: { ar: 'مخالفة سياسة استخدام المركبات', en: 'Vehicle policy breach' } },
    { id: 'WRN-2', empId: pick(13).id, level: 'VERBAL', issued: iso(addDays(TODAY, -60)), reason: { ar: 'تأخير متكرر', en: 'Repeated lateness' } },
    { id: 'WRN-3', empId: pick(14).id, level: 'WRITTEN_1', issued: iso(addDays(TODAY, -420)), reason: { ar: 'عدم الالتزام بإجراءات المشتريات', en: 'Procurement procedure breach' } }
  ]);
  const expiry = (w) => { const d = parse(w.issued); d.setMonth(d.getMonth() + D.POLICY.warningValidityMonths); return iso(d); };
  const activeWarn = (empId) => WARN.filter((w) => w.empId === empId && expiry(w) >= D.todayISO);
  function nextStep(empId) { const a = activeWarn(empId); const top = a.reduce((m, w) => Math.max(m, ladderIdx(w.level)), 0); return LADDER[Math.min(LADDER.length - 2, a.length ? top + 1 : 1)][0]; }
  const tl = (ar, en) => ({ at: D.todayISO, ar, en });
  const CASES = store('cases', () => {
    const late = D.employees.slice(40, 44).find((e) => e.lateMarks >= 3) || D.employees[41];
    return [
      { id: 'CASE-6001', kind: 'CONDUCT', empId: D.employees[41].id, category: 'ATTENDANCE', source: 'LATENESS', opened: iso(addDays(TODAY, -8)), status: 'PENDING_APPROVAL', response: { ar: 'تأخرت بسبب الحواجز على الطريق وسألتزم بالإبلاغ المسبق.', en: 'Delays were due to road checkpoints; I will notify in advance.' }, proposal: 'WRITTEN_1', apId: 'AP-505', timeline: [{ at: iso(addDays(TODAY, -8)), ar: 'فُتح الملف تلقائياً: 4 علامات تأخير', en: 'Opened automatically: 4 late marks' }, { at: iso(addDays(TODAY, -5)), ar: 'طُلب رد الموظف', en: 'Employee response requested' }, { at: iso(addDays(TODAY, -3)), ar: 'سُجّل رد الموظف', en: 'Employee response recorded' }, { at: iso(addDays(TODAY, -1)), ar: 'اقتُرح إنذار كتابي أول وأُرسل للمدير القُطري', en: 'First written warning proposed; sent to Country Director' }] },
      { id: 'CASE-6002', kind: 'ABSENCE', empId: pick(150).id, category: 'ATTENDANCE', source: 'ATTENDANCE', opened: iso(addDays(TODAY, -1)), status: 'OPEN', timeline: [{ at: iso(addDays(TODAY, -1)), ar: 'فُتح الملف: 5 أيام غياب متتالية دون إشعار', en: 'Opened: 5 consecutive days absent without notice' }] },
      { id: 'CASE-6003', kind: 'GRIEVANCE', empId: pick(222).id, category: 'WORKLOAD', against: 'MANAGER', opened: iso(addDays(TODAY, -11)), level: 1, deadline: addBiz(iso(addDays(TODAY, -11)), D.POLICY.grievanceDays || 7), status: 'OPEN', text: { ar: 'توزيع المناوبات غير عادل منذ ثلاثة أشهر.', en: 'Shift allocation has been unfair for three months.' }, timeline: [{ at: iso(addDays(TODAY, -11)), ar: 'قُدّم التظلّم', en: 'Grievance submitted' }] },
      { id: 'CASE-6004', kind: 'GRIEVANCE', empId: pick(260).id, category: 'PAY', against: 'OTHER', opened: iso(addDays(TODAY, -2)), level: 1, deadline: addBiz(iso(addDays(TODAY, -2)), 7), status: 'OPEN', text: { ar: 'لم يُحتسب العمل الإضافي في راتب الشهر الماضي.', en: 'Last month\'s overtime was not paid.' }, timeline: [{ at: iso(addDays(TODAY, -2)), ar: 'قُدّم التظلّم', en: 'Grievance submitted' }] }
    ];
  });
  const KIND = { CONDUCT: ['ملف سلوك', 'Conduct case'], ABSENCE: ['ملف غياب', 'Absence case'], GRIEVANCE: ['تظلّم', 'Grievance'] };
  const CST = { OPEN: ['b-warn', 'مفتوح', 'Open'], AWAITING_RESPONSE: ['b-info', 'بانتظار رد الموظف', 'Awaiting response'], RESPONDED: ['b-info', 'تم الرد', 'Responded'], PENDING_APPROVAL: ['b-warn', 'بانتظار المدير القُطري', 'With Country Director'], DECIDED: ['b-ok', 'صدر القرار', 'Decided'], CLOSED: ['b-neutral', 'مغلق', 'Closed'], RESOLVED: ['b-ok', 'حُلّ', 'Resolved'] };
  const GCAT = { WORKLOAD: ['عبء العمل والمناوبات', 'Workload and shifts'], MANAGEMENT: ['أسلوب الإدارة', 'Management style'], PAY: ['الراتب والمستحقات', 'Pay and entitlements'], CONDITIONS: ['ظروف العمل', 'Working conditions'], OTHER: ['أخرى', 'Other'], HARASSMENT: ['تحرش أو إساءة', 'Harassment or abuse'], FRAUD: ['احتيال أو فساد', 'Fraud or corruption'], SAFEGUARDING: ['استغلال أو انتهاك (حماية)', 'Exploitation or abuse (safeguarding)'] };
  const REDIRECT = ['HARASSMENT', 'FRAUD', 'SAFEGUARDING'];
  const gOverdue = (c) => c.kind === 'GRIEVANCE' && ['OPEN'].includes(c.status) && c.deadline < D.todayISO;

  APTYPE.SANCTION = { ar: 'قرار تأديبي', en: 'Disciplinary decision' };
  const decisionLabel = (c) => (c.kind === 'ABSENCE' ? L(...ABS_DECISIONS.find((x) => x[0] === c.proposal).slice(1)) : L(...LADDER[ladderIdx(c.proposal)].slice(1)));
  EXT.apTypes.SANCTION = {
    subject: (a) => { const c = CASES.find((x) => x.id === a.data.caseId); return `${decisionLabel(c)} · ${T(empById.get(c.empId).name)}`; },
    facts: (a) => { const c = CASES.find((x) => x.id === a.data.caseId); const e = empById.get(c.empId); return [[L('الموظف', 'Employee'), `${T(e.name)} · ${T(e.position)}`], [L('الملف', 'Case'), `${c.id} · ${L(...KIND[c.kind])}`], [L('القرار المقترح', 'Proposed decision'), decisionLabel(c)], [L('رد الموظف', 'Employee response'), T(c.response) || '—'], [L('إنذارات سارية', 'Active warnings'), String(activeWarn(e.id).length)]]; },
    checks: (a, out) => { const c = CASES.find((x) => x.id === a.data.caseId); if (c.kind !== 'ABSENCE' && !c.response) out.errors.push(R('DG-002', 'لم يُسجَّل رد الموظف.', 'No employee response recorded.')); else out.info.push(R('DG-002', 'أُتيحت للموظف فرصة الرد.', 'The employee was given the chance to respond.')); if (c.kind === 'ABSENCE' && c.proposal === 'DEEMED_RESIGNATION') out.warnings.push(R('WT-015', 'تأكد من استنفاد محاولات التواصل ومن عدم وجود ظرف قاهر.', 'Make sure contact attempts were exhausted and no force majeure applies.')); if (c.proposal === 'SUSPENSION') out.info.push(R('DG-005', `الحد الأقصى للإيقاف ${D.POLICY.maxSuspensionDays || 5} أيام.`, `Suspension maximum ${D.POLICY.maxSuspensionDays || 5} days.`)); if (c.kind !== 'ABSENCE') out.info.push(R('DG-006', `يسقط الإنذار بعد ${D.POLICY.warningValidityMonths} شهراً.`, `Warning expires after ${D.POLICY.warningValidityMonths} months.`)); return out; }
  };
  function applyDecision(c, status) {
    if (status !== 'APPROVED') { c.status = 'CLOSED'; c.timeline.push(tl('رُفض القرار المقترح وأُغلق الملف', 'Proposed decision rejected; case closed')); return; }
    c.status = 'DECIDED'; c.timeline.push(tl(`اعتمد المدير القُطري: ${decisionLabel(c)}`, `Country Director approved: ${decisionLabel(c)}`));
    if (c.kind !== 'ABSENCE' && c.proposal !== 'DISMISSAL' && c.proposal !== 'COACHING') WARN.unshift({ id: `WRN-${WARN.length + 1}`, empId: c.empId, level: c.proposal, issued: D.todayISO, reason: c.reasonText || L(...GCAT[c.category] || ['مخالفة', 'Policy breach']) });
    if (c.kind === 'ABSENCE' && c.proposal === 'DEEMED_RESIGNATION' && EXT.state.separations) EXT.state.separations.unshift({ id: `SEP-${1001 + EXT.state.separations.length}`, empId: c.empId, type: 'ABANDONMENT', submitted: D.todayISO, lastDay: D.todayISO, reason: c.id, cleared: [], exitEval: null, advances: 0, status: 'OPEN' });
  }
  EXT.onDecide.push((a, status) => { const c = CASES.find((x) => x.apId === a.id); if (c) applyDecision(c, status); });

  function caseRow(c) {
    const e = empById.get(c.empId);
    return `<tr class="clickable" data-act="case-open" data-id="${c.id}"><td class="num">${esc(c.id)}</td><td>${who(e, T(e.position))}</td><td>${badge('b-neutral', L(...KIND[c.kind]))}</td><td>${esc(fmtD(c.opened))}</td><td>${badge(CST[c.status][0], L(CST[c.status][1], CST[c.status][2]))}${gOverdue(c) ? ' ' + badge('b-bad', L('تجاوز المهلة', 'Past deadline'), 'warn') : ''}</td></tr>`;
  }
  S.caseTab = S.caseTab || 'CONDUCT';
  function vCases() {
    const conduct = CASES.filter((c) => c.kind !== 'GRIEVANCE'); const griev = CASES.filter((c) => c.kind === 'GRIEVANCE');
    const tabs = [['CONDUCT', 'السلوك والغياب', 'Conduct & absence', conduct.filter((c) => !['DECIDED', 'CLOSED'].includes(c.status)).length], ['GRIEVANCE', 'التظلّمات', 'Grievances', griev.filter((c) => c.status === 'OPEN').length], ['WARN', 'سجل الإنذارات', 'Warnings register', WARN.length]];
    let body;
    if (S.caseTab === 'WARN') body = table([L('الموظف', 'Employee'), L('المستوى', 'Level'), L('السبب', 'Reason'), L('الإصدار', 'Issued'), L('ينتهي', 'Expires'), L('الحالة', 'Status')], WARN.map((w) => { const e = empById.get(w.empId); const act = expiry(w) >= D.todayISO; return `<tr><td>${who(e, T(e.position))}</td><td>${esc(L(...LADDER[ladderIdx(w.level)].slice(1)))}</td><td>${esc(T(w.reason))}</td><td>${esc(fmtD(w.issued))}</td><td>${esc(fmtD(expiry(w)))}</td><td>${act ? badge('b-warn', L('سارٍ', 'Active')) : badge('b-neutral', L('منتهٍ: لا يُحتسب', 'Expired: not counted'))}</td></tr>`; }));
    else body = table([L('الرقم', 'ID'), S.caseTab === 'GRIEVANCE' ? L('مقدّم التظلّم', 'Raised by') : L('الموظف', 'Employee'), L('النوع', 'Type'), L('الفتح', 'Opened'), L('الحالة', 'Status')], (S.caseTab === 'GRIEVANCE' ? griev : conduct).map(caseRow), emptyState('check', L('لا توجد ملفات', 'No cases')));
    return `${pageHead(L('علاقات الموظفين', 'Employee relations'), esc(L('ملفات السلوك والغياب والتظلّمات في مكان واحد، بسرية، وبحق الرد قبل أي قرار.', 'Conduct, absence and grievance cases in one confidential place, with the right to respond before any decision.')) + ' ' + rule('DG-002'))}
      <div class="msg info">${icon('lock', 16)}<div>${esc(L('مرئية لمدير الموارد البشرية والمدير القُطري والموارد البشرية في المقر فقط. بلاغات التحرش والاحتيال والحماية تذهب لقناة البلاغات المستقلة.', 'Visible only to the HR manager, the Country Director and HQ HR. Harassment, fraud and safeguarding reports go to the independent reporting channel.'))} ${rule('DG-011')} ${rule('DG-024')}</div></div>
      <section class="card flush"><div class="table-toolbar"><div class="seg">${tabs.map(([k, ar, en, n]) => `<button aria-pressed="${S.caseTab === k}" data-act="case-tab" data-v="${k}">${esc(L(ar, en))} <span class="subtle">${n}</span></button>`).join('')}</div></div>${body}</section>`;
  }
  EXT.overlays.case = (o) => {
    const c = CASES.find((x) => x.id === o.id); const e = empById.get(c.empId); const aw = activeWarn(e.id); const rec = nextStep(e.id);
    const open = !['DECIDED', 'CLOSED', 'RESOLVED', 'PENDING_APPROVAL'].includes(c.status);
    let actions = '';
    if (c.kind === 'GRIEVANCE') {
      actions = open ? `<div class="field"><label for="g-res">${esc(L('الحل المتفق عليه', 'Agreed resolution'))}</label><textarea id="g-res" class="textarea" data-caseres="${c.id}">${esc(c.resolution || '')}</textarea></div>` : '';
    } else if (open) {
      const opts = c.kind === 'ABSENCE' ? ABS_DECISIONS : LADDER;
      actions = `<div class="field"><label for="c-prop">${esc(L('القرار المقترح', 'Proposed decision'))} ${c.kind === 'ABSENCE' ? rule('WT-015') : rule('DG-004')}</label><select id="c-prop" class="select" data-caseprop="${c.id}"><option value="">—</option>${opts.map(([k, ar, en]) => `<option value="${k}" ${c.proposal === k ? 'selected' : ''}>${esc(L(ar, en))}${c.kind !== 'ABSENCE' && k === rec ? esc(L(' (الخطوة التالية في السلّم)', ' (next step on the ladder)')) : ''}</option>`).join('')}</select></div>`;
    }
    const body = `<dl class="kv"><dt>${esc(L('النوع', 'Type'))}</dt><dd>${esc(L(...KIND[c.kind]))}${c.category ? ` · ${esc(L(...(GCAT[c.category] || ['', ''])))}` : ''}</dd><dt>${esc(L('الحالة', 'Status'))}</dt><dd>${badge(CST[c.status][0], L(CST[c.status][1], CST[c.status][2]))}</dd>${c.kind === 'GRIEVANCE' ? `<dt>${esc(L('المستوى', 'Level'))}</dt><dd>${esc([L('المدير المباشر', 'Line manager'), L('المستوى الإداري الأعلى', 'Next management level'), L('المدير القُطري', 'Country Director'), L('الموارد البشرية في المقر', 'HQ HR')][Math.min(3, (c.level || 1) - 1)])}</dd><dt>${esc(L('مهلة الحل', 'Resolve by'))}</dt><dd>${esc(fmtD(c.deadline))} ${gOverdue(c) ? badge('b-bad', L('تجاوز المهلة', 'Past deadline')) : ''} ${rule('DG-022')}</dd>` : `<dt>${esc(L('إنذارات سارية', 'Active warnings'))}</dt><dd>${aw.length ? aw.map((w) => esc(L(...LADDER[ladderIdx(w.level)].slice(1)))).join('، ') : esc(L('لا يوجد', 'None'))} ${rule('DG-006')}</dd>`}</dl>
      ${c.text ? `<div><p class="section-title">${esc(L('نص التظلّم', 'Grievance'))}</p><p class="muted" style="margin:0">${esc(T(c.text))}</p></div>` : ''}
      ${c.kind !== 'GRIEVANCE' ? `<div><p class="section-title">${esc(L('رد الموظف', 'Employee response'))} ${rule('DG-002')}</p>${c.response ? `<p class="muted" style="margin:0">${esc(T(c.response))}</p>` : `<p class="subtle" style="margin:0">${esc(c.status === 'AWAITING_RESPONSE' ? L(`طُلب الرد، والمهلة ${fmtD(c.respondBy)}.`, `Requested; due ${fmtD(c.respondBy)}.`) : L('لم يُطلب بعد. لا يمكن اقتراح عقوبة قبل منح الموظف فرصة الرد.', 'Not requested yet. No sanction can be proposed before the employee may respond.'))}</p>`}</div>` : ''}
      ${actions}
      <div><p class="section-title">${esc(L('السجل', 'Timeline'))}</p><div class="timeline">${c.timeline.map((x) => `<div class="tl-item"><div>${esc(L(x.ar, x.en))}</div><div class="when">${esc(fmtD(x.at))}</div></div>`).join('')}</div></div>`;
    let footer = '';
    if (c.status === 'DECIDED' && c.kind !== 'ABSENCE' && c.proposal !== 'COACHING') footer = `<button class="btn" data-act="case-letter" data-id="${c.id}">${icon('doc', 16)}${esc(L('خطاب القرار', 'Decision letter'))}</button>`;
    if (c.kind === 'GRIEVANCE' && c.status === 'OPEN') footer = `<button class="btn" data-act="case-escalate" data-id="${c.id}">${icon('up', 16)}${esc(L('تصعيد للمستوى التالي', 'Escalate'))}</button><button class="btn primary" data-act="case-resolve" data-id="${c.id}">${icon('check', 16)}${esc(L('تسجيل الحل', 'Record resolution'))}</button>`;
    if (c.kind !== 'GRIEVANCE' && open) {
      if (c.kind !== 'ABSENCE' && c.status === 'OPEN') footer = `<button class="btn subtle" data-act="case-close" data-id="${c.id}">${esc(L('إغلاق دون إجراء', 'Close, no action'))}</button><button class="btn primary" data-act="case-ask" data-id="${c.id}">${icon('send', 16)}${esc(L('طلب رد الموظف', 'Request employee response'))}</button>`;
      else if (c.status === 'AWAITING_RESPONSE') footer = `<button class="btn" data-act="case-got" data-id="${c.id}">${esc(L('تسجيل رد الموظف', 'Record employee response'))}</button>`;
      else footer = `<button class="btn subtle" data-act="case-close" data-id="${c.id}">${esc(L('إغلاق دون إجراء', 'Close, no action'))}</button><button class="btn primary" data-act="case-propose" data-id="${c.id}" ${c.proposal ? '' : 'disabled'}>${icon('send', 16)}${esc(L('إرسال للمدير القُطري', 'Send to Country Director'))}</button>`;
    }
    return drawer(`${c.id} · ${T(e.name.short)}`, body, footer, H.avatar(e));
  };
  function newCase(kind, empId, src, extra) {
    const id = `CASE-${6001 + CASES.length}`; const e = empById.get(empId);
    const c = Object.assign({ id, kind, empId, category: kind === 'ABSENCE' ? 'ATTENDANCE' : 'CONDUCT', source: src, opened: D.todayISO, status: 'OPEN', timeline: [tl(`فُتح الملف (${src})`, `Case opened (${src})`)] }, extra || {});
    CASES.unshift(c); audit(`فتح ${KIND[kind][0]} ${id} لـ ${e.name.ar}`, `${KIND[kind][1]} ${id} opened for ${e.name.en}`);
    return c;
  }

  // Manager: raise a concern
  S.concern = S.concern || { empId: '', type: 'CONDUCT', text: '' };
  EXT.overlays.concern = () => modal(L('رفع ملاحظة إلى الموارد البشرية', 'Raise a concern with HR'), `<div class="form-grid"><div class="field full"><label for="cn-e">${esc(L('عضو الفريق', 'Team member'))}</label><select id="cn-e" class="select" data-concern="empId"><option value="">—</option>${H.team().map((e) => `<option value="${e.id}" ${S.concern.empId === e.id ? 'selected' : ''}>${esc(T(e.name))}</option>`).join('')}</select></div><div class="field full"><span class="flabel">${esc(L('النوع', 'Type'))}</span><div class="radio-group">${[['CONDUCT', 'سلوك', 'Conduct'], ['ATTENDANCE', 'حضور', 'Attendance'], ['PERFORMANCE', 'أداء', 'Performance']].map(([k, ar, en]) => `<label class="radio"><input type="radio" name="cn-t" value="${k}" data-concern="type" ${S.concern.type === k ? 'checked' : ''}><span>${esc(L(ar, en))}</span></label>`).join('')}</div></div><div class="field full"><label for="cn-x">${esc(L('ماذا حدث؟ (وقائع محددة وتواريخ)', 'What happened? (specific facts and dates)'))}</label><textarea id="cn-x" class="textarea" data-concern="text">${esc(S.concern.text)}</textarea></div>${S.concern.type === 'PERFORMANCE' ? `<div class="full msg info">${icon('info', 16)}<div>${esc(L('لضعف الأداء ابدأ بخطة تحسين أداء لمدة 4 أسابيع من ملف الموظف قبل أي إجراء تأديبي.', 'For low performance, start a 4-week improvement plan from the employee file before any disciplinary step.'))} ${rule('PF-012')}</div></div>` : ''}</div>`,
    `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="concern-submit">${esc(L('إرسال للموارد البشرية', 'Send to HR'))}</button>`);

  // =====================================================================
  // HR helpdesk
  // =====================================================================
  const TCAT = { PAYROLL: ['الرواتب', 'Payroll'], LEAVE: ['الإجازات', 'Leave'], CONTRACT: ['العقود', 'Contracts'], BENEFITS: ['المزايا والتأمين', 'Benefits & insurance'], LETTERS: ['الخطابات', 'Letters'], OTHER: ['أخرى', 'Other'] };
  const TICKETS = store('tickets', () => {
    const r = H.rng(53); const subj = { PAYROLL: ['خصم غير مفهوم في القسيمة', 'Unclear deduction on payslip'], LEAVE: ['رصيد الإجازة غير صحيح', 'Leave balance looks wrong'], CONTRACT: ['متى يُجدَّد عقدي؟', 'When will my contract be renewed?'], BENEFITS: ['إضافة مولود للتأمين الصحي', 'Add newborn to health insurance'], LETTERS: ['تعديل اسم في شهادة العمل', 'Name correction on certificate'], OTHER: ['تحديث رقم الهاتف', 'Update phone number'] };
    const ks = Object.keys(TCAT); const out = [];
    for (let i = 0; i < 14; i++) { const k = ks[Math.floor(r() * ks.length)]; const created = iso(addDays(TODAY, -Math.floor(r() * 9))); const st = r() < 0.35 ? 'RESOLVED' : r() < 0.6 ? 'IN_PROGRESS' : 'OPEN'; out.push({ id: `HD-${8001 + i}`, empId: pick(Math.floor(r() * 500)).id, cat: k, subject: { ar: subj[k][0], en: subj[k][1] }, created, status: st, assignee: st === 'OPEN' ? null : D.personas.HR, reply: st === 'RESOLVED' ? L('تمت المعالجة.', 'Handled.') : '' }); }
    out.push({ id: 'HD-8100', empId: D.personas.EMPLOYEE, cat: 'BENEFITS', subject: { ar: 'هل يشمل التأمين طب الأسنان؟', en: 'Does insurance cover dental?' }, created: iso(addDays(TODAY, -4)), status: 'RESOLVED', assignee: D.personas.HR, reply: { ar: 'نعم، حتى 300 دولار سنوياً.', en: 'Yes, up to USD 300 per year.' } });
    return out;
  });
  const slaDue = (t) => addBiz(t.created, D.POLICY.helpdesk.slaBusinessDays);
  const TST = { OPEN: ['b-warn', 'جديدة', 'New'], IN_PROGRESS: ['b-info', 'قيد المعالجة', 'In progress'], RESOLVED: ['b-ok', 'مُغلقة', 'Resolved'] };
  S.hdF = S.hdF || 'OPEN';
  function vHelpdesk() {
    const open = TICKETS.filter((t) => t.status !== 'RESOLVED'); const over = open.filter((t) => slaDue(t) < D.todayISO);
    const list = (S.hdF === 'OPEN' ? open : TICKETS).slice().sort((a, b) => (a.created > b.created ? 1 : -1));
    const resolved = TICKETS.filter((t) => t.status === 'RESOLVED');
    return `${pageHead(L('مكتب مساعدة الموارد البشرية', 'HR helpdesk'), esc(L(`استفسارات الموظفين بتذاكر ومدة استجابة ${D.POLICY.helpdesk.slaBusinessDays} أيام عمل، بدل البريد والهاتف.`, `Staff questions as tickets with a ${D.POLICY.helpdesk.slaBusinessDays}-working-day response target, instead of e-mail and phone.`)) + ' ' + rule('HD-001'))}
      <div class="grid g-4 keep2">${kpi(L('تذاكر مفتوحة', 'Open tickets'), fmtN(open.length), '', 'list')}${kpi(L('تجاوزت مدة الاستجابة', 'Past response target'), fmtN(over.length), rule('HD-002'), 'warn')}${kpi(L('غير مُسندة', 'Unassigned'), fmtN(open.filter((t) => !t.assignee).length), '', 'person')}${kpi(L('مُغلقة', 'Resolved'), fmtN(resolved.length), '', 'check')}</div>
      <section class="card flush"><div class="table-toolbar"><div class="seg">${[['OPEN', 'المفتوحة', 'Open'], ['ALL', 'الكل', 'All']].map(([k, ar, en]) => `<button aria-pressed="${S.hdF === k}" data-act="hd-f" data-v="${k}">${esc(L(ar, en))}</button>`).join('')}</div></div>
      ${table([L('الرقم', 'ID'), L('الموظف', 'Employee'), L('التصنيف', 'Category'), L('الموضوع', 'Subject'), L('مدة الاستجابة', 'Response due'), L('الحالة', 'Status'), ''], list.map((t) => { const e = empById.get(t.empId); const due = slaDue(t); return `<tr><td class="num">${esc(t.id)}</td><td>${who(e, e.staffNo)}</td><td>${badge('b-neutral', L(...TCAT[t.cat]))}</td><td>${esc(T(t.subject))}</td><td>${t.status === 'RESOLVED' ? '—' : due < D.todayISO ? badge('b-bad', L('متأخرة', 'Overdue'), 'warn') : esc(fmtD(due))}</td><td>${badge(TST[t.status][0], L(TST[t.status][1], TST[t.status][2]))}</td><td style="text-align:end"><div class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap">${t.status === 'OPEN' ? `<button class="btn sm" data-act="hd-take" data-id="${t.id}">${esc(L('استلام', 'Take'))}</button>` : ''}${t.status !== 'RESOLVED' ? `<button class="btn sm primary" data-act="hd-open" data-id="${t.id}">${esc(L('رد وإغلاق', 'Reply & close'))}</button>` : ''}</div></td></tr>`; }), emptyState('check', L('لا توجد تذاكر مفتوحة', 'No open tickets')))}</section>`;
  }
  EXT.overlays.ticket = (o) => { const t = TICKETS.find((x) => x.id === o.id); const e = empById.get(t.empId); return modal(`${t.id} · ${T(t.subject)}`, `<div class="list-item" style="padding-top:0">${H.avatar(e)}<div class="grow"><div class="t">${esc(T(e.name))}</div><div class="subtle">${esc(L(...TCAT[t.cat]))} · ${esc(fmtD(t.created))}</div></div></div><div class="field"><label for="hd-r">${esc(L('الرد', 'Reply'))}</label><textarea id="hd-r" class="textarea" data-hdr="${t.id}">${esc(T(t.reply) || '')}</textarea></div><p class="subtle" style="margin:0">${esc(L('يصل الرد للموظف في Teams.', 'The reply reaches the employee in Teams.'))}</p>`, `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="hd-resolve" data-id="${t.id}">${esc(L('إرسال وإغلاق', 'Send & close'))}</button>`); };

  // Employee: help & requests (tickets + grievance + reporting channel)
  S.tkDraft = S.tkDraft || { cat: 'PAYROLL', subject: '' };
  S.gvDraft = S.gvDraft || { cat: 'WORKLOAD', against: 'MANAGER', text: '' };
  function vEmpHelp() {
    const mine = TICKETS.filter((t) => t.empId === me().id); const myG = CASES.filter((c) => c.kind === 'GRIEVANCE' && c.empId === me().id);
    const redirect = REDIRECT.includes(S.gvDraft.cat);
    return `${pageHead(L('المساعدة والطلبات', 'Help & requests'), esc(L('اسأل الموارد البشرية، أو قدّم تظلّماً رسمياً، أو أبلغ بسرية عبر القناة المستقلة.', 'Ask HR a question, file a formal grievance, or report confidentially through the independent channel.')))}
      <div class="grid g-2">
        <section class="card"><h2>${esc(L('سؤال للموارد البشرية', 'Ask HR'))} ${rule('HD-001')}</h2><div class="form-grid"><div class="field"><label for="tk-c">${esc(L('التصنيف', 'Category'))}</label><select id="tk-c" class="select" data-tk="cat">${Object.entries(TCAT).map(([k, v]) => `<option value="${k}" ${S.tkDraft.cat === k ? 'selected' : ''}>${esc(L(...v))}</option>`).join('')}</select></div><div class="field"><span class="flabel">${esc(L('مدة الاستجابة', 'Response target'))}</span><div style="padding-top:6px">${esc(L(`${D.POLICY.helpdesk.slaBusinessDays} أيام عمل`, `${D.POLICY.helpdesk.slaBusinessDays} working days`))}</div></div><div class="field full"><label for="tk-s">${esc(L('سؤالك', 'Your question'))}</label><textarea id="tk-s" class="textarea" data-tk="subject">${esc(S.tkDraft.subject)}</textarea></div><div class="full"><button class="btn primary" data-act="tk-submit">${icon('send', 16)}${esc(L('إرسال', 'Send'))}</button></div></div>
          ${mine.length ? `<div class="list" style="margin-top:12px">${mine.map((t) => `<div class="list-item">${icon('chat')}<div class="grow"><div class="t">${esc(T(t.subject))}</div><div class="subtle">${esc(T(t.reply) || L('بانتظار الرد', 'Awaiting reply'))}</div></div>${badge(TST[t.status][0], L(TST[t.status][1], TST[t.status][2]))}</div>`).join('')}</div>` : ''}</section>
        <section class="card"><h2>${esc(L('تظلّم رسمي', 'Formal grievance'))} ${rule('DG-020')}</h2><div class="form-grid"><div class="field"><label for="gv-c">${esc(L('الموضوع', 'Subject'))}</label><select id="gv-c" class="select" data-gv="cat">${Object.entries(GCAT).map(([k, v]) => `<option value="${k}" ${S.gvDraft.cat === k ? 'selected' : ''}>${esc(L(...v))}</option>`).join('')}</select></div><div class="field"><label for="gv-a">${esc(L('بخصوص', 'Concerning'))}</label><select id="gv-a" class="select" data-gv="against">${[['MANAGER', 'مديري المباشر', 'My line manager'], ['COLLEAGUE', 'زميل', 'A colleague'], ['HEAD', 'المدير القُطري', 'The Country Director'], ['OTHER', 'إجراء أو سياسة', 'A process or policy']].map(([k, ar, en]) => `<option value="${k}" ${S.gvDraft.against === k ? 'selected' : ''}>${esc(L(ar, en))}</option>`).join('')}</select></div>
          ${redirect ? `<div class="full msg bad">${icon('shield', 16)}<div>${esc(L('هذا النوع لا يُقدَّم كتظلّم داخلي حمايةً لك. استخدم قناة البلاغات المستقلة، ويمكنك الإبلاغ دون ذكر اسمك.', 'To protect you, this is not filed as an internal grievance. Use the independent reporting channel; you may report anonymously.'))} ${rule('DG-024')}<div style="margin-top:8px"><button class="btn sm" data-act="toast" data-msg="${esc(L('في النسخة الفعلية يفتح هذا رابط قناة البلاغات الخاصة بمؤسستك.', 'In production this opens your organization\'s reporting channel.'))}">${esc(L('فتح قناة البلاغات', 'Open reporting channel'))}</button></div></div></div>` : `<div class="field full"><label for="gv-t">${esc(L('التفاصيل', 'Details'))}</label><textarea id="gv-t" class="textarea" data-gv="text">${esc(S.gvDraft.text)}</textarea></div>${S.gvDraft.against === 'HEAD' ? `<div class="full msg info">${icon('info', 16)}<div>${esc(L('يُحوَّل تظلّمك مباشرة للموارد البشرية في المقر.', 'Your grievance goes directly to HQ HR.'))} ${rule('DG-023')}</div></div>` : ''}<div class="full"><button class="btn primary" data-act="gv-submit">${esc(L('تقديم التظلّم', 'Submit grievance'))}</button></div>`}</div>
          ${myG.length ? `<div class="list" style="margin-top:12px">${myG.map((c) => `<div class="list-item">${icon('flag')}<div class="grow"><div class="t">${esc(L(...GCAT[c.category]))}</div><div class="subtle">${esc(c.id)} · ${esc(fmtD(c.opened))}</div></div>${badge(CST[c.status][0], L(CST[c.status][1], CST[c.status][2]))}</div>`).join('')}</div>` : ''}
          <p class="subtle" style="margin:12px 0 0">${esc(L('لا يجوز أي إجراء انتقامي بسبب تقديم تظلّم.', 'No retaliation is permitted for raising a grievance.'))} ${rule('DG-025')}</p></section>
      </div>`;
  }

  // =====================================================================
  // Declarations: conflict of interest (annual) and gifts register
  // =====================================================================
  const YEAR = TODAY.getFullYear();
  const COI_Q = [['OUTSIDE', 'هل لديك عمل أو استشارات خارج المؤسسة؟', 'Do you have outside employment or consulting?'], ['FINANCIAL', 'هل لك أو لأقاربك مصلحة مالية في مورّد أو شريك؟', 'Do you or relatives have a financial interest in a supplier or partner?'], ['FAMILY', 'هل لديك قريب يعمل في المؤسسة أو لدى مورّد؟', 'Do you have a relative working here or for a supplier?'], ['POLITICAL', 'هل تشغل منصباً سياسياً أو حكومياً؟', 'Do you hold a political or government position?']];
  const DECL = store('declarations', () => {
    const r = H.rng(61); const by = {};
    D.employees.forEach((e) => { if (r() < 0.62 && e.id !== D.personas.EMPLOYEE) { const ans = {}; COI_Q.forEach(([k]) => { ans[k] = r() < 0.012; }); by[e.id] = { answers: ans, at: iso(addDays(TODAY, -Math.floor(r() * 200))), reviewed: !Object.values(ans).some(Boolean) || r() < 0.4 }; } });
    return { year: YEAR, by, gifts: [
      { id: 'GFT-1', empId: pick(70).id, dir: 'OFFERED', from: { ar: 'مورّد أدوية', en: 'Pharmacy supplier' }, what: { ar: 'هاتف محمول', en: 'Mobile phone' }, value: 350, cash: false, at: iso(addDays(TODAY, -30)) },
      { id: 'GFT-2', empId: pick(90).id, dir: 'RECEIVED', from: { ar: 'مجلس محلي', en: 'Local council' }, what: { ar: 'درع تكريمي', en: 'Commemorative plaque' }, value: 20, cash: false, at: iso(addDays(TODAY, -12)) },
      { id: 'GFT-3', empId: pick(110).id, dir: 'OFFERED', from: { ar: 'مقاول', en: 'Contractor' }, what: { ar: 'مبلغ نقدي', en: 'Cash' }, value: 100, cash: true, at: iso(addDays(TODAY, -5)) }
    ] };
  });
  const giftDecision = (g) => (g.cash ? ['b-bad', 'محظورة: تُرفض أو تُعاد', 'Prohibited: refuse or return'] : g.value > D.POLICY.giftThreshold ? ['b-warn', 'فوق الحد: تُرفض أو تُسلَّم للمؤسسة', 'Above limit: decline or surrender'] : ['b-ok', 'مسموحة وتُسجَّل', 'Allowed and recorded']);
  if (D.POLICY.giftThreshold == null) D.POLICY.giftThreshold = 50;
  S.coi = S.coi || {}; S.gift = S.gift || { dir: 'OFFERED', from: '', what: '', value: '', cash: false };
  function vEmpDecl() {
    const mine = DECL.by[me().id]; const answered = COI_Q.every(([k]) => S.coi[k] !== undefined);
    const g = S.gift; const gd = g.from && g.value !== '' ? giftDecision({ ...g, value: Number(g.value) }) : null;
    return `${pageHead(L('الإفصاحات', 'Declarations'), esc(L('إفصاح سنوي عن تضارب المصالح، وتسجيل أي هدية أو ضيافة تُعرض عليك.', 'Annual conflict-of-interest declaration, and a record of any gift or hospitality offered to you.')) + ' ' + rule('CC-003'))}
      <div class="grid g-2">
        <section class="card"><h2>${esc(L(`إفصاح تضارب المصالح ${YEAR}`, `Conflict-of-interest declaration ${YEAR}`))}</h2>${mine ? `<div class="msg ok">${icon('check', 16)}<div>${esc(L(`أرسلت إفصاحك بتاريخ ${fmtD(mine.at)}.`, `You submitted your declaration on ${fmtD(mine.at)}.`))}</div></div>` : `${COI_Q.map(([k, ar, en]) => `<div class="param wide"><div class="pl"><b>${esc(L(ar, en))}</b></div><div class="radio-group"><label class="radio"><input type="radio" name="coi-${k}" value="1" data-coi="${k}" ${S.coi[k] === true ? 'checked' : ''}><span>${esc(L('نعم', 'Yes'))}</span></label><label class="radio"><input type="radio" name="coi-${k}" value="0" data-coi="${k}" ${S.coi[k] === false ? 'checked' : ''}><span>${esc(L('لا', 'No'))}</span></label></div></div>`).join('')}${Object.values(S.coi).some(Boolean) ? `<div class="msg info" style="margin-top:8px">${icon('info', 16)}<div>${esc(L('الإفصاح ليس مخالفة. ستراجعه الموارد البشرية وتتفق معك على إجراء لتجنّب التضارب إن لزم.', 'Declaring is not a breach. HR will review it and agree mitigation with you if needed.'))}</div></div>` : ''}<button class="btn primary" style="margin-top:12px" data-act="coi-submit" ${answered ? '' : 'disabled'}>${esc(L('إرسال الإفصاح', 'Submit declaration'))}</button>`}</section>
        <section class="card"><h2>${esc(L('تسجيل هدية أو ضيافة', 'Record a gift or hospitality'))} ${rule('CC-004')}</h2><div class="form-grid"><div class="field full"><div class="radio-group"><label class="radio"><input type="radio" name="gf-d" value="OFFERED" data-gift="dir" ${g.dir === 'OFFERED' ? 'checked' : ''}><span>${esc(L('عُرضت عليّ', 'Offered to me'))}</span></label><label class="radio"><input type="radio" name="gf-d" value="RECEIVED" data-gift="dir" ${g.dir === 'RECEIVED' ? 'checked' : ''}><span>${esc(L('استلمتها', 'I received it'))}</span></label></div></div><div class="field"><label for="gf-f">${esc(L('من', 'From'))}</label><input id="gf-f" class="input" data-gift="from" value="${esc(T(g.from))}"></div><div class="field"><label for="gf-v">${esc(L('القيمة التقديرية (دولار)', 'Estimated value (USD)'))}</label><input id="gf-v" type="number" min="0" class="input num" data-gift="value" value="${esc(g.value)}"></div><div class="field full"><label for="gf-w">${esc(L('الوصف', 'Description'))}</label><input id="gf-w" class="input" data-gift="what" value="${esc(T(g.what))}"></div><label class="check-item full"><input type="checkbox" class="cbx" data-gift="cash" ${g.cash ? 'checked' : ''}><span>${esc(L('نقد أو ما يعادله', 'Cash or cash equivalent'))}</span></label><div class="full" id="gift-dec">${gd ? `<div class="msg ${gd[0] === 'b-ok' ? 'ok' : gd[0] === 'b-warn' ? 'warn' : 'bad'}">${icon('info', 16)}<div>${esc(L(gd[1], gd[2]))} ${rule('CC-004')}</div></div>` : ''}</div><div class="full"><button class="btn primary" data-act="gift-submit">${esc(L('تسجيل', 'Record'))}</button></div></div></section>
      </div>`;
  }
  function vHrDecl() {
    const total = D.employees.length; const done = Object.keys(DECL.by).length; const flagged = Object.entries(DECL.by).filter(([, d]) => Object.values(d.answers).some(Boolean) && !d.reviewed);
    return `${pageHead(L('الإفصاحات وتضارب المصالح', 'Declarations & conflicts of interest'), esc(L('الإفصاح السنوي وسجل الهدايا والضيافة.', 'Annual declarations and the gifts & hospitality register.')) + ' ' + rule('CC-003'), `<button class="btn" data-act="coi-remind">${icon('teams', 16)}${esc(L('تذكير من لم يُفصح', 'Remind non-submitters'))}</button>`)}
      <div class="grid g-3">${kpi(L(`أفصحوا عن ${YEAR}`, `Declared for ${YEAR}`), `${fmtN((done / total) * 100, 0)}%`, `${fmtN(done)}/${fmtN(total)}`, 'check')}${kpi(L('بحاجة لمراجعة', 'Needs review'), fmtN(flagged.length), '', 'flag')}${kpi(L('هدايا مسجّلة', 'Gifts recorded'), fmtN(DECL.gifts.length), rule('CC-004'), 'list')}</div>
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('إفصاحات بحاجة لمراجعة', 'Declarations to review'))}</h2></div>${table([L('الموظف', 'Employee'), L('ما أُفصح عنه', 'Declared'), L('التاريخ', 'Date'), ''], flagged.map(([id, d]) => { const e = empById.get(id); return `<tr><td>${who(e, T(e.position))}</td><td>${COI_Q.filter(([k]) => d.answers[k]).map(([, ar, en]) => badge('b-warn', L(ar, en).replace(/^هل |^Do you |^Have you |\?|؟/g, '').slice(0, 40))).join(' ')}</td><td>${esc(fmtD(d.at))}</td><td style="text-align:end"><div class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn sm" data-act="coi-review" data-id="${id}" data-v="MITIGATE">${esc(L('خطة تخفيف', 'Mitigation plan'))}</button><button class="btn sm primary" data-act="coi-review" data-id="${id}" data-v="NONE">${esc(L('لا تضارب', 'No conflict'))}</button></div></td></tr>`; }), emptyState('check', L('لا يوجد ما يحتاج مراجعة', 'Nothing to review')))}</section>
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('سجل الهدايا والضيافة', 'Gifts & hospitality register'))}</h2></div>${table([L('الموظف', 'Employee'), L('من', 'From'), L('الوصف', 'Description'), L('القيمة', 'Value'), L('القرار', 'Decision')], DECL.gifts.map((g) => { const e = empById.get(g.empId); const d = giftDecision(g); return `<tr><td>${who(e, e.staffNo)}</td><td>${esc(T(g.from))}</td><td>${esc(T(g.what))}</td><td class="num">${money(g.value)}</td><td>${badge(d[0], L(d[1], d[2]))}</td></tr>`; }))}</section>`;
  }

  // =====================================================================
  // Registration
  // =====================================================================
  addNav('HR', 'gov', ['الحوكمة', 'Governance'], { v: 'cases', ic: 'flag', ar: 'علاقات الموظفين', en: 'Employee relations' });
  addNav('HR', 'gov', ['الحوكمة', 'Governance'], { v: 'declarations', ic: 'shield', ar: 'الإفصاحات', en: 'Declarations' });
  addNav('HR', 'services', ['الخدمات', 'Services'], { v: 'helpdesk', ic: 'chat', ar: 'مكتب المساعدة', en: 'Helpdesk' });
  Object.assign(VIEWS.HR, { cases: vCases, helpdesk: vHelpdesk, declarations: vHrDecl });
  addNav('EMPLOYEE', 'me', ['حسابي', 'My account'], { v: 'help', ic: 'help', ar: 'المساعدة والطلبات', en: 'Help & requests' });
  addNav('EMPLOYEE', 'me', ['حسابي', 'My account'], { v: 'declarations', ic: 'shield', ar: 'الإفصاحات', en: 'Declarations' });
  Object.assign(VIEWS.EMPLOYEE, { help: vEmpHelp, declarations: vEmpDecl });
  EXT.hrDash.push(() => { const g = CASES.filter(gOverdue).length; const t = TICKETS.filter((x) => x.status !== 'RESOLVED' && slaDue(x) < D.todayISO).length; return g + t ? `<div class="banner info"><span class="bi">${icon('flag', 18)}</span><div class="grow"><b>${esc(L(`${g} تظلّم تجاوز مهلته و${t} تذكرة متأخرة`, `${g} grievance(s) past deadline and ${t} overdue ticket(s)`))}</b><div class="subtle">${rule('DG-022')} ${rule('HD-002')}</div></div><button class="btn sm" data-act="nav" data-v="cases">${esc(L('علاقات الموظفين', 'Relations'))}</button><button class="btn sm" data-act="nav" data-v="helpdesk">${esc(L('مكتب المساعدة', 'Helpdesk'))}</button></div>` : ''; });

  Object.assign(EXT.actions, {
    'case-tab': (t) => { S.caseTab = t.dataset.v; render(); },
    'case-open': (t) => openOverlay({ type: 'case', id: t.dataset.id }),
    'case-from': (t) => { const c = newCase(t.dataset.kind, t.dataset.id, t.dataset.src || (t.dataset.kind === 'ABSENCE' ? 'ATTENDANCE' : 'LATENESS')); if (S.role === 'HR') openOverlay({ type: 'case', id: c.id }); else { render(); toast(L('فُتح ملف لدى الموارد البشرية.', 'A case was opened with HR.'), 'ok'); } },
    'case-new': () => { S.concern = { empId: '', type: 'CONDUCT', text: '' }; openOverlay({ type: 'concern' }); },
    'concern-submit': () => { const d = S.concern; if (!d.empId || !d.text.trim()) { toast(L('اختر الموظف واكتب الوقائع.', 'Choose the employee and describe the facts.'), 'bad'); return; } newCase('CONDUCT', d.empId, 'MANAGER', { category: d.type === 'ATTENDANCE' ? 'ATTENDANCE' : 'CONDUCT', text: d.text }); addActivity('HR', 'teams', `ملاحظة جديدة من ${persona().name.ar}`, `New concern from ${persona().name.en}`, 'cases'); S.overlay = null; render(); toast(L('وصلت ملاحظتك للموارد البشرية بسرية.', 'Your concern reached HR confidentially.'), 'ok'); },
    'case-ask': (t) => { const c = CASES.find((x) => x.id === t.dataset.id); c.status = 'AWAITING_RESPONSE'; c.respondBy = addBiz(D.todayISO, 5); c.timeline.push(tl('طُلب رد الموظف', 'Employee response requested')); audit(`طلب رد الموظف ${c.id}`, `Response requested ${c.id}`); render(); },
    'case-got': (t) => { const c = CASES.find((x) => x.id === t.dataset.id); c.status = 'RESPONDED'; c.response = L('قدّم الموظف رده المكتوب وأُرفق بالملف.', 'The employee submitted a written response, attached to the file.'); c.timeline.push(tl('سُجّل رد الموظف', 'Employee response recorded')); render(); },
    'case-propose': (t) => { const c = CASES.find((x) => x.id === t.dataset.id); if (!c.proposal) return; if (c.kind === 'ABSENCE' && c.status === 'OPEN') c.status = 'RESPONDED'; const apId = `AP-${800 + D.approvals.length}`; c.apId = apId; c.status = 'PENDING_APPROVAL'; c.timeline.push(tl(`اقتُرح: ${decisionLabel(c)}`, `Proposed: ${decisionLabel(c)}`)); D.approvals.unshift({ id: apId, type: 'SANCTION', requester: D.personas.HR, subject: c.empId, created: D.todayISO, status: 'PENDING', data: { caseId: c.id }, rules: ['DG-003'] }); addActivity('CD', 'teams', `قرار تأديبي بانتظار اعتمادك: ${c.id}`, `Disciplinary decision awaiting approval: ${c.id}`, 'approvals'); audit(`اقتراح قرار ${c.id}`, `Decision proposed ${c.id}`); S.overlay = null; render(); toast(L('أُرسل للمدير القُطري.', 'Sent to the Country Director.'), 'ok'); },
    'case-close': (t) => { const c = CASES.find((x) => x.id === t.dataset.id); c.status = 'CLOSED'; c.timeline.push(tl('أُغلق دون إجراء', 'Closed with no action')); audit(`إغلاق ${c.id}`, `Closed ${c.id}`); S.overlay = null; render(); },
    'case-escalate': (t) => { const c = CASES.find((x) => x.id === t.dataset.id); c.level = Math.min(4, (c.level || 1) + (c.against === 'HEAD' ? 3 : 1)); c.deadline = addBiz(D.todayISO, 7); c.timeline.push(tl(`صُعّد للمستوى ${c.level}`, `Escalated to level ${c.level}`)); addActivity(c.level >= 3 ? 'CD' : 'HR', 'outlook', `تظلّم مُصعَّد ${c.id}`, `Escalated grievance ${c.id}`, 'cases'); audit(`تصعيد ${c.id}`, `Escalated ${c.id}`); render(); },
    'case-resolve': (t) => { const c = CASES.find((x) => x.id === t.dataset.id); if (!(c.resolution || '').trim()) { toast(L('اكتب الحل المتفق عليه.', 'Write the agreed resolution.'), 'bad'); return; } c.status = 'RESOLVED'; c.timeline.push(tl('سُجّل الحل وأُبلغ الموظف', 'Resolution recorded; employee informed')); audit(`حل ${c.id}`, `Resolved ${c.id}`); S.overlay = null; render(); toast(L('سُجّل الحل.', 'Resolution recorded.'), 'ok'); },
    'case-letter': (t) => { const c = CASES.find((x) => x.id === t.dataset.id); const e = empById.get(c.empId); openOverlay({ type: 'doc', title: decisionLabel(c), ref: c.id, body: `<h3>${esc(decisionLabel(c))}</h3><p style="margin:0">${esc(L(`إلى ${T(e.name)} (${e.staffNo})، ${T(e.position)}.`, `To ${T(e.name)} (${e.staffNo}), ${T(e.position)}.`))}</p><p style="margin:0">${esc(L(`بعد مراجعة الملف ${c.id} ورَدّك عليه، تقرر توجيه ${decisionLabel(c)} إليك. يبقى هذا القرار سارياً ${D.POLICY.warningValidityMonths} شهراً، ويحق لك التظلّم منه خلال 7 أيام عمل.`, `Following review of case ${c.id} and your response, a ${decisionLabel(c).toLowerCase()} is issued. It remains active for ${D.POLICY.warningValidityMonths} months. You may appeal within 7 working days.`))}</p>` }); },
    'hd-f': (t) => { S.hdF = t.dataset.v; render(); },
    'hd-take': (t) => { const x = TICKETS.find((y) => y.id === t.dataset.id); x.status = 'IN_PROGRESS'; x.assignee = persona().id; render(); },
    'hd-open': (t) => openOverlay({ type: 'ticket', id: t.dataset.id }),
    'hd-resolve': (t) => { const x = TICKETS.find((y) => y.id === t.dataset.id); if (!(x.reply || '').trim()) { toast(L('اكتب رداً.', 'Write a reply.'), 'bad'); return; } x.status = 'RESOLVED'; x.assignee = persona().id; if (x.empId === D.personas.EMPLOYEE) addActivity('EMPLOYEE', 'teams', `رد على سؤالك ${x.id}`, `Reply to your question ${x.id}`, 'help'); audit(`إغلاق تذكرة ${x.id}`, `Ticket ${x.id} resolved`); S.overlay = null; render(); toast(L('أُرسل الرد عبر Teams.', 'Reply sent in Teams.'), 'ok'); },
    'tk-submit': () => { if (!S.tkDraft.subject.trim()) { toast(L('اكتب سؤالك.', 'Write your question.'), 'bad'); return; } const id = `HD-${8001 + TICKETS.length}`; TICKETS.unshift({ id, empId: me().id, cat: S.tkDraft.cat, subject: S.tkDraft.subject.trim(), created: D.todayISO, status: 'OPEN', assignee: null, reply: '' }); addActivity('HR', 'teams', `تذكرة جديدة ${id}`, `New ticket ${id}`, 'helpdesk'); S.tkDraft = { cat: S.tkDraft.cat, subject: '' }; render(); toast(L(`أُرسل سؤالك. الرد خلال ${D.POLICY.helpdesk.slaBusinessDays} أيام عمل.`, `Sent. Expect a reply within ${D.POLICY.helpdesk.slaBusinessDays} working days.`), 'ok'); },
    'gv-submit': () => { const d = S.gvDraft; if (REDIRECT.includes(d.cat)) return; if (!d.text.trim()) { toast(L('اكتب تفاصيل التظلّم.', 'Describe your grievance.'), 'bad'); return; } const c = newCase('GRIEVANCE', me().id, 'EMPLOYEE', { category: d.cat, against: d.against, text: d.text, level: d.against === 'HEAD' ? 4 : 1, deadline: addBiz(D.todayISO, 7) }); c.timeline = [tl('قُدّم التظلّم', 'Grievance submitted')]; addActivity('HR', 'outlook', `تظلّم جديد ${c.id}`, `New grievance ${c.id}`, 'cases'); S.gvDraft = { cat: 'WORKLOAD', against: 'MANAGER', text: '' }; render(); toast(L('قُدّم تظلّمك. ستُبلَّغ بكل تحديث.', 'Grievance submitted. You will be informed of every update.'), 'ok'); },
    'coi-submit': () => { DECL.by[me().id] = { answers: { ...S.coi }, at: D.todayISO, reviewed: !Object.values(S.coi).some(Boolean) }; audit('إرسال إفصاح تضارب المصالح', 'Conflict-of-interest declaration submitted'); render(); toast(L('شكراً، سُجّل إفصاحك.', 'Thank you; your declaration is recorded.'), 'ok'); },
    'coi-review': (t) => { DECL.by[t.dataset.id].reviewed = t.dataset.v; audit(`مراجعة إفصاح ${t.dataset.id}: ${t.dataset.v}`, `Declaration ${t.dataset.id} reviewed: ${t.dataset.v}`); render(); },
    'coi-remind': () => { const n = D.employees.length - Object.keys(DECL.by).length; toast(L(`أُرسل تذكير إلى ${n} موظفاً عبر Teams.`, `Teams reminder sent to ${n} employees.`), 'ok'); },
    'gift-submit': () => { const g = S.gift; if (!g.from.trim() || g.value === '') { toast(L('أكمل الحقول.', 'Complete the fields.'), 'bad'); return; } DECL.gifts.unshift({ id: `GFT-${DECL.gifts.length + 1}`, empId: me().id, dir: g.dir, from: g.from, what: g.what, value: Number(g.value), cash: g.cash, at: D.todayISO }); audit('تسجيل هدية', 'Gift recorded'); S.gift = { dir: 'OFFERED', from: '', what: '', value: '', cash: false }; render(); toast(L('سُجّلت الهدية في السجل.', 'Gift recorded in the register.'), 'ok'); }
  });
  EXT.onChange.push((t) => {
    if (t.dataset.caseprop) { const c = CASES.find((x) => x.id === t.dataset.caseprop); c.proposal = t.value; render(); return true; }
    if (t.dataset.concern) { S.concern[t.dataset.concern] = t.value; if (t.dataset.concern === 'type') render(); return true; }
    if (t.dataset.tk) { S.tkDraft[t.dataset.tk] = t.value; return true; }
    if (t.dataset.gv) { S.gvDraft[t.dataset.gv] = t.value; render(); return true; }
    if (t.dataset.coi) { S.coi[t.dataset.coi] = t.value === '1'; render(); return true; }
    if (t.dataset.gift) { S.gift[t.dataset.gift] = t.type === 'checkbox' ? t.checked : t.value; render(); return true; }
    return false;
  });
  EXT.onInput.push((t) => {
    if (t.dataset.caseres) { CASES.find((x) => x.id === t.dataset.caseres).resolution = t.value; return true; }
    if (t.dataset.hdr) { TICKETS.find((x) => x.id === t.dataset.hdr).reply = t.value; return true; }
    if (t.dataset.tk === 'subject') { S.tkDraft.subject = t.value; return true; }
    if (t.dataset.gv === 'text') { S.gvDraft.text = t.value; return true; }
    if (t.dataset.concern === 'text') { S.concern.text = t.value; return true; }
    if (t.dataset.gift && t.type !== 'checkbox' && t.type !== 'radio') { S.gift[t.dataset.gift] = t.value; return true; }
    return false;
  });
})();
