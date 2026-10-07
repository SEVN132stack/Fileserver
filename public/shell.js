// Nieuwe app-indeling (v3.42). Bouwt zijbalk, topbalk-zoeken, menu's, een
// selectiebalk, een ⋯-menu per bestand en een commandopalet (Ctrl/⌘+K).
//
// Bestaande knoppen worden VERPLAATST (niet nagebouwd): hun id's en event-handlers
// uit app.js blijven werken. Ontbreekt een knop, dan wordt hij simpelweg overgeslagen.
(function () {
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (html) e.innerHTML = html; return e; };

  // Label + pictogram per knop. Knoppen met data-i18n behouden hun vertaling.
  const LABELS = {
    tasksBtn: ['✅', 'Mijn taken'], autoBtn: ['⚙️', 'Automatisering'], sharingBtn: ['🤝', 'Delen & portalen'], guestsBtn: ['🎟️', 'Gasttoegang'],
    teamsBtn: ['👥', 'Teamruimtes'], inboundBtn: ['📥', 'Invoer & integraties'], insightsBtn: ['📈', 'Inzicht'],
    organizeBtn: ['🗂️', 'Ordenen'], aiBtn: ['🤖', 'AI-assistent'], snapBtn: ['📸', 'Snapshots'], jobsBtn: ['🧰', 'Achtergrondtaken'],
    '2faBtn': ['🔐', null], passkeyBtn: ['🔑', 'Passkeys'], pwBtn: ['🔒', 'Wachtwoord wijzigen'], sessionsBtn: ['🖥️', 'Actieve sessies'],
    secBtn: ['🛡️', 'Apparaten & beveiliging'], apikeyBtn: ['🗝️', 'API-sleutels'], jitBtn: ['⏫', 'Tijdelijke rechten'],
    clientsBtn: ['📲', 'Koppelen & netwerkschijf'], viewBtn: ['📊', 'Lijst / raster'], lowbwBtn: ['🐢', 'Laagbandbreedte'],
    hcBtn: ['◐', 'Hoog contrast'], kioskBtn: ['🔒', 'Kioskmodus'], adminBtn: ['🛠️', null], logoutBtn: ['⎋', null],
    dropLinkBtn: ['📤', 'Drop-link (laat anderen uploaden)'], galleryBtn: ['🖼️', 'Galerij'], dupBtn: ['🧬', 'Duplicaten'],
    cleanBtn: ['🧹', 'Opruimadvies'], snipBtn: ['🔍', 'Zoeken in inhoud'], savedBtn: ['⭐', 'Zoekopdrachten & collecties'],
    tagGalBtn: ['🏷️', 'Tag-galerij'], bgZipBtn: ['⏳', 'Map als ZIP (achtergrond)'], thumbsJobBtn: ['🖼️', 'Previews voorbereiden'],
    bulkDl: ['⬇', null], bulkMove: ['↪', 'Verplaatsen'], bulkTag: ['🏷️', 'Taggen'], bulkDel: ['🗑', null],
  };
  function relabel(btn) {
    const spec = LABELS[btn.id]; if (!spec) return btn;
    const keep = [...btn.children].filter((c) => c.id); // bv. teller-badges
    const i18n = btn.getAttribute('data-i18n');
    const lbl = el('span', { class: 'lbl' });
    if (i18n) { lbl.setAttribute('data-i18n', i18n); lbl.textContent = btn.textContent.trim(); btn.removeAttribute('data-i18n'); }
    else lbl.textContent = spec[1] || btn.title || btn.textContent.trim();
    btn.textContent = '';
    btn.append(el('span', { class: 'ico', 'aria-hidden': 'true' }, spec[0]), lbl, ...keep);
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', lbl.textContent);
    return btn;
  }
  const take = (id) => { const b = $(id); return b ? relabel(b) : null; };

  function group(title, ids, extra = []) {
    const g = el('div', { class: 'nav-group' });
    if (title) g.append(el('div', { class: 'nav-title' }, title));
    for (const id of ids) { const b = take(id); if (b) g.append(b); }
    for (const x of extra) g.append(x);
    return g;
  }

  // Groep inklapbaar maken via de titel; de stand wordt per browser onthouden.
  function collapsible(g, key) {
    const t = g.querySelector('.nav-title'); if (!t) return g;
    const k = 'navCollapsed:' + key;
    let closed = true; try { closed = localStorage.getItem(k) !== '0'; } catch { /* nvt */ }
    const btn = el('button', { type: 'button', class: 'nav-title nav-toggle', 'aria-expanded': String(!closed) });
    btn.textContent = t.textContent; t.replaceWith(btn);
    g.classList.toggle('collapsed', closed);
    // Tellers (bv. lopende achtergrondtaken) blijven zichtbaar op de titel als
    // de groep is ingeklapt.
    const badge = el('span', { class: 'nav-badge' }); badge.hidden = true; btn.append(badge);
    const sync = () => {
      const n = [...g.querySelectorAll('[id$="Count"]')].filter((c) => c.style.display !== 'none').reduce((a, c) => a + (parseInt(c.textContent, 10) || 0), 0);
      // Alleen bij verandering schrijven: de badge zit zelf in de bewaakte groep,
      // dus elke schrijfactie zou de observer opnieuw laten afgaan (oneindige lus).
      if (badge.textContent !== String(n)) badge.textContent = n;
      if (badge.hidden !== !n) badge.hidden = !n;
    };
    new MutationObserver(sync).observe(g, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    sync();
    btn.onclick = (e) => {
      e.stopPropagation();
      const c = g.classList.toggle('collapsed'); btn.setAttribute('aria-expanded', String(!c));
      try { localStorage.setItem(k, c ? '1' : '0'); } catch { /* nvt */ }
    };
    return g;
  }

  function build() {
    const header = document.querySelector('body > header');
    const main = document.querySelector('body > main');
    if (!header || !main || document.body.classList.contains('shell')) return;
    document.body.classList.add('shell');

    // --- Topbalk: menuknop, (merk)naam, zoeken, palet, meldingen, gebruiker ---
    const h1 = header.querySelector('h1');
    if (h1) h1.innerHTML = '<span class="logo">📁</span><span class="appname">SFTP Fileserver</span>';
    const menuToggle = el('button', { id: 'menuToggle', class: 'ghost', 'aria-label': 'Menu' }, '☰');
    header.prepend(menuToggle);
    menuToggle.onclick = () => document.body.classList.toggle('nav-open');
    const top = el('div', { id: 'topSearch' });
    const search = $('search'); const cs = $('contentSearch');
    if (search) top.append(search);
    if (cs) top.append(cs.closest('label') || cs);
    h1 ? h1.after(top) : header.prepend(top);
    const pal = el('button', { id: 'paletteBtn', class: 'ghost', title: 'Commandopalet (Ctrl+K)' }, '⌘ <span>Opdrachten</span> <kbd>Ctrl K</kbd>');
    const notif = $('notifBtn');
    const who = $('who');
    const spacer = header.querySelector('.spacer');
    (spacer || top).after(pal);
    if (notif) pal.after(notif);

    // --- Zijbalk ---
    const side = el('nav', { id: 'sidebar', 'aria-label': 'Hoofdnavigatie' });
    const tabs = main.querySelector('.tabs');
    if (tabs) { tabs.classList.add('nav-group'); tabs.prepend(el('div', { class: 'nav-title' }, 'Bestanden')); side.append(tabs);
      const icons = { files: '📁', shared: '👥', trash: '🗑' };
      tabs.querySelectorAll('button[data-tab]').forEach((b) => { const i18n = b.getAttribute('data-i18n'); const lbl = el('span', { class: 'lbl' }); lbl.textContent = b.textContent.trim(); if (i18n) { lbl.setAttribute('data-i18n', i18n); b.removeAttribute('data-i18n'); } b.textContent = ''; b.append(el('span', { class: 'ico' }, icons[b.dataset.tab] || '•'), lbl); });
    }
    side.append(collapsible(group('Werken', ['tasksBtn', 'jobsBtn', 'autoBtn', 'sharingBtn', 'guestsBtn', 'teamsBtn', 'inboundBtn', 'insightsBtn', 'organizeBtn', 'aiBtn', 'snapBtn']), 'werken'));
    const account = group('Account & beveiliging', ['2faBtn', 'passkeyBtn', 'pwBtn', 'sessionsBtn', 'secBtn', 'apikeyBtn', 'jitBtn', 'clientsBtn']);
    // Weergave: stijlkiezer + taal + weergaveopties.
    const styleRow = el('div', { class: 'navrow' }, '<span class="ico">🎨</span><span class="lbl">Stijl</span>');
    const sel = el('select', { id: 'styleSelect', 'aria-label': 'Stijl kiezen' },
      '<option value="systeem">Systeem</option><option value="licht">Licht & rustig</option><option value="donker">Donker & modern</option><option value="zakelijk">Zakelijk</option>');
    sel.value = (window.currentStyleChoice && window.currentStyleChoice()) || 'systeem';
    sel.onchange = () => { window.setStyle && window.setStyle(sel.value); };
    styleRow.append(sel);
    const langRow = el('div', { class: 'navrow' }, '<span class="ico">🌐</span><span class="lbl">Taal</span>');
    const lb = $('langBtn'); if (lb) { lb.classList.remove('ghost'); langRow.append(lb); }
    const view = group('Weergave', ['viewBtn', 'lowbwBtn', 'hcBtn', 'kioskBtn'], [styleRow, langRow]);
    const quota = $('quota');
    const bottom = group('', ['adminBtn']);
    if (quota) bottom.prepend(quota);
    side.append(bottom);
    // Accountmenu rechtsboven (onder de gebruikersnaam): account, beveiliging,
    // weergave en uitloggen. Houdt de zijbalk kort.
    const acct = el('div', { class: 'menu', id: 'accountMenu' });
    const acctBtn = el('button', { class: 'ghost menu-toggle', 'aria-haspopup': 'true', 'aria-expanded': 'false', title: 'Account & weergave' });
    acctBtn.append(el('span', { 'aria-hidden': 'true' }, '👤'));
    if (who) acctBtn.append(who);
    acctBtn.append(el('span', { 'aria-hidden': 'true' }, ' ▾'));
    const acctPop = el('div', { class: 'menu-pop right', role: 'menu' }); acctPop.hidden = true;
    acctPop.append(account, el('hr'), view, el('hr'), group('', ['logoutBtn']));
    acct.append(acctBtn, acctPop);
    (notif || pal).after(acct);
    const tb = $('themeBtn'); if (tb) tb.style.display = 'none';
    // Sluit de mobiele zijbalk na een keuze.
    side.addEventListener('click', (e) => { if (e.target.closest('button') && !e.target.closest('.navrow')) document.body.classList.remove('nav-open'); });
    document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('#sidebar') && !e.target.closest('#menuToggle')) document.body.classList.remove('nav-open'); });
    document.body.insertBefore(side, main);

    buildToolbar(main);
    observeRows();
    buildPalette();
  }

  // --- Werkbalk: Nieuw / Uploaden / Hulpmiddelen / sorteren + selectiebalk ---
  function menu(label, items, right) {
    const wrap = el('div', { class: 'menu' });
    const t = el('button', { class: 'ghost menu-toggle', 'aria-haspopup': 'true', 'aria-expanded': 'false' }, label);
    const pop = el('div', { class: 'menu-pop' + (right ? ' right' : ''), role: 'menu' }); pop.hidden = true;
    for (const it of items) if (it) pop.append(it);
    wrap.append(t, pop);
    return wrap;
  }
  function actionBtn(icon, label, fn) { const b = el('button', { type: 'button' }); b.append(el('span', { class: 'ico' }, icon), el('span', { class: 'lbl' }, label)); b.onclick = fn; return b; }

  function buildToolbar(main) {
    const oldBar = $('mkdirBtn') && $('mkdirBtn').closest('.bar');
    if (!oldBar) return;
    const bar = el('div', { class: 'toolbar' });
    const mk = $('mkdirBtn'); const nf = $('newfileBtn');
    if (mk) bar.append(mk);
    if (nf) bar.append(nf);
    const pick = (id) => () => { const i = $(id); if (i) i.click(); };
    bar.append(menu('⬆ Uploaden ▾', [actionBtn('📄', 'Bestanden…', pick('fileInput')), actionBtn('📁', 'Map…', pick('dirInput')), actionBtn('📷', 'Foto of camera…', pick('camInput'))]));
    bar.append(menu('🧰 Hulpmiddelen ▾', ['dropLinkBtn', 'galleryBtn', 'tagGalBtn', 'savedBtn', 'snipBtn', null, 'dupBtn', 'cleanBtn', null, 'bgZipBtn', 'thumbsJobBtn']
      .map((id) => (id === null ? el('hr') : take(id)))));
    bar.append(el('div', { class: 'grow' }));
    for (const id of ['sort', 'order', 'refreshBtn']) { const x = $(id); if (x) bar.append(x); }
    // Selectiebalk (alleen zichtbaar als er iets geselecteerd is).
    const selBar = el('div', { id: 'selBar', role: 'region', 'aria-label': 'Selectie' }, '<span class="count"></span>');
    for (const id of ['bulkDl', 'bulkMove', 'bulkTag', 'bulkDel']) { const b = take(id); if (b) selBar.append(b); }
    const clear = el('button', { class: 'ghost', type: 'button' }, 'Selectie wissen');
    clear.onclick = () => { document.querySelectorAll('#rows input[data-sel]:checked').forEach((c) => { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }); updateSel(); };
    selBar.append(clear);
    // Resterende elementen uit de oude balk (bijv. zoekcheckbox die al verplaatst is) meenemen.
    oldBar.replaceWith(bar);
    bar.after(selBar);
  }
  function updateSel() {
    const n = document.querySelectorAll('#rows input[data-sel]:checked').length;
    const bar = $('selBar'); if (!bar) return;
    bar.classList.toggle('show', n > 0);
    const c = bar.querySelector('.count'); if (c) c.textContent = `${n} geselecteerd`;
  }
  document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('#rows input[data-sel], input[type=checkbox]')) setTimeout(updateSel, 0); });

  // Menu's openen/sluiten (één tegelijk; buiten klikken of Esc sluit).
  function closeMenus(except) {
    document.querySelectorAll('.menu-pop').forEach((p) => { if (p !== except) { p.hidden = true; p.previousElementSibling && p.previousElementSibling.setAttribute('aria-expanded', 'false'); } });
    document.querySelectorAll('.rowmenu.open').forEach((m) => { if (m !== except) m.classList.remove('open'); });
  }
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.menu-toggle');
    if (toggle) { const pop = toggle.nextElementSibling; const open = pop.hidden; closeMenus(pop); pop.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); return; }
    const more = e.target.closest('.rowmore');
    if (more) {
      const m = more.nextElementSibling; const willOpen = !m.classList.contains('open'); closeMenus(m);
      m.classList.toggle('open', willOpen);
      if (willOpen) placeRowMenu(more, m);
      return;
    }
    // Klik op een menu-item: actie loopt via de bestaande handler; daarna sluiten.
    if (e.target.closest('.menu-pop button, .rowmenu button')) { setTimeout(() => closeMenus(), 0); return; }
    if (!e.target.closest('.menu-pop') && !e.target.closest('.rowmenu')) closeMenus();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
  // Rij-menu vast t.o.v. het venster plaatsen: zo valt het nooit buiten een
  // omliggende container weg. Opent omhoog als er onder te weinig plek is en
  // krijgt anders een scrollbalk.
  function placeRowMenu(btn, m) {
    const b = btn.getBoundingClientRect(); const gap = 4; const pad = 8;
    Object.assign(m.style, { position: 'fixed', top: '', bottom: '', left: '', right: '', maxHeight: '', overflowY: '' });
    const below = window.innerHeight - b.bottom - gap - pad; const above = b.top - gap - pad;
    const h = m.scrollHeight; const up = h > below && above > below;
    const room = up ? above : below;
    if (h > room) Object.assign(m.style, { maxHeight: room + 'px', overflowY: 'auto' });
    if (up) m.style.bottom = (window.innerHeight - b.top + gap) + 'px'; else m.style.top = (b.bottom + gap) + 'px';
    m.style.right = Math.max(pad, window.innerWidth - b.right) + 'px';
  }
  window.addEventListener('resize', () => closeMenus());
  document.addEventListener('scroll', (e) => { if (!(e.target.closest && e.target.closest('.rowmenu'))) document.querySelectorAll('.rowmenu.open').forEach((m) => m.classList.remove('open')); }, true);

  // --- ⋯-menu per rij: primaire knop zichtbaar, de rest in een menu ---
  function labelFor(b) {
    const txt = b.textContent.trim();
    const title = b.title || b.getAttribute('aria-label') || '';
    const known = { '⬇': 'Downloaden', 'ZIP': 'Download als ZIP', '✎': 'Bewerken', '✏': 'Hernoemen', '🗑': 'Verwijderen', '🔗': 'Deel-link', '🏷': 'Tags & commentaar', '∞': 'Vaste link', '🕘': 'Versies', '🔒': 'Vergrendelen', '📌': 'Vastzetten', '⟳': 'Delta-sync', '🛠': 'Media bewerken', '✍️': 'Ondertekenen', '🔍': 'Beeldherkenning', '👥': 'Delen met gebruiker' };
    return title || known[txt] || txt;
  }
  function processRow(actions) {
    if (actions.dataset.shell) return;
    const btns = [...actions.querySelectorAll(':scope > button')];
    if (btns.length <= 2) { actions.dataset.shell = '1'; return; }
    actions.dataset.shell = '1';
    const primary = btns.find((b) => b.dataset.dl || b.dataset.zip) || btns[0];
    const more = el('button', { class: 'ghost rowmore', type: 'button', 'aria-label': 'Meer acties', title: 'Meer acties' }, '⋯');
    const m = el('div', { class: 'rowmenu', role: 'menu' });
    for (const b of btns.filter((x) => x !== primary)) {
      const ico = b.textContent.trim(); const lbl = labelFor(b);
      b.textContent = '';
      const icoEl = el('span', { class: 'ico' }); icoEl.textContent = ico.length <= 3 ? ico : '•';
      const lblEl = el('span', { class: 'lbl' }); lblEl.textContent = lbl;
      b.append(icoEl, lblEl);
      m.append(b);
    }
    actions.textContent = '';
    actions.append(primary, more, m);
  }
  function observeRows() {
    const rows = $('rows'); if (!rows) return;
    const run = () => { rows.querySelectorAll('td.actions').forEach(processRow); updateSel(); };
    new MutationObserver(run).observe(rows, { childList: true, subtree: true });
    run();
  }

  // --- Commandopalet ---
  let palItems = []; let palSel = 0;
  function collect() {
    const out = [];
    const add = (label, grp, fn) => { if (label) out.push({ label, grp, fn }); };
    document.querySelectorAll('#sidebar button:not(.nav-toggle), #accountMenu .menu-pop button').forEach((b) => { if (b.offsetParent !== null || b.closest('.nav-group')) { const l = b.querySelector('.lbl'); if (b.style.display !== 'none') add((l ? l.textContent : b.textContent).trim(), 'Menu', () => b.click()); } });
    document.querySelectorAll('.toolbar > button, .toolbar .menu-pop button').forEach((b) => { const l = b.querySelector('.lbl'); add((l ? l.textContent : b.textContent).trim(), 'Bestanden', () => b.click()); });
    for (const [v, n] of [['licht', 'Licht & rustig'], ['donker', 'Donker & modern'], ['zakelijk', 'Zakelijk'], ['systeem', 'Systeem']]) add('Stijl: ' + n, 'Weergave', () => { window.setStyle && window.setStyle(v); const s = $('styleSelect'); if (s) s.value = v; });
    document.querySelectorAll('#rows .name[data-dir]').forEach((nm) => add('Open map: ' + nm.textContent.replace('📂', '').trim(), 'Mappen', () => nm.click()));
    return out;
  }
  function renderPal(q) {
    const ul = $('palList'); const needle = q.trim().toLowerCase();
    palItems = collect().filter((i) => !needle || i.label.toLowerCase().includes(needle)).slice(0, 40);
    palSel = 0;
    ul.innerHTML = '';
    palItems.forEach((it, i) => { const li = el('li', { role: 'option' }); li.append(document.createTextNode(it.label), el('span', { class: 'grp' }, it.grp)); if (i === 0) li.classList.add('sel'); li.onclick = () => runPal(i); ul.append(li); });
    if (!palItems.length) ul.append(el('li', {}, '<span class="grp">Geen resultaten</span>'));
  }
  function runPal(i) { const it = palItems[i]; closePal(); if (it) setTimeout(it.fn, 0); }
  function openPal() { const p = $('palette'); p.classList.add('open'); const inp = $('palInput'); inp.value = ''; renderPal(''); inp.focus(); }
  function closePal() { const p = $('palette'); if (p) p.classList.remove('open'); }
  function buildPalette() {
    const p = el('div', { id: 'palette', role: 'dialog', 'aria-label': 'Commandopalet' }, '<div class="box"><input id="palInput" placeholder="Typ een opdracht, functie of map…" autocomplete="off"><ul id="palList" role="listbox"></ul></div>');
    document.body.append(p);
    p.addEventListener('click', (e) => { if (e.target === p) closePal(); });
    $('palInput').addEventListener('input', (e) => renderPal(e.target.value));
    $('palInput').addEventListener('keydown', (e) => {
      const lis = [...document.querySelectorAll('#palList li')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); palSel = (palSel + (e.key === 'ArrowDown' ? 1 : -1) + lis.length) % Math.max(1, lis.length); lis.forEach((l, i) => l.classList.toggle('sel', i === palSel)); lis[palSel] && lis[palSel].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); runPal(palSel); }
      else if (e.key === 'Escape') closePal();
    });
    const pb = $('paletteBtn'); if (pb) pb.onclick = openPal;
    document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('palette').classList.contains('open') ? closePal() : openPal(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
