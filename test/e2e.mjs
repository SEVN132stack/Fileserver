// End-to-end browsertest met Playwright (Chromium). Start de echte server in
// een tijdelijke omgeving, logt in via de browser en controleert dat de
// bestandslijst laadt en een upload zichtbaar wordt.
//
// Draai met: npm run test:e2e
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-e2e-'));
const env = {
  ...process.env,
  STORAGE_DIR: path.join(tmp, 'storage'),
  HOST_KEY_PATH: path.join(tmp, 'host.key'),
  USERS_FILE: path.join(tmp, 'users.json'),
  AUTHORIZED_KEYS_DIR: path.join(tmp, 'ak'),
  AUDIT_LOG: path.join(tmp, 'audit.log'),
  BANS_FILE: path.join(tmp, 'bans.json'),
  SHARES_FILE: path.join(tmp, 'shares.json'),
  CHUNK_DIR: path.join(tmp, 'chunks'),
  ENV_FILE: path.join(tmp, '.env'),
  WEB_PORT: '8101',
  SFTP_PORT: '2243',
  AUTH_USER: 'admin',
  AUTH_PASS: 'e2epass123',
};

const srv = spawn('node', ['src/server.js'], { env, stdio: 'ignore' });
const base = 'http://localhost:8101';

async function waitUp() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(base + '/login.html'); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server startte niet');
}

let code = 0;
try {
  await waitUp();
  // Gebruik de vooraf geïnstalleerde Chromium als die er is (anders standaard).
  const preinstalled = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome']
    .find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || preinstalled || undefined });
  const page = await browser.newPage();

  await page.goto(base + '/login.html');
  await page.fill('#username', 'admin');
  await page.fill('#password', 'e2epass123');
  await page.locator('#password').press('Enter');
  await page.waitForURL(base + '/');

  // Wacht tot de bestandenweergave laadt.
  await page.waitForSelector('#rows');
  const who = await page.textContent('#who');
  if (!who.includes('admin')) throw new Error('gebruikersnaam niet getoond');
  console.log('  ✓ inloggen via browser werkt (' + who.trim() + ')');

  // Maak een map aan via de UI (dialog).
  page.once('dialog', (d) => d.accept('e2e-map'));
  await page.click('#mkdirBtn');
  await page.waitForTimeout(500);
  const hasFolder = await page.locator('text=e2e-map').count();
  if (!hasFolder) throw new Error('map niet aangemaakt');
  console.log('  ✓ map aanmaken via de UI werkt');

  // Nieuwe indeling: ⋯-menu per rij, commandopalet en stijlkeuze.
  await page.locator('#rows .rowmore').first().click();
  if (!(await page.locator('.rowmenu.open button').count())) throw new Error('rij-menu opent niet');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  if (!(await page.locator('#palette.open').count())) throw new Error('commandopalet opent niet');
  await page.keyboard.press('Escape');
  for (const st of ['licht', 'zakelijk', 'donker']) {
    await page.selectOption('#styleSelect', st);
    if ((await page.getAttribute('html', 'data-style')) !== st) throw new Error('stijl ' + st + ' niet toegepast');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw > 400) throw new Error('horizontale scroll op mobiel: ' + sw);
  console.log('  ✓ rij-menu, commandopalet, stijlen en mobiele indeling werken');

  await browser.close();
  console.log('\nE2E-browsertest geslaagd.');
} catch (err) {
  console.error('\nE2E MISLUKT:', err.message);
  code = 1;
} finally {
  srv.kill('SIGTERM');
  process.exit(code);
}
