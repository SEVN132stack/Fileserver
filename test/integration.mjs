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
  const rc = await fetch(H + '/api/reset/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: rtok, password: 'ronieuw' }) });
  cookie = ''; const roLogin = await login('ro', 'ronieuw');
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
  const met = await (await fetch(H + '/metrics', { headers: jar() })).text();
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
  const afterRel = await (await fetch(H + '/api/list', { headers: jar() })).json();
  ok('quarantaine vrijgeven zet bestand terug', rel.status === 200 && afterRel.items.some((i) => i.name === 'virus.txt'));

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
  const sh = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/ver.txt' }) })).json();
  await fetch(H + sh.url);
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

  console.log(`\n${passed} tests geslaagd.`);
  web.close(); sftp.close();
  process.exit(0);
} catch (err) {
  console.error('\nTEST MISLUKT:', err.message);
  web.close(); sftp.close();
  process.exit(1);
}
