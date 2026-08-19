import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { audit } from './audit.js';

// Server-brede point-in-time snapshots: een momentopname van de HELE opslag
// (alle home-mappen). Waar het bestandssysteem het ondersteunt worden
// reflink-kopieën gemaakt (copy-on-write, ruimte-efficiënt); anders volledige
// kopieën. Herstel zet de opslag terug naar het gekozen tijdstip (met eerst een
// veiligheids-snapshot, zodat een verkeerd herstel ook terug te draaien is).

const FICLONE = fs.constants.COPYFILE_FICLONE || 0;

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  let entries = [];
  try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else { try { fs.copyFileSync(s, d, FICLONE); } catch { try { fs.copyFileSync(s, d); } catch { /* skip */ } } }
  }
}

function measure(dir) {
  let files = 0, bytes = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else { try { const st = fs.statSync(f); files++; bytes += st.size; } catch {} }
  } };
  try { walk(dir); } catch {}
  return { files, bytes };
}

function ids() {
  try { return fs.readdirSync(config.serverSnapshotsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); }
  catch { return []; }
}

export function createServerSnapshot(label = '') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const id = stamp + (label ? '_' + String(label).replace(/[^a-zA-Z0-9_-]/g, '') : '');
  const dst = path.join(config.serverSnapshotsDir, id);
  copyTree(config.storageDir, dst);
  // Retentie: bewaar de laatste N.
  const keep = config.serverSnapshotsKeep;
  if (keep > 0) {
    for (const old of ids().sort().reverse().slice(keep)) {
      try { fs.rmSync(path.join(config.serverSnapshotsDir, old), { recursive: true, force: true }); } catch {}
    }
  }
  audit('system', null, 'server_snapshot_create', { id });
  return { id, ...measure(dst) };
}

export function listServerSnapshots() {
  return ids().map((id) => ({ id, created: id.slice(0, 19), ...measure(path.join(config.serverSnapshotsDir, id)) }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

// Herstel de HELE opslag naar een gekozen snapshot. Maakt eerst een
// veiligheids-snapshot van de huidige staat, kopieert dan de snapshot terug over
// de opslag (bestaande bestanden worden overschreven; extra bestanden blijven).
export function restoreServerSnapshot(id, actor) {
  const src = path.join(config.serverSnapshotsDir, path.basename(id));
  if (!fs.existsSync(src)) throw new Error('Snapshot niet gevonden');
  const safety = createServerSnapshot('pre-restore');
  copyTree(src, config.storageDir);
  audit('system', actor || null, 'server_snapshot_restore', { id, safety: safety.id });
  return { ok: true, restored: id, safety: safety.id };
}

export function deleteServerSnapshot(id) {
  const dir = path.join(config.serverSnapshotsDir, path.basename(id));
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}
