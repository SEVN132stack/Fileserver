'use strict';
const enc = encodeURIComponent;
// HTML-escape voor het veilig tonen van gebruikers-gestuurde tekst (bestandsnamen,
// paden) — voorkomt opgeslagen XSS via een bestandsnaam als "<img onerror=...>".
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
let cwd = '/';
let me = null;
const selected = new Set();

// --- i18n ---
const I18N = {
  nl: { admin:'Beheer', twofa:'2FA', logout:'Uitloggen', files:'Bestanden', shared:'Gedeeld met mij',
    trash:'Prullenbak', drophint:'Sleep bestanden hierheen, of', choose:'kies bestanden', choosedir:'map',
    newfolder:'＋ Nieuwe map', newfile:'＋ Nieuw bestand', bulkdl:'Download selectie', bulkdel:'Verwijder selectie',
    searchph:'Zoeken…', col_name:'Naam', col_size:'Grootte', col_actions:'Acties', empty:'Niets gevonden.' },
  en: { admin:'Admin', twofa:'2FA', logout:'Log out', files:'Files', shared:'Shared with me',
    trash:'Trash', drophint:'Drop files here, or', choose:'choose files', choosedir:'folder',
    newfolder:'＋ New folder', newfile:'＋ New file', bulkdl:'Download selection', bulkdel:'Delete selection',
    searchph:'Search…', col_name:'Name', col_size:'Size', col_actions:'Actions', empty:'Nothing found.' },
  de: { admin:'Verwaltung', twofa:'2FA', logout:'Abmelden', files:'Dateien', shared:'Mit mir geteilt',
    trash:'Papierkorb', drophint:'Dateien hierher ziehen, oder', choose:'Dateien wählen', choosedir:'Ordner',
    newfolder:'＋ Neuer Ordner', newfile:'＋ Neue Datei', bulkdl:'Auswahl herunterladen', bulkdel:'Auswahl löschen',
    searchph:'Suchen…', col_name:'Name', col_size:'Größe', col_actions:'Aktionen', empty:'Nichts gefunden.' },
  fr: { admin:'Admin', twofa:'2FA', logout:'Déconnexion', files:'Fichiers', shared:'Partagé avec moi',
    trash:'Corbeille', drophint:'Déposez des fichiers ici, ou', choose:'choisir des fichiers', choosedir:'dossier',
    newfolder:'＋ Nouveau dossier', newfile:'＋ Nouveau fichier', bulkdl:'Télécharger la sélection', bulkdel:'Supprimer la sélection',
    searchph:'Rechercher…', col_name:'Nom', col_size:'Taille', col_actions:'Actions', empty:'Rien trouvé.' },
  es: { admin:'Administración', twofa:'2FA', logout:'Cerrar sesión', files:'Archivos', shared:'Compartido conmigo',
    trash:'Papelera', drophint:'Arrastra archivos aquí, o', choose:'elegir archivos', choosedir:'carpeta',
    newfolder:'＋ Nueva carpeta', newfile:'＋ Nuevo archivo', bulkdl:'Descargar selección', bulkdel:'Eliminar selección',
    searchph:'Buscar…', col_name:'Nombre', col_size:'Tamaño', col_actions:'Acciones', empty:'Nada encontrado.' },
  it: { admin:'Amministrazione', twofa:'2FA', logout:'Esci', files:'File', shared:'Condivisi con me',
    trash:'Cestino', drophint:'Trascina i file qui, oppure', choose:'scegli file', choosedir:'cartella',
    newfolder:'＋ Nuova cartella', newfile:'＋ Nuovo file', bulkdl:'Scarica selezione', bulkdel:'Elimina selezione',
    searchph:'Cerca…', col_name:'Nome', col_size:'Dimensione', col_actions:'Azioni', empty:'Nulla trovato.' },
  pl: { admin:'Administracja', twofa:'2FA', logout:'Wyloguj', files:'Pliki', shared:'Udostępnione mnie',
    trash:'Kosz', drophint:'Przeciągnij pliki tutaj lub', choose:'wybierz pliki', choosedir:'folder',
    newfolder:'＋ Nowy folder', newfile:'＋ Nowy plik', bulkdl:'Pobierz zaznaczone', bulkdel:'Usuń zaznaczone',
    searchph:'Szukaj…', col_name:'Nazwa', col_size:'Rozmiar', col_actions:'Akcje', empty:'Nic nie znaleziono.' },
  ar: { admin:'الإدارة', twofa:'2FA', logout:'تسجيل الخروج', files:'الملفات', shared:'مشارَك معي',
    trash:'المهملات', drophint:'اسحب الملفات هنا، أو', choose:'اختر الملفات', choosedir:'مجلد',
    newfolder:'＋ مجلد جديد', newfile:'＋ ملف جديد', bulkdl:'تنزيل المحدد', bulkdel:'حذف المحدد',
    searchph:'بحث…', col_name:'الاسم', col_size:'الحجم', col_actions:'إجراءات', empty:'لا شيء.' },
};
const LANGS = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pl', 'ar'];
const RTL = ['ar', 'he', 'fa'];
let lang = localStorage.getItem('lang') || 'nl';
function t(k) { return (I18N[lang] && I18N[lang][k]) || (I18N.en && I18N.en[k]) || k; }
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-ph]').forEach(el => el.placeholder = t(el.dataset.i18nPh));
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
  const lb = document.getElementById('langBtn'); if (lb) lb.textContent = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length].toUpperCase();
}

// --- Thema (incl. hoog-contrast en dag/nacht-planning) ---
function scheduledTheme() {
  // Tussen 07:00 en 19:00 licht, daarbuiten donker.
  const h = new Date().getHours();
  return (h >= 7 && h < 19) ? 'light' : 'dark';
}
// Stijlen (v3.42): licht, donker, zakelijk of systeem. Keuze per gebruiker in
// localStorage 'style'; zonder keuze geldt de standaard van de beheerder.
const STYLES = ['licht', 'donker', 'zakelijk', 'systeem'];
function currentStyleChoice() {
  let s = null; try { s = localStorage.getItem('style'); } catch { /* nvt */ }
  if (!s) { // migratie van de oude thema-sleutel
    let old = null; try { old = localStorage.getItem('theme'); } catch { /* nvt */ }
    s = { dark: 'donker', light: 'licht', auto: 'systeem' }[old] || null;
  }
  if (!STYLES.includes(s)) { try { s = localStorage.getItem('styleDefault'); } catch { s = null; } }
  return STYLES.includes(s) ? s : 'systeem';
}
function applyTheme() {
  let s = currentStyleChoice();
  if (s === 'systeem') s = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'licht' : 'donker';
  const root = document.documentElement;
  root.setAttribute('data-style', s);
  root.setAttribute('data-theme', s === 'donker' ? 'dark' : 'light');
  root.classList.toggle('hc', localStorage.getItem('highContrast') === '1');
}
window.currentStyleChoice = currentStyleChoice;
window.setStyle = (s) => { if (!STYLES.includes(s)) return; try { localStorage.setItem('style', s); } catch { /* nvt */ } applyTheme(); };
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme);
// Leesbare tekstkleur op een (merk)accent.
function contrastOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#ffffff';
  const n = parseInt(m[1], 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#0b1120' : '#ffffff';
}

const fmtSize = (n) => { if (!n) return ''; const u=['B','KB','MB','GB','TB']; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return n.toFixed(i?1:0)+' '+u[i]; };
const isImg = (name) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
const isText = (name) => /\.(txt|md|json|js|mjs|cjs|tsx?|jsx|css|scss|html?|csv|tsv|log|xml|ya?ml|ini|sh|conf|toml|py|sql|go|java|kt|c|h|cpp|cs|rs|php|rb|vue)$/i.test(name);
const isVideo = (name) => /\.(mp4|webm|ogv|mov|m4v|mkv)$/i.test(name);
const isAudio = (name) => /\.(mp3|wav|ogg|oga|flac|m4a|aac)$/i.test(name);
const isMd = (name) => /\.md$/i.test(name);

// Minimale, veilige Markdown-render (escape eerst, dan een subset opmaken).
function renderMarkdown(src) {
  let h = esc(src);
  h = h.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>');
  h = h.replace(/```([\s\S]*?)```/g, (m, c) => `<pre>${c}</pre>`);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  h = h.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/^[-*] (.*)$/gm, '<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  return h.replace(/\n{2,}/g, '<br><br>');
}

async function api(url, opts) { const r = await fetch(url, opts); if (r.status === 401) { window.location = '/login.html'; throw new Error('unauth'); } return r; }

async function loadMe() {
  const r = await api('/api/whoami');
  me = await r.json();
  document.getElementById('who').textContent = (lang==='nl'?'Ingelogd als ':'Signed in as ') + me.user + ' (' + me.role + ')';
  // Huisstijl toepassen (naam/accentkleur).
  if (me.branding) {
    if (me.branding.appName) document.title = me.branding.appName;
    if (me.branding.accent) { document.documentElement.style.setProperty('--accent', me.branding.accent); document.documentElement.style.setProperty('--accent-contrast', contrastOn(me.branding.accent)); }
    if (me.branding.defaultStyle) { try { const had = localStorage.getItem('styleDefault'); localStorage.setItem('styleDefault', me.branding.defaultStyle); if (had !== me.branding.defaultStyle) { applyTheme(); const ss = document.getElementById('styleSelect'); if (ss) ss.value = currentStyleChoice(); } } catch { /* nvt */ } }
    const an = document.querySelector('header h1 .appname'); if (an && me.branding.appName) an.textContent = me.branding.appName;
    // Globale mededeling (banner) voor alle gebruikers.
    let mb = document.getElementById('globalBanner');
    if (me.branding.bannerText) {
      if (!mb) { mb = document.createElement('div'); mb.id = 'globalBanner'; document.body.insertBefore(mb, document.body.firstChild); }
      const colors = { info: '#0ea5e9', warning: '#f59e0b', critical: '#ef4444' };
      mb.style.cssText = `background:${colors[me.branding.bannerLevel]||colors.info};color:#fff;padding:.5rem 1rem;text-align:center;font-size:.9rem`;
      mb.textContent = me.branding.bannerText;
    } else if (mb) { mb.remove(); }
  }
  // Gastmodus: alleen de gedeelde map, geen eigen bestanden of instellingen.
  if (me.role === 'guest') {
    document.body.classList.add('guest');
    if (!document.getElementById('guestBanner')) { const gb = document.createElement('div'); gb.id = 'guestBanner'; gb.className = 'guest-banner'; gb.textContent = `Je bent ingelogd als gast. Toegang tot ${new Date(me.guestExpires).toLocaleDateString()}.`; const m = document.querySelector('main'); if (m) m.prepend(gb); }
    setTimeout(() => showTab('shared'), 0);
  }
  // Impersonatie-banner: toon dat je als een andere gebruiker kijkt.
  let banner = document.getElementById('impBanner');
  if (me.impersonating) {
    if (!banner) { banner = document.createElement('div'); banner.id = 'impBanner';
      banner.style.cssText = 'position:sticky;top:0;z-index:99;background:#b45309;color:#fff;padding:.5rem 1rem;text-align:center;font-size:.9rem';
      document.body.prepend(banner); }
    banner.innerHTML = `👁️ Je bekijkt als <strong>${esc(me.user)}</strong> (admin: ${esc(me.realUser||'')}). <button id="impStop" style="margin-left:.5rem">Stop</button>`;
    document.getElementById('impStop').onclick = async () => { await api('/api/impersonate/stop',{method:'POST'}); location='/admin.html'; };
  } else if (banner) { banner.remove(); }
  // Verplichte wachtwoordwijziging (verlopen wachtwoord).
  if (me.mustChangePassword) changePassword(true);
  // Tweefactor afgedwongen maar nog niet ingeschakeld → forceer inschrijving.
  if (me.require2fa && !me.has2fa) {
    alert(lang==='nl'
      ? 'Tweefactor-authenticatie is verplicht voor je account. Stel het nu in.'
      : 'Two-factor authentication is required for your account. Please set it up now.');
    setup2fa();
  }
  if (me.role === 'admin') document.getElementById('adminBtn').style.display = '';
  const q = document.getElementById('quota');
  const trash = me.trashUsed ? ` · 🗑 ${fmtSize(me.trashUsed)}` : '';
  if (me.quota > 0) {
    const pct = Math.min(100, me.used / me.quota * 100);
    q.innerHTML = `${fmtSize(me.used)} / ${fmtSize(me.quota)} <span class="barwrap"><div style="width:${pct}%"></div></span>${trash}`;
  } else {
    q.textContent = fmtSize(me.used) + (lang==='nl'?' gebruikt':' used') + trash;
  }
}

// Realtime updates: ververs automatisch als er iets wijzigt (ook via SFTP/WebDAV).
function connectEvents() {
  try {
    const es = new EventSource('/api/events');
    es.addEventListener('change', () => { loadMe(); if (document.getElementById('filesView').style.display!=='none') load(); });
    es.addEventListener('job', (ev) => { try { onJobEvent(JSON.parse(ev.data)); } catch {} });
    es.onerror = () => {};
  } catch {}
}

// --- Bestandenweergave ---
async function load() {
  if (document.body.classList.contains('guest')) return; // gasten hebben geen eigen bestanden
  const q = document.getElementById('search').value.trim();
  const sort = document.getElementById('sort').value, order = document.getElementById('order').value;
  const inhoud = document.getElementById('contentSearch')?.checked ? '&content=1' : '';
  const url = `/api/list?path=${enc(cwd)}&sort=${sort}&order=${order}` + (q?`&q=${enc(q)}${inhoud}`:'');
  const data = await (await api(url)).json();
  if (!q) window.__lastNames = new Set((data.items||[]).filter(i => !i.isDir).map(i => i.name));
  renderCrumbs();
  loadDashboard();
  const rows = document.getElementById('rows');
  rows.setAttribute('aria-label', 'Bestanden en mappen');
  rows.innerHTML = '';
  if (!Array.isArray(data.items)) { rows.innerHTML = `<tr><td colspan="5" class="muted">${esc(data.error || 'Kon map niet laden')}</td></tr>`; return; }
  if (!data.items.length) rows.innerHTML = `<tr><td colspan="5" class="muted">${t('empty')}</td></tr>`;
  renderDirSummary(data.items);
  for (const it of data.items) {
    const tr = document.createElement('tr');
    const lowbw = localStorage.getItem('lowbw') === '1';
    // In het raster een grotere thumbnail, zodat de foto de kaart vult.
    const tw = document.body.classList.contains('view-grid') ? 360 : 56;
    // Video's: posterframe via ffmpeg; lukt dat niet (geen ffmpeg, kapot bestand), dan het 🎬-icoon.
    const vidThumb = /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(it.name) && !lowbw
      ? `<img class="thumb" loading="lazy" alt="" src="/api/poster?path=${enc(it.path)}" onerror="this.outerHTML='<span class=&quot;gicon&quot;>🎬</span>'">` : '';
    const icon = it.isDir ? '<span class="gicon">📂</span>' : (isImg(it.name) && !lowbw ? `<img class="thumb" loading="lazy" alt="" src="/api/thumb?path=${enc(it.path)}&w=${tw}">` : (vidThumb || `<span class="gicon">${isVideo(it.name) ? '🎬' : '📄'}</span>`));
    const nameCell = it.isDir
      ? `<div class="name" data-dir="${enc(it.path)}" title="${esc(it.name)}">${icon} <span class="nm">${esc(it.name)}</span></div>`
      : `<div class="name" data-open="${enc(it.path)}" title="${esc(it.name)}">${icon} <span class="nm">${esc(it.name)}</span></div>`;
    let a = '';
    if (it.isDir) a += `<button class="ghost" data-pin="${enc(it.path)}" title="Vastzetten" aria-label="Map vastzetten">📌</button>`;
    if (it.isDir) a += `<button data-zip="${enc(it.path)}">ZIP</button>`;
    else a += `<button data-dl="${enc(it.path)}">⬇</button>`;
    if (!it.isDir && isText(it.name)) a += `<button class="ghost" data-edit="${enc(it.path)}">✎</button>`;
    if (!it.isDir && me && me.office && OFFICE_EXT.test(it.name)) a += `<button class="ghost" data-office="${enc(it.path)}" title="Bewerken in Office">📝</button>`;
    if (!it.isDir && /\.enc$/i.test(it.name)) a += `<button class="ghost" data-dec="${enc(it.path)}">🔓</button>`;
    if (!it.isDir) a += `<button class="ghost" data-sync="${enc(it.path)}" title="Efficiënt bijwerken (delta-sync)">⟳</button>`;
    if (!it.isDir) a += `<button class="ghost" data-ver="${enc(it.path)}">🕘</button>`;
    if (!it.isDir) a += `<button class="ghost" data-lock="${enc(it.path)}" title="Vergrendelen/ontgrendelen">🔒</button>`;
    if (!it.isDir && /\.(jpe?g|png|webp|gif|tiff?|avif|pdf|mp4|mkv|mov|webm|m4v|mp3|wav|m4a|aac|ogg|flac)$/i.test(it.name)) a += `<button class="ghost" data-media="${enc(it.path)}" title="Media bewerken">🛠</button>`;
    if (!it.isDir) a += `<button class="ghost" data-sign="${enc(it.path)}" title="Ondertekenen/verifiëren" aria-label="Ondertekenen">✍️</button>`;
    if (!it.isDir && /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(it.name)) a += `<button class="ghost" data-vision="${enc(it.path)}" title="Beeldherkenning (labels)">🔍</button>`;
    a += `<button class="ghost" data-meta="${enc(it.path)}">🏷</button>`;
    a += `<button class="ghost" data-ilink="${enc(it.path)}" title="Interne link kopiëren (alleen voor ingelogde gebruikers)">📋</button>`;
    a += `<button class="ghost" data-perma="${enc(it.path)}" title="Vaste link (permalink)">∞</button>`;
    a += `<button class="ghost" data-share="${enc(it.path)}">🔗</button>`;
    a += `<button class="ghost" data-grant="${enc(it.path)}">👥</button>`;
    if (it.isDir) a += `<button class="ghost" data-guest="${enc(it.path)}" title="Gasttoegang (iemand van buiten uitnodigen)">🎟️</button>`;
    a += `<button class="ghost" data-receipt="${enc(it.path)}" title="Leesbevestigingen">📬</button>`;
    a += `<button class="ghost" data-ren="${enc(it.path)}">✏</button>`;
    a += `<button class="danger" data-del="${enc(it.path)}">🗑</button>`;
    const checked = selected.has(it.path) ? 'checked' : '';
    tr.innerHTML = `<td><input type="checkbox" data-sel="${enc(it.path)}" ${checked}></td><td>${nameCell}</td><td class="c-size"${it.isDir ? ` data-dirinfo="${enc(it.path)}"` : ''}>${it.isDir ? '…' : fmtSize(it.size)}</td><td class="c-mtime">${fmtDate(it.mtime)}</td><td class="actions">${a}</td>`;
    // Drag & drop: sleep een bestand op een map om te verplaatsen.
    tr.draggable = true;
    tr.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/fspath', it.path));
    if (it.isDir) {
      tr.addEventListener('dragover', (e) => { e.preventDefault(); tr.style.outline = '2px solid var(--accent)'; });
      tr.addEventListener('dragleave', () => { tr.style.outline = ''; });
      tr.addEventListener('drop', async (e) => {
        e.preventDefault(); tr.style.outline = '';
        const from = e.dataTransfer.getData('text/fspath');
        if (!from || from === it.path) return;
        const to = it.path + '/' + from.split('/').pop();
        await api('/api/rename', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ from, to }) });
        load();
      });
    }
    rows.appendChild(tr);
  }
}
function renderCrumbs() {
  const parts = cwd.split('/').filter(Boolean); let acc='';
  const links = ['<a data-go="/">home</a>'];
  for (const p of parts) { acc += '/'+p; links.push(`<a data-go="${enc(acc)}">${esc(p)}</a>`); }
  document.getElementById('crumbs').innerHTML = links.join(' / ');
}

// --- Preview / editor ---
function openModal(html) { document.getElementById('modalBody').innerHTML = html; document.getElementById('modal').style.display='flex'; }
function closeModal() { document.getElementById('modal').style.display='none'; document.getElementById('modalBody').innerHTML=''; }
async function openFile(p) {
  const name = p.split('/').pop(); const url = '/api/preview?path='+enc(p);
  if (isImg(name)) openModal(`<h3>${esc(name)}</h3><img src="${url}">`);
  else if (isVideo(name)) {
    // mkv/avi gaan via /api/play (eenmalig omgezet naar MP4); de eerste keer kan dat even duren.
    const conv = /\.(mkv|avi)$/i.test(name);
    const vurl = '/api/play?path=' + enc(p);
    openModal(`<h3>${esc(name)}</h3>${conv ? '<p class="muted" id="vidWait">Video wordt voorbereid… (alleen de eerste keer, kan even duren)</p>' : ''}<video src="${vurl}" controls autoplay preload="auto" style="max-width:82vw;max-height:74vh"></video><p class="muted" id="vidErr" hidden>Je browser kan dit videoformaat niet afspelen. Zet het om via 🛠 Media bewerken → MP4, of download het bestand.</p>`);
    // MKV e.d. speelt alleen af als de browser de codecs kent; anders een duidelijke melding.
    const v = document.querySelector('#modalBody video');
    if (v) {
      v.addEventListener('error', () => { const m = document.getElementById('vidErr'); if (m) m.hidden = false; v.hidden = true; const w = document.getElementById('vidWait'); if (w) w.hidden = true; });
      v.addEventListener('loadedmetadata', () => { const w = document.getElementById('vidWait'); if (w) w.hidden = true; });
      videoExtras(p, v);
    }
  }
  else if (isAudio(name)) openModal(`<h3>${esc(name)}</h3><audio src="${url}" controls autoplay style="width:70vw"></audio>`);
  else if (/\.pdf$/i.test(name)) openModal(`<h3>${esc(name)}</h3><iframe src="${url}" style="width:82vw;height:74vh"></iframe>`);
  else if (isMd(name) && window.Preview) { const txt = await (await api(url)).text(); const md = Preview.markdown(txt); openModal(`<h3>${esc(name)}</h3><div class="md-view${md.toc?' has-toc':''}">${md.toc}<article class="md-body">${md.html}</article></div>`); }
  else if (isMd(name)) { const txt = await (await api(url)).text(); openModal(`<h3>${esc(name)}</h3><div style="max-width:80vw;max-height:74vh;overflow:auto;line-height:1.5">${renderMarkdown(txt)}</div>`); }
  else if (/\.(csv|tsv)$/i.test(name) && window.Preview) { const txt = await (await api(url)).text(); openModal(`<h3>${esc(name)}</h3>${Preview.csvTable(txt)}`); }
  else if (window.Preview && Preview.isCode(name)) { const txt = await (await api(url)).text(); openModal(`<h3>${esc(name)}</h3><div style="max-width:84vw;max-height:74vh;overflow:auto">${Preview.code(txt, name.split('.').pop())}</div>`); }
  else if (isText(name)) { const txt = await (await api(url)).text(); openModal(`<h3>${esc(name)}</h3><pre>${txt.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>`); }
  else if (/\.(docx|xlsx|pptx)$/i.test(name)) { const r = await (await api('/api/office-preview?path='+enc(p))).json(); openModal(`<h3>${esc(name)}</h3><p class="muted">Tekst-preview (${r.type||'office'})</p><pre style="max-width:80vw;max-height:70vh;overflow:auto;white-space:pre-wrap">${(r.text||'(geen tekst)').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre><button data-dl="${enc(p)}">Download origineel</button>`); }
  else if (/\.epub$/i.test(name)) { openModal(`<h3>${esc(name)}</h3><img src="/api/richpreview?path=${enc(p)}" style="max-height:74vh" onerror="this.replaceWith(Object.assign(document.createElement('p'),{className:'muted',textContent:'Geen omslag gevonden.'}))"><br><button data-dl="${enc(p)}">Download</button>`); }
  else if (/\.stl$/i.test(name)) { const r = await (await api('/api/richpreview?path='+enc(p))).json(); const d=r.dimensions||{}; openModal(`<h3>${esc(name)}</h3><p class="muted">3D-model (${r.format||'?'})</p><ul><li>Driehoeken: ${r.triangles??'?'}</li><li>Afmetingen: ${d.x??'?'} × ${d.y??'?'} × ${d.z??'?'}</li></ul><button data-dl="${enc(p)}">Download</button>`); }
  else openModal(`<h3>${esc(name)}</h3><p class="muted">Geen preview.</p><button data-dl="${enc(p)}">Download</button>`);
  // Converteer-knoppen (afbeelding→jpg/png/webp, document→pdf).
  const conv = /\.(jpe?g|png|webp|gif|tiff?|heic|heif|avif|bmp)$/i.test(name) ? ['jpg','png','webp']
    : /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(name) ? ['pdf'] : [];
  if (conv.length) {
    const btns = conv.map(t=>`<button data-conv="${enc(p)}|${t}">→ ${t.toUpperCase()}</button>`).join(' ');
    try { document.getElementById('modalBody').insertAdjacentHTML('beforeend', `<div style="margin-top:.6rem">Converteren: ${btns}</div>`); } catch {}
  }
  // Gedeelde reacties onder de preview.
  try { document.getElementById('modalBody').insertAdjacentHTML('beforeend', await commentsHtml(p)); } catch {}
}
const OFFICE_EXT = /\.(docx?|odt|rtf|xlsx?|ods|pptx?|odp)$/i;
// Office-bestand bewerken in Collabora Online (WOPI). Het token gaat via een
// POST-formulier naar de iframe, zodat het niet in de URL/geschiedenis belandt.
async function openOffice(p, owner) {
  const r = await api('/api/office/edit?path=' + enc(p) + (owner ? '&owner=' + enc(owner) : ''));
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return alert(d.error || 'Openen in Office mislukt');
  const ov = document.createElement('div');
  ov.id = 'officeOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--bg);display:flex;flex-direction:column';
  ov.innerHTML = `<div style="display:flex;align-items:center;gap:.6rem;padding:.4rem .7rem;border-bottom:1px solid var(--border)">
      <b style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📝 ${esc(p.split('/').pop())}</b>
      <button class="ghost" id="officeClose">Sluiten</button></div>
    <iframe name="officeFrame" title="Office-editor" allow="clipboard-read; clipboard-write; fullscreen" style="flex:1;border:0;width:100%"></iframe>
    <form method="post" target="officeFrame" action="${esc(d.url)}" hidden>
      <input name="access_token" value="${esc(d.token)}"><input name="access_token_ttl" value="${d.ttl}"></form>`;
  document.body.append(ov);
  const close = () => { window.removeEventListener('message', onMsg); ov.remove(); if (owner) renderShared(); else load(); };
  // Collabora meldt via postMessage wanneer de gebruiker op sluiten klikt.
  const onMsg = (e) => { try { const m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; if (m && m.MessageId === 'UI_Close') close(); } catch { /* andere berichten */ } };
  window.addEventListener('message', onMsg);
  ov.querySelector('#officeClose').onclick = close;
  ov.querySelector('form').submit();
}

// --- Teksteditor (CodeMirror 5, lokaal geserveerd via /vendor/codemirror) ---
// Regelnummers, kleurcodering per bestandstype, zoeken/vervangen (Ctrl+F /
// Shift+Ctrl+F), ga naar regel (Alt+G), haakjes, Ctrl+S om op te slaan en een
// waarschuwing bij sluiten met niet-opgeslagen wijzigingen. Lukt het laden van
// CodeMirror niet, dan valt de editor terug op een gewoon tekstvak.
const CM = '/vendor/codemirror/';
const CM_MODES = {
  js: ['javascript'], mjs: ['javascript'], cjs: ['javascript'], jsx: ['jsx', ['xml', 'javascript']],
  json: [{ name: 'javascript', json: true }, ['javascript']], ts: ['text/typescript', ['javascript']], tsx: ['text/typescript-jsx', ['xml', 'javascript', 'jsx']],
  css: ['css'], scss: ['text/x-scss', ['css']], html: ['htmlmixed', ['xml', 'javascript', 'css']], htm: ['htmlmixed', ['xml', 'javascript', 'css']],
  vue: ['htmlmixed', ['xml', 'javascript', 'css']], xml: ['xml'], md: ['markdown', ['xml']], py: ['python'], sh: ['shell'], sql: ['text/x-sql', ['sql']],
  go: ['go'], java: ['text/x-java', ['clike']], kt: ['text/x-kotlin', ['clike']], c: ['text/x-csrc', ['clike']], h: ['text/x-csrc', ['clike']],
  cpp: ['text/x-c++src', ['clike']], cs: ['text/x-csharp', ['clike']], rs: ['rust'], php: ['application/x-httpd-php', ['xml', 'javascript', 'css', 'htmlmixed', 'clike', 'php']],
  rb: ['ruby'], yaml: ['yaml'], yml: ['yaml'], toml: ['toml'], ini: ['properties'], conf: ['properties'],
};
const cmAssets = new Map();
function loadAsset(url) {
  if (!cmAssets.has(url)) cmAssets.set(url, new Promise((resolve, reject) => {
    const el = url.endsWith('.css') ? Object.assign(document.createElement('link'), { rel: 'stylesheet', href: url }) : Object.assign(document.createElement('script'), { src: url });
    el.onload = resolve; el.onerror = () => { cmAssets.delete(url); reject(new Error('laden mislukt: ' + url)); };
    document.head.append(el);
  }));
  return cmAssets.get(url);
}
async function loadCodeMirror(ext) {
  for (const c of ['lib/codemirror.css', 'addon/dialog/dialog.css', 'theme/material-darker.css']) loadAsset(CM + c).catch(() => {});
  await loadAsset(CM + 'lib/codemirror.js');
  for (const a of ['addon/mode/simple.js', 'addon/edit/matchbrackets.js', 'addon/edit/closebrackets.js', 'addon/search/searchcursor.js', 'addon/dialog/dialog.js', 'addon/search/search.js', 'addon/search/jump-to-line.js']) await loadAsset(CM + a);
  const spec = CM_MODES[ext];
  if (!spec) return null;
  const [mode, deps] = spec;
  for (const m of deps || [mode]) await loadAsset(CM + 'mode/' + m + '/' + m + '.js');
  return mode;
}

// --- Video-extra's: ondertitels, verder kijken, tijdlijn met voorbeeldbeelden ---
const fmtTime = (t) => { t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0'); };
async function videoExtras(p, v) {
  // Verder kijken: positie per video in deze browser onthouden.
  const key = 'resume:' + p; let lastSave = 0;
  v.addEventListener('timeupdate', () => {
    if (Date.now() - lastSave < 5000 || !v.duration) return; lastSave = Date.now();
    try { if (v.currentTime > 30 && v.currentTime < v.duration - 30) localStorage.setItem(key, String(Math.floor(v.currentTime))); else localStorage.removeItem(key); } catch { /* nvt */ }
  });
  v.addEventListener('ended', () => { try { localStorage.removeItem(key); } catch { /* nvt */ } });
  v.addEventListener('loadedmetadata', () => {
    let t = 0; try { t = Number(localStorage.getItem(key)) || 0; } catch { /* nvt */ }
    if (t > 30 && t < v.duration - 30) {
      v.currentTime = t;
      const bar = document.createElement('p'); bar.className = 'muted'; bar.style.margin = '.4rem 0';
      bar.innerHTML = `Verder vanaf ${fmtTime(t)} · <a href="#" data-restart>Opnieuw beginnen</a>`;
      bar.querySelector('[data-restart]').onclick = (e) => { e.preventDefault(); v.currentTime = 0; bar.remove(); };
      v.after(bar);
    }
  }, { once: true });

  const info = await (await api('/api/video/info?path=' + enc(p))).json().catch(() => ({}));
  // Ondertitels als <track>; de browser toont ze in het CC-menu van de speler.
  (info.subtitles || []).forEach((sub, i) => {
    const tr = document.createElement('track');
    Object.assign(tr, { kind: 'subtitles', label: sub.label, src: sub.url });
    if (sub.lang) tr.srclang = sub.lang;
    if (i === 0) tr.default = true;
    v.append(tr);
  });
  if (!info.storyboard) return;
  // Tijdlijn onder de video: aanwijzen = voorbeeldbeeld + tijd, klikken = springen.
  const r = await api('/api/storyboard?path=' + enc(p));
  if (!r.ok || !document.body.contains(v)) return;
  const m = await r.json();
  const strip = document.createElement('div');
  strip.title = 'Tijdlijn: klik om te springen';
  strip.style.cssText = 'position:relative;height:14px;margin:.5rem 0 0;border-radius:7px;background:var(--panel-2);cursor:pointer';
  strip.innerHTML = `<div data-prog style="position:absolute;inset:0 auto 0 0;width:0;border-radius:7px;background:var(--accent);opacity:.6"></div>
    <div data-tip hidden style="position:absolute;bottom:20px;transform:translateX(-50%);pointer-events:none;border:1px solid var(--border);border-radius:6px;background:var(--panel);padding:3px;box-shadow:var(--shadow)">
      <div data-img style="width:${m.w}px;height:${m.h}px;background:url('/api/storyboard?img=1&path=${enc(p)}') no-repeat"></div>
      <div data-t style="text-align:center;font-size:.75rem"></div></div>`;
  v.parentNode.insertBefore(strip, v.nextSibling);
  strip.style.width = v.getBoundingClientRect().width + 'px';
  const tip = strip.querySelector('[data-tip]'); const imgEl = strip.querySelector('[data-img]'); const tEl = strip.querySelector('[data-t]'); const prog = strip.querySelector('[data-prog]');
  const at = (e) => { const b = strip.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)); };
  strip.addEventListener('mousemove', (e) => {
    const f = at(e); const i = Math.min(m.count - 1, Math.floor((f * m.duration) / m.interval));
    imgEl.style.backgroundPosition = `-${(i % m.cols) * m.w}px -${Math.floor(i / m.cols) * m.h}px`;
    tEl.textContent = fmtTime(f * m.duration);
    tip.style.left = Math.min(Math.max(f * strip.clientWidth, m.w / 2), strip.clientWidth - m.w / 2) + 'px';
    tip.hidden = false;
  });
  strip.addEventListener('mouseleave', () => { tip.hidden = true; });
  strip.addEventListener('click', (e) => { if (v.duration) v.currentTime = at(e) * v.duration; });
  v.addEventListener('timeupdate', () => { if (v.duration) prog.style.width = (v.currentTime / v.duration) * 100 + '%'; });
}

async function editFile(p) {
  const name = p.split('/').pop(); const ext = (name.split('.').pop() || '').toLowerCase();
  const txt = await (await api('/api/preview?path=' + enc(p))).text();
  const ov = document.createElement('div');
  ov.id = 'editorOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--bg);display:flex;flex-direction:column';
  ov.innerHTML = `<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.4rem .7rem;border-bottom:1px solid var(--border)">
      <b style="flex:1;min-width:8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">✎ ${esc(name)}</b>
      <span class="muted" id="edStatus" style="font-size:.8rem"></span>
      <button class="ghost" id="edFind" title="Zoeken (Ctrl+F)">🔍 Zoeken</button>
      <button class="ghost" id="edReplace" title="Vervangen (Shift+Ctrl+F)">⇄ Vervangen</button>
      <button id="edSave" title="Opslaan (Ctrl+S)">Opslaan</button>
      <button class="ghost" id="edClose">Sluiten</button></div>
    <div id="edHost" style="flex:1;min-height:0;display:flex"></div>`;
  document.body.append(ov);
  const host = ov.querySelector('#edHost'); const status = ov.querySelector('#edStatus');
  let cm = null; let ta = null; let saved = txt;
  const value = () => (cm ? cm.getValue() : ta.value);
  const dirty = () => value() !== saved;
  const showStatus = () => {
    const pos = cm ? cm.getCursor() : null;
    status.textContent = (dirty() ? '● niet opgeslagen' : 'opgeslagen') + (pos ? ` · regel ${pos.line + 1}, kolom ${pos.ch + 1}` : '');
  };
  try {
    const mode = await loadCodeMirror(ext);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    cm = window.CodeMirror(host, {
      value: txt, mode, lineNumbers: true, matchBrackets: true, autoCloseBrackets: true, indentUnit: 2, tabSize: 2,
      lineWrapping: ['md', 'txt', 'log', 'csv', 'tsv'].includes(ext), theme: dark ? 'material-darker' : 'default',
      extraKeys: { 'Ctrl-S': () => save(), 'Cmd-S': () => save(), 'Alt-G': 'jumpToLine', Tab: (c) => (c.somethingSelected() ? c.indentMore() : c.replaceSelection(' '.repeat(c.getOption('indentUnit')))) },
    });
    cm.getWrapperElement().style.cssText = 'flex:1;height:auto;font-size:14px';
    cm.on('change', showStatus); cm.on('cursorActivity', showStatus);
    cm.focus();
  } catch {
    ta = Object.assign(document.createElement('textarea'), { value: txt });
    ta.style.cssText = 'flex:1;font-family:monospace;padding:.6rem;border:0;background:var(--bg);color:var(--text)';
    ta.addEventListener('input', showStatus);
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } });
    host.append(ta);
    ov.querySelector('#edFind').hidden = true; ov.querySelector('#edReplace').hidden = true;
  }
  showStatus();
  async function save() {
    const body = value();
    const r = await api('/api/save?path=' + enc(p), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
    if (!r.ok) { const d = await r.json().catch(() => ({})); return alert(d.error || 'Opslaan mislukt'); }
    saved = body; showStatus(); toast('Opgeslagen');
  }
  const close = () => {
    if (dirty() && !confirm('Er zijn niet-opgeslagen wijzigingen. Toch sluiten?')) return;
    window.removeEventListener('beforeunload', guard); ov.remove(); load();
  };
  const guard = (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', guard);
  ov.querySelector('#edSave').onclick = save;
  ov.querySelector('#edClose').onclick = close;
  ov.querySelector('#edFind').onclick = () => cm && cm.execCommand('findPersistent');
  ov.querySelector('#edReplace').onclick = () => cm && cm.execCommand('replace');
}

// --- Uploads ---
const CHUNK = 4 * 1024 * 1024; // 4MB
const BIG = 8 * 1024 * 1024;   // vanaf deze grootte: hervatbaar/chunked

// Werk een bestaand bestand efficiënt bij met delta-sync: kies een lokaal
// bestand, bereken de delta t.o.v. de serverversie en stuur alleen het verschil.
async function deltaSync(p) {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    const sig = await (await api('/api/sync/signature?path='+enc(p))).json();
    const buf = new Uint8Array(await file.arrayBuffer());
    const delta = await window.fseComputeDelta(sig, buf);
    const res = await api('/api/sync/apply?path='+enc(p), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ blockSize: delta.blockSize, ops: delta.ops }) });
    if (res.ok) {
      const pct = delta.total ? Math.round((1 - delta.literalBytes / delta.total) * 100) : 0;
      alert(`Bijgewerkt via delta-sync.\nAlleen ${delta.literalBytes} van ${delta.total} bytes verstuurd (${pct}% bespaard).`);
      load();
    } else alert('Bijwerken mislukt');
  };
  input.click();
}

// Galerij: toon alle afbeeldingen in de huidige map als raster.
async function showGallery() {
  const data = await (await api(`/api/list?path=${enc(cwd)}`)).json();
  const imgs = data.items.filter(i => !i.isDir && isImg(i.name));
  if (!imgs.length) { openModal('<p class="muted">Geen afbeeldingen in deze map.</p>'); return; }
  const grid = imgs.map(i => `<div style="cursor:pointer" data-open="${enc(i.path)}">
    <img loading="lazy" src="/api/thumb?path=${enc(i.path)}&w=200" style="width:150px;height:150px;object-fit:cover;border-radius:6px">
    <div style="font-size:.75rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.name)}</div></div>`).join('');
  openModal(`<h3>🖼️ Galerij (${imgs.length})</h3><div style="display:flex;flex-wrap:wrap;gap:.6rem;max-width:82vw">${grid}</div>`);
}

// Comments-sectie (gedeeld) opbouwen voor een bestand.
async function commentsHtml(p) {
  const { comments } = await (await api('/api/comments?path='+enc(p))).json();
  const list = comments.map((c, idx) => `<li><strong>${esc(c.user)}</strong> <span class="muted">${new Date(c.ts).toLocaleString()}</span><br>${esc(c.text)}
    <button class="ghost" data-cdel="${enc(p)}|${idx}" style="font-size:.7rem">×</button></li>`).join('');
  return `<hr><h4>💬 Reacties</h4><ul style="list-style:none;padding:0">${list||'<li class="muted">Nog geen reacties.</li>'}</ul>
    <div style="display:flex;gap:.4rem"><input id="cinput" placeholder="Reactie…" style="flex:1"><button data-cadd="${enc(p)}">Plaats</button></div>`;
}

// Toon een link met QR-code in een modal.
function showLink(title, url) {
  openModal(`<h3>${esc(title)}</h3>
    <input value="${esc(url)}" readonly style="width:100%;padding:.5rem" onclick="this.select()">
    <div style="margin-top:1rem;text-align:center"><img alt="QR" style="width:220px;height:220px;background:#fff;padding:6px;border-radius:8px" src="/api/qr?text=${enc(url)}"></div>
    <p class="muted">Scan de QR-code met je telefoon.</p>`);
}

// Maak een drop-link (upload-portaal) voor de huidige map.
async function makeDropLink() {
  const hrs = prompt('Drop-link vervalt na hoeveel uur? (leeg = nooit)', ''); if (hrs === null) return;
  const pw = prompt('Wachtwoord voor de drop-link? (leeg = geen)', '') || null;
  const burn = confirm('Brandbare brievenbus? (OK = link vervalt na de eerste aanlevering)');
  const r = await (await api('/api/droplink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:cwd,expiresInHours:hrs?Number(hrs):0,password:pw,burn})})).json();
  showLink(burn ? 'Brandbare brievenbus (eenmalig)' : 'Drop-link (anderen kunnen hier uploaden)', location.origin + r.url);
}

// Actieve sessies tonen + intrekken.
async function showSessions() {
  const { sessions } = await (await api('/api/sessions')).json();
  const rows = sessions.map(s => `<li>${new Date(s.created).toLocaleString()} · ${esc(s.ip||'?')} · ${esc((s.ua||'').slice(0,40))}
    ${s.current?'<strong>(deze sessie)</strong>':`<button class="danger" data-revoke="${s.id}">uitloggen</button>`}</li>`).join('');
  openModal(`<h3>🖥️ Actieve sessies</h3><ul>${rows||'<li class="muted">Geen</li>'}</ul>
    <button class="danger" id="logoutAll">Overal uitloggen</button>`);
  document.getElementById('logoutAll').onclick = async () => {
    if (!confirm('Alle sessies (ook deze) uitloggen?')) return;
    await api('/api/logout-all',{method:'POST'}); window.location='/login.html';
  };
}

// Eigen wachtwoord wijzigen (met hergebruik-/lek-controle op de server).
async function changePassword(forced) {
  const cur = prompt(forced ? 'Je wachtwoord is verlopen. Huidig wachtwoord:' : 'Huidig wachtwoord:');
  if (cur === null) return;
  const nw = prompt('Nieuw wachtwoord:'); if (!nw) return;
  const r = await api('/api/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({current:cur,password:nw})});
  const d = await r.json().catch(()=>({}));
  alert(r.ok ? 'Wachtwoord gewijzigd.' : (d.error||'Mislukt'));
}

// Passkey (WebAuthn) registreren.
async function addPasskey() {
  const { enabled } = await (await api('/api/webauthn/enabled')).json();
  if (!enabled) { alert('Passkeys zijn niet geconfigureerd op de server (WEBAUTHN_RP_ID/ORIGIN).'); return; }
  try {
    const opts = await (await api('/api/webauthn/register/options',{method:'POST'})).json();
    const att = await window.fseWebAuthnCreate(opts);
    const res = await api('/api/webauthn/register/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(att)});
    alert(res.ok ? 'Passkey toegevoegd ✅' : 'Toevoegen mislukt');
  } catch (e) { alert('Passkey toevoegen mislukt: ' + e.message); }
}

// Toon de versiegeschiedenis van een bestand.
async function showVersions(p) {
  const { versions } = await (await api('/api/versions?path='+enc(p))).json();
  const rows = versions.length ? versions.map(v =>
    `<li>${new Date(v.date).toLocaleString()} — ${v.size} bytes
      <a href="/api/version/download?path=${enc(p)}&version=${enc(v.version)}">⬇</a>
      <button class="ghost" data-verdiff="${enc(p)}|${enc(v.version)}">diff</button>
      <button class="ghost" data-verrestore="${enc(p)}|${enc(v.version)}">herstel</button></li>`).join('') : '<li class="muted">Geen eerdere versies.</li>';
  openModal(`<h3>🕘 Versies van ${esc(p.split('/').pop())}</h3><ul>${rows}</ul>`);
}

// Toon een regel-diff tussen een oudere versie en het huidige bestand.
async function showDiff(p, version) {
  const r = await api('/api/version/diff?path='+enc(p)+'&version='+enc(version));
  const d = await r.json().catch(()=>({}));
  if (!r.ok) { openModal(`<h3>Diff</h3><p class="muted">${esc(d.error||'Diff mislukt')}</p>`); return; }
  const esc2 = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const html = d.hunks.map(h => {
    const c = h.type==='add' ? '#16351f;color:#4ade80' : h.type==='del' ? '#3a1620;color:#f87171' : 'transparent;color:inherit';
    const pre = h.type==='add' ? '+ ' : h.type==='del' ? '- ' : '  ';
    return `<div style="background:${c};padding:0 .3rem;white-space:pre-wrap;font-family:monospace">${esc2(pre+h.line)}</div>`;
  }).join('');
  openModal(`<h3>Diff — ${esc(p.split('/').pop())}</h3><p class="muted">+${d.stat.added} / −${d.stat.removed}</p><div style="max-width:80vw;max-height:70vh;overflow:auto;border:1px solid var(--border);border-radius:6px">${html}</div>`);
}

// Ontsleutel een .enc-bestand in de browser en download het klaartekstbestand.
async function decryptDownload(p) {
  const pass = prompt('Wachtwoord om te ontsleutelen:'); if (!pass) return;
  try {
    const buf = await (await api('/api/download?path='+enc(p))).arrayBuffer();
    const plain = await window.fseDecrypt(buf, pass);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([plain]));
    a.download = p.split('/').pop().replace(/\.enc$/i, '');
    a.click();
  } catch (e) { alert('Ontsleutelen mislukt (verkeerd wachtwoord?)'); }
}

// --- Delta-upload (Batch U): alleen gewijzigde blokken van een bestaand groot bestand ---
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function deltaUpload(f, rp, fill) {
  if (!(window.crypto && crypto.subtle)) return false; // alleen in een beveiligde context (HTTPS/localhost)
  const BS = 4 * 1024 * 1024; const n = Math.ceil(f.size / BS);
  if (!n || n > 100000) return false;
  const blocks = [];
  for (let i = 0; i < n; i++) {
    blocks.push(hex(await crypto.subtle.digest('SHA-256', await f.slice(i * BS, (i + 1) * BS).arrayBuffer())));
    fill.style.width = (i / n * 30) + '%';
  }
  const target = (cwd.endsWith('/') ? cwd : cwd + '/') + rp;
  const r = await api('/api/upload/delta/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: target, size: f.size, blockSize: BS, blocks }) });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    if ([413, 422, 423].includes(r.status)) { alert(e.error || 'Upload geweigerd'); return true; } // definitief: niet opnieuw proberen
    return false;
  }
  const s = await r.json();
  for (let k = 0; k < s.need.length; k++) {
    const i = s.need[k];
    const pr = await api(`/api/upload/delta/${s.id}/${i}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: f.slice(i * BS, (i + 1) * BS) });
    if (!pr.ok) { await api('/api/upload/delta/' + s.id, { method: 'DELETE' }); return false; }
    fill.style.width = (30 + (k + 1) / s.need.length * 70) + '%';
  }
  const fr = await api(`/api/upload/delta/${s.id}/finish`, { method: 'POST' });
  const fj = await fr.json().catch(() => ({}));
  if (!fr.ok) { alert('Delta-upload mislukt: ' + (fj.error || fr.status)); return true; }
  toast(`${rp}: ${fj.sentBlocks} van ${fj.sentBlocks + fj.reusedBlocks} blokken verstuurd (rest ongewijzigd)`);
  return true;
}
function toast(text, actionLabel, action) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);background:var(--panel);border:1px solid var(--border);color:var(--text);padding:.6rem .9rem;border-radius:8px;z-index:60;max-width:92vw;box-shadow:0 4px 16px rgba(0,0,0,.4)';
  el.textContent = text;
  if (actionLabel) { const b = document.createElement('button'); b.textContent = actionLabel; b.style.marginLeft = '.6rem'; b.onclick = () => { action(); el.remove(); }; el.appendChild(b); }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), actionLabel ? 15000 : 5000);
}

// --- Achtergrondtaken (Batch U) ---
const jobState = new Map();
function jobRow(j) {
  const bar = `<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin:.25rem 0"><div style="height:100%;width:${j.progress}%;background:${j.status==='error'?'var(--danger)':'var(--accent)'}"></div></div>`;
  const st = { queued: 'in wachtrij', running: 'bezig', done: 'klaar', error: 'mislukt', cancelled: 'geannuleerd' }[j.status] || j.status;
  const act = (j.status === 'queued' || j.status === 'running') ? `<button class="danger" data-jobcancel="${esc(j.id)}">annuleren</button>`
    : `${j.hasResult ? `<a href="/api/jobs/${esc(j.id)}/result"><button>⬇ downloaden</button></a> ` : ''}<button class="danger" data-jobdel="${esc(j.id)}">×</button>`;
  return `<div style="border-bottom:1px solid var(--border);padding:.45rem 0" data-jobrow="${esc(j.id)}"><b>${esc(j.label)}</b> <span class="muted">— ${esc(st)}${j.message ? ' · ' + esc(j.message) : ''}${j.error ? ' · ' + esc(j.error) : ''}</span>${bar}${act}</div>`;
}
function renderJobs() {
  const list = document.getElementById('jobsList');
  const all = [...jobState.values()].sort((a, b) => b.created - a.created);
  if (list) list.innerHTML = all.length ? all.map(jobRow).join('') : '<p class="muted">Geen achtergrondtaken.</p>';
  const active = all.filter(j => j.status === 'queued' || j.status === 'running').length;
  const c = document.getElementById('jobsCount'); if (c) { c.style.display = active ? '' : 'none'; c.textContent = active; }
}
function onJobEvent(j) {
  const prev = jobState.get(j.id);
  jobState.set(j.id, j);
  renderJobs();
  if (j.status === 'done' && prev && prev.status !== 'done') {
    if (j.hasResult) toast(`✅ ${j.label} is klaar`, 'Downloaden', () => { location.href = `/api/jobs/${j.id}/result`; });
    else toast(`✅ ${j.label}: ${j.message || 'klaar'}`);
  }
  if (j.status === 'error' && prev && prev.status !== 'error') toast(`❌ ${j.label}: ${j.error || 'mislukt'}`);
}
async function showJobs() {
  const { jobs } = await (await api('/api/jobs')).json();
  jobState.clear(); for (const j of jobs) jobState.set(j.id, j);
  openModal(`<h3>🧰 Achtergrondtaken</h3><div id="jobsList"></div><p class="muted">Resultaten blijven een uur beschikbaar.</p>`);
  renderJobs();
}
async function startJob(type) {
  const r = await api('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, path: cwd || '/' }) });
  const d = await r.json();
  if (!r.ok) return alert(d.error || 'Mislukt');
  jobState.set(d.job.id, d.job); renderJobs();
  toast(`⏳ ${d.job.label} gestart`, 'Bekijken', showJobs);
}
document.getElementById('jobsBtn')?.addEventListener('click', showJobs);
document.getElementById('bgZipBtn')?.addEventListener('click', () => startJob('zip'));
document.getElementById('thumbsJobBtn')?.addEventListener('click', () => startJob('thumbs'));
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.jobcancel) { await api('/api/jobs/' + enc(t.dataset.jobcancel) + '/cancel', { method: 'POST' }); }
  if (t.dataset && t.dataset.jobdel) { await api('/api/jobs/' + enc(t.dataset.jobdel), { method: 'DELETE' }); jobState.delete(t.dataset.jobdel); renderJobs(); }
});

// --- Offline upload-wachtrij (mobiele PWA) ---
// Als het apparaat offline is (of het netwerk wegvalt tijdens een upload) worden
// de bestanden in IndexedDB bewaard en automatisch verstuurd zodra de verbinding
// terug is. Begrensd op 200 MB; zonder IndexedDB blijft alles gewoon werken.
const OQ_MAX = 200 * 1024 * 1024;
function oqDb() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('fs-offline-uploads', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('q', { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}
async function oqAll() {
  try { const db = await oqDb(); return await new Promise((res, rej) => { const r = db.transaction('q').objectStore('q').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); }
  catch { return []; }
}
async function oqAdd(items) {
  try {
    const cur = await oqAll();
    let used = cur.reduce((n, x) => n + (x.blob ? x.blob.size : 0), 0);
    const db = await oqDb();
    const tx = db.transaction('q', 'readwrite'); const st = tx.objectStore('q');
    let added = 0;
    for (const it of items) { if (used + it.blob.size > OQ_MAX) break; st.add(it); used += it.blob.size; added++; }
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return added;
  } catch { return 0; }
}
async function oqDel(id) { try { const db = await oqDb(); db.transaction('q', 'readwrite').objectStore('q').delete(id); } catch { /* nvt */ } }
// Alleen items van de ingelogde gebruiker (een gedeelde browser mag bestanden
// van gebruiker A nooit in het account van gebruiker B uploaden).
async function oqMine() { const u = me && me.user; return u ? (await oqAll()).filter(x => x.user === u) : []; }
async function oqBadge() {
  const n = (await oqMine()).length;
  let b = document.getElementById('oqBadge');
  if (!n) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'oqBadge'; b.style.cssText = 'position:fixed;bottom:1rem;right:1rem;background:#f59e0b;color:#000;padding:.5rem .8rem;border-radius:8px;z-index:50;font-size:.9rem'; document.body.appendChild(b); }
  b.textContent = `⏳ ${n} upload(s) in wachtrij — worden verstuurd zodra je online bent`;
}
let oqFlushing = false;
async function oqFlush() {
  if (oqFlushing || !navigator.onLine || !me || !me.user) return;
  oqFlushing = true;
  try {
    // Ruim items zonder eigenaar of ouder dan 7 dagen op (nooit uploaden naar een onbekend account).
    for (const x of await oqAll()) if (!x.user || Date.now() - (x.at || 0) > 7 * 86400000) await oqDel(x.id);
    for (const it of await oqMine()) {
      const fd = new FormData(); fd.append('files', it.blob, it.name);
      try {
        const r = await fetch('/api/upload?path=' + encodeURIComponent(it.path), { method: 'POST', body: fd });
        if (r.status === 401) break; // eerst opnieuw inloggen; wachtrij blijft staan
        if (r.ok || r.status === 422 || r.status === 413) await oqDel(it.id); // verwerkt (of definitief geweigerd)
      } catch { break; } // nog steeds offline
    }
  } finally { oqFlushing = false; oqBadge(); if (typeof load === 'function') load(); }
}
window.addEventListener('online', oqFlush);
setTimeout(() => { oqBadge(); oqFlush(); }, 1500);
async function queueOffline(files, relPaths) {
  if (!me || !me.user) { alert('Offline en niet ingelogd: upload niet mogelijk.'); return; }
  const items = files.map((f, i) => ({ user: me.user, path: cwd, name: (relPaths && relPaths[i]) || f.name, blob: f, at: Date.now() }));
  const added = await oqAdd(items);
  oqBadge();
  alert(added === items.length ? `Je bent offline: ${added} bestand(en) in de wachtrij gezet.` : `Offline-wachtrij vol: ${added} van ${items.length} bestand(en) bewaard.`);
}

// Zwevend voortgangspaneel: aantal bestanden klaar, MB's en procent over de hele upload.
function uploadProgress(files) {
  const totalBytes = files.reduce((n, f) => n + f.size, 0) || 1;
  const sent = new Map(); // bestand -> verzonden bytes
  let el = document.getElementById('upPanel');
  if (!el) {
    el = document.createElement('div'); el.id = 'upPanel'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:60;width:min(340px,calc(100vw - 32px));background:var(--panel,#111827);color:var(--text,#e5e7eb);border:1px solid var(--border,#374151);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);padding:.7rem .85rem;font-size:.88rem';
    el.innerHTML = '<div class="t" style="font-weight:600;margin-bottom:.35rem"></div><div style="height:6px;background:var(--border,#374151);border-radius:3px;overflow:hidden"><div class="f" style="height:100%;width:0;background:var(--accent,#38bdf8);transition:width .2s"></div></div><div class="s muted" style="margin-top:.35rem;opacity:.8"></div>';
    document.body.append(el);
  }
  el.style.display = '';
  const render = () => {
    let bytes = 0, done = 0;
    for (const f of files) { const b = sent.get(f) || 0; bytes += b; if (b >= f.size) done++; }
    const pct = Math.min(100, Math.floor(bytes / totalBytes * 100));
    el.querySelector('.t').textContent = `Uploaden: ${done} van ${files.length} bestanden klaar`;
    el.querySelector('.f').style.width = pct + '%';
    el.querySelector('.s').textContent = `${fmtMB(bytes)} van ${fmtMB(totalBytes)} · ${pct}%`;
  };
  render();
  return {
    // Kleine bestanden gaan in één verzoek: verdeel de verzonden bytes op volgorde over de bestanden.
    small(frac, list) { let left = frac * list.reduce((n, f) => n + f.size, 0); for (const f of list) { const b = Math.min(f.size, left); sent.set(f, b); left -= b; } render(); },
    big(f, frac) { sent.set(f, Math.round(f.size * frac)); render(); },
    done() { for (const f of files) sent.set(f, f.size); render(); el.querySelector('.t').textContent = `✅ ${files.length} bestanden geüpload`; setTimeout(() => { el.style.display = 'none'; }, 4000); },
  };
}

// Datum + tijd van laatste wijziging, compact.
function fmtDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Samenvatting van de huidige map + echte grootte/aantal per submap (recursief,
// via /api/dirinfo; één voor één om de server niet te overbelasten).
let dirInfoGen = 0;
async function renderDirSummary(items) {
  const gen = ++dirInfoGen;
  let el = document.getElementById('dirSummary');
  const table = document.getElementById('rows') && document.getElementById('rows').closest('table');
  if (!el && table) { el = document.createElement('div'); el.id = 'dirSummary'; table.before(el); }
  const nFiles = items.filter((i) => !i.isDir).length, nDirs = items.length - nFiles;
  const base = `${nFiles} bestand${nFiles === 1 ? '' : 'en'}, ${nDirs} map${nDirs === 1 ? '' : 'pen'}`;
  if (el) el.textContent = base;
  try {
    const r = await api('/api/dirinfo?path=' + enc(cwd));
    const d = await r.json();
    if (gen === dirInfoGen && el && r.ok) el.textContent = `${base} · totaal ${d.files} bestand${d.files === 1 ? '' : 'en'}, ${fmtSize(d.size)} (inclusief submappen)`;
  } catch { /* samenvatting is optioneel */ }
  for (const td of document.querySelectorAll('#rows td[data-dirinfo]')) {
    if (gen !== dirInfoGen) return;
    try {
      const r = await api('/api/dirinfo?path=' + td.dataset.dirinfo);
      const d = await r.json();
      if (r.ok) { td.textContent = fmtSize(d.size) || '0 B'; td.title = `${d.files} bestanden, ${d.dirs} submappen`; td.insertAdjacentHTML('beforeend', ` <span class="muted" style="font-size:.85em">· ${d.files}</span>`); }
      else td.textContent = '';
    } catch { td.textContent = ''; }
  }
}

async function uploadFiles(files, relPaths) {
  if (!files.length) return;
  // Optionele client-side versleuteling vóór upload.
  if (document.getElementById('encToggle') && document.getElementById('encToggle').checked) {
    const pass = prompt('Wachtwoord om te versleutelen:'); if (!pass) return;
    const encFiles = [], encRel = [];
    for (let i = 0; i < files.length; i++) {
      const blob = await window.fseEncrypt(files[i], pass);
      const nm = ((relPaths && relPaths[i]) || files[i].name) + '.enc';
      encFiles.push(new File([blob], nm)); encRel.push(nm);
    }
    files = encFiles; relPaths = encRel;
  }
  if (!navigator.onLine) return queueOffline(Array.from(files), relPaths);
  const bar = document.getElementById('progress'), fill = bar.firstElementChild;
  bar.style.display='block'; fill.style.width='0';
  const small = [], smallRel = [];
  const big = [];
  files.forEach((f, i) => { const rp = (relPaths && relPaths[i]) || f.name;
    if (f.size >= BIG) big.push({ f, rp }); else { small.push(f); smallRel.push(rp); } });
  const prog = uploadProgress(files);

  const doSmall = () => new Promise((resolve) => {
    if (!small.length) return resolve();
    const fd = new FormData();
    small.forEach((f, i) => fd.append('files', f, smallRel[i]));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload?path='+enc(cwd));
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) { fill.style.width = (ev.loaded/ev.total*100)+'%'; prog.small(ev.loaded/ev.total, small); } };
    xhr.onload = () => { prog.small(1, small); if (xhr.status===401) window.location='/login.html'; else if (xhr.status!==200 && xhr.status!==422) alert('Upload mislukt'); resolve(); };
    // Netwerk weggevallen: bewaar in de offline-wachtrij i.p.v. de upload kwijt te raken.
    xhr.onerror = async () => { if (!navigator.onLine) await queueOffline(small, smallRel); else alert('Upload mislukt'); resolve(); };
    xhr.send(fd);
  });

  const doBig = async ({ f, rp }) => {
    // Bestaat dit bestand al in deze map? Stuur dan alleen de gewijzigde blokken.
    if (!rp.includes('/') && window.__lastNames && window.__lastNames.has(rp)) {
      try { if (await deltaUpload(f, rp, fill)) { prog.big(f, 1); return; } } catch { /* terugvallen op gewone upload */ }
    }
    const uploadId = (rp + '-' + f.size + '-' + f.lastModified).replace(/[^a-zA-Z0-9_-]/g, '');
    const total = Math.ceil(f.size / CHUNK);
    let received = [];
    try { received = (await (await api('/api/upload/status?uploadId='+enc(uploadId))).json()).received || []; } catch {}
    for (let i = 0; i < total; i++) {
      if (received.includes(i)) { fill.style.width = ((i+1)/total*100)+'%'; prog.big(f, (i+1)/total); continue; }
      const blob = f.slice(i*CHUNK, (i+1)*CHUNK);
      const cfd = new FormData(); cfd.append('chunk', blob);
      const url = `/api/upload/chunk?uploadId=${enc(uploadId)}&index=${i}&total=${total}&name=${enc(rp)}&path=${enc(cwd)}`;
      await api(url, { method:'POST', body: cfd });
      fill.style.width = ((i+1)/total*100)+'%'; prog.big(f, (i+1)/total);
    }
  };

  (async () => {
    await doSmall();
    for (const b of big) await doBig(b);
    prog.done();
    bar.style.display='none'; loadMe(); load();
  })();
}

// --- Tabs ---
function showTab(name) {
  for (const v of ['files','shared','trash']) document.getElementById(v+'View').style.display = v===name?'':'none';
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab===name));
  if (name==='shared') renderShared();
  if (name==='trash') renderTrash();
  if (name==='files') load();
}
const sharedNav = {};
async function renderShared() {
  const v = document.getElementById('sharedView');
  if (!me.shared || !me.shared.length) { v.innerHTML = '<p class="muted">Niets met je gedeeld.</p>'; return; }
  let html = '';
  for (const s of me.shared) {
    const key = s.owner + '|' + s.path; const cur = sharedNav[key] || s.path;
    const data = await (await api(`/api/shared/list?owner=${enc(s.owner)}&path=${enc(cur)}`)).json().catch(()=>({items:[]}));
    const rw = (data.mode || s.mode) === 'rw';
    const up = cur !== s.path ? ` <button class="ghost" data-shnav="${enc(key)}|${enc(cur.slice(0, cur.lastIndexOf('/')) || '/')}">⬆ omhoog</button>` : '';
    html += `<h3>${esc(s.owner)}: ${esc(cur)} <span class="muted">(${rw?'lezen+schrijven':'alleen-lezen'})</span>${up}</h3>`;
    if (rw) html += `<div><input type="file" multiple data-shup="${enc(s.owner)}|${enc(cur)}"></div>`;
    html += '<ul>' + (data.items||[]).map(i =>
      `<li>${i.isDir?`📂 <a href="#" data-shnav="${enc(key)}|${enc(i.path)}">${esc(i.name)}</a>`:`📄 ${esc(i.name)} <a href="/api/shared/download?owner=${enc(s.owner)}&path=${enc(i.path)}">⬇</a>`
        + (me.office && OFFICE_EXT.test(i.name) ? ` <button class="ghost" data-office="${enc(i.path)}" data-owner="${enc(s.owner)}" title="${rw ? 'Bewerken in Office' : 'Bekijken in Office (alleen-lezen)'}">📝</button>` : '')}`
      + (rw?` <button class="danger" data-shdel="${enc(s.owner)}|${enc(i.path)}">🗑</button>`:'') + `</li>`).join('') + '</ul>';
  }
  v.innerHTML = html;
  v.querySelectorAll('[data-shup]').forEach(inp => inp.onchange = async () => {
    const [owner, base] = inp.dataset.shup.split('|').map(decodeURIComponent);
    const fd = new FormData(); [...inp.files].forEach(f => fd.append('files', f));
    await api(`/api/shared/upload?owner=${enc(owner)}&path=${enc(base)}`, { method:'POST', body: fd });
    renderShared();
  });
  v.querySelectorAll('[data-shnav]').forEach(el => el.onclick = (ev) => { ev.preventDefault(); const [k, target] = el.dataset.shnav.split('|').map(decodeURIComponent); sharedNav[k] = target; renderShared(); });
  v.querySelectorAll('[data-shdel]').forEach(btn => btn.onclick = async () => {
    const [owner, p] = btn.dataset.shdel.split('|').map(decodeURIComponent);
    if (!confirm('Verwijderen?')) return;
    await api('/api/shared/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner,path:p})});
    renderShared();
  });
}
async function renderTrash() {
  const v = document.getElementById('trashView');
  const data = await (await api('/api/trash')).json();
  if (!data.items.length) { v.innerHTML = '<p class="muted">Prullenbak is leeg.</p>'; return; }
  v.innerHTML = `<button class="danger" id="emptyTrash">Prullenbak legen</button><ul>` +
    data.items.map(i => `<li>${i.isDir?'📂':'📄'} ${esc(i.name.replace(/^\d+_/,''))} <button class="ghost" data-restore="${enc(i.path)}">Herstel</button></li>`).join('') + '</ul>';
  document.getElementById('emptyTrash').onclick = async () => { await api('/api/trash/empty',{method:'POST'}); renderTrash(); load(); loadMe(); };
}

// --- 2FA ---
async function setup2fa() {
  const r = await (await api('/api/2fa/setup',{method:'POST'})).json();
  openModal(`<h3>2FA instellen</h3><p class="muted">Scan de QR-code met je authenticator-app (bijv. Google Authenticator), of voer het geheim handmatig in:</p>
    <div style="background:#fff;display:inline-block;padding:.4rem;border-radius:6px">${r.qr}</div>
    <p><code>${r.secret}</code></p><p class="muted" style="word-break:break-all">${r.otpauth}</p>
    <label>Voer een code in om te bevestigen:</label><input id="totpIn"><br>
    <button id="enable2fa">Inschakelen</button> <button class="danger" id="disable2fa">Uitschakelen</button>
    <hr><button id="recCodes">Herstelcodes genereren</button><div id="recOut" style="margin-top:.5rem"></div>`);
  document.getElementById('enable2fa').onclick = async () => {
    const res = await api('/api/2fa/enable',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:r.secret,token:document.getElementById('totpIn').value})});
    alert(res.ok ? '2FA ingeschakeld' : '2FA-code onjuist'); if (res.ok) closeModal();
  };
  document.getElementById('disable2fa').onclick = async () => { await api('/api/2fa/disable',{method:'POST'}); alert('2FA uitgeschakeld'); closeModal(); };
  document.getElementById('recCodes').onclick = async () => {
    if (!confirm('Nieuwe herstelcodes maken? Oude codes vervallen.')) return;
    const res = await (await api('/api/2fa/recovery-codes',{method:'POST'})).json();
    document.getElementById('recOut').innerHTML = `<p class="muted">Bewaar deze eenmalige codes veilig:</p><pre>${res.codes.join('\n')}</pre>`;
  };
}

// --- Events ---
document.addEventListener('click', async (e) => {
  const t2 = e.target;
  const dir = t2.closest('[data-dir]'), open = t2.closest('[data-open]');
  // "Bestanden" in de zijbalk gaat altijd terug naar de hoofdmap.
  const tabBtn = t2.closest('[data-tab]');
  if (tabBtn) {
    if (tabBtn.dataset.tab === 'files') { cwd = '/'; selected.clear(); document.getElementById('search').value = ''; }
    return showTab(tabBtn.dataset.tab);
  }
  if (dir) { cwd = decodeURIComponent(dir.dataset.dir); selected.clear(); document.getElementById('search').value=''; return load(); }
  if (t2.dataset.go) { cwd = decodeURIComponent(t2.dataset.go); selected.clear(); document.getElementById('search').value=''; return load(); }
  if (open) return openFile(decodeURIComponent(open.dataset.open));
  if (t2.dataset.dl) return void (window.location = '/api/download?path='+t2.dataset.dl);
  if (t2.dataset.zip) return void (window.location = '/api/zip?path='+t2.dataset.zip);
  if (t2.dataset.edit) return editFile(decodeURIComponent(t2.dataset.edit));
  if (t2.dataset.restore) { await api('/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(t2.dataset.restore)})}); renderTrash(); load(); loadMe(); return; }
  if (t2.dataset.share) {
    const p = decodeURIComponent(t2.dataset.share);
    const { presets } = await (await api('/api/share-presets')).json();
    const opts = (presets||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    openModal(`<h3>🔗 Deel-link voor ${esc(p.split('/').pop())}</h3>
      <label>Preset <select id="shPreset"><option value="">— eigen instellingen —</option>${opts}</select></label>
      <div id="shCustom" style="display:grid;gap:.4rem;margin-top:.6rem">
        <label>Vervalt na (uur, leeg = nooit) <input id="shHrs" type="number" min="0" value="24" style="width:90px"></label>
        <label>Wachtwoord (leeg = geen) <input id="shPw" type="text" autocomplete="off"></label>
        <label>Max. downloads (leeg = onbeperkt) <input id="shMax" type="number" min="0" style="width:90px"></label>
      </div>
      <button data-sharego="${enc(p)}" style="margin-top:.7rem">Link maken</button>`);
    document.getElementById('shPreset').onchange = (e) => { document.getElementById('shCustom').style.display = e.target.value ? 'none' : 'grid'; };
    return;
  }
  if (t2.dataset.sharego) {
    const p = decodeURIComponent(t2.dataset.sharego);
    const presetId = document.getElementById('shPreset').value;
    const body = presetId ? { path: p, presetId } : { path: p, expiresInHours: Number(document.getElementById('shHrs').value)||0, password: document.getElementById('shPw').value || null, maxDownloads: Number(document.getElementById('shMax').value)||0 };
    const r = await (await api('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
    if (r.error) return alert(r.error);
    closeModal();
    showLink('Deel-link (download)' + (r.password ? ' — wachtwoord: ' + r.password : ''), location.origin + r.url); return;
  }
  if (t2.dataset.meta) {
    const p = decodeURIComponent(t2.dataset.meta);
    const m = (await (await api('/api/meta?path='+enc(p))).json()).meta;
    const tags = prompt('Tags (komma-gescheiden):', (m.tags||[]).join(', '));
    if (tags === null) return;
    const comment = prompt('Commentaar:', m.comment||'');
    if (comment === null) return;
    const fav = confirm('Als favoriet markeren? (OK = ja)');
    await api('/api/meta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,tags:tags.split(',').map(s=>s.trim()).filter(Boolean),comment,favorite:fav})});
    const curLabel = (await (await api('/api/label?path='+enc(p))).json()).label;
    const label = prompt('Classificatie (openbaar/intern/vertrouwelijk/geheim):', curLabel);
    if (label !== null) await api('/api/label',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,label:label.trim()})});
    load(); return;
  }
  if (t2.dataset.guest) return showGuests(decodeURIComponent(t2.dataset.guest));
  if (t2.dataset.receipt) return showReceipts(decodeURIComponent(t2.dataset.receipt));
  if (t2.dataset.guestdel) { if (!confirm('Gasttoegang intrekken? Het gastaccount wordt verwijderd.')) return; await api('/api/guests/'+t2.dataset.guestdel,{method:'DELETE'}); return showGuests(); }
  if (t2.dataset.guestlink) { const r = await (await api('/api/guests/'+t2.dataset.guestlink+'/link',{method:'POST'})).json(); const o=document.getElementById('guestOut'); if (o) o.innerHTML = guestLinkHtml(r.link, false); return; }
  if (t2.dataset.copy) { try { await navigator.clipboard.writeText(t2.dataset.copy); t2.textContent = '✓ gekopieerd'; } catch { prompt('Kopieer de link:', t2.dataset.copy); } return; }
  if (t2.dataset.grant) {
    const p = decodeURIComponent(t2.dataset.grant);
    const to = prompt('Delen met welke gebruiker?'); if (!to) return;
    const rw = confirm('Schrijfrechten geven? (OK = lezen+schrijven, Annuleer = alleen-lezen)');
    await api('/api/grant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,path:p,mode:rw?'rw':'ro'})});
    alert('Gedeeld met '+to+' ('+(rw?'rw':'ro')+')'); return;
  }
  if (t2.dataset.revoke) { await api('/api/sessions/'+t2.dataset.revoke,{method:'DELETE'}); showSessions(); return; }
  if (t2.dataset.office) { openOffice(decodeURIComponent(t2.dataset.office), t2.dataset.owner ? decodeURIComponent(t2.dataset.owner) : ''); return; }
  if (t2.dataset.ilink) {
    const r = await (await api('/api/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(t2.dataset.ilink)})})).json();
    if (!r.url) return alert(r.error || 'Link maken mislukt');
    try { await navigator.clipboard.writeText(r.url); toast('Link gekopieerd'); } catch { showLink('Interne link', r.url); }
    return;
  }
  if (t2.dataset.perma) {
    const p = decodeURIComponent(t2.dataset.perma);
    const hrs = prompt('Permalink vervalt na hoeveel uur? (leeg = nooit)', ''); if (hrs === null) return;
    const pw = prompt('Wachtwoord voor de permalink? (leeg = geen)', '') || null;
    const r = await (await api('/api/permalink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,expiresInHours:hrs?Number(hrs):0,password:pw})})).json();
    showLink('Vaste link (permalink)', r.url); return;
  }
  if (t2.dataset.cadd) {
    const p = decodeURIComponent(t2.dataset.cadd); const inp = document.getElementById('cinput');
    if (!inp || !inp.value.trim()) return;
    await api('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,text:inp.value.trim()})});
    openFile(p); return;
  }
  if (t2.dataset.cdel) {
    const [p, idx] = t2.dataset.cdel.split('|'); const pp = decodeURIComponent(p);
    await api('/api/comments',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:pp,index:Number(idx)})});
    openFile(pp); return;
  }
  if (t2.dataset.dec) { return decryptDownload(decodeURIComponent(t2.dataset.dec)); }
  if (t2.dataset.sync) { return deltaSync(decodeURIComponent(t2.dataset.sync)); }
  if (t2.dataset.conv) {
    const [p, to] = t2.dataset.conv.split('|'); const pp = decodeURIComponent(p);
    const r = await api('/api/convert?path='+enc(pp)+'&to='+to);
    if (!r.ok) { alert('Conversie mislukt'); return; }
    const b = await r.blob(); const a = document.createElement('a'); a.href=URL.createObjectURL(b);
    a.download = pp.split('/').pop().replace(/\.[^.]+$/, '')+'.'+to; a.click(); return;
  }
  if (t2.dataset.ver) { return showVersions(decodeURIComponent(t2.dataset.ver)); }
  if (t2.dataset.lock) {
    const p = decodeURIComponent(t2.dataset.lock);
    const locks = (await (await api('/api/locks')).json()).locks || [];
    const isLocked = locks.some(l => l.path === p);
    const r = await api(isLocked ? '/api/unlock' : '/api/lock', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p})});
    if (!r.ok) { const e = await r.json().catch(()=>({})); alert(e.error || 'Mislukt'); }
    else alert(isLocked ? '🔓 Ontgrendeld' : '🔒 Vergrendeld'); return;
  }
  if (t2.dataset.verrestore) {
    const [p, v] = t2.dataset.verrestore.split('|').map(decodeURIComponent);
    await api('/api/version/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,version:v})});
    closeModal(); load(); return;
  }
  if (t2.dataset.verdiff) {
    const [p, v] = t2.dataset.verdiff.split('|').map(decodeURIComponent);
    return showDiff(p, v);
  }
  if (t2.dataset.media) { return showMediaTools(decodeURIComponent(t2.dataset.media)); }
  if (t2.dataset.sign) { return showSigning(decodeURIComponent(t2.dataset.sign)); }
  if (t2.dataset.vision) { return showVision(decodeURIComponent(t2.dataset.vision)); }
  if (t2.dataset.ren) {
    const cur = decodeURIComponent(t2.dataset.ren), base = cur.substring(0,cur.lastIndexOf('/')+1);
    let suggestion = '';
    try { suggestion = (await (await api('/api/rename-suggestion?path='+enc(cur))).json()).suggestion || ''; } catch {}
    const nn = prompt(suggestion ? 'Nieuwe naam of pad (suggestie ingevuld):' : 'Nieuwe naam of pad:', suggestion || cur.split('/').pop()); if (!nn) return;
    await api('/api/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:cur,to:nn.startsWith('/')?nn:base+nn})}); load(); return;
  }
  if (t2.dataset.del) { if(!confirm('Naar prullenbak?'))return; const shred=confirm('Veilig wissen (shredder)? OK = onherstelbaar overschrijven, Annuleer = gewone prullenbak.'); await api('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(t2.dataset.del),shred})}); load(); loadMe(); return; }
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.sel) { const p=decodeURIComponent(e.target.dataset.sel); e.target.checked?selected.add(p):selected.delete(p); }
});

document.getElementById('modalClose').onclick = closeModal;
document.getElementById('modal').addEventListener('click', e => { if (e.target.id==='modal') closeModal(); });
document.getElementById('refreshBtn').onclick = () => { load(); loadMe(); };
document.getElementById('sort').onchange = load;
document.getElementById('order').onchange = load;
let st; document.getElementById('search').oninput = () => { clearTimeout(st); st=setTimeout(load,300); };
document.getElementById('mkdirBtn').onclick = async () => { const n=prompt('Naam van de nieuwe map:'); if(!n)return; await api('/api/mkdir',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:cwd,name:n})}); load(); };
document.getElementById('newfileBtn').onclick = async () => { const n=prompt('Naam van het nieuwe bestand:'); if(!n)return; await api('/api/save?path='+enc((cwd==='/'?'':cwd)+'/'+n),{method:'POST',headers:{'Content-Type':'text/plain'},body:''}); load(); };
document.getElementById('bulkDl').onclick = async () => { if(!selected.size)return alert('Niets geselecteerd'); const r=await api('/api/bulkzip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:[...selected]})}); const b=await r.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='selectie.zip'; a.click(); };
document.getElementById('bulkDel').onclick = async () => { if(!selected.size)return alert('Niets geselecteerd'); if(!confirm(selected.size+' item(s) naar prullenbak?'))return; await api('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:[...selected]})}); selected.clear(); load(); loadMe(); };
const bulkMoveBtn = document.getElementById('bulkMove'); if (bulkMoveBtn) bulkMoveBtn.onclick = async () => { if(!selected.size)return alert('Niets geselecteerd'); const dest=prompt('Verplaats '+selected.size+' item(s) naar welke map? (bijv. /map1)', cwd); if(dest===null)return; const r=await(await api('/api/bulk/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:[...selected],dest})})).json(); if(r.error)return alert(r.error); selected.clear(); load(); };
const bulkTagBtn = document.getElementById('bulkTag'); if (bulkTagBtn) bulkTagBtn.onclick = async () => {
  if(!selected.size)return alert('Niets geselecteerd');
  const tag=prompt('Welke tag toevoegen aan '+selected.size+' item(s)?'); if(!tag)return;
  const r=await(await api('/api/bulk-tag',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:[...selected],tag})})).json();
  alert((r.changed||0)+' item(s) getagd met "'+tag+'".'); selected.clear(); load();
};
const tagGalBtn = document.getElementById('tagGalBtn'); if (tagGalBtn) tagGalBtn.onclick = async () => {
  const tag=prompt('Toon bestanden met welke tag?'); if(!tag)return;
  const d=await(await api('/api/by-tag?tag='+enc(tag))).json();
  const rows=(d.paths||[]).map(p=>`<li>🏷️ ${esc(p)} <a href="/api/download?path=${enc(p)}">⬇</a></li>`).join('');
  openModal(`<h3>🏷️ Tag: ${esc(tag)}</h3><ul>${rows||'<li class="muted">Geen bestanden met deze tag.</li>'}</ul>`);
};
document.getElementById('fileInput').onchange = e => uploadFiles([...e.target.files]);
document.getElementById('dirInput').onchange = e => { const files=[...e.target.files]; uploadFiles(files, files.map(f=>f.webkitRelativePath||f.name)); };
document.getElementById('logoutBtn').onclick = async () => { await fetch('/api/logout',{method:'POST'}); window.location='/login.html'; };
document.getElementById('2faBtn').onclick = setup2fa;
document.getElementById('passkeyBtn').onclick = addPasskey;
document.getElementById('sessionsBtn').onclick = showSessions;
const pwBtn = document.getElementById('pwBtn'); if (pwBtn) pwBtn.onclick = () => changePassword(false);

// Notificatiecentrum.
async function refreshNotifCount() {
  try {
    const n = await (await api('/api/notifications')).json();
    const b = document.getElementById('notifCount');
    if (n.unread > 0) { b.textContent = n.unread; b.style.display = ''; } else b.style.display = 'none';
  } catch {}
}
async function showNotifications() {
  const n = await (await api('/api/notifications')).json();
  const rows = (n.items||[]).map(i=>`<li style="padding:.3rem 0;${i.read?'opacity:.6':''}"><strong>${esc(i.title)}</strong> <span class="muted">${new Date(i.ts).toLocaleString()}</span><br>${esc(i.body)}</li>`).join('');
  openModal(`<h3>🔔 Meldingen</h3><ul style="list-style:none;padding:0;max-width:70vw">${rows||'<li class="muted">Geen meldingen.</li>'}</ul>
    <button id="notifRead">Alles gelezen</button> <button class="danger" id="notifClear">Wissen</button>`);
  document.getElementById('notifRead').onclick = async () => { await api('/api/notifications/read',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); refreshNotifCount(); closeModal(); };
  document.getElementById('notifClear').onclick = async () => { await api('/api/notifications',{method:'DELETE'}); refreshNotifCount(); closeModal(); };
}
const notifBtn = document.getElementById('notifBtn'); if (notifBtn) notifBtn.onclick = showNotifications;
setInterval(refreshNotifCount, 30000); refreshNotifCount();

// API-sleutels beheren.
async function showApiKeys() {
  const { keys } = await (await api('/api/apikeys')).json();
  const rows = keys.map(k=>`<li>${esc(k.name)} <span class="muted">(${k.scope})</span> — ${new Date(k.created).toLocaleDateString()} <button class="danger" data-keydel="${k.id}">intrekken</button></li>`).join('');
  openModal(`<h3>🔑 API-sleutels</h3><ul style="list-style:none;padding:0">${rows||'<li class="muted">Nog geen sleutels.</li>'}</ul>
    <div style="display:flex;gap:.4rem;margin-top:.5rem"><input id="keyName" placeholder="naam"><select id="keyScope"><option value="read">alleen-lezen</option><option value="write">lezen+schrijven</option></select><button id="keyAdd">Aanmaken</button></div>
    <div id="keyOut" style="margin-top:.5rem"></div>`);
  document.getElementById('keyAdd').onclick = async () => {
    const r = await (await api('/api/apikeys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('keyName').value||'api-key',scope:document.getElementById('keyScope').value})})).json();
    document.getElementById('keyOut').innerHTML = `<p style="color:var(--accent)">Bewaar deze sleutel nu (wordt maar één keer getoond):</p><code style="word-break:break-all">${esc(r.token)}</code>`;
  };
  document.querySelectorAll('[data-keydel]').forEach(b=>b.onclick=async()=>{ await api('/api/apikeys/'+b.dataset.keydel,{method:'DELETE'}); showApiKeys(); });
}
const apikeyBtn = document.getElementById('apikeyBtn'); if (apikeyBtn) apikeyBtn.onclick = showApiKeys;

// Snapshots (point-in-time momentopnamen van je opslag).
async function showSnapshots() {
  const { snapshots } = await (await api('/api/snapshots')).json();
  const rows = snapshots.map(s=>`<li>${esc(s.created)} — ${s.files} bestand(en), ${fmtSize(s.bytes)}
    <button data-snaprestore="${esc(s.id)}">terugzetten</button> <button class="danger" data-snapdel="${esc(s.id)}">×</button></li>`).join('');
  openModal(`<h3>📸 Snapshots</h3><p class="muted">Onveranderbare momentopnamen van je bestanden.</p>
    <ul style="list-style:none;padding:0;max-width:70vw">${rows||'<li class="muted">Nog geen snapshots.</li>'}</ul>
    <button id="snapNew">Nieuwe snapshot maken</button>`);
  document.getElementById('snapNew').onclick = async () => { await api('/api/snapshots',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); showSnapshots(); };
  document.querySelectorAll('[data-snaprestore]').forEach(b=>b.onclick=async()=>{ if(confirm('Deze snapshot terugzetten? Bestaande bestanden worden overschreven.')){ await api('/api/snapshots/'+encodeURIComponent(b.dataset.snaprestore)+'/restore',{method:'POST'}); alert('Teruggezet'); closeModal(); load(); } });
  document.querySelectorAll('[data-snapdel]').forEach(b=>b.onclick=async()=>{ await api('/api/snapshots/'+encodeURIComponent(b.dataset.snapdel),{method:'DELETE'}); showSnapshots(); });
}
const snapBtn = document.getElementById('snapBtn'); if (snapBtn) snapBtn.onclick = showSnapshots;
async function showTeams(openId) {
  if (openId) return showTeamSpace(openId);
  const { teams } = await (await api('/api/teams')).json();
  const rows = teams.length ? teams.map(t =>
    `<li style="margin:.3rem 0"><button class="ghost" data-teamopen="${esc(t.id)}">📂 ${esc(t.name)}</button> <span class="muted">(${esc(t.role)}, ${t.members} leden)</span></li>`).join('') : '<li class="muted">Nog geen teamruimtes.</li>';
  openModal(`<h3>🧑‍🤝‍🧑 Teamruimtes</h3><ul style="list-style:none;padding:0">${rows}</ul>
    <div style="margin-top:.6rem"><input id="teamNew" placeholder="Naam nieuwe ruimte"> <button data-teamcreate>Aanmaken</button></div>`);
}
async function showTeamSpace(id, sub) {
  const path0 = sub || '/';
  const r = await api(`/api/teams/${id}/list?path=`+enc(path0));
  const d = await r.json().catch(()=>({}));
  if (!r.ok) { openModal(`<p class="muted">${esc(d.error||'Geen toegang')}</p>`); return; }
  const canW = d.role === 'editor' || d.role === 'admin';
  const items = (d.items||[]).map(i =>
    `<tr><td>${i.isDir?'📁':'📄'} ${esc(i.name)}</td><td style="text-align:right">
      ${i.isDir?`<button class="ghost" data-teamcd="${esc(id)}|${esc(i.path)}">open</button>`:`<a href="/api/teams/${id}/download?path=${enc(i.path)}">⬇</a>`}
      ${canW?`<button class="danger" data-teamdel="${esc(id)}|${esc(i.path)}">×</button>`:''}</td></tr>`).join('');
  openModal(`<h3>📂 Teamruimte <span class="muted">(${esc(d.role)})</span></h3>
    <div class="muted" style="margin-bottom:.4rem">Pad: ${esc(path0)}</div>
    <table style="width:70vw">${items||'<tr><td class="muted">Leeg.</td></tr>'}</table>
    ${canW?`<div style="margin-top:.6rem"><label style="cursor:pointer;color:var(--accent)">＋ Upload<input type="file" id="teamUp" data-teamid="${esc(id)}" data-teampath="${esc(path0)}" hidden></label></div>`:''}
    ${d.role==='admin'?`<div style="margin-top:.6rem;border-top:1px solid var(--border);padding-top:.5rem"><input id="teamMember" placeholder="gebruiker" style="width:120px"> <select id="teamRole"><option value="viewer">viewer</option><option value="editor">editor</option><option value="admin">admin</option></select> <button data-teamaddmember="${esc(id)}">Lid toevoegen</button></div>`:''}`);
}
// Duplicaten-dashboard: groepen identieke bestanden; behoud de eerste, ruim de rest op.
async function showDuplicates() {
  openModal('<h3>🧬 Duplicaten</h3><p class="muted">Bezig met scannen…</p>');
  const d = await (await api('/api/duplicates')).json();
  const groups = d.groups || [];
  const fmt = (g, gi) => {
    const rows = g.paths.map((p, i) =>
      `<li>${i === 0 ? '📌 ' : ''}${esc(p)} ${i > 0 ? `<button class="danger" data-dupdel="${enc(p)}">verwijder</button>` : '<span class="muted">(behouden)</span>'}</li>`).join('');
    return `<div style="border:1px solid var(--border);border-radius:6px;padding:.4rem .6rem;margin:.4rem 0"><b>${(g.size/1024).toFixed(1)} KB × ${g.paths.length}</b><ul style="list-style:none;padding:0;margin:.3rem 0">${rows}</ul></div>`;
  };
  openModal(`<h3>🧬 Duplicaten</h3>
    <div style="border:1px solid var(--border);border-radius:8px;padding:.6rem;margin-bottom:.6rem">
      <b>Opruimassistent</b> — bewaar per groep één exemplaar:
      <select id="dupStrat"><option value="oldest">oudste</option><option value="newest">nieuwste</option><option value="shortest">kortste pad</option><option value="prefer">in voorkeursmap</option></select>
      <input id="dupPrefer" placeholder="/voorkeursmap" style="width:130px">
      <button data-dupplan>Voorstel maken</button>
      <div id="dupPlanOut" class="muted" style="margin-top:.4rem"></div>
    </div>
    <p class="muted">Verspild: ${(d.wasted/1e6).toFixed(1)} MB in ${groups.length} groepen.
    <button data-dedup style="margin-left:.5rem">Automatisch dedupliceren (reflink)</button></p>
    <div style="max-width:80vw;max-height:66vh;overflow:auto">${groups.length ? groups.map(fmt).join('') : '<p class="muted">Geen duplicaten gevonden.</p>'}</div>`);
}
// Opgeslagen zoekopdrachten / slimme mappen.
async function showSaved() {
  const { searches } = await (await api('/api/saved-searches')).json();
  const fdesc = f => Object.entries(f||{}).map(([k,v])=>`${k}=${v}`).join(', ');
  const rows = searches.length ? searches.map(s => {
    const smart = s.filters && Object.keys(s.filters).length;
    return `<li style="margin:.3rem 0">${smart?`<button class="ghost" data-colopen="${esc(s.id)}">📂 ${esc(s.name)}</button>`:`<button class="ghost" data-savedrun="${esc(s.id)}">🔎 ${esc(s.name)}</button>`} <span class="muted">${s.query?'"'+esc(s.query)+'"':''}${s.content?' (inhoud)':''}${smart?' ['+esc(fdesc(s.filters))+']':''}</span> <button class="danger" data-saveddel="${esc(s.id)}">×</button></li>`;
  }).join('') : '<li class="muted">Nog geen opgeslagen zoekopdrachten.</li>';
  openModal(`<h3>⭐ Zoekopdrachten & slimme collecties</h3><ul style="list-style:none;padding:0">${rows}</ul>
    <div style="margin-top:.6rem;border-top:1px solid var(--border);padding-top:.5rem;display:grid;gap:.35rem">
      <div><input id="savName" placeholder="naam" style="width:110px"> <input id="savQuery" placeholder="zoekterm (optioneel bij filters)" style="width:190px">
      <label class="muted"><input type="checkbox" id="savContent"> inhoud</label></div>
      <div class="muted">Filters (maken er een live slimme collectie van):</div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap">
        <select id="savType"><option value="">elk type</option><option>document</option><option>afbeelding</option><option>video</option><option>audio</option><option>archief</option></select>
        <input id="savTag" placeholder="tag" style="width:80px"><select id="savLabel"><option value="">elke classificatie</option><option>openbaar</option><option>intern</option><option>vertrouwelijk</option><option>geheim</option></select>
        <input id="savMin" type="number" min="0" placeholder="≥kB" style="width:65px"><input id="savMax" type="number" min="0" placeholder="≤kB" style="width:65px">
        <input id="savNew" type="number" min="0" placeholder="gewijzigd ≤ dagen" style="width:120px"><input id="savOld" type="number" min="0" placeholder="ouder dan dagen" style="width:115px">
      </div>
      <div><button data-savedadd>Opslaan</button></div></div>`);
}
let savedList = [];
const dupBtn = document.getElementById('dupBtn'); if (dupBtn) dupBtn.onclick = showDuplicates;
const savedBtn = document.getElementById('savedBtn'); if (savedBtn) savedBtn.onclick = showSaved;
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.dupdel) { if (!confirm('Deze kopie verwijderen?')) return; await api('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(t.dataset.dupdel)})}); return showDuplicates(); }
  if (t.hasAttribute && t.hasAttribute('data-dedup')) { t.textContent='Bezig…'; const r = await (await api('/api/dedup',{method:'POST'})).json(); alert(r.supported===false?'Bestandssysteem ondersteunt geen reflinks.':`${r.reflinked} bestanden gededupliceerd (${(r.saved/1e6).toFixed(1)} MB).`); return showDuplicates(); }
  if (t.hasAttribute && t.hasAttribute('data-savedadd')) {
    const name = document.getElementById('savName').value.trim(), query = document.getElementById('savQuery').value.trim();
    const v = id => document.getElementById(id).value;
    const filters = { type: v('savType'), tag: v('savTag').trim(), label: v('savLabel'), minKb: v('savMin'), maxKb: v('savMax'), modifiedWithinDays: v('savNew'), olderThanDays: v('savOld') };
    if (!name) return; const content = document.getElementById('savContent').checked;
    const r = await api('/api/saved-searches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,query,content,path:'/',filters})});
    if(!r.ok){const ee=await r.json().catch(()=>({}));alert(ee.error||'Mislukt');} return showSaved();
  }
  if (t.dataset.saveddel) { await api('/api/saved-searches/'+encodeURIComponent(t.dataset.saveddel),{method:'DELETE'}); return showSaved(); }
  if (t.dataset.savedrun) {
    const { searches } = await (await api('/api/saved-searches')).json();
    const s = searches.find(x => x.id === t.dataset.savedrun); if (!s) return;
    closeModal();
    const sEl = document.getElementById('search'), cEl = document.getElementById('contentSearch');
    if (sEl) sEl.value = s.query; if (cEl) cEl.checked = !!s.content;
    load();
  }
});
// Duplicaten-assistent, opruimadvies, inhoud-zoeken en slimme collecties (Batch T).
let dupPlan = null;
const fmtMB = n => (n/1048576).toFixed(n > 10485760 ? 0 : 1) + ' MB';
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.hasAttribute && t.hasAttribute('data-dupplan')) {
    const q = '?strategy=' + enc(document.getElementById('dupStrat').value) + '&prefer=' + enc(document.getElementById('dupPrefer').value);
    const r = await api('/api/duplicates/plan' + q); const d = await r.json();
    if (!r.ok) return alert(d.error || 'Mislukt');
    dupPlan = d.plan;
    const n = d.plan.reduce((a, g) => a + g.remove.length, 0);
    const preview = d.plan.slice(0, 8).map(g => `<li>behoud <b>${esc(g.keep)}</b>, weg: ${g.remove.map(esc).join(', ')}</li>`).join('');
    document.getElementById('dupPlanOut').innerHTML = n ? `${n} kopie(ën) naar de prullenbak, ${fmtMB(d.reclaim)} terug te winnen.<ul>${preview}</ul>${d.plan.length>8?'<div>…</div>':''}<button data-dupapply>Voorstel uitvoeren</button> <span>(vergrendelde, bewaarplichtige en intussen gewijzigde bestanden worden overgeslagen)</span>` : 'Geen duplicaten.';
  }
  if (t.hasAttribute && t.hasAttribute('data-dupapply') && dupPlan) {
    if (!confirm('Kopieën naar de prullenbak verplaatsen? (herstelbaar)')) return;
    const r = await (await api('/api/duplicates/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: dupPlan }) })).json();
    alert(`${r.removed} kopie(ën) opgeruimd (${fmtMB(r.reclaimed||0)}); ${r.skipped.length} overgeslagen.`); dupPlan = null; load(); return showDuplicates();
  }
  if (t.dataset && t.dataset.colopen) {
    const r = await (await api('/api/saved-searches/' + enc(t.dataset.colopen) + '/items')).json();
    const rows = (r.items||[]).map(i => `<tr><td>${esc(i.path)}</td><td>${(i.size/1024).toFixed(1)} kB</td><td>${new Date(i.mtime).toLocaleDateString()}</td></tr>`).join('');
    openModal(`<h3>📂 ${esc(r.collection.name)}</h3><p class="muted">${(r.items||[]).length} bestand(en), live bijgewerkt.</p><table><tr><th>Pad</th><th>Grootte</th><th>Gewijzigd</th></tr>${rows||'<tr><td colspan="3" class="muted">Geen bestanden.</td></tr>'}</table><button data-savedback style="margin-top:.5rem">← terug</button>`);
  }
  if (t.hasAttribute && t.hasAttribute('data-savedback')) return showSaved();
  if (t.hasAttribute && t.hasAttribute('data-cleantrash')) {
    const paths = [...document.querySelectorAll('input[data-cleanpick]:checked')].map(x => decodeURIComponent(x.dataset.cleanpick));
    if (!paths.length || !confirm(`${paths.length} bestand(en) naar de prullenbak verplaatsen?`)) return;
    await api('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths }) });
    load(); return showCleanup();
  }
  if (t.hasAttribute && t.hasAttribute('data-cleanrefresh')) return showCleanup();
  if (t.hasAttribute && t.hasAttribute('data-snipgo')) return runSnippets();
});
async function showCleanup() {
  openModal('<h3>🧹 Opruimadvies</h3><p class="muted">Bezig met analyseren…</p>');
  const oldDays = (document.getElementById('clOld')||{}).value || 365, largeMb = (document.getElementById('clLarge')||{}).value || 100;
  const d = await (await api(`/api/cleanup-advice?oldDays=${enc(oldDays)}&largeMb=${enc(largeMb)}`)).json();
  const total = d.categories.reduce((a, c) => a + (['large','old','never'].includes(c.id) ? 0 : c.reclaim), 0);
  const cat = c => `<details style="margin:.35rem 0"${c.items.length?'':' disabled'}><summary><b>${esc(c.label)}</b> — ${fmtMB(c.reclaim)} ${c.count?`(${c.count})`:''}</summary>
    ${c.items.length?`<div style="max-height:30vh;overflow:auto"><table>${c.items.map(i=>`<tr><td><input type="checkbox" data-cleanpick="${enc(i.path)}"></td><td>${esc(i.path)}</td><td>${fmtMB(i.size)}</td></tr>`).join('')}</table></div>`:
      c.id==='duplicates'?'<div class="muted">Gebruik de 🧬 duplicaten-assistent.</div>':c.id==='trash'?'<div class="muted">Leeg de prullenbak via het prullenbak-tabblad.</div>':c.id==='versions'?'<div class="muted">Oude versies worden automatisch beperkt (KEEP_VERSIONS).</div>':''}</details>`;
  openModal(`<h3>🧹 Opruimadvies</h3>
    <p class="muted">${d.totalFiles} bestanden, ${fmtMB(d.totalBytes)} in gebruik. Direct terug te winnen (duplicaten, prullenbak, versies): <b>${fmtMB(total)}</b>.</p>
    <div class="muted">Groot vanaf <input id="clLarge" type="number" min="1" value="${esc(String(largeMb))}" style="width:70px"> MB · ouder dan <input id="clOld" type="number" min="1" value="${esc(String(oldDays))}" style="width:70px"> dagen <button data-cleanrefresh>Vernieuwen</button></div>
    ${d.categories.map(cat).join('')}
    <button class="danger" data-cleantrash style="margin-top:.5rem">Geselecteerde naar prullenbak</button>`);
}
async function showSnippets() {
  openModal(`<h3>🔍 Zoeken in bestandsinhoud</h3>
    <div><input id="snipQ" placeholder="zoekterm (min. 2 tekens)" style="width:240px"> <button data-snipgo>Zoeken</button></div>
    <p class="muted">Doorzoekt tekst-, code-, Office-bestanden en OCR-tekst; toont fragmenten met de treffer.</p><div id="snipOut"></div>`);
  document.getElementById('snipQ').addEventListener('keydown', ev => { if (ev.key === 'Enter') runSnippets(); });
  document.getElementById('snipQ').focus();
}
async function runSnippets() {
  const q = document.getElementById('snipQ').value.trim(); const out = document.getElementById('snipOut');
  if (q.length < 2) return; out.textContent = 'Zoeken…';
  const r = await api('/api/search/snippets?q=' + enc(q)); const d = await r.json();
  if (!r.ok) { out.textContent = d.error || 'Mislukt'; return; }
  // Veilig markeren: escape eerst elk deel, dan <mark> om de treffer.
  const hl = sn => esc(sn.text.slice(0, sn.offset)) + '<mark>' + esc(sn.text.slice(sn.offset, sn.offset + q.length)) + '</mark>' + esc(sn.text.slice(sn.offset + q.length));
  out.innerHTML = d.results.length ? d.results.map(x => `<div style="border-bottom:1px solid var(--border);padding:.4rem 0"><b>${esc(x.path)}</b> <span class="muted">(${x.matches}×)</span>${x.snippets.map(sn=>`<div class="muted" style="font-size:.85rem">${hl(sn)}</div>`).join('')}</div>`).join('') : `<p class="muted">Niets gevonden (${d.scanned} bestanden doorzocht).</p>`;
}
const cleanBtn = document.getElementById('cleanBtn'); if (cleanBtn) cleanBtn.onclick = showCleanup;
const snipBtn = document.getElementById('snipBtn'); if (snipBtn) snipBtn.onclick = showSnippets;
async function showSecurity() {
  const [devsR, forR] = await Promise.all([api('/api/devices'), api('/api/session-forensics')]);
  const devs = (await devsR.json()).devices || [];
  const f = await forR.json();
  const drow = d => `<tr><td>${d.trusted?'✅':'⚠️'} ${esc((d.ua||'').slice(0,60)||'onbekend')}</td><td>${esc(d.ip||'')}</td><td>${new Date(d.lastSeen).toLocaleString()}</td><td>${d.trusted?'':`<button data-devtrust="${esc(d.id)}">vertrouw</button> `}<button class="danger" data-devforget="${esc(d.id)}">×</button></td></tr>`;
  const iprow = h => `<tr><td>${esc(h.ip)}</td><td>${h.count}</td><td>${esc((h.countries||[]).join(', '))}</td><td>${new Date(h.last).toLocaleString()}</td></tr>`;
  openModal(`<h3>🔒 Apparaten & beveiliging</h3>
    <h4>Vertrouwde apparaten</h4>
    <table><tr><th>Apparaat</th><th>IP</th><th>Laatst</th><th></th></tr>${devs.map(drow).join('')||'<tr><td colspan="4" class="muted">Geen apparaten.</td></tr>'}</table>
    ${f.geoJump?`<p style="color:var(--danger)">⚠️ Logins vanuit meerdere landen: ${esc((f.countries||[]).join(', '))}</p>`:''}
    <h4 style="margin-top:1rem">IP-historie</h4>
    <table><tr><th>IP</th><th>#</th><th>Land(en)</th><th>Laatst</th></tr>${(f.ipHistory||[]).map(iprow).join('')||'<tr><td colspan="4" class="muted">Geen data.</td></tr>'}</table>`);
}
async function showAutomation() {
  const [rl, sub, dg, tp, lc] = await Promise.all([api('/api/rules'), api('/api/subscriptions'), api('/api/digest'), api('/api/templates'), api('/api/lifecycle')]);
  const rules = (await rl.json()).rules || [];
  const subs = (await sub.json()).subscriptions || [];
  const pref = (await dg.json()).frequency || 'off';
  const tpls = (await tp.json()).templates || [];
  const pols = (await lc.json()).policies || [];
  const cond = r => [r.prefix, r.ext?'*'+r.ext:'', r.contains?'"'+r.contains+'"':'', r.minKb?'≥'+r.minKb+'kB':'', r.maxKb?'≤'+r.maxKb+'kB':''].filter(Boolean).join(' ');
  const rrow = r => `<tr style="${r.enabled?'':'opacity:.5'}"><td>${esc(cond(r))}</td><td>${esc(r.action)}${r.arg?' → '+esc(r.arg):''}</td><td><button data-ruletoggle="${esc(r.id)}" data-on="${r.enabled?1:0}">${r.enabled?'aan':'uit'}</button> <button class="danger" data-ruledel="${esc(r.id)}">×</button></td></tr>`;
  const srow = s => `<li>${esc(s.prefix)} <button class="danger" data-subdel="${esc(s.id)}">×</button></li>`;
  const opt = v => `<option value="${v}"${pref===v?' selected':''}>${v}</option>`;
  const trow = t => `<li>${esc(t.name)} (${t.entries.length}) <button data-tplapply="${esc(t.id)}">hier toepassen</button></li>`;
  const prow = p => `<tr><td>${esc(p.path)}</td><td>${p.warnDays||'-'}/${p.archiveDays||'-'}/${p.deleteDays||'-'}</td><td><button class="danger" data-lcdel="${esc(p.id)}">×</button></td></tr>`;
  openModal(`<h3>⚙️ Automatisering & workflows</h3>
    <h4>Regels (bij upload)</h4>
    <table><tr><th>Conditie</th><th>Actie</th><th></th></tr>${rules.map(rrow).join('')||'<tr><td colspan="3" class="muted">Geen regels.</td></tr>'}</table>
    <div style="margin-top:.4rem;display:flex;gap:.3rem;flex-wrap:wrap;align-items:center">
      <input id="rPrefix" placeholder="/map" style="width:80px"><input id="rExt" placeholder=".pdf" style="width:55px">
      <input id="rContains" placeholder="naam bevat" style="width:90px"><input id="rMin" type="number" placeholder="≥kB" style="width:60px"><input id="rMax" type="number" placeholder="≤kB" style="width:60px">
      <select id="rAction"><option value="tag">tag</option><option value="move">verplaats</option><option value="notify">notificeer</option><option value="label">classificatie</option></select>
      <input id="rArg" placeholder="waarde" style="width:100px"><button data-ruleadd>Regel toevoegen</button></div>
    <h4 style="margin-top:1rem">📁 Map-sjablonen</h4>
    <ul style="list-style:none;padding:0">${tpls.map(trow).join('')||'<li class="muted">Geen sjablonen (admin definieert ze).</li>'}</ul>
    <div class="muted" style="font-size:.8rem">Toepassen maakt de structuur aan in de huidige map (${esc(cwd||'/')}).</div>
    <h4 style="margin-top:1rem">♻️ Verloop-workflow (inactiviteit)</h4>
    <table><tr><th>Map</th><th>waarschuw/archiveer/wis (dagen)</th><th></th></tr>${pols.map(prow).join('')||'<tr><td colspan="3" class="muted">Geen beleid.</td></tr>'}</table>
    <div style="margin-top:.4rem;display:flex;gap:.3rem;flex-wrap:wrap;align-items:center">
      <input id="lcPath" placeholder="/map" style="width:90px"><input id="lcWarn" type="number" placeholder="waarsch." style="width:70px"><input id="lcArch" type="number" placeholder="archiveer" style="width:75px"><input id="lcDel" type="number" placeholder="wis" style="width:55px">
      <button data-lcadd>Beleid toevoegen</button> <button data-lcrun>Nu uitvoeren</button></div>
    <h4 style="margin-top:1rem">Gevolgde mappen</h4>
    <ul style="list-style:none;padding:0">${subs.map(srow).join('')||'<li class="muted">Geen abonnementen.</li>'}</ul>
    <div><input id="subPrefix" placeholder="/map" style="width:110px"><button data-subadd>Map volgen</button></div>
    <h4 style="margin-top:1rem">Digest-samenvatting</h4>
    <select id="digestFreq">${opt('off')}${opt('daily')}${opt('weekly')}</select> <button data-digestsave>Opslaan</button>`);
}
// Deel-presets & klantportalen (features 5 + 8).
// --- v3.44: gasttoegang ---
function guestLinkHtml(link, mailed) {
  return `<div class="card" style="margin:.6rem 0;padding:.6rem;border:1px solid var(--border);border-radius:var(--radius,8px)">
    <div class="muted">${mailed ? 'De uitnodiging is gemaild. ' : ''}Eenmalige inloglink (7 dagen geldig):</div>
    <code style="word-break:break-all">${esc(link)}</code><br><button class="ghost" data-copy="${esc(link)}">📋 Kopiëren</button></div>`;
}
async function showGuests(forPath) {
  const r = await (await api('/api/guests')).json();
  const list = (r.guests || []).map(g => `<tr><td>${esc(g.label)}<div class="muted" style="font-size:.8rem">${esc(g.guest)}${g.email?' · '+esc(g.email):''}</div></td>
    <td>${esc(g.path||'-')} <span class="muted">(${g.mode==='rw'?'lezen+schrijven':'alleen-lezen'})</span></td>
    <td>${new Date(g.expires).toLocaleDateString()}</td><td>${g.lastLogin?new Date(g.lastLogin).toLocaleString():'<span class="muted">nog niet</span>'}</td>
    <td><button class="ghost" data-guestlink="${enc(g.guest)}">Nieuwe link</button> <button class="danger" data-guestdel="${enc(g.guest)}">Intrekken</button></td></tr>`).join('');
  openModal(`<h3>🎟️ Gasttoegang</h3>
    <p class="muted">Nodig iemand zonder account uit voor één map. De gast logt in met een eenmalige link, ziet alleen die map en het account verloopt vanzelf.</p>
    <form id="guestForm" style="display:grid;grid-template-columns:auto 1fr;gap:.4rem .6rem;align-items:center;max-width:520px">
      <label>Map</label><input name="path" value="${esc(forPath || cwd)}" required>
      <label>Naam</label><input name="label" placeholder="bv. Accountant Jansen">
      <label>E-mail</label><input name="email" type="email" placeholder="optioneel — dan mailen we de link">
      <label>Rechten</label><select name="mode"><option value="ro">Alleen lezen</option><option value="rw">Lezen + uploaden</option></select>
      <label>Geldig</label><select name="days"><option value="1">1 dag</option><option value="7" selected>7 dagen</option><option value="30">30 dagen</option><option value="90">90 dagen</option></select>
      <span></span><button type="submit">Gast uitnodigen</button>
    </form><div id="guestOut"></div>
    <h4>Actieve gasten</h4>${list ? `<table><thead><tr><th>Gast</th><th>Map</th><th>Verloopt</th><th>Laatst actief</th><th></th></tr></thead><tbody>${list}</tbody></table>` : '<p class="muted">Nog geen gasten.</p>'}`);
  document.getElementById('guestForm').onsubmit = async (e) => {
    e.preventDefault(); const body = Object.fromEntries(new FormData(e.target));
    const res = await api('/api/guests', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const j = await res.json(); if (!res.ok) return alert(j.error || 'Mislukt');
    await showGuests(body.path); document.getElementById('guestOut').innerHTML = guestLinkHtml(j.link, j.mailed);
  };
}
// --- v3.44: leesbevestigingen ---
async function showReceipts(p) {
  const r = await (await api('/api/receipts?path='+enc(p))).json();
  const rows = (r.reads || []).map(x => `<tr><td>${esc(x.who)}</td><td>${esc(x.path)}</td><td>${esc(x.via)}</td><td>${new Date(x.ts).toLocaleString()}</td></tr>`).join('');
  const state = r.tracked === 'self' ? 'aan' : r.tracked === 'parent' ? `aan via bovenliggende map ${esc(r.trackedPath)}` : 'uit';
  openModal(`<h3>📬 Leesbevestigingen</h3><p><b>${esc(p)}</b></p>
    <p>Status: <b>${state}</b>. Je krijgt een melding zodra iemand anders dit voor het eerst opent of downloadt (via gedeelde map, gastlink, deellink of permalink).</p>
    ${r.tracked === 'parent' ? '' : `<button id="rcToggle">${r.tracked ? 'Uitzetten' : 'Aanzetten'}</button>`}
    <h4>Gelezen door</h4>${rows ? `<table><thead><tr><th>Wie</th><th>Bestand</th><th>Via</th><th>Wanneer</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">Nog niemand.</p>'}`);
  const b = document.getElementById('rcToggle');
  if (b) b.onclick = async () => { await api('/api/receipts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: p, on: !r.tracked }) }); showReceipts(p); };
}

async function showSharing() {
  const [pr, po] = await Promise.all([api('/api/share-presets'), api('/api/portals')]);
  const presets = (await pr.json()).presets || [];
  const ports = (await po.json()).portals || [];
  const prow = x => `<tr><td>${esc(x.name)}</td><td>${x.expiresInHours||'∞'} u · ${x.maxDownloads||'∞'} dl${x.autoPassword?' · 🔑 auto':''}</td><td><button class="danger" data-presetdel="${esc(x.id)}">×</button></td></tr>`;
  const porow = x => `<tr><td>${esc(x.name)}<br><small class="muted">${esc(x.path)}</small></td><td>${x.allowUpload?'⬆️ ':''}${x.hasPassword?'🔑 ':''}${x.views} bezoeken · ${x.uploads} uploads</td><td><button data-portalcopy="${esc(x.token)}">link</button> <button class="danger" data-portaldel="${esc(x.token)}">×</button></td></tr>`;
  openModal(`<h3>🤝 Delen & portalen</h3>
    <h4>Deel-link-presets</h4>
    <table><tr><th>Naam</th><th>Instellingen</th><th></th></tr>${presets.map(prow).join('')||'<tr><td colspan="3" class="muted">Nog geen presets.</td></tr>'}</table>
    <div style="margin-top:.4rem;display:flex;gap:.3rem;flex-wrap:wrap;align-items:center">
      <input id="psName" placeholder="naam" style="width:110px"><input id="psHrs" type="number" min="0" placeholder="uur" style="width:65px">
      <input id="psMax" type="number" min="0" placeholder="max dl" style="width:70px"><label><input type="checkbox" id="psAuto"> auto-wachtwoord</label>
      <button data-presetadd>Preset opslaan</button></div>
    <h4 style="margin-top:1rem">Klantportalen</h4>
    <table><tr><th>Portaal</th><th>Status</th><th></th></tr>${ports.map(porow).join('')||'<tr><td colspan="3" class="muted">Nog geen portalen.</td></tr>'}</table>
    <div style="margin-top:.4rem;display:grid;gap:.3rem">
      <div style="display:flex;gap:.3rem;flex-wrap:wrap"><input id="ptName" placeholder="naam (bijv. klant)" style="width:130px"><input id="ptPath" placeholder="map" value="${esc(cwd||'/')}" style="width:130px"><input id="ptTitle" placeholder="koptekst" style="width:130px"><input id="ptAccent" placeholder="#kleur" style="width:80px"></div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center"><label><input type="checkbox" id="ptUpload"> klant mag aanleveren</label><input id="ptPw" placeholder="wachtwoord (optioneel)" style="width:160px"><input id="ptDays" type="number" min="0" placeholder="geldig (dagen)" style="width:110px"><button data-portaladd>Portaal maken</button></div>
    </div>`);
}
// Apparaat koppelen (QR) en netwerkschijf-profielen (features 10 + 11).
let pairTimer = null;
function stopPairPoll() { if (pairTimer) { clearInterval(pairTimer); pairTimer = null; } }
async function showClients() {
  stopPairPoll();
  const { profiles, diagnose } = await (await api('/api/mount-profiles')).json();
  const checks = diagnose.checks.map(c => `<li>${c.ok?'✅':'⚠️'} <b>${esc(c.label)}</b> — <span class="muted">${esc(c.detail)}</span></li>`).join('');
  const prof = profiles.map(p => `<details style="margin:.4rem 0"><summary><b>${esc(p.title)}</b> <span class="muted">(${esc(p.os)})</span></summary>
      <pre style="white-space:pre-wrap">${esc(p.body)}</pre><div class="muted">${esc(p.hint)}</div>
      ${p.file?`<a href="/api/mount-profiles/${esc(p.id)}/download"><button style="margin-top:.3rem">⬇ ${esc(p.file)}</button></a>`:''}</details>`).join('');
  openModal(`<h3>📲 Apparaten & netwerkschijf</h3>
    <h4>Nieuw apparaat koppelen (QR)</h4>
    <p class="muted">Scan de QR met je telefoon. Je keurt de koppeling hier daarna expliciet goed; zonder goedkeuring gebeurt er niets.</p>
    <button data-pairstart>QR-code maken</button>
    <div id="pairArea" style="margin-top:.6rem"></div>
    <h4 style="margin-top:1rem">Netwerkschijf koppelen</h4>
    <ul style="list-style:none;padding:0">${checks}</ul>
    ${prof}`);
}
async function pairTick(code) {
  const r = await api('/api/pair/pending?code=' + encodeURIComponent(code));
  const area = document.getElementById('pairArea');
  if (!area) return stopPairPoll(); // modal gesloten
  if (!r.ok) { stopPairPoll(); area.innerHTML = '<p class="muted">De QR-code is verlopen. Maak een nieuwe.</p>'; return; }
  const p = await r.json();
  if (p.status === 'claimed' && !document.getElementById('pairDecide')) {
    stopPairPoll();
    area.insertAdjacentHTML('beforeend', `<div id="pairDecide" style="border:1px solid var(--border);border-radius:8px;padding:.6rem;margin-top:.5rem">
      <b>Koppelverzoek</b><br>Naam: ${esc(p.claim.name||'(geen)')}<br>Browser: <span class="muted">${esc(p.claim.ua)}</span><br>IP: ${esc(p.claim.ip)}<br>
      Controlecode: <b>${esc(p.checkCode||'')}</b> <span class="muted">(moet overeenkomen met het scherm van het nieuwe apparaat)</span><br>
      <button data-pairdecide="${esc(code)}" data-approve="1" style="margin-top:.4rem">✅ Goedkeuren</button> <button class="danger" data-pairdecide="${esc(code)}" data-approve="0">Afwijzen</button></div>`);
  }
}
const clientsBtn = document.getElementById('clientsBtn'); if (clientsBtn) clientsBtn.onclick = showClients;
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.hasAttribute && t.hasAttribute('data-pairstart')) {
    const r = await api('/api/pair/start', { method: 'POST' });
    const d = await r.json();
    if (!r.ok) return alert(d.error || 'Mislukt');
    // De SVG komt van onze eigen server (qrcode-bibliotheek) en bevat alleen de koppel-URL.
    document.getElementById('pairArea').innerHTML = `<div style="background:#fff;display:inline-block;padding:.4rem;border-radius:6px">${d.qr}</div>
      <p class="muted">Geldig tot ${new Date(d.expires).toLocaleTimeString()}.</p>`;
    stopPairPoll();
    pairTimer = setInterval(() => pairTick(d.code), 2000);
  }
  if (t.dataset && t.dataset.pairdecide) {
    const approve = t.dataset.approve === '1';
    const r = await (await api('/api/pair/decide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: t.dataset.pairdecide, approve }) })).json();
    document.getElementById('pairArea').innerHTML = `<p>${r.ok ? (approve ? '✅ Apparaat gekoppeld en als vertrouwd opgeslagen.' : 'Koppeling afgewezen.') : 'Mislukt: ' + esc(r.error || '')}</p>`;
  }
});
const guestsBtn = document.getElementById('guestsBtn'); if (guestsBtn) guestsBtn.onclick = () => showGuests();
const sharingBtn = document.getElementById('sharingBtn'); if (sharingBtn) sharingBtn.onclick = showSharing;
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.hasAttribute && t.hasAttribute('data-presetadd')) {
    const r = await (await api('/api/share-presets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('psName').value,expiresInHours:document.getElementById('psHrs').value,maxDownloads:document.getElementById('psMax').value,autoPassword:document.getElementById('psAuto').checked})})).json();
    if (r.error) return alert(r.error); return showSharing();
  }
  if (t.dataset.presetdel) { await api('/api/share-presets/'+encodeURIComponent(t.dataset.presetdel),{method:'DELETE'}); return showSharing(); }
  if (t.hasAttribute && t.hasAttribute('data-portaladd')) {
    const r = await (await api('/api/portals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('ptName').value,path:document.getElementById('ptPath').value||'/',title:document.getElementById('ptTitle').value,accent:document.getElementById('ptAccent').value,allowUpload:document.getElementById('ptUpload').checked,password:document.getElementById('ptPw').value,expiresInDays:document.getElementById('ptDays').value})})).json();
    if (r.error) return alert(r.error);
    showLink('Klantportaal', location.origin + r.url); return;
  }
  if (t.dataset.portalcopy) { showLink('Klantportaal', location.origin + '/p/' + t.dataset.portalcopy); return; }
  if (t.dataset.portaldel) { if (!confirm('Portaal verwijderen? De link werkt daarna niet meer.')) return; await api('/api/portals/'+encodeURIComponent(t.dataset.portaldel),{method:'DELETE'}); return showSharing(); }
});
const autoBtn = document.getElementById('autoBtn'); if (autoBtn) autoBtn.onclick = showAutomation;
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.hasAttribute && t.hasAttribute('data-ruleadd')) { await api('/api/rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:document.getElementById('rPrefix').value||'/',ext:document.getElementById('rExt').value,contains:document.getElementById('rContains').value,minKb:document.getElementById('rMin').value,maxKb:document.getElementById('rMax').value,action:document.getElementById('rAction').value,arg:document.getElementById('rArg').value})}); return showAutomation(); }
  if (t.dataset.ruledel) { await api('/api/rules/'+encodeURIComponent(t.dataset.ruledel),{method:'DELETE'}); return showAutomation(); }
  if (t.dataset.ruletoggle) { await api('/api/rules/'+encodeURIComponent(t.dataset.ruletoggle)+'/enabled',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:t.dataset.on!=='1'})}); return showAutomation(); }
  if (t.dataset.tplapply) { const r=await (await api('/api/templates/'+encodeURIComponent(t.dataset.tplapply)+'/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:cwd||'/'})})).json(); alert(r.ok?('Aangemaakt: '+r.created+' item(s)'):('Fout: '+(r.error||''))); load(); }
  if (t.hasAttribute && t.hasAttribute('data-lcadd')) { await api('/api/lifecycle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:document.getElementById('lcPath').value||'/',warnDays:document.getElementById('lcWarn').value,archiveDays:document.getElementById('lcArch').value,deleteDays:document.getElementById('lcDel').value})}); return showAutomation(); }
  if (t.dataset.lcdel) { await api('/api/lifecycle/'+encodeURIComponent(t.dataset.lcdel),{method:'DELETE'}); return showAutomation(); }
  if (t.hasAttribute && t.hasAttribute('data-lcrun')) { const r=await (await api('/api/lifecycle/run',{method:'POST'})).json(); alert('Gewaarschuwd: '+r.warned+' · gearchiveerd: '+r.archived+' · gewist: '+r.deleted); load(); }
  if (t.hasAttribute && t.hasAttribute('data-subadd')) { await api('/api/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:document.getElementById('subPrefix').value||'/'})}); return showAutomation(); }
  if (t.dataset.subdel) { await api('/api/subscriptions/'+encodeURIComponent(t.dataset.subdel),{method:'DELETE'}); return showAutomation(); }
  if (t.hasAttribute && t.hasAttribute('data-digestsave')) { await api('/api/digest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({frequency:document.getElementById('digestFreq').value})}); alert('Opgeslagen.'); }
});
const secBtn = document.getElementById('secBtn'); if (secBtn) secBtn.onclick = showSecurity;
document.addEventListener('click', async (e) => {
  if (e.target.dataset.devtrust) { await api('/api/devices/'+encodeURIComponent(e.target.dataset.devtrust)+'/trust',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return showSecurity(); }
  if (e.target.dataset.devforget) { await api('/api/devices/'+encodeURIComponent(e.target.dataset.devforget),{method:'DELETE'}); return showSecurity(); }
});
// Media-bewerken: afbeelding (roteren/spiegelen), PDF (roteren/splitsen), video/audio (transcode/transcript).
function showMediaTools(p) {
  const isImg = /\.(jpe?g|png|webp|gif|tiff?|avif)$/i.test(p);
  const isPdf = /\.pdf$/i.test(p);
  const isVid = /\.(mp4|mkv|mov|webm|m4v)$/i.test(p);
  const isAud = /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(p);
  let body = `<h3>🛠 Media bewerken — ${esc(p.split('/').pop())}</h3>`;
  if (isImg) body += `<div style="text-align:center"><img id="mediaPrev" src="/api/preview?path=${enc(p)}" style="max-width:70vw;max-height:50vh"></div>
    <div style="margin-top:.6rem;display:flex;gap:.4rem;flex-wrap:wrap">
      <button data-img="rot90">↻ 90°</button><button data-img="rot270">↺ 90°</button><button data-img="flip">⇅ spiegel</button><button data-img="flop">⇄ spiegel</button></div>`;
  if (isPdf) body += `<div style="margin-top:.6rem;display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
      <button data-pdfrot>PDF 90° draaien</button>
      <input id="pdfRanges" placeholder="pagina's bijv. 1-3,5" style="width:130px"><button data-pdfsplit>Splitsen</button></div>`;
  if (isVid) body += `<div style="margin-top:.6rem"><button data-transcode="mp4">Transcodeer → MP4</button> <button data-transcode="webm">→ WebM</button></div>`;
  if (isVid || isAud) body += `<div style="margin-top:.4rem"><button data-transcribe>Transcriptie (spraak→tekst)</button></div>`;
  body += `<div class="muted" id="mediaMsg" style="margin-top:.6rem"></div>`;
  openModal(body);
  const msg = () => document.getElementById('mediaMsg');
  const call = async (url, payload, okText) => { msg().textContent='Bezig…'; const r = await api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const d = await r.json().catch(()=>({})); if (r.ok && d.ok!==false && !d.error) { msg().style.color='#4ade80'; msg().textContent = okText + (d.path?(': '+d.path):''); load(); } else { msg().style.color='#f87171'; msg().textContent = d.error || ('Mislukt ('+r.status+')'); } };
  document.querySelectorAll('#modal [data-img]').forEach(b => b.onclick = () => {
    const op = b.dataset.img; const ops = op==='rot90'?{rotate:90}:op==='rot270'?{rotate:270}:op==='flip'?{flip:true}:{flop:true};
    call('/api/image/transform', { path:p, ops }, 'Opgeslagen als nieuw bestand');
  });
  const pr = document.querySelector('#modal [data-pdfrot]'); if (pr) pr.onclick = () => call('/api/pdf/rotate', { path:p, degrees:90 }, 'PDF gedraaid');
  const ps = document.querySelector('#modal [data-pdfsplit]'); if (ps) ps.onclick = () => call('/api/pdf/split', { path:p, ranges:document.getElementById('pdfRanges').value }, 'PDF-selectie opgeslagen');
  document.querySelectorAll('#modal [data-transcode]').forEach(b => b.onclick = () => call('/api/transcode', { path:p, format:b.dataset.transcode }, 'Getranscodeerd'));
  const tb = document.querySelector('#modal [data-transcribe]'); if (tb) tb.onclick = () => call('/api/transcribe', { path:p }, 'Transcript opgeslagen');
}
// Digitale ondertekening & verificatie (feature 1).
async function showSigning(p) {
  const v = await (await api('/api/verify?path='+enc(p))).json();
  const rows = (v.results||[]).map(r=>`<li>${r.valid&&r.unchanged?'✅':'⚠️'} ${esc(r.by)} · ${new Date(r.ts).toLocaleString()} — ${r.valid?'geldig':'ongeldig'}, ${r.unchanged?'ongewijzigd':'GEWIJZIGD sinds tekenen'}</li>`).join('');
  openModal(`<h3>✍️ Ondertekening — ${esc(p.split('/').pop())}</h3>
    <ul>${rows||'<li class="muted">Nog niet ondertekend.</li>'}</ul>
    <button data-dosign="${enc(p)}">Onderteken dit bestand</button>
    <a href="/api/signing/pubkey" target="_blank" style="margin-left:.5rem;color:var(--accent)">publieke sleutel</a>`);
}
// Mijn taken (feature 7).
async function showTasks() {
  const { tasks } = await (await api('/api/file-tasks')).json();
  const rows = (tasks||[]).map(t=>`<tr><td>${t.status==='klaar'?'✅':'⬜'} ${esc(t.title)}</td><td>${esc(t.path||'')}</td><td>${esc(t.assignee)}</td><td>
    <select data-taskstatus="${esc(t.id)}"><option${t.status==='open'?' selected':''}>open</option><option${t.status==='bezig'?' selected':''}>bezig</option><option${t.status==='klaar'?' selected':''}>klaar</option></select>
    <button class="danger" data-taskdel="${esc(t.id)}">×</button></td></tr>`).join('');
  openModal(`<h3>✅ Mijn taken</h3><table style="width:70vw"><tr><th>Taak</th><th>Bestand</th><th>Voor</th><th></th></tr>${rows||'<tr><td colspan="4" class="muted">Geen taken.</td></tr>'}</table>
    <div style="margin-top:.6rem;display:flex;gap:.3rem;flex-wrap:wrap"><input id="taskTitle" placeholder="titel" style="width:150px"><input id="taskPath" placeholder="/pad (optioneel)" style="width:120px"><input id="taskAssignee" placeholder="voor wie" style="width:90px"><button data-taskadd>Taak toevoegen</button></div>`);
}
// AI-assistent (feature 9): stel een vraag, optioneel over een bestand.
async function showAi(pathHint) {
  openModal(`<h3>🤖 AI-assistent</h3>
    <input id="aiPath" placeholder="/pad naar bestand (optioneel, als context)" value="${esc(pathHint||'')}" style="width:100%">
    <textarea id="aiQ" placeholder="Stel je vraag..." style="width:100%;height:5rem;margin-top:.4rem"></textarea>
    <button data-aiask style="margin-top:.4rem">Vraag stellen</button>
    <pre id="aiOut" class="muted" style="white-space:pre-wrap;margin-top:.6rem"></pre>`);
}
// Beeldherkenning (feature 10): analyseer nu + toon/zoek labels.
async function showVision(p) {
  const cur = await (await api('/api/vision/labels?path='+enc(p))).json();
  const chips = (cur.labels||[]).map(l=>`<a href="#" data-vsearch="${esc(l)}" style="color:var(--accent);margin-right:.4rem">#${esc(l)}</a>`).join('');
  openModal(`<h3>🔍 Beeldherkenning — ${esc(p.split('/').pop())}</h3>
    <div>${chips||'<span class="muted">Nog geen labels.</span>'}</div>
    <button data-vdetect="${enc(p)}" style="margin-top:.5rem">Analyseer nu</button>
    <pre id="visionOut" class="muted" style="white-space:pre-wrap;margin-top:.5rem"></pre>`);
}
// Mapstructuur-suggestie (feature 11): voorstel per type/extensie/datum + toepassen.
async function showOrganize(mode) {
  mode = mode || 'type';
  const s = await (await api('/api/organize/suggest?path='+enc(cwd||'/')+'&mode='+mode)).json();
  const folders = (s.folders||[]).map(f=>`<li>${esc(f.folder)}/ — ${f.count} bestanden</li>`).join('');
  openModal(`<h3>🗂️ Mapstructuur-suggestie</h3>
    <div>Map: <code>${esc(s.base||'/')}</code> · groeperen per
      <select id="orgMode"><option value="type"${mode==='type'?' selected':''}>type</option><option value="ext"${mode==='ext'?' selected':''}>extensie</option><option value="date"${mode==='date'?' selected':''}>jaar</option></select></div>
    <ul>${folders||'<li class="muted">Geen groepen van 2+ bestanden gevonden.</li>'}</ul>
    ${(s.moves||[]).length?`<button data-orgapply>Verplaats ${s.moves.length} bestanden</button>`:''}`);
  window.__orgMoves = s.moves||[];
}
// Invoer & integraties (features 13-15): e-mail-upload, hot-folder, chat-bot.
async function showInbound() {
  const et = await (await api('/api/email/token')).json();
  const cb = await (await api('/api/chat/status')).json();
  let hf = { enabled:false };
  if (me.role === 'admin') { try { hf = await (await api('/api/hotfolder/status')).json(); } catch {} }
  const addr = et.token ? `<code style="word-break:break-all">POST /api/email-inbox/${esc(et.token)}</code>` : '<span class="muted">nog geen adres</span>';
  openModal(`<h3>📥 Invoer & integraties</h3>
    <h4>📧 Upload via e-mail</h4>
    <p class="muted">Laat je mailprovider geparste e-mails met bijlagen naar dit adres POST'en; bijlagen komen in <code>${esc('/'+'Inbox-mail')}</code>.</p>
    <div>${addr}</div>
    <button data-emltoken="new">${et.token?'Vernieuw adres':'Maak adres aan'}</button>
    ${et.token?'<button class="danger" data-emltoken="revoke">Intrekken</button>':''}
    <h4 style="margin-top:1rem">💬 Chat-bot</h4>
    <p class="muted">Status: ${cb.enabled?`✅ actief (werkt in home van <code>${esc(cb.user)}</code>)`:'⚪ uit — stel <code>CHAT_BOT_TOKEN</code> en <code>CHAT_BOT_USER</code> in'}. Commando's: <code>list</code>, <code>search</code>, <code>help</code>.</p>
    ${me.role==='admin'?`<h4 style="margin-top:1rem">🗂️ Scan-naar-map (hot-folder)</h4>
    <p class="muted">${hf.enabled?`✅ actief: <code>${esc(hf.dir||'')}</code> → <code>${esc('/'+(hf.target||''))}</code>`:'⚪ uit — stel <code>HOTFOLDER_DIR</code> en <code>HOTFOLDER_USER</code> in'}</p>
    ${hf.enabled?'<button data-hfscan>Nu scannen</button>':''}<pre id="inboundOut" class="muted" style="white-space:pre-wrap"></pre>`:''}`);
}
// Weergave & inzicht (features 17-19): kaart, tijdlijn, relatiegrafiek.
async function showInsights(tab) {
  tab = tab || 'kaart';
  const nav = `<div style="display:flex;gap:.3rem;margin-bottom:.6rem">
    <button data-insight="kaart"${tab==='kaart'?' class="primary"':''}>🗺️ Kaart</button>
    <button data-insight="tijdlijn"${tab==='tijdlijn'?' class="primary"':''}>🕰️ Tijdlijn</button>
    <button data-insight="grafiek"${tab==='grafiek'?' class="primary"':''}>🕸️ Grafiek</button></div>`;
  openModal(`<h3>📈 Weergave & inzicht</h3>${nav}<div id="insightBody" class="muted">Laden…</div>`);
  const body = document.getElementById('insightBody');
  try {
    if (tab === 'kaart') {
      const { photos } = await (await api('/api/geo/photos?path=' + enc(cwd || '/'))).json();
      body.innerHTML = renderMap(photos || []);
    } else if (tab === 'tijdlijn') {
      const tl = await (await api('/api/timeline?path=' + enc(cwd || '/'))).json();
      const months = (tl.months || []).map(m => `<li><b>${esc(m.month)}</b> — ${m.count}</li>`).join('');
      const items = (tl.items || []).slice(0, 60).map(i => `<li>${new Date(i.ts).toLocaleDateString()} — ${esc(i.path)}</li>`).join('');
      body.innerHTML = `<div style="display:flex;gap:1rem;flex-wrap:wrap"><div><h4>Per maand</h4><ul>${months||'<li>geen</li>'}</ul></div><div style="flex:1;min-width:220px"><h4>Recent</h4><ul style="max-height:50vh;overflow:auto">${items||'<li>geen</li>'}</ul></div></div>`;
    } else {
      const g = await (await api('/api/graph/tags')).json();
      body.innerHTML = renderGraph(g.nodes || [], g.edges || []);
    }
  } catch (err) { body.textContent = 'Fout: ' + err.message; }
}
function renderMap(photos) {
  if (!photos.length) return '<p>Geen foto\'s met GPS-gegevens gevonden in deze map.</p>';
  const W = 640, H = 320;
  const pts = photos.map(p => {
    const x = ((p.lng + 180) / 360) * W, y = ((90 - p.lat) / 180) * H;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="var(--accent)" opacity=".8"><title>${esc(p.path)} (${p.lat}, ${p.lng})</title></circle>`;
  }).join('');
  return `<p>${photos.length} foto('s) met locatie:</p><svg viewBox="0 0 ${W} ${H}" style="width:100%;border:1px solid var(--border);background:var(--bg-alt)">
    <rect width="${W}" height="${H}" fill="none"/>
    <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="var(--border)"/><line x1="${W/2}" y1="0" x2="${W/2}" y2="${H}" stroke="var(--border)"/>
    ${pts}</svg><ul style="max-height:30vh;overflow:auto">${photos.map(p=>`<li>${esc(p.path)} — ${p.lat}, ${p.lng}</li>`).join('')}</ul>`;
}
function renderGraph(nodes, edges) {
  if (!nodes.length) return '<p>Nog geen getagde bestanden — voeg tags toe om verbindingen te zien.</p>';
  const n = nodes.slice(0, 40), R = 150, cx = 180, cy = 180;
  const pos = {}; n.forEach((nd, i) => { const a = (i / n.length) * 2 * Math.PI; pos[nd.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
  const lines = edges.filter(e => pos[e.source] && pos[e.target]).map(e => `<line x1="${pos[e.source].x.toFixed(0)}" y1="${pos[e.source].y.toFixed(0)}" x2="${pos[e.target].x.toFixed(0)}" y2="${pos[e.target].y.toFixed(0)}" stroke="var(--accent)" stroke-width="${Math.min(4,e.weight)}" opacity=".4"><title>${esc(e.tags.join(', '))}</title></line>`).join('');
  const dots = n.map(nd => `<g><circle cx="${pos[nd.id].x.toFixed(0)}" cy="${pos[nd.id].y.toFixed(0)}" r="6" fill="var(--accent)"><title>${esc(nd.id)} [${esc((nd.tags||[]).join(', '))}]</title></circle><text x="${(pos[nd.id].x+8).toFixed(0)}" y="${pos[nd.id].y.toFixed(0)}" font-size="10" fill="var(--fg)">${esc(nd.name.slice(0,16))}</text></g>`).join('');
  return `<p>${nodes.length} bestand(en), ${edges.length} verbinding(en) via gedeelde tags:</p><svg viewBox="0 0 380 360" style="width:100%;border:1px solid var(--border);background:var(--bg-alt)">${lines}${dots}</svg>`;
}
const insightsBtn = document.getElementById('insightsBtn'); if (insightsBtn) insightsBtn.onclick = () => showInsights('kaart');
const inboundBtn = document.getElementById('inboundBtn'); if (inboundBtn) inboundBtn.onclick = showInbound;
const aiBtn = document.getElementById('aiBtn'); if (aiBtn) aiBtn.onclick = () => showAi('');
const organizeBtn = document.getElementById('organizeBtn'); if (organizeBtn) organizeBtn.onclick = () => showOrganize('type');
const tasksBtn = document.getElementById('tasksBtn'); if (tasksBtn) tasksBtn.onclick = showTasks;
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.dosign) { const r = await api('/api/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(t.dataset.dosign)})}); if(r.ok) showSigning(decodeURIComponent(t.dataset.dosign)); else alert('Tekenen mislukt'); }
  if (t.hasAttribute && t.hasAttribute('data-taskadd')) { const title=document.getElementById('taskTitle').value.trim(); if(!title)return; await api('/api/file-tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,path:document.getElementById('taskPath').value,assignee:document.getElementById('taskAssignee').value})}); showTasks(); }
  if (t.dataset.taskdel) { await api('/api/file-tasks/'+encodeURIComponent(t.dataset.taskdel),{method:'DELETE'}); showTasks(); }
  if (t.hasAttribute && t.hasAttribute('data-aiask')) {
    const out=document.getElementById('aiOut'); out.textContent='Bezig...';
    const r=await api('/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:document.getElementById('aiQ').value,path:document.getElementById('aiPath').value})});
    const j=await r.json(); out.textContent = r.ok ? (j.answer||'(leeg)') : ('Fout: '+(j.error||r.status));
  }
  if (t.dataset.vdetect) {
    const out=document.getElementById('visionOut'); out.textContent='Analyseren...';
    const r=await api('/api/vision/detect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(t.dataset.vdetect)})});
    const j=await r.json(); if(r.ok) showVision(decodeURIComponent(t.dataset.vdetect)); else out.textContent='Fout: '+(j.error||r.status);
  }
  if (t.dataset.vsearch) { e.preventDefault(); const j=await (await api('/api/vision/search?label='+enc(t.dataset.vsearch))).json(); alert('Bestanden met #'+t.dataset.vsearch+':\n'+((j.files||[]).join('\n')||'geen')); }
  if (t.hasAttribute && t.hasAttribute('data-orgapply')) { const j=await (await api('/api/organize/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({moves:window.__orgMoves||[]})})).json(); alert('Verplaatst: '+(j.moved||0)+', overgeslagen: '+((j.skipped||[]).length)); closeModal(); load(cwd); }
  if (t.dataset.emltoken==='new') { await api('/api/email/token',{method:'POST'}); showInbound(); }
  if (t.dataset.emltoken==='revoke') { if(confirm('Adres intrekken?')){ await api('/api/email/token',{method:'DELETE'}); showInbound(); } }
  if (t.hasAttribute && t.hasAttribute('data-hfscan')) { const out=document.getElementById('inboundOut'); out.textContent='Scannen...'; const j=await (await api('/api/hotfolder/scan',{method:'POST'})).json(); out.textContent = j.ok ? ('Geïmporteerd: '+(j.imported||[]).length+', afgekeurd: '+(j.rejected||[]).length) : ('Fout: '+(j.error||'')); }
  if (t.dataset.insight) { showInsights(t.dataset.insight); }
});
document.addEventListener('change', async (e) => {
  if (e.target.dataset && e.target.dataset.taskstatus) { await api('/api/file-tasks/'+encodeURIComponent(e.target.dataset.taskstatus)+'/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:e.target.value})}); }
  if (e.target.id === 'orgMode') { showOrganize(e.target.value); }
});
const teamsBtn = document.getElementById('teamsBtn'); if (teamsBtn) teamsBtn.onclick = () => showTeams();
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.teamopen) return showTeamSpace(t.dataset.teamopen);
  if (t.dataset.teamcd) { const [id,p] = t.dataset.teamcd.split('|'); return showTeamSpace(id, p); }
  if (t.hasAttribute && t.hasAttribute('data-teamcreate')) { const n = document.getElementById('teamNew').value.trim(); if (!n) return; await api('/api/teams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})}); return showTeams(); }
  if (t.dataset.teamdel) { const [id,p] = t.dataset.teamdel.split('|'); if (!confirm('Verwijderen?')) return; await api(`/api/teams/${id}/file?path=`+enc(p),{method:'DELETE'}); return showTeamSpace(id); }
  if (t.dataset.teamaddmember) { const id = t.dataset.teamaddmember; const u = document.getElementById('teamMember').value.trim(); const role = document.getElementById('teamRole').value; if (!u) return; const rr = await api(`/api/teams/${id}/members`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:u,role})}); if(!rr.ok){const ee=await rr.json().catch(()=>({}));alert(ee.error||'Mislukt');} return showTeamSpace(id); }
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'teamUp' && e.target.files.length) {
    const id = e.target.dataset.teamid, p = e.target.dataset.teampath;
    for (const f of e.target.files) { const fd = new FormData(); fd.append('file', f, f.name); await api(`/api/teams/${id}/upload?path=`+enc(p),{method:'POST',body:fd}); }
    showTeamSpace(id, p);
  }
});
const jitBtn = document.getElementById('jitBtn');
if (jitBtn) jitBtn.onclick = async () => {
  const role = prompt('Welke tijdelijke rol aanvragen? (user/readonly/admin)', 'admin');
  if (!role) return;
  const reason = prompt('Reden voor de aanvraag?') || '';
  const hours = Number(prompt('Voor hoeveel uur?', '1')) || 1;
  const r = await fetch('/api/jit/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, reason, hours }) });
  const d = await r.json().catch(() => ({}));
  alert(r.ok && d.ok ? 'Verzoek ingediend. Een beheerder moet het goedkeuren.' : (d.error || 'Aanvraag mislukt'));
};
document.getElementById('camInput').onchange = (e) => uploadFiles([...e.target.files]);
document.getElementById('contentSearch').onchange = load;
const dropBtn = document.getElementById('dropLinkBtn'); if (dropBtn) dropBtn.onclick = makeDropLink;
const galBtn = document.getElementById('galleryBtn'); if (galBtn) galBtn.onclick = showGallery;
document.getElementById('adminBtn').onclick = () => window.location='/admin.html';
document.getElementById('themeBtn').onclick = () => { const order=['donker','licht','zakelijk','systeem']; const next=order[(order.indexOf(currentStyleChoice())+1)%order.length]; window.setStyle(next); const ss=document.getElementById('styleSelect'); if (ss) ss.value=next; };
const hcBtn = document.getElementById('hcBtn'); if (hcBtn) hcBtn.onclick = () => { localStorage.setItem('highContrast', localStorage.getItem('highContrast')==='1'?'0':'1'); applyTheme(); };
document.getElementById('langBtn').onclick = () => { lang = LANGS[(LANGS.indexOf(lang)+1)%LANGS.length]; localStorage.setItem('lang',lang); applyI18n(); loadMe(); load(); };

// --- Dashboard: vastgezette mappen + recente bestanden (feature 18) ---
async function loadDashboard() {
  const el = document.getElementById('dashboard'); if (!el || cwd !== '/') { if (el) el.innerHTML = ''; return; }
  try {
    const [pinsR, recR] = await Promise.all([api('/api/pins'), api('/api/recent')]);
    const pins = (await pinsR.json()).pins || [];
    const recent = ((await recR.json()).items || []).slice(0, 8);
    if (!pins.length && !recent.length) { el.innerHTML = ''; return; }
    const pinRows = pins.length ? pins.map(p=>`<a data-go="${enc(p)}">📌 ${esc(p)} <span style="color:var(--muted)" data-unpin="${enc(p)}" title="Losmaken">✕</span></a>`).join('') : '<span class="muted">Zet een map vast met 📌</span>';
    const recRows = recent.length ? recent.map(r=>`<a data-open="${enc(r.path)}">🕘 ${esc(r.path.split('/').pop())}</a>`).join('') : '<span class="muted">Nog geen recente bestanden.</span>';
    el.innerHTML = `<div class="panel"><h3>📌 Vastgezet</h3>${pinRows}</div><div class="panel"><h3>🕘 Recent</h3>${recRows}</div>`;
  } catch { el.innerHTML = ''; }
}
// Pin / unpin
document.addEventListener('click', async (e) => {
  if (e.target.dataset && e.target.dataset.pin) { e.stopPropagation(); await api('/api/pins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(e.target.dataset.pin)})}); loadDashboard(); }
  if (e.target.dataset && e.target.dataset.unpin) { e.stopPropagation(); await api('/api/pins',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(e.target.dataset.unpin)})}); loadDashboard(); }
});

// --- Weergave / laagbandbreedte / kiosk (features 19, 23, 24) ---
function applyUxPrefs() {
  document.body.classList.toggle('view-grid', localStorage.getItem('view') === 'grid');
  document.body.classList.toggle('lowbw', localStorage.getItem('lowbw') === '1');
  document.body.classList.toggle('kiosk', sessionStorage.getItem('kiosk') === '1');
}
const viewBtn = document.getElementById('viewBtn'); if (viewBtn) viewBtn.onclick = () => { localStorage.setItem('view', localStorage.getItem('view')==='grid'?'list':'grid'); applyUxPrefs(); load(); };
const lowbwBtn = document.getElementById('lowbwBtn'); if (lowbwBtn) lowbwBtn.onclick = () => { localStorage.setItem('lowbw', localStorage.getItem('lowbw')==='1'?'0':'1'); applyUxPrefs(); load(); };
const kioskBtn = document.getElementById('kioskBtn'); if (kioskBtn) kioskBtn.onclick = () => {
  if (sessionStorage.getItem('kiosk') === '1') { const pin = prompt('Pincode om kioskmodus te verlaten:'); if (pin !== (sessionStorage.getItem('kioskPin')||'')) return alert('Onjuiste pincode.'); sessionStorage.removeItem('kiosk'); sessionStorage.removeItem('kioskPin'); }
  else { const pin = prompt('Kies een pincode om de kioskmodus later te verlaten (leeg = geen):') || ''; sessionStorage.setItem('kioskPin', pin); sessionStorage.setItem('kiosk', '1'); }
  applyUxPrefs();
};
if (new URLSearchParams(location.search).get('kiosk') === '1') sessionStorage.setItem('kiosk', '1');
applyUxPrefs();

const drop = document.getElementById('drop');
['dragover','dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
drop.addEventListener('drop', e => { e.preventDefault(); uploadFiles([...e.dataTransfer.files]); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

applyTheme(); applyI18n();
// Interne link (/o/<uuid> → /?open=<uuid>): onthouden in sessionStorage, zodat
// hij ook na de omweg via de inlogpagina nog wordt geopend.
const openParam = new URLSearchParams(location.search).get('open');
if (openParam) { try { sessionStorage.setItem('openLink', openParam); } catch { /* nvt */ } history.replaceState(null, '', location.pathname); }
async function openPendingLink() {
  let id = null; try { id = sessionStorage.getItem('openLink'); sessionStorage.removeItem('openLink'); } catch { /* nvt */ }
  if (!id) return false;
  const r = await api('/api/link/' + enc(id));
  if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'Link niet gevonden'); return false; }
  const { path: p, isDir } = await r.json();
  cwd = isDir ? p : (p.slice(0, p.lastIndexOf('/')) || '/');
  await load();
  if (!isDir) openFile(p);
  return true;
}
loadMe().then(async () => { if (!(await openPendingLink().catch(() => false))) load(); connectEvents(); checkKeyRotation(); }).catch(()=>{});

// Herinner aan E2E-sleutels die aan rotatie toe zijn.
async function checkKeyRotation() {
  if (!window.fseCheckRotation) return;
  const due = await window.fseCheckRotation();
  if (due && due.length) {
    console.info('E2E-sleutelrotatie aanbevolen voor: ' + due.map(d=>d.folder).join(', '));
    const q = document.getElementById('quota');
    if (q) q.innerHTML += ` · <span style="color:var(--danger)">🔑 ${due.length} sleutel(s) verlopen</span>`;
  }
}
