import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { homeDir } from './users.js';
import { audit } from './audit.js';

// Onveranderbare snapshots: een point-in-time kopie van de home-map van een
// gebruiker. Waar het bestandssysteem het ondersteunt (btrfs/XFS/APFS) worden
// reflink-kopieën gemaakt (copy-on-write, ruimte-efficiënt); anders volledige
// kopieën. Snapshots worden na aanmaak nooit meer gewijzigd.

const FICLONE = fs.constants.COPYFILE_FICLONE || 0;

function userSnapDir(user) { return path.join(config.snapshotsDir, user); }

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  let entries = [];
  try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === config.trashName) continue; // prullenbak niet meesnapshotten
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else { try { fs.copyFileSync(s, d, FICLONE); } catch { try { fs.copyFileSync(s, d); } catch { /* skip */ } } }
  }
}

const MAX_SNAPSHOTS = parseInt(process.env.MAX_SNAPSHOTS_PER_USER || '50', 10);

const metaPath = (user, id) => path.join(userSnapDir(user), id + '.meta.json');

// Loop de snapshot-boom één keer door en bepaal aantal bestanden + bytes.
function measureTree(dir) {
  let files = 0, bytes = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else { try { const st = fs.statSync(f); files++; bytes += st.size; } catch {} }
  } };
  try { walk(dir); } catch {}
  return { files, bytes };
}

// De echte snapshot-mappen (niet de losse .meta.json-bestanden).
function snapshotIds(user) {
  try {
    return fs.readdirSync(userSnapDir(user), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { return []; }
}

export function createSnapshot(user, label = '') {
  // Snapshots liggen buiten de home-map en tellen dus niet mee voor de quota;
  // begrens het aantal per gebruiker om schijf-uitputting te voorkomen.
  if (snapshotIds(user).length >= MAX_SNAPSHOTS) {
    throw new Error(`Maximum aantal snapshots (${MAX_SNAPSHOTS}) bereikt; verwijder er eerst een.`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const id = stamp + (label ? '_' + label.replace(/[^a-zA-Z0-9_-]/g, '') : '');
  const dst = path.join(userSnapDir(user), id);
  copyTree(homeDir(user), dst);
  // Bereken de grootte één keer bij aanmaak en cache die in een sidecar-bestand,
  // zodat listSnapshots niet telkens de hele boom hoeft te statten.
  const { files, bytes } = measureTree(dst);
  try { fs.writeFileSync(metaPath(user, id), JSON.stringify({ files, bytes, created: id.slice(0, 19) })); } catch { /* niet fataal */ }
  audit('web', user, 'snapshot_create', { id });
  return { id };
}

export function listSnapshots(user) {
  return snapshotIds(user).map((id) => {
    // Lees de gecachete grootte; ontbreekt die (oude snapshot), bereken hem
    // eenmalig en schrijf de cache alsnog weg.
    try {
      const m = JSON.parse(fs.readFileSync(metaPath(user, id), 'utf8'));
      return { id, files: m.files || 0, bytes: m.bytes || 0, created: m.created || id.slice(0, 19) };
    } catch {
      const { files, bytes } = measureTree(path.join(userSnapDir(user), id));
      try { fs.writeFileSync(metaPath(user, id), JSON.stringify({ files, bytes, created: id.slice(0, 19) })); } catch {}
      return { id, files, bytes, created: id.slice(0, 19) };
    }
  }).sort((a, b) => b.id.localeCompare(a.id));
}

// Zet een snapshot terug in de home-map (overschrijft bestaande bestanden;
// verwijdert niets extra's). WORM-bestanden blijven zoals ze zijn.
export function restoreSnapshot(user, id) {
  const src = path.join(userSnapDir(user), path.basename(id));
  if (!fs.existsSync(src)) throw new Error('Snapshot niet gevonden');
  copyTree(src, homeDir(user));
  audit('web', user, 'snapshot_restore', { id });
  return { ok: true };
}

export function deleteSnapshot(user, id) {
  const base = path.basename(id);
  const dir = path.join(userSnapDir(user), base);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  try { fs.rmSync(metaPath(user, base), { force: true }); } catch { /* geen meta */ }
  return true;
}
