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
};
const LANGS = ['nl', 'en', 'de', 'fr'];
let lang = localStorage.getItem('lang') || 'nl';
function t(k) { return (I18N[lang] && I18N[lang][k]) || k; }
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-ph]').forEach(el => el.placeholder = t(el.dataset.i18nPh));
  document.getElementById('langBtn').textContent = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length].toUpperCase();
}

// --- Thema ---
function applyTheme() {
  const th = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', th);
}

const fmtSize = (n) => { if (!n) return ''; const u=['B','KB','MB','GB','TB']; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return n.toFixed(i?1:0)+' '+u[i]; };
const isImg = (name) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name);
const isText = (name) => /\.(txt|md|json|js|mjs|css|html?|csv|log|xml|ya?ml|ini|sh|conf)$/i.test(name);
const isVideo = (name) => /\.(mp4|webm|ogv|mov|m4v)$/i.test(name);
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
    if (me.branding.accent) document.documentElement.style.setProperty('--accent', me.branding.accent);
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
    es.onerror = () => {};
  } catch {}
}

// --- Bestandenweergave ---
async function load() {
  const q = document.getElementById('search').value.trim();
  const sort = document.getElementById('sort').value, order = document.getElementById('order').value;
  const inhoud = document.getElementById('contentSearch')?.checked ? '&content=1' : '';
  const url = `/api/list?path=${enc(cwd)}&sort=${sort}&order=${order}` + (q?`&q=${enc(q)}${inhoud}`:'');
  const data = await (await api(url)).json();
  renderCrumbs();
  const rows = document.getElementById('rows');
  rows.innerHTML = '';
  if (!data.items.length) rows.innerHTML = `<tr><td colspan="4" class="muted">${t('empty')}</td></tr>`;
  for (const it of data.items) {
    const tr = document.createElement('tr');
    const icon = it.isDir ? '📂' : (isImg(it.name) ? `<img class="thumb" loading="lazy" src="/api/thumb?path=${enc(it.path)}&w=56">` : '📄');
    const nameCell = it.isDir
      ? `<div class="name" data-dir="${enc(it.path)}">${icon} ${esc(it.name)}</div>`
      : `<div class="name" data-open="${enc(it.path)}">${icon} ${esc(it.name)}</div>`;
    let a = '';
    if (it.isDir) a += `<button data-zip="${enc(it.path)}">ZIP</button>`;
    else a += `<button data-dl="${enc(it.path)}">⬇</button>`;
    if (!it.isDir && isText(it.name)) a += `<button class="ghost" data-edit="${enc(it.path)}">✎</button>`;
    if (!it.isDir && /\.enc$/i.test(it.name)) a += `<button class="ghost" data-dec="${enc(it.path)}">🔓</button>`;
    if (!it.isDir) a += `<button class="ghost" data-sync="${enc(it.path)}" title="Efficiënt bijwerken (delta-sync)">⟳</button>`;
    if (!it.isDir) a += `<button class="ghost" data-ver="${enc(it.path)}">🕘</button>`;
    if (!it.isDir) a += `<button class="ghost" data-lock="${enc(it.path)}" title="Vergrendelen/ontgrendelen">🔒</button>`;
    a += `<button class="ghost" data-meta="${enc(it.path)}">🏷</button>`;
    a += `<button class="ghost" data-perma="${enc(it.path)}" title="Vaste link (permalink)">∞</button>`;
    a += `<button class="ghost" data-share="${enc(it.path)}">🔗</button>`;
    a += `<button class="ghost" data-grant="${enc(it.path)}">👥</button>`;
    a += `<button class="ghost" data-ren="${enc(it.path)}">✏</button>`;
    a += `<button class="danger" data-del="${enc(it.path)}">🗑</button>`;
    const checked = selected.has(it.path) ? 'checked' : '';
    tr.innerHTML = `<td><input type="checkbox" data-sel="${enc(it.path)}" ${checked}></td><td>${nameCell}</td><td>${fmtSize(it.size)}</td><td class="actions">${a}</td>`;
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
  else if (isVideo(name)) openModal(`<h3>${esc(name)}</h3><video src="${url}" controls autoplay style="max-width:82vw;max-height:74vh"></video>`);
  else if (isAudio(name)) openModal(`<h3>${esc(name)}</h3><audio src="${url}" controls autoplay style="width:70vw"></audio>`);
  else if (/\.pdf$/i.test(name)) openModal(`<h3>${esc(name)}</h3><iframe src="${url}" style="width:82vw;height:74vh"></iframe>`);
  else if (isMd(name)) { const txt = await (await api(url)).text(); openModal(`<h3>${esc(name)}</h3><div style="max-width:80vw;max-height:74vh;overflow:auto;line-height:1.5">${renderMarkdown(txt)}</div>`); }
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
async function editFile(p) {
  const name = p.split('/').pop();
  const txt = await (await api('/api/preview?path='+enc(p))).text();
  openModal(`<h3>✎ ${esc(name)}</h3><textarea id="editArea"></textarea><br><button id="saveEdit" data-path="${enc(p)}">Opslaan</button>`);
  document.getElementById('editArea').value = txt;
  document.getElementById('saveEdit').onclick = async (e) => {
    await api('/api/save?path='+e.target.dataset.path, { method:'POST', headers:{'Content-Type':'text/plain'}, body: document.getElementById('editArea').value });
    closeModal(); load();
  };
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
  const r = await (await api('/api/droplink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:cwd,expiresInHours:hrs?Number(hrs):0,password:pw})})).json();
  showLink('Drop-link (anderen kunnen hier uploaden)', location.origin + r.url);
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
      <button class="ghost" data-verrestore="${enc(p)}|${enc(v.version)}">herstel</button></li>`).join('') : '<li class="muted">Geen eerdere versies.</li>';
  openModal(`<h3>🕘 Versies van ${esc(p.split('/').pop())}</h3><ul>${rows}</ul>`);
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
  const bar = document.getElementById('progress'), fill = bar.firstElementChild;
  bar.style.display='block'; fill.style.width='0';
  const small = [], smallRel = [];
  const big = [];
  files.forEach((f, i) => { const rp = (relPaths && relPaths[i]) || f.name;
    if (f.size >= BIG) big.push({ f, rp }); else { small.push(f); smallRel.push(rp); } });

  const doSmall = () => new Promise((resolve) => {
    if (!small.length) return resolve();
    const fd = new FormData();
    small.forEach((f, i) => fd.append('files', f, smallRel[i]));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload?path='+enc(cwd));
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) fill.style.width = (ev.loaded/ev.total*100)+'%'; };
    xhr.onload = () => { if (xhr.status===401) window.location='/login.html'; else if (xhr.status!==200 && xhr.status!==422) alert('Upload mislukt'); resolve(); };
    xhr.onerror = () => { alert('Upload mislukt'); resolve(); };
    xhr.send(fd);
  });

  const doBig = async ({ f, rp }) => {
    const uploadId = (rp + '-' + f.size + '-' + f.lastModified).replace(/[^a-zA-Z0-9_-]/g, '');
    const total = Math.ceil(f.size / CHUNK);
    let received = [];
    try { received = (await (await api('/api/upload/status?uploadId='+enc(uploadId))).json()).received || []; } catch {}
    for (let i = 0; i < total; i++) {
      if (received.includes(i)) { fill.style.width = ((i+1)/total*100)+'%'; continue; }
      const blob = f.slice(i*CHUNK, (i+1)*CHUNK);
      const cfd = new FormData(); cfd.append('chunk', blob);
      const url = `/api/upload/chunk?uploadId=${enc(uploadId)}&index=${i}&total=${total}&name=${enc(rp)}&path=${enc(cwd)}`;
      await api(url, { method:'POST', body: cfd });
      fill.style.width = ((i+1)/total*100)+'%';
    }
  };

  (async () => {
    await doSmall();
    for (const b of big) await doBig(b);
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
async function renderShared() {
  const v = document.getElementById('sharedView');
  if (!me.shared || !me.shared.length) { v.innerHTML = '<p class="muted">Niets met je gedeeld.</p>'; return; }
  let html = '';
  for (const s of me.shared) {
    const data = await (await api(`/api/shared/list?owner=${enc(s.owner)}&path=${enc(s.path)}`)).json().catch(()=>({items:[]}));
    const rw = (data.mode || s.mode) === 'rw';
    html += `<h3>${esc(s.owner)}: ${esc(s.path)} <span class="muted">(${rw?'lezen+schrijven':'alleen-lezen'})</span></h3>`;
    if (rw) html += `<div><input type="file" multiple data-shup="${enc(s.owner)}|${enc(s.path)}"></div>`;
    html += '<ul>' + (data.items||[]).map(i =>
      `<li>${i.isDir?'📂':'📄'} ${esc(i.name)} ${i.isDir?'':`<a href="/api/shared/download?owner=${enc(s.owner)}&path=${enc(i.path)}">⬇</a>`}`
      + (rw?` <button class="danger" data-shdel="${enc(s.owner)}|${enc(i.path)}">🗑</button>`:'') + `</li>`).join('') + '</ul>';
  }
  v.innerHTML = html;
  v.querySelectorAll('[data-shup]').forEach(inp => inp.onchange = async () => {
    const [owner, base] = inp.dataset.shup.split('|').map(decodeURIComponent);
    const fd = new FormData(); [...inp.files].forEach(f => fd.append('files', f));
    await api(`/api/shared/upload?owner=${enc(owner)}&path=${enc(base)}`, { method:'POST', body: fd });
    renderShared();
  });
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
  openModal(`<h3>2FA instellen</h3><p class="muted">Voeg dit geheim toe aan je authenticator-app:</p>
    <p><code>${r.secret}</code></p><p class="muted" style="word-break:break-all">${r.otpauth}</p>
    <label>Voer een code in om te bevestigen:</label><input id="totpIn"><br>
    <button id="enable2fa">Inschakelen</button> <button class="danger" id="disable2fa">Uitschakelen</button>`);
  document.getElementById('enable2fa').onclick = async () => {
    const res = await api('/api/2fa/enable',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:r.secret,token:document.getElementById('totpIn').value})});
    alert(res.ok ? '2FA ingeschakeld' : '2FA-code onjuist'); if (res.ok) closeModal();
  };
  document.getElementById('disable2fa').onclick = async () => { await api('/api/2fa/disable',{method:'POST'}); alert('2FA uitgeschakeld'); closeModal(); };
}

// --- Events ---
document.addEventListener('click', async (e) => {
  const t2 = e.target;
  const dir = t2.closest('[data-dir]'), open = t2.closest('[data-open]');
  if (t2.dataset.tab) return showTab(t2.dataset.tab);
  if (dir) { cwd = decodeURIComponent(dir.dataset.dir); selected.clear(); document.getElementById('search').value=''; return load(); }
  if (t2.dataset.go) { cwd = decodeURIComponent(t2.dataset.go); selected.clear(); document.getElementById('search').value=''; return load(); }
  if (open) return openFile(decodeURIComponent(open.dataset.open));
  if (t2.dataset.dl) return void (window.location = '/api/download?path='+t2.dataset.dl);
  if (t2.dataset.zip) return void (window.location = '/api/zip?path='+t2.dataset.zip);
  if (t2.dataset.edit) return editFile(decodeURIComponent(t2.dataset.edit));
  if (t2.dataset.restore) { await api('/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(t2.dataset.restore)})}); renderTrash(); load(); loadMe(); return; }
  if (t2.dataset.share) {
    const p = decodeURIComponent(t2.dataset.share);
    const hrs = prompt('Vervalt na hoeveel uur? (leeg = nooit)', '24');
    if (hrs === null) return;
    const pw = prompt('Wachtwoord voor de link? (leeg = geen)', '') || null;
    const max = prompt('Maximaal aantal downloads? (leeg = onbeperkt)', '') || 0;
    const r = await (await api('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,expiresInHours:hrs?Number(hrs):0,password:pw,maxDownloads:Number(max)||0})})).json();
    showLink('Deel-link (download)', location.origin + r.url); return;
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
    load(); return;
  }
  if (t2.dataset.grant) {
    const p = decodeURIComponent(t2.dataset.grant);
    const to = prompt('Delen met welke gebruiker?'); if (!to) return;
    const rw = confirm('Schrijfrechten geven? (OK = lezen+schrijven, Annuleer = alleen-lezen)');
    await api('/api/grant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,path:p,mode:rw?'rw':'ro'})});
    alert('Gedeeld met '+to+' ('+(rw?'rw':'ro')+')'); return;
  }
  if (t2.dataset.revoke) { await api('/api/sessions/'+t2.dataset.revoke,{method:'DELETE'}); showSessions(); return; }
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
  if (t2.dataset.ren) {
    const cur = decodeURIComponent(t2.dataset.ren), base = cur.substring(0,cur.lastIndexOf('/')+1);
    const nn = prompt('Nieuwe naam of pad:', cur.split('/').pop()); if (!nn) return;
    await api('/api/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:cur,to:nn.startsWith('/')?nn:base+nn})}); load(); return;
  }
  if (t2.dataset.del) { if(!confirm('Naar prullenbak?'))return; await api('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:decodeURIComponent(t2.dataset.del)})}); load(); loadMe(); return; }
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
document.getElementById('camInput').onchange = (e) => uploadFiles([...e.target.files]);
document.getElementById('contentSearch').onchange = load;
const dropBtn = document.getElementById('dropLinkBtn'); if (dropBtn) dropBtn.onclick = makeDropLink;
const galBtn = document.getElementById('galleryBtn'); if (galBtn) galBtn.onclick = showGallery;
document.getElementById('adminBtn').onclick = () => window.location='/admin.html';
document.getElementById('themeBtn').onclick = () => { const cur=localStorage.getItem('theme')||'dark'; localStorage.setItem('theme',cur==='dark'?'light':'dark'); applyTheme(); };
document.getElementById('langBtn').onclick = () => { lang = LANGS[(LANGS.indexOf(lang)+1)%LANGS.length]; localStorage.setItem('lang',lang); applyI18n(); loadMe(); load(); };

const drop = document.getElementById('drop');
['dragover','dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
drop.addEventListener('drop', e => { e.preventDefault(); uploadFiles([...e.dataTransfer.files]); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

applyTheme(); applyI18n();
loadMe().then(() => { load(); connectEvents(); checkKeyRotation(); }).catch(()=>{});

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
