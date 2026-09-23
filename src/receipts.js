import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';

// Leesbevestigingen (v3.44): een eigenaar zet ze aan voor een bestand of map.
// Elke keer dat iemand anders het bestand opent/downloadt (gedeelde map, gast,
// deellink of permalink) wordt dat vastgelegd; de eerste keer per lezer krijgt
// de eigenaar een melding. Structuur: { owner: { path: { since, reads: [] } } }.

const MAX_READS = 500;
const file = () => config.receiptsFile;
let notifier = () => {};
export function setReceiptNotifier(fn) { notifier = typeof fn === 'function' ? fn : () => {}; }

const norm = (p) => '/' + String(p || '').split('/').filter(Boolean).join('/');

export function setTracking(owner, p, on) {
  const all = readJson(file(), {}); const n = norm(p);
  all[owner] = all[owner] || {};
  if (on) all[owner][n] = all[owner][n] || { since: Date.now(), reads: [] };
  else delete all[owner][n];
  writeJson(file(), all);
  return !!on;
}

// Bestand zelf of een bovenliggende map met bevestiging aan.
function trackedKey(entries, p) {
  let cur = norm(p);
  for (;;) {
    if (entries[cur]) return cur;
    if (cur === '/') return null;
    cur = cur.slice(0, cur.lastIndexOf('/')) || '/';
  }
}

export function recordRead(owner, p, who, via, extra = {}) {
  if (!owner || !who || who === owner) return false;
  const all = readJson(file(), {}); const entries = all[owner];
  if (!entries) return false;
  const key = trackedKey(entries, p); if (!key) return false;
  const e = entries[key];
  const first = !e.reads.some((r) => r.who === who && r.path === norm(p));
  e.reads.push({ path: norm(p), who: String(who).slice(0, 120), via, ts: Date.now(), ...extra });
  if (e.reads.length > MAX_READS) e.reads = e.reads.slice(-MAX_READS);
  writeJson(file(), all);
  if (first) { try { notifier(owner, norm(p), who, via); } catch { /* nvt */ } }
  return true;
}

export function getReceipts(owner, p) {
  const entries = readJson(file(), {})[owner] || {};
  const n = norm(p);
  const key = trackedKey(entries, n);
  const reads = key ? entries[key].reads.filter((r) => r.path === n || r.path.startsWith(n === '/' ? '/' : n + '/')) : [];
  return { tracked: entries[n] ? 'self' : (key ? 'parent' : null), trackedPath: key, reads: reads.slice(-200).reverse() };
}

export function listTracked(owner) {
  const entries = readJson(file(), {})[owner] || {};
  return Object.entries(entries).map(([p, e]) => ({ path: p, since: e.since, reads: e.reads.length, readers: [...new Set(e.reads.map((r) => r.who))].length }));
}

export function movePath(owner, from, to) {
  const all = readJson(file(), {}); const entries = all[owner]; if (!entries) return;
  const f = norm(from); const t = norm(to); let changed = false;
  for (const k of Object.keys(entries)) {
    if (k === f || k.startsWith(f + '/')) { entries[t + k.slice(f.length)] = entries[k]; delete entries[k]; changed = true; }
  }
  if (changed) writeJson(file(), all);
}
