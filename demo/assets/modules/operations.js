/* HRMO module — Travel & per diem, assets & incidents, position control & budget,
 * audit log, emergency surge roster. Rules: TR-001..011, AS-001..022, PC-001..004, RD-006, SR-001..003. */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, VIEWS, L, T, esc, icon, fmtN, fmtD, money, parse, iso, addDays, daysBetween, TODAY, badge, rule, who, toast, addActivity, emptyState, empById, persona, me, render, openOverlay, pageHead, table, store, addNav, audit, drawer, modal, msgs, R, kpi, meter, bars, officeName, grant } = H;
  const pick = (i) => D.employees.filter((e) => e.category === 'REGULAR' && !Object.values(D.personas).includes(e.id))[i];
  if (!D.POLICY.travel) D.POLICY.travel = { perNight: { STANDARD: 35, HIGH: 50 }, minHoursWithoutOvernight: 8 };

  // =====================================================================
  // Travel & per diem
  // =====================================================================
  const DEST = [...D.OFFICES.map((o) => ({ id: o.id, ar: o.ar, en: o.en, group: 'STANDARD' })), { id: 'CAP', ar: 'العاصمة (اجتماعات المانحين)', en: 'Capital (donor meetings)', group: 'HIGH' }, { id: 'REG', ar: 'المكتب الإقليمي', en: 'Regional office', group: 'HIGH' }];
  const destOf = (id) => DEST.find((d) => d.id === id) || DEST[0];
  const perDiem = (t) => { const n = Math.max(0, daysBetween(t.from, t.to)); const rate = D.POLICY.travel.perNight[destOf(t.dest).group]; return { nights: n, rate, total: (n || (t.longDay ? 1 : 0)) * rate }; };
  const TRST = { PENDING_MANAGER: ['b-warn', 'بانتظار المدير', 'Awaiting manager'], PENDING_SECURITY: ['b-warn', 'بانتظار مسؤول الأمن', 'Awaiting security'], APPROVED: ['b-ok', 'معتمدة', 'Approved'], REJECTED: ['b-bad', 'مرفوضة', 'Rejected'], COMPLETED: ['b-neutral', 'مكتملة', 'Completed'] };
  const TRIPS = store('trips', () => {
    const tm = H.team().filter((e) => e.id !== D.personas.EMPLOYEE);
    const mk = (id, e, dest, a, b, purpose, status) => ({ id, empId: e.id, dest, from: iso(addDays(TODAY, a)), to: iso(addDays(TODAY, b)), purpose, vehicle: true, status, longDay: a === b, report: false, claim: 0 });
    return [
      mk('TRV-1001', me(), 'NF', -18, -16, { ar: 'إشراف على العيادات المتنقلة', en: 'Mobile clinic supervision' }, 'APPROVED'),
      mk('TRV-1002', tm[1], 'SF', 4, 6, { ar: 'حملة تطعيم', en: 'Vaccination campaign' }, 'PENDING_MANAGER'),
      mk('TRV-1003', tm[2], 'CAP', 9, 11, { ar: 'اجتماع تنسيق القطاع الصحي', en: 'Health cluster meeting' }, 'PENDING_MANAGER'),
      mk('TRV-1004', pick(40), 'EF', 2, 2, { ar: 'توزيع طارئ', en: 'Emergency distribution' }, 'PENDING_SECURITY'),
      mk('TRV-1005', pick(41), 'NF', 3, 5, { ar: 'تقييم احتياجات', en: 'Needs assessment' }, 'PENDING_SECURITY'),
      mk('TRV-1006', pick(42), 'REG', 12, 15, { ar: 'ورشة إقليمية', en: 'Regional workshop' }, 'APPROVED')
    ];
  });
  S.trDraft = S.trDraft || { dest: 'NF', from: '', to: '', purpose: '', vehicle: true, longDay: false };
  function trCheck(d) {
    const out = { errors: [], warnings: [], info: [] }; if (!d.from || !d.to) return out;
    if (d.to < d.from) out.errors.push(R('TR-001', 'تاريخ العودة قبل تاريخ السفر.', 'Return date is before departure.'));
    if (d.from < D.todayISO) out.errors.push(R('TR-001', 'يجب اعتماد السفر قبل المغادرة.', 'Travel must be approved before departure.'));
    const p = perDiem(d); out.info.push(R('TR-003', `البدل اليومي التقديري: ${money(p.total)} (${p.nights} ليلة × ${p.rate}).`, `Estimated per diem: ${money(p.total)} (${p.nights} night(s) × ${p.rate}).`));
    if (p.nights === 0) out.info.push(R('TR-003', `يُستحق البدل في رحلة اليوم الواحد إذا تجاوزت ${D.POLICY.travel.minHoursWithoutOvernight} ساعات.`, `Same-day trips earn per diem above ${D.POLICY.travel.minHoursWithoutOvernight} hours.`));
    out.info.push(R('TR-001', 'المسار: المدير المباشر ← مسؤول الأمن.', 'Route: line manager → security focal point.'));
    return out;
  }
  function vEmpTravel() {
    const d = S.trDraft; const v = trCheck(d); const ok = d.from && d.to && !v.errors.length && d.purpose.trim();
    const mine = TRIPS.filter((t) => t.empId === me().id);
    return `${pageHead(L('السفر والبدل اليومي', 'Travel & per diem'), esc(L('اطلب السفر الرسمي قبل المغادرة، ثم قدّم تقرير الرحلة والمصاريف بعد العودة.', 'Request official travel before departure, then submit the trip report and expenses on return.')) + ' ' + rule('TR-001'))}
      <div class="grid g-12">
        <section class="card"><h2>${esc(L('طلب سفر', 'Travel request'))}</h2><div class="form-grid">
          <div class="field full"><label for="tr-d">${esc(L('الوجهة', 'Destination'))}</label><select id="tr-d" class="select" data-tr="dest">${DEST.map((x) => `<option value="${x.id}" ${d.dest === x.id ? 'selected' : ''}>${esc(T(x))}</option>`).join('')}</select></div>
          <div class="field"><label for="tr-f">${esc(L('المغادرة', 'Depart'))}</label><input id="tr-f" type="date" class="input" data-tr="from" value="${esc(d.from)}"></div>
          <div class="field"><label for="tr-t">${esc(L('العودة', 'Return'))}</label><input id="tr-t" type="date" class="input" data-tr="to" value="${esc(d.to)}"></div>
          <div class="field full"><label for="tr-p">${esc(L('الغرض', 'Purpose'))}</label><input id="tr-p" class="input" data-tr="purpose" value="${esc(d.purpose)}"></div>
          <label class="check-item full"><input type="checkbox" class="cbx" data-tr="vehicle" ${d.vehicle ? 'checked' : ''}><span>${esc(L('أحتاج مركبة من اللوجستيات', 'I need a vehicle from Logistics'))} ${rule('TR-009')}</span></label>
          <div class="full" id="tr-check">${d.from && d.to ? msgs(v) : ''}</div>
          <div class="full"><button class="btn primary" data-act="tr-submit" ${ok ? '' : 'disabled'}>${icon('send', 16)}${esc(L('إرسال للاعتماد', 'Send for approval'))}</button></div></div></section>
        <section class="card"><h2>${esc(L('رحلاتي', 'My trips'))}</h2>${table([L('الوجهة', 'Destination'), L('التاريخ', 'Dates'), L('البدل', 'Per diem'), L('الحالة', 'Status'), ''], mine.map((t) => `<tr><td>${esc(T(destOf(t.dest)))}</td><td>${esc(fmtD(t.from))} – ${esc(fmtD(t.to))}</td><td class="num">${money(perDiem(t).total)}</td><td>${badge(TRST[t.status][0], L(TRST[t.status][1], TRST[t.status][2]))}</td><td style="text-align:end">${t.status === 'APPROVED' && t.to < D.todayISO ? `<button class="btn sm" data-act="tr-report" data-id="${t.id}">${esc(L('التقرير والمصاريف', 'Report & expenses'))}</button>` : ''}</td></tr>`), emptyState('send', L('لا توجد رحلات', 'No trips')))}</section>
      </div>`;
  }
  EXT.overlays['tr-report'] = (o) => { const t = TRIPS.find((x) => x.id === o.id); return modal(L('تقرير الرحلة والمصاريف', 'Trip report & expenses'), `<div class="form-grid"><div class="field full"><label for="rp-s">${esc(L('ملخص الرحلة', 'Trip summary'))} ${rule('TR-002')}</label><textarea id="rp-s" class="textarea"></textarea></div><div class="field"><label for="rp-x">${esc(L('مصاريف أخرى بإيصالات (دولار)', 'Other expenses with receipts (USD)'))}</label><input id="rp-x" type="number" min="0" class="input num" data-trclaim="${t.id}" value="${t.claim || 0}"></div><div class="field"><span class="flabel">${esc(L('البدل اليومي', 'Per diem'))}</span><div style="padding-top:6px">${money(perDiem(t).total)}</div></div><div class="full msg info">${icon('info', 16)}<div>${esc(L('لا تُعوَّض الإكراميات والحمّالون، وكل مصروف يحتاج إيصالاً.', 'Tips and porters are not reimbursed; every expense needs a receipt.'))} ${rule('TR-005')} ${rule('TR-007')}</div></div></div>`, `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="tr-complete" data-id="${t.id}">${esc(L('إرسال للمالية', 'Send to Finance'))}</button>`); };
  function vHrTravel() {
    const month = TRIPS.filter((t) => t.from.slice(0, 7) === D.todayISO.slice(0, 7) && ['APPROVED', 'COMPLETED'].includes(t.status));
    return `${pageHead(L('السفر', 'Travel'), esc(L('كل الرحلات واعتماد مسؤول الأمن والبدلات.', 'All trips, security clearance and per diem.')) + ' ' + rule('TR-001'))}
      <div class="grid g-3">${kpi(L('بانتظار الأمن', 'Awaiting security'), fmtN(TRIPS.filter((t) => t.status === 'PENDING_SECURITY').length), '', 'shield')}${kpi(L('رحلات هذا الشهر', 'Trips this month'), fmtN(month.length), '', 'send')}${kpi(L('البدل اليومي هذا الشهر', 'Per diem this month'), money(month.reduce((s, t) => s + perDiem(t).total, 0)), rule('TR-003'), 'money')}</div>
      <section class="card flush">${table([L('الموظف', 'Employee'), L('الوجهة', 'Destination'), L('التاريخ', 'Dates'), L('الغرض', 'Purpose'), L('البدل', 'Per diem'), L('الحالة', 'Status'), ''], TRIPS.map((t) => { const e = empById.get(t.empId); return `<tr><td>${who(e, T(e.position))}</td><td>${esc(T(destOf(t.dest)))}</td><td>${esc(fmtD(t.from))} – ${esc(fmtD(t.to))}</td><td>${esc(T(t.purpose))}</td><td class="num">${money(perDiem(t).total)}</td><td>${badge(TRST[t.status][0], L(TRST[t.status][1], TRST[t.status][2]))}</td><td style="text-align:end">${t.status === 'PENDING_SECURITY' ? `<button class="btn sm primary" data-act="tr-sec" data-id="${t.id}">${icon('shield', 14)}${esc(L('تصريح أمني', 'Security clearance'))}</button>` : ''}</td></tr>`; }))}</section>`;
  }
  const teamTripsPending = () => { const ids = new Set(H.team().map((e) => e.id)); return TRIPS.filter((t) => t.status === 'PENDING_MANAGER' && ids.has(t.empId)); };
  EXT.mgrPending.push(() => teamTripsPending().length);
  EXT.mgrSections.push((sec) => { const l = teamTripsPending(); return sec(L('السفر', 'Travel'), l.length, 'TR-001', table([L('الموظف', 'Employee'), L('الوجهة', 'Destination'), L('التاريخ', 'Dates'), L('الغرض', 'Purpose'), L('البدل', 'Per diem'), ''], l.map((t) => { const e = empById.get(t.empId); return `<tr><td>${who(e, T(e.position))}</td><td>${esc(T(destOf(t.dest)))}</td><td>${esc(fmtD(t.from))} – ${esc(fmtD(t.to))}</td><td>${esc(T(t.purpose))}</td><td class="num">${money(perDiem(t).total)}</td><td style="text-align:end"><div class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn primary sm" data-act="tr-mgr" data-id="${t.id}" data-v="OK">${esc(L('موافقة', 'Approve'))}</button><button class="btn sm danger" data-act="tr-mgr" data-id="${t.id}" data-v="NO">${esc(L('رفض', 'Reject'))}</button></div></td></tr>`; }), emptyState('check', L('لا توجد طلبات سفر', 'No travel requests')))); });

  // =====================================================================
  // Assets & incidents
  // =====================================================================
  const ATYPE = { LAPTOP: ['حاسوب محمول', 'Laptop'], PHONE: ['هاتف', 'Phone'], VEHICLE: ['مركبة', 'Vehicle'], RADIO: ['جهاز لاسلكي', 'Radio'], IDCARD: ['بطاقة تعريف', 'ID card'] };
  const ASSETS = store('assets', () => {
    const r = H.rng(71); const out = []; let n = 1;
    D.employees.forEach((e) => {
      if (e.category === 'REGULAR' && e.grade >= 5) out.push({ tag: `LT-${String(n++).padStart(4, '0')}`, type: 'LAPTOP', model: r() < 0.5 ? 'ThinkPad T14' : 'Latitude 5440', empId: e.id, since: e.hireDate, cond: r() < 0.9 ? 'GOOD' : 'FAIR' });
      if (e.office !== 'MO' && e.category === 'REGULAR' && r() < 0.45) out.push({ tag: `PH-${String(n++).padStart(4, '0')}`, type: 'PHONE', model: 'Android A15', empId: e.id, since: e.hireDate, cond: 'GOOD' });
      if (e.position.en === 'Driver' && r() < 0.8) out.push({ tag: `VH-${String(n++).padStart(3, '0')}`, type: 'VEHICLE', model: 'Land Cruiser', empId: e.id, since: e.hireDate, cond: r() < 0.8 ? 'GOOD' : 'FAIR' });
      if (e.position.en === 'Security Officer' || e.position.en === 'Guard') if (r() < 0.6) out.push({ tag: `RD-${String(n++).padStart(4, '0')}`, type: 'RADIO', model: 'VHF handheld', empId: e.id, since: e.hireDate, cond: 'GOOD' });
    });
    for (let i = 0; i < 18; i++) out.push({ tag: `LT-${String(n++).padStart(4, '0')}`, type: i < 10 ? 'LAPTOP' : 'PHONE', model: i < 10 ? 'ThinkPad T14' : 'Android A15', empId: null, since: null, cond: 'GOOD' });
    return out;
  });
  const INCIDENTS = store('incidents', () => [
    { id: 'INC-1', tag: ASSETS.find((a) => a.type === 'VEHICLE').tag, empId: ASSETS.find((a) => a.type === 'VEHICLE').empId, kind: 'ACCIDENT', at: iso(addDays(TODAY, -6)), text: { ar: 'اصطدام خفيف عند حاجز، لا إصابات', en: 'Minor collision at a checkpoint, no injuries' }, status: 'OPEN' },
    { id: 'INC-2', tag: ASSETS.find((a) => a.type === 'PHONE').tag, empId: ASSETS.find((a) => a.type === 'PHONE').empId, kind: 'LOSS', at: iso(addDays(TODAY, -15)), text: { ar: 'فُقد الهاتف أثناء الإخلاء', en: 'Phone lost during evacuation' }, status: 'CLOSED' }
  ]);
  const IKIND = { LOSS: ['فقد', 'Loss'], THEFT: ['سرقة', 'Theft'], DAMAGE: ['تلف', 'Damage'], ACCIDENT: ['حادث مركبة', 'Vehicle accident'], SECURITY: ['حادث أمني', 'Security incident'] };
  const INV = store('inventory', () => ({ last: iso(addDays(TODAY, -150)) }));
  S.assetF = S.assetF || 'ALL'; S.assetQ = S.assetQ || '';
  function vAssets() {
    const q = S.assetQ.trim().toLowerCase();
    const list = ASSETS.filter((a) => (S.assetF === 'ALL' || a.type === S.assetF || (S.assetF === 'FREE' && !a.empId)) && (!q || a.tag.toLowerCase().includes(q) || (a.empId && (empById.get(a.empId).name.en.toLowerCase().includes(q) || empById.get(a.empId).name.ar.includes(S.assetQ.trim())))));
    const next = iso(addDays(parse(INV.last), 182)); const openInc = INCIDENTS.filter((i) => i.status === 'OPEN');
    return `${pageHead(L('الأصول والعهد', 'Assets & equipment'), esc(L('كل أصل مسلَّم لموظف بنموذج تسليم، ويُعاد قبل صرف المستحقات النهائية.', 'Every asset is handed over with a signed form and returned before final pay.')) + ' ' + rule('AS-001'), `<button class="btn" data-act="inv-done">${icon('check', 16)}${esc(L('تسجيل جرد', 'Record inventory'))}</button>`)}
      <div class="grid g-4 keep2">${kpi(L('أصول مسجّلة', 'Assets'), fmtN(ASSETS.length), '', 'list')}${kpi(L('غير مُسندة', 'Unassigned'), fmtN(ASSETS.filter((a) => !a.empId).length), '', 'apps')}${kpi(L('حوادث مفتوحة', 'Open incidents'), fmtN(openInc.length), rule('AS-020'), 'warn')}${kpi(L('الجرد القادم', 'Next inventory review'), esc(fmtD(next)), rule('AS-002'), 'cal')}</div>
      ${openInc.length ? `<section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('الحوادث المفتوحة', 'Open incidents'))}</h2>${rule('AS-020')}</div>${table([L('الرقم', 'ID'), L('الأصل', 'Asset'), L('الموظف', 'Employee'), L('النوع', 'Type'), L('الوصف', 'Description'), ''], openInc.map((i) => { const e = empById.get(i.empId); return `<tr><td class="num">${esc(i.id)}</td><td><bdi>${esc(i.tag)}</bdi></td><td>${e ? who(e, officeName(e.office)) : '—'}</td><td>${badge('b-warn', L(...IKIND[i.kind]))}</td><td>${esc(T(i.text))}</td><td style="text-align:end"><div class="btn-row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn sm" data-act="inc-close" data-id="${i.id}" data-v="NO_FAULT">${esc(L('إغلاق: لا إهمال', 'Close: no negligence'))}</button><button class="btn sm danger" data-act="inc-close" data-id="${i.id}" data-v="NEGLIGENCE">${esc(L('إهمال جسيم', 'Gross negligence'))}</button></div></td></tr>`; }))}</section>` : ''}
      <section class="card flush"><div class="table-toolbar"><div class="seg">${[['ALL', 'الكل', 'All'], ...Object.entries(ATYPE).filter(([k]) => k !== 'IDCARD').map(([k, v]) => [k, ...v]), ['FREE', 'غير مُسندة', 'Unassigned']].map(([k, ar, en]) => `<button aria-pressed="${S.assetF === k}" data-act="asset-f" data-v="${k}">${esc(L(ar, en))}</button>`).join('')}</div><label class="search-inline">${icon('search', 14)}<input type="search" class="input" data-assetq="1" value="${esc(S.assetQ)}" placeholder="${esc(L('رقم الأصل أو الموظف', 'Asset tag or employee'))}"></label></div>
        <div id="asset-table">${assetTable(list)}</div></section>`;
  }
  const assetTable = (list) => table([L('الرقم', 'Tag'), L('النوع', 'Type'), L('الطراز', 'Model'), L('مُسند إلى', 'Assigned to'), L('منذ', 'Since'), ''], list.slice(0, 40).map((a) => { const e = a.empId && empById.get(a.empId); return `<tr><td><bdi>${esc(a.tag)}</bdi></td><td>${esc(L(...ATYPE[a.type]))}</td><td>${esc(a.model)}</td><td>${e ? who(e, officeName(e.office)) : badge('b-neutral', L('في المخزن', 'In store'))}</td><td>${a.since ? esc(fmtD(a.since)) : '—'}</td><td style="text-align:end">${e ? `<button class="btn sm" data-act="asset-return" data-v="${a.tag}">${esc(L('استلام', 'Return'))}</button>` : `<button class="btn sm" data-act="asset-assign" data-v="${a.tag}">${esc(L('تسليم', 'Assign'))}</button>`}</td></tr>`; }), emptyState('search', L('لا نتائج', 'No results'))) + (list.length > 40 ? `<div class="pager"><span>${esc(L(`يُعرض 40 من ${list.length}`, `Showing 40 of ${list.length}`))}</span></div>` : '');
  S.asgTag = S.asgTag || null; S.asgEmp = S.asgEmp || '';
  EXT.overlays['asset-assign'] = () => modal(L('تسليم أصل', 'Assign asset'), `<div class="field"><label for="as-e">${esc(L('الموظف', 'Employee'))}</label>${H.empSelect('as-e', 'data-asgemp="1"', S.asgEmp)}</div><div class="msg info">${icon('doc', 16)}<div>${esc(L('يُنشأ نموذج تسليم يوقّعه الموظف إلكترونياً.', 'A handover form is generated for the employee to sign electronically.'))} ${rule('AS-001')}</div></div>`, `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="asset-assign-ok">${esc(L('تسليم', 'Assign'))}</button>`);
  S.incDraft = S.incDraft || { tag: '', kind: 'DAMAGE', text: '' };
  function vEmpEquipment() {
    const mine = ASSETS.filter((a) => a.empId === me().id); const inc = INCIDENTS.filter((i) => i.empId === me().id);
    return `${pageHead(L('عهدتي', 'My equipment'), esc(L('ما سُلّم لك من المؤسسة. أبلغ فوراً عن أي فقد أو تلف أو حادث.', 'Items issued to you. Report any loss, damage or incident immediately.')) + ' ' + rule('AS-020'))}
      <div class="grid g-2"><section class="card"><h2>${esc(L('العهد المسلَّمة', 'Items issued'))}</h2>${mine.length ? `<div class="list">${mine.map((a) => `<div class="list-item">${icon(a.type === 'VEHICLE' ? 'send' : 'apps')}<div class="grow"><div class="t">${esc(L(...ATYPE[a.type]))} · ${esc(a.model)}</div><div class="subtle"><bdi>${esc(a.tag)}</bdi> · ${esc(L('منذ', 'since'))} ${esc(fmtD(a.since))}</div></div></div>`).join('')}</div>` : emptyState('apps', L('لا توجد عهد', 'No items'))}</section>
      <section class="card"><h2>${esc(L('الإبلاغ عن حادث', 'Report an incident'))}</h2><div class="form-grid"><div class="field"><label for="ic-k">${esc(L('النوع', 'Type'))}</label><select id="ic-k" class="select" data-inc="kind">${Object.entries(IKIND).map(([k, v]) => `<option value="${k}" ${S.incDraft.kind === k ? 'selected' : ''}>${esc(L(...v))}</option>`).join('')}</select></div><div class="field"><label for="ic-t">${esc(L('الأصل', 'Item'))}</label><select id="ic-t" class="select" data-inc="tag"><option value="">—</option>${mine.map((a) => `<option value="${a.tag}" ${S.incDraft.tag === a.tag ? 'selected' : ''}>${esc(a.tag)}</option>`).join('')}</select></div><div class="field full"><label for="ic-x">${esc(L('ماذا حدث؟', 'What happened?'))}</label><textarea id="ic-x" class="textarea" data-inc="text">${esc(S.incDraft.text)}</textarea></div><div class="full"><button class="btn primary" data-act="inc-submit">${esc(L('إرسال البلاغ', 'Submit report'))}</button></div></div><p class="subtle" style="margin:8px 0 0">${esc(L('يصل البلاغ لمديرك ورئيس المكتب ومسؤول الأمن.', 'The report reaches your manager, the head of office and the security focal point.'))}</p>${inc.length ? `<div class="list" style="margin-top:8px">${inc.map((i) => `<div class="list-item">${icon('warn')}<div class="grow"><div class="t">${esc(L(...IKIND[i.kind]))}</div><div class="subtle">${esc(fmtD(i.at))}</div></div>${badge(i.status === 'OPEN' ? 'b-warn' : 'b-neutral', i.status === 'OPEN' ? L('قيد المراجعة', 'Under review') : L('مغلق', 'Closed'))}</div>`).join('')}</div>` : ''}</section></div>`;
  }

  // =====================================================================
  // Position control & budget
  // =====================================================================
  const EXTRA_VAC = store('approvedVacancies', () => ({ 'HEA|Nurse|SF': 2, 'PRO|Case Manager|NF': 1, 'WSH|WASH Engineer|EF': 1 }));
  function positions() {
    const m = {};
    D.employees.filter((e) => ['REGULAR', 'FIXED_SHORT'].includes(e.category)).forEach((e) => { const k = `${e.dept}|${e.position.en}|${e.office}`; const x = m[k] || (m[k] = { k, dept: e.dept, title: e.position, office: e.office, grade: e.grade, filled: 0, cost: 0, vac: 0 }); x.filled++; x.cost += e.baseSalary; });
    D.vacancies.forEach((v) => { const k = `${v.dept}|${v.en.replace(/\/.*$/, '')}|${v.office}`; const x = m[k] || (m[k] = { k, dept: v.dept, title: { ar: v.ar, en: v.en }, office: v.office, grade: v.grade, filled: 0, cost: 0, vac: 0 }); x.vac++; });
    Object.entries(EXTRA_VAC).forEach(([k, n]) => { if (m[k]) m[k].vac += n; });
    return Object.values(m);
  }
  function vPositions() {
    const ps = positions(); const approved = ps.reduce((s, p) => s + p.filled + p.vac, 0); const filled = ps.reduce((s, p) => s + p.filled, 0);
    const byDept = D.DEPTS.map((d) => { const l = ps.filter((p) => p.dept === d.id); const f = l.reduce((s, p) => s + p.filled, 0); const v = l.reduce((s, p) => s + p.vac, 0); const cost = l.reduce((s, p) => s + p.cost, 0); const avg = f ? cost / f : 0; return { d, f, v, cost, budget: cost + v * avg }; });
    const cg = {}; D.GRANTS.forEach((g) => { cg[g.id] = 0; }); D.employees.forEach((e) => e.alloc.forEach((a) => { cg[a.grant] += (e.baseSalary * a.pct) / 100; }));
    return `${pageHead(L('الوظائف والموازنة', 'Positions & budget'), esc(L('لكل وظيفة معتمدة تمويل محدد، ولا يبدأ توظيف دون وظيفة شاغرة ممولة.', 'Every approved position has defined funding; no recruitment starts without a funded vacancy.')) + ' ' + rule('PC-001'), `<button class="btn primary" data-act="req-new">${icon('plus', 16)}${esc(L('طلب احتياج وظيفي', 'Staff requisition'))}</button>`)}
      <div class="grid g-4 keep2">${kpi(L('وظائف معتمدة', 'Approved positions'), fmtN(approved), '', 'brief')}${kpi(L('مشغولة', 'Filled'), fmtN(filled), '', 'people')}${kpi(L('شاغرة', 'Vacant'), fmtN(approved - filled), '', 'apps')}${kpi(L('نسبة الشغور', 'Vacancy rate'), `${fmtN(((approved - filled) / approved) * 100, 1)}%`, rule('PC-003'), 'chart')}</div>
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('حسب القسم (شهرياً)', 'By department (monthly)'))}</h2></div>${table([L('القسم', 'Department'), L('مشغولة', 'Filled'), L('شاغرة', 'Vacant'), L('الكلفة الفعلية', 'Actual cost'), L('الموازنة عند الاكتمال', 'Budget at full staffing')], byDept.map((x) => `<tr><td>${esc(T(x.d))}</td><td class="num">${x.f}</td><td class="num">${x.v ? `<b>${x.v}</b>` : 0}</td><td class="num">${money(x.cost)}</td><td class="num">${money(x.budget)}</td></tr>`))}</section>
      <section class="card flush"><div class="table-toolbar"><h2 style="margin:0;font-size:var(--fs-section)">${esc(L('التمويل حسب المنحة', 'Funding by grant'))}</h2>${rule('PC-002')}</div>${table([L('المنحة', 'Grant'), L('المانح', 'Donor'), L('تنتهي', 'Ends'), L('كلفة الموظفين الشهرية', 'Monthly staff cost'), L('المخاطر', 'Risk')], D.GRANTS.map((g) => { const d = daysBetween(D.todayISO, g.end); return `<tr><td><b>${esc(g.id)}</b> · ${esc(T(g))}</td><td>${esc(T(g.donor))}</td><td>${esc(fmtD(g.end))}</td><td class="num">${money(cg[g.id])}</td><td>${d <= 90 ? badge('b-bad', L('تنتهي خلال 90 يوماً', 'Ends within 90 days'), 'warn') : d <= 180 ? badge('b-warn', L('خلال 6 أشهر', 'Within 6 months')) : badge('b-ok', L('مستقرة', 'Stable'))}</td></tr>`; }))}</section>`;
  }
  S.reqPos = S.reqPos || '';
  EXT.overlays.req = () => { const ps = positions().sort((a, b) => T(a.title).localeCompare(T(b.title), S.lang)); const p = ps.find((x) => x.k === S.reqPos); return modal(L('طلب احتياج وظيفي', 'Staff requisition'), `<div class="field"><label for="rq-p">${esc(L('الوظيفة المعتمدة', 'Approved position'))}</label><select id="rq-p" class="select" data-reqpos="1"><option value="">—</option>${ps.map((x) => `<option value="${x.k}" ${S.reqPos === x.k ? 'selected' : ''}>${esc(`${T(x.title)} · ${officeName(x.office)} · ${L('شاغرة', 'vacant')} ${x.vac}`)}</option>`).join('')}</select></div>${p ? (p.vac > 0 ? `<div class="msg ok">${icon('check', 16)}<div>${esc(L(`توجد ${p.vac} وظيفة شاغرة ممولة. يمكن بدء التوظيف.`, `${p.vac} funded vacanc${p.vac > 1 ? 'ies' : 'y'}. Recruitment can start.`))} ${rule('RC-001')}</div></div>` : `<div class="msg bad">${icon('lock', 16)}<div>${esc(L('لا توجد وظيفة شاغرة ممولة. اطلب وظيفة جديدة من المدير القُطري والمدير المالي أولاً.', 'No funded vacancy. Request a new position from the Country Director and Finance Director first.'))} ${rule('RC-002')}</div></div>`) : ''}`, `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="req-ok" ${p && p.vac > 0 ? '' : 'disabled'}>${esc(L('بدء التوظيف', 'Start recruitment'))}</button>`); };

  // =====================================================================
  // Audit log
  // =====================================================================
  S.auditQ = S.auditQ || '';
  function vAudit() {
    const log = EXT.state.audit || []; const q = S.auditQ.trim().toLowerCase();
    const list = log.filter((x) => !q || x.ar.includes(S.auditQ.trim()) || x.en.toLowerCase().includes(q));
    const rl = (r) => (H.ROLES.find((x) => x[0] === r) || [r, r, r]);
    return `${pageHead(L('سجل التدقيق', 'Audit log'), esc(L('كل اعتماد وتعديل وقرار يُسجَّل بمن قام به ومتى. السجل للقراءة فقط.', 'Every approval, change and decision is recorded with who did it and when. Read-only.')) + ' ' + rule('RD-006'), `<button class="btn" data-act="toast" data-msg="${esc(L('صُدّر السجل (محاكاة).', 'Log exported (simulated).'))}">${icon('download', 16)}${esc(L('تصدير', 'Export'))}</button>`)}
      <section class="card flush"><div class="table-toolbar"><label class="search-inline">${icon('search', 14)}<input type="search" class="input" data-auditq="1" value="${esc(S.auditQ)}" placeholder="${esc(L('ابحث في السجل', 'Search the log'))}"></label><span class="subtle">${fmtN(list.length)} ${esc(L('حدث', 'events'))}</span></div>
      ${table([L('الوقت', 'Time'), L('المستخدم', 'User'), L('الدور', 'Role'), L('الحدث', 'Event')], list.slice(0, 100).map((x) => { const u = empById.get(x.who); return `<tr><td class="num">${esc(new Date(x.at).toLocaleString(S.lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</td><td>${u ? esc(T(u.name.short)) : '—'}</td><td>${badge('b-neutral', L(rl(x.role)[1], rl(x.role)[2]))}</td><td style="white-space:normal">${esc(L(x.ar, x.en))}</td></tr>`; }), emptyState('list', L('لا توجد أحداث بعد', 'No events yet'), L('اعتمد أو عدّل أي شيء في النظام وسيظهر هنا.', 'Approve or change anything in the system and it appears here.')))}</section>`;
  }

  // =====================================================================
  // Emergency surge roster
  // =====================================================================
  const SURGE = store('surge', () => { const r = H.rng(83); return D.employees.filter((e) => e.category === 'REGULAR' && e.grade >= 4 && H.serviceDays(e) > 365 && ['HEA', 'NUT', 'WSH', 'PRO', 'LOG'].includes(e.dept)).filter(() => r() < 0.12).map((e) => ({ empId: e.id, available: r() < 0.8, security: e.trainingsDone.includes('SECURITY'), medical: r() < 0.85, deployed: null })); });
  function vSurge() {
    const ready = SURGE.filter((s) => s.available && s.security && s.medical && !s.deployed);
    const bySkill = D.DEPTS.filter((d) => ['HEA', 'NUT', 'WSH', 'PRO', 'LOG'].includes(d.id)).map((d) => ({ label: T(d), value: ready.filter((s) => empById.get(s.empId).dept === d.id).length }));
    return `${pageHead(L('فريق الاستجابة الطارئة', 'Emergency surge roster'), esc(L('موظفون جاهزون للانتشار السريع خلال 72 ساعة عند حالة طوارئ.', 'Staff ready to deploy within 72 hours in an emergency.')) + ' ' + rule('SR-001'))}
      <div class="grid g-21"><section class="card flush">${table([L('الموظف', 'Employee'), L('التخصص', 'Specialty'), L('التدريب الأمني', 'Security training'), L('اللياقة الطبية', 'Medical clearance'), L('متاح', 'Available'), ''], SURGE.map((s) => { const e = empById.get(s.empId); const ok = s.available && s.security && s.medical; return `<tr><td>${who(e, officeName(e.office))}</td><td>${esc(T(e.deptName))}</td><td>${s.security ? badge('b-ok', L('نعم', 'Yes'), 'check') : badge('b-warn', L('ناقص', 'Missing'))}</td><td>${s.medical ? badge('b-ok', L('نعم', 'Yes'), 'check') : badge('b-warn', L('ناقص', 'Missing'))}</td><td><label class="switch"><input type="checkbox" role="switch" data-surge="${s.empId}" ${s.available ? 'checked' : ''} aria-label="${esc(L('متاح', 'Available'))}"><span class="track"><span class="thumb"></span></span></label></td><td style="text-align:end">${s.deployed ? badge('b-info', `${L('منتشر', 'Deployed')}: ${officeName(s.deployed)}`) : `<button class="btn sm" data-act="surge-deploy" data-id="${s.empId}" ${ok ? '' : 'disabled'} title="${esc(ok ? '' : L('يحتاج إلى جاهزية كاملة', 'Requires full readiness'))}">${esc(L('نشر', 'Deploy'))}</button>`}</td></tr>`; }))}</section>
      <section class="card"><h2>${esc(L('الجاهزون حسب التخصص', 'Ready by specialty'))}</h2>${bars(bySkill, { title: L('الجاهزية', 'Readiness') })}<p class="subtle" style="margin:10px 0 0">${esc(L('الجاهزية الكاملة: متاح + تدريب أمني + لياقة طبية.', 'Fully ready: available + security training + medical clearance.'))} ${rule('SR-002')}</p></section></div>`;
  }
  S.deployTo = S.deployTo || 'NF';
  EXT.overlays.deploy = (o) => { const e = empById.get(o.id); return modal(L('نشر طارئ', 'Emergency deployment'), `<div class="list-item" style="padding-top:0">${H.avatar(e)}<div class="grow"><div class="t">${esc(T(e.name))}</div><div class="subtle">${esc(T(e.position))}</div></div></div><div class="field"><label for="dp-t">${esc(L('موقع الانتشار', 'Deploy to'))}</label><select id="dp-t" class="select" data-deploy="1">${D.OFFICES.filter((x) => x.id !== e.office).map((x) => `<option value="${x.id}" ${S.deployTo === x.id ? 'selected' : ''}>${esc(T(x))}</option>`).join('')}</select></div><div class="msg info">${icon('info', 16)}<div>${esc(L('نقل مؤقت لمدة تصل إلى شهر يُعوَّض ببدل يومي، ويحتاج تصريح مسؤول الأمن.', 'A temporary transfer of up to one month is paid by per diem and needs security clearance.'))} ${rule('LC-012')}</div></div>`, `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="surge-ok" data-id="${e.id}">${esc(L('نشر', 'Deploy'))}</button>`); };

  // =====================================================================
  // Registration
  // =====================================================================
  addNav('EMPLOYEE', 'work', ['العمل الميداني', 'Field work'], { v: 'travel', ic: 'send', ar: 'السفر والبدل', en: 'Travel & per diem' }, 3);
  addNav('EMPLOYEE', 'work', ['العمل الميداني', 'Field work'], { v: 'equipment', ic: 'apps', ar: 'عهدتي', en: 'My equipment' });
  Object.assign(VIEWS.EMPLOYEE, { travel: vEmpTravel, equipment: vEmpEquipment });
  addNav('HR', 'ops', ['العمليات', 'Operations'], { v: 'travel', ic: 'send', ar: 'السفر', en: 'Travel' });
  addNav('HR', 'ops', ['العمليات', 'Operations'], { v: 'assets', ic: 'apps', ar: 'الأصول والعهد', en: 'Assets' });
  addNav('HR', 'people', ['الموظفون', 'People'], { v: 'positions', ic: 'brief', ar: 'الوظائف والموازنة', en: 'Positions & budget' });
  addNav('HR', 'talent', ['المواهب', 'Talent'], { v: 'surge', ic: 'flag', ar: 'فريق الطوارئ', en: 'Surge roster' });
  addNav('HR', 'gov', ['الحوكمة', 'Governance'], { v: 'audit', ic: 'list', ar: 'سجل التدقيق', en: 'Audit log' });
  Object.assign(VIEWS.HR, { travel: vHrTravel, assets: vAssets, positions: vPositions, surge: vSurge, audit: vAudit });
  addNav('CD', 'insights', ['التحليلات', 'Insights'], { v: 'positions', ic: 'brief', ar: 'الوظائف والموازنة', en: 'Positions & budget' });
  VIEWS.CD.positions = vPositions;

  Object.assign(EXT.actions, {
    'tr-submit': () => { const d = S.trDraft; if (trCheck(d).errors.length) return; const id = `TRV-${1001 + TRIPS.length}`; TRIPS.unshift({ id, empId: me().id, dest: d.dest, from: d.from, to: d.to, purpose: d.purpose, vehicle: d.vehicle, longDay: d.from === d.to, status: 'PENDING_MANAGER', report: false, claim: 0 }); addActivity('MANAGER', 'teams', `طلب سفر ${id} من ${me().name.ar}`, `Travel request ${id} from ${me().name.en}`, 'approvals'); audit(`طلب سفر ${id}`, `Travel request ${id}`); S.trDraft = { dest: d.dest, from: '', to: '', purpose: '', vehicle: true }; render(); toast(L('أُرسل الطلب لمديرك.', 'Sent to your manager.'), 'ok'); },
    'tr-mgr': (t) => { const x = TRIPS.find((y) => y.id === t.dataset.id); x.status = t.dataset.v === 'OK' ? 'PENDING_SECURITY' : 'REJECTED'; audit(`قرار المدير على السفر ${x.id}`, `Manager decision on trip ${x.id}`); render(); toast(t.dataset.v === 'OK' ? L('وافقت، والطلب الآن لدى مسؤول الأمن.', 'Approved; now with the security focal point.') : L('تم الرفض.', 'Rejected.'), t.dataset.v === 'OK' ? 'ok' : 'bad'); },
    'tr-sec': (t) => { const x = TRIPS.find((y) => y.id === t.dataset.id); x.status = 'APPROVED'; audit(`تصريح أمني للسفر ${x.id}`, `Security clearance for trip ${x.id}`); if (x.empId === me().id) addActivity('EMPLOYEE', 'teams', `اعتُمد سفرك ${x.id}`, `Your trip ${x.id} is approved`, 'travel'); render(); toast(L('صدر التصريح الأمني.', 'Security clearance issued.'), 'ok'); },
    'tr-report': (t) => openOverlay({ type: 'tr-report', id: t.dataset.id }),
    'tr-complete': (t) => { const x = TRIPS.find((y) => y.id === t.dataset.id); x.status = 'COMPLETED'; x.report = true; audit(`تقرير رحلة ${x.id}`, `Trip report ${x.id}`); S.overlay = null; render(); toast(L(`أُرسل للمالية: ${money(perDiem(x).total + Number(x.claim || 0))}.`, `Sent to Finance: ${money(perDiem(x).total + Number(x.claim || 0))}.`), 'ok'); },
    'asset-f': (t) => { S.assetF = t.dataset.v; render(); },
    'asset-return': (t) => { const a = ASSETS.find((x) => x.tag === t.dataset.v); audit(`استلام أصل ${a.tag}`, `Asset ${a.tag} returned`); a.empId = null; a.since = null; render(); toast(L('استُلم الأصل وأُغلق نموذج التسليم.', 'Asset returned; handover form closed.'), 'ok'); },
    'asset-assign': (t) => { S.asgTag = t.dataset.v; S.asgEmp = ''; openOverlay({ type: 'asset-assign' }); },
    'asset-assign-ok': () => { if (!S.asgEmp) { toast(L('اختر موظفاً.', 'Choose an employee.'), 'bad'); return; } const a = ASSETS.find((x) => x.tag === S.asgTag); a.empId = S.asgEmp; a.since = D.todayISO; audit(`تسليم أصل ${a.tag}`, `Asset ${a.tag} assigned`); S.overlay = null; render(); toast(L('سُلّم الأصل وأُرسل نموذج التسليم للتوقيع.', 'Assigned; handover form sent for signature.'), 'ok'); },
    'inv-done': () => { INV.last = D.todayISO; audit('تسجيل جرد الأصول', 'Inventory review recorded'); render(); toast(L('سُجّل الجرد.', 'Inventory recorded.'), 'ok'); },
    'inc-close': (t) => { const i = INCIDENTS.find((x) => x.id === t.dataset.id); i.status = 'CLOSED'; i.outcome = t.dataset.v; audit(`إغلاق حادث ${i.id}: ${i.outcome}`, `Incident ${i.id} closed: ${i.outcome}`); render(); toast(t.dataset.v === 'NEGLIGENCE' ? L('سُجّل إهمال جسيم، ويُطلب إقرار الموظف قبل أي خصم.', 'Gross negligence recorded; employee acknowledgement required before any deduction.') : L('أُغلق الحادث.', 'Incident closed.'), 'ok'); },
    'inc-submit': () => { const d = S.incDraft; if (!d.text.trim()) { toast(L('صِف ما حدث.', 'Describe what happened.'), 'bad'); return; } const id = `INC-${INCIDENTS.length + 1}`; INCIDENTS.unshift({ id, tag: d.tag, empId: me().id, kind: d.kind, at: D.todayISO, text: d.text, status: 'OPEN' }); addActivity('HR', 'teams', `بلاغ حادث ${id}`, `Incident report ${id}`, 'assets'); addActivity('MANAGER', 'teams', `بلاغ حادث من ${me().name.ar}`, `Incident report from ${me().name.en}`, 'team'); audit(`بلاغ حادث ${id}`, `Incident ${id} reported`); S.incDraft = { tag: '', kind: d.kind, text: '' }; render(); toast(L('أُرسل البلاغ للمدير ورئيس المكتب ومسؤول الأمن.', 'Report sent to your manager, head of office and security.'), 'ok'); },
    'req-new': () => { S.reqPos = ''; openOverlay({ type: 'req' }); },
    'req-ok': () => { S.overlay = null; audit('بدء توظيف لوظيفة شاغرة ممولة', 'Recruitment started for a funded vacancy'); H.setView('recruitment'); toast(L('أُنشئ طلب الاحتياج، وانتقلت للتوظيف.', 'Requisition created; moved to recruitment.'), 'ok'); },
    'surge-deploy': (t) => openOverlay({ type: 'deploy', id: t.dataset.id }),
    'surge-ok': (t) => { const s = SURGE.find((x) => x.empId === t.dataset.id); s.deployed = S.deployTo; const e = empById.get(s.empId); addActivity('HR', 'teams', `نُشر ${e.name.ar} إلى ${officeName(S.deployTo)}`, `${e.name.en} deployed to ${officeName(S.deployTo)}`, 'surge'); audit(`نشر طارئ ${e.id}`, `Surge deployment ${e.id}`); S.overlay = null; render(); toast(L('أُبلغ الموظف ومديره ومسؤول الأمن عبر Teams.', 'Employee, manager and security notified in Teams.'), 'ok'); }
  });
  EXT.onChange.push((t) => {
    if (t.dataset.tr) { S.trDraft[t.dataset.tr] = t.type === 'checkbox' ? t.checked : t.value; render(); return true; }
    if (t.dataset.trclaim) { TRIPS.find((x) => x.id === t.dataset.trclaim).claim = Number(t.value) || 0; return true; }
    if (t.dataset.asgemp) { S.asgEmp = t.value; return true; }
    if (t.dataset.inc) { S.incDraft[t.dataset.inc] = t.value; return true; }
    if (t.dataset.reqpos) { S.reqPos = t.value; render(); return true; }
    if (t.dataset.surge) { SURGE.find((x) => x.empId === t.dataset.surge).available = t.checked; render(); return true; }
    if (t.dataset.deploy) { S.deployTo = t.value; return true; }
    return false;
  });
  EXT.onInput.push((t) => {
    if (t.dataset.tr === 'purpose') { S.trDraft.purpose = t.value; return true; }
    if (t.dataset.inc === 'text') { S.incDraft.text = t.value; return true; }
    if (t.dataset.assetq) { S.assetQ = t.value; const q = S.assetQ.trim().toLowerCase(); const list = ASSETS.filter((a) => (S.assetF === 'ALL' || a.type === S.assetF || (S.assetF === 'FREE' && !a.empId)) && (!q || a.tag.toLowerCase().includes(q) || (a.empId && (empById.get(a.empId).name.en.toLowerCase().includes(q) || empById.get(a.empId).name.ar.includes(S.assetQ.trim()))))); const el = document.getElementById('asset-table'); if (el) el.innerHTML = assetTable(list); return true; }
    if (t.dataset.auditq) { S.auditQ = t.value; render(); const i = document.querySelector('[data-auditq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return true; }
    return false;
  });
})();
