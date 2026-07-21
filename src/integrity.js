import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from './config.js';
import { alert } from './alerts.js';

// Bestandsintegriteit: bereken en bewaar SHA-256-checksums van alle bestanden in
// de opslag en controleer later op wijzigingen/bit-rot. Handmatig te starten
// vanuit het admin-dashboard (kan zwaar zijn bij veel data).

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(config.integrityFile, 'utf8'));
  } catch {
    return {};
  }
}
function writeManifest(m) {
  fs.writeFileSync(config.integrityFile, JSON.stringify(m), { mode: 0o600 });
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function walk(dir, base, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = base + '/' + e.name;
    if (e.isDirectory()) walk(full, rel, out);
    else out.push({ full, rel });
  }
}

// Bouw een nieuw manifest (baseline) op.
export function buildBaseline() {
  const files = [];
  walk(config.storageDir, '', files);
  const m = {};
  for (const f of files) {
    try { m[f.rel] = { sha: sha256(f.full), size: fs.statSync(f.full).size }; } catch { /* skip */ }
  }
  writeManifest(m);
  return { files: Object.keys(m).length };
}

// Periodieke integriteitscontrole (indien ingeschakeld). Bouwt eerst een
// baseline als die er nog niet is.
export function startIntegrityScheduler() {
  if (!config.integrityIntervalHours || config.integrityIntervalHours <= 0) return;
  if (!fs.existsSync(config.integrityFile)) buildBaseline();
  setInterval(() => {
    try { verify(); } catch (err) { console.error('[integrity]', err.message); }
  }, config.integrityIntervalHours * 3600000).unref();
}

// Controleer de huidige bestanden tegen het manifest.
export function verify() {
  const m = readManifest();
  const files = [];
  walk(config.storageDir, '', files);
  const seen = new Set();
  const changed = [];
  const added = [];
  for (const f of files) {
    seen.add(f.rel);
    let sha;
    try { sha = sha256(f.full); } catch { continue; }
    if (!m[f.rel]) added.push(f.rel);
    else if (m[f.rel].sha !== sha) changed.push(f.rel);
  }
  const removed = Object.keys(m).filter((r) => !seen.has(r));
  const result = { checked: files.length, changed, added, removed };
  if (changed.length) {
    alert('integrity', 'Bestandsintegriteit: wijzigingen', `${changed.length} bestand(en) gewijzigd t.o.v. de baseline.`);
  }
  return result;
}
