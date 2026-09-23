import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { walkFiles, sha256File, findDuplicates } from './analysis.js';
import { resolveWithin, dirSize } from './paths.js';
import { officePreview, canPreviewOffice } from './office.js';
import { getOcrText } from './ocr.js';

// Data-intelligentie: duplicaten-assistent, opruimadvies en full-text zoeken met
// contextfragmenten. Alles werkt binnen de home van één gebruiker en is begrensd
// in aantal bestanden en bestandsgrootte, zodat het geen geheugen/CPU-DoS kan worden.

// --- Duplicaten-assistent -----------------------------------------------------

const STRATEGIES = ['oldest', 'newest', 'shortest', 'prefer'];

// Stel per duplicaatgroep voor welk exemplaar blijft en welke weg kunnen.
// strategy: oldest | newest | shortest (pad) | prefer (voorkeursmap `prefer`).
export function planDedupe(home, { strategy = 'oldest', prefer = '' } = {}) {
  if (!STRATEGIES.includes(strategy)) throw new Error('Onbekende strategie');
  const { groups } = findDuplicates(home);
  const plan = [];
  let reclaim = 0;
  for (const g of groups) {
    const members = g.paths.map((p) => {
      let mtime = 0; try { mtime = fs.statSync(resolveWithin(home, p)).mtimeMs; } catch { /* weg */ }
      return { path: p, mtime };
    });
    const pref = String(prefer || '').replace(/\/+$/, '');
    members.sort((a, b) => {
      if (strategy === 'newest') return b.mtime - a.mtime;
      if (strategy === 'shortest') return a.path.length - b.path.length || a.path.localeCompare(b.path);
      if (strategy === 'prefer' && pref) {
        const ia = a.path.startsWith(pref + '/') ? 0 : 1; const ib = b.path.startsWith(pref + '/') ? 0 : 1;
        if (ia !== ib) return ia - ib;
      }
      return a.mtime - b.mtime; // oldest (en tie-breaker)
    });
    const [keep, ...rest] = members;
    plan.push({ size: g.size, keep: keep.path, remove: rest.map((m) => m.path) });
    reclaim += g.size * rest.length;
  }
  return { strategy, plan, reclaim };
}

// Voer (een deel van) een plan uit. Vlak vóór het verwijderen wordt opnieuw
// gecontroleerd dat elk te verwijderen bestand nog byte-identiek is aan het te
// bewaren exemplaar. Verwijderen = naar de prullenbak (herstelbaar).
// `hooks.isProtected(rel)` -> true bij lock/bewaarplicht; `hooks.trash(rel)`.
export function applyDedupe(home, items, hooks = {}) {
  let removed = 0, reclaimed = 0; const skipped = [];
  for (const it of (Array.isArray(items) ? items : []).slice(0, 500)) {
    let keepAbs;
    try { keepAbs = resolveWithin(home, it.keep); } catch { continue; }
    if (!fs.existsSync(keepAbs)) { skipped.push(...(it.remove || [])); continue; }
    let keepHash = null;
    for (const rel of (it.remove || []).slice(0, 200)) {
      if (rel === it.keep) { skipped.push(rel); continue; }
      let abs; try { abs = resolveWithin(home, rel); } catch { skipped.push(rel); continue; }
      try {
        if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { skipped.push(rel); continue; }
        if (hooks.isProtected && hooks.isProtected(rel)) { skipped.push(rel); continue; }
        const size = fs.statSync(abs).size;
        if (size !== fs.statSync(keepAbs).size) { skipped.push(rel); continue; }
        if (keepHash === null) keepHash = sha256File(keepAbs);
        if (sha256File(abs) !== keepHash) { skipped.push(rel); continue; } // intussen gewijzigd
        hooks.trash(rel);
        removed++; reclaimed += size;
      } catch { skipped.push(rel); }
    }
  }
  return { removed, reclaimed, skipped };
}

// --- Opruimadvies -------------------------------------------------------------

export function cleanupAdvice(home, downloaded = new Set(), { largeBytes = 100 * 1048576, oldDays = 365, neverDlMinBytes = 10 * 1048576 } = {}) {
  const files = walkFiles(home);
  const now = Date.now();
  const sum = (arr) => arr.reduce((n, f) => n + f.size, 0);
  const large = files.filter((f) => f.size >= largeBytes).sort((a, b) => b.size - a.size);
  const old = files.filter((f) => now - f.mtime > oldDays * 86400000).sort((a, b) => a.mtime - b.mtime);
  const never = files.filter((f) => f.size >= neverDlMinBytes && !downloaded.has(f.rel)).sort((a, b) => b.size - a.size);
  const dups = findDuplicates(home);
  let trash = 0, versions = 0;
  try { trash = dirSize(path.join(home, config.trashName)); } catch { /* geen */ }
  try { versions = dirSize(path.join(home, config.versionsName)); } catch { /* geen */ }
  const map = (arr) => arr.slice(0, 100).map((f) => ({ path: f.rel, size: f.size, mtime: f.mtime }));
  const categories = [
    { id: 'large', label: `Grote bestanden (≥ ${Math.round(largeBytes / 1048576)} MB)`, reclaim: sum(large), count: large.length, items: map(large) },
    { id: 'old', label: `Niet gewijzigd in ${oldDays} dagen`, reclaim: sum(old), count: old.length, items: map(old) },
    { id: 'never', label: 'Nooit gedownload (≥ 10 MB)', reclaim: sum(never), count: never.length, items: map(never) },
    { id: 'duplicates', label: 'Dubbele bestanden (overbodige kopieën)', reclaim: dups.wasted, count: dups.groups.length, items: [] },
    { id: 'trash', label: 'Prullenbak', reclaim: trash, count: trash ? 1 : 0, items: [] },
    { id: 'versions', label: 'Oude versies', reclaim: versions, count: versions ? 1 : 0, items: [] },
  ];
  const total = sum(files);
  return { totalBytes: total, totalFiles: files.length, categories: categories.sort((a, b) => b.reclaim - a.reclaim) };
}

// --- Full-text zoeken met fragmenten -----------------------------------------

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|mjs|ts|py|java|c|h|cpp|go|rs|rb|php|sh|ya?ml|ini|conf|log|sql|tex|rtf)$/i;
const MAX_FILE = 5 * 1048576;
const MAX_SCAN = 3000;

function fileText(home, rel, abs, name) {
  if (TEXT_EXT.test(name)) {
    const st = fs.statSync(abs);
    if (st.size > MAX_FILE) return '';
    return fs.readFileSync(abs, 'utf8');
  }
  if (canPreviewOffice(name)) {
    if (fs.statSync(abs).size > 20 * 1048576) return '';
    try { return (officePreview(abs) || {}).text || ''; } catch { return ''; }
  }
  return getOcrText(home, rel) || '';
}

function makeSnippet(text, idx, qlen) {
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + qlen + 60);
  const raw = text.slice(start, end).replace(/\s+/g, ' ');
  return { text: (start > 0 ? '…' : '') + raw + (end < text.length ? '…' : ''), offset: (start > 0 ? 1 : 0) + text.slice(start, idx).replace(/\s+/g, ' ').length };
}

export function searchSnippets(home, q, { limit = 50 } = {}) {
  const query = String(q || '').trim();
  if (query.length < 2) return { results: [], scanned: 0 };
  const needle = query.toLowerCase();
  const files = walkFiles(home).slice(0, MAX_SCAN);
  const results = [];
  let scanned = 0;
  for (const f of files) {
    if (results.length >= limit) break;
    const name = path.basename(f.rel);
    let text = '';
    try { text = fileText(home, f.rel, f.full, name); } catch { continue; }
    if (!text) continue;
    scanned++;
    const lower = text.toLowerCase();
    let idx = lower.indexOf(needle);
    if (idx < 0) continue;
    const snippets = [];
    let count = 0; let lastEnd = -1;
    while (idx >= 0 && count < 1000) {
      // Geen overlappende fragmenten: een treffer binnen het vorige fragment telt wel mee, maar krijgt geen eigen fragment.
      if (snippets.length < 3 && idx >= lastEnd) { snippets.push(makeSnippet(text, idx, needle.length)); lastEnd = idx + needle.length + 60; }
      count++;
      idx = lower.indexOf(needle, idx + needle.length);
    }
    results.push({ path: f.rel, matches: count, snippets, qlen: needle.length });
  }
  results.sort((a, b) => b.matches - a.matches);
  return { results, scanned };
}
