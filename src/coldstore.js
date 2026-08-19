import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { config } from './config.js';
import { audit } from './audit.js';

// Compressie-at-rest: bestanden die lang niet zijn gewijzigd worden met gzip
// gecomprimeerd (naar "<bestand>.gz", origineel verwijderd) om schijfruimte te
// besparen. Downloads zijn transparant: wie het originele pad opvraagt krijgt de
// gedecomprimeerde inhoud terug (zie de download-afhandeling in web.js).

// Sla al gecomprimeerde/speciale bestanden over.
function skip(name) {
  return name.endsWith('.gz') || name === config.trashName || name === config.versionsName || name.startsWith('.');
}

// Comprimeer in `root` alle bestanden ouder dan `days` dagen en groter dan de
// minimumgrootte. Geeft aantal + bespaarde bytes terug.
export function compressCold(root, days = config.coldStoreDays, minBytes = config.coldStoreMinBytes) {
  if (!days || days <= 0) return { compressed: 0, saved: 0 };
  const cutoff = Date.now() - days * 86400000;
  let compressed = 0, saved = 0;
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (skip(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      let st; try { st = fs.statSync(full); } catch { continue; }
      if (st.mtimeMs > cutoff || st.size < minBytes) continue;
      try {
        const gz = zlib.gzipSync(fs.readFileSync(full));
        if (gz.length < st.size) {
          fs.writeFileSync(full + '.gz', gz);
          fs.unlinkSync(full);
          compressed++; saved += st.size - gz.length;
        }
      } catch { /* bestand overslaan */ }
    }
  };
  walk(root);
  if (compressed) audit('system', null, 'coldstore', { root: path.basename(root), compressed, saved });
  return { compressed, saved };
}

// Als `absFile` niet bestaat maar de gecomprimeerde variant wel, geef dat pad
// terug (voor transparante download); anders null.
export function coldPathFor(absFile) {
  try { if (!fs.existsSync(absFile) && fs.statSync(absFile + '.gz')) return absFile + '.gz'; } catch { /* geen .gz */ }
  return null;
}

// Decomprimeer een cold-bestand (gunzip) naar een buffer.
export function decompress(absGz) {
  return zlib.gunzipSync(fs.readFileSync(absGz));
}

// Herstel (uitpakken) een cold-bestand terug naar zijn originele, ongecomprimeerde vorm.
export function warmUp(absFile) {
  const gz = absFile + '.gz';
  if (!fs.existsSync(gz)) return false;
  fs.writeFileSync(absFile, zlib.gunzipSync(fs.readFileSync(gz)));
  fs.unlinkSync(gz);
  return true;
}
