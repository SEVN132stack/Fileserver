// Geïntegreerde test: start web + SFTP op testpoorten en controleert de
// belangrijkste functies. Draai met `npm test`.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';

// Isoleer alle data in een tijdelijke map.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'));
process.env.STORAGE_DIR = path.join(tmp, 'storage');
process.env.HOST_KEY_PATH = path.join(tmp, 'host.key');
process.env.USERS_FILE = path.join(tmp, 'users.json');
process.env.AUTHORIZED_KEYS_DIR = path.join(tmp, 'authorized_keys');
process.env.AUDIT_LOG = path.join(tmp, 'audit.log');
process.env.BANS_FILE = path.join(tmp, 'bans.json');
process.env.SHARES_FILE = path.join(tmp, 'shares.json');
process.env.ENV_FILE = path.join(tmp, '.env');
process.env.TLS_CERT = path.join(tmp, 'cert.pem');
process.env.TLS_KEY = path.join(tmp, 'key.pem');
process.env.WEB_PORT = '8097';
process.env.SFTP_PORT = '2239';
process.env.AUTH_USER = 'admin';
process.env.AUTH_PASS = 'testpass123';
process.env.WEBHOOK_URL = '';

const { config } = await import('../src/config.js');
const { ensureStorage, ensureHostKey } = await import('../src/util.js');
const { ensureUsers, addUser, updateUser } = await import('../src/users.js');
ensureStorage(); ensureHostKey(); ensureUsers();
addUser({ username: 'bob', password: 'bobpass', role: 'user' });
addUser({ username: 'ro', password: 'ropass', role: 'readonly' });

const { startWebServer } = await import('../src/web.js');
const { startSftpServer } = await import('../src/sftp.js');
const ssh2 = (await import('ssh2')).default;
const web = startWebServer();
const sftp = startSftpServer();

const H = 'http://localhost:8097';
let cookie = '';
const jar = (h = {}) => cookie ? { ...h, Cookie: cookie } : h;

function login(u, p, token) {
  return fetch(H + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, token }) })
    .then(async (r) => { const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, body: await r.json().catch(() => ({})) }; });
}

let passed = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ✓ ' + name); passed++; }

await new Promise((r) => setTimeout(r, 800));
try {
  // 1. login + sessie
  const l = await login('admin', 'testpass123');
  ok('login met sessie-cookie', l.status === 200 && l.body.ok && cookie.startsWith('sid='));

  // 2. whoami
  const who = await (await fetch(H + '/api/whoami', { headers: jar() })).json();
  ok('whoami geeft rol admin', who.user === 'admin' && who.role === 'admin');

  // 3. upload + list
  const fd = new FormData(); fd.append('files', new Blob(['hoi\n']), 'a.txt');
  await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: fd });
  const list = await (await fetch(H + '/api/list', { headers: jar() })).json();
  ok('upload zichtbaar in list', list.items.some((i) => i.name === 'a.txt'));

  // 4. editor save + preview
  await fetch(H + '/api/save?path=/a.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'nieuwe inhoud' });
  const prev = await (await fetch(H + '/api/preview?path=/a.txt', { headers: jar() })).text();
  ok('editor save + preview', prev === 'nieuwe inhoud');

  // 5. delete -> trash -> restore
  await fetch(H + '/api/delete', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/a.txt' }) });
  const trash = await (await fetch(H + '/api/trash', { headers: jar() })).json();
  ok('verwijderd bestand in prullenbak', trash.items.length === 1);
  await fetch(H + '/api/restore', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: trash.items[0].path }) });
  const list2 = await (await fetch(H + '/api/list', { headers: jar() })).json();
  ok('herstel uit prullenbak', list2.items.some((i) => i.name === 'a.txt'));

  // 6. deel-link
  const share = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/a.txt' }) })).json();
  const pub = await fetch(H + share.url);
  ok('publieke deel-link werkt zonder auth', pub.status === 200);

  // 7. mkdir + zip
  await fetch(H + '/api/mkdir', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/', name: 'sub' }) });
  const zip = await fetch(H + '/api/zip?path=/', { headers: jar() });
  const zbuf = Buffer.from(await zip.arrayBuffer());
  ok('zip-download geldig', zbuf.slice(0, 2).toString() === 'PK');

  // 8. multi-user isolatie
  cookie = ''; await login('bob', 'bobpass');
  const bobList = await (await fetch(H + '/api/list', { headers: jar() })).json();
  ok('bob ziet admin-bestanden niet', !bobList.items.some((i) => i.name === 'a.txt'));

  // 9. readonly kan niet uploaden
  cookie = ''; await login('ro', 'ropass');
  const fd2 = new FormData(); fd2.append('files', new Blob(['x']), 'x.txt');
  const roUp = await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: fd2 });
  ok('readonly upload geweigerd (403)', roUp.status === 403);

  // 10. admin-only endpoint geweigerd voor bob
  cookie = ''; await login('bob', 'bobpass');
  const adm = await fetch(H + '/api/admin/users', { headers: jar() });
  ok('admin-endpoint geweigerd voor niet-admin (403)', adm.status === 403);

  // 11. 2FA end-to-end: schakel 2FA in voor bob en log in met een code.
  const { generateSecret, generateToken, verifyTotp } = await import('../src/totp.js');
  const secret = generateSecret();
  ok('2FA verifieert eigen code', verifyTotp(secret, generateToken(secret)) && !verifyTotp(secret, '000000'));
  updateUser('bob', { totp: secret });
  cookie = '';
  const need = await login('bob', 'bobpass');
  ok('login vraagt om 2FA', need.body.need2fa === true);
  const with2fa = await login('bob', 'bobpass', generateToken(secret));
  ok('login met geldige 2FA-code slaagt', with2fa.status === 200 && with2fa.body.ok);
  updateUser('bob', { totp: null });

  // 12. quota afdwingen
  updateUser('bob', { quota: 3 });
  const fd3 = new FormData(); fd3.append('files', new Blob(['te groot voor quota']), 'big.txt');
  cookie = ''; await login('bob', 'bobpass');
  const over = await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: fd3 });
  ok('quota overschrijding geweigerd (413)', over.status === 413);

  // 13. SFTP password-auth als bob
  await new Promise((res) => {
    const c = new ssh2.Client();
    c.on('ready', () => c.sftp((e, s) => {
      const ws = s.createWriteStream('/via-sftp.txt');
      ws.on('close', () => { ok('SFTP password-auth + upload', true); c.end(); res(); });
      ws.end('sftp\n');
    }));
    c.on('error', (er) => { ok('SFTP password-auth + upload', false); res(); });
    c.connect({ host: '127.0.0.1', port: 2239, username: 'bob', password: 'bobpass' });
  });

  console.log(`\n${passed} tests geslaagd.`);
  web.close(); sftp.close();
  process.exit(0);
} catch (err) {
  console.error('\nTEST MISLUKT:', err.message);
  web.close(); sftp.close();
  process.exit(1);
}
