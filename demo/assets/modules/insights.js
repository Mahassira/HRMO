/* HRMO module — HR metrics, end-of-service liability, diversity & localization, daily labour,
 * countries-of-operation selector. Rules: KP-001..005, DI-001..004, SP-004, CAT-007. */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, L, T, esc, icon, fmtN, fmtD, money, daysBetween, badge, rule, toast, store, kpi, bars, serviceDays, balances, openMenu, mItem } = H;
  
  const regular = () => D.employees.filter((e) => e.category === 'REGULAR');

  // ---------- Metrics ----------
  function metrics() {
    const n = D.employees.length; const r = H.rng(97);
    const hires = D.employees.filter((e) => serviceDays(e) <= 365).length;
    const probDone = D.employees.filter((e) => serviceDays(e) > 91 && serviceDays(e) <= 455).length;
    const seps = D.separations;
    const tth = Math.round(D.vacancies.reduce((s, v) => s + Math.max(20, daysBetween(v.opened, D.todayISO) + 14), 0) / D.vacancies.length);
    return {
      timeToHire: tth, costPerHire: 410 + Math.round(r() * 60), hires,
      absenteeism: 2.1 + r() * 0.8, probationPass: probDone ? 100 * (1 - 4 / probDone) : 100,
      turnover: (seps.length / n) * 100, voluntary: (seps.filter((s) => s.type === 'RESIGNATION').length / Math.max(1, seps.length)) * 100,
      byReason: ['RESIGNATION', 'CONTRACT_END', 'REDUNDANCY', 'DISCIPLINARY'].map((t) => ({ label: { RESIGNATION: L('استقالة', 'Resignation'), CONTRACT_END: L('انتهاء عقد', 'Contract end'), REDUNDANCY: L('تقليص', 'Redundancy'), DISCIPLINARY: L('تأديبي', 'Disciplinary') }[t], value: seps.filter((s) => s.type === t).length }))
    };
  }
  EXT.hrDash.push(() => {
    const m = metrics();
    return `<div class="grid g-2"><section class="card"><h2>${esc(L('مؤشرات الموارد البشرية', 'HR metrics'))} ${rule('KP-001')}</h2><div class="stat-list">
      <div class="row"><span>${esc(L('متوسط زمن التوظيف', 'Average time to hire'))}</span><b>${fmtN(m.timeToHire)} ${esc(L('يوماً', 'days'))}</b></div>
      <div class="row"><span>${esc(L('كلفة التعيين التقديرية', 'Estimated cost per hire'))}</span><b>${money(m.costPerHire)}</b></div>
      <div class="row"><span>${esc(L('تعيينات آخر 12 شهراً', 'Hires in the last 12 months'))}</span><b>${fmtN(m.hires)}</b></div>
      <div class="row"><span>${esc(L('نسبة الغياب', 'Absenteeism rate'))}</span><b>${fmtN(m.absenteeism, 1)}%</b></div>
      <div class="row"><span>${esc(L('نسبة اجتياز فترة التجربة', 'Probation pass rate'))}</span><b>${fmtN(m.probationPass, 1)}%</b></div>
      <div class="row"><span>${esc(L('الدوران السنوي (الطوعي منه)', 'Annual turnover (voluntary share)'))}</span><b>${fmtN(m.turnover, 1)}% <span class="subtle">(${fmtN(m.voluntary, 0)}%)</span></b></div></div></section>
      <section class="card"><h2>${esc(L('أسباب الانفصال (12 شهراً)', 'Separation reasons (12 months)'))}</h2>${bars(m.byReason, { title: L('أسباب الانفصال', 'Separation reasons') })}</section></div>`;
  });

  // ---------- Liabilities, diversity & localization (CD) ----------
  EXT.cdDash.push(() => {
    const reg = regular();
    const eos = reg.reduce((s, e) => s + Math.floor(serviceDays(e) / 365.25) * H.policyFor(e).separation.severanceMonthsPerYear * H.toBase(e), 0);
    const lv = reg.reduce((s, e) => s + Math.max(0, balances(e).annual.available) * (H.toBase(e) / D.POLICY.workingDaysPerMonth), 0);
    const all = D.employees.slice(); const lead = all.filter((e) => e.grade >= 8);
    const pct = (a, b) => (b ? (a / b) * 100 : 0);
    const women = pct(all.filter((e) => e.gender === 'F').length, all.length); const womenLead = pct(lead.filter((e) => e.gender === 'F').length, lead.length);
    const natLead = pct(lead.filter((e) => e.staffType !== 'INTL').length, lead.length); const dis = pct(all.filter((e) => e.disability).length, all.length);
    const vol = D.employees.filter((e) => e.category === 'DAILY').length; const uae = all.filter((e) => e.country === 'AE'); const natUae = pct(uae.filter((e) => e.staffType === 'NATL').length, uae.length);
    return `<div class="grid g-2">
      <section class="card"><h2>${esc(L('الالتزامات المالية تجاه الموظفين', 'Staff-related liabilities'))}</h2><div class="stat-list">
        <div class="row"><span>${esc(L('مكافأة نهاية الخدمة المتراكمة', 'Accrued end-of-service benefit'))} ${rule('SP-004')}</span><b>${money(eos)}</b></div>
        <div class="row"><span>${esc(L('الإجازات المستحقة غير المستخدمة', 'Unused accrued leave'))} ${rule('LV-015')}</span><b>${money(lv)}</b></div>
        <div class="row"><span>${esc(L('الإجمالي', 'Total'))}</span><b>${money(eos + lv)}</b></div></div>
        <p class="subtle" style="margin:8px 0 0">${esc(L('يُحدَّث شهرياً للمالية كمخصص محاسبي.', 'Updated monthly for Finance as an accounting provision.'))} ${rule('KP-003')}</p></section>
      <section class="card"><h2>${esc(L('التنوع والتوطين', 'Diversity & localization'))} ${rule('DI-001')}</h2><div class="stat-list">
        <div class="row"><span>${esc(L('النساء من إجمالي الموظفين', 'Women in the workforce'))}</span><b>${fmtN(women, 1)}%</b></div>
        <div class="row"><span>${esc(L('النساء في المناصب القيادية (G8+)', 'Women in leadership (G8+)'))}</span><b>${fmtN(womenLead, 1)}%</b></div>
        <div class="row"><span>${esc(L('المواطنون في القيادة', 'Nationals in leadership'))} ${rule('DI-002')}</span><b>${fmtN(natLead, 1)}%</b></div>
        <div class="row"><span>${esc(L('موظفون من ذوي الإعاقة', 'Staff with disabilities'))} ${rule('DI-003')}</span><b>${fmtN(dis, 1)}%</b></div>
        <div class="row"><span>${esc(L('نسبة التوطين في فرع دبي', 'Emiratisation rate, Dubai branch'))}</span><b>${fmtN(natUae, 1)}%</b></div>
        <div class="row"><span>${esc(L('العمالة اليومية', 'Daily labour'))} ${rule('CAT-007')}</span><b>${fmtN(vol)}</b></div></div>
        <p class="subtle" style="margin:8px 0 0">${esc(L('مؤشرات تتابعها الإدارة والجهات الرقابية في كل دولة.', 'Indicators tracked by management and regulators in each country.'))}</p></section></div>`;
  });

  // ---------- Countries of operation (one policy set and currency each) ----------
  const cSum = (c) => { const offs = D.OFFICES.filter((o) => o.country === c.id); const n = D.employees.filter((e) => e.country === c.id).length; return L(`${offs.length} مقار · ${n} موظفا · ${H.curLabel(c.currency)} · ${T(c.law)}`, `${offs.length} location${offs.length > 1 ? 's' : ''} · ${n} staff · ${H.curLabel(c.currency)} · ${T(c.law)}`); };
  EXT.topbar.push(() => `<button class="ws-switch hide-md" data-act="menu-country" aria-haspopup="menu" title="${esc(L('دول العمل', 'Countries of operation'))}">${icon('globe', 14)}<span class="wl">${esc(L('مصر والإمارات', 'Egypt & UAE'))}</span>${icon('down', 12)}</button>`);
  EXT.actions['menu-country'] = (t) => openMenu(t, `<div class="menu-label">${esc(L('دول العمل', 'Countries of operation'))}</div>${D.COUNTRIES.map((c) => mItem('noop', 'globe', T(c), '', cSum(c), c.id === 'EG')).join('')}<div class="menu-sep"></div>${mItem('country-add', 'plus', L('إضافة دولة', 'Add a country'), '', L('لكل دولة مجموعة سياسات وعملة حسب قانون عملها', 'Each country gets its own policy set and currency under local labour law'))}`, 'start', 'country');
  EXT.actions.noop = () => {};
  EXT.actions['country-add'] = () => toast(L('في النسخة الفعلية: تضاف دولة جديدة بنسخة من مجموعة السياسات لتعديلها حسب قانون العمل المحلي.', 'In production: a new country is added with a copy of the policy set to adapt to local labour law.'));
})();
