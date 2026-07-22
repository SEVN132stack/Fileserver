import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import archiver from 'archiver';
import { config } from './config.js';
import { audit } from './audit.js';

// Versleutel een back-up-bestand met AES-256-GCM (formaat: salt|iv|tag|ct).
export function encryptBackup(file, password) {
  const data = fs.readFileSync(file);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(password, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(data), cipher.final()]);
  const out = Buffer.concat([salt, iv, cipher.getAuthTag(), ct]);
  const dest = file + '.enc';
  fs.writeFileSync(dest, out, { mode: 0o600 });
  fs.rmSync(file);
  return dest;
}

// Ontsleutel een met encryptBackup versleuteld bestand (voor herstel/verificatie).
export function decryptBackup(file, password) {
  const buf = fs.readFileSync(file);
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const tag = buf.subarray(28, 44);
  const ct = buf.subarray(44);
  const key = scryptSync(password, salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

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
      let finalPath = dest;
      // Optioneel versleutelen.
      if (config.backupPassword) {
        try { finalPath = encryptBackup(dest, config.backupPassword); } catch (e) { console.error('[backup] versleutelen mislukt:', e.message); }
      }
      pruneOld();
      // Optioneel off-site kopiëren (bijv. rclone/aws s3 cp).
      if (config.backupUploadCmd) {
        const [cmd, ...args] = config.backupUploadCmd.split(' ');
        execFile(cmd, [...args, finalPath], (err) => { if (err) console.error('[backup] off-site upload mislukt:', err.message); });
      }
      audit('system', null, 'backup', { file: path.basename(finalPath), bytes: archive.pointer(), encrypted: !!config.backupPassword });
      resolve(finalPath);
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
    .filter((f) => f.startsWith('backup-') && (f.endsWith('.zip') || f.endsWith('.zip.enc')))
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
  const files = fs.readdirSync(config.backup.dir).filter((f) => f.startsWith('backup-') && (f.endsWith('.zip') || f.endsWith('.zip.enc'))).sort();
  if (!files.length) return { ok: false, reason: 'geen back-ups' };
  const name = files[files.length - 1];
  const latest = path.join(config.backup.dir, name);
  const st = fs.statSync(latest);
  if (st.size < 22) return { ok: false, reason: 'te klein', file: name };
  // Versleutelde back-up: alleen aanwezigheid/grootte te controleren.
  if (name.endsWith('.enc')) return { ok: true, file: name, size: st.size, encrypted: true };
  const fd = fs.openSync(latest, 'r');
  const buf = Buffer.alloc(2);
  fs.readSync(fd, buf, 0, 2, 0);
  fs.closeSync(fd);
  const ok = buf.toString('latin1') === 'PK';
  return { ok, file: name, size: st.size, reason: ok ? undefined : 'geen geldige ZIP' };
}

// Diepere herstel-test: ontsleutel (indien nodig) de nieuwste back-up naar een
// tijdelijk bestand en valideer de ZIP-structuur echt — het End Of Central
// Directory-record en het aantal entries — i.p.v. alleen de magic-bytes. Zo weet
// je dat de back-up niet half of corrupt is en met het wachtwoord te openen valt.
export function restoreTest() {
  if (!fs.existsSync(config.backup.dir)) return { ok: false, reason: 'geen back-ups' };
  const files = fs.readdirSync(config.backup.dir).filter((f) => f.startsWith('backup-') && (f.endsWith('.zip') || f.endsWith('.zip.enc'))).sort();
  if (!files.length) return { ok: false, reason: 'geen back-ups' };
  const name = files[files.length - 1];
  const latest = path.join(config.backup.dir, name);
  let buf;
  try {
    if (name.endsWith('.enc')) {
      if (!config.backupPassword) return { ok: false, file: name, reason: 'versleuteld maar geen wachtwoord ingesteld' };
      buf = decryptBackup(latest, config.backupPassword);
    } else {
      buf = fs.readFileSync(latest);
    }
  } catch (err) {
    return { ok: false, file: name, reason: 'ontsleutelen mislukt: ' + err.message };
  }
  // Zoek het End Of Central Directory-record (signature 0x06054b50) achteraan.
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) return { ok: false, file: name, reason: 'geen ZIP End-Of-Central-Directory gevonden (corrupt?)' };
  const entries = buf.readUInt16LE(eocd + 10);
  return { ok: true, file: name, entries, bytes: buf.length, encrypted: name.endsWith('.enc') };
}

export function startBackupScheduler() {
  if (config.backup.intervalMinutes <= 0) return;
  const ms = config.backup.intervalMinutes * 60000;
  console.log(`[backup] Planner actief: elke ${config.backup.intervalMinutes} min, ${config.backup.keep} bewaard.`);
  setInterval(async () => {
    try {
      await makeBackup();
      const v = config.backupRestoreTest ? restoreTest() : verifyLatestBackup();
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
