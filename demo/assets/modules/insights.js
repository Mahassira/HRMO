/* HRMO module — HR metrics, end-of-service liability, diversity & localization, volunteers,
 * country-office selector. Rules: KP-001..005, DI-001..004, SP-004, CAT-007. */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, L, T, esc, icon, fmtN, fmtD, money, daysBetween, badge, rule, toast, store, kpi, bars, serviceDays, balances, openMenu, mItem } = H;
  H.CAT.VOLUNTEER = { ar: 'عامل بحوافز / متطوع', en: 'Incentive worker / volunteer' };
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
    const eos = reg.reduce((s, e) => s + Math.floor(serviceDays(e) / 365.25) * D.POLICY.separation.severanceMonthsPerYear * e.baseSalary, 0);
    const lv = reg.reduce((s, e) => s + Math.max(0, balances(e).annual.available) * (e.baseSalary / D.POLICY.workingDaysPerMonth), 0);
    const all = D.employees.filter((e) => e.category !== 'VOLUNTEER'); const lead = all.filter((e) => e.grade >= 8);
    const pct = (a, b) => (b ? (a / b) * 100 : 0);
    const women = pct(all.filter((e) => e.gender === 'F').length, all.length); const womenLead = pct(lead.filter((e) => e.gender === 'F').length, lead.length);
    const natLead = pct(lead.filter((e) => e.staffType !== 'INTL').length, lead.length); const dis = pct(all.filter((e) => e.disability).length, all.length);
    const vol = D.employees.filter((e) => e.category === 'VOLUNTEER').length;
    return `<div class="grid g-2">
      <section class="card"><h2>${esc(L('الالتزامات المالية تجاه الموظفين', 'Staff-related liabilities'))}</h2><div class="stat-list">
        <div class="row"><span>${esc(L('مكافأة نهاية الخدمة المتراكمة', 'Accrued end-of-service benefit'))} ${rule('SP-004')}</span><b>${money(eos)}</b></div>
        <div class="row"><span>${esc(L('الإجازات المستحقة غير المستخدمة', 'Unused accrued leave'))} ${rule('LV-015')}</span><b>${money(lv)}</b></div>
        <div class="row"><span>${esc(L('الإجمالي', 'Total'))}</span><b>${money(eos + lv)}</b></div></div>
        <p class="subtle" style="margin:8px 0 0">${esc(L('يُحدَّث شهرياً للمالية كمخصص محاسبي.', 'Updated monthly for Finance as an accounting provision.'))} ${rule('KP-003')}</p></section>
      <section class="card"><h2>${esc(L('التنوع والتوطين', 'Diversity & localization'))} ${rule('DI-001')}</h2><div class="stat-list">
        <div class="row"><span>${esc(L('النساء من إجمالي الموظفين', 'Women in the workforce'))}</span><b>${fmtN(women, 1)}%</b></div>
        <div class="row"><span>${esc(L('النساء في المناصب القيادية (G8+)', 'Women in leadership (G8+)'))}</span><b>${fmtN(womenLead, 1)}%</b></div>
        <div class="row"><span>${esc(L('الكوادر الوطنية في القيادة', 'National staff in leadership'))} ${rule('DI-002')}</span><b>${fmtN(natLead, 1)}%</b></div>
        <div class="row"><span>${esc(L('موظفون من ذوي الإعاقة', 'Staff with disabilities'))} ${rule('DI-003')}</span><b>${fmtN(dis, 1)}%</b></div>
        <div class="row"><span>${esc(L('عاملون بحوافز ومتطوعون', 'Incentive workers & volunteers'))} ${rule('CAT-007')}</span><b>${fmtN(vol)}</b></div></div>
        <p class="subtle" style="margin:8px 0 0">${esc(L('مؤشرات يطلبها المانحون في التقارير.', 'Indicators donors ask for in reports.'))}</p></section></div>`;
  });

  // ---------- Country office selector ----------
  EXT.topbar.push(() => `<button class="ws-switch hide-md" data-act="menu-country" aria-haspopup="menu" title="${esc(L('المكتب القُطري', 'Country office'))}">${icon('globe', 14)}<span class="wl">${esc(L('الدولة النموذجية', 'Sample Country'))}</span>${icon('down', 12)}</button>`);
  EXT.actions['menu-country'] = (t) => openMenu(t, `<div class="menu-label">${esc(L('المكاتب القُطرية', 'Country offices'))}</div>${mItem('noop', 'globe', L('الدولة النموذجية', 'Sample Country'), '', L(`${D.OFFICES.length} مكاتب · ${D.employees.length} موظفاً · مجموعة سياسات نموذجية`, `${D.OFFICES.length} offices · ${D.employees.length} staff · Sample policy set`), true)}<div class="menu-sep"></div>${mItem('country-add', 'plus', L('إضافة مكتب قُطري', 'Add a country office'), '', L('لكل دولة مجموعة سياسات حسب قانون عملها', 'Each country gets its own policy set per local labor law'))}`, 'start', 'country');
  EXT.actions.noop = () => {};
  EXT.actions['country-add'] = () => toast(L('في النسخة الفعلية: يُنشأ مكتب قُطري جديد بنسخة من مجموعة السياسات لتعديلها حسب قانون العمل المحلي.', 'In production: a new country office is created with a copy of the policy set to adapt to local labor law.'));
})();
