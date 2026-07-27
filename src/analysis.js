import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from './config.js';

// Opslaganalyse: duplicaten vinden (zelfde SHA-256) en opschoon-suggesties
// (grote, oude en nooit-gedownloade bestanden).

function walk(dir, base, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === config.trashName || e.name === config.versionsName || e.name === '.metadata.json') continue;
    const full = path.join(dir, e.name);
    const rel = base + '/' + e.name;
    if (e.isDirectory()) walk(full, rel, out);
    else { try { const st = fs.statSync(full); out.push({ full, rel, size: st.size, mtime: st.mtimeMs }); } catch { /* skip */ } }
  }
}

// Hash in blokken van 1 MB i.p.v. het hele bestand in het geheugen te lezen,
// zodat grote bestanden geen geheugenpiek/OOM veroorzaken.
function sha256(file) {
  const h = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(1024 * 1024);
    let bytes;
    while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, bytes));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex');
}

// Groepeer identieke bestanden (zelfde grootte én hash) binnen een home.
export function findDuplicates(home) {
  const files = [];
  walk(home, '', files);
  const bySize = new Map();
  for (const f of files) { const a = bySize.get(f.size) || []; a.push(f); bySize.set(f.size, a); }
  const groups = [];
  let wasted = 0;
  for (const [size, arr] of bySize) {
    if (size === 0 || arr.length < 2) continue;
    const byHash = new Map();
    for (const f of arr) {
      let h; try { h = sha256(f.full); } catch { continue; }
      const g = byHash.get(h) || []; g.push(f.rel); byHash.set(h, g);
    }
    for (const [, paths] of byHash) {
      if (paths.length > 1) { groups.push({ size, paths }); wasted += size * (paths.length - 1); }
    }
  }
  return { groups: groups.sort((a, b) => b.size - a.size).slice(0, 200), wasted };
}

// Opschoon-suggesties. `downloaded` = Set van paden die ooit gedownload zijn
// (uit het audit-log), zodat "nooit gedownload" bepaald kan worden.
export function cleanupSuggestions(home, downloaded = new Set(), { largeBytes = 104857600, oldDays = 365 } = {}) {
  const files = [];
  walk(home, '', files);
  const now = Date.now();
  const large = files.filter((f) => f.size >= largeBytes).sort((a, b) => b.size - a.size).slice(0, 50)
    .map((f) => ({ path: f.rel, size: f.size }));
  const old = files.filter((f) => now - f.mtime > oldDays * 86400000).sort((a, b) => a.mtime - b.mtime).slice(0, 50)
    .map((f) => ({ path: f.rel, mtime: f.mtime }));
  const neverDownloaded = files.filter((f) => f.size >= 10485760 && !downloaded.has(f.rel)).slice(0, 50)
    .map((f) => ({ path: f.rel, size: f.size }));
  return { large, old, neverDownloaded, totalFiles: files.length };
}
