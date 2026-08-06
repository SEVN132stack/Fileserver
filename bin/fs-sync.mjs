#!/usr/bin/env node
// Desktop-sync-client voor de fileserver: synchroniseert een lokale map twee
// richtingen op met een map op de server (via de web-API). Nieuwere versie wint;
// conflicten worden gemeld. Draai eenmalig of met --watch voor continue sync.
//
// Gebruik:
//   FS_URL=https://transfer.zepta-nas.nl \
//   FS_KEY=fsk_xxx \            # API-sleutel (scope 'write') — aanbevolen
//   FS_LOCAL=./sync \           # lokale map
//   FS_REMOTE=/ \               # externe map (home-relatief)
//   node bin/fs-sync.mjs [--watch] [--interval 30] [--dry-run]
//
// Alternatief voor FS_KEY: FS_USER + FS_PASS (Basic Auth).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const URL_ = (process.env.FS_URL || '').replace(/\/$/, '');
const LOCAL = path.resolve(process.env.FS_LOCAL || './sync');
const REMOTE = (process.env.FS_REMOTE || '/').replace(/\/$/, '') || '';
const KEY = process.env.FS_KEY || '';
const USER = process.env.FS_USER || '';
const PASS = process.env.FS_PASS || '';
const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const DRY = args.includes('--dry-run');
const INTERVAL = (parseInt(args[args.indexOf('--interval') + 1], 10) || 30) * 1000;
const STATE = path.join(LOCAL, '.fs-sync-state.json');

if (!URL_ || (!KEY && !(USER && PASS))) {
  console.error('Zet FS_URL en FS_KEY (of FS_USER + FS_PASS). Zie de kop van dit bestand.');
  process.exit(2);
}
const authHeaders = KEY ? { Authorization: 'Bearer ' + KEY }
  : { Authorization: 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64') };

const api = (p, opts = {}) => fetch(URL_ + p, { ...opts, headers: { ...authHeaders, ...(opts.headers || {}) } });
const rpath = (rel) => (REMOTE + '/' + rel).replace(/\/+/g, '/');

function localFiles(dir, base = '') {
  const out = {};
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === '.fs-sync-state.json') continue;
    const full = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) Object.assign(out, localFiles(full, rel));
    else { const st = fs.statSync(full); out[rel] = { size: st.size, mtime: st.mtimeMs }; }
  }
  return out;
}
// Blijft dit relatieve pad binnen de lokale sync-map? (tegen path-traversal)
function withinLocal(rel) {
  const full = path.resolve(LOCAL, rel);
  return full === LOCAL || full.startsWith(LOCAL + path.sep);
}
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } };
const saveState = (s) => { try { fs.writeFileSync(STATE, JSON.stringify(s)); } catch {} };

async function syncOnce() {
  fs.mkdirSync(LOCAL, { recursive: true });
  const local = localFiles(LOCAL);
  const remoteResp = await api('/api/changes?since=0');
  if (!remoteResp.ok) { console.error('Server onbereikbaar:', remoteResp.status); return; }
  const remote = {};
  for (const f of (await remoteResp.json()).files) {
    const rel = f.path.replace(/^\//, '');
    if (REMOTE && !rel.startsWith(REMOTE.replace(/^\//, '') + '/')) continue;
    const local_rel = REMOTE ? rel.slice(REMOTE.replace(/^\//, '').length + 1) : rel;
    // Bescherm tegen een kwaadaardige/gecompromitteerde server die een pad met
    // '..' teruggeeft om buiten de sync-map te schrijven (path-traversal).
    if (!withinLocal(local_rel)) { console.error('Onveilig pad van server genegeerd:', f.path); continue; }
    remote[local_rel] = f;
  }
  const state = loadState();
  const all = new Set([...Object.keys(local), ...Object.keys(remote)]);
  let up = 0, down = 0, conflict = 0;

  for (const rel of all) {
    const l = local[rel], r = remote[rel];
    if (l && !r) {
      // Lokaal nieuw of extern verwijderd? Als het in state stond -> extern verwijderd -> lokaal weg.
      if (state[rel]) { if (!DRY) fs.rmSync(path.join(LOCAL, rel), { force: true }); }
      else { if (!DRY) await upload(rel); up++; }
    } else if (!l && r) {
      if (state[rel]) { /* lokaal verwijderd -> ook op server verwijderen zou kunnen; hier: opnieuw downloaden */ }
      if (!DRY) await download(rel, r); down++;
    } else if (l && r) {
      if (Math.abs(l.mtime - r.mtime) < 2000 && l.size === r.size) continue; // gelijk
      if (l.mtime > r.mtime) { if (!DRY) await upload(rel); up++; }
      else if (r.mtime > l.mtime) { if (!DRY) await download(rel, r); down++; }
      else conflict++;
    }
    state[rel] = local[rel] || remote[rel];
  }
  if (!DRY) saveState(localFiles(LOCAL));
  console.log(`Sync klaar: ↑${up} ↓${down}${conflict ? ` ⚠${conflict} conflict(en)` : ''}${DRY ? ' (dry-run)' : ''}`);
}

async function upload(rel) {
  const full = path.join(LOCAL, rel);
  const buf = fs.readFileSync(full);
  const form = new FormData();
  form.append('files', new Blob([buf]), path.basename(rel));
  const dir = rpath(path.dirname(rel) === '.' ? '' : path.dirname(rel));
  await api('/api/upload?path=' + encodeURIComponent(dir || '/'), { method: 'POST', body: form });
}
async function download(rel, meta) {
  const full = path.join(LOCAL, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const resp = await api('/api/download?path=' + encodeURIComponent(rpath(rel)));
  if (!resp.ok) return;
  fs.writeFileSync(full, Buffer.from(await resp.arrayBuffer()));
  if (meta && meta.mtime) fs.utimesSync(full, new Date(), new Date(meta.mtime));
}

async function main() {
  await syncOnce();
  if (WATCH) {
    console.log(`Watch-modus: elke ${INTERVAL / 1000}s...`);
    setInterval(() => syncOnce().catch((e) => console.error(e.message)), INTERVAL);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
