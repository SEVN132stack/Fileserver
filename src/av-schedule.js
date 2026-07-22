import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { config } from './config.js';
import { scanFile } from './scan.js';
import { quarantine } from './quarantine.js';
import { audit } from './audit.js';
import { alert } from './alerts.js';

// ClamAV-onderhoud: houd de virusdefinities actueel (freshclam) en scan de
// volledige opslag periodiek — nieuwe definities kunnen bestanden besmet
// verklaren die bij upload nog schoon leken. Vondsten gaan in quarantaine.

// Draai freshclam om de virusdefinities bij te werken.
export function runFreshclam() {
  return new Promise((resolve) => {
    if (!config.freshclamCmd) return resolve({ skipped: true });
    const [cmd, ...args] = config.freshclamCmd.split(' ');
    execFile(cmd, args, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        alert('freshclam-failed', 'Virusdefinitie-update mislukt', err.message);
        return resolve({ ok: false, error: err.message });
      }
      audit('system', null, 'freshclam', { ok: true });
      resolve({ ok: true, output: (stdout || stderr || '').slice(-500) });
    });
  });
}

function walk(dir, out, base) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    // Sla systeemmappen over (prullenbak, versies, metadata).
    if (e.name === config.trashName || e.name === config.versionsName || e.name === '.metadata.json') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out, base);
    else out.push(full);
  }
}

// Scan de volledige opslag. Besmette bestanden gaan in quarantaine.
export async function scanAll() {
  if (!config.clamscan && !config.virustotal.apiKey) return { skipped: true };
  const files = [];
  walk(config.storageDir, files, config.storageDir);
  let scanned = 0;
  const infected = [];
  for (const f of files) {
    let verdict;
    try { verdict = await scanFile(f); } catch { continue; }
    scanned++;
    if (verdict.clean === false) {
      const rel = path.relative(config.storageDir, f);
      const parts = rel.split(path.sep);
      const homeName = parts[0];
      const home = path.join(config.storageDir, homeName);
      const targetPath = '/' + parts.slice(1, -1).join('/');
      try {
        quarantine(f, { user: homeName, home, targetPath, filename: path.basename(f), detail: verdict.detail || verdict.engine });
        infected.push(rel);
        audit('system', null, 'av_scan_quarantine', { path: rel, engine: verdict.engine });
      } catch (err) {
        console.error('[av-scan] quarantaine mislukt:', err.message);
      }
    }
  }
  if (infected.length) {
    alert('av-scan-hits', 'Virusscan: besmette bestanden', `${infected.length} bestand(en) in quarantaine geplaatst: ${infected.slice(0, 10).join(', ')}`, { force: true });
  }
  audit('system', null, 'av_scan', { scanned, infected: infected.length });
  return { scanned, infected };
}

export function startAvScheduler() {
  if (config.freshclamIntervalHours > 0 && config.freshclamCmd) {
    setInterval(() => { runFreshclam().catch(() => {}); }, config.freshclamIntervalHours * 3600000).unref();
  }
  if (config.avScanIntervalHours > 0 && (config.clamscan || config.virustotal.apiKey)) {
    setInterval(() => { scanAll().catch((e) => console.error('[av-scan]', e.message)); }, config.avScanIntervalHours * 3600000).unref();
  }
}
