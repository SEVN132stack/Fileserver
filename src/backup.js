import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { config } from './config.js';
import { audit } from './audit.js';

// Ingebouwde back-upplanner: maakt periodiek een ZIP van de volledige opslag en
// bewaart de laatste N back-ups (retentie).

export function makeBackup() {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(config.backup.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(config.backup.dir, `backup-${stamp}.zip`);
    const out = fs.createWriteStream(dest);
    const archive = archiver('zip', { zlib: { level: 9 } });
    out.on('close', () => {
      pruneOld();
      audit('system', null, 'backup', { file: path.basename(dest), bytes: archive.pointer() });
      resolve(dest);
    });
    archive.on('error', reject);
    archive.pipe(out);
    if (fs.existsSync(config.storageDir)) archive.directory(config.storageDir, false);
    archive.finalize();
  });
}

function pruneOld() {
  const keep = config.backup.keep;
  if (keep <= 0) return;
  const files = fs.readdirSync(config.backup.dir)
    .filter((f) => f.startsWith('backup-') && f.endsWith('.zip'))
    .sort()
    .reverse();
  for (const f of files.slice(keep)) {
    try { fs.unlinkSync(path.join(config.backup.dir, f)); } catch { /* negeren */ }
  }
}

export function startBackupScheduler() {
  if (config.backup.intervalMinutes <= 0) return;
  const ms = config.backup.intervalMinutes * 60000;
  console.log(`[backup] Planner actief: elke ${config.backup.intervalMinutes} min, ${config.backup.keep} bewaard.`);
  setInterval(() => {
    makeBackup().catch((err) => console.error('[backup] mislukt:', err.message));
  }, ms).unref();
}
