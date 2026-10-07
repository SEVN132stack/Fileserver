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

// Laatste voltooide volledige scan, op schijf: een setInterval begint bij elke
// herstart opnieuw te tellen, waardoor een wekelijkse scan bij regelmatige
// deploys nooit zou draaien.
function lastFullScan() {
  try { return JSON.parse(fs.readFileSync(config.avScanStateFile, 'utf8')).lastRun || 0; } catch { return 0; }
}
function saveFullScan(t, result) {
  const tmp = config.avScanStateFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ lastRun: t, scanned: result.scanned, infected: (result.infected || []).length }));
  fs.renameSync(tmp, config.avScanStateFile);
}

// Scan de volledige opslag. Besmette bestanden gaan in quarantaine.
let scanning = false;
export async function scanAll() {
  if (!config.clamscan && !config.virustotal.apiKey) return { skipped: true };
  if (scanning) return { busy: true };
  scanning = true;
  try {
    const result = await scanAllFiles();
    try { saveFullScan(Date.now(), result); } catch (e) { console.error('[av-scan] status opslaan mislukt:', e.message); }
    return result;
  } finally { scanning = false; }
}

async function scanAllFiles() {
  const files = [];
  walk(config.storageDir, files, config.storageDir);
  let scanned = 0; let unscannable = 0;
  const infected = [];
  for (const f of files) {
    let verdict;
    try { verdict = await scanFile(f); } catch { unscannable++; continue; }
    // "Kon niet scannen" is geen besmetting. AV_FAIL_CLOSED geldt voor uploads;
    // hier zou het bij een onbereikbare scanner de hele opslag in quarantaine
    // zetten. Overslaan, en stoppen als de scanner duidelijk onbereikbaar is.
    if (verdict.engine === 'scan-unavailable') {
      unscannable++;
      if (unscannable >= 20 && scanned === 0) {
        alert('av-scan-down', 'Virusscan afgebroken', 'De volledige virusscan is gestopt: de scanner is onbereikbaar (eerste 20 bestanden konden niet gescand worden).');
        audit('system', null, 'av_scan_aborted', { reason: 'scanner onbereikbaar' });
        throw new Error('scanner onbereikbaar');
      }
      continue;
    }
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
  if (unscannable) {
    alert('av-scan-unscannable', 'Virusscan: niet alle bestanden gescand', `${unscannable} bestand(en) konden niet gescand worden (bv. onleesbaar voor de scanner).`);
  }
  audit('system', null, 'av_scan', { scanned, infected: infected.length, unscannable });
  return { scanned, infected, unscannable };
}

export function startAvScheduler() {
  if (config.freshclamIntervalHours > 0 && config.freshclamCmd) {
    setInterval(() => { runFreshclam().catch(() => {}); }, config.freshclamIntervalHours * 3600000).unref();
  }
  if (config.avScanIntervalHours > 0 && (config.clamscan || config.virustotal.apiKey)) {
    // Elk uur kijken of de laatste volledige scan lang genoeg geleden is. De
    // eerste controle pas na 10 minuten, zodat een herstart/deploy (en de
    // kortlevende schaduw-instantie van update.sh) niet direct gaat scannen.
    const check = () => {
      if (Date.now() - lastFullScan() < config.avScanIntervalHours * 3600000) return;
      scanAll().catch((e) => console.error('[av-scan]', e.message));
    };
    setTimeout(check, 10 * 60000).unref();
    setInterval(check, 3600000).unref();
  }
}
