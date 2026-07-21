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

// Verifieer de nieuwste back-up: bestaat hij, is hij > 0 bytes en begint hij met
// de ZIP-magic (PK). Zo weet je dat de back-up geldig/leesbaar is.
export function verifyLatestBackup() {
  if (!fs.existsSync(config.backup.dir)) return { ok: false, reason: 'geen back-ups' };
  const files = fs.readdirSync(config.backup.dir).filter((f) => f.startsWith('backup-') && f.endsWith('.zip')).sort();
  if (!files.length) return { ok: false, reason: 'geen back-ups' };
  const latest = path.join(config.backup.dir, files[files.length - 1]);
  const st = fs.statSync(latest);
  if (st.size < 22) return { ok: false, reason: 'te klein', file: files[files.length - 1] };
  const fd = fs.openSync(latest, 'r');
  const buf = Buffer.alloc(2);
  fs.readSync(fd, buf, 0, 2, 0);
  fs.closeSync(fd);
  const ok = buf.toString('latin1') === 'PK';
  return { ok, file: files[files.length - 1], size: st.size, reason: ok ? undefined : 'geen geldige ZIP' };
}

export function startBackupScheduler() {
  if (config.backup.intervalMinutes <= 0) return;
  const ms = config.backup.intervalMinutes * 60000;
  console.log(`[backup] Planner actief: elke ${config.backup.intervalMinutes} min, ${config.backup.keep} bewaard.`);
  setInterval(async () => {
    try {
      await makeBackup();
      const v = verifyLatestBackup();
      if (!v.ok) {
        const { alert } = await import('./alerts.js');
        alert('backup-invalid', 'Back-up ongeldig', `De laatste back-up is niet geldig: ${v.reason}`);
      }
    } catch (err) {
      const { alert } = await import('./alerts.js');
      alert('backup-failed', 'Back-up mislukt', err.message);
    }
  }, ms).unref();
}
