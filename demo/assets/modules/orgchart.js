/* HRMO module — organisation chart drawn as a diagram.
 * One box per employee (name, staff number, job title), connected to the line manager.
 * The chart is built from each employee's managerId, so adding an employee adds a box. Rule: MG-005. */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, VIEWS, L, T, esc, icon, fmtN, rule, toast, empById, persona, render, openOverlay, modal, audit, store, pageHead, iso, parse } = H;

  // Employees added from the chart are kept with the saved demo state and restored on load.
  const ADDED = store('orgAdded', () => []);
  ADDED.forEach((e) => { if (!empById.has(e.id)) { D.employees.push(e); empById.set(e.id, e); } });

  S.org = Object.assign({ closed: [], zoom: 1, hit: null }, S.org || {});
  let scroll = null;       // last scroll position of the canvas, kept across re-renders
  let pendingFocus = null; // employee id to bring into view after the next render

  const kidsMap = () => {
    const m = {};
    D.employees.forEach((e) => { if (e.managerId && empById.has(e.managerId)) (m[e.managerId] = m[e.managerId] || []).push(e); });
    Object.values(m).forEach((l) => l.sort((a, b) => b.grade - a.grade || (a.name.en < b.name.en ? -1 : 1)));
    return m;
  };
  const chainOf = (e) => { const c = []; let x = e; while (x && x.managerId) { x = empById.get(x.managerId); if (x) c.unshift(x); } return c; };
  const isNew = (e) => ADDED.some((x) => x.id === e.id);

  // ---------- Drawing ----------
  function box(e, kids, total) {
    const n = kids.length; const open = !S.org.closed.includes(e.id);
    const cls = ['oc-box', e.id === persona().id ? 'me' : '', S.org.hit === e.id ? 'hit' : '', isNew(e) ? 'new' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}" id="oc-${e.id}" dir="${S.lang === 'ar' ? 'rtl' : 'ltr'}">
      <button class="oc-main" data-act="emp" data-id="${e.id}">
        <span class="oc-name">${esc(T(e.name.short))}</span>
        <span class="oc-no"><bdi>${esc(e.staffNo)}</bdi></span>
        <span class="oc-title">${esc(T(e.position))}</span>
      </button>
      ${isNew(e) ? `<span class="oc-tag">${esc(L('جديد', 'New'))}</span>` : ''}
      ${n ? `<button class="oc-toggle" data-act="oc-toggle" data-id="${e.id}" aria-expanded="${open}" title="${esc(L(`${n} مباشر · ${total} إجمالي`, `${n} direct · ${total} total`))}">${fmtN(total)}<span class="chev ${open ? 'open' : ''}">${icon('down', 12)}</span></button>` : ''}
    </div>`;
  }
  function tree() {
    const kids = kidsMap(); const totals = {};
    const total = (id) => (totals[id] != null ? totals[id] : (totals[id] = (kids[id] || []).reduce((t, c) => t + 1 + total(c.id), 0)));
    const node = (e) => {
      const k = kids[e.id] || []; const open = !S.org.closed.includes(e.id);
      let below = '';
      if (k.length && open) {
        const leaves = k.filter((c) => !(kids[c.id] || []).length); const branches = k.filter((c) => (kids[c.id] || []).length);
        // People with no reports are grouped in a compact block instead of one long row.
        const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(leaves.length / 2.5))));
        const team = leaves.length ? `<li class="oc-teamli"><div class="oc-team" style="grid-template-columns:repeat(${cols}, var(--oc-w))">${leaves.map((c) => box(c, [], 0)).join('')}</div></li>` : '';
        below = `<ul>${branches.map(node).join('')}${team}</ul>`;
      }
      return `<li>${box(e, k, total(e.id))}${below}</li>`;
    };
    const roots = D.employees.filter((e) => !e.managerId || !empById.has(e.managerId));
    return `<ul class="oc-root">${roots.map(node).join('')}</ul>`;
  }

  function vOrg() {
    const isHR = S.role === 'HR'; const z = S.org.zoom;
    const tools = `<div class="oc-tools">
        <div class="oc-search"><label class="search-inline">${icon('search', 14)}<input type="search" class="input" data-oc-q="1" autocomplete="off" placeholder="${esc(L('ابحث بالاسم أو الرقم الوظيفي', 'Find by name or staff number'))}"></label><div class="oc-results" id="oc-results" hidden></div></div>
        <div class="btn-row">
          <div class="oc-zoom" role="group" aria-label="${esc(L('التكبير', 'Zoom'))}"><button class="iconbtn" data-act="oc-zoom" data-v="-1" aria-label="${esc(L('تصغير', 'Zoom out'))}">−</button><span><bdi>${Math.round(z * 100)}%</bdi></span><button class="iconbtn" data-act="oc-zoom" data-v="1" aria-label="${esc(L('تكبير', 'Zoom in'))}">+</button></div>
          <button class="btn" data-act="oc-fit">${esc(L('ملاءمة العرض', 'Fit to width'))}</button>
          <button class="btn" data-act="oc-all" data-v="${S.org.closed.length ? 'open' : 'close'}">${esc(S.org.closed.length ? L('عرض كل الموظفين', 'Show all staff') : L('طي الفرق', 'Collapse teams'))}</button>
          ${isHR ? `<button class="btn primary" data-act="oc-add">${icon('plus', 16)}${esc(L('إضافة موظف', 'Add employee'))}</button>` : ''}
        </div></div>`;
    return `${pageHead(L('الهيكل التنظيمي', 'Org chart'), `${esc(L(`${fmtN(D.employees.length)} موظفا. يرسم تلقائيا من المدير المباشر لكل موظف.`, `${fmtN(D.employees.length)} staff. Drawn automatically from each employee's line manager.`))} ${rule('MG-005')}`, '')}
      ${tools}
      <section class="card flush oc-card"><div class="oc-wrap" id="oc-wrap" tabindex="0" aria-label="${esc(L('مخطط الهيكل التنظيمي', 'Organisation chart'))}"><div class="oc" id="oc" style="zoom:${z}">${tree()}</div></div></section>
      <p class="subtle oc-hint">${esc(L('اسحب للتنقل. اضغط على المربع لفتح ملف الموظف، وعلى الرقم أسفله لطي فريقه أو فتحه.', 'Drag to move around. Click a box to open the employee file, and the number under it to collapse or expand the team.'))}</p>`;
  }
  ['MANAGER', 'HR', 'CD'].forEach((r) => { if (VIEWS[r]) VIEWS[r].orgchart = vOrg; });

  // ---------- Keep position, centre the root, bring a person into view ----------
  EXT.afterRender.push(() => {
    const wrap = document.getElementById('oc-wrap'); if (!wrap) { scroll = null; return; }
    if (pendingFocus) {
      const el = document.getElementById(`oc-${pendingFocus}`); pendingFocus = null;
      if (el) { const a = el.getBoundingClientRect(); const b = wrap.getBoundingClientRect(); wrap.scrollLeft += a.left + a.width / 2 - (b.left + b.width / 2); wrap.scrollTop += a.top + a.height / 2 - (b.top + b.height / 2); }
    } else if (scroll) { wrap.scrollLeft = scroll.x; wrap.scrollTop = scroll.y; } else {
      const top = wrap.querySelector('.oc-box'); if (top) { const a = top.getBoundingClientRect(); const b = wrap.getBoundingClientRect(); wrap.scrollLeft += a.left + a.width / 2 - (b.left + b.width / 2); }
    }
    scroll = { x: wrap.scrollLeft, y: wrap.scrollTop };
  });
  document.addEventListener('scroll', (ev) => { if (ev.target && ev.target.id === 'oc-wrap') scroll = { x: ev.target.scrollLeft, y: ev.target.scrollTop }; }, true);

  // Drag to pan (mouse). Touch screens scroll natively.
  let drag = null;
  document.addEventListener('mousedown', (ev) => { const w = ev.target.closest && ev.target.closest('#oc-wrap'); if (!w || ev.button !== 0) return; drag = { w, x: ev.clientX, y: ev.clientY, l: w.scrollLeft, t: w.scrollTop, moved: false }; });
  document.addEventListener('mousemove', (ev) => { if (!drag) return; const dx = ev.clientX - drag.x; const dy = ev.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) { drag.moved = true; drag.w.classList.add('dragging'); } if (drag.moved) { drag.w.scrollLeft = drag.l - dx; drag.w.scrollTop = drag.t - dy; } });
  document.addEventListener('mouseup', () => { if (drag) { const d = drag; drag = null; setTimeout(() => d.w.classList.remove('dragging'), 0); if (d.moved) suppressClick = true; } });
  let suppressClick = false;
  document.addEventListener('click', (ev) => { if (suppressClick) { suppressClick = false; if (ev.target.closest && ev.target.closest('#oc-wrap')) { ev.stopPropagation(); ev.preventDefault(); } } }, true);

  const focusOn = (id) => { const e = empById.get(id); if (!e) return; const open = new Set(chainOf(e).map((x) => x.id)); S.org.closed = S.org.closed.filter((x) => !open.has(x)); S.org.hit = id; pendingFocus = id; render(); };

  // ---------- Actions ----------
  Object.assign(EXT.actions, {
    'oc-toggle': (t) => { const id = t.dataset.id; S.org.closed = S.org.closed.includes(id) ? S.org.closed.filter((x) => x !== id) : [...S.org.closed, id]; pendingFocus = id; render(); },
    'oc-zoom': (t) => { S.org.zoom = Math.min(1.4, Math.max(0.1, Math.round((S.org.zoom + Number(t.dataset.v) * 0.1) * 10) / 10)); render(); },
    'oc-fit': () => { const w = document.getElementById('oc-wrap'); const c = document.getElementById('oc'); if (!w || !c) return; const natural = c.scrollWidth; S.org.zoom = Math.min(1, Math.max(0.04, Math.floor(((w.clientWidth - 24) / natural) * 100) / 100)); scroll = { x: 0, y: 0 }; render(); },
    'oc-all': (t) => {
      if (t.dataset.v === 'open') S.org.closed = [];
      else { const kids = kidsMap(); S.org.closed = Object.keys(kids).filter((id) => kids[id].every((c) => !(kids[c.id] || []).length)); } // collapse the last level only
      scroll = null; render();
    },
    'oc-pick': (t) => focusOn(t.dataset.id),
    'oc-add': () => openOverlay({ type: 'ocAdd' }),
    'oc-add-save': () => {
      const v = (id) => (document.getElementById(id) || {}).value || '';
      const name = v('oca-name').trim().replace(/\s+/g, ' '); const title = v('oca-title').trim(); const mgr = empById.get(v('oca-mgr'));
      if (!name || !title || !mgr) { toast(L('اكتب الاسم والمسمى الوظيفي واختر المدير المباشر.', 'Enter the name and job title, and choose the line manager.'), 'bad'); return; }
      const words = name.split(' '); const short = words.length > 1 ? `${words[0]} ${words[words.length - 1]}` : name;
      const numbers = D.employees.map((e) => Number(String(e.staffNo).replace(/\D/g, '')) || 0); const next = Math.max(...numbers) + 1;
      const ids = D.employees.map((e) => Number(e.id.slice(1)) || 0); const today = D.todayISO; const t0 = parse(today);
      const office = v('oca-office') || mgr.office; const grade = Math.max(1, Math.min(mgr.grade - 1, Number(v('oca-grade')) || 4));
      const e = {
        id: `E${String(Math.max(...ids) + 1).padStart(4, '0')}`, staffNo: `HRMO-${next}`,
        name: { ar: name, en: name, short: { ar: short, en: short } }, gender: v('oca-gender') || 'F',
        dept: mgr.dept, deptName: mgr.deptName, position: { ar: title, en: title }, grade, office, category: 'REGULAR',
        hireDate: today, contractEnd: iso(new Date(t0.getFullYear() + 1, t0.getMonth(), t0.getDate())), probationEnd: iso(new Date(t0.getFullYear(), t0.getMonth() + D.POLICY.probationMonths, t0.getDate())), inProbation: true,
        baseSalary: 0, currency: 'USD', alloc: mgr.alloc || [], leave: { annualAccrued: 0, annualUsed: 0, sickUsed: 0, compDays: 0, unpaidUsed: 0 },
        lateMarks: 0, ackMissing: D.POLICIES.map((p) => p.code), trainingsDone: [], screening: 'DUE', warnings: 0, rating: 'SATISFACTORY',
        phone: '', email: '', managerId: mgr.id, staffType: 'NATL', disability: false
      };
      D.employees.push(e); empById.set(e.id, e); ADDED.push(e);
      audit(`إضافة موظف ${e.staffNo} تحت ${mgr.name.ar}`, `Employee ${e.staffNo} added under ${mgr.name.en}`);
      S.overlay = null; focusOn(e.id);
      toast(L(`أضيف ${short} إلى الهيكل برقم ${e.staffNo}.`, `${short} was added to the chart as ${e.staffNo}.`), 'ok');
    }
  });

  // Search: results appear under the box without redrawing the chart.
  EXT.onInput.push((t) => {
    if (!t.dataset.ocQ) return false;
    const out = document.getElementById('oc-results'); const q = t.value.trim().toLowerCase();
    if (!q) { out.hidden = true; out.innerHTML = ''; return true; }
    const hits = D.employees.filter((e) => e.name.en.toLowerCase().includes(q) || e.name.ar.includes(t.value.trim()) || e.staffNo.toLowerCase().includes(q) || e.position.en.toLowerCase().includes(q) || e.position.ar.includes(t.value.trim())).slice(0, 8);
    out.hidden = false;
    out.innerHTML = hits.length ? hits.map((e) => `<button data-act="oc-pick" data-id="${e.id}"><b>${esc(T(e.name.short))}</b><span class="subtle"><bdi>${esc(e.staffNo)}</bdi> · ${esc(T(e.position))}</span></button>`).join('') : `<div class="subtle" style="padding:10px">${esc(L('لا نتائج', 'No results'))}</div>`;
    return true;
  });

  // ---------- Add employee ----------
  EXT.overlays.ocAdd = () => {
    const kids = kidsMap(); const sorted = (l) => l.slice().sort((a, b) => (T(a.name) < T(b.name) ? -1 : 1));
    const managers = sorted(D.employees.filter((e) => kids[e.id])); const others = sorted(D.employees.filter((e) => !kids[e.id]));
    const opt = (e) => `<option value="${e.id}" ${e.id === persona().id ? 'selected' : ''}>${esc(T(e.name.short))} · ${esc(T(e.position))}</option>`;
    const next = Math.max(...D.employees.map((e) => Number(String(e.staffNo).replace(/\D/g, '')) || 0)) + 1;
    return modal(L('إضافة موظف', 'Add employee'), `<div class="form-grid">
        <div class="field full"><label for="oca-name">${esc(L('الاسم الكامل', 'Full name'))}</label><input id="oca-name" class="input" autocomplete="off"></div>
        <div class="field full"><label for="oca-title">${esc(L('المسمى الوظيفي', 'Job title'))}</label><input id="oca-title" class="input" autocomplete="off"></div>
        <div class="field full"><label for="oca-mgr">${esc(L('المدير المباشر', 'Line manager'))}</label><select id="oca-mgr" class="select"><optgroup label="${esc(L('مديرون ومشرفون', 'Managers and supervisors'))}">${managers.map(opt).join('')}</optgroup><optgroup label="${esc(L('بقية الموظفين', 'Other staff'))}">${others.map(opt).join('')}</optgroup></select></div>
        <div class="field"><label for="oca-office">${esc(L('المكتب', 'Office'))}</label><select id="oca-office" class="select"><option value="">${esc(L('مكتب المدير نفسه', 'Same as the manager'))}</option>${D.OFFICES.map((o) => `<option value="${o.id}">${esc(T(o))}</option>`).join('')}</select></div>
        <div class="field"><label for="oca-gender">${esc(L('الجنس', 'Gender'))}</label><select id="oca-gender" class="select"><option value="F">${esc(L('أنثى', 'Female'))}</option><option value="M">${esc(L('ذكر', 'Male'))}</option></select></div>
        <div class="field full"><span class="flabel">${esc(L('الرقم الوظيفي', 'Staff number'))}</span><div class="oc-nextno"><bdi>HRMO-${next}</bdi> <span class="subtle">${esc(L('يولد تلقائيا', 'Generated automatically'))}</span></div></div>
        <div class="full msg info">${icon('info', 16)}<div>${esc(L('القسم يؤخذ من المدير المباشر. يظهر الموظف في الهيكل فور الحفظ، وتستكمل بقية بياناته من سجل الموظفين.', 'The department is taken from the line manager. The employee appears in the chart as soon as you save; the rest of the record is completed in the employee register.'))}</div></div>
      </div>`, `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="oc-add-save">${icon('plus', 16)}${esc(L('إضافة إلى الهيكل', 'Add to chart'))}</button>`);
  };
})();
