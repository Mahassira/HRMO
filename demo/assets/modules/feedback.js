/* HRMO module — pilot welcome screen and tester feedback.
 * The welcome screen opens on the first visit (or from the Pilot menu). Feedback is kept in the browser
 * and, when config.js has an endpoint, posted to a form-to-email service. */
(function () {
  'use strict';
  const H = window.HRMO;
  const { S, D, EXT, L, T, esc, icon, fmtD, badge, toast, render, openOverlay, closeOverlay, store, addNav, pageHead, table, modal, emptyState, kpi, TODAY, iso } = H;
  const CFG = (window.HRMO_CONFIG && window.HRMO_CONFIG.feedback) || {};
  const canSend = () => !!CFG.endpoint;

  const TESTER = store('tester', () => ({ name: '', welcomed: false, signedOut: false }));
  const ITEMS = store('feedback', () => []);
  try { const q = new URLSearchParams(location.search).get('tester'); if (q && !TESTER.name) TESTER.name = q.slice(0, 60); } catch (e) { /* ignore */ }

  const TYPES = { POLICY: ['سياسة أو قاعدة غير دقيقة', 'Policy or rule is inaccurate'], MISSING: ['وظيفة ناقصة', 'Missing feature'], USABILITY: ['صعوبة في الاستخدام', 'Hard to use'], BUG: ['خطأ في النظام', 'Something is broken'], OPINION: ['رأي عام', 'General opinion'] };
  const PRIO = { MUST: ['ضروري قبل الاستخدام', 'Must fix before use'], SHOULD: ['مهم', 'Important'], NICE: ['تحسين', 'Nice to have'] };
  const PRIO_TONE = { MUST: 'danger', SHOULD: 'warning', NICE: 'neutral' };
  const ROLE_CARDS = [
    ['EMPLOYEE', 'person', ['الموظف', 'Employee'], ['اطلب إجازة وشاهد فحص السياسات', 'Request leave and see the policy checks'], ['اطلب خطاب تعريف بالراتب', 'Ask for a salary letter']],
    ['MANAGER', 'people', ['المدير المباشر', 'Line manager'], ['وافق على طلبات الفريق من صندوق واحد', 'Approve team requests from one inbox'], ['افتح تقييم أداء أحد أعضاء الفريق', 'Open a team member appraisal']],
    ['HR', 'doc', ['الموارد البشرية', 'HR'], ['تابع ملف استقبال موظف جديد', 'Follow a new starter onboarding file'], ['أنه خدمة موظف حتى التسوية النهائية', 'Close a separation up to final settlement']],
    ['CD', 'shield', ['المدير القطري', 'Country Director'], ['اعتمد قرارا وشاهد المخالفات تلقائيا', 'Approve a decision with automatic policy flags'], ['راجع الكلفة والالتزامات حسب المنحة', 'Review cost and liabilities by grant']]
  ];

  // ---------- Welcome screen ----------
  // The same screen serves as the first-visit welcome and as the sign-in screen after signing out.
  EXT.overlays.welcome = () => {
    const out = TESTER.signedOut; TESTER.welcomed = true;
    const langs = `<div class="seg" role="group" aria-label="${esc(L('اللغة', 'Language'))}"><button data-act="wl-lang" data-v="ar" aria-pressed="${S.lang === 'ar'}">العربية</button><button data-act="wl-lang" data-v="en" aria-pressed="${S.lang === 'en'}">English</button></div>`;
    const card = ([r, ic, name, a, b]) => { const p = H.empById.get(D.personas[r]); return `<button class="welcome-role" data-act="wl-start" data-role="${r}"><span class="wr-ic">${icon(ic, 20)}</span><span class="wr-t">${esc(L(...name))}</span>${out ? `<span class="wr-d">${esc(T(p.name.short))}</span><span class="wr-d">${esc(T(p.position))}</span>` : `<span class="wr-d">${esc(L(...a))}</span><span class="wr-d">${esc(L(...b))}</span>`}</button>`; };
    const title = out ? L('تسجيل الدخول إلى HRMO', 'Sign in to HRMO') : TESTER.name ? L(`مرحبا ${TESTER.name}`, `Welcome, ${TESTER.name}`) : L('مرحبا بك في HRMO', 'Welcome to HRMO');
    return `<div class="welcome ${out ? 'signin' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="welcome-in">
      <div class="welcome-top"><img src="assets/brand/apple-touch-icon.png" alt="" width="56" height="56">${langs}</div>
      <h1>${esc(title)}</h1>
      ${out ? `<p class="welcome-lead">${esc(L('سجلت خروجك. اختر الحساب الذي تريد الدخول به.', 'You are signed out. Choose the account to sign in with.'))}</p>`
    : `<p class="welcome-lead">${esc(L('نظام لإدارة الموارد البشرية في المؤسسات الإنسانية وغير الربحية. هذه نسخة تجريبية ببيانات وهمية، ونريد رأيك فيها قبل استكمال البناء.', 'An HR management system for humanitarian and non-profit organizations. This is a trial version with fictitious data, and we would like your view before building further.'))}</p>
      <div class="field welcome-name"><label for="wl-name">${esc(L('اسمك (يظهر مع ملاحظاتك)', 'Your name (shown with your feedback)'))}</label><input id="wl-name" class="input" data-wl="name" value="${esc(TESTER.name)}" autocomplete="name" placeholder="${esc(L('اختياري', 'Optional'))}"></div>
      <h2>${esc(L('اختر واجهة للبدء', 'Choose a workspace to start'))}</h2>`}
      <div class="welcome-roles">${ROLE_CARDS.map(card).join('')}</div>
      ${out ? '' : `<div class="welcome-note">${icon('chat', 18)}<div><b>${esc(L('رأيك هو الهدف', 'Your view is the goal'))}</b><br>${esc(L('في أي شاشة اضغط زر "ملاحظة" واكتب ما تراه: قاعدة غير دقيقة، وظيفة ناقصة، أو شيء صعب الاستخدام. تسجل الشاشة التي كنت فيها تلقائيا.', 'On any screen press "Feedback" and write what you see: an inaccurate rule, a missing feature, or something hard to use. The screen you were on is recorded automatically.'))}</div></div>`}
      <p class="welcome-foot">${esc(out ? L('في النسخة الفعلية يدخل كل شخص بحساب العمل ويرى واجهته فقط. هنا تختار الحساب لأن البيانات تجريبية.', 'In production each person signs in with their work account and sees only their own workspace. Here you choose the account because the data is fictitious.') : L('للانتقال إلى واجهة أخرى سجل الخروج من الأيقونة أعلى الصفحة ثم اختر حسابا آخر. كل ما تدخله يحفظ في متصفحك فقط.', 'To move to another workspace, sign out with the icon at the top of the page and choose another account. Everything you enter stays in your browser.'))}</p>
    </div></div>`;
  };
  if (!TESTER.welcomed || TESTER.signedOut) S.overlay = { type: 'welcome' };
  // While signed out the sign-in screen cannot be dismissed.
  EXT.afterRender.push(() => { if (TESTER.signedOut && (!S.overlay || S.overlay.type !== 'welcome')) { S.overlay = { type: 'welcome' }; render(); } });

  // ---------- Feedback form ----------
  const blank = () => ({ type: 'POLICY', priority: 'SHOULD', rating: 0, text: '', area: '' });
  S.fb = blank();
  const here = () => { const h = document.querySelector('.page-head h1'); return h ? h.textContent.trim() : ''; };

  EXT.overlays.feedback = () => modal(L('ملاحظة أو اقتراح تحسين', 'Feedback or improvement'), `<div class="form-grid">
      <div class="field full"><span class="flabel">${esc(L('النوع', 'Type'))}</span><div class="radio-group fb-types">${Object.entries(TYPES).map(([k, v]) => `<label class="radio"><input type="radio" name="fb-type" value="${k}" data-fb="type" ${S.fb.type === k ? 'checked' : ''}><span>${esc(L(...v))}</span></label>`).join('')}</div></div>
      <div class="field full"><label for="fb-text">${esc(L('ماذا لاحظت؟ وما الذي تقترحه؟', 'What did you notice, and what would you suggest?'))}</label><textarea id="fb-text" class="textarea" style="min-height:120px" data-fb="text" placeholder="${esc(L('مثال: مدة الإشعار للإجازة السنوية في مؤسستنا 14 يوما وليست 7.', 'Example: in our organization the notice for annual leave is 14 days, not 7.'))}">${esc(S.fb.text)}</textarea></div>
      <div class="field"><label for="fb-prio">${esc(L('الأهمية', 'Priority'))}</label><select id="fb-prio" class="select" data-fb="priority">${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${S.fb.priority === k ? 'selected' : ''}>${esc(L(...v))}</option>`).join('')}</select></div>
      <div class="field"><span class="flabel">${esc(L('تقييمك لهذه الشاشة (اختياري)', 'Your rating of this screen (optional)'))}</span><div class="rate" role="group">${[1, 2, 3, 4, 5].map((n) => `<button data-act="fb-rate" data-v="${n}" aria-pressed="${S.fb.rating === n}" aria-label="${n}">${n}</button>`).join('')}</div></div>
      <div class="field full"><span class="flabel">${esc(L('الشاشة', 'Screen'))}</span><div class="subtle">${esc(`${H.roleLabel(S.role)} · ${S.fb.area || '—'}`)}</div></div>
    </div>`,
    `<button class="btn" data-act="close-overlay">${esc(L('إلغاء', 'Cancel'))}</button><button class="btn primary" data-act="fb-submit">${icon('send', 14)}${esc(canSend() ? L('إرسال', 'Send') : L('حفظ', 'Save'))}</button>`);

  const asText = (f) => [`[${L(...TYPES[f.type])}] ${L(...PRIO[f.priority])}`, `${L('الشاشة', 'Screen')}: ${f.role} · ${f.area || '—'}`, f.rating ? `${L('التقييم', 'Rating')}: ${f.rating}/5` : '', f.text].filter(Boolean).join('\n');

  async function send(f) {
    if (!canSend()) return false;
    const body = { name: TESTER.name || 'Tester', type: TYPES[f.type][1], priority: PRIO[f.priority][1], rating: f.rating || '', screen: `${f.role} · ${f.area}`, message: f.text, language: f.lang, device: f.device, date: f.date, _subject: `HRMO feedback: ${TYPES[f.type][1]}`, subject: `HRMO feedback: ${TYPES[f.type][1]}` };
    if (CFG.accessKey) body.access_key = CFG.accessKey;
    try {
      const res = await fetch(CFG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      f.sent = res.ok;
    } catch (e) { f.sent = false; }
    return f.sent;
  }

  // ---------- Feedback view ----------
  function vFeedback() {
    const unsent = ITEMS.filter((f) => !f.sent).length;
    const head = [L('التاريخ', 'Date'), L('النوع', 'Type'), L('الشاشة', 'Screen'), L('الملاحظة', 'Feedback'), L('الأهمية', 'Priority'), L('الحالة', 'Status'), ''];
    const rows = ITEMS.slice().reverse().map((f) => `<tr><td class="nowrap"><bdi>${esc(fmtD(f.date))}</bdi></td><td>${esc(L(...TYPES[f.type]))}</td><td>${esc(f.area || '—')}<div class="subtle">${esc(f.role)}</div></td><td style="white-space:pre-wrap;min-width:220px">${esc(f.text)}${f.rating ? `<div class="subtle">${esc(L('التقييم', 'Rating'))}: ${f.rating}/5</div>` : ''}</td><td>${badge(PRIO_TONE[f.priority], L(...PRIO[f.priority]))}</td><td>${f.sent ? badge('ok', L('أرسلت', 'Sent')) : badge('neutral', L('محفوظة هنا', 'Saved here'))}</td><td class="nowrap">${!f.sent && canSend() ? `<button class="btn sm" data-act="fb-resend" data-id="${f.id}">${esc(L('إرسال', 'Send'))}</button> ` : ''}<button class="iconbtn" data-act="fb-del" data-id="${f.id}" aria-label="${esc(L('حذف', 'Delete'))}" title="${esc(L('حذف', 'Delete'))}">${icon('x', 14)}</button></td></tr>`);
    return `<div class="page">${pageHead(L('الملاحظات والتحسينات', 'Feedback & improvements'), esc(L('كل ما سجلته أثناء التجربة: الآراء، القواعد التي تحتاج تعديلا، والوظائف المطلوبة.', 'Everything you recorded during the trial: opinions, rules that need changing, and features you would need.')), `<button class="btn" data-act="wl-open">${icon('help', 14)}${esc(L('دليل التجربة', 'Trial guide'))}</button>${ITEMS.length ? `<button class="btn" data-act="fb-copy">${icon('doc', 14)}${esc(L('نسخ الكل', 'Copy all'))}</button><button class="btn" data-act="fb-mail">${icon('mail', 14)}${esc(L('إرسال بالبريد', 'Send by e-mail'))}</button>` : ''}<button class="btn primary" data-act="fb-open">${icon('plus', 14)}${esc(L('ملاحظة جديدة', 'New feedback'))}</button>`)}
      <div class="grid g-4">${kpi(L('الملاحظات', 'Feedback items'), ITEMS.length, '', 'chat')}${kpi(L('ضروري قبل الاستخدام', 'Must fix before use'), ITEMS.filter((f) => f.priority === 'MUST').length, '', 'flag')}${kpi(L('سياسات وقواعد', 'Policies and rules'), ITEMS.filter((f) => f.type === 'POLICY').length, '', 'doc')}${kpi(L('وظائف ناقصة', 'Missing features'), ITEMS.filter((f) => f.type === 'MISSING').length, '', 'plus')}</div>
      ${!canSend() && ITEMS.length ? `<div class="msg info">${icon('info', 16)}<div>${esc(L('ملاحظاتك محفوظة في هذا المتصفح ولم ترسل بعد. عند الانتهاء اضغط "إرسال بالبريد" لتفتح رسالة جاهزة بكل الملاحظات من بريدك.', 'Your feedback is saved in this browser and has not been sent yet. When you finish, press "Send by e-mail" to open a ready message with all of it from your own mail.'))}</div></div>` : ''}
      ${canSend() && unsent ? `<div class="msg warning">${icon('info', 16)}<div>${esc(L(`${unsent} ملاحظة لم ترسل بعد. تحقق من الاتصال ثم اضغط "إرسال".`, `${unsent} item(s) not sent yet. Check your connection, then press "Send".`))}</div></div>` : ''}
      <section class="card flush">${table(head, rows, emptyState('chat', L('لا ملاحظات بعد', 'No feedback yet'), L('اضغط "ملاحظة" في أي شاشة لتسجيل رأيك.', 'Press "Feedback" on any screen to record your view.')))}</section></div>`;
  }
  ['EMPLOYEE', 'MANAGER', 'HR', 'CD'].forEach((r) => { H.VIEWS[r].feedback = vFeedback; addNav(r, 'pilot', ['التجربة', 'Trial'], { v: 'feedback', ic: 'chat', ar: 'الملاحظات والتحسينات', en: 'Feedback' }); });

  // ---------- Entry points: top bar button and a floating button on small screens ----------
  const fab = document.createElement('button');
  fab.className = 'fb-fab'; fab.dataset.act = 'fb-open';
  document.body.appendChild(fab);
  EXT.topbar.push(() => {
    fab.innerHTML = `${icon('chat', 18)}<span>${esc(L('ملاحظة', 'Feedback'))}</span>`;
    fab.hidden = !!S.overlay;
    return `<button class="btn sm primary fb-top hide-md" data-act="fb-open">${icon('chat', 14)}${esc(L('ملاحظة', 'Feedback'))}</button>`;
  });

  const allText = () => `HRMO — ${L('ملاحظات التجربة', 'trial feedback')}${TESTER.name ? ` — ${TESTER.name}` : ''}\n\n${ITEMS.map((f, i) => `${i + 1}. ${asText(f)}`).join('\n\n')}`;

  Object.assign(EXT.actions, {
    'wl-open': () => openOverlay({ type: 'welcome' }),
    'wl-lang': (t) => { S.lang = t.dataset.v; render(); },
    signout: () => { TESTER.signedOut = true; S.navOpen = false; S.overlay = { type: 'welcome' }; const th = document.getElementById('toast-host'); if (th) th.innerHTML = ''; const tp = document.getElementById('tooltip'); if (tp) tp.hidden = true; render(); },
    'wl-start': (t) => { const was = TESTER.signedOut; TESTER.signedOut = false; S.role = t.dataset.role; S.overlay = null; render(); if (was) { toast(L(`مرحبا ${T(H.persona().name.short)}`, `Welcome, ${T(H.persona().name.short)}`)); return; } toast(L('اضغط "ملاحظة" في أي وقت لتسجيل رأيك.', 'Press "Feedback" at any time to record your view.')); },
    'fb-open': () => { S.fb = Object.assign(blank(), { area: here() }); openOverlay({ type: 'feedback' }); },
    'fb-rate': (t) => { const n = +t.dataset.v; S.fb.rating = S.fb.rating === n ? 0 : n; render(); },
    'fb-submit': async () => {
      if (!S.fb.text.trim()) { toast(L('اكتب ملاحظتك أولا.', 'Write your feedback first.'), 'warn'); return; }
      const f = Object.assign({}, S.fb, { id: `FB-${Date.now()}`, text: S.fb.text.trim(), date: iso(TODAY), role: H.roleLabel(S.role), lang: S.lang, device: `${innerWidth}x${innerHeight}`, sent: false });
      ITEMS.push(f); S.fb = blank(); closeOverlay();
      if (!canSend()) { toast(L('حفظت ملاحظتك. عند الانتهاء أرسلها من "الملاحظات والتحسينات".', 'Saved. When you finish, send it from "Feedback".'), 'ok'); return; }
      const ok = await send(f); render();
      toast(ok ? L('أرسلت ملاحظتك. شكرا لك.', 'Feedback sent. Thank you.') : L('حفظت الملاحظة لكن تعذر الإرسال. أعد المحاولة من "الملاحظات والتحسينات".', 'Saved, but sending failed. Try again from "Feedback".'), ok ? 'ok' : 'warn');
    },
    'fb-resend': async (t) => { const f = ITEMS.find((x) => x.id === t.dataset.id); const ok = await send(f); render(); toast(ok ? L('أرسلت.', 'Sent.') : L('تعذر الإرسال.', 'Sending failed.'), ok ? 'ok' : 'warn'); },
    'fb-del': (t) => { const i = ITEMS.findIndex((x) => x.id === t.dataset.id); if (i >= 0) ITEMS.splice(i, 1); render(); },
    'fb-copy': async () => { try { await navigator.clipboard.writeText(allText()); toast(L('نسخت كل الملاحظات.', 'All feedback copied.'), 'ok'); } catch (e) { toast(L('تعذر النسخ من هذا المتصفح.', 'Copy is not available in this browser.'), 'warn'); } },
    'fb-mail': () => { location.href = `mailto:${CFG.email || ''}?subject=${encodeURIComponent('HRMO feedback')}&body=${encodeURIComponent(allText())}`; }
  });
  EXT.onInput.push((t) => {
    if (t.dataset.wl === 'name') { TESTER.name = t.value.slice(0, 60); return true; }
    if (t.dataset.fb === 'text') { S.fb.text = t.value; return true; }
  });
  EXT.onChange.push((t) => {
    if (t.dataset.fb && t.dataset.fb !== 'text') { S.fb[t.dataset.fb] = t.value; return true; }
    if (t.dataset.wl === 'name') { H.save(); return true; }
  });
})();
