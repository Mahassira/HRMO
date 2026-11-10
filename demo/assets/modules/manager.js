/* HRMO module — Line-manager workspace, team calendar, org chart, overtime requests.
 * Rules: LV-001, TS-004, WT-020..023, LV-080, MG-001..006 (docs/en/system-reference.md §24). */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, NAV, VIEWS, ROLES, L, T, esc, icon, fmtN, fmtD, parse, iso, addDays, daysBetween, TODAY, badge, rule, avatar, who, toast, addActivity, emptyState, empById, persona, me, balances, render, openOverlay, pageHead, table, store, addNav, audit, isWorkDay, msgs, R, managerDecide, validateLeave, serviceMonths, money } = H;

  // ---------- Shared helpers for all modules ----------
  H.rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  H.kpi = (label, value, hint, ic, v, act) => `<${v || act ? `button class="tile clickable" data-act="${act || 'nav'}" ${v ? `data-v="${v}"` : ''}` : 'div class="tile"'}><span class="label">${ic ? icon(ic, 16) : ''}${esc(label)}</span><span class="value">${value}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</${v || act ? 'button' : 'div'}>`;
  H.nextId = (prefix, list) => `${prefix}-${String(1000 + list.length + 1)}`;
  EXT.mgrPending = []; EXT.mgrSections = [];
  const kpi = H.kpi;

  // ---------- Role & navigation ----------
  ROLES.splice(1, 0, ['MANAGER', 'المدير المباشر', 'Line manager', 'فريقي والموافقات', 'My team & approvals']);
  S.view.MANAGER = S.view.MANAGER || 'team';
  NAV.MANAGER = [];
  VIEWS.MANAGER = {};
  const mgrId = () => D.personas.MANAGER;
  const team = () => D.employees.filter((e) => e.managerId === mgrId());
  H.team = team;

  // ---------- Seed data (first visit only) ----------
  const OT = store('overtime', () => []);
  const TS = store('teamTs', () => team().filter((e) => e.id !== D.personas.EMPLOYEE).map((e, i) => ({ empId: e.id, status: i % 4 === 3 ? 'DRAFT' : 'SUBMITTED' })));
  if (!store('mgrSeeded', () => false)) {
    const tm = team().filter((e) => e.category === 'REGULAR' && !e.inProbation && e.id !== D.personas.EMPLOYEE);
    const push = (e, type, from, len, status, k) => { const to = addDays(from, len); D.leaveRequests.push({ id: `LR-27${k}`, empId: e.id, type, from: iso(from), to: iso(to), days: Math.max(1, H.workingDays(iso(from), iso(to))), status, submitted: D.todayISO, reason: '' }); };
    push(tm[0], 'ANNUAL', addDays(TODAY, 6), 2, 'PENDING_MANAGER', 10);
    push(tm[1], 'SICK', addDays(TODAY, -1), 1, 'PENDING_MANAGER', 11);
    push(tm[2], 'ANNUAL', addDays(TODAY, 15), 3, 'PENDING_MANAGER', 12);
    push(tm[3], 'ANNUAL', addDays(TODAY, -1), 3, 'APPROVED', 13);
    push(tm[4], 'ANNUAL', addDays(TODAY, 9), 4, 'APPROVED', 14);
    push(tm[5], 'COMP', addDays(TODAY, 2), 0, 'APPROVED', 15);
    OT.push({ id: 'OT-1001', empId: tm[6].id, date: iso(addDays(TODAY, 1)), hours: 2, mode: 'PAY', reason: { ar: 'تغطية عيادة متنقلة', en: 'Cover mobile clinic' }, status: 'PENDING' });
    OT.push({ id: 'OT-1002', empId: tm[7].id, date: iso(addDays(TODAY, 3)), hours: 1.5, mode: 'COMP', reason: { ar: 'توزيع طارئ', en: 'Emergency distribution' }, status: 'PENDING' });
    D.activity.unshift({ id: 'AM1', role: 'MANAGER', ch: 'teams', at: D.todayISO, ar: '3 طلبات إجازة بانتظار موافقتك', en: '3 leave requests awaiting your approval', go: 'approvals' });
    D.activity.unshift({ id: 'AM2', role: 'MANAGER', ch: 'outlook', at: D.todayISO, ar: 'كشوف دوام الفريق جاهزة للاعتماد', en: 'Team timesheets are ready for approval', go: 'approvals' });
    EXT.state.mgrSeeded = true;
  }

  const teamLeavePending = () => D.leaveRequests.filter((r) => r.status === 'PENDING_MANAGER' && empById.get(r.empId).managerId === mgrId());
  const myTsPending = () => (S.timesheet && S.timesheet.status === 'SUBMITTED' ? 1 : 0);
  const pendingCount = () => teamLeavePending().length + TS.filter((x) => x.status === 'SUBMITTED').length + myTsPending() + OT.filter((x) => x.status === 'PENDING' && empById.get(x.empId).managerId === mgrId()).length + EXT.mgrPending.reduce((s, fn) => s + fn(), 0);
  EXT.badge.MANAGER = pendingCount;

  // ---------- Views ----------
  function todayStatus(e) {
    const r = D.leaveRequests.find((x) => x.empId === e.id && x.status === 'APPROVED' && x.from <= D.todayISO && x.to >= D.todayISO);
    if (r) return badge('b-info', T(H.LEAVE[r.type]), 'cal');
    if (!isWorkDay(TODAY)) return badge('b-neutral', L('يوم راحة', 'Day off'));
    return badge('b-ok', L('في العمل', 'At work'), 'check');
  }
  function vTeam() {
    const tm = team(); const m = persona();
    const onLeave = tm.filter((e) => D.leaveRequests.some((x) => x.empId === e.id && x.status === 'APPROVED' && x.from <= D.todayISO && x.to >= D.todayISO)).length;
    const pend = pendingCount();
    const prob = tm.filter((e) => e.inProbation).length;
    const ce = tm.filter((e) => daysBetween(D.todayISO, e.contractEnd) <= 60).length;
    const noLeave = tm.filter((e) => e.category === 'REGULAR' && serviceMonths(e) >= D.POLICY.care.burnoutNoLeaveMonths && balances(e).annual.taken === 0);
    const rows = tm.map((e) => `<tr class="clickable" data-act="emp" data-id="${e.id}"><td>${who(e, T(e.position))}</td><td>${todayStatus(e)}</td><td class="num">${e.category === 'REGULAR' ? fmtN(balances(e).annual.available, 1) : '—'}</td><td class="num">${e.lateMarks}</td><td>${H.flagList(e).map(([c, l]) => badge(c, l)).join(' ') || '<span class="subtle">—</span>'}</td><td class="hide-sm">${esc(fmtD(e.contractEnd))}</td></tr>`);
    return `${pageHead(L('فريقي', 'My team'), esc(L(`${tm.length} موظفاً يتبعونك مباشرة · ${T(m.deptName)}`, `${tm.length} direct reports · ${T(m.deptName)}`)), `<button class="btn" data-act="case-new">${icon('flag', 16)}${esc(L('رفع ملاحظة', 'Raise a concern'))}</button><button class="btn primary" data-act="nav" data-v="approvals">${icon('approve', 16)}${esc(L(`الموافقات (${pend})`, `Approvals (${pend})`))}</button>`)}
      <div class="grid g-4 keep2">
        ${kpi(L('أعضاء الفريق', 'Team members'), fmtN(tm.length), L('تبعية مباشرة', 'Direct reports'), 'people', 'orgchart')}
        ${kpi(L('في إجازة اليوم', 'On leave today'), fmtN(onLeave), L('حسب الإجازات المعتمدة', 'Approved leave'), 'cal', 'calendar')}
        ${kpi(L('بانتظار موافقتك', 'Awaiting your approval'), fmtN(pend), rule('MG-002'), 'approve', 'approvals')}
        ${kpi(L('تجربة أو عقد ينتهي', 'Probation / contract ending'), `${fmtN(prob)} · ${fmtN(ce)}`, `${rule('LC-006')} ${rule('LC-040')}`, 'clock')}
      </div>
      ${noLeave.length ? `<div class="banner info"><span class="bi">${icon('info', 18)}</span><div class="grow"><b>${esc(L(`${noLeave.length} من فريقك لم يأخذوا أي إجازة سنوية هذا العام`, `${noLeave.length} team member(s) have taken no annual leave this year`))}</b><div class="subtle">${esc(L('الراحة جزء من واجب الرعاية. شجّعهم على التخطيط لإجازة.', 'Rest is part of duty of care. Encourage them to plan leave.'))} ${rule('WB-003')}</div></div><span class="subtle">${noLeave.slice(0, 3).map((e) => esc(T(e.name.short))).join('، ')}</span></div>` : ''}
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('أعضاء الفريق', 'Team members'))}</h2><span class="subtle">${esc(L('الراتب والبيانات الحساسة غير ظاهرة للمدير المباشر', 'Salary and sensitive data are hidden from line managers'))} ${rule('RD-003')}</span></div>
        ${table([L('الموظف', 'Employee'), L('اليوم', 'Today'), L('رصيد سنوي', 'Annual bal.'), L('تأخير', 'Late'), L('تنبيهات', 'Flags'), [L('نهاية العقد', 'Contract end'), 'hide-sm']], rows)}</section>`;
  }

  function vApprovals() {
    const lv = teamLeavePending();
    const lvRows = lv.map((r) => { const e = empById.get(r.empId); const v = validateLeave(e, r, r.id); return `<tr><td>${who(e, T(e.position))}</td><td>${esc(T(H.LEAVE[r.type]))}</td><td>${esc(fmtD(r.from))} – ${esc(fmtD(r.to))}</td><td class="num">${r.days}</td><td>${v.errors.length ? badge('b-bad', L(`${v.errors.length} مخالفة`, `${v.errors.length} issue(s)`), 'warn') : badge('b-ok', L('مطابق', 'Compliant'), 'check')}</td><td style="text-align:end"><div class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="iconbtn sm" data-act="preview-leave" data-id="${r.id}" data-tip="${esc(esc(L('كما تظهر في Teams', 'As shown in Teams')))}">${icon('teams', 16)}</button><button class="btn primary sm" data-act="mgr-leave" data-id="${r.id}" data-v="APPROVE">${esc(L('موافقة', 'Approve'))}</button><button class="btn sm danger" data-act="mgr-leave" data-id="${r.id}" data-v="REJECT">${esc(L('رفض', 'Reject'))}</button></div></td></tr>`; });
    const tsList = [...(myTsPending() ? [{ empId: D.personas.EMPLOYEE, status: 'SUBMITTED' }] : []), ...TS.filter((x) => x.status === 'SUBMITTED')];
    const tsRows = tsList.map((x) => { const e = empById.get(x.empId); if (!e) return ''; return `<tr><td>${who(e, T(e.position))}</td><td class="num">${fmtN(H.workingDays(D.todayISO.slice(0, 8) + '01', D.todayISO))} ${esc(L('يوم', 'days'))}</td><td>${e.alloc.map((a) => `<span class="rule">${a.grant} ${a.pct}%</span>`).join(' ')}</td><td style="text-align:end"><button class="btn primary sm" data-act="mgr-ts" data-id="${e.id}">${esc(L('اعتماد', 'Approve'))}</button></td></tr>`; });
    const ot = OT.filter((x) => x.status === 'PENDING' && empById.get(x.empId).managerId === mgrId());
    const otRows = ot.map((x) => { const e = empById.get(x.empId); return `<tr><td>${who(e, T(e.position))}</td><td>${esc(fmtD(x.date))}</td><td class="num">${fmtN(x.hours, 1)}</td><td>${badge('b-neutral', x.mode === 'PAY' ? L('أجر ×1.5', 'Pay ×1.5') : L('إجازة تعويضية', 'Comp leave'))}</td><td>${esc(T(x.reason))}</td><td style="text-align:end"><div class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn primary sm" data-act="ot-decide" data-id="${x.id}" data-v="APPROVED">${esc(L('موافقة', 'Approve'))}</button><button class="btn sm danger" data-act="ot-decide" data-id="${x.id}" data-v="REJECTED">${esc(L('رفض', 'Reject'))}</button></div></td></tr>`; });
    const sec = (title, n, ruleId, body, extra = '') => `<section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(title)} <span class="subtle">${n}</span></h2><span class="btn-row">${extra}${rule(ruleId)}</span></div>${body}</section>`;
    const tsSub = tsList.length;
    return `${pageHead(L('موافقات الفريق', 'Team approvals'), esc(L('كل طلب يصلك أيضاً كبطاقة تفاعلية في Teams وOutlook.', 'Every request also reaches you as an actionable card in Teams and Outlook.')))}
      ${sec(L('طلبات الإجازة', 'Leave requests'), lv.length, 'LV-001', table([L('الموظف', 'Employee'), L('النوع', 'Type'), L('الفترة', 'Period'), L('الأيام', 'Days'), L('فحص السياسة', 'Policy check'), ''], lvRows, emptyState('check', L('لا توجد طلبات إجازة معلّقة', 'No pending leave'))))}
      ${sec(L('كشوف الدوام', 'Timesheets'), tsSub, 'TS-004', table([L('الموظف', 'Employee'), L('أيام العمل', 'Work days'), L('توزيع المنح', 'Grant split'), ''], tsRows.filter(Boolean), emptyState('check', L('لا توجد كشوف بانتظارك', 'No timesheets waiting'))), tsSub ? `<button class="btn sm secondary" data-act="mgr-ts-all">${esc(L('اعتماد الكل', 'Approve all'))}</button>` : '')}
      ${sec(L('العمل الإضافي', 'Overtime'), ot.length, 'WT-020', table([L('الموظف', 'Employee'), L('التاريخ', 'Date'), L('الساعات', 'Hours'), L('التعويض', 'Compensation'), L('السبب', 'Reason'), ''], otRows, emptyState('check', L('لا توجد طلبات عمل إضافي', 'No overtime requests'))))}
      ${EXT.mgrSections.map((fn) => fn(sec)).join('')}`;
  }

  S.calOffset = S.calOffset || 0;
  function vCalendar() {
    const base = new Date(TODAY.getFullYear(), TODAY.getMonth() + S.calOffset, 1);
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const hol = new Set(D.HOLIDAYS.map((h) => h.date));
    const tm = [persona(), ...team()];
    const head = Array.from({ length: days }, (_, i) => { const d = new Date(base.getFullYear(), base.getMonth(), i + 1); return `<th class="${iso(d) === D.todayISO ? 'today' : ''}">${i + 1}</th>`; }).join('');
    const rows = tm.map((e) => {
      const reqs = D.leaveRequests.filter((r) => r.empId === e.id && ['APPROVED', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_CD'].includes(r.status));
      const cells = Array.from({ length: days }, (_, i) => {
        const d = new Date(base.getFullYear(), base.getMonth(), i + 1); const s = iso(d);
        const r = reqs.find((x) => x.from <= s && x.to >= s);
        let cls = 'c';
        if (!D.POLICY.workWeek.days.includes(H.DAYNAMES[d.getDay()])) cls += ' off';
        else if (hol.has(s)) cls += ' hol';
        else if (r) cls += r.status === 'APPROVED' ? ' lv' : ' pd';
        const tip = r && !cls.includes('off') ? `data-tip="${esc(esc(`${T(e.name.short)} · ${T(H.LEAVE[r.type])} · ${T(H.LSTATUS[r.status])}`))}"` : '';
        return `<td class="${cls}" ${tip}></td>`;
      }).join('');
      return `<tr><td class="nm">${esc(T(e.name.short))}</td>${cells}</tr>`;
    }).join('');
    const mName = new Intl.DateTimeFormat(S.lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }).format(base);
    return `${pageHead(L('تقويم الفريق', 'Team calendar'), esc(L('إجازات الفريق المعتمدة والمعلّقة لتجنّب تعارض التغطية.', 'Approved and pending team leave, to avoid coverage gaps.')) + ' ' + rule('MG-003'), `<button class="iconbtn" data-act="cal-move" data-v="-1" aria-label="${esc(L('السابق', 'Previous'))}"><span class="flip-rtl" style="display:grid">${icon('chevL', 16)}</span></button><b style="min-width:140px;text-align:center">${esc(mName)}</b><button class="iconbtn" data-act="cal-move" data-v="1" aria-label="${esc(L('التالي', 'Next'))}"><span class="flip-rtl" style="display:grid">${icon('chevR', 16)}</span></button>`)}
      <section class="card"><div class="tcal-wrap"><table class="tcal"><thead><tr><th class="nm"></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="legend" style="margin-top:12px"><span><i style="background:var(--success)"></i>${esc(L('إجازة معتمدة', 'Approved leave'))}</span><span><i style="background:repeating-linear-gradient(45deg,var(--warning) 0 3px,var(--warning-bg) 3px 6px)"></i>${esc(L('بانتظار الموافقة', 'Pending'))}</span><span><i style="background:var(--info-bg)"></i>${esc(L('عطلة رسمية', 'Public holiday'))}</span><span><i style="background:var(--surface-2)"></i>${esc(L('يوم عمل', 'Work day'))}</span></div></section>`;
  }

  // ---------- Org chart (Manager, HR, CD) ----------
  S.orgOpen = S.orgOpen || null; S.orgQ = S.orgQ || '';
  function orgKids() { const m = {}; D.employees.forEach((e) => { if (e.managerId) (m[e.managerId] = m[e.managerId] || []).push(e); }); Object.values(m).forEach((l) => l.sort((a, b) => b.grade - a.grade)); return m; }
  function chainOf(e) { const c = []; let x = e; while (x && x.managerId) { x = empById.get(x.managerId); if (x) c.unshift(x); } return c; }
  function vOrg() {
    const kids = orgKids(); const root = empById.get(D.personas.CD);
    if (!S.orgOpen) S.orgOpen = [root.id, ...chainOf(persona()).map((x) => x.id), persona().id];
    const total = (id) => { const k = kids[id] || []; return k.length + k.reduce((s, c) => s + total(c.id), 0); };
    const node = (e, depth) => {
      const k = kids[e.id] || []; const open = S.orgOpen.includes(e.id); const mine = e.id === persona().id;
      return `<div><div class="org-node" style="${mine ? 'background:var(--primary-50)' : ''}">${k.length ? `<button class="tg ${open ? 'open' : ''}" data-act="org-toggle" data-id="${e.id}" aria-expanded="${open}" aria-label="${esc(T(e.name))}">${icon('chevR', 14)}</button>` : '<span style="width:22px"></span>'}${avatar(e, 'sm')}<span class="nm" data-act="emp" data-id="${e.id}">${esc(T(e.name.short))}</span><span class="subtle">${esc(T(e.position))} · ${esc(H.officeName(e.office))}</span>${k.length ? badge('b-neutral', L(`${k.length} مباشر · ${total(e.id)} إجمالي`, `${k.length} direct · ${total(e.id)} total`)) : ''}</div>
        ${open && k.length ? `<div class="org-kids">${k.slice(0, 40).map((c) => node(c, depth + 1)).join('')}${k.length > 40 ? `<div class="subtle" style="padding:6px">${esc(L(`و${k.length - 40} آخرين…`, `and ${k.length - 40} more…`))}</div>` : ''}</div>` : ''}</div>`;
    };
    const q = S.orgQ.trim().toLowerCase();
    const hits = q ? D.employees.filter((e) => e.name.en.toLowerCase().includes(q) || e.name.ar.includes(S.orgQ.trim()) || e.position.en.toLowerCase().includes(q)).slice(0, 15) : [];
    return `${pageHead(L('الهيكل التنظيمي', 'Org chart'), esc(L('يُبنى تلقائياً من بيانات المدير المباشر لكل موظف.', 'Built automatically from each employee\'s line manager.')) + ' ' + rule('MG-005'), `<label class="search-inline">${icon('search', 14)}<input type="search" class="input" data-org-q="1" value="${esc(S.orgQ)}" placeholder="${esc(L('ابحث وحدد الموقع في الهيكل', 'Find someone in the chart'))}"></label>`)}
      ${q ? `<section class="card"><h2>${esc(L('نتائج البحث', 'Search results'))}</h2>${hits.length ? `<div class="list">${hits.map((e) => `<div class="list-item clickable" data-act="org-focus" data-id="${e.id}">${avatar(e, 'sm')}<div class="grow"><div class="t">${esc(T(e.name))}</div><div class="subtle">${chainOf(e).map((x) => esc(T(x.name.short))).join(' › ')}</div></div>${icon('chevR', 14)}</div>`).join('')}</div>` : emptyState('search', L('لا نتائج', 'No results'))}</section>` : ''}
      <section class="card"><div class="org">${node(root, 0)}</div></section>`;
  }

  // ---------- Employee: overtime requests ----------
  S.otDraft = S.otDraft || { date: '', hours: 1, mode: 'COMP', reason: '' };
  function validateOt(d) {
    const out = { errors: [], warnings: [], info: [] };
    if (!d.date) return out;
    const hrs = Number(d.hours) || 0;
    if (D.POLICY.flags.overtimePreApproval && d.date < D.todayISO) out.errors.push(R('WT-020', 'يجب اعتماد العمل الإضافي قبل تنفيذه، ولا يُقبل بأثر رجعي.', 'Overtime must be approved before it is worked; retroactive requests are not accepted.'));
    if (hrs <= 0) out.errors.push(R('WT-022', 'أدخل عدد الساعات.', 'Enter the number of hours.'));
    if (hrs > D.POLICY.overtimeMaxHoursPerDay) out.errors.push(R('WT-022', `الحد الأقصى ${D.POLICY.overtimeMaxHoursPerDay} ساعة في اليوم.`, `Maximum ${D.POLICY.overtimeMaxHoursPerDay} hours per day.`));
    const e = me(); const hourly = e.baseSalary / D.POLICY.workingDaysPerMonth / D.POLICY.workWeek.hoursPerDay;
    if (d.mode === 'PAY') out.info.push(R('WT-021', `القيمة التقديرية: ${money(hrs * hourly * D.POLICY.overtimeMultiplier)} (معامل ${D.POLICY.overtimeMultiplier}).`, `Estimated amount: ${money(hrs * hourly * D.POLICY.overtimeMultiplier)} (×${D.POLICY.overtimeMultiplier}).`));
    else out.info.push(R('LV-080', `تُضاف ${fmtN(hrs / D.POLICY.workWeek.hoursPerDay, 2)} يوم لرصيدك التعويضي بعد الاعتماد، وتسقط بعد ${D.POLICY.leave.COMP.expiresAfterDays} أيام.`, `${fmtN(hrs / D.POLICY.workWeek.hoursPerDay, 2)} day(s) added to your compensatory balance after approval; expires after ${D.POLICY.leave.COMP.expiresAfterDays} days.`));
    if (!isWorkDay(parse(d.date))) out.warnings.push(R('LV-082', 'يوم عطلة: تأكد ألا تتجاوز 10 أيام عمل متتالية دون راحة.', 'Rest day: make sure you do not exceed 10 consecutive working days.'));
    return out;
  }
  function otCheck() {
    const v = validateOt(S.otDraft);
    if (!S.otDraft.date) return `<div class="msg info">${icon('info', 16)}<div>${esc(L('اختر التاريخ والساعات ليتحقق النظام من السياسة.', 'Pick a date and hours to check against policy.'))}</div></div>`;
    return msgs(v);
  }
  function vEmpOvertime() {
    const d = S.otDraft; const v = validateOt(d); const ok = d.date && !v.errors.length;
    const mine = OT.filter((x) => x.empId === me().id);
    const st = { PENDING: ['b-warn', L('بانتظار المدير', 'Awaiting manager')], APPROVED: ['b-ok', L('معتمد', 'Approved')], REJECTED: ['b-bad', L('مرفوض', 'Rejected')] };
    return `${pageHead(L('العمل الإضافي', 'Overtime'), esc(L('يُطلب العمل الإضافي ويُعتمد قبل تنفيذه.', 'Overtime is requested and approved before it is worked.')) + ' ' + rule('WT-020'))}
      <div class="grid g-12">
        <section class="card"><h2>${esc(L('طلب جديد', 'New request'))}</h2>
          <div class="form-grid">
            <div class="field"><label for="ot-date">${esc(L('التاريخ', 'Date'))}</label><input id="ot-date" type="date" class="input" data-ot="date" value="${esc(d.date)}"></div>
            <div class="field"><label for="ot-h">${esc(L('الساعات', 'Hours'))}</label><input id="ot-h" type="number" min="0.5" max="8" step="0.5" class="input num" data-ot="hours" value="${esc(d.hours)}"></div>
            <div class="field full"><span class="flabel">${esc(L('طريقة التعويض', 'Compensation'))} ${rule('WT-023')}</span><div class="radio-group"><label class="radio"><input type="radio" name="ot-mode" value="COMP" data-ot="mode" ${d.mode === 'COMP' ? 'checked' : ''}><span>${esc(L('إجازة تعويضية', 'Compensatory leave'))}</span></label><label class="radio"><input type="radio" name="ot-mode" value="PAY" data-ot="mode" ${d.mode === 'PAY' ? 'checked' : ''}><span>${esc(L('أجر إضافي', 'Overtime pay'))}</span></label></div></div>
            <div class="field full"><label for="ot-r">${esc(L('سبب العمل الإضافي', 'Reason'))}</label><textarea id="ot-r" class="textarea" data-ot="reason">${esc(d.reason)}</textarea></div>
            <div class="full" id="ot-check">${otCheck()}</div>
            <div class="full"><button class="btn primary" id="ot-submit" data-act="ot-submit" ${ok ? '' : 'disabled'}>${icon('send', 16)}${esc(L('إرسال للمدير المباشر', 'Send to line manager'))}</button></div>
          </div></section>
        <section class="card"><h2>${esc(L('طلباتي', 'My requests'))}</h2>${table([L('الرقم', 'ID'), L('التاريخ', 'Date'), L('الساعات', 'Hours'), L('التعويض', 'Comp.'), L('الحالة', 'Status')], mine.map((x) => `<tr><td class="num">${esc(x.id)}</td><td>${esc(fmtD(x.date))}</td><td class="num">${fmtN(x.hours, 1)}</td><td>${esc(x.mode === 'PAY' ? L('أجر', 'Pay') : L('تعويضية', 'Comp'))}</td><td>${badge(st[x.status][0], st[x.status][1])}</td></tr>`), emptyState('clock', L('لا توجد طلبات بعد', 'No requests yet')))}</section>
      </div>`;
  }

  // ---------- Register ----------
  addNav('MANAGER', 'overview', ['نظرة عامة', 'Overview'], { v: 'team', ic: 'people', ar: 'فريقي', en: 'My team' });
  addNav('MANAGER', 'overview', ['نظرة عامة', 'Overview'], { v: 'approvals', ic: 'approve', ar: 'الموافقات', en: 'Approvals', badge: true });
  addNav('MANAGER', 'overview', ['نظرة عامة', 'Overview'], { v: 'calendar', ic: 'cal', ar: 'تقويم الفريق', en: 'Team calendar' });
  addNav('MANAGER', 'org', ['المؤسسة', 'Organization'], { v: 'orgchart', ic: 'list', ar: 'الهيكل التنظيمي', en: 'Org chart' });
  Object.assign(VIEWS.MANAGER, { team: vTeam, approvals: vApprovals, calendar: vCalendar, orgchart: vOrg });
  addNav('HR', 'people', ['الموظفون', 'People'], { v: 'orgchart', ic: 'list', ar: 'الهيكل التنظيمي', en: 'Org chart' });
  VIEWS.HR.orgchart = vOrg;
  addNav('CD', 'insights', ['التحليلات', 'Insights'], { v: 'orgchart', ic: 'list', ar: 'الهيكل التنظيمي', en: 'Org chart' });
  VIEWS.CD.orgchart = vOrg;
  addNav('EMPLOYEE', 'time', ['الوقت والإجازات', 'Time & leave'], { v: 'overtime', ic: 'clock', ar: 'العمل الإضافي', en: 'Overtime' });
  VIEWS.EMPLOYEE.overtime = vEmpOvertime;

  Object.assign(EXT.actions, {
    'mgr-leave': (t) => managerDecide(t.dataset.id, t.dataset.v),
    'mgr-ts': (t) => { if (t.dataset.id === D.personas.EMPLOYEE && S.timesheet) { S.timesheet.status = 'APPROVED'; addActivity('EMPLOYEE', 'teams', 'اعتمد مديرك كشف دوامك', 'Your manager approved your timesheet', 'timesheet'); } else { const x = TS.find((y) => y.empId === t.dataset.id); x.status = 'APPROVED'; } audit(`اعتماد كشف دوام ${t.dataset.id}`, `Timesheet approved for ${t.dataset.id}`); render(); toast(L('اعتُمد كشف الدوام وأُرسل للموارد البشرية.', 'Timesheet approved and sent to HR.'), 'ok'); },
    'mgr-ts-all': () => { const n = TS.filter((x) => x.status === 'SUBMITTED').length + myTsPending(); if (myTsPending()) S.timesheet.status = 'APPROVED'; TS.forEach((x) => { if (x.status === 'SUBMITTED') x.status = 'APPROVED'; }); audit(`اعتماد ${n} كشوف دوام`, `${n} timesheets approved`); render(); toast(L(`اعتُمد ${n} كشف دوام.`, `${n} timesheets approved.`), 'ok'); },
    'ot-decide': (t) => {
      const x = OT.find((y) => y.id === t.dataset.id); x.status = t.dataset.v;
      if (x.status === 'APPROVED' && x.mode === 'COMP') { const e = empById.get(x.empId); e.leave.compDays = +(e.leave.compDays + x.hours / D.POLICY.workWeek.hoursPerDay).toFixed(2); }
      audit(`${x.status === 'APPROVED' ? 'موافقة' : 'رفض'} عمل إضافي ${x.id}`, `Overtime ${x.id} ${x.status.toLowerCase()}`);
      addActivity('EMPLOYEE', 'teams', `تحديث على طلب العمل الإضافي ${x.id}`, `Update on overtime request ${x.id}`, 'overtime');
      render(); toast(x.status === 'APPROVED' ? L('تمت الموافقة.', 'Approved.') : L('تم الرفض.', 'Rejected.'), x.status === 'APPROVED' ? 'ok' : 'bad');
    },
    'ot-submit': () => {
      const d = S.otDraft; if (validateOt(d).errors.length || !d.date) return;
      const id = `OT-${1001 + OT.length}`; OT.push({ id, empId: me().id, date: d.date, hours: Number(d.hours), mode: d.mode, reason: d.reason, status: 'PENDING' });
      addActivity('MANAGER', 'teams', `طلب عمل إضافي ${id} من ${me().name.ar}`, `Overtime request ${id} from ${me().name.en}`, 'approvals');
      audit(`طلب عمل إضافي ${id}`, `Overtime request ${id}`);
      S.otDraft = { date: '', hours: 1, mode: d.mode, reason: '' }; render(); toast(L('أُرسل الطلب للمدير المباشر عبر Teams.', 'Sent to your line manager in Teams.'), 'ok');
    },
    'cal-move': (t) => { S.calOffset += Number(t.dataset.v); render(); },
    'org-toggle': (t) => { const id = t.dataset.id; S.orgOpen = S.orgOpen.includes(id) ? S.orgOpen.filter((x) => x !== id) : [...S.orgOpen, id]; render(); },
    'org-focus': (t) => { const e = empById.get(t.dataset.id); S.orgOpen = [...new Set([...(S.orgOpen || []), ...chainOf(e).map((x) => x.id), e.id])]; S.orgQ = ''; render(); }
  });
  EXT.onInput.push((t) => {
    if (t.dataset.ot && t.type !== 'radio') { S.otDraft[t.dataset.ot] = t.value; const c = document.getElementById('ot-check'); if (c) c.innerHTML = otCheck(); const b = document.getElementById('ot-submit'); if (b) b.disabled = !(S.otDraft.date && !validateOt(S.otDraft).errors.length); return true; }
    if (t.dataset.orgQ) { S.orgQ = t.value; render(); const i = document.querySelector('[data-org-q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return true; }
    return false;
  });
  EXT.onChange.push((t) => { if (t.dataset.ot === 'mode') { S.otDraft.mode = t.value; const c = document.getElementById('ot-check'); if (c) c.innerHTML = otCheck(); return true; } return false; });
})();
