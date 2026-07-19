'use strict';
const enc = encodeURIComponent;
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

async function api(url, opts) { const r = await fetch(url, opts); if (r.status === 401) { window.location = '/login.html'; throw new Error('unauth'); } return r; }

async function loadMe() {
  const r = await api('/api/whoami');
  me = await r.json();
  document.getElementById('who').textContent = (lang==='nl'?'Ingelogd als ':'Signed in as ') + me.user + ' (' + me.role + ')';
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
  const url = `/api/list?path=${enc(cwd)}&sort=${sort}&order=${order}` + (q?`&q=${enc(q)}`:'');
  const data = await (await api(url)).json();
  renderCrumbs();
  const rows = document.getElementById('rows');
  rows.innerHTML = '';
  if (!data.items.length) rows.innerHTML = `<tr><td colspan="4" class="muted">${t('empty')}</td></tr>`;
  for (const it of data.items) {
    const tr = document.createElement('tr');
    const icon = it.isDir ? '📂' : (isImg(it.name) ? `<img class="thumb" src="/api/preview?path=${enc(it.path)}">` : '📄');
    const nameCell = it.isDir
      ? `<div class="name" data-dir="${enc(it.path)}">${icon} ${it.name}</div>`
      : `<div class="name" data-open="${enc(it.path)}">${icon} ${it.name}</div>`;
    let a = '';
    if (it.isDir) a += `<button data-zip="${enc(it.path)}">ZIP</button>`;
    else a += `<button data-dl="${enc(it.path)}">⬇</button>`;
    if (!it.isDir && isText(it.name)) a += `<button class="ghost" data-edit="${enc(it.path)}">✎</button>`;
    a += `<button class="ghost" data-share="${enc(it.path)}">🔗</button>`;
    a += `<button class="ghost" data-ren="${enc(it.path)}">✏</button>`;
    a += `<button class="danger" data-del="${enc(it.path)}">🗑</button>`;
    const checked = selected.has(it.path) ? 'checked' : '';
    tr.innerHTML = `<td><input type="checkbox" data-sel="${enc(it.path)}" ${checked}></td><td>${nameCell}</td><td>${fmtSize(it.size)}</td><td class="actions">${a}</td>`;
    rows.appendChild(tr);
  }
}
function renderCrumbs() {
  const parts = cwd.split('/').filter(Boolean); let acc='';
  const links = ['<a data-go="/">home</a>'];
  for (const p of parts) { acc += '/'+p; links.push(`<a data-go="${enc(acc)}">${p}</a>`); }
  document.getElementById('crumbs').innerHTML = links.join(' / ');
}

// --- Preview / editor ---
function openModal(html) { document.getElementById('modalBody').innerHTML = html; document.getElementById('modal').style.display='flex'; }
function closeModal() { document.getElementById('modal').style.display='none'; document.getElementById('modalBody').innerHTML=''; }
async function openFile(p) {
  const name = p.split('/').pop(); const url = '/api/preview?path='+enc(p);
  if (isImg(name)) openModal(`<h3>${name}</h3><img src="${url}">`);
  else if (/\.pdf$/i.test(name)) openModal(`<h3>${name}</h3><iframe src="${url}" style="width:82vw;height:74vh"></iframe>`);
  else if (isText(name)) { const txt = await (await api(url)).text(); openModal(`<h3>${name}</h3><pre>${txt.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>`); }
  else openModal(`<h3>${name}</h3><p class="muted">Geen preview.</p><button data-dl="${enc(p)}">Download</button>`);
}
async function editFile(p) {
  const name = p.split('/').pop();
  const txt = await (await api('/api/preview?path='+enc(p))).text();
  openModal(`<h3>✎ ${name}</h3><textarea id="editArea"></textarea><br><button id="saveEdit" data-path="${enc(p)}">Opslaan</button>`);
  document.getElementById('editArea').value = txt;
  document.getElementById('saveEdit').onclick = async (e) => {
    await api('/api/save?path='+e.target.dataset.path, { method:'POST', headers:{'Content-Type':'text/plain'}, body: document.getElementById('editArea').value });
    closeModal(); load();
  };
}

// --- Uploads ---
const CHUNK = 4 * 1024 * 1024; // 4MB
const BIG = 8 * 1024 * 1024;   // vanaf deze grootte: hervatbaar/chunked

function uploadFiles(files, relPaths) {
  if (!files.length) return;
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
    const items = await (await api(`/api/shared/list?owner=${enc(s.owner)}&path=${enc(s.path)}`)).json().catch(()=>({items:[]}));
    html += `<h3>${s.owner}: ${s.path}</h3><ul>` + (items.items||[]).map(i =>
      `<li>${i.isDir?'📂':'📄'} ${i.name} ${i.isDir?'':`<a href="/api/shared/download?owner=${enc(s.owner)}&path=${enc(i.path)}">⬇</a>`}</li>`).join('') + '</ul>';
  }
  v.innerHTML = html;
}
async function renderTrash() {
  const v = document.getElementById('trashView');
  const data = await (await api('/api/trash')).json();
  if (!data.items.length) { v.innerHTML = '<p class="muted">Prullenbak is leeg.</p>'; return; }
  v.innerHTML = `<button class="danger" id="emptyTrash">Prullenbak legen</button><ul>` +
    data.items.map(i => `<li>${i.isDir?'📂':'📄'} ${i.name.replace(/^\d+_/,'')} <button class="ghost" data-restore="${enc(i.path)}">Herstel</button></li>`).join('') + '</ul>';
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
    const r = await (await api('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,expiresInHours:hrs?Number(hrs):0,password:pw})})).json();
    prompt('Deel deze link:', location.origin + r.url); return;
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
document.getElementById('fileInput').onchange = e => uploadFiles([...e.target.files]);
document.getElementById('dirInput').onchange = e => { const files=[...e.target.files]; uploadFiles(files, files.map(f=>f.webkitRelativePath||f.name)); };
document.getElementById('logoutBtn').onclick = async () => { await fetch('/api/logout',{method:'POST'}); window.location='/login.html'; };
document.getElementById('2faBtn').onclick = setup2fa;
document.getElementById('adminBtn').onclick = () => window.location='/admin.html';
document.getElementById('themeBtn').onclick = () => { const cur=localStorage.getItem('theme')||'dark'; localStorage.setItem('theme',cur==='dark'?'light':'dark'); applyTheme(); };
document.getElementById('langBtn').onclick = () => { lang = LANGS[(LANGS.indexOf(lang)+1)%LANGS.length]; localStorage.setItem('lang',lang); applyI18n(); loadMe(); load(); };

const drop = document.getElementById('drop');
['dragover','dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
drop.addEventListener('drop', e => { e.preventDefault(); uploadFiles([...e.dataTransfer.files]); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

applyTheme(); applyI18n();
loadMe().then(() => { load(); connectEvents(); }).catch(()=>{});
