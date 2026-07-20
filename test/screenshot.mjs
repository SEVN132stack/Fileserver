// Maakt screenshots van de web UI (loginpagina + ingelogde bestandsweergave).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-shot-'));
const outDir = process.argv[2] || tmp;
const env = {
  ...process.env,
  STORAGE_DIR: path.join(tmp, 'storage'), HOST_KEY_PATH: path.join(tmp, 'host.key'),
  USERS_FILE: path.join(tmp, 'users.json'), AUTHORIZED_KEYS_DIR: path.join(tmp, 'ak'),
  AUDIT_LOG: path.join(tmp, 'audit.log'), BANS_FILE: path.join(tmp, 'bans.json'),
  SHARES_FILE: path.join(tmp, 'shares.json'), CHUNK_DIR: path.join(tmp, 'chunks'),
  BACKUP_DIR: path.join(tmp, 'backups'), THUMB_DIR: path.join(tmp, 'thumbs'),
  QUARANTINE_DIR: path.join(tmp, 'q'), ENV_FILE: path.join(tmp, '.env'),
  WEB_PORT: '8102', SFTP_PORT: '2244', AUTH_USER: 'admin', AUTH_PASS: 'demo1234', DEFAULT_QUOTA: '5000000',
};
const srv = spawn('node', ['src/server.js'], { env, stdio: 'ignore' });
const base = 'http://localhost:8102';
const auth = 'Basic ' + Buffer.from('admin:demo1234').toString('base64');

async function waitUp() {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base + '/login.html')).ok) return; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('server startte niet');
}
async function seed() {
  const mk = (p, n) => fetch(base + '/api/mkdir', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p, name: n }) });
  const up = (p, name, content) => { const fd = new FormData(); fd.append('files', new Blob([content]), name); return fetch(base + '/api/upload?path=' + encodeURIComponent(p), { method: 'POST', headers: { Authorization: auth }, body: fd }); };
  await mk('/', 'Documenten'); await mk('/', 'Fotos'); await mk('/', 'Projecten');
  await up('/', 'jaarverslag.pdf', 'PDF'.repeat(2000));
  await up('/', 'notities.txt', 'Belangrijke notities\n- punt 1\n- punt 2');
  await up('/', 'begroting.csv', 'post,bedrag\nhuur,1200\nsalaris,3400');
  await up('/', 'README.md', '# Project\nOmschrijving hier.');
  await up('/Fotos', 'vakantie.jpg', 'JPG'.repeat(500));
}

let code = 0;
try {
  await waitUp();
  await seed();
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  await page.goto(base + '/login.html');
  await page.screenshot({ path: path.join(outDir, 'login.png') });

  await page.fill('#username', 'admin');
  await page.fill('#password', 'demo1234');
  await page.click('button[type=submit]');
  await page.waitForURL(base + '/');
  await page.waitForSelector('#rows tr');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'files.png'), fullPage: true });

  // Lichte modus ook tonen.
  await page.click('#themeBtn');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'files-light.png'), fullPage: true });

  await browser.close();
  console.log('Screenshots opgeslagen in: ' + outDir);
} catch (err) {
  console.error('SCREENSHOT MISLUKT:', err.message); code = 1;
} finally {
  srv.kill('SIGTERM');
  process.exit(code);
}
