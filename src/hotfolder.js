import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { homeDir, userExists, quota } from './users.js';
import { resolveWithin, dirSize } from './paths.js';
import { scanFile } from './scan.js';
import { audit } from './audit.js';

// Scan-naar-map (hot-folder): een host-map (bijv. waar een netwerkscanner of een
// ander systeem bestanden neerzet) wordt periodiek geleegd naar de opslag van een
// gebruiker. Bestanden worden na een virusscan verplaatst naar de doelsubmap.
// Uit als HOTFOLDER_DIR/HOTFOLDER_USER niet zijn ingesteld.

export function enabled() {
  return !!(config.hotfolderDir && config.hotfolderUser && userExists(config.hotfolderUser));
}

function uniqueName(dir, name) {
  const safe = path.basename(String(name)).replace(/[^\w.\- ]+/g, '_').slice(0, 200) || 'bestand';
  let dest = path.join(dir, safe);
  if (!fs.existsSync(dest)) return dest;
  const ext = path.extname(safe); const stem = path.basename(safe, ext);
  return path.join(dir, `${stem}-${randomBytes(3).toString('hex')}${ext}`);
}

// Verwerk alle losse bestanden in de hot-folder één keer. Retourneert wat er is
// geïmporteerd/overgeslagen. Wordt door de scheduler en door /api/hotfolder/scan
// aangeroepen.
export async function scanOnce() {
  if (!enabled()) return { error: 'hot-folder uit', status: 501 };
  let entries;
  try { entries = fs.readdirSync(config.hotfolderDir, { withFileTypes: true }); }
  catch { return { error: 'hot-folder niet leesbaar', status: 500 }; }

  const targetDir = resolveWithin(homeDir(config.hotfolderUser), '/' + config.hotfolderTarget);
  fs.mkdirSync(targetDir, { recursive: true });

  const imported = []; const rejected = [];
  const limit = quota(config.hotfolderUser);
  let used = dirSize(homeDir(config.hotfolderUser));
  for (const e of entries) {
    if (!e.isFile() || e.name.startsWith('.')) continue;
    const src = path.join(config.hotfolderDir, e.name);
    // Sla bestanden over die nog geschreven worden (mtime < 2s geleden).
    let size = 0;
    try { const st = fs.statSync(src); if (Date.now() - st.mtimeMs < 2000) continue; size = st.size; } catch { continue; }
    // Quota bewaken: importeer niet voorbij de opslaglimiet (0 = onbeperkt).
    if (limit > 0 && used + size > limit) { rejected.push(e.name); continue; }
    let clean = true;
    try { const r = await scanFile(src); clean = r.clean !== false; } catch { clean = true; }
    if (!clean) {
      // Besmet: uit de hot-folder halen zodat hij niet blijft rondslingeren.
      const quarantined = path.join(os.tmpdir(), 'hotfolder-besmet-' + randomBytes(6).toString('hex'));
      try { fs.renameSync(src, quarantined); } catch { /* laat staan */ }
      rejected.push(e.name);
      continue;
    }
    const dest = uniqueName(targetDir, e.name);
    try { fs.renameSync(src, dest); imported.push(path.basename(dest)); used += size; }
    catch { rejected.push(e.name); }
  }
  if (imported.length || rejected.length) {
    audit('hotfolder', config.hotfolderUser, 'hotfolder-import', { imported: imported.length, rejected: rejected.length });
  }
  return { ok: true, imported, rejected };
}

let timer = null;
// Start de periodieke scan (aangeroepen vanuit server.js bij opstart).
export function startScheduler(onChange) {
  if (!enabled() || timer) return;
  const ms = Math.max(10, config.hotfolderIntervalSec) * 1000;
  timer = setInterval(async () => {
    try {
      const r = await scanOnce();
      if (r.ok && r.imported.length && typeof onChange === 'function') onChange(config.hotfolderUser);
    } catch { /* niet-fataal */ }
  }, ms);
  if (timer.unref) timer.unref();
}
export function stopScheduler() { if (timer) { clearInterval(timer); timer = null; } }
