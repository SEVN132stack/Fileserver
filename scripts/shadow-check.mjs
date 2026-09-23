#!/usr/bin/env node
// Schaduw-controle voor een gefaseerde update (v3.45).
//
// Start een versie van de app (standaard: deze map, of --dir <map> met de nieuwe
// code) als *schaduw-instantie* op een losse poort met een eigen, tijdelijke
// datamap. De schaduw raakt de echte opslag, gebruikers, .env en poorten nooit.
// Optioneel worden de JSON-datastores van de echte installatie (--data <map>)
// gekopieerd, zodat de nieuwe versie ook met de bestaande gegevens moet
// opstarten (users.json niet: de schaduw krijgt een eigen beheerder).
//
// Daarna volgt een zelftest: health/ready, versie, inloggen, map maken,
// upload + download (inhoud gelijk), verwijderen, audit-keten, beheer-zelftest,
// statische pagina's, en of het proces nog leeft. Uitvoer: JSON-rapport;
// exitcode 0 = veilig om over te schakelen, 1 = niet overschakelen.
//
//   node scripts/shadow-check.mjs --dir .staging --data /opt/fileserver --port 18080
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const appDir = path.resolve(opt('dir', path.join(here, '..')));
const realData = opt('data', '');
const port = parseInt(opt('port', String(18000 + Math.floor(Math.random() * 1000))), 10);
const timeoutMs = parseInt(opt('timeout', '60000'), 10);
const base = `http://127.0.0.1:${port}`;

const expectVersion = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')).version;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-shadow-'));
fs.chmodSync(tmp, 0o700);
const pass = randomBytes(18).toString('base64url');
fs.writeFileSync(path.join(tmp, '.env'), [
  'AUTH_USER=schaduwbeheer', `AUTH_PASS=${pass}`, `SESSION_SECRET=${randomBytes(32).toString('base64url')}`,
  `WEB_PORT=${port}`, 'WEB_HOST=127.0.0.1', `SFTP_PORT=${port + 1}`, 'SFTP_HOST=127.0.0.1', 'FTPS_PORT=0',
  'STORAGE_DIR=storage', 'HOST_KEY_PATH=host.key', 'UPDATE_CHECK=false', 'SELFTEST_INTERVAL_HOURS=0', 'TLS_ENABLED=false', '',
].join('\n'), { mode: 0o600 });

let copied = 0;
if (realData) {
  for (const f of fs.readdirSync(realData)) {
    if (!f.endsWith('.json') || f === 'users.json' || f === 'package.json' || f === 'package-lock.json') continue;
    const src = path.join(realData, f);
    try { const st = fs.statSync(src); if (st.isFile() && st.size < 50 * 1024 * 1024) { fs.copyFileSync(src, path.join(tmp, f)); copied++; } } catch { /* overslaan */ }
  }
}

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) }); };
let log = '';
const env = { PATH: process.env.PATH, HOME: tmp, NODE_ENV: 'production', ENV_FILE: path.join(tmp, '.env'), DATA_DIR: tmp };
// Netwerk-sandbox: alleen loopback (geen echte webhooks/mails vanuit de schaduw).
const sandbox = pathToFileURL(path.join(here, 'shadow-sandbox.mjs')).href;
const child = spawn(process.execPath, ['--import', sandbox, 'src/server.js'], { cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
let exited = null; child.on('exit', (code) => { exited = code; });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cookie = '';
const req = async (p, o = {}) => fetch(base + p, { ...o, headers: { ...(o.headers || {}), ...(cookie ? { Cookie: cookie } : {}) }, redirect: 'manual' });

async function run() {
  const deadline = Date.now() + timeoutMs;
  let up = false;
  while (Date.now() < deadline && exited === null) {
    try { const r = await fetch(base + '/health'); if (r.ok) { up = true; break; } } catch { /* nog niet */ }
    await sleep(300);
  }
  check('opstarten', up, up ? '' : (exited !== null ? `proces stopte (code ${exited})` : 'geen antwoord binnen de tijd'));
  if (!up) return;

  const h = await (await fetch(base + '/health')).json();
  check('versie', h.version === expectVersion, `${h.version} (verwacht ${expectVersion})`);
  const ready = await fetch(base + '/ready');
  check('ready', ready.ok, (await ready.text()).slice(0, 120));

  const login = await req('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'schaduwbeheer', password: pass }) });
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  check('inloggen', login.ok && cookie.startsWith('sid='), login.status);
  const who = await (await req('/api/whoami')).json().catch(() => ({}));
  check('whoami', who.user === 'schaduwbeheer' && who.role === 'admin', who.user);

  const mk = await req('/api/mkdir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/schaduwtest' }) });
  check('map maken', mk.ok, mk.status);
  const content = 'schaduw-' + randomBytes(8).toString('hex');
  const fd = new FormData(); fd.append('files', new Blob([content]), 'proef.txt');
  const upl = await req('/api/upload?path=' + encodeURIComponent('/schaduwtest'), { method: 'POST', body: fd });
  check('upload', upl.ok, upl.status);
  const list = await (await req('/api/list?path=' + encodeURIComponent('/schaduwtest'))).json().catch(() => ({}));
  check('lijst', (list.items || []).some((i) => i.name === 'proef.txt'));
  const dl = await req('/api/download?path=' + encodeURIComponent('/schaduwtest/proef.txt'));
  check('download (inhoud gelijk)', dl.ok && (await dl.text()) === content, dl.status);
  const del = await req('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/schaduwtest' }) });
  check('verwijderen', del.ok, del.status);

  const chain = await (await req('/api/admin/audit/verify')).json().catch(() => ({}));
  check('audit-keten', chain.ok === true, JSON.stringify(chain));
  const st = await req('/api/admin/selftest', { method: 'POST' });
  check('beheer-zelftest draait', st.ok, st.status);

  for (const p of ['/', '/login.html', '/app.js', '/shell.js', '/admin.html']) {
    const r = await fetch(base + p); check('pagina ' + p, r.ok || r.status === 302, r.status);
  }
  await sleep(500);
  check('proces leeft nog', exited === null, exited);
}

let fatal = null;
try { await run(); } catch (e) { fatal = e.message; check('uitvoering', false, e.message); }
child.kill('SIGTERM');
await sleep(300);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* opgeruimd */ }
const ok = !fatal && results.length > 0 && results.every((r) => r.ok);
const report = { ok, version: expectVersion, appDir, port, copiedDataFiles: copied, checks: results, log: ok ? undefined : log.split('\n').slice(-30).join('\n').replace(pass, '***') };
console.log(JSON.stringify(report, null, 2));
process.exit(ok ? 0 : 1);
