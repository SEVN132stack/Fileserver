import fs from 'node:fs';
import readline from 'node:readline';
import { createHash } from 'node:crypto';
import { config } from './config.js';
import { verifyChain } from './audit.js';

// Doorzoekbaar audit-log (v3.43). Leest geroteerde + huidige bestanden regel voor
// regel (streaming, dus ook grote logs) en filtert op gebruiker, actie, kanaal,
// periode en vrije tekst. Exports (CSV/JSON) krijgen een SHA-256 van de inhoud
// plus het resultaat van de hash-ketencontrole, zodat een export later
// aantoonbaar ongewijzigd is.

const MAX_RESULTS = 10000;

function logFiles() {
  const files = [];
  for (let i = config.logKeep; i >= 1; i--) { const f = `${config.auditLog}.${i}`; if (fs.existsSync(f)) files.push(f); }
  if (fs.existsSync(config.auditLog)) files.push(config.auditLog);
  return files;
}

export function normalizeFilter(q = {}) {
  const s = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const t = (v) => { const d = Date.parse(s(v, 40)); return Number.isFinite(d) ? d : null; };
  const limit = Math.min(MAX_RESULTS, Math.max(1, parseInt(q.limit, 10) || 500));
  return { user: s(q.user, 100), action: s(q.action, 100), channel: s(q.channel, 20), text: s(q.q).toLowerCase(), from: t(q.from), to: t(q.to), limit };
}

function matches(e, f) {
  if (f.user && e.user !== f.user) return false;
  if (f.action && !String(e.action || '').includes(f.action)) return false;
  if (f.channel && e.channel !== f.channel) return false;
  if (f.from != null || f.to != null) {
    const ts = Date.parse(e.ts);
    if (f.from != null && ts < f.from) return false;
    if (f.to != null && ts > f.to) return false;
  }
  if (f.text && !JSON.stringify(e).toLowerCase().includes(f.text)) return false;
  return true;
}

// Geeft de NIEUWSTE `limit` treffers terug (oud → nieuw), plus het totaal.
export async function searchAudit(query) {
  const f = normalizeFilter(query);
  const out = []; let total = 0;
  for (const file of logFiles()) {
    const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (!matches(e, f)) continue;
      total++; out.push(e);
      if (out.length > f.limit) out.shift();
    }
  }
  return { entries: out, total, truncated: total > out.length, filter: f };
}

const CSV_COLS = ['ts', 'channel', 'user', 'action', 'ip', 'path', 'detail', 'hash'];
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // formule-injectie in spreadsheets voorkomen
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(entries) {
  const rows = [CSV_COLS.join(',')];
  for (const e of entries) {
    const { ts, channel, user, action, ip, path: p, hash, prev: _p, ...rest } = e;
    rows.push([ts, channel, user, action, ip, p, Object.keys(rest).length ? JSON.stringify(rest) : '', hash].map(csvCell).join(','));
  }
  return rows.join('\n') + '\n';
}

// Bouw een export met integriteitsgegevens.
export async function exportAudit(query, format = 'json', by = null) {
  const r = await searchAudit(query);
  const chain = verifyChain();
  const meta = { exportedAt: new Date().toISOString(), exportedBy: by, filter: r.filter, count: r.entries.length, total: r.total, truncated: r.truncated, chain };
  let body;
  if (format === 'csv') body = toCsv(r.entries);
  else body = JSON.stringify({ meta, entries: r.entries }, null, 2) + '\n';
  const sha256 = createHash('sha256').update(body).digest('hex');
  return { body, sha256, meta, contentType: format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json' };
}
