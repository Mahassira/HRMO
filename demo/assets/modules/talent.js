/* HRMO module — Performance (appraisal cycle, objectives, PIP) and learning (catalog, TNA, enrolment).
 * Rules: PF-001..012, LD-001..020, CP-011. */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, VIEWS, L, T, esc, icon, fmtN, fmtD, iso, addDays, daysBetween, TODAY, badge, rule, who, toast, addActivity, emptyState, empById, persona, me, render, openOverlay, pageHead, table, store, addNav, audit, drawer, modal, msgs, R, kpi, meter, bars, officeName } = H;
  const RATING = H.RATING;
  const SCALE = ['UNSATISFACTORY', 'NEEDS_IMPROVEMENT', 'SATISFACTORY', 'VERY_GOOD', 'OUTSTANDING'];
  const COMPS = [['JOB_KNOWLEDGE', 'المعرفة بالعمل', 'Job knowledge'], ['QUALITY_OF_WORK', 'جودة العمل', 'Quality of work'], ['TIMELINESS', 'الالتزام بالمواعيد', 'Timeliness'], ['COOPERATION', 'التعاون', 'Cooperation'], ['INITIATIVE', 'المبادرة', 'Initiative'], ['RELIABILITY', 'الاعتمادية', 'Reliability'], ['JUDGMENT', 'حسن التقدير', 'Judgment'], ['CONDUCT', 'السلوك المهني', 'Professional conduct'], ['OBJECTIVES_ACHIEVEMENT', 'تحقيق الأهداف', 'Achievement of objectives']];
  const STAGES = [['SELF', 'التقييم الذاتي', 'Self-assessment'], ['MANAGER', 'المدير المباشر', 'Line manager'], ['SECOND', 'المشرف الثاني', 'Second line'], ['HR', 'مراجعة الموارد البشرية', 'HR review'], ['MEETING', 'اجتماع التقييم', 'Meeting'], ['DONE', 'مكتمل', 'Complete']];
  const RECS = { CONFIRM: ['تثبيت/استمرار', 'Confirm / continue'], MERIT: ['زيادة سنوية', 'Merit increase'], PROMOTION: ['توصية بالترقية', 'Promotion recommendation'], PIP: ['خطة تحسين أداء', 'Improvement plan'], EXTEND: ['تمديد التجربة', 'Extend probation'] };
  const stageIdx = (s) => STAGES.findIndex((x) => x[0] === s);
  const avg = (o) => { const v = Object.values(o || {}); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
  const ratingOf = (n) => SCALE[Math.max(0, Math.min(4, Math.round(n) - 1))];

  // ---------- Seed ----------
  const APPR = store('appraisals', () => {
    const r = H.rng(23); const out = []; const fill = () => Object.fromEntries(COMPS.map(([k]) => [k, 2 + Math.floor(r() * 4)]));
    out.push({ id: 'APR-3001', empId: D.personas.EMPLOYEE, kind: 'ANNUAL', due: iso(addDays(TODAY, 12)), stage: 'SELF', self: {}, mgr: {}, rec: '', comments: {} });
    H.team().filter((e) => e.id !== D.personas.EMPLOYEE).slice(0, 4).forEach((e, i) => out.push({ id: `APR-${3002 + i}`, empId: e.id, kind: i === 3 && e.inProbation ? 'PROBATION' : 'ANNUAL', due: iso(addDays(TODAY, 3 + i * 4)), stage: 'MANAGER', self: fill(), mgr: {}, rec: '', comments: { self: { ar: 'حققت أهدافي الأساسية وأحتاج تدريباً إضافياً.', en: 'Met my core objectives; I need further training.' } } }));
    D.employees.filter((e) => e.category === 'REGULAR' && !Object.values(D.personas).includes(e.id) && e.managerId !== D.personas.MANAGER).forEach((e) => {
      const h = new Date(e.hireDate); const ann = new Date(TODAY.getFullYear(), h.getMonth(), h.getDate()); const d = daysBetween(D.todayISO, iso(ann));
      if (Math.abs(d) <= 30 && out.length < 70) { const st = d < -10 ? 'DONE' : ['SELF', 'MANAGER', 'SECOND', 'HR', 'MEETING'][Math.floor(r() * 5)]; out.push({ id: `APR-${3002 + out.length}`, empId: e.id, kind: 'ANNUAL', due: iso(ann), stage: st, self: stageIdx(st) > 0 ? fill() : {}, mgr: stageIdx(st) > 1 ? fill() : {}, rec: stageIdx(st) > 1 ? 'CONFIRM' : '', comments: {} }); }
    });
    return out;
  });
  const OBJ = store('objectives', () => {
    const r = H.rng(29); const out = [];
    const mine = [['رفع تغطية التطعيم في المنطقة المخدومة إلى 90%', 'Raise vaccination coverage in the catchment area to 90%'], ['تدريب 20 عامل صحة مجتمعية على الإحالة', 'Train 20 community health workers on referrals'], ['تسليم التقارير الشهرية للمانح قبل اليوم الخامس', 'Submit monthly donor reports by the 5th'], ['تقليل نفاد الأدوية الأساسية إلى صفر', 'Bring essential-medicine stock-outs to zero']];
    mine.forEach((m, i) => out.push({ id: `OBJ-${4001 + i}`, empId: D.personas.EMPLOYEE, ar: m[0], en: m[1], due: iso(addDays(TODAY, 30 + i * 20)), progress: [70, 45, 90, 30][i], checkins: [{ date: iso(addDays(TODAY, -40)), progress: [50, 20, 80, 10][i] }] }));
    H.team().filter((e) => e.id !== D.personas.EMPLOYEE).slice(0, 10).forEach((e) => { for (let k = 0; k < 2; k++) out.push({ id: `OBJ-${4001 + out.length}`, empId: e.id, ar: ['تحسين جودة الخدمة المقدمة', 'الالتزام بمعايير الحماية'][k], en: ['Improve service quality scores', 'Full adherence to safeguarding standards'][k], due: iso(addDays(TODAY, 60)), progress: Math.floor(r() * 100), checkins: [] }); });
    return out;
  });
  const PIPS = store('pips', () => { const t = H.team().filter((e) => e.id !== D.personas.EMPLOYEE); return [{ id: 'PIP-5001', empId: t[8].id, start: iso(addDays(TODAY, -20)), end: iso(addDays(TODAY, 8)), goals: { ar: 'الالتزام بمواعيد التقارير وتحسين التوثيق', en: 'Meet report deadlines and improve documentation' }, status: 'ACTIVE' }, { id: 'PIP-5002', empId: D.employees[300].id, start: iso(addDays(TODAY, -35)), end: iso(addDays(TODAY, -7)), goals: { ar: 'تحسين الحضور والانضباط', en: 'Improve attendance and punctuality' }, status: 'ACTIVE' }]; });

  // ---------- Shared renderers ----------
  const miniSteps = (stage) => `<div class="mini-steps">${STAGES.map((s, i) => `<span class="${i < stageIdx(stage) ? 'done' : i === stageIdx(stage) ? 'cur' : ''}">${esc(L(s[1], s[2]))}</span>`).join('')}</div>`;
  const rateRow = (a, who2, k, editable) => { const v = (a[who2] || {})[k]; return `<div class="rate" role="radiogroup">${[1, 2, 3, 4, 5].map((n) => `<button type="button" aria-pressed="${v === n}" ${editable ? `data-act="rate" data-id="${a.id}" data-w="${who2}" data-k="${k}" data-v="${n}"` : 'disabled'} title="${esc(T(RATING[SCALE[n - 1]]))}">${n}</button>`).join('')}</div>`; };
  function compTable(a, mode) {
    return `<div class="table-wrap"><table><thead><tr><th>${esc(L('الكفاءة', 'Competency'))}</th><th>${esc(L('الموظف', 'Employee'))}</th><th>${esc(L('المدير', 'Manager'))}</th></tr></thead><tbody>${COMPS.map(([k, ar, en]) => `<tr><td>${esc(L(ar, en))}</td><td>${mode === 'self' ? rateRow(a, 'self', k, true) : `<span class="num">${(a.self || {})[k] || '—'}</span>`}</td><td>${mode === 'mgr' ? rateRow(a, 'mgr', k, true) : `<span class="num">${(a.mgr || {})[k] || '—'}</span>`}</td></tr>`).join('')}</tbody></table></div>`;
  }

  // ---------- Employee: my performance ----------
  function vEmpPerf() {
    const e = me(); const a = APPR.find((x) => x.empId === e.id && x.stage !== 'DONE'); const objs = OBJ.filter((o) => o.empId === e.id);
    const done = a && Object.keys(a.self).length === COMPS.length;
    return `${pageHead(L('أدائي', 'My performance'), esc(L('أهداف SMART تُراجع كل ربع سنة، وتقييم سنوي في ذكرى التعيين.', 'SMART objectives reviewed quarterly; annual appraisal on your employment anniversary.')) + ' ' + rule('PF-010'))}
      <section class="card"><div class="card-head"><h2>${esc(L('أهدافي', 'My objectives'))}</h2><span class="subtle">${esc(L('حرّك المؤشر لتحديث التقدم ثم احفظ المتابعة الربعية', 'Move the slider to update progress, then save your quarterly check-in'))}</span></div>
        <div class="list">${objs.map((o) => `<div class="list-item obj-row"><div><div class="t" style="white-space:normal">${esc(L(o.ar, o.en))}</div><div class="subtle">${esc(L('الموعد', 'Due'))} ${esc(fmtD(o.due))}${o.checkins.length ? ` · ${esc(L('آخر متابعة', 'last check-in'))} ${esc(fmtD(o.checkins.slice(-1)[0].date))}` : ''}</div></div><div><input type="range" class="range" min="0" max="100" step="5" value="${o.progress}" data-objp="${o.id}" aria-label="${esc(L('التقدم', 'Progress'))}"><div class="subtle num" id="objv-${o.id}">${o.progress}%</div></div><button class="btn sm" data-act="obj-checkin" data-id="${o.id}">${esc(L('حفظ المتابعة', 'Save check-in'))}</button></div>`).join('') || emptyState('flag', L('لا توجد أهداف بعد', 'No objectives yet'))}</div></section>
      ${a ? `<section class="card"><div class="card-head"><h2>${esc(a.kind === 'PROBATION' ? L('تقييم فترة التجربة', 'Probation appraisal') : L('التقييم السنوي', 'Annual appraisal'))} <span class="count">${esc(L('مستحق', 'due'))} ${esc(fmtD(a.due))}</span></h2>${rule('PF-001')}</div>${miniSteps(a.stage)}
        ${a.stage === 'SELF' ? `<p class="muted" style="margin:12px 0">${esc(L('قيّم نفسك من 1 إلى 5 في كل كفاءة، ثم أرسل التقييم لمديرك.', 'Rate yourself from 1 to 5 on each competency, then send to your manager.'))}</p>${compTable(a, 'self')}<div class="field" style="margin-top:12px"><label for="self-c">${esc(L('تعليقك', 'Your comments'))}</label><textarea id="self-c" class="textarea" data-apc="${a.id}" data-w="self">${esc(a.comments.self || '')}</textarea></div><div class="btn-row" style="margin-top:12px"><button class="btn primary" data-act="appr-submit-self" data-id="${a.id}" ${done ? '' : 'disabled'}>${icon('send', 16)}${esc(L('إرسال للمدير المباشر', 'Send to line manager'))}</button>${done ? '' : `<span class="subtle">${esc(L(`قيّمت ${Object.keys(a.self).length} من ${COMPS.length}`, `${Object.keys(a.self).length} of ${COMPS.length} rated`))}</span>`}</div>` : `<div class="msg info" style="margin-top:12px">${icon('info', 16)}<div>${esc(L('التقييم الآن في مرحلة: ', 'The appraisal is now at: '))}<b>${esc(L(...STAGES[stageIdx(a.stage)].slice(1)))}</b></div></div>`}</section>` : `<section class="card">${emptyState('check', L('لا يوجد تقييم مفتوح', 'No open appraisal'), L('آخر تقييم: ', 'Last rating: ') + T(RATING[e.rating]))}</section>`}`;
  }

  // ---------- Manager: team performance ----------
  function vMgrPerf() {
    const tm = H.team(); const ids = new Set(tm.map((e) => e.id));
    const waiting = APPR.filter((a) => ids.has(a.empId) && a.stage === 'MANAGER'); const other = APPR.filter((a) => ids.has(a.empId) && a.stage !== 'MANAGER');
    const pips = PIPS.filter((p) => ids.has(p.empId));
    const objRows = tm.map((e) => { const o = OBJ.filter((x) => x.empId === e.id); const p = o.length ? o.reduce((s, x) => s + x.progress, 0) / o.length : null; return `<tr class="clickable" data-act="emp" data-id="${e.id}"><td>${who(e, T(e.position))}</td><td class="num">${o.length}</td><td style="min-width:140px">${p == null ? '<span class="subtle">—</span>' : `${meter(p, p >= 60 ? 'ok' : p >= 35 ? 'warn' : 'bad')}<span class="subtle num">${fmtN(p)}%</span>`}</td><td>${esc(T(RATING[e.rating]))}</td></tr>`; });
    return `${pageHead(L('أداء الفريق', 'Team performance'), esc(L('أكمل تقييمات فريقك، وتابع الأهداف، وأدر خطط تحسين الأداء.', 'Complete your team\'s appraisals, track objectives and manage improvement plans.')) + ' ' + rule('PF-001'))}
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('تقييمات بانتظارك', 'Appraisals waiting for you'))} <span class="subtle">${waiting.length}</span></h2></div>${table([L('الموظف', 'Employee'), L('النوع', 'Type'), L('مستحق', 'Due'), L('التقييم الذاتي', 'Self rating'), ''], waiting.map((a) => { const e = empById.get(a.empId); return `<tr><td>${who(e, T(e.position))}</td><td>${badge(a.kind === 'PROBATION' ? 'b-info' : 'b-neutral', a.kind === 'PROBATION' ? L('تجربة', 'Probation') : L('سنوي', 'Annual'))}</td><td>${esc(fmtD(a.due))}${a.due < D.todayISO ? ' ' + badge('b-bad', L('متأخر', 'Overdue')) : ''}</td><td class="num">${Object.keys(a.self).length ? fmtN(avg(a.self), 1) : '—'}</td><td style="text-align:end"><button class="btn primary sm" data-act="appr-open" data-id="${a.id}">${esc(L('تقييم', 'Appraise'))}</button></td></tr>`; }), emptyState('check', L('لا توجد تقييمات بانتظارك', 'Nothing waiting')))}</section>
      <div class="grid g-21">
        <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('أهداف الفريق', 'Team objectives'))}</h2>${rule('PF-010')}</div>${table([L('الموظف', 'Employee'), L('الأهداف', 'Objectives'), L('متوسط التقدم', 'Avg. progress'), L('آخر تقييم', 'Last rating')], objRows)}</section>
        <section class="card"><h2>${esc(L('خطط تحسين الأداء', 'Improvement plans'))} ${rule('PF-012')}</h2>${pips.length ? `<div class="list">${pips.map((p) => pipItem(p)).join('')}</div>` : emptyState('check', L('لا توجد خطط نشطة', 'No active plans'))}<p class="subtle" style="margin:8px 0 0">${esc(L('ابدأ خطة من ملف الموظف.', 'Start a plan from the employee file.'))}</p></section>
      </div>
      ${other.length ? `<section class="card"><h2>${esc(L('تقييمات أخرى للفريق', 'Other team appraisals'))}</h2><div class="list">${other.map((a) => { const e = empById.get(a.empId); return `<div class="list-item">${H.avatar(e, 'sm')}<div class="grow"><div class="t">${esc(T(e.name.short))}</div>${miniSteps(a.stage)}</div></div>`; }).join('')}</div></section>` : ''}`;
  }
  function pipItem(p) {
    const e = empById.get(p.empId); const left = daysBetween(D.todayISO, p.end);
    return `<div class="list-item">${H.avatar(e, 'sm')}<div class="grow"><div class="t">${esc(T(e.name.short))}</div><div class="subtle">${esc(T(p.goals))}</div><div class="subtle">${esc(fmtD(p.start))} – ${esc(fmtD(p.end))}</div></div>${p.status === 'ACTIVE' ? (left < 0 ? `<div class="btn-row"><button class="btn sm" data-act="pip-close" data-id="${p.id}" data-v="COMPLETED">${esc(L('تحسّن', 'Improved'))}</button><button class="btn sm danger" data-act="pip-close" data-id="${p.id}" data-v="ESCALATED">${esc(L('بدء المسار التأديبي', 'Start disciplinary'))}</button></div>` : badge('b-warn', L(`${left} يوماً متبقياً`, `${left} days left`))) : badge(p.status === 'COMPLETED' ? 'b-ok' : 'b-bad', p.status === 'COMPLETED' ? L('اكتملت بنجاح', 'Completed') : L('أُحيلت للتأديب', 'Escalated'))}</div>`;
  }

  // ---------- Appraisal drawer (manager / HR) ----------
  EXT.overlays.appr = (o) => {
    const a = APPR.find((x) => x.id === o.id); const e = empById.get(a.empId);
    const canMgr = a.stage === 'MANAGER' && (S.role === 'MANAGER' || S.role === 'HR'); const mRated = Object.keys(a.mgr).length === COMPS.length;
    const overall = avg(Object.keys(a.mgr).length ? a.mgr : a.self);
    const body = `${miniSteps(a.stage)}<dl class="kv"><dt>${esc(L('النوع', 'Type'))}</dt><dd>${esc(a.kind === 'PROBATION' ? L('تقييم التجربة', 'Probation appraisal') : L('تقييم سنوي', 'Annual appraisal'))}</dd><dt>${esc(L('مستحق', 'Due'))}</dt><dd>${esc(fmtD(a.due))}</dd><dt>${esc(L('النتيجة الحالية', 'Current overall'))}</dt><dd>${overall ? `${fmtN(overall, 1)} · ${esc(T(RATING[ratingOf(overall)]))}` : '—'}</dd></dl>
      ${compTable(a, canMgr ? 'mgr' : '')}
      ${a.comments.self ? `<div><p class="section-title">${esc(L('تعليق الموظف', 'Employee comment'))}</p><p class="muted" style="margin:0">${esc(T(a.comments.self))}</p></div>` : ''}
      ${canMgr ? `<div class="field"><label for="ap-rec">${esc(L('التوصية', 'Recommendation'))} ${rule('PF-009')}</label><select id="ap-rec" class="select" data-aprec="${a.id}"><option value="">—</option>${Object.entries(RECS).filter(([k]) => a.kind === 'PROBATION' || k !== 'EXTEND').map(([k, v]) => `<option value="${k}" ${a.rec === k ? 'selected' : ''}>${esc(L(...v))}</option>`).join('')}</select></div><div class="field"><label for="ap-mc">${esc(L('تعليق المدير', 'Manager comment'))}</label><textarea id="ap-mc" class="textarea" data-apc="${a.id}" data-w="mgr">${esc(a.comments.mgr || '')}</textarea></div>${a.rec === 'MERIT' && ratingOf(overall) && SCALE.indexOf(ratingOf(overall)) < 2 ? `<div class="msg bad">${icon('warn', 16)}<div>${esc(L('الزيادة السنوية تتطلب تقييماً مرضياً أو أعلى.', 'A merit increase requires a satisfactory rating or better.'))} ${rule('CP-011')}</div></div>` : ''}` : ''}`;
    let footer = '';
    if (canMgr) footer = `<button class="btn primary" data-act="appr-submit-mgr" data-id="${a.id}" ${mRated && a.rec ? '' : 'disabled'}>${icon('send', 16)}${esc(L('إرسال للمشرف الثاني', 'Send to second line'))}</button>`;
    else if (S.role === 'HR' && ['SECOND', 'HR', 'MEETING'].includes(a.stage)) footer = `<button class="btn primary" data-act="appr-advance" data-id="${a.id}">${esc(L(`إتمام مرحلة: ${STAGES[stageIdx(a.stage)][1]}`, `Complete: ${STAGES[stageIdx(a.stage)][2]}`))}</button>`;
    return drawer(`${T(e.name.short)} · ${L('التقييم', 'Appraisal')}`, body, footer, H.avatar(e));
  };

  // ---------- HR: performance cycle ----------
  function vHrPerf() {
    const open = APPR.filter((a) => a.stage !== 'DONE'); const overdue = open.filter((a) => a.due < D.todayISO);
    const byStage = STAGES.map(([k, ar, en]) => ({ label: L(ar, en), value: APPR.filter((a) => a.stage === k).length }));
    const dist = SCALE.map((k) => ({ label: T(RATING[k]), value: D.employees.filter((e) => e.category === 'REGULAR' && e.rating === k).length })).reverse();
    return `${pageHead(L('إدارة الأداء', 'Performance management'), esc(L('دورة التقييم السنوي، وتقييمات التجربة، وخطط تحسين الأداء.', 'Annual appraisal cycle, probation appraisals and improvement plans.')) + ' ' + rule('PF-001'))}
      <div class="grid g-4 keep2">${kpi(L('تقييمات مفتوحة', 'Open appraisals'), fmtN(open.length), '', 'list')}${kpi(L('متأخرة', 'Overdue'), fmtN(overdue.length), rule('PF-001'), 'warn')}${kpi(L('مكتملة هذا الشهر', 'Completed this cycle'), fmtN(APPR.filter((a) => a.stage === 'DONE').length), '', 'check')}${kpi(L('خطط تحسين نشطة', 'Active improvement plans'), fmtN(PIPS.filter((p) => p.status === 'ACTIVE').length), rule('PF-012'), 'flag')}</div>
      <div class="grid g-2"><section class="card"><h2>${esc(L('التقييمات حسب المرحلة', 'Appraisals by stage'))}</h2>${bars(byStage, { title: L('حسب المرحلة', 'By stage') })}</section><section class="card"><h2>${esc(L('توزيع التقييمات (الموظفون الدائمون)', 'Rating distribution (regular staff)'))}</h2>${bars(dist, { title: L('توزيع التقييمات', 'Rating distribution') })}</section></div>
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('التقييمات المفتوحة', 'Open appraisals'))}</h2></div>${table([L('الموظف', 'Employee'), L('المدير', 'Manager'), L('مستحق', 'Due'), L('المرحلة', 'Stage'), ''], open.sort((x, y) => (x.due > y.due ? 1 : -1)).slice(0, 25).map((a) => { const e = empById.get(a.empId); const m = empById.get(e.managerId); return `<tr><td>${who(e, T(e.position))}</td><td>${m ? esc(T(m.name.short)) : '—'}</td><td>${esc(fmtD(a.due))}${a.due < D.todayISO ? ' ' + badge('b-bad', L('متأخر', 'Overdue')) : ''}</td><td>${badge(a.stage === 'MANAGER' || a.stage === 'SELF' ? 'b-neutral' : 'b-info', L(...STAGES[stageIdx(a.stage)].slice(1)))}</td><td style="text-align:end"><button class="btn sm" data-act="appr-open" data-id="${a.id}">${esc(L('فتح', 'Open'))}</button></td></tr>`; }))}</section>
      <section class="card"><h2>${esc(L('خطط تحسين الأداء', 'Improvement plans'))} ${rule('PF-012')}</h2><div class="list">${PIPS.map(pipItem).join('') || emptyState('check', L('لا يوجد', 'None'))}</div></section>`;
  }

  // =====================================================================
  // Learning & development
  // =====================================================================
  const NEEDS = [['DATA', 'تحليل البيانات وExcel', 'Data analysis & Excel'], ['REPORT', 'كتابة التقارير للمانحين', 'Donor report writing'], ['LEAD', 'القيادة والإشراف', 'Leadership & supervision'], ['ENGLISH', 'اللغة الإنجليزية المهنية', 'Professional English'], ['FIRSTAID', 'الإسعافات الأولية', 'First aid'], ['MHPSS', 'الإسعاف النفسي الأولي', 'Psychological first aid'], ['PROC', 'المشتريات والامتثال', 'Procurement & compliance'], ['SAFE', 'الأمن الشخصي في الميدان', 'Personal field security']];
  const COURSES = store('courses', () => [
    { id: 'CRS-01', code: 'PSEA', ar: 'الحماية من الاستغلال والانتهاك الجنسي', en: 'PSEA essentials', type: 'MANDATORY', mode: 'ELEARN', hours: 2, date: iso(addDays(TODAY, 3)), seats: 60, enrolled: 41 },
    { id: 'CRS-02', code: 'HARASS', ar: 'منع التحرش في بيئة العمل', en: 'Preventing workplace harassment', type: 'MANDATORY', mode: 'ELEARN', hours: 1.5, date: iso(addDays(TODAY, 3)), seats: 60, enrolled: 37 },
    { id: 'CRS-03', code: 'SECURITY', ar: 'الأمن والسلامة الميدانية', en: 'Field safety & security', type: 'MANDATORY', mode: 'CLASS', hours: 8, date: iso(addDays(TODAY, 9)), seats: 25, enrolled: 22 },
    { id: 'CRS-04', code: 'FRAUD', ar: 'التوعية بالاحتيال', en: 'Fraud awareness', type: 'MANDATORY', mode: 'ELEARN', hours: 1, date: iso(addDays(TODAY, 3)), seats: 80, enrolled: 19 },
    { id: 'CRS-05', code: 'REPORT', ar: 'كتابة التقارير للمانحين', en: 'Donor report writing', type: 'INTERNAL', mode: 'CLASS', hours: 12, date: iso(addDays(TODAY, 16)), seats: 20, enrolled: 14 },
    { id: 'CRS-06', code: 'LEAD', ar: 'أساسيات الإشراف', en: 'Supervision essentials', type: 'INTERNAL', mode: 'CLASS', hours: 16, date: iso(addDays(TODAY, 24)), seats: 18, enrolled: 18 },
    { id: 'CRS-07', code: 'MHPSS', ar: 'الإسعاف النفسي الأولي', en: 'Psychological first aid', type: 'INTERNAL', mode: 'CLASS', hours: 6, date: iso(addDays(TODAY, 12)), seats: 30, enrolled: 11 }
  ]);
  const MYL = store('myLearning', () => ({ enrolled: [], tna: [], tnaSubmitted: false, extDaysUsed: 1 }));
  const TNA = store('tnaAgg', () => { const r = H.rng(41); const m = {}; NEEDS.forEach(([k]) => { m[k] = 20 + Math.floor(r() * 140); }); return m; });
  function vEmpLearning() {
    const e = me();
    return `${pageHead(L('تعلّمي', 'My learning'), esc(L('التدريبات الإلزامية، والدورات المتاحة، وتقييم احتياجاتك التدريبية.', 'Mandatory trainings, available courses and your training needs assessment.')) + ' ' + rule('LD-001'))}
      <div class="grid g-2">
        <section class="card"><h2>${esc(L('التدريبات الإلزامية', 'Mandatory trainings'))} ${rule('CC-009')}</h2><div class="list">${D.TRAININGS.map((t) => { const ok = e.trainingsDone.includes(t.code); return `<div class="list-item">${icon(ok ? 'check' : 'clock')}<div class="grow"><div class="t">${esc(T(t))}</div></div>${ok ? badge('b-ok', L('مكتمل', 'Completed'), 'check') : `<button class="btn sm primary" data-act="lrn-complete" data-v="${t.code}">${esc(L('ابدأ التعلّم الإلكتروني', 'Start e-learning'))}</button>`}</div>`; }).join('')}</div></section>
        <section class="card"><h2>${esc(L('تقييم احتياجاتي التدريبية', 'My training needs'))} ${rule('LD-001')}</h2>${MYL.tnaSubmitted ? `<div class="msg ok">${icon('check', 16)}<div>${esc(L('أُرسل تقييم احتياجاتك لمديرك والموارد البشرية.', 'Your needs assessment was sent to your manager and HR.'))}<div class="chip-row" style="margin-top:6px">${MYL.tna.map((k) => badge('b-brand', L(...NEEDS.find((n) => n[0] === k).slice(1)))).join('')}</div></div></div>` : `<p class="subtle" style="margin:0 0 8px">${esc(L('اختر حتى 3 مجالات.', 'Choose up to 3 areas.'))}</p><div class="checklist">${NEEDS.map(([k, ar, en]) => `<label class="check-item"><input type="checkbox" class="cbx" data-tna="${k}" ${MYL.tna.includes(k) ? 'checked' : ''} ${!MYL.tna.includes(k) && MYL.tna.length >= 3 ? 'disabled' : ''}><div class="grow">${esc(L(ar, en))}</div></label>`).join('')}</div><button class="btn primary" style="margin-top:8px" data-act="tna-submit" ${MYL.tna.length ? '' : 'disabled'}>${esc(L('إرسال', 'Submit'))}</button>`}</section>
      </div>
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('الدورات المتاحة', 'Course catalog'))}</h2><span class="subtle">${esc(L(`إجازة التدريب الخارجي المتبقية: ${5 - MYL.extDaysUsed} أيام`, `External training leave left: ${5 - MYL.extDaysUsed} days`))} ${rule('LD-020')}</span></div>${table([L('الدورة', 'Course'), L('النوع', 'Type'), L('الموعد', 'Date'), L('الساعات', 'Hours'), L('المقاعد', 'Seats'), ''], COURSES.filter((c) => c.type !== 'MANDATORY').map((c) => { const mine = MYL.enrolled.includes(c.id); const full = c.enrolled >= c.seats; return `<tr><td>${esc(L(c.ar, c.en))}</td><td>${badge('b-neutral', c.mode === 'ELEARN' ? L('إلكتروني', 'E-learning') : L('حضوري', 'Classroom'))}</td><td>${esc(fmtD(c.date))}</td><td class="num">${c.hours}</td><td class="num">${c.enrolled}/${c.seats}</td><td style="text-align:end">${mine ? badge('b-ok', L('مسجّل', 'Enrolled'), 'check') : `<button class="btn sm" data-act="lrn-enrol" data-id="${c.id}" ${full ? 'disabled' : ''}>${esc(full ? L('ممتلئة', 'Full') : L('تسجيل', 'Enrol'))}</button>`}</td></tr>`; }))}</section>`;
  }
  function vHrLearning() {
    const top = NEEDS.map(([k, ar, en]) => ({ label: L(ar, en), value: TNA[k] + (MYL.tna.includes(k) && MYL.tnaSubmitted ? 1 : 0) })).sort((a, b) => b.value - a.value);
    return `${pageHead(L('التعلّم والتطوير', 'Learning & development'), esc(L('الجلسات والتسجيل، واحتياجات التدريب المجمّعة من تقييمات الموظفين.', 'Sessions and enrolment, and training needs consolidated from staff assessments.')) + ' ' + rule('LD-001'), `<button class="btn primary" data-act="toast" data-msg="${esc(L('أُضيفت جلسة جديدة وأُرسلت الدعوات عبر Outlook (محاكاة).', 'New session added; invitations sent via Outlook (simulated).'))}">${icon('plus', 16)}${esc(L('جلسة جديدة', 'New session'))}</button>`)}
      <div class="grid g-21">
        <section class="card flush">${table([L('الدورة', 'Course'), L('النوع', 'Type'), L('الموعد', 'Date'), L('الإشغال', 'Fill'), ''], COURSES.map((c) => `<tr><td>${esc(L(c.ar, c.en))}</td><td>${badge(c.type === 'MANDATORY' ? 'b-warn' : 'b-neutral', c.type === 'MANDATORY' ? L('إلزامي', 'Mandatory') : L('اختياري', 'Optional'))}</td><td>${esc(fmtD(c.date))}</td><td style="min-width:140px">${meter((c.enrolled / c.seats) * 100, c.enrolled >= c.seats ? 'warn' : '')}<span class="subtle num">${c.enrolled}/${c.seats}</span></td><td style="text-align:end"><button class="btn sm" data-act="toast" data-msg="${esc(L('أُرسلت قائمة الحضور إلى المدرّب.', 'Attendance sheet sent to the trainer.'))}">${esc(L('قائمة الحضور', 'Attendance sheet'))}</button></td></tr>`))}</section>
        <section class="card"><h2>${esc(L('أعلى الاحتياجات التدريبية', 'Top training needs'))} ${rule('LD-001')}</h2>${bars(top, { title: L('الاحتياجات', 'Needs') })}</section>
      </div>`;
  }

  // ---------- Registration ----------
  addNav('EMPLOYEE', 'growth', ['التطوير', 'Growth'], { v: 'performance', ic: 'flag', ar: 'أدائي', en: 'My performance' }, 3);
  addNav('EMPLOYEE', 'growth', ['التطوير', 'Growth'], { v: 'learning', ic: 'brief', ar: 'تعلّمي', en: 'My learning' });
  Object.assign(VIEWS.EMPLOYEE, { performance: vEmpPerf, learning: vEmpLearning });
  addNav('MANAGER', 'overview', ['نظرة عامة', 'Overview'], { v: 'performance', ic: 'flag', ar: 'أداء الفريق', en: 'Team performance' });
  VIEWS.MANAGER.performance = vMgrPerf;
  addNav('HR', 'talent', ['المواهب', 'Talent'], { v: 'performance', ic: 'flag', ar: 'إدارة الأداء', en: 'Performance' });
  addNav('HR', 'talent', ['المواهب', 'Talent'], { v: 'learning', ic: 'brief', ar: 'التعلّم والتطوير', en: 'Learning' });
  Object.assign(VIEWS.HR, { performance: vHrPerf, learning: vHrLearning });
  EXT.mgrPending.push(() => { const ids = new Set(H.team().map((e) => e.id)); return APPR.filter((a) => ids.has(a.empId) && a.stage === 'MANAGER').length; });
  EXT.empFooter.push((e) => (['HR', 'MANAGER'].includes(S.role) && !PIPS.some((p) => p.empId === e.id && p.status === 'ACTIVE') ? `<button class="btn" data-act="pip-new" data-id="${e.id}">${esc(L('خطة تحسين أداء', 'Improvement plan'))}</button>` : ''));
  EXT.empSections.push((e) => { const a = APPR.find((x) => x.empId === e.id && x.stage !== 'DONE'); return a ? `<div><p class="section-title">${esc(L('التقييم الجاري', 'Appraisal in progress'))}</p>${miniSteps(a.stage)}</div>` : ''; });
  EXT.homeBanners.push(() => { const a = APPR.find((x) => x.empId === me().id && x.stage === 'SELF'); return a ? `<div class="banner info"><span class="bi">${icon('flag', 18)}</span><div class="grow"><b>${esc(L('تقييمك السنوي مفتوح: ابدأ بالتقييم الذاتي', 'Your annual appraisal is open: start your self-assessment'))}</b><div class="subtle">${esc(L('مستحق', 'Due'))} ${esc(fmtD(a.due))} ${rule('PF-001')}</div></div><button class="btn sm primary" data-act="nav" data-v="performance">${esc(L('ابدأ', 'Start'))}</button></div>` : ''; });

  const advance = (a, to) => { a.stage = to; if (to === 'DONE') { const e = empById.get(a.empId); e.rating = ratingOf(avg(Object.keys(a.mgr).length ? a.mgr : a.self)); } };
  Object.assign(EXT.actions, {
    rate: (t) => { const a = APPR.find((x) => x.id === t.dataset.id); a[t.dataset.w][t.dataset.k] = Number(t.dataset.v); render(); },
    'appr-open': (t) => openOverlay({ type: 'appr', id: t.dataset.id }),
    'appr-submit-self': (t) => { const a = APPR.find((x) => x.id === t.dataset.id); advance(a, 'MANAGER'); addActivity('MANAGER', 'teams', `أرسلت ${me().name.ar} تقييمها الذاتي`, `${me().name.en} submitted her self-assessment`, 'performance'); audit(`تقييم ذاتي ${a.id}`, `Self-assessment ${a.id} submitted`); render(); toast(L('أُرسل التقييم لمديرك.', 'Sent to your manager.'), 'ok'); },
    'appr-submit-mgr': (t) => { const a = APPR.find((x) => x.id === t.dataset.id); advance(a, 'SECOND'); audit(`تقييم المدير ${a.id}`, `Manager appraisal ${a.id} submitted`); if (a.rec === 'PIP') { const e = empById.get(a.empId); PIPS.unshift({ id: `PIP-${5001 + PIPS.length}`, empId: e.id, start: D.todayISO, end: iso(addDays(TODAY, (D.POLICY.pipWeeks || 4) * 7)), goals: a.comments.mgr || L('أهداف تحسين محددة', 'Specific improvement goals'), status: 'ACTIVE' }); } S.overlay = null; render(); toast(L('أُرسل للمشرف الثاني للمصادقة.', 'Sent to the second line for countersignature.'), 'ok'); },
    'appr-advance': (t) => { const a = APPR.find((x) => x.id === t.dataset.id); const nx = STAGES[stageIdx(a.stage) + 1][0]; advance(a, nx); audit(`تقدّم تقييم ${a.id} إلى ${nx}`, `Appraisal ${a.id} moved to ${nx}`); render(); toast(nx === 'DONE' ? L('اكتمل التقييم وحُدّث تقييم الموظف.', 'Appraisal complete; employee rating updated.') : L('انتقل التقييم للمرحلة التالية.', 'Moved to the next stage.'), 'ok'); },
    'appraisal-start': (t) => { const e = empById.get(t.dataset.id); if (APPR.some((a) => a.empId === e.id && a.stage !== 'DONE')) { toast(L('يوجد تقييم مفتوح لهذا الموظف.', 'An appraisal is already open for this employee.'), 'bad'); return; } APPR.unshift({ id: `APR-${3001 + APPR.length}`, empId: e.id, kind: t.dataset.kind || 'ANNUAL', due: e.probationEnd || iso(addDays(TODAY, 14)), stage: 'MANAGER', self: {}, mgr: {}, rec: '', comments: {} }); addActivity('MANAGER', 'teams', `تقييم تجربة مطلوب: ${e.name.ar}`, `Probation appraisal requested: ${e.name.en}`, 'performance'); audit(`فتح تقييم تجربة ${e.id}`, `Probation appraisal opened for ${e.id}`); render(); toast(L(`أُرسل تقييم التجربة إلى مدير ${T(e.name.short)} عبر Teams.`, `Probation appraisal sent to ${T(e.name.short)}'s manager in Teams.`), 'ok'); },
    'obj-checkin': (t) => { const o = OBJ.find((x) => x.id === t.dataset.id); o.checkins.push({ date: D.todayISO, progress: o.progress }); audit(`متابعة هدف ${o.id}: ${o.progress}%`, `Objective ${o.id} check-in: ${o.progress}%`); render(); toast(L('حُفظت المتابعة وأُبلغ مديرك.', 'Check-in saved; your manager was notified.'), 'ok'); },
    'pip-new': (t) => { const e = empById.get(t.dataset.id); PIPS.unshift({ id: `PIP-${5001 + PIPS.length}`, empId: e.id, start: D.todayISO, end: iso(addDays(TODAY, (D.POLICY.pipWeeks || 4) * 7)), goals: { ar: 'أهداف تحسين محددة وقابلة للقياس', en: 'Specific, measurable improvement goals' }, status: 'ACTIVE' }); audit(`بدء خطة تحسين ${e.id}`, `Improvement plan started for ${e.id}`); S.overlay = null; render(); toast(L('بدأت خطة تحسين لمدة 4 أسابيع وأُبلغت الموارد البشرية.', '4-week improvement plan started; HR notified.'), 'ok'); },
    'pip-close': (t) => { const p = PIPS.find((x) => x.id === t.dataset.id); p.status = t.dataset.v; audit(`إغلاق خطة تحسين ${p.id}: ${p.status}`, `Improvement plan ${p.id}: ${p.status}`); if (p.status === 'ESCALATED' && EXT.actions['case-from']) EXT.actions['case-from']({ dataset: { kind: 'CONDUCT', id: p.empId, src: 'PIP' } }); else render(); },
    'lrn-complete': (t) => { const e = me(); e.trainingsDone = [...new Set([...e.trainingsDone, t.dataset.v])]; audit(`إكمال تدريب ${t.dataset.v}`, `Training ${t.dataset.v} completed`); render(); toast(L('اكتمل التدريب وأُصدرت الشهادة.', 'Training completed; certificate issued.'), 'ok'); },
    'lrn-enrol': (t) => { const c = COURSES.find((x) => x.id === t.dataset.id); c.enrolled += 1; MYL.enrolled.push(c.id); render(); toast(L('سُجّلت، وأُضيف الموعد إلى تقويم Outlook.', 'Enrolled; the session was added to your Outlook calendar.'), 'ok'); },
    'tna-submit': () => { MYL.tnaSubmitted = true; audit('إرسال تقييم الاحتياجات التدريبية', 'Training needs assessment submitted'); render(); toast(L('أُرسل تقييم الاحتياجات.', 'Needs assessment submitted.'), 'ok'); }
  });
  EXT.onInput.push((t) => {
    if (t.dataset.objp) { const o = OBJ.find((x) => x.id === t.dataset.objp); o.progress = Number(t.value); const v = document.getElementById(`objv-${o.id}`); if (v) v.textContent = `${o.progress}%`; return true; }
    if (t.dataset.apc) { const a = APPR.find((x) => x.id === t.dataset.apc); a.comments[t.dataset.w] = t.value; return true; }
    return false;
  });
  EXT.onChange.push((t) => {
    if (t.dataset.aprec) { const a = APPR.find((x) => x.id === t.dataset.aprec); a.rec = t.value; render(); return true; }
    if (t.dataset.tna) { const k = t.dataset.tna; MYL.tna = t.checked ? [...new Set([...MYL.tna, k])].slice(0, 3) : MYL.tna.filter((x) => x !== k); render(); return true; }
    if (t.dataset.objp || t.dataset.apc) return true;
    return false;
  });
})();
