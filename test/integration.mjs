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
process.env.CHUNK_DIR = path.join(tmp, 'chunks');
process.env.BACKUP_DIR = path.join(tmp, 'backups');
process.env.THUMB_DIR = path.join(tmp, 'thumbs');
process.env.METRICS_HISTORY_FILE = path.join(tmp, 'metrics-history.json');
process.env.GROUPS_FILE = path.join(tmp, 'groups.json');
process.env.KEYRING_FILE = path.join(tmp, 'keyring.json');
process.env.PERMALINKS_FILE = path.join(tmp, 'permalinks.json');
process.env.COMMENTS_FILE = path.join(tmp, 'comments.json');
process.env.INTEGRITY_FILE = path.join(tmp, 'integrity.json');
process.env.SEARCH_INDEX_FILE = path.join(tmp, 'search-index.json');
process.env.TAGS_FILE = path.join(tmp, 'tags.json');
process.env.SHARE_ACCESS_FILE = path.join(tmp, 'share-access.json');
process.env.LOCKS_FILE = path.join(tmp, 'locks.json');
process.env.SCHEDULED_EXPORTS_FILE = path.join(tmp, 'scheduled-exports.json');
process.env.RETENTION_FILE = path.join(tmp, 'retention.json');
process.env.EXPIRY_FILE = path.join(tmp, 'expiry.json');
process.env.E2E_FOLDERS_FILE = path.join(tmp, 'e2e-folders.json');
process.env.API_KEYS_FILE = path.join(tmp, 'api-keys.json');
process.env.NOTIFICATIONS_FILE = path.join(tmp, 'notifications.json');
process.env.OCR_FILE = path.join(tmp, 'ocr-index.json');
process.env.ACCESS_REQUESTS_FILE = path.join(tmp, 'access-requests.json');
process.env.USER_TASKS_FILE = path.join(tmp, 'user-tasks.json');
process.env.AUTO_TAG = 'true';
process.env.INVITES_FILE = path.join(tmp, 'invites.json');
process.env.WEBHOOK_QUEUE_FILE = path.join(tmp, 'webhook-queue.json');
process.env.SNAPSHOTS_DIR = path.join(tmp, 'snapshots');
process.env.FOLDER_INFO_FILE = path.join(tmp, 'folder-info.json');
process.env.METRICS_TOKEN = 'test-metrics-token';
process.env.MAX_UPLOAD_BYTES = '1048576'; // 1MB uploadlimiet voor de test
// Sessie-binding/step-up uit voor de brede suite; de dedicated tests zetten ze
// tijdens de run zelf aan via config.
process.env.SESSION_BIND = 'off';
process.env.REAUTH_WINDOW_MS = '0';
process.env.UPDATE_CHECK = 'false';
process.env.SETTINGS_FILE = path.join(tmp, 'settings.json');
process.env.ENV_FILE = path.join(tmp, '.env');
process.env.TLS_CERT = path.join(tmp, 'cert.pem');
process.env.TLS_KEY = path.join(tmp, 'key.pem');
process.env.WEB_PORT = '8097';
process.env.SFTP_PORT = '2239';
process.env.AUTH_USER = 'admin';
process.env.AUTH_PASS = 'testpass123';
process.env.QUARANTINE_DIR = path.join(tmp, 'quarantine');
process.env.QUARANTINE_META = path.join(tmp, 'quarantine.json');
process.env.CLAMSCAN = path.resolve('test/mock-scanner.mjs');
process.env.WEBHOOK_URL = 'http://localhost:8096/hook';

// Webhook-capture-server voor het testen van notificaties.
const http = await import('node:http');
const captured = [];
http.createServer((rq, rs) => {
  let b = ''; rq.on('data', (c) => (b += c)); rq.on('end', () => { try { captured.push(JSON.parse(b)); } catch {} rs.end('ok'); });
}).listen(8096);

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

  // 13a. Hervatbare (chunked) upload: 3 chunks samenvoegen.
  cookie = ''; await login('admin', 'testpass123');
  const uploadId = 'testbig';
  const parts = ['aaa', 'bbb', 'ccc'];
  for (let i = 0; i < parts.length; i++) {
    const cfd = new FormData(); cfd.append('chunk', new Blob([parts[i]]));
    await fetch(H + `/api/upload/chunk?uploadId=${uploadId}&index=${i}&total=3&name=big.txt&path=/`, { method: 'POST', headers: jar(), body: cfd });
  }
  const bigContent = await (await fetch(H + '/api/preview?path=/big.txt', { headers: jar() })).text();
  ok('chunked upload samengevoegd', bigContent === 'aaabbbccc');

  // 13b. Resume: status geeft ontvangen chunks terug.
  const cfd2 = new FormData(); cfd2.append('chunk', new Blob(['x']));
  await fetch(H + '/api/upload/chunk?uploadId=resume1&index=0&total=5&name=r.txt&path=/', { method: 'POST', headers: jar(), body: cfd2 });
  const st = await (await fetch(H + '/api/upload/status?uploadId=resume1', { headers: jar() })).json();
  ok('resume-status toont ontvangen chunk', st.received.includes(0));

  // 13c. Prullenbak telt mee in gebruikte opslag.
  const who2 = await (await fetch(H + '/api/whoami', { headers: jar() })).json();
  await fetch(H + '/api/delete', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/big.txt' }) });
  const who3 = await (await fetch(H + '/api/whoami', { headers: jar() })).json();
  ok('prullenbak telt mee in opslag', who3.trashUsed > 0 && who3.used >= who3.trashUsed);

  // 13d. SSE: ontvang een change-event bij een upload.
  const sseGot = await new Promise(async (resolve) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); resolve(false); }, 4000);
    fetch(H + '/api/events', { headers: jar(), signal: ctrl.signal }).then(async (r) => {
      const reader = r.body.getReader();
      // trigger een wijziging
      const fd = new FormData(); fd.append('files', new Blob(['x']), 'sse.txt');
      fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: fd });
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += Buffer.from(value).toString();
        if (buf.includes('event: change')) { clearTimeout(timer); ctrl.abort(); resolve(true); break; }
      }
    }).catch(() => {});
  });
  ok('SSE stuurt change-event', sseGot === true);

  // 13e. Wachtwoord-reset: token -> confirm -> inloggen met nieuw wachtwoord.
  const { createResetToken } = await import('../src/mailer.js');
  const rtok = createResetToken('ro');
  const rc = await fetch(H + '/api/reset/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: rtok, password: 'ronieuw12' }) });
  cookie = ''; const roLogin = await login('ro', 'ronieuw12');
  ok('wachtwoord-reset via token werkt', rc.status === 200 && roLogin.status === 200 && roLogin.body.ok);

  // 13f. Metadata: favoriet markeren -> verschijnt in favorieten.
  cookie = ''; await login('admin', 'testpass123');
  await fetch(H + '/api/meta', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/a.txt', tags: ['belangrijk'], comment: 'test', favorite: true }) });
  const favs = await (await fetch(H + '/api/favorites', { headers: jar() })).json();
  ok('metadata favoriet + tags opgeslagen', favs.favorites.some((f) => f.path === '/a.txt' && f.tags.includes('belangrijk')));

  // 13g. Thumbnail van een echte afbeelding.
  const sharpMod = (await import('sharp')).default;
  const png = await sharpMod({ create: { width: 20, height: 20, channels: 3, background: { r: 200, g: 0, b: 0 } } }).png().toBuffer();
  const ifd = new FormData(); ifd.append('files', new Blob([png]), 'rood.png');
  await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: ifd });
  const thumb = await fetch(H + '/api/thumb?path=/rood.png&w=16', { headers: jar() });
  ok('thumbnail gegenereerd', thumb.status === 200 && (thumb.headers.get('content-type') || '').includes('webp'));

  // 13h. Gedeelde map met schrijfrechten: admin deelt met bob (rw), bob uploadt.
  await fetch(H + '/api/mkdir', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/', name: 'pub' }) });
  await fetch(H + '/api/grant', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ to: 'bob', path: '/pub', mode: 'rw' }) });
  cookie = ''; await login('bob', 'bobpass');
  const sfd = new FormData(); sfd.append('files', new Blob(['van bob']), 'bob-shared.txt');
  const shup = await fetch(H + '/api/shared/upload?owner=admin&path=/pub', { method: 'POST', headers: jar(), body: sfd });
  cookie = ''; await login('admin', 'testpass123');
  const pubList = await (await fetch(H + '/api/list?path=/pub', { headers: jar() })).json();
  ok('gedeelde rw-map: schrijven werkt', shup.status === 200 && pubList.items.some((i) => i.name === 'bob-shared.txt'));

  // 13i. tus resumable upload (protocol 1.0.0).
  const meta = 'filename ' + Buffer.from('tusfile.txt').toString('base64') + ',path ' + Buffer.from('/').toString('base64');
  const create = await fetch(H + '/tus', { method: 'POST', headers: jar({ 'Upload-Length': '5', 'Upload-Metadata': meta, 'Tus-Resumable': '1.0.0' }) });
  const loc = create.headers.get('location');
  const patch = await fetch(H + loc, { method: 'PATCH', headers: jar({ 'Content-Type': 'application/offset+octet-stream', 'Upload-Offset': '0', 'Tus-Resumable': '1.0.0' }), body: Buffer.from('hello') });
  const tusList = await (await fetch(H + '/api/list', { headers: jar() })).json();
  ok('tus upload voltooid', create.status === 201 && patch.status === 204 && tusList.items.some((i) => i.name === 'tusfile.txt'));

  // 13j. Prometheus-metrics.
  const met = await (await fetch(H + '/metrics', { headers: { Authorization: 'Bearer test-metrics-token' } })).text();
  ok('metrics-endpoint levert tellers', met.includes('fileserver_uploads_total'));

  // 13k. Back-up maken via admin.
  const bk = await (await fetch(H + '/api/admin/backup', { method: 'POST', headers: jar() })).json();
  const bl = await (await fetch(H + '/api/admin/backups', { headers: jar() })).json();
  ok('back-up maken + lijst', bk.ok && bl.backups.length >= 1);

  // 13l. Client-side-versleutelingsformaat (AES-GCM roundtrip).
  {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const base = await crypto.subtle.importKey('raw', enc.encode('pw'), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode('geheim'));
    const pt = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
    ok('E2E-versleuteling roundtrip', pt === 'geheim');
  }

  // 13m0. Antivirus-aggregatiebeleid (fail-open vs fail-closed).
  {
    const { aggregate } = await import('../src/scan.js');
    const infected = aggregate([{ clean: false, engine: 'clamav', detail: 'X' }, { clean: true }]);
    const oneClean = aggregate([{ error: true, engine: 'virustotal' }, { clean: true, engine: 'clamav' }]);
    const allErrClosed = aggregate([{ error: true, engine: 'clamav' }], true);
    const allErrOpen = aggregate([{ error: true, engine: 'clamav' }], false);
    const noneConfigured = aggregate([{ skipped: true }, { skipped: true }], true);
    ok('AV-beleid: besmet wint / min. 1 schoon = ok / fail-closed blokkeert / fail-open laat door / uit = ok',
      infected.clean === false &&
      oneClean.clean === true &&
      allErrClosed.clean === false && allErrClosed.engine === 'scan-unavailable' &&
      allErrOpen.clean === true &&
      noneConfigured.clean === true);
  }

  // 13m. Antivirus-quarantaine i.p.v. weigeren.
  cookie = ''; await login('admin', 'testpass123');
  const vfd = new FormData(); vfd.append('files', new Blob(['dit bevat EICAR test']), 'virus.txt');
  const vup = await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: vfd });
  const vjson = await vup.json();
  const qlist = await (await fetch(H + '/api/admin/quarantine', { headers: jar() })).json();
  ok('besmet bestand in quarantaine (niet geplaatst)', vjson.infected && vjson.infected.includes('virus.txt') && qlist.items.length >= 1);
  const rel = await fetch(H + `/api/admin/quarantine/${qlist.items[0].id}/release`, { method: 'POST', headers: jar() });
  const afterQuar = await (await fetch(H + '/api/list', { headers: jar() })).json();
  ok('quarantaine vrijgeven zet bestand terug', rel.status === 200 && afterQuar.items.some((i) => i.name === 'virus.txt'));

  // 13n. Versiegeschiedenis.
  await fetch(H + '/api/save?path=/ver.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'v1' });
  await fetch(H + '/api/save?path=/ver.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'v2' });
  const vers = await (await fetch(H + '/api/versions?path=/ver.txt', { headers: jar() })).json();
  ok('versiegeschiedenis bewaard', vers.versions.length >= 1);
  await fetch(H + '/api/version/restore', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/ver.txt', version: vers.versions[0].version }) });
  const restored = await (await fetch(H + '/api/preview?path=/ver.txt', { headers: jar() })).text();
  ok('oude versie herstellen werkt', restored === 'v1');

  // 13o. Delta-sync: alleen gewijzigd blok versturen.
  await fetch(H + '/api/save?path=/big2.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'AAAABBBB' });
  const sig = await (await fetch(H + '/api/sync/signature?path=/big2.txt', { headers: jar() })).json();
  const ops = [{ c: 0 }, { d: Buffer.from('CCCC').toString('base64') }]; // hergebruik blok 0 (hele bestand < blockSize) → hier 1 blok
  // Omdat het bestand kleiner is dan de blokgrootte, is er 1 blok; stuur nieuwe data.
  const applyRes = await fetch(H + '/api/sync/apply?path=/big2.txt', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ blockSize: sig.blockSize, ops: [{ d: Buffer.from('XYZ').toString('base64') }] }) });
  const synced = await (await fetch(H + '/api/preview?path=/big2.txt', { headers: jar() })).text();
  ok('delta-sync past bestand aan', applyRes.status === 200 && synced === 'XYZ' && sig.blocks.length === 1);

  // 13p. E2E-keyring: publieke sleutel opslaan en ophalen.
  await fetch(H + '/api/keys/pubkey', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ jwk: { kty: 'RSA', n: 'test', e: 'AQAB' } }) });
  const pk = await (await fetch(H + '/api/keys/pubkey?user=admin', { headers: jar() })).json();
  await fetch(H + '/api/keyring', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ folder: '/geheim', wrappedKey: 'AAAA' }) });
  const ring = await (await fetch(H + '/api/keyring', { headers: jar() })).json();
  ok('E2E-keyring: pubkey + wrapped map-sleutel', pk.pubkey && pk.pubkey.n === 'test' && ring.ring['/geheim']);

  // 13q. Webhook-notificatie bij delen + deel-download.
  const shr = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/ver.txt' }) })).json();
  await fetch(H + shr.url);
  await new Promise((r) => setTimeout(r, 400));
  ok('webhook bij share_create + share_access', captured.some((c) => c.event === 'share_create') && captured.some((c) => c.event === 'share_access'));

  // 13r. Quota afgedwongen op tus.
  cookie = ''; await login('bob', 'bobpass'); // bob heeft quota 3
  const tcreate = await fetch(H + '/tus', { method: 'POST', headers: jar({ 'Upload-Length': '100', 'Tus-Resumable': '1.0.0', 'Upload-Metadata': 'filename ' + Buffer.from('x').toString('base64') }) });
  ok('quota afgedwongen op tus (413)', tcreate.status === 413);

  // 13s. Rolling-hash rsync-delta op byte-niveau (invoegen aan het begin).
  {
    const rsync = await import('../src/rsync.js');
    const oldBuf = Buffer.alloc(5000);
    for (let i = 0; i < oldBuf.length; i++) oldBuf[i] = (i * 7 + 3) & 0xff;
    const oldFile = path.join(tmp, 'rs-old.bin');
    fs.writeFileSync(oldFile, oldBuf);
    const newBuf = Buffer.concat([Buffer.from('XX'), oldBuf]); // 2 bytes ingevoegd vooraan
    const sig = rsync.signature(oldFile, rsync.DEFAULT_BLOCK);
    const delta = rsync.computeDelta(sig, newBuf);
    const outFile = path.join(tmp, 'rs-new.bin');
    rsync.applyDelta(oldFile, outFile, sig.blockSize, delta.ops);
    const result = fs.readFileSync(outFile);
    const copies = delta.ops.filter((o) => o.c !== undefined).length;
    ok('rolling-hash delta hergebruikt blokken na byte-shift', result.equals(newBuf) && copies >= 2);
  }

  // 13t. Deel-link met downloadlimiet.
  cookie = ''; await login('admin', 'testpass123');
  const lim = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/a.txt', maxDownloads: 1 }) })).json();
  const first = await fetch(H + lim.url);
  const second = await fetch(H + lim.url);
  ok('deel-link downloadlimiet (1x)', first.status === 200 && second.status !== 200);

  // 13u. E2E-sleutelrotatie: versie verhoogt.
  await fetch(H + '/api/keyring', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ folder: '/rot', wrappedKey: 'K1' }) });
  const rot = await (await fetch(H + '/api/keyring/rotate', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ folder: '/rot', wrappedKey: 'K2' }) })).json();
  const ring2 = await (await fetch(H + '/api/keyring', { headers: jar() })).json();
  ok('E2E-sleutelrotatie verhoogt versie', rot.version === 2 && ring2.ring['/rot'].wrappedKey === 'K2');

  // 13v. Multi-engine scan aggregeert (clamav-mock markeert EICAR).
  const { scanFile } = await import('../src/scan.js');
  const cleanFile = path.join(tmp, 'clean.txt'); fs.writeFileSync(cleanFile, 'onschuldig');
  const dirtyFile = path.join(tmp, 'dirty.txt'); fs.writeFileSync(dirtyFile, 'bevat EICAR patroon');
  const cleanRes = await scanFile(cleanFile);
  const dirtyRes = await scanFile(dirtyFile);
  ok('multi-engine scan: schoon vs. besmet', cleanRes.clean === true && dirtyRes.clean === false && dirtyRes.engine === 'clamav');

  // 13w. Delta-sync end-to-end via de API (signature -> computeDelta -> apply).
  {
    const rsync = await import('../src/rsync.js');
    await fetch(H + '/api/save?path=/sync-e2e.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'HELLO WORLD 12345' });
    const sig = await (await fetch(H + '/api/sync/signature?path=/sync-e2e.txt', { headers: jar() })).json();
    const newContent = Buffer.from('xxHELLO WORLD 12345'); // 2 bytes ingevoegd
    const delta = rsync.computeDelta(sig, newContent);
    const applied = await fetch(H + '/api/sync/apply?path=/sync-e2e.txt', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ blockSize: delta.blockSize, ops: delta.ops }) });
    const got = await (await fetch(H + '/api/preview?path=/sync-e2e.txt', { headers: jar() })).text();
    ok('delta-sync via API werkt end-to-end', applied.status === 200 && got === 'xxHELLO WORLD 12345');
  }

  // 13x. Admin-overzicht bevat kern-informatie.
  const ov = await (await fetch(H + '/api/admin/overview', { headers: jar() })).json();
  ok('admin-overzicht levert stats', ov.users.total >= 3 && typeof ov.storageUsed === 'number' && ov.metrics.fileserver_uploads_total >= 1 && Array.isArray(ov.recentAudit));

  // 13y. Admin ziet alle deel-links met statistieken.
  const allShares = await (await fetch(H + '/api/admin/shares', { headers: jar() })).json();
  ok('admin-deel-links met downloadtellingen', Array.isArray(allShares.shares) && allShares.shares.some((s) => typeof s.downloads === 'number'));

  // 13ab. Preview stuurt beveiligingsheaders (geen script-uitvoering).
  cookie = ''; await login('admin', 'testpass123');
  await fetch(H + '/api/save?path=/evil.html', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: '<script>alert(1)</script>' });
  const pv2 = await fetch(H + '/api/preview?path=/evil.html', { headers: jar() });
  const csp = pv2.headers.get('content-security-policy') || '';
  ok('preview stuurt CSP-sandbox + nosniff', csp.includes('sandbox') && pv2.headers.get('x-content-type-options') === 'nosniff');

  // 13z. Admin live-events (SSE): activiteit wordt uitgezonden.
  cookie = ''; await login('admin', 'testpass123');
  const adminSse = await new Promise((resolve) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); resolve(false); }, 4000);
    fetch(H + '/api/admin/events', { headers: jar(), signal: ctrl.signal }).then(async (r) => {
      const reader = r.body.getReader();
      const fd = new FormData(); fd.append('files', new Blob(['x']), 'act.txt');
      fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: fd });
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += Buffer.from(value).toString();
        if (buf.includes('event: activity')) { clearTimeout(timer); ctrl.abort(); resolve(true); break; }
      }
    }).catch(() => {});
  });
  ok('admin live-events (SSE activity)', adminSse === true);

  // 13aa. Historische metrics: samples bewaren en opvragen.
  const { recordSample } = await import('../src/metrics-history.js');
  recordSample(); await new Promise((r) => setTimeout(r, 20)); recordSample();
  const histRes = await (await fetch(H + '/api/admin/metrics/history?minutes=60', { headers: jar() })).json();
  ok('historische metrics worden bewaard en opgevraagd', Array.isArray(histRes.samples) && histRes.samples.length >= 2 && typeof histRes.samples[0].fileserver_uploads_total === 'number');

  // 13ac. /health (geen auth).
  const health = await (await fetch(H + '/health')).json();
  ok('health-endpoint', health.status === 'ok' && typeof health.uptime === 'number');

  // 13ad. Drop-link (upload-portaal): anonieme upload.
  cookie = ''; await login('admin', 'testpass123');
  await fetch(H + '/api/mkdir', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/', name: 'inbox' }) });
  const drop = await (await fetch(H + '/api/droplink', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/inbox' }) })).json();
  const form = await (await fetch(H + drop.url)).text();
  const dfd = new FormData(); dfd.append('files', new Blob(['aangeleverd']), 'extern.txt');
  const dup = await fetch(H + drop.url + '/upload', { method: 'POST', body: dfd }); // geen auth
  const inbox = await (await fetch(H + '/api/list?path=/inbox', { headers: jar() })).json();
  ok('drop-link: anonieme upload komt binnen', form.includes('Bestanden aanleveren') && dup.status === 200 && inbox.items.some((i) => i.name === 'extern.txt'));

  // 13ae. QR-code (SVG).
  const qr = await fetch(H + '/api/qr?text=/inbox', { headers: jar() });
  ok('QR-code endpoint levert SVG', (qr.headers.get('content-type') || '').includes('svg') && (await qr.text()).includes('<svg'));

  // 13af. Actieve sessies bekijken + intrekken.
  const sess = await (await fetch(H + '/api/sessions', { headers: jar() })).json();
  ok('sessies tonen huidige sessie', sess.sessions.length >= 1 && sess.sessions.some((s) => s.current));

  // 13ag. Groepen + groep-gebaseerd delen.
  await fetch(H + '/api/admin/groups/team', { method: 'PUT', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ members: ['bob'] }) });
  await fetch(H + '/api/grant', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ to: 'group:team', path: '/inbox', mode: 'ro' }) });
  cookie = ''; await login('bob', 'bobpass');
  const bobWho = await (await fetch(H + '/api/whoami', { headers: jar() })).json();
  ok('groep-gebaseerd delen zichtbaar voor lid', (bobWho.shared || []).some((s) => s.owner === 'admin' && s.path === '/inbox'));

  // 13ah. Opslagrapport.
  cookie = ''; await login('admin', 'testpass123');
  const rep = await (await fetch(H + '/api/admin/storage-report', { headers: jar() })).json();
  ok('opslagrapport levert totalen + grootste bestanden', typeof rep.total === 'number' && Array.isArray(rep.largestFiles));

  // 13ai. Volledige-tekst zoeken in inhoud.
  await fetch(H + '/api/save?path=/zoekbaar.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'geheimwoord xyzzy staat hierin' });
  const cs = await (await fetch(H + '/api/list?q=xyzzy&content=1', { headers: jar() })).json();
  const csNoContent = await (await fetch(H + '/api/list?q=xyzzy', { headers: jar() })).json();
  ok('volledige-tekst zoeken in inhoud', cs.items.some((i) => i.name === 'zoekbaar.txt') && !csNoContent.items.some((i) => i.name === 'zoekbaar.txt'));

  // 13aj. Wachtwoordbeleid dwingt minimale lengte af.
  const weak = await fetch(H + '/api/admin/users', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ username: 'zwak', password: '123' }) });
  ok('wachtwoordbeleid weigert te kort wachtwoord', weak.status === 400);

  // 13ak. Onderhoudsmodus: admin erdoor, verder GET settings terug op uit.
  await fetch(H + '/api/admin/settings', { method: 'PUT', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ maintenance: true }) });
  const admStill = await fetch(H + '/api/list', { headers: jar() });
  const setBack = await (await fetch(H + '/api/admin/settings', { method: 'PUT', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ maintenance: false }) })).json();
  ok('onderhoudsmodus laat admin door + terug uit te zetten', admStill.status === 200 && setBack.settings.maintenance === false);

  // 13al. WebAuthn-status (niet geconfigureerd in test).
  const wa = await (await fetch(H + '/api/webauthn/enabled')).json();
  const wc = await (await fetch(H + '/api/webauthn/count', { headers: jar() })).json();
  ok('webauthn-status endpoint (publiek enabled + authed count)', wa.enabled === false && typeof wc.count === 'number');

  // 13am. Permalink per bestand: stabiele UUID-link, publiek bereikbaar, volgt rename.
  cookie = ''; await login('admin', 'testpass123');
  await fetch(H + '/api/save?path=/perma.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'permalink-inhoud' });
  const mkPerma = (body) => fetch(H + '/api/permalink', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) }).then((r) => r.json());
  const pl1 = await mkPerma({ path: '/perma.txt' });
  const pl2 = await mkPerma({ path: '/perma.txt' });
  const fetched = await fetch(H + '/f/' + pl1.uuid); // geen auth
  const body = await fetched.text();
  await fetch(H + '/api/rename', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ from: '/perma.txt', to: '/perma-nieuw.txt' }) });
  const afterRename = await fetch(H + '/f/' + pl1.uuid);
  ok('permalink: stabiel, publiek bereikbaar en volgt hernoemen',
    pl1.uuid && pl1.uuid === pl2.uuid && /^[0-9a-f-]{36}$/.test(pl1.uuid) &&
    fetched.status === 200 && body === 'permalink-inhoud' && afterRename.status === 200);

  // 13am2. Permalink met wachtwoord: zonder ww een formulier, met ww de inhoud.
  const plPw = await mkPerma({ path: '/perma-nieuw.txt', password: 'permageheim' });
  const noPw = await (await fetch(H + '/f/' + plPw.uuid)).text();
  const withPw = await fetch(H + '/f/' + plPw.uuid + '?pw=permageheim');
  ok('permalink met wachtwoord', noPw.includes('Beveiligde link') && withPw.status === 200 && (await withPw.text()) === 'permalink-inhoud');

  // 13am3. Permalink met vervaldatum in het verleden -> verlopen (404).
  const plExp = await mkPerma({ path: '/perma-nieuw.txt', expiresInHours: -1 });
  const expired = await fetch(H + '/f/' + plExp.uuid);
  ok('permalink met vervaldatum verloopt', expired.status === 404);

  // 13an. Admin beheert bestaande links (deellink + permalink): lijst, wijzig, intrek.
  cookie = ''; await login('admin', 'testpass123');
  await fetch(H + '/api/save?path=/beheer.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'x' });
  const bShare = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/beheer.txt' }) })).json();
  const bPerma = await mkPerma({ path: '/beheer.txt' });
  const allSh = await (await fetch(H + '/api/admin/shares', { headers: jar() })).json();
  const allPl = await (await fetch(H + '/api/admin/permalinks', { headers: jar() })).json();
  // wachtwoord op permalink zetten via admin
  await fetch(H + '/api/admin/permalinks/' + bPerma.uuid, { method: 'PATCH', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ password: 'beheerww' }) });
  const nowProtected = await (await fetch(H + '/f/' + bPerma.uuid)).text();
  // deellink intrekken via admin
  const shToken = bShare.url.split('/').pop();
  await fetch(H + '/api/admin/shares/' + shToken, { method: 'DELETE', headers: jar() });
  const revoked = await fetch(H + '/s/' + shToken);
  ok('admin beheert links (lijst, wachtwoord zetten, intrekken)',
    allSh.shares.some((s) => s.token === shToken) && allPl.permalinks.some((p) => p.uuid === bPerma.uuid) &&
    nowProtected.includes('Beveiligde link') && revoked.status === 404);

  // 13ao. Onderhoud: schijf, back-up-verificatie, integriteit, export.
  cookie = ''; await login('admin', 'testpass123');
  const disk = await (await fetch(H + '/api/admin/disk', { headers: jar() })).json();
  const baseline = await (await fetch(H + '/api/admin/integrity/baseline', { method: 'POST', headers: jar() })).json();
  const verify = await (await fetch(H + '/api/admin/integrity/verify', { method: 'POST', headers: jar() })).json();
  const exp = await (await fetch(H + '/api/admin/export', { headers: jar() })).json();
  ok('onderhoud: schijf/integriteit/export',
    typeof disk.freePct === 'number' && baseline.files >= 0 && Array.isArray(verify.changed) && exp.users && exp.version);

  // 13ap. Security-headers aanwezig.
  const hdr = await fetch(H + '/api/whoami', { headers: jar() });
  ok('security-headers (CSP + nosniff + frame-options)',
    (hdr.headers.get('content-security-policy') || '').includes("default-src 'self'") &&
    hdr.headers.get('x-content-type-options') === 'nosniff' &&
    hdr.headers.get('x-frame-options') === 'SAMEORIGIN');

  // 13aq. Gedeelde bestandscommentaren.
  await fetch(H + '/api/save?path=/doc.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'inhoud' });
  await fetch(H + '/api/comments', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/doc.txt', text: 'eerste reactie' }) });
  const cm = await (await fetch(H + '/api/comments?path=/doc.txt', { headers: jar() })).json();
  ok('gedeelde comments toevoegen/tonen', cm.comments.length === 1 && cm.comments[0].text === 'eerste reactie' && cm.comments[0].user === 'admin');

  // 13ar. Update-checker respecteert de UPDATE_CHECK-schakelaar (hier uit).
  const upd = await (await fetch(H + '/api/admin/update-check', { headers: jar() })).json();
  ok('update-checker (endpoint werkt, respecteert config)', upd.enabled === false);

  // 13as. Log-rotatie werkt (audit.log wordt geroteerd bij overschrijding).
  const { audit: auditFn } = await import('../src/audit.js');
  const origMax = config.logMaxBytes;
  config.logMaxBytes = 200; // forceer rotatie
  for (let i = 0; i < 40; i++) auditFn('test', 'x', 'ping', { i });
  config.logMaxBytes = origMax;
  ok('audit-log-rotatie', fs.existsSync(config.auditLog + '.1'));

  // 14. SFTP password-auth als bob
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

  // 15. Ransomware-detectie: veel mutaties in korte tijd alarmeert.
  const { recordMutation } = await import('../src/ransomware.js');
  const origThr = config.ransomware.threshold;
  config.ransomware.threshold = 5;
  let ransomAlert = false;
  for (let i = 0; i < 6; i++) ransomAlert = recordMutation('bob', 'delete') || ransomAlert;
  config.ransomware.threshold = origThr;
  ok('ransomware-detectie alarmeert boven drempel', ransomAlert === true);

  // 16. Honeypot: mutatie op lokbestand alarmeert.
  const { checkHoneypot } = await import('../src/honeypot.js');
  const origHp = config.honeypots;
  config.honeypots = ['/PASSWORDS.txt'];
  const hpHit = checkHoneypot('bob', '/PASSWORDS.txt', 'write');
  config.honeypots = origHp;
  ok('honeypot alarmeert bij toegang tot lokbestand', hpHit === true);

  // 17. Accountvervaldatum: verlopen account kan niet inloggen.
  updateUser('bob', { expires: Date.now() - 1000 });
  const expiredLogin = await login('bob', 'bobpass');
  updateUser('bob', { expires: undefined });
  cookie = ''; // herstel admin-sessie
  const readmin = await login('admin', 'testpass123');
  ok('verlopen account kan niet inloggen', expiredLogin.status === 403 && readmin.status === 200);

  // 18. Backup-encryptie: versleutelde backup is leesbaar terug te ontsleutelen.
  const { encryptBackup, decryptBackup } = await import('../src/backup.js');
  const plain = path.join(tmp, 'plain.zip');
  fs.writeFileSync(plain, 'backup-inhoud');
  const enc = encryptBackup(plain, 'geheim123');
  const dec = decryptBackup(enc, 'geheim123');
  ok('backup-encryptie rondrit', enc.endsWith('.enc') && !fs.existsSync(plain) && dec.toString() === 'backup-inhoud');

  // 19. Onvervalsbaar audit-log: hash-keten verifieert.
  const chain = await (await fetch(H + '/api/admin/audit/verify', { headers: jar() })).json();
  ok('audit-log hash-keten intact', chain.ok === true && chain.checked > 0);

  // 20. Step-up reauth: met window aan is export geblokkeerd tot herbevestiging.
  config.reauthWindowMs = 300000;
  const noReauth = await fetch(H + '/api/admin/export', { headers: jar() });
  const ra = await fetch(H + '/api/reauth', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ password: 'testpass123' }) });
  const afterReauth = await fetch(H + '/api/admin/export', { headers: jar() });
  config.reauthWindowMs = 0;
  ok('step-up reauth beschermt gevoelige actie', noReauth.status === 403 && ra.status === 200 && afterReauth.status === 200);

  // 20b. Sessie-binding: dezelfde cookie vanaf een andere User-Agent wordt geweigerd.
  config.sessionBindMode = 'ua';
  const sameUa = await fetch(H + '/api/whoami', { headers: jar() });
  const otherUa = await fetch(H + '/api/whoami', { headers: jar({ 'User-Agent': 'heel-andere-browser/9' }) });
  config.sessionBindMode = 'off';
  ok('sessie-binding weigert cookie vanaf ander apparaat', sameUa.status === 200 && otherUa.status === 401);

  // 21. Readiness-probe.
  const ready = await (await fetch(H + '/ready')).json();
  ok('readiness-probe', ready.ready === true && ready.checks.storageWritable && ready.checks.usersLoaded);

  // 22. Per-gebruiker metrics in de Prometheus-output (met token; publiek geen usernames).
  const promPublic = await (await fetch(H + '/metrics', { headers: { Authorization: 'Bearer test-metrics-token' } })).text();
  const promNoToken = await fetch(H + '/metrics'); // zonder token -> 401
  ok('per-gebruiker metrics + schijf-gauge (achter token)',
    promPublic.includes('fileserver_user_bytes_uploaded_total') && promPublic.includes('fileserver_disk_free_percent') && promNoToken.status === 401);

  // 23. Zoekindex: (her)bouwen en gebruiken voor snelle zoekopdracht.
  await fetch(H + '/api/save?path=/indexed.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'uniekwoordxyz erin' });
  const reindex = await (await fetch(H + '/api/admin/search/reindex', { method: 'POST', headers: jar() })).json();
  const found = await (await fetch(H + '/api/list?path=/&q=uniekwoordxyz&content=1', { headers: jar() })).json();
  ok('zoekindex bouwt en vindt via inhoud', reindex.files >= 1 && found.items.some((i) => i.path === '/indexed.txt'));

  // 24. Tags + bulk-verplaatsen.
  await fetch(H + '/api/save?path=/taggable.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'x' });
  await fetch(H + '/api/tags', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/taggable.txt', tags: ['Belangrijk', 'werk'] }) });
  const byTag = await (await fetch(H + '/api/tags?tag=belangrijk', { headers: jar() })).json();
  await fetch(H + '/api/mkdir', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/map1' }) });
  const bm = await (await fetch(H + '/api/bulk/move', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ paths: ['/taggable.txt'], dest: '/map1' }) })).json();
  const movedTags = await (await fetch(H + '/api/tags?path=/map1/taggable.txt', { headers: jar() })).json();
  ok('tags + bulk-verplaatsen (tags verhuizen mee)',
    byTag.paths.includes('/taggable.txt') && bm.moved === 1 && movedTags.tags.includes('belangrijk'));

  // 25. Back-up herstel-test valideert de ZIP-structuur.
  const { makeBackup } = await import('../src/backup.js');
  await makeBackup();
  const rt = await (await fetch(H + '/api/admin/backup-restore-test', { method: 'POST', headers: jar() })).json();
  ok('back-up herstel-test valideert ZIP-structuur', rt.ok === true && rt.entries >= 0);

  // 26. Bestandsvergrendeling: vergrendeld bestand kan niet hernoemd worden.
  await fetch(H + '/api/save?path=/lockme.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'x' });
  const lk = await fetch(H + '/api/lock', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/lockme.txt' }) });
  const renLocked = await fetch(H + '/api/rename', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ from: '/lockme.txt', to: '/renamed.txt' }) });
  // Ook overschrijven via de editor moet geweigerd worden zolang het vergrendeld is.
  const saveLocked = await fetch(H + '/api/save?path=/lockme.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'overschrijf' });
  await fetch(H + '/api/unlock', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/lockme.txt' }) });
  const renOk = await fetch(H + '/api/rename', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ from: '/lockme.txt', to: '/renamed.txt' }) });
  ok('bestandsvergrendeling blokkeert hernoemen + overschrijven tot ontgrendeld',
    lk.status === 200 && renLocked.status === 423 && saveLocked.status === 423 && renOk.status === 200);

  // 27. Wachtwoord-hergebruik wordt geweigerd bij zelf wijzigen.
  const reuse = await fetch(H + '/api/change-password', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ current: 'testpass123', password: 'testpass123' }) });
  const changed = await fetch(H + '/api/change-password', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ current: 'testpass123', password: 'nieuwPass456' }) });
  // herstel het wachtwoord voor eventuele latere tests
  await fetch(H + '/api/change-password', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ current: 'nieuwPass456', password: 'testpass123b' }) });
  ok('wachtwoord-hergebruik geweigerd, nieuw toegestaan', reuse.status === 400 && changed.status === 200);

  // 28. Toegangslog voor gedeelde bestanden registreert downloads.
  await fetch(H + '/api/save?path=/shared.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'geheim' });
  const shrA = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/shared.txt' }) })).json();
  await fetch(H + shrA.url); // anonieme download
  const acc = await (await fetch(H + '/api/share-access?path=/shared.txt', { headers: jar() })).json();
  ok('toegangslog registreert download van gedeeld bestand', acc.access.length >= 1 && acc.access[0].path === '/shared.txt');

  // 29. Office-preview: docx-tekst wordt geëxtraheerd (minimale ZIP met deflate).
  const zlib = await import('node:zlib');
  const docXml = Buffer.from('<w:document><w:body><w:p><w:r><w:t>Hallo officewereld</w:t></w:r></w:p></w:body></w:document>');
  const comp = zlib.deflateRawSync(docXml);
  const fnameB = Buffer.from('word/document.xml');
  const crc = 0; // niet gevalideerd door onze lezer
  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0); lfh.writeUInt16LE(8, 8); lfh.writeUInt32LE(crc, 14);
  lfh.writeUInt32LE(comp.length, 18); lfh.writeUInt32LE(docXml.length, 22); lfh.writeUInt16LE(fnameB.length, 26);
  const localRec = Buffer.concat([lfh, fnameB, comp]);
  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0); cdh.writeUInt16LE(8, 10); cdh.writeUInt32LE(crc, 16);
  cdh.writeUInt32LE(comp.length, 20); cdh.writeUInt32LE(docXml.length, 24); cdh.writeUInt16LE(fnameB.length, 28); cdh.writeUInt32LE(0, 42);
  const cdRec = Buffer.concat([cdh, fnameB]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdRec.length, 12); eocd.writeUInt32LE(localRec.length, 16);
  const docx = Buffer.concat([localRec, cdRec, eocd]);
  fs.writeFileSync(path.join(config.storageDir, 'admin', 'doc.docx'), docx);
  const op = await (await fetch(H + '/api/office-preview?path=/doc.docx', { headers: jar() })).json();
  ok('office-preview extraheert docx-tekst', op.type === 'docx' && op.text.includes('Hallo officewereld'));

  // 30. Overal uitloggen trekt sessies in (huidige cookie werkt daarna niet meer).
  const cookieBefore = cookie;
  const lo = await fetch(H + '/api/logout-all', { method: 'POST', headers: { Cookie: cookieBefore } });
  const afterLogoutAll = await fetch(H + '/api/whoami', { headers: { Cookie: cookieBefore } });
  cookie = ''; await login('admin', 'testpass123b');
  ok('overal uitloggen trekt sessies in', lo.status === 200 && afterLogoutAll.status === 401);

  // 31. Server-side 2FA-afdwinging: zonder 2FA alleen inschrijven toegestaan.
  cookie = ''; await login('admin', 'testpass123b');
  config.requireTwoFactor = 'all';
  const gatedList = await fetch(H + '/api/list', { headers: jar() });
  const gatedWho = await fetch(H + '/api/whoami', { headers: jar() });
  config.requireTwoFactor = 'off';
  ok('2FA-afdwinging blokkeert toegang server-side tot inschrijving',
    gatedList.status === 403 && gatedWho.status === 200);

  // 32. share-target vereist authenticatie (geen anonieme upload).
  const stFd = new FormData(); stFd.append('files', new Blob(['x']), 'st.txt');
  const stAnon = await fetch(H + '/share-target', { method: 'POST', body: stFd });
  ok('share-target weigert zonder auth', stAnon.status === 401);

  // 33. Uploadgrootte-limiet: een bestand > MAX_UPLOAD_BYTES wordt geweigerd (413).
  cookie = ''; await login('admin', 'testpass123b');
  const bigFd = new FormData(); bigFd.append('files', new Blob([new Uint8Array(1_200_000)]), 'groot.bin');
  const bigUp = await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: bigFd });
  const smallFd = new FormData(); smallFd.append('files', new Blob([new Uint8Array(1000)]), 'klein.bin');
  const smallUp = await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: smallFd });
  ok('uploadgrootte-limiet weigert te grote upload (413)', bigUp.status === 413 && smallUp.status === 200);

  // 34. WebDAV PUT wordt nu ook door de virusscanner beschermd (geen bypass).
  const dav = (p, opts = {}) => fetch(H + '/webdav' + p, { ...opts, headers: { Authorization: 'Basic ' + Buffer.from('admin:testpass123b').toString('base64'), ...(opts.headers || {}) } });
  const davClean = await dav('/dav-clean.txt', { method: 'PUT', body: 'schone inhoud' });
  const davVirus = await dav('/dav-virus.txt', { method: 'PUT', body: 'bevat EICAR patroon' });
  const davGet = await dav('/dav-clean.txt');
  ok('WebDAV PUT: schoon opgeslagen, besmet (EICAR) geweigerd',
    davClean.status === 201 && davVirus.status === 422 && (await davGet.text()) === 'schone inhoud');

  // 35. DLP: BSN-elfproef en creditcard-Luhn herkennen; wachtwoord-patroon.
  const { scanText } = await import('../src/dlp.js');
  const dlpHits = scanText('mijn bsn is 111222333 en kaart 4111 1111 1111 1111, password=Geheim123');
  ok('DLP herkent BSN, creditcard en wachtwoord',
    dlpHits.bsn === 1 && dlpHits.creditcard === 1 && dlpHits.wachtwoord === 1);

  // 36. DLP-blokkade bij upload (action=block -> quarantaine).
  cookie = ''; await login('admin', 'testpass123b');
  config.dlp.action = 'block';
  const dlpFd = new FormData(); dlpFd.append('files', new Blob(['kaart 4111 1111 1111 1111']), 'gevoelig.txt');
  const dlpRes = await (await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: dlpFd })).json();
  config.dlp.action = 'off';
  ok('DLP blokkeert upload met gevoelige data', Array.isArray(dlpRes.infected) && dlpRes.infected.some((n) => n.includes('DLP')));

  // 37. Admin-impersonatie: bekijk als bob, zie bobs (lege) lijst i.p.v. admins.
  await fetch(H + '/api/save?path=/alleen-admin.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'x' });
  const imp = await fetch(H + '/api/admin/impersonate', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ username: 'bob' }) });
  const whoImp = await (await fetch(H + '/api/whoami', { headers: jar() })).json();
  const listImp = await (await fetch(H + '/api/list', { headers: jar() })).json();
  const adminBlocked = await fetch(H + '/api/admin/users', { headers: jar() }); // bob is geen admin
  await fetch(H + '/api/impersonate/stop', { method: 'POST', headers: jar() });
  const whoBack = await (await fetch(H + '/api/whoami', { headers: jar() })).json();
  ok('admin-impersonatie schakelt identiteit en herstelt',
    imp.status === 200 && whoImp.user === 'bob' && whoImp.impersonating && whoImp.realUser === 'admin'
    && !listImp.items.some((i) => i.name === 'alleen-admin.txt') && adminBlocked.status === 403
    && whoBack.user === 'admin' && !whoBack.impersonating);

  // 38. Rapportage-overzicht levert opslag/afdeling/inactief.
  const repOv = await (await fetch(H + '/api/admin/report/overview', { headers: jar() })).json();
  const heat = await (await fetch(H + '/api/admin/report/heatmap', { headers: jar() })).json();
  ok('rapportage + heatmap leveren data',
    Array.isArray(repOv.users) && repOv.users.some((u) => u.username === 'admin') && repOv.perTenant
    && Array.isArray(heat.hours) && heat.hours.length === 24);

  // 39. Algemene API-rate-limiting per IP.
  config.apiRateLimit.max = 3; config.apiRateLimit.windowMs = 60000;
  let got429 = false;
  for (let i = 0; i < 6; i++) { const r = await fetch(H + '/api/whoami', { headers: jar() }); if (r.status === 429) got429 = true; }
  config.apiRateLimit.max = 0;
  ok('API-rate-limiting weigert boven de limiet (429)', got429 === true);

  // 40. WORM/retentie: bestand onder bewaarplicht kan niet worden gewijzigd/verwijderd.
  cookie = ''; await login('admin', 'testpass123b');
  await fetch(H + '/api/save?path=/worm.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'origineel' });
  await fetch(H + '/api/retention', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/worm.txt', days: 30 }) });
  const wormSave = await fetch(H + '/api/save?path=/worm.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'gewijzigd' });
  const wormDel = await (await fetch(H + '/api/delete', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/worm.txt' }) })).json();
  const stillThere = await (await fetch(H + '/api/list', { headers: jar() })).json();
  ok('WORM-retentie blokkeert wijzigen + verwijderen',
    wormSave.status === 423 && stillThere.items.some((i) => i.name === 'worm.txt'));

  // 41. Self-destruct: vervaldatum in het verleden -> sweep verwijdert het bestand.
  const { setExpiry, sweepExpired } = await import('../src/expiry.js');
  await fetch(H + '/api/save?path=/tijdelijk.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'weg' });
  setExpiry(path.join(config.storageDir, 'admin'), '/tijdelijk.txt', Date.now() - 1000);
  const sw = sweepExpired();
  const afterSweep = await (await fetch(H + '/api/list', { headers: jar() })).json();
  ok('self-destruct verwijdert verlopen bestand', sw.removed >= 1 && !afterSweep.items.some((i) => i.name === 'tijdelijk.txt'));

  // 42. E2E-verplichte map: onversleutelde upload geweigerd, .enc toegestaan.
  await fetch(H + '/api/mkdir', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/kluis' }) });
  await fetch(H + '/api/e2e-folders', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ folder: '/kluis', on: true }) });
  const plainFd = new FormData(); plainFd.append('files', new Blob(['klare tekst']), 'geheim.txt');
  const plainUp = await fetch(H + '/api/upload?path=/kluis', { method: 'POST', headers: jar(), body: plainFd });
  const encFd = new FormData(); encFd.append('files', new Blob(['versleuteld']), 'geheim.txt.enc');
  const encUp = await fetch(H + '/api/upload?path=/kluis', { method: 'POST', headers: jar(), body: encFd });
  ok('E2E-map weigert klare tekst, staat .enc toe', plainUp.status >= 400 && encUp.status === 200);

  // 43. API-sleutel: read-scope kan lezen maar niet schrijven.
  const keyRes = await (await fetch(H + '/api/apikeys', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'test', scope: 'read' }) })).json();
  const kh = { Authorization: 'Bearer ' + keyRes.token };
  const keyList = await fetch(H + '/api/list', { headers: kh });
  const keyWrite = await fetch(H + '/api/mkdir', { method: 'POST', headers: { ...kh, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/', name: 'viakey' }) });
  ok('API-sleutel (read) leest wel, schrijft niet', keyRes.token.startsWith('fsk_') && keyList.status === 200 && keyWrite.status === 403);

  // 44. Notificatiecentrum: melding toevoegen en als gelezen markeren.
  const { notifyUser } = await import('../src/notifications.js');
  notifyUser('admin', 'Testmelding', 'hoi');
  const notifs = await (await fetch(H + '/api/notifications', { headers: jar() })).json();
  await fetch(H + '/api/notifications/read', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({}) });
  const notifs2 = await (await fetch(H + '/api/notifications', { headers: jar() })).json();
  ok('notificatiecentrum: melding + gelezen-markering', notifs.unread >= 1 && notifs2.unread === 0);

  // 45. Duplicaten-vinder herkent identieke bestanden.
  await fetch(H + '/api/save?path=/dup1.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'zelfde inhoud hier' });
  await fetch(H + '/api/save?path=/dup2.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'zelfde inhoud hier' });
  const dups = await (await fetch(H + '/api/duplicates', { headers: jar() })).json();
  ok('duplicaten-vinder groepeert identieke bestanden',
    dups.groups.some((g) => g.paths.includes('/dup1.txt') && g.paths.includes('/dup2.txt')));

  // 46. Webhook-formattering voor Slack.
  const { formatWebhook } = await import('../src/notify.js');
  const slack = formatWebhook('slack', 'upload', { user: 'admin' });
  ok('webhook-template (slack) formatteert', typeof slack.body.text === 'string' && slack.body.text.includes('upload'));

  // 47. API-sleutel (ook write-scope) heeft GEEN beheertoegang.
  const wkey = await (await fetch(H + '/api/apikeys', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'w', scope: 'write' }) })).json();
  const keyAdmin = await fetch(H + '/api/admin/users', { headers: { Authorization: 'Bearer ' + wkey.token } });
  ok('API-sleutel krijgt geen beheertoegang (403)', keyAdmin.status === 403);

  // 48. WORM-retentie is ook via WebDAV niet te omzeilen.
  await fetch(H + '/api/save?path=/worm-dav.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'origineel' });
  await fetch(H + '/api/retention', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/worm-dav.txt', days: 30 }) });
  const davAuth = { Authorization: 'Basic ' + Buffer.from('admin:testpass123b').toString('base64') };
  const davOverwrite = await fetch(H + '/webdav/worm-dav.txt', { method: 'PUT', headers: davAuth, body: 'via webdav gewijzigd' });
  const davDelete = await fetch(H + '/webdav/worm-dav.txt', { method: 'DELETE', headers: davAuth });
  ok('WORM-retentie blokkeert WebDAV PUT + DELETE', davOverwrite.status === 423 && davDelete.status === 423);

  // 49. GDPR-forget herstelt de audit-keten (blijft verifieerbaar).
  addUser({ username: 'vergeetmij', password: 'pw', role: 'user' });
  await fetch(H + '/api/admin/gdpr/forget/vergeetmij', { method: 'POST', headers: jar() });
  const chainAfter = await (await fetch(H + '/api/admin/audit/verify', { headers: jar() })).json();
  ok('audit-keten blijft intact na GDPR-forget', chainAfter.ok === true);

  // 50. Ongeldige API-sleutel wordt netjes geweigerd (401) i.p.v. doorval.
  const badKey = await fetch(H + '/api/whoami', { headers: { Authorization: 'Bearer fsk_00_ongeldig' } });
  ok('ongeldige API-sleutel -> 401', badKey.status === 401);

  // 51. WORM admin-override: retentie opheffen maakt het bestand weer wijzigbaar.
  await fetch(H + '/api/save?path=/worm-release.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'x' });
  await fetch(H + '/api/retention', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/worm-release.txt', days: 30 }) });
  const wormBeforeRel = await fetch(H + '/api/save?path=/worm-release.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'y' });
  await fetch(H + '/api/admin/retention/release', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ user: 'admin', path: '/worm-release.txt' }) });
  const wormAfterRel = await fetch(H + '/api/save?path=/worm-release.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'z' });
  ok('WORM admin-override heft retentie op (geaudit)', wormBeforeRel.status === 423 && wormAfterRel.status === 200);

  // 52. Self-destruct respecteert WORM: een verlopen maar onder-bewaarplicht
  //     bestand wordt NIET verwijderd door de sweep.
  await fetch(H + '/api/save?path=/worm-expiry.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'blijf' });
  const adminHome = path.join(config.storageDir, 'admin');
  await fetch(H + '/api/retention', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/worm-expiry.txt', days: 30 }) });
  setExpiry(adminHome, '/worm-expiry.txt', Date.now() - 1000); // al verlopen
  const swept = sweepExpired();
  const wormExpiryList = await (await fetch(H + '/api/list', { headers: jar() })).json();
  ok('self-destruct verwijdert géén bestand onder bewaarplicht',
    wormExpiryList.items.some((i) => i.name === 'worm-expiry.txt'));

  // 53. Automatische categorisatie: upload krijgt automatisch tags (type + inhoud).
  const invBlob = new Blob(['Factuur\nFactuurnummer: 123\nBTW: 21%\nTe betalen: 100 euro']);
  const invFd = new FormData(); invFd.append('files', invBlob, 'rekening.txt');
  await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: invFd });
  const autoTags = await (await fetch(H + '/api/tags?path=/rekening.txt', { headers: jar() })).json();
  ok('auto-categorisatie tagt op type + inhoud', autoTags.tags.includes('document') && autoTags.tags.includes('factuur'));

  // 54. OCR-zoeken: geïnjecteerde OCR-tekst wordt gevonden bij inhoud-zoeken.
  const { setOcrText } = await import('../src/ocr.js');
  const adminHomeAbs = path.join(config.storageDir, 'admin');
  fs.writeFileSync(path.join(adminHomeAbs, 'scan.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47])); // dummy 'afbeelding'
  setOcrText(adminHomeAbs, '/scan.png', 'FACTUURtekst uit ocr zichtbaarwoord123');
  const ocrSearch = await (await fetch(H + '/api/list?q=zichtbaarwoord123&content=1', { headers: jar() })).json();
  ok('OCR-tekst is doorzoekbaar', ocrSearch.items.some((i) => i.name === 'scan.png'));

  // 55. Toegangsaanvraag-workflow: carol vraagt, admin keurt goed -> carol ziet de deling.
  addUser({ username: 'carol', password: 'carolpass', role: 'user' });
  await fetch(H + '/api/mkdir', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/', name: 'gedeeld-na-verzoek' }) });
  cookie = ''; await login('carol', 'carolpass');
  const arCreate = await (await fetch(H + '/api/access-request', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ owner: 'admin', path: '/gedeeld-na-verzoek', mode: 'ro' }) })).json();
  cookie = ''; await login('admin', 'testpass123b');
  const incoming = await (await fetch(H + '/api/access-requests', { headers: jar() })).json();
  await fetch(H + '/api/access-request/' + arCreate.id + '/decide', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ approve: true }) });
  cookie = ''; await login('carol', 'carolpass');
  const carolShares = await (await fetch(H + '/api/whoami', { headers: jar() })).json();
  ok('toegangsaanvraag: aanvragen + goedkeuren geeft deling',
    arCreate.id && incoming.incoming.some((r) => r.id === arCreate.id) &&
    (carolShares.shared || []).some((s) => s.owner === 'admin' && s.path === '/gedeeld-na-verzoek'));

  // 56. Per-gebruiker geplande taak: cleanup verwijdert oude bestanden (dry via runTask).
  cookie = ''; await login('admin', 'testpass123b');
  await fetch(H + '/api/mkdir', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/', name: 'tmp-oud' }) });
  const oldFile = path.join(adminHomeAbs, 'tmp-oud', 'oud.txt');
  fs.writeFileSync(oldFile, 'oud'); fs.utimesSync(oldFile, new Date(Date.now() - 40 * 86400000), new Date(Date.now() - 40 * 86400000));
  const taskRes = await (await fetch(H + '/api/tasks', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ type: 'cleanup', path: '/tmp-oud', olderThanDays: 30 }) })).json();
  const run = await (await fetch(H + '/api/tasks/' + taskRes.task.id + '/run', { method: 'POST', headers: jar() })).json();
  ok('geplande taak: cleanup verwijdert oude bestanden', run.removed >= 1 && !fs.existsSync(oldFile));

  // 57. Rijke preview: STL-info (aantal driehoeken + afmetingen).
  const { stlInfo } = await import('../src/richpreview.js');
  // Bouw een minimale binaire STL met 1 driehoek.
  const stl = Buffer.alloc(84 + 50);
  stl.writeUInt32LE(1, 80);
  const tri = [0,0,0, 1,0,0, 0,1,0]; // 3 vertices na de 12-byte normaal
  for (let i = 0; i < 9; i++) stl.writeFloatLE(tri[i], 84 + 12 + i * 4);
  const stlPath = path.join(adminHomeAbs, 'model.stl'); fs.writeFileSync(stlPath, stl);
  const stlApi = await (await fetch(H + '/api/richpreview?path=/model.stl', { headers: jar() })).json();
  const stlDirect = stlInfo(stlPath);
  ok('rijke preview: STL-info', stlApi.triangles === 1 && stlDirect.dimensions.x === 1);

  // 58. Sync-endpoint: /api/changes levert de boom met mtime.
  const changes = await (await fetch(H + '/api/changes?since=0', { headers: jar() })).json();
  ok('sync-changes-endpoint levert bestanden met mtime',
    Array.isArray(changes.files) && changes.files.some((f) => typeof f.mtime === 'number') && typeof changes.now === 'number');

  // 59. 2FA-herstelcodes: genereren en als 2FA-alternatief gebruiken bij login.
  cookie = ''; await login('admin', 'testpass123b');
  const recov = await (await fetch(H + '/api/2fa/recovery-codes', { method: 'POST', headers: jar() })).json();
  const { generateSecret: gs2, generateToken: gt2 } = await import('../src/totp.js');
  const sec2 = gs2(); updateUser('admin', { totp: sec2 });
  cookie = '';
  const loginRc = await login('admin', 'testpass123b', recov.codes[0]); // herstelcode i.p.v. TOTP
  updateUser('admin', { totp: null }); cookie = ''; await login('admin', 'testpass123b');
  ok('2FA-herstelcode werkt als alternatief', recov.codes.length === 10 && loginRc.status === 200 && loginRc.body.ok);

  // 60. Invite-code + zelfregistratie.
  const invite = await (await fetch(H + '/api/admin/invites', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ role: 'user' }) })).json();
  const reg = await fetch(H + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: invite.invite.code, username: 'nieuweling', password: 'welkom12345' }) });
  const regReuse = await fetch(H + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: invite.invite.code, username: 'nieuweling2', password: 'welkom12345' }) });
  const regLogin = await login('nieuweling', 'welkom12345');
  cookie = ''; await login('admin', 'testpass123b');
  ok('invite-registratie: eenmalig bruikbaar + account werkt',
    reg.status === 200 && regReuse.status === 400 && regLogin.status === 200);

  // 61. Snapshot: maken, home wijzigen, terugzetten.
  await fetch(H + '/api/save?path=/snaptest.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'origineel' });
  await fetch(H + '/api/snapshots', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ label: 'test' }) });
  const snapList = await (await fetch(H + '/api/snapshots', { headers: jar() })).json();
  await fetch(H + '/api/save?path=/snaptest.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'gewijzigd' });
  await fetch(H + '/api/snapshots/' + encodeURIComponent(snapList.snapshots[0].id) + '/restore', { method: 'POST', headers: jar() });
  const snapRestored = await (await fetch(H + '/api/preview?path=/snaptest.txt', { headers: jar() })).text();
  ok('snapshot maken + terugzetten', snapList.snapshots.length >= 1 && snapRestored === 'origineel');

  // 62. Per-map info (beschrijving/kleur/icoon).
  await fetch(H + '/api/mkdir', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/', name: 'projectmap' }) });
  await fetch(H + '/api/folder-info', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/projectmap', description: 'Mijn project', color: '#38bdf8', icon: '🚀' }) });
  const fi = await (await fetch(H + '/api/folder-info?path=/projectmap', { headers: jar() })).json();
  ok('per-map info opgeslagen', fi.description === 'Mijn project' && fi.color === '#38bdf8' && fi.icon === '🚀');

  // 63. Hervatbare download (HTTP Range -> 206 met juiste bytes).
  await fetch(H + '/api/save?path=/rangefile.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'ABCDEFGHIJ' });
  const rangeResp = await fetch(H + '/api/download?path=/rangefile.txt', { headers: jar({ Range: 'bytes=2-5' }) });
  const rangeBody = await rangeResp.text();
  ok('hervatbare download levert 206 + juiste bytes',
    rangeResp.status === 206 && rangeBody === 'CDEF' && (rangeResp.headers.get('content-range') || '').includes('/10'));

  // 64. Activiteitenfeed per map.
  const act = await (await fetch(H + '/api/activity?path=/projectmap', { headers: jar() })).json();
  await fetch(H + '/api/save?path=/projectmap/doc.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'x' });
  const act2 = await (await fetch(H + '/api/activity?path=/projectmap', { headers: jar() })).json();
  ok('activiteitenfeed registreert acties in de map',
    Array.isArray(act.activity) && act2.activity.some((a) => a.path === '/projectmap/doc.txt'));

  // 65. Publieke status + webhook-wachtrij + certificaat-endpoints.
  const pubStatus = await (await fetch(H + '/api/status-public')).json();
  const { processQueue } = await import('../src/webhook-queue.js');
  await processQueue();
  const wh = await (await fetch(H + '/api/admin/webhooks', { headers: jar() })).json();
  const cert = await (await fetch(H + '/api/admin/cert', { headers: jar() })).json();
  ok('status/webhook-log/cert-endpoints werken',
    pubStatus.status === 'ok' && typeof wh.queued === 'number' && Array.isArray(wh.log) && cert.enabled === false);

  // 66. Per-deellink snelheidslimiet wordt opgeslagen.
  const limShare = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/rangefile.txt', maxKbps: 500 }) })).json();
  const limDl = await fetch(H + limShare.url);
  ok('deel-link met snelheidslimiet levert bestand', limDl.status === 200 && (await limDl.text()) === 'ABCDEFGHIJ');

  // 67. tailLines leest efficiënt alleen de laatste regels van een bestand.
  {
    const { tailLines } = await import('../src/audit.js');
    const tf = path.join(tmp, 'tail-test.log');
    const many = Array.from({ length: 5000 }, (_, i) => `regel-${i}`).join('\n') + '\n';
    fs.writeFileSync(tf, many);
    const last3 = tailLines(tf, 3);
    ok('tailLines geeft de laatste N regels', last3.length === 3 && last3[2] === 'regel-4999' && last3[0] === 'regel-4997');
    // Ook met een kleine maxBytes (dwingt gedeeltelijke-eerste-regel-afhandeling af).
    const capped = tailLines(tf, 10000, 40);
    ok('tailLines respecteert maxBytes en dropt halve eerste regel',
      capped.length > 0 && capped[capped.length - 1] === 'regel-4999' && capped.every((l) => /^regel-\d+$/.test(l)));
  }

  // 68. dirSize-cache: invalidatie levert verse grootte na wijziging.
  {
    const { dirSize, invalidateDirSize } = await import('../src/paths.js');
    const dd = path.join(tmp, 'sizecache');
    fs.mkdirSync(dd, { recursive: true });
    fs.writeFileSync(path.join(dd, 'a.bin'), Buffer.alloc(1000));
    const s1 = dirSize(dd);
    fs.writeFileSync(path.join(dd, 'b.bin'), Buffer.alloc(500));
    const sCached = dirSize(dd); // nog uit cache (binnen TTL) -> ongewijzigd
    invalidateDirSize(dd);
    const sFresh = dirSize(dd);  // na invalidatie -> vers
    ok('dirSize cachet en invalideert correct', s1 === 1000 && sCached === 1000 && sFresh === 1500);
  }

  // 69. JSON-cache: writeJson maakt de wijziging direct zichtbaar via readJson.
  {
    const { readJson, writeJson } = await import('../src/jsoncache.js');
    const jf = path.join(tmp, 'cache-test.json');
    writeJson(jf, { n: 1 });
    const r1 = readJson(jf, {});
    writeJson(jf, { n: 2 });
    const r2 = readJson(jf, {});
    ok('jsoncache leest de laatst geschreven waarde', r1.n === 1 && r2.n === 2);
  }

  console.log(`\n${passed} tests geslaagd.`);
  web.close(); sftp.close();
  process.exit(0);
} catch (err) {
  console.error('\nTEST MISLUKT:', err.message);
  web.close(); sftp.close();
  process.exit(1);
}
