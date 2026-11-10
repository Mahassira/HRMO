/* HRMO module — Duty of care: staff safety check-ins, wellbeing & R&R, hardship allowance,
 * professional licences, daily attendance. Rules: DC-001..006, WB-001..005, LI-001..004, WT-010..015. */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, VIEWS, L, T, esc, icon, fmtN, fmtD, money, parse, iso, addDays, daysBetween, TODAY, badge, rule, who, toast, addActivity, emptyState, empById, persona, me, balances, render, openOverlay, pageHead, table, store, addNav, audit, modal, officeName, serviceMonths, isWorkDay, kpi, meter, bars, acard } = H;
  const active = () => D.employees;

  // =====================================================================
  // Staff safety check-in (duty of care)
  // =====================================================================
  const SAFETY = store('safety', () => {
    const r = H.rng(11); const past = { id: 'SC-1001', at: iso(addDays(TODAY, -9)), scope: 'ALL', msg: { ar: 'غارات قرب المكتب الشمالي. هل أنت بأمان؟', en: 'Air strikes near the North office. Are you safe?' }, channels: ['TEAMS', 'SMS'], responses: {}, closed: true };
    active().forEach((e) => { const x = r(); past.responses[e.id] = x < 0.96 ? 'SAFE' : x < 0.975 ? 'HELP' : undefined; if (!past.responses[e.id]) delete past.responses[e.id]; });
    return [past];
  });
  const current = () => SAFETY.find((c) => !c.closed);
  const inScope = (c, e) => c.scope === 'ALL' || c.scope === e.office;
  function stats(c) {
    const list = active().filter((e) => inScope(c, e));
    const safe = list.filter((e) => c.responses[e.id] === 'SAFE').length; const help = list.filter((e) => c.responses[e.id] === 'HELP').length;
    return { total: list.length, safe, help, none: list.length - safe - help, list };
  }
  function vSafety() {
    const c = current(); const last = SAFETY.filter((x) => x.closed).slice(-1)[0];
    const board = (x) => { const byOff = D.OFFICES.filter((o) => x.scope === 'ALL' || x.scope === o.id).map((o) => { const l = active().filter((e) => e.office === o.id); const sf = l.filter((e) => x.responses[e.id] === 'SAFE').length; const hp = l.filter((e) => x.responses[e.id] === 'HELP').length; return `<tr><td>${esc(T(o))} ${badge('b-neutral', L(`مستوى ${o.hardship}`, `Level ${o.hardship}`))}</td><td class="num">${l.length}</td><td class="num">${sf}</td><td class="num">${hp ? `<b style="color:var(--danger-text)">${hp}</b>` : 0}</td><td class="num">${l.length - sf - hp}</td><td style="min-width:140px">${meter(((sf + hp) / l.length) * 100, (sf + hp) / l.length > 0.9 ? 'ok' : 'warn')}</td></tr>`; });
      return table([L('المكتب', 'Office'), L('الموظفون', 'Staff'), L('بأمان', 'Safe'), L('يحتاج مساعدة', 'Need help'), L('لم يرد', 'No response'), L('نسبة الاستجابة', 'Response rate')], byOff); };
    let body;
    if (c) {
      const s = stats(c); const helpers = s.list.filter((e) => c.responses[e.id] === 'HELP');
      body = `<div class="banner danger"><span class="bi">${icon('warn', 18)}</span><div class="grow"><b>${esc(L('تسجيل اطمئنان نشط', 'Safety check-in in progress'))} · <bdi>${esc(c.id)}</bdi></b><div class="subtle">${esc(T(c.msg))} · ${esc(c.scope === 'ALL' ? L('كل المكاتب', 'All offices') : officeName(c.scope))}</div></div><div class="btn-row"><button class="btn sm" data-act="safety-sim">${esc(L('محاكاة ردود إضافية', 'Simulate more replies'))}</button><button class="btn sm" data-act="safety-preview">${icon('teams', 14)}${esc(L('البطاقة المرسلة', 'Sent card'))}</button><button class="btn sm danger" data-act="safety-close">${esc(L('إنهاء', 'Close'))}</button></div></div>
        <div class="grid g-4 keep2">${kpi(L('ضمن النطاق', 'In scope'), fmtN(s.total), '', 'people')}${kpi(L('بأمان', 'Safe'), fmtN(s.safe), `${fmtN((s.safe / s.total) * 100, 0)}%`, 'check')}${kpi(L('يحتاجون مساعدة', 'Need help'), fmtN(s.help), rule('DC-003'), 'warn')}${kpi(L('لم يردّوا بعد', 'No response yet'), fmtN(s.none), L(`تصعيد تلقائي بعد ${D.POLICY.care.safetyEscalateMinutes} دقيقة`, `Auto-escalates after ${D.POLICY.care.safetyEscalateMinutes} min`), 'clock')}</div>
        ${helpers.length ? `<section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section);color:var(--danger-text)">${esc(L('يحتاجون مساعدة الآن', 'Need help now'))}</h2>${rule('DC-003')}</div>${table([L('الموظف', 'Employee'), L('المكتب', 'Office'), L('الهاتف', 'Phone'), ''], helpers.map((e) => `<tr><td>${who(e, T(e.position))}</td><td>${esc(officeName(e.office))}</td><td class="num" style="direction:ltr;text-align:start">${esc(e.phone)}</td><td style="text-align:end"><div class="btn-row" style="justify-content:flex-end"><button class="btn sm" data-act="toast" data-msg="${esc(L('أُحيلت الحالة إلى مسؤول الأمن.', 'Escalated to the security focal point.'))}">${esc(L('إحالة للأمن', 'Escalate to security'))}</button><button class="btn sm primary" data-act="safety-ok" data-id="${e.id}">${esc(L('تم التواصل وهو بأمان', 'Contacted, now safe'))}</button></div></td></tr>`))}</section>` : ''}
        <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('الحالة حسب المكتب', 'Status by office'))}</h2></div>${board(c)}</section>`;
    } else {
      body = `<div class="banner ok"><span class="bi">${icon('shield', 18)}</span><div class="grow"><b>${esc(L('لا يوجد تسجيل اطمئنان نشط', 'No active safety check-in'))}</b><div class="subtle">${esc(L('أطلق تسجيلاً فور أي حادث أمني، وسيصل لكل موظف عبر Teams والرسائل النصية.', 'Launch one after any security incident; every employee receives it in Teams and by SMS.'))} ${rule('DC-001')}</div></div><button class="btn primary" data-act="safety-new">${icon('send', 16)}${esc(L('إطلاق تسجيل اطمئنان', 'Launch safety check-in'))}</button></div>
        ${last ? `<section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('آخر تسجيل', 'Last check-in'))} · ${esc(fmtD(last.at))}</h2><span class="subtle">${esc(T(last.msg))}</span></div>${board(last)}</section>` : ''}`;
    }
    const loc = D.OFFICES.map((o) => ({ label: T(o), value: active().filter((e) => e.office === o.id).length, tip: L(`مستوى المشقة ${o.hardship}`, `Hardship level ${o.hardship}`) }));
    return `${pageHead(L('سلامة الموظفين', 'Staff safety'), esc(L('واجب الرعاية: معرفة أن كل موظف بخير خلال دقائق من أي حادث.', 'Duty of care: know every staff member is OK within minutes of an incident.')) + ' ' + rule('DC-001'), c ? '' : `<button class="btn primary" data-act="safety-new">${icon('send', 16)}${esc(L('إطلاق تسجيل اطمئنان', 'Launch safety check-in'))}</button>`)}
      ${body}
      <div class="grid g-2"><section class="card"><h2>${esc(L('توزّع الموظفين حسب الموقع', 'Staff by location'))}</h2>${bars(loc, { title: L('حسب الموقع', 'By location') })}</section>
      <section class="card"><h2>${esc(L('جاهزية بيانات الطوارئ', 'Emergency data readiness'))}</h2><div class="stat-list"><div class="row"><span>${esc(L('جهة اتصال للطوارئ مسجّلة', 'Emergency contact on file'))} ${rule('DC-004')}</span><b>${fmtN(active().length - 23)}/${fmtN(active().length)}</b></div><div class="row"><span>${esc(L('رقم هاتف محدّث خلال 12 شهراً', 'Phone verified within 12 months'))}</span><b>${fmtN(active().length - 61)}/${fmtN(active().length)}</b></div><div class="row"><span>${esc(L('مسؤولو الأمن في المكاتب', 'Security focal points per office'))}</span><b>${D.OFFICES.length}/${D.OFFICES.length}</b></div></div></section></div>`;
  }
  S.safetyDraft = S.safetyDraft || { scope: 'ALL', msg: '', ch: ['TEAMS', 'SMS', 'OUTLOOK'] };
  EXT.overlays['safety-new'] = () => modal(L('إطلاق تسجيل اطمئنان', 'Launch safety check-in'), `<div class="form-grid"><div class="field full"><label for="sf-s">${esc(L('النطاق', 'Scope'))}</label><select id="sf-s" class="select" data-sfd="scope"><option value="ALL">${esc(L('كل المكاتب', 'All offices'))}</option>${D.OFFICES.map((o) => `<option value="${o.id}" ${S.safetyDraft.scope === o.id ? 'selected' : ''}>${esc(T(o))}</option>`).join('')}</select></div><div class="field full"><label for="sf-m">${esc(L('الرسالة', 'Message'))}</label><textarea id="sf-m" class="textarea" data-sfd="msg" placeholder="${esc(L('مثال: انفجار قرب المكتب. هل أنت بأمان؟', 'e.g. Explosion near the office. Are you safe?'))}">${esc(S.safetyDraft.msg)}</textarea></div><div class="field full"><span class="flabel">${esc(L('القنوات', 'Channels'))}</span><div class="radio-group">${[['TEAMS', 'Teams'], ['SMS', 'SMS'], ['OUTLOOK', 'Outlook']].map(([k, l]) => `<label class="radio"><input type="checkbox" class="cbx" data-sfch="${k}" ${S.safetyDraft.ch.includes(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div></div><div class="msg info">${icon('info', 16)}<div>${esc(L('يرد الموظف بضغطة: "أنا بأمان" أو "أحتاج مساعدة". من لا يرد خلال المدة المحددة يُصعَّد لمسؤول الأمن.', 'Staff reply with one tap: "I\'m safe" or "I need help". Non-responders are escalated to the security focal point.'))} ${rule('DC-002')}</div></div>`,
    `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn danger-solid" data-act="safety-launch">${icon('send', 16)}${esc(L('إرسال الآن', 'Send now'))}</button>`);
  EXT.overlays['safety-preview'] = () => { const c = current(); const card = acard(L('تسجيل اطمئنان', 'Safety check-in'), [[L('الرسالة', 'Message'), T(c.msg)], [L('النطاق', 'Scope'), c.scope === 'ALL' ? L('كل المكاتب', 'All offices') : officeName(c.scope)]], `<button class="btn primary sm">${esc(L('أنا بأمان', 'I\'m safe'))}</button><button class="btn sm danger">${esc(L('أحتاج مساعدة', 'I need help'))}</button>`, rule('DC-002')); return modal(L('البطاقة كما تصل للموظفين', 'The card as staff receive it'), H.channelPreview('safety', 'HR', L('كل الموظفين', 'All staff'), L('تسجيل اطمئنان عاجل', 'Urgent safety check-in'), card)); };
  EXT.homeBanners.push(() => {
    const c = current(); const e = me(); if (!c || !inScope(c, e)) return '';
    const r = c.responses[e.id];
    if (r) return `<div class="banner ok"><span class="bi">${icon('check', 18)}</span><div class="grow"><b>${esc(r === 'SAFE' ? L('شكراً، سُجّل أنك بأمان.', 'Thanks, you are marked safe.') : L('وصل طلبك للمساعدة، وسيتواصل معك مسؤول الأمن.', 'Help request received; the security focal point will contact you.'))}</b></div></div>`;
    return `<div class="banner danger"><span class="bi">${icon('warn', 18)}</span><div class="grow"><b>${esc(L('تسجيل اطمئنان: هل أنت بأمان؟', 'Safety check-in: are you safe?'))}</b><div class="subtle">${esc(T(c.msg))}</div></div><div class="btn-row"><button class="btn primary" data-act="safety-reply" data-v="SAFE">${icon('check', 16)}${esc(L('أنا بأمان', 'I\'m safe'))}</button><button class="btn danger" data-act="safety-reply" data-v="HELP">${esc(L('أحتاج مساعدة', 'I need help'))}</button></div></div>`;
  });

  // =====================================================================
  // Wellbeing, R&R and hardship allowance
  // =====================================================================
  const RR = store('rr', () => { const r = H.rng(5); const m = {}; active().forEach((e) => { m[e.id] = iso(addDays(TODAY, -Math.floor(r() * 90))); }); return m; });
  const SUPPORT = store('supportRequests', () => 7);
  const rrDue = (e) => { const o = D.OFFICES.find((x) => x.id === e.office); if (!o || o.hardship !== 'C' || e.category !== 'REGULAR') return null; const next = addDays(parse(RR[e.id]), D.POLICY.care.rrEveryWeeks * 7); return iso(next); };
  const noLeave = () => active().filter((e) => e.category === 'REGULAR' && serviceMonths(e) >= D.POLICY.care.burnoutNoLeaveMonths && balances(e).annual.taken === 0);
  function vWellbeing() {
    const due = active().filter((e) => { const d = rrDue(e); return d && d <= iso(addDays(TODAY, 14)); }).sort((a, b) => (rrDue(a) > rrDue(b) ? 1 : -1));
    const nl = noLeave();
    const hard = ['A', 'B', 'C'].map((lv) => { const l = active().filter((e) => (D.OFFICES.find((o) => o.id === e.office) || {}).hardship === lv && e.category === 'REGULAR'); const pct = D.POLICY.care.hardship[lv] || 0; return { lv, n: l.length, pct, cost: l.reduce((s, e) => s + e.baseSalary * pct / 100, 0) }; });
    return `${pageHead(L('الرفاه والرعاية', 'Wellbeing & care'), esc(L('الراحة والتعافي، ومتابعة الإرهاق، وبدل المشقة، والدعم النفسي السري.', 'Rest & recuperation, burnout watch, hardship allowance and confidential psychosocial support.')) + ' ' + rule('WB-001'))}
      <div class="grid g-4 keep2">${kpi(L('راحة وتعافٍ مستحقة خلال 14 يوماً', 'R&R due within 14 days'), fmtN(due.length), rule('WB-002'), 'cal')}${kpi(L('بلا إجازة منذ 6 أشهر+', 'No leave in 6+ months'), fmtN(nl.length), rule('WB-003'), 'warn')}${kpi(L('طلبات دعم نفسي (مجهولة)', 'Support requests (anonymous)'), fmtN(EXT.state.supportRequests || 0), rule('WB-004'), 'shield')}${kpi(L('كلفة بدل المشقة الشهرية', 'Monthly hardship allowance'), money(hard.reduce((s, h) => s + h.cost, 0)), rule('WB-005'), 'money')}</div>
      <div class="grid g-2">
        <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('الراحة والتعافي المستحقة', 'R&R due'))}</h2><span class="subtle">${esc(L(`كل ${D.POLICY.care.rrEveryWeeks} أسابيع في مواقع المستوى C · ${D.POLICY.care.rrDays} أيام`, `Every ${D.POLICY.care.rrEveryWeeks} weeks at level-C sites · ${D.POLICY.care.rrDays} days`))}</span></div>${table([L('الموظف', 'Employee'), L('المكتب', 'Office'), L('آخر راحة', 'Last R&R'), L('المستحقة', 'Due'), ''], due.slice(0, 12).map((e) => `<tr><td>${who(e, T(e.position))}</td><td>${esc(officeName(e.office))}</td><td>${esc(fmtD(RR[e.id]))}</td><td>${rrDue(e) < D.todayISO ? badge('b-bad', L('متأخرة', 'Overdue')) : esc(fmtD(rrDue(e)))}</td><td style="text-align:end"><button class="btn sm" data-act="rr-schedule" data-id="${e.id}">${esc(L('جدولة', 'Schedule'))}</button></td></tr>`), emptyState('check', L('لا توجد راحة مستحقة', 'No R&R due')))}</section>
        <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('مراقبة الإرهاق', 'Burnout watch'))}</h2>${rule('WB-003')}</div>${table([L('الموظف', 'Employee'), L('الرصيد السنوي', 'Annual bal.'), L('المدير', 'Manager'), ''], nl.slice(0, 12).map((e) => `<tr><td>${who(e, T(e.position))}</td><td class="num">${fmtN(balances(e).annual.available, 1)}</td><td>${esc(T((empById.get(e.managerId) || e).name.short))}</td><td style="text-align:end"><button class="btn sm" data-act="toast" data-msg="${esc(L('أُرسل تنبيه لطيف للموظف ومديره عبر Teams.', 'A gentle nudge was sent to the employee and manager in Teams.'))}">${icon('teams', 14)}${esc(L('تذكير', 'Nudge'))}</button></td></tr>`), emptyState('check', L('لا يوجد', 'None')))}</section>
      </div>
      <section class="card"><h2>${esc(L('بدل المشقة حسب مستوى الموقع', 'Hardship allowance by site level'))} ${rule('WB-005')}</h2>${table([L('المستوى', 'Level'), L('المكاتب', 'Offices'), L('الموظفون الدائمون', 'Regular staff'), L('النسبة', 'Rate'), L('الكلفة الشهرية', 'Monthly cost')], hard.map((h) => `<tr><td>${badge('b-neutral', h.lv)}</td><td>${esc(D.OFFICES.filter((o) => o.hardship === h.lv).map((o) => T(o)).join('، ') || '—')}</td><td class="num">${fmtN(h.n)}</td><td class="num">${h.pct}%</td><td class="num">${money(h.cost)}</td></tr>`))}<p class="subtle" style="margin:8px 0 0">${esc(L('المستويات والنسب قابلة للتعديل من إعدادات السياسات، وتتغير بقرار مؤرخ عند تغيّر الوضع الأمني.', 'Levels and rates are editable in policy settings and change by dated decision when security conditions change.'))}</p></section>`;
  }
  function vEmpWellbeing() {
    const e = me(); const due = rrDue(e); const b = balances(e);
    return `${pageHead(L('رفاهي', 'My wellbeing'), esc(L('رعايتك جزء من عملنا. ما تطلبه هنا سري.', 'Your care is part of our work. What you ask here is confidential.')))}
      <div class="grid g-3">${kpi(L('رصيدك السنوي', 'Your annual balance'), fmtN(b.annual.available, 1), b.annual.taken === 0 ? L('لم تأخذ إجازة هذا العام', 'No leave taken this year') : '', 'cal', 'leave')}${kpi(L('الراحة والتعافي', 'R&R'), due ? esc(fmtD(due)) : '—', due ? rule('WB-002') : L('غير مطبّق على موقعك', 'Not applicable at your site'), 'clock')}${kpi(L('مستوى المشقة في موقعك', 'Hardship level at your site'), (D.OFFICES.find((o) => o.id === e.office) || {}).hardship || '—', `${D.POLICY.care.hardship[(D.OFFICES.find((o) => o.id === e.office) || {}).hardship] || 0}% ${L('بدل', 'allowance')}`, 'shield')}</div>
      <section class="card"><h2>${icon('shield')} ${esc(L('دعم نفسي سري', 'Confidential psychosocial support'))}</h2><p class="muted" style="margin:0 0 12px">${esc(L('يمكنك طلب جلسة مع مختص دعم نفسي للموظفين. يصل طلبك لمسؤول رعاية الموظفين فقط، ولا يظهر لمديرك أو لقسم الموارد البشرية، ولا يُحفظ في ملفك.', 'You can request a session with a staff counsellor. Your request goes only to the staff-care focal point; it is not visible to your manager or HR and is not stored in your file.'))} ${rule('WB-004')}</p><button class="btn primary" data-act="support-request">${esc(L('طلب جلسة دعم سرية', 'Request a confidential session'))}</button></section>`;
  }

  // =====================================================================
  // Professional licences
  // =====================================================================
  const LIC_TYPES = { 'General Practitioner': ['ترخيص مزاولة الطب', 'Medical practice licence'], Nurse: ['ترخيص التمريض', 'Nursing licence'], Midwife: ['ترخيص القبالة', 'Midwifery licence'], Pharmacist: ['ترخيص الصيدلة', 'Pharmacy licence'], 'Lab Technician': ['ترخيص المختبرات', 'Laboratory licence'], Psychologist: ['ترخيص الممارسة النفسية', 'Psychology practice licence'], Driver: ['رخصة قيادة مهنية', 'Professional driving licence'] };
  const LICS = store('licences', () => { const r = H.rng(19); return active().filter((e) => LIC_TYPES[e.position.en]).map((e, i) => ({ id: `LIC-${2000 + i}`, empId: e.id, type: e.position.en, number: `${['MP', 'NR', 'MW', 'PH', 'LB', 'PS', 'DR'][Object.keys(LIC_TYPES).indexOf(e.position.en)]}-${10000 + Math.floor(r() * 89999)}`, expiry: iso(addDays(TODAY, Math.floor(r() * 760) - 40)) })); });
  const licStatus = (l) => { const d = daysBetween(D.todayISO, l.expiry); return d < 0 ? 'EXPIRED' : d <= D.POLICY.licenses.alertDays ? 'EXPIRING' : 'VALID'; };
  S.licF = S.licF || 'ATTN';
  function vLicences() {
    const exp = LICS.filter((l) => licStatus(l) === 'EXPIRED'); const soon = LICS.filter((l) => licStatus(l) === 'EXPIRING');
    const list = (S.licF === 'ATTN' ? [...exp, ...soon] : LICS).slice().sort((a, b) => (a.expiry > b.expiry ? 1 : -1));
    const st = { EXPIRED: ['b-bad', L('منتهٍ: غير مصرّح بالممارسة', 'Expired: not cleared to practise')], EXPIRING: ['b-warn', L('ينتهي قريباً', 'Expiring soon')], VALID: ['b-ok', L('ساري', 'Valid')] };
    return `${pageHead(L('التراخيص المهنية', 'Professional licences'), esc(L('ترخيص منتهٍ لطبيب أو ممرض أو سائق مخاطرة قانونية وطبية. ينبّه النظام قبل الانتهاء ويوقف الإسناد بعده.', 'An expired licence for a doctor, nurse or driver is a legal and clinical risk. The system alerts before expiry and flags assignment after it.')) + ' ' + rule('LI-001'))}
      <div class="grid g-3">${kpi(L('تراخيص متابَعة', 'Licences tracked'), fmtN(LICS.length), '', 'doc')}${kpi(L('منتهية', 'Expired'), fmtN(exp.length), rule('LI-003'), 'warn')}${kpi(L(`تنتهي خلال ${D.POLICY.licenses.alertDays} يوماً`, `Expiring within ${D.POLICY.licenses.alertDays} days`), fmtN(soon.length), rule('LI-002'), 'clock')}</div>
      <section class="card flush"><div class="table-toolbar"><div class="seg">${[['ATTN', 'بحاجة لإجراء', 'Needs action'], ['ALL', 'الكل', 'All']].map(([k, ar, en]) => `<button aria-pressed="${S.licF === k}" data-act="lic-f" data-v="${k}">${esc(L(ar, en))}</button>`).join('')}</div>${S.licF === 'ATTN' && list.length ? `<button class="btn sm secondary" data-act="lic-remind-all">${icon('teams', 14)}${esc(L('تذكير الجميع', 'Remind all'))}</button>` : ''}</div>
        ${table([L('الموظف', 'Employee'), L('الترخيص', 'Licence'), L('الرقم', 'Number'), L('الانتهاء', 'Expiry'), L('الحالة', 'Status'), ''], list.slice(0, 60).map((l) => { const e = empById.get(l.empId); const s = licStatus(l); return `<tr><td>${who(e, officeName(e.office))}</td><td>${esc(L(...LIC_TYPES[l.type]))}</td><td class="num"><bdi>${esc(l.number)}</bdi></td><td>${esc(fmtD(l.expiry))}</td><td>${badge(st[s][0], st[s][1])}</td><td style="text-align:end">${s !== 'VALID' ? `<button class="btn sm" data-act="lic-renew" data-id="${l.id}">${esc(L('تسجيل التجديد', 'Record renewal'))}</button>` : ''}</td></tr>`; }), emptyState('check', L('كل التراخيص سارية', 'All licences are valid')))}</section>`;
  }
  EXT.empSections.push((e) => { const l = LICS.find((x) => x.empId === e.id); if (!l) return ''; const s = licStatus(l); return `<div><p class="section-title">${esc(L('الترخيص المهني', 'Professional licence'))} ${rule('LI-001')}</p><div class="btn-row">${badge(s === 'VALID' ? 'b-ok' : s === 'EXPIRING' ? 'b-warn' : 'b-bad', `${L(...LIC_TYPES[l.type])} · ${fmtD(l.expiry)}`)}</div></div>`; });

  // =====================================================================
  // Attendance capture (employee) and daily board (HR)
  // =====================================================================
  const ATT = store('attendance', () => ({ day: D.todayISO, in: null, out: null, queue: [] }));
  if (ATT.day !== D.todayISO) Object.assign(ATT, { day: D.todayISO, in: null, out: null, queue: [] });
  S.offline = S.offline || false;
  EXT.homeBanners.push(() => {
    if (!isWorkDay(TODAY)) return '';
    const t = (x) => (x ? new Date(x).toLocaleTimeString(S.lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—');
    return `<div class="banner info"><span class="bi">${icon('clock', 18)}</span><div class="grow"><b>${esc(L('الحضور اليوم', 'Today\'s attendance'))}</b><div class="subtle">${esc(L('دخول', 'In'))}: ${esc(t(ATT.in))} · ${esc(L('خروج', 'Out'))}: ${esc(t(ATT.out))}${ATT.queue.length ? ` · ${esc(L(`${ATT.queue.length} تسجيل بانتظار المزامنة`, `${ATT.queue.length} record(s) waiting to sync`))}` : ''} ${rule('WT-010')}</div></div><label class="radio" title="${esc(L('محاكاة انقطاع الإنترنت', 'Simulate no connection'))}"><span class="switch"><input type="checkbox" role="switch" data-offline="1" ${S.offline ? 'checked' : ''}><span class="track"><span class="thumb"></span></span></span><span class="subtle">${esc(L('دون اتصال', 'Offline'))}</span></label><button class="btn ${ATT.in ? '' : 'primary'}" data-act="att-punch" ${ATT.in && ATT.out ? 'disabled' : ''}>${esc(!ATT.in ? L('تسجيل دخول', 'Check in') : L('تسجيل خروج', 'Check out'))}</button></div>`;
  });
  function vAttendance() {
    const r = H.rng(Number(D.todayISO.replace(/-/g, '')) % 100000);
    const rows = D.OFFICES.map((o) => { const l = active().filter((e) => e.office === o.id && e.category !== 'CONSULTANT'); const lv = l.filter((e) => D.leaveRequests.some((x) => x.empId === e.id && x.status === 'APPROVED' && x.from <= D.todayISO && x.to >= D.todayISO)).length; const late = Math.floor(l.length * (0.03 + r() * 0.04)); const abs = Math.floor(l.length * (0.005 + r() * 0.01)); return { o, n: l.length, lv, late, abs, present: l.length - lv - abs }; });
    const lateCases = active().filter((e) => e.lateMarks >= D.POLICY.lateMarksThreshold);
    const absCase = active().filter((e) => e.category === 'REGULAR').slice(150, 152);
    return `${pageHead(L('الحضور اليومي', 'Daily attendance'), esc(L('من الخدمة الذاتية أو مسؤول الحضور أو ملفات أجهزة البصمة، مع العمل دون اتصال.', 'From self-service, site attendance officers or biometric files, with offline capture.')) + ' ' + rule('WT-010'), `<button class="btn" data-act="toast" data-msg="${esc(L('استُورد ملف جهاز البصمة: 412 تسجيلاً (محاكاة).', 'Biometric file imported: 412 records (simulated).'))}">${icon('download', 16)}${esc(L('استيراد ملف جهاز', 'Import device file'))}</button>`)}
      <div class="grid g-4 keep2">${kpi(L('حاضرون', 'Present'), fmtN(rows.reduce((s, x) => s + x.present, 0)), '', 'check')}${kpi(L('في إجازة', 'On leave'), fmtN(rows.reduce((s, x) => s + x.lv, 0)), '', 'cal')}${kpi(L('متأخرون', 'Late'), fmtN(rows.reduce((s, x) => s + x.late, 0)), rule('WT-012'), 'clock')}${kpi(L('غياب دون إشعار', 'Absent without notice'), fmtN(rows.reduce((s, x) => s + x.abs, 0)), rule('WT-014'), 'warn')}</div>
      <section class="card flush">${table([L('المكتب', 'Office'), L('الموظفون', 'Staff'), L('حاضرون', 'Present'), L('في إجازة', 'Leave'), L('متأخرون', 'Late'), L('غياب', 'Absent')], rows.map((x) => `<tr><td>${esc(T(x.o))}</td><td class="num">${x.n}</td><td class="num">${x.present}</td><td class="num">${x.lv}</td><td class="num">${x.late}</td><td class="num">${x.abs}</td></tr>`))}</section>
      <div class="grid g-2">
        <section class="card"><h2>${esc(L('بلغوا حد التأخير الشهري', 'Reached monthly late threshold'))} ${rule('WT-013')}</h2><div class="list">${lateCases.map((e) => `<div class="list-item">${H.avatar(e, 'sm')}<div class="grow"><div class="t">${esc(T(e.name.short))}</div><div class="subtle">${esc(L(`${e.lateMarks} علامات تأخير`, `${e.lateMarks} late marks`))}</div></div><button class="btn sm" data-act="case-from" data-kind="CONDUCT" data-id="${e.id}">${esc(L('فتح ملف سلوك', 'Open conduct case'))}</button></div>`).join('') || emptyState('check', L('لا يوجد', 'None'))}</div></section>
        <section class="card"><h2>${esc(L(`غياب متتالٍ ${D.POLICY.consecutiveAbsenceCaseDays} أيام دون إشعار`, `${D.POLICY.consecutiveAbsenceCaseDays}+ consecutive days without notice`))} ${rule('WT-015')}</h2><div class="list">${absCase.map((e, i) => `<div class="list-item">${H.avatar(e, 'sm')}<div class="grow"><div class="t">${esc(T(e.name.short))}</div><div class="subtle">${esc(L(`${5 + i} أيام · ${officeName(e.office)}`, `${5 + i} days · ${officeName(e.office)}`))}</div></div><button class="btn sm" data-act="case-from" data-kind="ABSENCE" data-id="${e.id}">${esc(L('فتح ملف غياب', 'Open absence case'))}</button></div>`).join('')}</div><p class="subtle" style="margin:8px 0 0">${esc(L('النظام لا يعتبرها استقالة تلقائياً؛ يقرر المدير القُطري بعد تحقق الموارد البشرية.', 'The system never treats this as resignation automatically; the Country Director decides after HR verifies.'))}</p></section>
      </div>`;
  }

  // =====================================================================
  // Registration
  // =====================================================================
  addNav('HR', 'care', ['الرعاية', 'Care'], { v: 'safety', ic: 'shield', ar: 'سلامة الموظفين', en: 'Staff safety' }, 3);
  addNav('HR', 'care', ['الرعاية', 'Care'], { v: 'wellbeing', ic: 'person', ar: 'الرفاه والرعاية', en: 'Wellbeing' });
  addNav('HR', 'time', ['الوقت والإجازات', 'Time & leave'], { v: 'attendance', ic: 'clock', ar: 'الحضور اليومي', en: 'Attendance' });
  addNav('HR', 'gov', ['الحوكمة', 'Governance'], { v: 'licences', ic: 'doc', ar: 'التراخيص المهنية', en: 'Licences' });
  Object.assign(VIEWS.HR, { safety: vSafety, wellbeing: vWellbeing, attendance: vAttendance, licences: vLicences });
  addNav('CD', 'decisions', ['القرارات', 'Decisions'], { v: 'safety', ic: 'shield', ar: 'سلامة الموظفين', en: 'Staff safety' });
  VIEWS.CD.safety = vSafety;
  addNav('EMPLOYEE', 'me', ['حسابي', 'My account'], { v: 'wellbeing', ic: 'shield', ar: 'رفاهي', en: 'My wellbeing' });
  VIEWS.EMPLOYEE.wellbeing = vEmpWellbeing;

  EXT.hrDash.unshift(() => { const c = current(); if (!c) return ''; const s = stats(c); return `<div class="banner danger"><span class="bi">${icon('warn', 18)}</span><div class="grow"><b>${esc(L(`تسجيل اطمئنان نشط: ${s.help} يحتاجون مساعدة، و${s.none} لم يردّوا`, `Active safety check-in: ${s.help} need help, ${s.none} not responded`))}</b></div><button class="btn sm" data-act="nav" data-v="safety">${esc(L('فتح لوحة السلامة', 'Open safety board'))}</button></div>`; });
  EXT.cdDash.unshift(() => { const c = current(); if (!c) return ''; const s = stats(c); return `<div class="banner danger"><span class="bi">${icon('warn', 18)}</span><div class="grow"><b>${esc(L(`تسجيل اطمئنان نشط: ${fmtN((s.safe / s.total) * 100, 0)}% بأمان · ${s.help} يحتاجون مساعدة`, `Active safety check-in: ${fmtN((s.safe / s.total) * 100, 0)}% safe · ${s.help} need help`))}</b></div><button class="btn sm" data-act="nav" data-v="safety">${esc(L('عرض', 'View'))}</button></div>`; });
  EXT.hrDash.push(() => { const exp = LICS.filter((l) => licStatus(l) === 'EXPIRED').length; const soon = LICS.filter((l) => licStatus(l) === 'EXPIRING').length; return exp + soon ? `<div class="banner info"><span class="bi">${icon('doc', 18)}</span><div class="grow"><b>${esc(L(`${exp} ترخيصاً منتهياً و${soon} تنتهي قريباً`, `${exp} expired and ${soon} expiring professional licences`))}</b><div class="subtle">${rule('LI-002')}</div></div><button class="btn sm" data-act="nav" data-v="licences">${esc(L('مراجعة', 'Review'))}</button></div>` : ''; });

  Object.assign(EXT.actions, {
    'safety-new': () => openOverlay({ type: 'safety-new' }),
    'safety-preview': () => { S.channel = 'teams'; openOverlay({ type: 'safety-preview' }); },
    'safety-launch': () => {
      const d = S.safetyDraft; const id = `SC-${1001 + SAFETY.length}`; const c = { id, at: D.todayISO, scope: d.scope, msg: d.msg.trim() || L('حادث أمني قريب. هل أنت بأمان؟', 'Security incident nearby. Are you safe?'), channels: d.ch, responses: {}, closed: false };
      const r = H.rng(SAFETY.length * 97 + 3); active().forEach((e) => { if (e.id === D.personas.EMPLOYEE || !inScope(c, e)) return; const x = r(); if (x < 0.62) c.responses[e.id] = 'SAFE'; else if (x < 0.635) c.responses[e.id] = 'HELP'; });
      SAFETY.push(c); addActivity('EMPLOYEE', 'teams', `تسجيل اطمئنان: ${c.msg}`, `Safety check-in: ${c.msg}`, 'home'); audit(`إطلاق تسجيل اطمئنان ${id}`, `Safety check-in ${id} launched`);
      S.safetyDraft = { scope: 'ALL', msg: '', ch: d.ch }; S.overlay = null; render(); toast(L('أُرسل التسجيل عبر القنوات المختارة.', 'Check-in sent on the selected channels.'), 'ok');
    },
    'safety-sim': () => { const c = current(); const r = H.rng(Date.now() % 9999); active().forEach((e) => { if (!c.responses[e.id] && inScope(c, e) && e.id !== D.personas.EMPLOYEE && r() < 0.7) c.responses[e.id] = r() < 0.98 ? 'SAFE' : 'HELP'; }); render(); },
    'safety-ok': (t) => { current().responses[t.dataset.id] = 'SAFE'; audit(`تأكيد سلامة ${t.dataset.id}`, `${t.dataset.id} confirmed safe`); render(); },
    'safety-close': () => { const c = current(); c.closed = true; audit(`إنهاء تسجيل اطمئنان ${c.id}`, `Safety check-in ${c.id} closed`); render(); toast(L('أُغلق التسجيل وحُفظ تقريره.', 'Check-in closed and report saved.'), 'ok'); },
    'safety-reply': (t) => { const c = current(); c.responses[me().id] = t.dataset.v; if (t.dataset.v === 'HELP') addActivity('HR', 'teams', `${me().name.ar} تحتاج مساعدة`, `${me().name.en} needs help`, 'safety'); render(); },
    'rr-schedule': (t) => { RR[t.dataset.id] = D.todayISO; audit(`جدولة راحة وتعافٍ ${t.dataset.id}`, `R&R scheduled for ${t.dataset.id}`); render(); toast(L('جُدولت الراحة وأُبلغ الموظف ومديره.', 'R&R scheduled; employee and manager notified.'), 'ok'); },
    'support-request': () => { EXT.state.supportRequests = (EXT.state.supportRequests || 0) + 1; toast(L('وصل طلبك بسرية لمسؤول رعاية الموظفين، وسيتواصل معك قريباً.', 'Your request reached the staff-care focal point confidentially. They will contact you soon.'), 'ok'); },
    'lic-f': (t) => { S.licF = t.dataset.v; render(); },
    'lic-renew': (t) => { const l = LICS.find((x) => x.id === t.dataset.id); l.expiry = iso(addDays(TODAY, 730)); audit(`تجديد ترخيص ${l.id}`, `Licence ${l.id} renewed`); render(); toast(L('سُجّل التجديد وأُرفقت نسخة الترخيص.', 'Renewal recorded and licence copy attached.'), 'ok'); },
    'lic-remind-all': () => { const n = LICS.filter((l) => licStatus(l) !== 'VALID').length; audit(`تذكير ${n} بتجديد التراخيص`, `${n} licence renewal reminders`); toast(L(`أُرسل تذكير عبر Teams إلى ${n} موظفاً.`, `Teams reminder sent to ${n} employees.`), 'ok'); },
    'att-punch': () => {
      const now = new Date().toISOString(); const k = ATT.in ? 'out' : 'in'; ATT[k] = now;
      if (S.offline) { ATT.queue.push({ k, at: now }); toast(L('لا يوجد اتصال: حُفظ التسجيل على الجهاز وسيُزامَن تلقائياً.', 'No connection: saved on the device and will sync automatically.')); } else toast(k === 'in' ? L('سُجّل دخولك.', 'Checked in.') : L('سُجّل خروجك.', 'Checked out.'), 'ok');
      render();
    }
  });
  EXT.onChange.push((t) => {
    if (t.dataset.sfd) { S.safetyDraft[t.dataset.sfd] = t.value; return true; }
    if (t.dataset.sfch) { const k = t.dataset.sfch; S.safetyDraft.ch = t.checked ? [...new Set([...S.safetyDraft.ch, k])] : S.safetyDraft.ch.filter((x) => x !== k); return true; }
    if (t.dataset.offline) { S.offline = t.checked; if (!S.offline && ATT.queue.length) { const n = ATT.queue.length; ATT.queue = []; toast(L(`عاد الاتصال: زُومنت ${n} تسجيلات.`, `Back online: ${n} record(s) synced.`), 'ok'); } render(); return true; }
    return false;
  });
  EXT.onInput.push((t) => { if (t.dataset.sfd === 'msg') { S.safetyDraft.msg = t.value; return true; } return false; });
})();
