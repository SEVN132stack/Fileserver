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
process.env.LINKS_FILE = path.join(tmp, 'links.json');
process.env.AV_SCAN_STATE_FILE = path.join(tmp, 'av-scan-state.json');
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
process.env.LOGIN_HISTORY_FILE = path.join(tmp, 'login-history.json');
process.env.GUEST_TOKENS_FILE = path.join(tmp, 'guest-tokens.json');
process.env.RECEIPTS_FILE = path.join(tmp, 'receipts.json');
process.env.INVITES_FILE = path.join(tmp, 'invites.json');
process.env.WEBHOOK_QUEUE_FILE = path.join(tmp, 'webhook-queue.json');
process.env.SNAPSHOTS_DIR = path.join(tmp, 'snapshots');
process.env.FOLDER_INFO_FILE = path.join(tmp, 'folder-info.json');
process.env.JIT_FILE = path.join(tmp, 'jit.json');
process.env.TEAMS_FILE = path.join(tmp, 'teams.json');
process.env.TEAM_SPACES_DIR = path.join(tmp, 'teamspaces');
process.env.TEAM_SPACE_MAX_BYTES = '2000'; // kleine cap om de teamruimte-limiet te testen
process.env.REVIEWS_FILE = path.join(tmp, 'reviews.json');
process.env.SAVED_SEARCHES_FILE = path.join(tmp, 'saved-searches.json');
process.env.INBOUND_HOOKS_FILE = path.join(tmp, 'inbound-hooks.json');
process.env.LABELS_FILE = path.join(tmp, 'labels.json');
process.env.SERVER_SNAPSHOTS_DIR = path.join(tmp, 'server-snapshots');
process.env.INCIDENTS_FILE = path.join(tmp, 'incidents.json');
process.env.PINS_FILE = path.join(tmp, 'pins.json');
process.env.SIGNING_KEY_FILE = path.join(tmp, 'signing-key.json');
process.env.SIGNATURES_FILE = path.join(tmp, 'signatures.json');
process.env.TASKS_FILE = path.join(tmp, 'file-tasks.json');
process.env.VISION_FILE = path.join(tmp, 'vision-index.json');
// AI_CMD/VISION_CMD: 'cat' echoot stdin (AI) resp. negeert input; voor de vision-test
// zetten we een klein node-commando dat vaste labels als JSON teruggeeft.
process.env.AI_CMD = 'cat';
process.env.VISION_CMD = 'node ' + path.join(process.cwd(), 'test', 'fake-vision.mjs');
process.env.EMAIL_INBOX_FILE = path.join(tmp, 'email-inbox.json');
process.env.HOTFOLDER_DIR = path.join(tmp, 'hotfolder');
process.env.HOTFOLDER_USER = 'admin';
process.env.HOTFOLDER_INTERVAL_SEC = '3600'; // scheduler slaapt; test roept scanOnce handmatig
process.env.CHAT_BOT_TOKEN = 'testbottoken';
process.env.CHAT_BOT_USER = 'admin';
process.env.SCHEDULED_REPORTS_FILE = path.join(tmp, 'scheduled-reports.json');
process.env.TEMPLATES_FILE = path.join(tmp, 'templates.json');
process.env.LIFECYCLE_FILE = path.join(tmp, 'lifecycle.json');
process.env.SHARE_PRESETS_FILE = path.join(tmp, 'share-presets.json');
process.env.PORTALS_FILE = path.join(tmp, 'portals.json');
process.env.PORTAL_MAX_UPLOAD_BYTES = '200000'; // kleine cap om de portaal-uploadlimiet te testen
process.env.EVENT_HOOKS_FILE = path.join(tmp, 'event-hooks.json');
process.env.WEBHOOK_SUBS_FILE = path.join(tmp, 'webhook-subs.json');
process.env.COLD_STORE_MIN_BYTES = '0';
process.env.RULES_FILE = path.join(tmp, 'rules.json');
process.env.SUBSCRIPTIONS_FILE = path.join(tmp, 'subscriptions.json');
process.env.DIGEST_PREFS_FILE = path.join(tmp, 'digest-prefs.json');
process.env.ANOMALY_DL_COUNT = '3'; // lage drempel zodat de test snel triggert
process.env.BLOCKED_CIDRS = '203.0.113.0/24'; // testblok (geen localhost)
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
process.env.FTPS_PORT = '2240';
process.env.FTPS_PASV_MIN = '50600';
process.env.FTPS_PASV_MAX = '50620';
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

// Raw-capture-server voor fijnmazige webhook-abonnementen (template-payload).
const capturedRaw = [];
http.createServer((rq, rs) => {
  let b = ''; rq.on('data', (c) => (b += c)); rq.on('end', () => { capturedRaw.push({ body: b, event: rq.headers['x-fs-event'], secret: rq.headers['x-fs-secret'] }); rs.end('ok'); });
}).listen(8098);

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
const { startFtpsServer } = await import('../src/ftps.js');
const ftpsServer = await startFtpsServer();

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

  // 13am4. Security: /api/play en /api/thumb geven nooit willekeurige bestanden
  // inline terug (een geüploade .html/.svg zou anders in de app-origin draaien).
  await fetch(H + '/api/save?path=/evil.html', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: '<script>alert(1)</script>' });
  await fetch(H + '/api/save?path=/evil.svg', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' });
  const playHtml = await fetch(H + '/api/play?path=/evil.html', { headers: jar() });
  const thumbHtml = await fetch(H + '/api/thumb?path=/evil.html', { headers: jar() });
  const thumbSvg = await fetch(H + '/api/thumb?path=/evil.svg', { headers: jar() });
  ok('security: /api/play en /api/thumb serveren geen html/svg inline',
    playHtml.status === 400 && thumbHtml.status === 404 && thumbSvg.status === 404 &&
    !String(playHtml.headers.get('content-type')).includes('html') && !String(thumbSvg.headers.get('content-type')).includes('svg'));

  // 13am5. Security: chunk-upload heeft een harde limiet per chunk (geheugen) en
  // weigert ongeldige index/total.
  const bigChunk = new FormData(); bigChunk.append('chunk', new Blob([Buffer.alloc(17 * 1024 * 1024)]), 'c');
  const bigRes = await fetch(H + '/api/upload/chunk?uploadId=t1&index=0&total=1&name=x.bin&path=/', { method: 'POST', headers: jar(), body: bigChunk });
  const badIdx = new FormData(); badIdx.append('chunk', new Blob(['x']), 'c');
  const badRes = await fetch(H + '/api/upload/chunk?uploadId=t2&index=5&total=2&name=y.bin&path=/', { method: 'POST', headers: jar(), body: badIdx });
  ok('security: chunk te groot (413) en ongeldige index (400) geweigerd', bigRes.status === 413 && badRes.status === 400);

  // 13am6. Interne links (/o/<uuid>): stabiel, alleen voor de eigenaar, volgen
  // hernoemen via de web-app én buiten de web-app om (SFTP/WebDAV-haak).
  const mkLink = (p) => fetch(H + '/api/link', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: p }) }).then((r) => r.json());
  const il1 = await mkLink('/perma-nieuw.txt'); const il2 = await mkLink('/perma-nieuw.txt');
  const ilRes = await (await fetch(H + '/api/link/' + il1.uuid, { headers: jar() })).json();
  const oRedirect = await fetch(H + '/o/' + il1.uuid, { redirect: 'manual' });
  const { linksMoved } = await import('../src/link-hooks.js');
  const { homeDir: hd } = await import('../src/users.js');
  fs.renameSync(path.join(hd('admin'), 'perma-nieuw.txt'), path.join(hd('admin'), 'perma-sftp.txt'));
  linksMoved('admin', hd('admin'), path.join(hd('admin'), 'perma-nieuw.txt'), path.join(hd('admin'), 'perma-sftp.txt'));
  const ilMoved = await (await fetch(H + '/api/link/' + il1.uuid, { headers: jar() })).json();
  const noAuth = await fetch(H + '/api/link/' + il1.uuid);
  ok('interne link: stabiel, /o/ verwijst door, volgt hernoemen buiten de app, vereist login',
    il1.uuid && il1.uuid === il2.uuid && ilRes.path === '/perma-nieuw.txt' && ilRes.isDir === false &&
    oRedirect.status === 302 && oRedirect.headers.get('location') === '/?open=' + il1.uuid &&
    ilMoved.path === '/perma-sftp.txt' && noAuth.status === 401);

  // 13am7. WOPI (Collabora): token vereist, intrekbaar; opslaan bewaart een versie.
  {
    const w = await import('../src/wopi.js');
    const abs = path.join(hd('admin'), 'perma-sftp.txt');
    const id = w.fileId(abs);
    const { token } = w.makeToken({ user: 'admin', path: '/perma-sftp.txt', write: true, id });
    const info = await (await fetch(`${H}/wopi/files/${id}?access_token=${encodeURIComponent(token)}`)).json();
    const bad = await fetch(`${H}/wopi/files/${id}?access_token=${encodeURIComponent(token.slice(0, -3) + 'abc')}`);
    const put = await fetch(`${H}/wopi/files/${id}/contents?access_token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'X-WOPI-Override': 'PUT' }, body: 'via-office' });
    const after = fs.readFileSync(abs, 'utf8');
    const vers = await (await fetch(H + '/api/versions?path=/perma-sftp.txt', { headers: jar() })).json().catch(() => ({}));
    await new Promise((r) => setTimeout(r, 5));
    w.revokeUser('admin');
    const revoked = await fetch(`${H}/wopi/files/${id}?access_token=${encodeURIComponent(token)}`);
    ok('WOPI: CheckFileInfo/PutFile met token, vervalst en ingetrokken token geweigerd, versie bewaard',
      info.BaseFileName === 'perma-sftp.txt' && info.UserCanWrite === true && bad.status === 401 &&
      put.status === 200 && after === 'via-office' && revoked.status === 401 &&
      Array.isArray(vers.versions) && vers.versions.length >= 1);
  }

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

  // 70. Gzip-compressie op tekstuele responses; hervatbare (206) download blijft correct.
  // (fetch/undici decomprimeert gzip transparant, dus we toetsen op de Vary-signatuur
  //  die de compression-middleware zet wanneer de filter aanslaat.)
  {
    const listResp = await fetch(H + '/api/list?path=/', { headers: jar({ 'Accept-Encoding': 'gzip' }) });
    await listResp.text();
    ok('tekstuele response is compressie-onderhevig (Vary: Accept-Encoding)',
      String(listResp.headers.get('vary') || '').toLowerCase().includes('accept-encoding'));
    const rangeResp = await fetch(H + '/api/download?path=/rangefile.txt', { headers: jar({ 'Accept-Encoding': 'gzip', Range: 'bytes=0-3' }) });
    const rangeBody = await rangeResp.text();
    ok('Range-download levert nog steeds 206 + juiste bytes onder compressie',
      rangeResp.status === 206 && rangeBody === 'ABCD');
  }

  // 71. Geo-/IP-blokkering: CIDR-match werkt, localhost niet geblokkeerd.
  {
    const { isBlockedIp, blockReason } = await import('../src/geoblock.js');
    ok('geoblock: IP in geblokkeerd CIDR wordt herkend',
      isBlockedIp('203.0.113.5') === true && isBlockedIp('127.0.0.1') === false && blockReason('203.0.113.5') === 'ip');
  }

  // 72. Just-in-time toegang: verzoek -> goedkeuren -> effectieve rol verhoogd -> vervalt.
  {
    const jitm = await import('../src/jit.js');
    const r = jitm.requestElevation('jituser', 'admin', 'incident #42', 1);
    ok('JIT: effectieve rol vóór goedkeuring is ongewijzigd', jitm.effectiveRole('jituser', 'user') === 'user');
    const dec = jitm.decide(r.id, 'admin', true);
    ok('JIT: na goedkeuring is de rol tijdelijk verhoogd',
      dec.status === 'approved' && dec.until > Date.now() && jitm.effectiveRole('jituser', 'user') === 'admin');
    const denied = jitm.decide(r.id, 'admin', true); // al besloten
    ok('JIT: een al-besloten verzoek kan niet opnieuw', denied === null);
  }

  // 73. Anomalie-detectie: boven de drempel wordt het venster gemarkeerd.
  {
    const anom = await import('../src/anomaly.js');
    for (let i = 0; i < 4; i++) anom.recordDownload('exfiluser', 1000); // drempel = 3
    const w = anom.windowFor('exfiluser');
    ok('anomalie: venster wordt gealarmeerd boven de drempel', w && w.count === 4 && w.alerted === true);
  }

  // 74. JIT-status-endpoint reflecteert een actieve verhoging.
  {
    const jitm = await import('../src/jit.js');
    // admin heeft geen verhoging nodig; controleer het endpoint-contract voor admin.
    const st = await (await fetch(H + '/api/jit/status', { headers: jar() })).json();
    ok('JIT-status-endpoint levert effectieve rol', st.effectiveRole === 'admin' && ('elevation' in st));
  }

  // 75. Versie-diff-weergave.
  {
    await fetch(H + '/api/save?path=/diff.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'A\nB\nC' });
    await fetch(H + '/api/save?path=/diff.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'A\nX\nC\nD' });
    const vs = await (await fetch(H + '/api/versions?path=/diff.txt', { headers: jar() })).json();
    ok('versie aangemaakt vóór overschrijven', vs.versions.length >= 1);
    const dif = await (await fetch(H + `/api/version/diff?path=/diff.txt&version=${vs.versions[0].version}`, { headers: jar() })).json();
    ok('versie-diff telt toevoegingen/verwijderingen', dif.stat.added === 2 && dif.stat.removed === 1);
  }

  // 76. Goedkeuringsworkflow.
  {
    await fetch(H + '/api/review', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/diff.txt', note: 'graag review' }) });
    const pend = await (await fetch(H + '/api/review?path=/diff.txt', { headers: jar() })).json();
    const dec = await (await fetch(H + '/api/review/decide', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/diff.txt', approve: true }) })).json();
    ok('review: pending -> approved', pend.review.status === 'pending' && dec.review.status === 'approved');
  }

  // 77. Teamruimte: aanmaken, uploaden, listen, downloaden (maker = team-admin).
  {
    const t = await (await fetch(H + '/api/teams', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'Alfa' }) })).json();
    const tid = t.team.id;
    const tfd = new FormData(); tfd.append('file', new Blob(['teamdata\n']), 'team.txt');
    await fetch(H + `/api/teams/${tid}/upload?path=/`, { method: 'POST', headers: jar(), body: tfd });
    const tl = await (await fetch(H + `/api/teams/${tid}/list?path=/`, { headers: jar() })).json();
    const dl = await fetch(H + `/api/teams/${tid}/download?path=/team.txt`, { headers: jar() });
    ok('teamruimte: upload + list + download werkt',
      tl.role === 'admin' && tl.items.some((i) => i.name === 'team.txt') && dl.status === 200 && (await dl.text()) === 'teamdata\n');

    // 78. Rolgebaseerde toegang: viewer mag lezen maar niet schrijven.
    await fetch(H + `/api/teams/${tid}/members`, { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ user: 'bob', role: 'viewer' }) });
    const teamsMod = await import('../src/teams.js');
    const team = teamsMod.getTeam(tid);
    ok('team-rollen: viewer kan lezen maar niet schrijven',
      teamsMod.canRead(team, 'bob') === true && teamsMod.canWrite(team, 'bob') === false && teamsMod.isTeamAdmin(team, 'admin') === true);
  }

  // 79. Volledige-tekst-zoeken in kantoordocumenten (docx-inhoud in de index).
  {
    const si = await import('../src/searchindex.js');
    si.buildIndex(); // storage bevat admin/doc.docx met "Hallo officewereld"
    const hits = si.query('admin', 'officewereld');
    ok('office-inhoud doorzoekbaar via de index', hits.some((p) => p.includes('doc.docx')));
  }

  // 80. Opgeslagen zoekopdrachten: toevoegen, tonen, verwijderen.
  {
    const add = await (await fetch(H + '/api/saved-searches', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'Facturen', query: 'factuur', content: true }) })).json();
    const listed = await (await fetch(H + '/api/saved-searches', { headers: jar() })).json();
    const del = await (await fetch(H + '/api/saved-searches/' + add.search.id, { method: 'DELETE', headers: jar() })).json();
    const after = await (await fetch(H + '/api/saved-searches', { headers: jar() })).json();
    ok('opgeslagen zoekopdracht toevoegen/tonen/verwijderen',
      add.ok && listed.searches.some((s) => s.name === 'Facturen') && del.ok && after.searches.length === 0);
  }

  // 81. Analytics-overzicht (admin).
  {
    const an = await (await fetch(H + '/api/admin/report/analytics?days=30', { headers: jar() })).json();
    ok('analytics levert acties + top-gebruikers + tijdlijn',
      typeof an.total === 'number' && an.byAction && typeof an.byAction === 'object' && Array.isArray(an.topUsers) && an.timeline);
  }

  // 82. Duplicaten-dashboard: identieke bestanden worden als groep herkend.
  {
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'dupA.txt'), 'zelfde inhoud hier');
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'dupB.txt'), 'zelfde inhoud hier');
    const dup = await (await fetch(H + '/api/duplicates', { headers: jar() })).json();
    ok('duplicaten-dashboard groepeert identieke bestanden',
      dup.groups.some((g) => g.paths.some((p) => p.includes('dupA.txt')) && g.paths.some((p) => p.includes('dupB.txt'))));
  }

  // 83. Inkomende webhook / API-trigger: admin maakt hook, publieke POST voert actie uit.
  {
    const created = await (await fetch(H + '/api/admin/hooks', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ action: 'reindex', label: 'CI' }) })).json();
    const fire = await fetch(H + '/api/hooks/' + created.hook.token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const fr = await fire.json();
    const bad = await fetch(H + '/api/hooks/ih_bestaatniet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    ok('inkomende hook: aanmaken + publiek uitvoeren + onbekende = 404',
      created.hook.token.startsWith('ih_') && fire.status === 200 && fr.ok === true && bad.status === 404);
  }

  // 84. Integratie-recepten worden geleverd.
  {
    const rec = await (await fetch(H + '/api/integrations/recipes', { headers: jar() })).json();
    ok('integratie-recepten (Zapier/Make) beschikbaar',
      Array.isArray(rec.recipes) && rec.recipes.length >= 1 && Array.isArray(rec.actions) && rec.actions.includes('reindex'));
  }

  // 85. Bulk-tagging + tag-galerij.
  {
    await fetch(H + '/api/save?path=/tagme1.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'x' });
    await fetch(H + '/api/save?path=/tagme2.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'y' });
    const bt = await (await fetch(H + '/api/bulk-tag', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ paths: ['/tagme1.txt', '/tagme2.txt'], tag: 'project-x' }) })).json();
    const gal = await (await fetch(H + '/api/by-tag?tag=project-x', { headers: jar() })).json();
    ok('bulk-tag + tag-galerij',
      bt.changed === 2 && gal.paths.includes('/tagme1.txt') && gal.paths.includes('/tagme2.txt'));
  }

  // 86. Publieke galerij van een gedeelde afbeeldingsmap.
  {
    fs.mkdirSync(path.join(config.storageDir, 'admin', 'fotos'), { recursive: true });
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'fotos', 'a.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
    const sh = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/fotos' }) })).json();
    const token = sh.url.split('/').pop();
    const g = await (await fetch(H + '/api/s/' + token + '/gallery')).json();
    const raw = await fetch(H + '/api/s/' + token + '/raw?file=a.png');
    ok('publieke galerij toont afbeeldingen van gedeelde map',
      g.images.includes('a.png') && raw.status === 200);
  }

  // 87. Teamruimte-groottecap wordt gehandhaafd (security-hardening).
  {
    const t = await (await fetch(H + '/api/teams', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'CapTeam' }) })).json();
    const tid = t.team.id;
    const big = new FormData(); big.append('file', new Blob(['x'.repeat(5000)]), 'big.bin'); // > 2000 byte cap
    const up = await fetch(H + `/api/teams/${tid}/upload?path=/`, { method: 'POST', headers: jar(), body: big });
    ok('teamruimte-groottecap weigert te grote upload (413)', up.status === 413);
  }

  // 88. Classificatielabels: vertrouwelijk bestand mag niet publiek gedeeld worden.
  {
    await fetch(H + '/api/save?path=/geheim.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'topsecret' });
    const set = await (await fetch(H + '/api/label', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/geheim.txt', label: 'vertrouwelijk' }) })).json();
    const blocked = await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/geheim.txt' }) });
    // Openbaar bestand mag wél.
    const okShare = await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/a.txt' }) });
    ok('classificatie blokkeert publiek delen van vertrouwelijk bestand',
      set.label === 'vertrouwelijk' && blocked.status === 403 && okShare.status === 200);
  }

  // 89. Vertrouwde apparaten: eerste apparaat vertrouwd, module trust/forget werkt.
  {
    const um = await import('../src/users.js');
    um.addUser({ username: 'deviceuser', password: 'devpass123', role: 'user' }); // verse gebruiker, nog geen apparaten
    const r1 = um.recordDevice('deviceuser', { id: 'devA', ua: 'UA1', ip: '10.0.0.1' }); // eerste = bootstrap-trusted
    const r2 = um.recordDevice('deviceuser', { id: 'devB', ua: 'UA2', ip: '10.0.0.2' }); // tweede = niet vertrouwd
    const trusted = um.trustDevice('deviceuser', 'devB', true);
    ok('vertrouwde apparaten: bootstrap-trust + trust/forget',
      r1.trusted === true && r2.trusted === false && trusted === true && um.isTrustedDevice('deviceuser', 'devB') === true && um.forgetDevice('deviceuser', 'devB') === true);
  }

  // 90. Sessie-forensics levert sessies + IP-historie.
  {
    const fo = await (await fetch(H + '/api/session-forensics', { headers: jar() })).json();
    ok('sessie-forensics levert sessies + ip-historie',
      Array.isArray(fo.sessions) && Array.isArray(fo.ipHistory) && Array.isArray(fo.recent) && ('geoJump' in fo));
  }

  // 91. Brandbare brievenbus: drop-link vervalt na de eerste aanlevering.
  {
    const box = await (await fetch(H + '/api/droplink', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/inbox', burn: true }) })).json();
    const f1 = new FormData(); f1.append('files', new Blob(['eenmalig']), 'burn.txt');
    const u1 = await fetch(H + box.url + '/upload', { method: 'POST', body: f1 });
    const again = await fetch(H + box.url); // link is nu verbrand
    ok('brandbare brievenbus vervalt na eerste upload', u1.status === 200 && again.status === 404);
  }

  // 92. WebDAV LOCK/UNLOCK werken (nodig voor Windows/macOS-mounts).
  {
    const davAuth2 = { Authorization: 'Basic ' + Buffer.from('admin:testpass123b').toString('base64') };
    await fetch(H + '/webdav/lockme.txt', { method: 'PUT', headers: davAuth2, body: 'inhoud' });
    const lock = await fetch(H + '/webdav/lockme.txt', { method: 'LOCK', headers: davAuth2 });
    const lockTok = lock.headers.get('lock-token');
    const unlock = await fetch(H + '/webdav/lockme.txt', { method: 'UNLOCK', headers: { ...davAuth2, 'Lock-Token': lockTok || '' } });
    ok('WebDAV LOCK levert token + UNLOCK slaagt', lock.status === 200 && !!lockTok && unlock.status === 204);
  }

  // 93. WebDAV ETag + If-None-Match -> 304 (property-caching).
  {
    const davAuth3 = { Authorization: 'Basic ' + Buffer.from('admin:testpass123b').toString('base64') };
    const g1 = await fetch(H + '/webdav/lockme.txt', { headers: davAuth3 });
    const etag = g1.headers.get('etag');
    const g2 = await fetch(H + '/webdav/lockme.txt', { headers: { ...davAuth3, 'If-None-Match': etag || '' } });
    ok('WebDAV ETag + If-None-Match levert 304', !!etag && g2.status === 304);
  }

  // 94. Slimme naamgeving-suggestie op basis van de eerste kop.
  {
    await fetch(H + '/api/save?path=/naamloos.md', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: '# Jaarverslag 2025\n\nInhoud...' });
    const s = await (await fetch(H + '/api/rename-suggestion?path=/naamloos.md', { headers: jar() })).json();
    ok('naamgeving-suggestie uit de eerste kop', s.suggestion === 'jaarverslag-2025.md');
  }

  // 95. Regelgebaseerde automatisering: tag-regel wordt bij upload toegepast.
  {
    await fetch(H + '/api/mkdir', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/', name: 'autorules' }) });
    await fetch(H + '/api/rules', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefix: '/autorules', ext: '.txt', action: 'tag', arg: 'auto-regel' }) });
    const rfd = new FormData(); rfd.append('files', new Blob(['x']), 'ruled.txt');
    await fetch(H + '/api/upload?path=/autorules', { method: 'POST', headers: jar(), body: rfd });
    const byTag = await (await fetch(H + '/api/by-tag?tag=auto-regel', { headers: jar() })).json();
    ok('automatiseringsregel tagt geüpload bestand', (byTag.paths || []).includes('/autorules/ruled.txt'));
  }

  // 96. Map-abonnement: drop-upload in een gevolgde map levert een melding.
  {
    await fetch(H + '/api/subscriptions', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefix: '/inbox' }) });
    const box = await (await fetch(H + '/api/droplink', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/inbox' }) })).json();
    const bfd = new FormData(); bfd.append('files', new Blob(['sub']), 'sub.txt');
    await fetch(H + box.url + '/upload', { method: 'POST', body: bfd });
    const notifs = await (await fetch(H + '/api/notifications', { headers: jar() })).json();
    ok('map-abonnement geeft melding bij wijziging',
      (notifs.notifications || notifs.items || []).some((n) => (n.title || '').includes('gevolgde map')));
  }

  // 97. Digest-notificaties (module): verzamelen + verzenden.
  {
    const dg = await import('../src/digest.js');
    const um2 = await import('../src/users.js');
    um2.addUser({ username: 'digestuser', password: 'digestpw123', role: 'user' });
    dg.setFrequency('digestuser', 'daily');
    dg.recordForDigest('digestuser', 'test-gebeurtenis');
    const sent = await dg.sendDueDigests();
    ok('digest verzamelt en verstuurt een samenvatting', sent >= 1);
  }

  // 98. Classificatiebeleid geldt ook voor permalinks (security-review fix).
  {
    await fetch(H + '/api/save?path=/vertrouwelijk.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'intern' });
    await fetch(H + '/api/label', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/vertrouwelijk.txt', label: 'geheim' }) });
    const perma = await fetch(H + '/api/permalink', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/vertrouwelijk.txt' }) });
    const permaOk = await fetch(H + '/api/permalink', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/a.txt' }) });
    ok('permalink respecteert classificatie (geheim = 403, openbaar = ok)', perma.status === 403 && permaOk.status === 200);
  }

  // 99. Beeldbewerker: roteren via sharp levert een nieuw, geldig bestand.
  {
    const { default: sharp } = await import('sharp');
    const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'foto.png'), png);
    const r = await (await fetch(H + '/api/image/transform', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/foto.png', ops: { rotate: 90 } }) })).json();
    const outAbs = path.join(config.storageDir, 'admin', 'foto-bewerkt.png');
    const meta = fs.existsSync(outAbs) ? await sharp(outAbs).metadata() : {};
    ok('beeldbewerker roteert (40x20 -> 20x40)', r.ok && meta.width === 20 && meta.height === 40);
  }

  // 100. PDF-bewerker: merge + split via pdf-lib.
  {
    const { PDFDocument } = await import('pdf-lib');
    const mk = async (n) => { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) d.addPage([200, 200]); return Buffer.from(await d.save()); };
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'p1.pdf'), await mk(2));
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'p2.pdf'), await mk(3));
    const merged = await (await fetch(H + '/api/pdf/merge', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ paths: ['/p1.pdf', '/p2.pdf'], dest: '/merged.pdf' }) })).json();
    const mAbs = path.join(config.storageDir, 'admin', 'merged.pdf');
    const mCount = fs.existsSync(mAbs) ? (await PDFDocument.load(fs.readFileSync(mAbs))).getPageCount() : 0;
    const split = await (await fetch(H + '/api/pdf/split', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/merged.pdf', ranges: '1-2', dest: '/sel.pdf' }) })).json();
    const sAbs = path.join(config.storageDir, 'admin', 'sel.pdf');
    const sCount = fs.existsSync(sAbs) ? (await PDFDocument.load(fs.readFileSync(sAbs))).getPageCount() : 0;
    ok('PDF merge (2+3=5) + split (1-2=2)', merged.ok && mCount === 5 && split.ok && sCount === 2);
  }

  // 101. Transcode/transcriptie geven 501 als de externe tool uit staat.
  {
    const tc = await fetch(H + '/api/transcode', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/clip.mp4' }) });
    const tr = await fetch(H + '/api/transcribe', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/clip.mp4' }) });
    ok('transcode/transcriptie: nette 501 zonder ffmpeg/whisper', tc.status === 501 && tr.status === 501);
  }

  // 102. Compressie-at-rest: koud bestand wordt gecomprimeerd + transparant gedownload.
  {
    const cs = await import('../src/coldstore.js');
    const coldAbs = path.join(config.storageDir, 'admin', 'koud.txt');
    fs.writeFileSync(coldAbs, 'x'.repeat(5000));
    const old = Date.now() / 1000 - 400 * 86400; // ~400 dagen oud
    fs.utimesSync(coldAbs, old, old);
    const r = cs.compressCold(path.join(config.storageDir, 'admin'), 30, 0);
    const gzExists = fs.existsSync(coldAbs + '.gz') && !fs.existsSync(coldAbs);
    const dl = await fetch(H + '/api/download?path=/koud.txt', { headers: jar() });
    const body = await dl.text();
    ok('compressie-at-rest: comprimeert + transparante download', r.compressed === 1 && gzExists && dl.status === 200 && body === 'x'.repeat(5000));
  }

  // 103. Server-brede point-in-time snapshot: herstel zet verwijderd bestand terug.
  {
    const snap = await (await fetch(H + '/api/admin/server-snapshots', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ label: 'test' }) })).json();
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'na-snapshot.txt'), 'nieuw'); // niet in snapshot
    fs.rmSync(path.join(config.storageDir, 'admin', 'a.txt'), { force: true });          // wel in snapshot
    const restore = await (await fetch(H + `/api/admin/server-snapshots/${snap.id}/restore`, { method: 'POST', headers: jar() })).json();
    ok('point-in-time herstel zet de opslag terug',
      snap.id && restore.ok && fs.existsSync(path.join(config.storageDir, 'admin', 'a.txt')));
  }

  // 104. Zelftest/chaos-knop levert een rapport.
  {
    const st = await (await fetch(H + '/api/admin/selftest', { method: 'POST', headers: jar() })).json();
    ok('zelftest levert rapport (backup/restore/integriteit)',
      'ok' in st && st.backup && st.restore && st.integrity);
  }

  // 105. Statuspagina: incident verschijnt publiek en verdwijnt na oplossen.
  {
    const inc = await (await fetch(H + '/api/admin/incidents', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ title: 'Testincident', severity: 'major' }) })).json();
    const pub1 = await (await fetch(H + '/api/status-public')).json();
    await fetch(H + `/api/admin/incidents/${inc.incident.id}/resolve`, { method: 'POST', headers: jar() });
    const pub2 = await (await fetch(H + '/api/status-public')).json();
    ok('statuspagina toont open incident en werkt bij na oplossen',
      pub1.openIncidents.some((i) => i.id === inc.incident.id) && pub1.state === 'storing' &&
      !pub2.openIncidents.some((i) => i.id === inc.incident.id));
  }

  // 106. OpenAPI-spec (achter auth) + API-docs-schil.
  {
    const anon = await fetch(H + '/api/openapi.json'); // zonder auth -> geweigerd
    const spec = await (await fetch(H + '/api/openapi.json', { headers: jar() })).json();
    const docs = await fetch(H + '/docs');
    ok('OpenAPI-spec achter auth + /docs beschikbaar',
      anon.status === 401 && spec.openapi === '3.0.3' && spec.paths['/api/list'] && spec.info.title.includes('Fileserver') && docs.status === 200);
  }

  // 107. Fijnmazige webhook-abonnement met filter + payload-template.
  {
    await (await fetch(H + '/api/admin/webhook-subs', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ url: 'http://localhost:8098/wh', events: ['upload'], template: 'nieuw: {{path}} door {{user}}', secret: 's3cr3t' }) })).json();
    const wfd = new FormData(); wfd.append('files', new Blob(['x']), 'evt.txt');
    await fetch(H + '/api/upload?path=/', { method: 'POST', headers: jar(), body: wfd });
    await new Promise((r) => setTimeout(r, 500));
    const hit = capturedRaw.find((c) => c.event === 'upload' && c.body.includes('nieuw:'));
    ok('webhook-abonnement levert gefilterde, getemplate payload', !!hit && hit.secret === 's3cr3t' && hit.body.includes('door admin'));
  }

  // 108. Plugin-/eventhooks: beheer werkt; standaard uitgeschakeld.
  {
    const add = await (await fetch(H + '/api/admin/eventhooks', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ event: 'upload', command: 'echo hoi', label: 'test' }) })).json();
    const list = await (await fetch(H + '/api/admin/eventhooks', { headers: jar() })).json();
    ok('eventhooks: aanmaken + lijst + standaard uit',
      add.ok && list.hooks.some((h) => h.id === add.hook.id) && list.enabled === false && list.events.includes('upload'));
  }

  // 109. Vastgezette mappen (dashboard-snelkoppelingen).
  {
    const add = await (await fetch(H + '/api/pins', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/projectmap' }) })).json();
    const list = await (await fetch(H + '/api/pins', { headers: jar() })).json();
    const del = await (await fetch(H + '/api/pins', { method: 'DELETE', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/projectmap' }) })).json();
    const after = await (await fetch(H + '/api/pins', { headers: jar() })).json();
    ok('vastgezette mappen toevoegen/tonen/losmaken',
      add.ok && list.pins.includes('/projectmap') && del.ok && !after.pins.includes('/projectmap'));
  }

  // 110. Digitale ondertekening: teken -> geldig+ongewijzigd; na wijziging -> ongewijzigd=false.
  {
    await fetch(H + '/api/save?path=/contract.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'akkoord' });
    const sign = await (await fetch(H + '/api/sign', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/contract.txt' }) })).json();
    const v1 = await (await fetch(H + '/api/verify?path=/contract.txt', { headers: jar() })).json();
    await fetch(H + '/api/save?path=/contract.txt', { method: 'POST', headers: jar({ 'Content-Type': 'text/plain' }), body: 'GEWIJZIGD' });
    const v2 = await (await fetch(H + '/api/verify?path=/contract.txt', { headers: jar() })).json();
    ok('digitale ondertekening: geldig + wijziging gedetecteerd',
      sign.ok && v1.results[0].valid === true && v1.results[0].unchanged === true && v2.results[0].valid === true && v2.results[0].unchanged === false);
  }

  // 111. Shredder: veilig verwijderen slaat de prullenbak over en wist het bestand.
  {
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'geheim.txt'), 'wis mij');
    await fetch(H + '/api/delete', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/geheim.txt', shred: true }) });
    const gone = !fs.existsSync(path.join(config.storageDir, 'admin', 'geheim.txt'));
    const trash = await (await fetch(H + '/api/trash', { headers: jar() })).json();
    ok('shredder verwijdert veilig (weg + niet in prullenbak)',
      gone && !(trash.items || []).some((i) => i.path.includes('geheim.txt')));
  }

  // 112. @-vermelding in een reactie levert een notificatie bij de genoemde gebruiker.
  {
    const adminCookie = cookie;
    addUser({ username: 'mentionee', password: 'mentionpw123', role: 'user' }); // verse gebruiker, geen 2FA
    await fetch(H + '/api/comments', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/a.txt', text: 'kijk hier @mentionee even naar' }) });
    cookie = ''; await login('mentionee', 'mentionpw123');
    const notifs = await (await fetch(H + '/api/notifications', { headers: jar() })).json();
    ok('@-vermelding notificeert de genoemde gebruiker',
      (notifs.notifications || notifs.items || []).some((n) => (n.title || '').includes('genoemd')));
    cookie = adminCookie; // admin-sessie herstellen
  }

  // 113. Taken op bestanden: aanmaken, toewijzen, status wijzigen.
  {
    const t = await (await fetch(H + '/api/file-tasks', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/a.txt', title: 'Controleer dit', assignee: 'admin' }) })).json();
    const st = await (await fetch(H + `/api/file-tasks/${t.task.id}/status`, { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ status: 'klaar' }) })).json();
    const list = await (await fetch(H + '/api/file-tasks', { headers: jar() })).json();
    ok('taken op bestanden: aanmaken + status wijzigen',
      t.ok && st.task.status === 'klaar' && list.tasks.some((x) => x.id === t.task.id));
  }

  // 114. AI-assistent: vraag gaat naar AI_CMD ('cat') dat de prompt echoot.
  {
    const r = await (await fetch(H + '/api/ai/ask', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ question: 'Wat is dit?' }) })).json();
    ok('AI-assistent geeft antwoord via extern commando',
      typeof r.answer === 'string' && r.answer.includes('Wat is dit?'));
  }

  // 115. Beeldherkenning: analyseer een afbeelding en zoek erop via de labels.
  {
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'foto.jpg'), 'nep-jpg');
    const det = await (await fetch(H + '/api/vision/detect', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/foto.jpg' }) })).json();
    const found = await (await fetch(H + '/api/vision/search?label=kat', { headers: jar() })).json();
    ok('beeldherkenning: labels toekennen + erop zoeken',
      det.ok && det.labels.includes('kat') && (found.files || []).includes('/foto.jpg'));
  }

  // 116. Mapstructuur-suggestie: groepeer per type en pas de verplaatsingen toe.
  {
    const od = path.join(config.storageDir, 'admin', 'rommel');
    fs.mkdirSync(od, { recursive: true });
    for (const n of ['a.pdf', 'b.pdf', 'c.jpg', 'd.jpg']) fs.writeFileSync(path.join(od, n), 'x');
    const sug = await (await fetch(H + '/api/organize/suggest?path=/rommel&mode=type', { headers: jar() })).json();
    const ap = await (await fetch(H + '/api/organize/apply', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ moves: sug.moves }) })).json();
    const movedPdf = fs.existsSync(path.join(od, 'Documenten', 'a.pdf'));
    const movedImg = fs.existsSync(path.join(od, 'Afbeeldingen', 'c.jpg'));
    ok('mapstructuur-suggestie: groeperen per type + toepassen',
      sug.moves.length === 4 && ap.moved === 4 && movedPdf && movedImg);
  }

  // 117. Upload via e-mail: token aanmaken en een geparste mail met bijlage afleveren.
  {
    const tok = (await (await fetch(H + '/api/email/token', { method: 'POST', headers: jar() })).json()).token;
    const b64 = Buffer.from('hallo per mail').toString('base64');
    const del = await (await fetch(H + '/api/email-inbox/' + tok, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: 'test', attachments: [{ filename: 'brief.txt', contentBase64: b64 }] }) })).json();
    const landed = fs.existsSync(path.join(config.storageDir, 'admin', config.emailInboxDir, 'brief.txt'));
    ok('upload via e-mail: bijlage belandt in de inbox',
      !!tok && del.ok && del.saved.includes('brief.txt') && landed);
  }

  // 118. Hot-folder: leg een bestand in de host-map en importeer het via een scan.
  {
    fs.mkdirSync(process.env.HOTFOLDER_DIR, { recursive: true });
    const f = path.join(process.env.HOTFOLDER_DIR, 'scan001.txt');
    fs.writeFileSync(f, 'ingescand document');
    fs.utimesSync(f, new Date(Date.now() - 5000), new Date(Date.now() - 5000)); // ouder dan 2s
    const r = await (await fetch(H + '/api/hotfolder/scan', { method: 'POST', headers: jar() })).json();
    const imported = fs.existsSync(path.join(config.storageDir, 'admin', config.hotfolderTarget, 'scan001.txt'));
    const gone = !fs.existsSync(f);
    ok('hot-folder: bestand geïmporteerd en uit de bronmap gehaald',
      r.ok && r.imported.includes('scan001.txt') && imported && gone);
  }

  // 119. Chat-bot: commando met token levert een tekstantwoord (list).
  {
    const bad = await fetch(H + '/api/chat/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'list /' }) });
    const good = await (await fetch(H + '/api/chat/command', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bot-Token': 'testbottoken' }, body: JSON.stringify({ text: 'list /' }) })).json();
    ok('chat-bot: token vereist + list-commando geeft antwoord',
      bad.status === 401 && typeof good.text === 'string' && good.text.includes('Inhoud van'));
  }

  // 120. Kaartweergave: EXIF-GPS-parser decodeert coördinaten + endpoint geeft een lijst.
  {
    const { parseGps } = await import('../src/insights.js');
    const buf = Buffer.alloc(128);
    buf.write('II', 0, 'latin1'); buf.writeUInt16LE(0x2A, 2); buf.writeUInt32LE(8, 4);
    buf.writeUInt16LE(1, 8);
    buf.writeUInt16LE(0x8825, 10); buf.writeUInt16LE(4, 12); buf.writeUInt32LE(1, 14); buf.writeUInt32LE(26, 18); buf.writeUInt32LE(0, 22);
    buf.writeUInt16LE(4, 26); let e = 28;
    buf.writeUInt16LE(0x0001, e); buf.writeUInt16LE(2, e+2); buf.writeUInt32LE(2, e+4); buf.write('N\0', e+8, 'latin1'); e+=12;
    buf.writeUInt16LE(0x0002, e); buf.writeUInt16LE(5, e+2); buf.writeUInt32LE(3, e+4); buf.writeUInt32LE(80, e+8); e+=12;
    buf.writeUInt16LE(0x0003, e); buf.writeUInt16LE(2, e+2); buf.writeUInt32LE(2, e+4); buf.write('E\0', e+8, 'latin1'); e+=12;
    buf.writeUInt16LE(0x0004, e); buf.writeUInt16LE(5, e+2); buf.writeUInt32LE(3, e+4); buf.writeUInt32LE(104, e+8); e+=12;
    buf.writeUInt32LE(0, e);
    buf.writeUInt32LE(52,80);buf.writeUInt32LE(1,84);buf.writeUInt32LE(22,88);buf.writeUInt32LE(1,92);buf.writeUInt32LE(30,96);buf.writeUInt32LE(1,100);
    buf.writeUInt32LE(4,104);buf.writeUInt32LE(1,108);buf.writeUInt32LE(54,112);buf.writeUInt32LE(1,116);buf.writeUInt32LE(0,120);buf.writeUInt32LE(1,124);
    const gps = parseGps(buf);
    const geo = await (await fetch(H + '/api/geo/photos', { headers: jar() })).json();
    ok('kaartweergave: EXIF-GPS-parser + endpoint',
      gps && gps.lat === 52.375 && gps.lng === 4.9 && Array.isArray(geo.photos));
  }

  // 121. Tijdlijnweergave: bestanden gebucket per maand.
  {
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'tijdlijn1.txt'), 'x');
    const tl = await (await fetch(H + '/api/timeline?path=/', { headers: jar() })).json();
    ok('tijdlijnweergave: items + maandbuckets',
      Array.isArray(tl.items) && Array.isArray(tl.months) && tl.items.some((i) => i.path.includes('tijdlijn1.txt')));
  }

  // 122. Relatiegrafiek: twee bestanden met een gedeelde tag geven een verbinding.
  {
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'graafA.txt'), 'a');
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'graafB.txt'), 'b');
    await fetch(H + '/api/tags', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/graafA.txt', tags: ['project-x'] }) });
    await fetch(H + '/api/tags', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/graafB.txt', tags: ['project-x'] }) });
    const g = await (await fetch(H + '/api/graph/tags', { headers: jar() })).json();
    ok('relatiegrafiek: gedeelde tag verbindt twee bestanden',
      g.nodes.some((n) => n.id === '/graafA.txt') && g.edges.some((ed) => ed.tags.includes('project-x') && ((ed.source === '/graafA.txt' && ed.target === '/graafB.txt') || (ed.source === '/graafB.txt' && ed.target === '/graafA.txt'))));
  }

  // 123. Security: e-mail-upload respecteert quota (gelekte token vult opslag niet).
  {
    const eu = await import('../src/email-upload.js');
    addUser({ username: 'mailquota', password: 'mailquotapw1', role: 'user', quota: 5 }); // 5 bytes
    const tok = eu.ensureToken('mailquota');
    const b64 = Buffer.from('ruim meer dan vijf bytes').toString('base64');
    const del = await (await fetch(H + '/api/email-inbox/' + tok, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attachments: [{ filename: 'groot.txt', contentBase64: b64 }] }) })).json();
    ok('security: e-mail-upload weigert boven quota',
      del.ok && del.saved.length === 0 && del.rejected.some((r) => r.reason === 'quota overschreden'));
  }

  // 124. Security: organize/apply slaat vergrendelde bestanden over + migreert tags mee.
  {
    const locks = await import('../src/locks.js');
    const od = path.join(config.storageDir, 'admin', 'ordenen');
    fs.mkdirSync(od, { recursive: true });
    for (const n of ['x.pdf', 'y.pdf']) fs.writeFileSync(path.join(od, n), 'data');
    await fetch(H + '/api/tags', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/ordenen/y.pdf', tags: ['belangrijk'] }) });
    locks.lock(path.join(config.storageDir, 'admin'), '/ordenen/x.pdf', 'admin'); // x vergrendeld
    const sug = await (await fetch(H + '/api/organize/suggest?path=/ordenen&mode=type', { headers: jar() })).json();
    const ap = await (await fetch(H + '/api/organize/apply', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ moves: sug.moves }) })).json();
    const xStayed = fs.existsSync(path.join(od, 'x.pdf')); // vergrendeld: niet verplaatst
    const yMoved = fs.existsSync(path.join(od, 'Documenten', 'y.pdf'));
    const tagsMigrated = (await (await fetch(H + '/api/tags?path=/ordenen/Documenten/y.pdf', { headers: jar() })).json()).tags.includes('belangrijk');
    ok('security: organize/apply respecteert lock + migreert metadata',
      xStayed && yMoved && tagsMigrated && ap.skipped.includes('/ordenen/x.pdf'));
  }

  // 125. Config-UI: schema-gedreven instellingen bijwerken (met validatie/coercion).
  {
    const before = await (await fetch(H + '/api/admin/settings', { headers: jar() })).json();
    const put = await (await fetch(H + '/api/admin/settings', { method: 'PUT', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ bannerText: 'Onderhoud vanavond', bannerLevel: 'onzin', cleanupTrashDays: '-3' }) })).json();
    ok('config-UI: schema + validatie bij opslaan',
      Array.isArray(before.schema) && before.schema.some((s) => s.key === 'bannerText') &&
      put.settings.bannerText === 'Onderhoud vanavond' && put.settings.bannerLevel === 'info' && put.settings.cleanupTrashDays === 0);
  }

  // 126. Banner verschijnt in de branding-payload voor gewone gebruikers.
  {
    const b = await (await fetch(H + '/api/branding', { headers: jar() })).json();
    ok('config-UI: mededeling zichtbaar via branding',
      b.bannerText === 'Onderhoud vanavond' && b.bannerLevel === 'info');
  }

  // 127. SLA-dashboard: een major-incident verlaagt de uptime; oplossen levert MTTR.
  {
    const sla = await import('../src/sla.js');
    const inc = await import('../src/incidents.js');
    const i = inc.addIncident({ title: 'Storing', severity: 'major' }, 'admin');
    // Zet de aanvang 2 uur terug zodat er meetbare downtime is.
    const store = JSON.parse(fs.readFileSync(process.env.INCIDENTS_FILE, 'utf8'));
    store.incidents.find((x) => x.id === i.id).created = Date.now() - 2 * 3600000;
    fs.writeFileSync(process.env.INCIDENTS_FILE, JSON.stringify(store));
    const openCalc = sla.compute(30);
    inc.resolveIncident(i.id, 'admin');
    const res = await (await fetch(H + '/api/admin/sla?days=30', { headers: jar() })).json();
    ok('SLA-dashboard: downtime verlaagt uptime + MTTR na oplossen',
      openCalc.uptimePct < 100 && res.uptimePct < 100 && res.mttrMs > 0 && Array.isArray(res.timeline) && res.timeline.length === 30);
  }

  // 128. Workflow-engine: uitgebreide condities (nameContains) + label-actie + enable-toggle.
  {
    const rules = await import('../src/rules.js');
    const labels = await import('../src/labels.js');
    const home = path.join(config.storageDir, 'admin');
    const r = await (await fetch(H + '/api/rules', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefix: '/', contains: 'factuur', action: 'label', arg: 'vertrouwelijk' }) })).json();
    let applied = rules.applyRules('admin', '/facturen/factuur-2026.pdf', { label: (rel, lab) => labels.setLabel(home, rel, lab, 'admin') });
    const gotLabel = labels.getLabel(home, '/facturen/factuur-2026.pdf') === 'vertrouwelijk';
    const noMatch = rules.applyRules('admin', '/overig/brief.pdf', { label: () => { throw new Error('mag niet'); } }).applied.length === 0;
    await fetch(H + '/api/rules/' + r.rule.id + '/enabled', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ enabled: false }) });
    const afterDisable = rules.applyRules('admin', '/facturen/factuur-x.pdf', { label: () => { throw new Error('uit'); } }).applied.length === 0;
    ok('workflow-engine: nameContains + label-actie + enable-toggle',
      r.ok && applied.applied.some((a) => a.action === 'label') && gotLabel && noMatch && afterDisable);
  }

  // 129. Geplande rapporten: taak aanmaken en nu draaien (dest=folder -> tekstbestand).
  {
    const add = await (await fetch(H + '/api/admin/scheduled-reports', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ type: 'overview', cadence: 'weekly', dest: 'folder' }) })).json();
    const run = await (await fetch(H + '/api/admin/scheduled-reports/' + add.report.id + '/run', { method: 'POST', headers: jar() })).json();
    const dir = path.join(config.storageDir, 'admin', config.scheduledReportsDir);
    const made = fs.existsSync(dir) && fs.readdirSync(dir).some((n) => n.startsWith('overview-') && n.endsWith('.txt'));
    ok('geplande rapporten: aanmaken + nu draaien schrijft bestand',
      add.ok && run.ok && made);
  }

  // 130. Map-sjablonen: admin definieert, gebruiker instantieert een structuur.
  {
    const tpl = await (await fetch(H + '/api/admin/templates', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'Project', entries: [{ path: 'docs', type: 'dir' }, { path: 'README.txt', type: 'file', content: 'hallo' }] }) })).json();
    const app = await (await fetch(H + '/api/templates/' + tpl.template.id + '/apply', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/NieuwProject' }) })).json();
    const base = path.join(config.storageDir, 'admin', 'NieuwProject');
    ok('map-sjablonen: definiëren + instantiëren',
      tpl.ok && app.ok && fs.existsSync(path.join(base, 'docs')) && fs.readFileSync(path.join(base, 'README.txt'), 'utf8') === 'hallo');
  }

  // 131. Verloop-workflow: oude bestanden archiveren/verwijderen, vergrendelde overslaan.
  {
    const locks = await import('../src/locks.js');
    const home = path.join(config.storageDir, 'admin');
    const od = path.join(home, 'oud'); fs.mkdirSync(od, { recursive: true });
    const oldTime = new Date(Date.now() - 400 * 86400000);
    for (const n of ['te-archiveren.txt', 'te-wissen.txt', 'vergrendeld.txt']) { const f = path.join(od, n); fs.writeFileSync(f, 'x'); fs.utimesSync(f, oldTime, oldTime); }
    locks.lock(home, '/oud/vergrendeld.txt', 'admin');
    // Beleid: archiveer >100 dagen; verwijder alleen 'te-wissen' door een tweede, strengere policy op subpad.
    await fetch(H + '/api/lifecycle', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/oud', archiveDays: 100 }) });
    const prev = await (await fetch(H + '/api/lifecycle/preview', { headers: jar() })).json();
    const run = await (await fetch(H + '/api/lifecycle/run', { method: 'POST', headers: jar() })).json();
    const archived = fs.existsSync(path.join(home, config.lifecycleArchiveDir, 'oud', 'te-archiveren.txt'));
    const lockedStayed = fs.existsSync(path.join(od, 'vergrendeld.txt'));
    ok('verloop-workflow: archiveren + vergrendelde overslaan',
      Array.isArray(prev.items) && prev.items.length >= 2 && run.archived >= 2 && archived && lockedStayed && run.skipped.includes('/oud/vergrendeld.txt'));
  }

  // 132. Deel-presets: preset met auto-wachtwoord levert een beveiligde link op.
  {
    const shares = await import('../src/shares.js');
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'offerte.pdf'), 'pdf');
    const pr = await (await fetch(H + '/api/share-presets', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'Klant 7d', expiresInHours: 168, maxDownloads: 5, autoPassword: true }) })).json();
    const sh = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/offerte.pdf', presetId: pr.preset.id }) })).json();
    const rec = shares.getShare(sh.token);
    const bad = await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/offerte.pdf', presetId: 'bestaatniet' }) });
    ok('deel-presets: preset toepassen + auto-wachtwoord',
      pr.ok && typeof sh.password === 'string' && sh.password.length >= 12 && rec.maxDownloads === 5 && rec.expires > Date.now() + 160 * 3600000 &&
      shares.checkSharePassword(rec, sh.password) && !shares.checkSharePassword(rec, 'fout') && bad.status === 404);
  }

  // 133. Klantportaal: wachtwoord, listing, download, aanlevering, traversal geblokkeerd.
  {
    const pd = path.join(config.storageDir, 'admin', 'klantA'); fs.mkdirSync(pd, { recursive: true });
    fs.writeFileSync(path.join(pd, 'rapport.txt'), 'inhoud');
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'geheim-buiten.txt'), 'nee');
    const cr = await (await fetch(H + '/api/portals', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'Klant A', path: '/klantA', allowUpload: true, password: 'portaalpw1', accent: '#123456' }) })).json();
    const tok = cr.token;
    const noPw = await fetch(H + '/api/portal/' + tok);
    const list = await (await fetch(H + '/api/portal/' + tok, { headers: { 'X-Portal-Password': 'portaalpw1' } })).json();
    const dl = await fetch(H + '/api/portal/' + tok + '/download?path=rapport.txt', { headers: { 'X-Portal-Password': 'portaalpw1' } });
    const dlText = await dl.text();
    const trav = await fetch(H + '/api/portal/' + tok + '/download?path=' + encodeURIComponent('../geheim-buiten.txt'), { headers: { 'X-Portal-Password': 'portaalpw1' } });
    const fd = new FormData(); fd.append('files', new Blob(['aangeleverd']), 'levering.txt');
    const up = await (await fetch(H + '/api/portal/' + tok + '/upload', { method: 'POST', headers: { 'X-Portal-Password': 'portaalpw1' }, body: fd })).json();
    const landed = fs.existsSync(path.join(pd, config.portalUploadDir, 'levering.txt'));
    // Classificatie: een vertrouwelijke map mag geen portaal krijgen.
    const labelsMod = await import('../src/labels.js');
    fs.mkdirSync(path.join(config.storageDir, 'admin', 'vertrouwelijk'), { recursive: true });
    labelsMod.setLabel(path.join(config.storageDir, 'admin'), '/vertrouwelijk', 'vertrouwelijk', 'admin');
    fs.writeFileSync(path.join(pd, 'intern.txt'), 'geheim');
    labelsMod.setLabel(path.join(config.storageDir, 'admin'), '/klantA/intern.txt', 'geheim', 'admin');
    const list2 = await (await fetch(H + '/api/portal/' + tok, { headers: { 'X-Portal-Password': 'portaalpw1' } })).json();
    const dlSecret = await fetch(H + '/api/portal/' + tok + '/download?path=intern.txt', { headers: { 'X-Portal-Password': 'portaalpw1' } });
    const secretHidden = !list2.files.some((f) => f.name === 'intern.txt') && dlSecret.status === 404;
    const blocked = await fetch(H + '/api/portals', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'X', path: '/vertrouwelijk' }) });
    ok('klantportaal: wachtwoord + listing + download + upload + traversal/classificatie geblokkeerd',
      cr.ok && noPw.status === 401 && list.accent === '#123456' && list.files.some((f) => f.name === 'rapport.txt') &&
      dl.ok && dlText === 'inhoud' && trav.status === 400 && up.ok && up.saved.includes('levering.txt') && landed && blocked.status === 403 && secretHidden);
  }

  // 134. Netwerkschijf-profielen: profielen zonder wachtwoord + download + diagnose.
  {
    const mp = await (await fetch(H + '/api/mount-profiles', { headers: jar() })).json();
    const rc = mp.profiles.find((x) => x.id === 'rclone-webdav');
    const dl = await fetch(H + '/api/mount-profiles/rclone-sftp/download', { headers: jar() });
    const dlBody = await dl.text();
    const noSecrets = mp.profiles.every((x) => !/pass\s*=\s*[^<\s]/.test(x.body)) && !JSON.stringify(mp).includes('testpass123');
    ok('netwerkschijf-profielen: rclone/windows/macos/linux/sshfs + download + diagnose, zonder wachtwoord',
      rc && rc.body.includes('/webdav') && mp.profiles.some((x) => x.id === 'sshfs') && dl.ok && dlBody.includes('type = sftp') &&
      /attachment/.test(dl.headers.get('content-disposition') || '') && Array.isArray(mp.diagnose.checks) && noSecrets);
  }

  // 135. QR-apparaatkoppeling: claim -> goedkeuring -> eenmalige sessie; geheim vereist.
  {
    const start = await (await fetch(H + '/api/pair/start', { method: 'POST', headers: jar() })).json();
    const code = start.code;
    const claim = await (await fetch(H + '/api/pair/claim', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'TestPhone/1.0' }, body: JSON.stringify({ code, name: 'Testtelefoon' }) })).json();
    const claim2 = await fetch(H + '/api/pair/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const before = await (await fetch(H + '/api/pair/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, claimSecret: claim.claimSecret }) })).json();
    const pend = await (await fetch(H + '/api/pair/pending?code=' + encodeURIComponent(code), { headers: jar() })).json();
    await fetch(H + '/api/pair/decide', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ code, approve: true }) });
    const wrong = await fetch(H + '/api/pair/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, claimSecret: 'verkeerd' }) });
    const okRes = await fetch(H + '/api/pair/status', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'TestPhone/1.0' }, body: JSON.stringify({ code, claimSecret: claim.claimSecret }) });
    const okBody = await okRes.json();
    const sidCookie = (okRes.headers.get('set-cookie') || '').split(';')[0];
    const who = await (await fetch(H + '/api/whoami', { headers: { Cookie: sidCookie } })).json();
    const reuse = await fetch(H + '/api/pair/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, claimSecret: claim.claimSecret }) });
    // Afwijzen levert geen sessie op.
    const s2 = await (await fetch(H + '/api/pair/start', { method: 'POST', headers: jar() })).json();
    const c2 = await (await fetch(H + '/api/pair/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: s2.code }) })).json();
    await fetch(H + '/api/pair/decide', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ code: s2.code, approve: false }) });
    const denied = await (await fetch(H + '/api/pair/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: s2.code, claimSecret: c2.claimSecret }) })).json();
    // Met een API-sleutel/Basic-auth mag je geen koppeling starten.
    const basic = await fetch(H + '/api/pair/start', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from('mentionee:mentionpw123').toString('base64') } });
    ok('QR-koppeling: claim eenmalig, goedkeuring vereist, geheim vereist, sessie eenmalig, afwijzen werkt, alleen browsersessie',
      start.qr && start.qr.includes('<svg') && start.url.includes('/pair#') && claim.claimSecret && claim2.status === 404 &&
      before.status === 'claimed' && pend.claim.name === 'Testtelefoon' && pend.claim.ua === 'TestPhone/1.0' &&
      wrong.status === 404 && okBody.status === 'approved' && sidCookie.startsWith('sid=') && who.user === 'admin' &&
      reuse.status === 404 && denied.status === 'denied' && basic.status === 403);
  }

  // 136. Duplicaten-assistent: plan met voorkeursmap; lock en intussen-gewijzigd worden overgeslagen.
  {
    const locks = await import('../src/locks.js');
    const home = path.join(config.storageDir, 'admin');
    const d = path.join(home, 'dupT'); fs.mkdirSync(path.join(d, 'keep'), { recursive: true });
    const body = 'DUPLICAAT-INHOUD-1234567890';
    for (const n of ['keep/x.bin', 'y.bin', 'z.bin', 'w.bin']) fs.writeFileSync(path.join(d, n), body);
    locks.lock(home, '/dupT/z.bin', 'admin');
    const plan = await (await fetch(H + '/api/duplicates/plan?strategy=prefer&prefer=' + encodeURIComponent('/dupT/keep'), { headers: jar() })).json();
    const mine = plan.plan.find((g) => g.keep === '/dupT/keep/x.bin');
    fs.writeFileSync(path.join(d, 'w.bin'), 'DUPLICAAT-INHOUD-0000000000'); // zelfde lengte, andere inhoud: hash-herverificatie moet dit afvangen
    const ap = await (await fetch(H + '/api/duplicates/apply', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ items: [mine] }) })).json();
    ok('duplicaten-assistent: voorkeursmap + lock/gewijzigd overgeslagen + naar prullenbak',
      mine && mine.remove.length === 3 && ap.removed === 1 && !fs.existsSync(path.join(d, 'y.bin')) &&
      fs.existsSync(path.join(d, 'z.bin')) && fs.existsSync(path.join(d, 'w.bin')) && fs.existsSync(path.join(d, 'keep', 'x.bin')) &&
      ap.skipped.includes('/dupT/z.bin') && ap.skipped.includes('/dupT/w.bin'));
  }

  // 137. Opruimadvies: categorieën met terug te winnen volume.
  {
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'groot.bin'), Buffer.alloc(2 * 1048576));
    const adv = await (await fetch(H + '/api/cleanup-advice?largeMb=1', { headers: jar() })).json();
    const large = adv.categories.find((c) => c.id === 'large');
    ok('opruimadvies: categorieën + reclaim + items',
      adv.totalFiles > 0 && adv.categories.length === 6 && large.items.some((i) => i.path === '/groot.bin') && large.reclaim >= 2 * 1048576 &&
      adv.categories.some((c) => c.id === 'trash' && c.reclaim > 0));
  }

  // 138. Full-text zoeken met fragmenten.
  {
    fs.writeFileSync(path.join(config.storageDir, 'admin', 'notities.md'), 'Intro tekst.\nHet CONTRACT met klant X loopt af op 1 januari. Het contract wordt verlengd.\nEinde.');
    const r = await (await fetch(H + '/api/search/snippets?q=contract', { headers: jar() })).json();
    const hit = r.results.find((x) => x.path === '/notities.md');
    const sn = hit && hit.snippets[0];
    ok('full-text zoeken: treffers met contextfragment',
      hit && hit.matches === 2 && sn.text.toLowerCase().slice(sn.offset, sn.offset + 8) === 'contract' && sn.text.includes('klant X'));
  }

  // 139. Slimme collecties: filters (type + tag) live geëvalueerd.
  {
    for (const n of ['col-a.pdf', 'col-b.pdf', 'col-c.jpg']) fs.writeFileSync(path.join(config.storageDir, 'admin', n), 'x');
    await fetch(H + '/api/tags', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/col-a.pdf', tags: ['klant'] }) });
    await fetch(H + '/api/tags', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/col-c.jpg', tags: ['klant'] }) });
    const sv = await (await fetch(H + '/api/saved-searches', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'Klantdocs', filters: { type: 'document', tag: 'klant' } }) })).json();
    const id = (sv.search || sv.item || sv.saved || {}).id || (await (await fetch(H + '/api/saved-searches', { headers: jar() })).json()).searches.find((x) => x.name === 'Klantdocs').id;
    const ev = await (await fetch(H + '/api/saved-searches/' + id + '/items', { headers: jar() })).json();
    const paths = ev.items.map((i) => i.path);
    const bad = await fetch(H + '/api/saved-searches', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'Leeg', filters: { type: 'bestaatniet' } }) });
    ok('slimme collecties: type + tag-filter, ongeldige filter geweigerd',
      paths.includes('/col-a.pdf') && !paths.includes('/col-b.pdf') && !paths.includes('/col-c.jpg') && bad.status === 400);
  }

  // 140. Achtergrondtaken: ZIP-taak met voortgang; resultaat alleen voor de eigenaar.
  {
    const jobsMod = await import('../src/jobs.js');
    const jd = path.join(config.storageDir, 'admin', 'jobzip'); fs.mkdirSync(path.join(jd, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(jd, 'a.txt'), 'aaa'); fs.writeFileSync(path.join(jd, 'sub', 'b.txt'), 'bbb');
    const st = await (await fetch(H + '/api/jobs', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ type: 'zip', path: '/jobzip' }) })).json();
    const fin = await jobsMod.waitFor(st.job.id);
    const zr = await fetch(H + '/api/jobs/' + st.job.id + '/result', { headers: jar() });
    const zbuf = Buffer.from(await zr.arrayBuffer());
    const other = await fetch(H + '/api/jobs/' + st.job.id + '/result', { headers: { Authorization: 'Basic ' + Buffer.from('mentionee:mentionpw123').toString('base64') } });
    const listed = (await (await fetch(H + '/api/jobs', { headers: jar() })).json()).jobs.some((j) => j.id === st.job.id && j.hasResult);
    const bad = await fetch(H + '/api/jobs', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ type: 'rm-rf', path: '/' }) });
    const del = await (await fetch(H + '/api/jobs/' + st.job.id, { method: 'DELETE', headers: jar() })).json();
    ok('achtergrondtaken: ZIP met voortgang, resultaat alleen voor eigenaar, onbekend type geweigerd',
      fin.status === 'done' && fin.progress === 100 && zr.ok && zbuf.slice(0, 2).toString() === 'PK' && zbuf.includes(Buffer.from('sub/b.txt')) &&
      other.status === 404 && listed && bad.status === 400 && del.ok);
  }

  // 141. Preview-precaching: via een taak en automatisch na upload.
  {
    const jobsMod = await import('../src/jobs.js');
    const sharp = (await import('sharp')).default;
    const id = path.join(config.storageDir, 'admin', 'jobimg'); fs.mkdirSync(id, { recursive: true });
    await sharp({ create: { width: 64, height: 48, channels: 3, background: '#3366cc' } }).png().toFile(path.join(id, 'foto.png'));
    const before = fs.existsSync(config.thumbDir) ? fs.readdirSync(config.thumbDir).length : 0;
    const st = await (await fetch(H + '/api/jobs', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ type: 'thumbs', path: '/jobimg' }) })).json();
    const fin = await jobsMod.waitFor(st.job.id);
    const afterJob = fs.readdirSync(config.thumbDir).length;
    const png = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#cc3366' } }).png().toBuffer();
    const fd = new FormData(); fd.append('files', new Blob([png]), 'na-upload.png');
    await fetch(H + '/api/upload?path=/jobimg', { method: 'POST', headers: jar(), body: fd });
    let afterUpload = afterJob;
    for (let i = 0; i < 40 && afterUpload < afterJob + 2; i++) { await new Promise((r) => setTimeout(r, 100)); afterUpload = fs.readdirSync(config.thumbDir).length; }
    ok('preview-precaching: taak + automatisch na upload',
      fin.status === 'done' && /1 van 1/.test(fin.message) && afterJob >= before + 2 && afterUpload >= afterJob + 2);
  }

  // 142. Delta-upload: alleen gewijzigde blokken; verificatie van blokken en bronbestand.
  {
    const { createHash, randomBytes } = await import('node:crypto');
    const { listVersions } = await import('../src/versions.js');
    const locks = await import('../src/locks.js');
    const BS = 256 * 1024;
    const home = path.join(config.storageDir, 'admin');
    const orig = randomBytes(3 * BS + 100);
    fs.writeFileSync(path.join(home, 'groot.img'), orig);
    const next = Buffer.from(orig); randomBytes(1000).copy(next, BS + 5000); // alleen blok 1 wijzigt
    const hashes = (b) => { const out = []; for (let o = 0; o < b.length; o += BS) out.push(createHash('sha256').update(b.subarray(o, o + BS)).digest('hex')); return out; };
    const startReq = (extra = {}) => fetch(H + '/api/upload/delta/start', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/groot.img', size: next.length, blockSize: BS, blocks: hashes(next), sha256: createHash('sha256').update(next).digest('hex'), ...extra }) });
    const st = await (await startReq()).json();
    const put = (i, buf) => fetch(H + `/api/upload/delta/${st.id}/${i}`, { method: 'PUT', headers: jar({ 'Content-Type': 'application/octet-stream' }), body: buf });
    const wrongBlock = await put(1, randomBytes(BS));
    const notNeeded = await put(0, next.subarray(0, BS));
    const good = await put(1, next.subarray(BS, 2 * BS));
    const fin = await (await fetch(H + `/api/upload/delta/${st.id}/finish`, { method: 'POST', headers: jar() })).json();
    const same = fs.readFileSync(path.join(home, 'groot.img')).equals(next);
    const versioned = listVersions(home, '/groot.img').length >= 1;
    // Bronbestand wijzigt tussen start en afronden -> geweigerd, doel onaangetast.
    const next2 = Buffer.from(next); randomBytes(10).copy(next2, 2 * BS + 10);
    const st2 = await (await fetch(H + '/api/upload/delta/start', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/groot.img', size: next2.length, blockSize: BS, blocks: hashes(next2) }) })).json();
    await fetch(H + `/api/upload/delta/${st2.id}/${st2.need[0]}`, { method: 'PUT', headers: jar({ 'Content-Type': 'application/octet-stream' }), body: next2.subarray(2 * BS, 3 * BS) });
    const tampered = Buffer.from(next); tampered[5] ^= 0xff; fs.writeFileSync(path.join(home, 'groot.img'), tampered);
    const fin2 = await fetch(H + `/api/upload/delta/${st2.id}/finish`, { method: 'POST', headers: jar() });
    const untouched = fs.readFileSync(path.join(home, 'groot.img')).equals(tampered);
    // Vergrendeld doel -> 423.
    locks.lock(home, '/groot.img', 'admin');
    const locked = await startReq();
    locks.unlock(home, '/groot.img', 'admin', true);
    ok('delta-upload: alleen gewijzigd blok, blokhash/tussentijdse wijziging/lock afgevangen, versie bewaard',
      JSON.stringify(st.need) === '[1]' && st.reuse === 3 && wrongBlock.status === 400 && notNeeded.status === 400 && good.ok &&
      fin.ok && fin.sentBlocks === 1 && fin.reusedBlocks === 3 && same && versioned &&
      JSON.stringify(st2.need) === '[2]' && fin2.status === 400 && untouched && locked.status === 423);
  }

  // 143. Security: SFTP respecteert bewaarplicht (ook op mapniveau), locks en E2E-mappen.
  {
    const retentionMod = await import('../src/retention.js');
    const locksMod = await import('../src/locks.js');
    const e2eMod = await import('../src/e2e-folders.js');
    const { homeDir: hd } = await import('../src/users.js');
    addUser({ username: 'wormtest', password: 'wormtestpw1', role: 'user' });
    const bh = hd('wormtest');
    fs.mkdirSync(path.join(bh, 'wormmap'), { recursive: true });
    fs.writeFileSync(path.join(bh, 'wormmap', 'contract.txt'), 'origineel');
    fs.writeFileSync(path.join(bh, 'slot.txt'), 'slot');
    retentionMod.setRetention(bh, '/wormmap', Date.now() + 86400000);
    locksMod.lock(bh, '/slot.txt', 'admin');
    e2eMod.setE2E(bh, '/kluis', true); fs.mkdirSync(path.join(bh, 'kluis'), { recursive: true });
    const r = await new Promise((res) => {
      const c = new ssh2.Client(); const out = {};
      c.on('ready', () => c.sftp(async (e, s) => {
        const p = (fn) => new Promise((ok2) => fn((err) => ok2(!err)));
        out.unlink = await p((cb) => s.unlink('/wormmap/contract.txt', cb));
        out.renameDir = await p((cb) => s.rename('/wormmap', '/weg', cb));
        out.rmdir = await p((cb) => s.rmdir('/wormmap', cb));
        out.overwrite = await p((cb) => s.writeFile('/wormmap/contract.txt', 'GEWIJZIGD', cb));
        out.locked = await p((cb) => s.writeFile('/slot.txt', 'x', cb));
        out.plainInE2E = await p((cb) => s.writeFile('/kluis/open.txt', 'x', cb));
        out.encInE2E = await p((cb) => s.writeFile('/kluis/ok.enc', 'x', cb));
        c.end(); res(out);
      }));
      c.on('error', () => res(null));
      c.connect({ host: '127.0.0.1', port: 2239, username: 'wormtest', password: 'wormtestpw1' });
    });
    ok('security: SFTP blokkeert WORM (ook map), locks en onversleuteld in E2E-map',
      r && !r.unlink && !r.renameDir && !r.rmdir && !r.overwrite && !r.locked && !r.plainInE2E && r.encInE2E &&
      fs.readFileSync(path.join(bh, 'wormmap', 'contract.txt'), 'utf8') === 'origineel');
  }

  // 144. Security: web-delete/bulk-move van een map met bewaarplichtig bestand erin wordt geweigerd.
  {
    const retentionMod = await import('../src/retention.js');
    const home = path.join(config.storageDir, 'admin');
    fs.mkdirSync(path.join(home, 'archiefWORM'), { recursive: true });
    fs.writeFileSync(path.join(home, 'archiefWORM', 'jaarstuk.pdf'), 'x');
    retentionMod.setRetention(home, '/archiefWORM/jaarstuk.pdf', Date.now() + 86400000);
    await fetch(H + '/api/delete', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/archiefWORM' }) });
    await fetch(H + '/api/bulk/move', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ paths: ['/archiefWORM/jaarstuk.pdf'], dest: '/elders' }) });
    const ren = await fetch(H + '/api/rename', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ from: '/archiefWORM', to: '/nieuwenaam' }) });
    ok('security: map met bewaarplichtig bestand niet te wissen/verplaatsen/hernoemen',
      fs.existsSync(path.join(home, 'archiefWORM', 'jaarstuk.pdf')) && ren.status === 423);
  }

  // 145. Security: label van een map geldt voor bestanden erin (geen publieke deel-link).
  {
    const labelsMod = await import('../src/labels.js');
    const home = path.join(config.storageDir, 'admin');
    fs.mkdirSync(path.join(home, 'hr'), { recursive: true }); fs.writeFileSync(path.join(home, 'hr', 'salaris.xlsx'), 'x');
    labelsMod.setLabel(home, '/hr', 'vertrouwelijk', 'admin');
    const sh = await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/hr/salaris.xlsx' }) });
    ok('security: map-label beschermt bestanden erin tegen publiek delen', sh.status === 403);
  }

  // 146. Security: anonieme portaal-upload heeft een harde groottegrens (niet in het geheugen).
  {
    const pd = path.join(config.storageDir, 'admin', 'klantB'); fs.mkdirSync(pd, { recursive: true });
    const cr = await (await fetch(H + '/api/portals', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: 'Klant B', path: '/klantB', allowUpload: true }) })).json();
    const fd = new FormData(); fd.append('files', new Blob([Buffer.alloc(300000, 1)]), 'groot.bin');
    const big = await fetch(H + '/api/portal/' + cr.token + '/upload', { method: 'POST', body: fd });
    const qpw = await fetch(H + '/api/portal/' + cr.token + '?pw=iets');
    const tmpDir = path.join(os.tmpdir(), 'fs-portal-up');
    const leftovers = fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir).length : 0;
    ok('security: portaal-upload begrensd + tijdelijke bestanden opgeruimd',
      big.status === 413 && !fs.existsSync(path.join(pd, config.portalUploadDir, 'groot.bin')) && leftovers === 0 && qpw.ok);
  }

  // 147. Security: QR-controlecode komt van het claim-geheim, niet van de QR-code.
  {
    const st = await (await fetch(H + '/api/pair/start', { method: 'POST', headers: jar() })).json();
    const cl = await (await fetch(H + '/api/pair/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: st.code }) })).json();
    const pend = await (await fetch(H + '/api/pair/pending?code=' + encodeURIComponent(st.code), { headers: jar() })).json();
    ok('security: QR-controlecode afgeleid van claim-geheim',
      /^[0-9A-F]{6}$/.test(cl.checkCode) && pend.checkCode === cl.checkCode && !st.code.toUpperCase().startsWith(cl.checkCode));
  }

  // 148. Verloop-workflow: verwijderen gaat naar prullenbak; archiveren behoudt het label.
  {
    const labelsMod = await import('../src/labels.js');
    const home = path.join(config.storageDir, 'admin');
    const old = new Date(Date.now() - 800 * 86400000);
    for (const [dir, n] of [['verloopA', 'arch.txt'], ['verloopB', 'wis.txt']]) {
      fs.mkdirSync(path.join(home, dir), { recursive: true });
      fs.writeFileSync(path.join(home, dir, n), n); fs.utimesSync(path.join(home, dir, n), old, old);
    }
    labelsMod.setLabel(home, '/verloopA/arch.txt', 'geheim', 'admin');
    await fetch(H + '/api/lifecycle', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/verloopA', archiveDays: 100 }) });
    await fetch(H + '/api/lifecycle', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/verloopB', deleteDays: 100 }) });
    await fetch(H + '/api/lifecycle/run', { method: 'POST', headers: jar() });
    const archived = path.posix.join('/', config.lifecycleArchiveDir, '/verloopA/arch.txt');
    const inTrash = fs.readdirSync(path.join(home, config.trashName)).some((n) => n.endsWith('_wis.txt'));
    ok('verloop-workflow: wissen naar prullenbak, label blijft bij archiveren',
      labelsMod.getLabel(home, archived) === 'geheim' && inTrash && !fs.existsSync(path.join(home, 'verloopB', 'wis.txt')));
  }

  // 149. Security: DLP-blokkade geldt ook voor delta-uploads.
  {
    const { createHash } = await import('node:crypto');
    const origDlp = config.dlp.action; config.dlp.action = 'block';
    const body = Buffer.from('Betaling met kaart 4111 1111 1111 1111 graag verwerken.');
    const h = createHash('sha256').update(body).digest('hex');
    const st = await (await fetch(H + '/api/upload/delta/start', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/kaart.txt', size: body.length, blockSize: 262144, blocks: [h] }) })).json();
    await fetch(H + `/api/upload/delta/${st.id}/0`, { method: 'PUT', headers: jar({ 'Content-Type': 'application/octet-stream' }), body });
    const fin = await fetch(H + `/api/upload/delta/${st.id}/finish`, { method: 'POST', headers: jar() });
    config.dlp.action = origDlp;
    ok('security: DLP blokkeert ook delta-uploads', fin.status === 400 && !fs.existsSync(path.join(config.storageDir, 'admin', 'kaart.txt')));
  }

  // 150. Audit-log doorzoeken + export met SHA-256 en ketencontrole.
  {
    const sr = await (await fetch(H + '/api/admin/audit/search?action=login&user=admin', { headers: jar() })).json();
    const allLogin = sr.entries.length > 0 && sr.entries.every((e) => e.action.includes('login') && e.user === 'admin');
    const none = await (await fetch(H + '/api/admin/audit/search?q=bestaat-zeker-niet-xyz', { headers: jar() })).json();
    const ex = await fetch(H + '/api/admin/audit/export?format=csv&action=login', { headers: jar() });
    const body = await ex.text();
    const { createHash } = await import('node:crypto');
    const shaOk = ex.headers.get('x-export-sha256') === createHash('sha256').update(body).digest('hex');
    const js = await (await fetch(H + '/api/admin/audit/export?format=json&limit=5', { headers: jar() })).json();
    const { toCsv } = await import('../src/audit-search.js');
    const safe = toCsv([{ ts: 't', channel: 'web', user: '=cmd()', action: 'x' }]).includes("'=cmd()");
    const bobDenied = (await fetch(H + '/api/admin/audit/search', { headers: { Cookie: 'sid=ongeldig' } })).status === 401;
    ok('audit: zoeken met filters, export met SHA-256 en ketenstatus, CSV-injectie geneutraliseerd',
      allLogin && none.total === 0 && body.startsWith('ts,channel') && shaOk && /^intact;/.test(ex.headers.get('x-audit-chain') || '') &&
      js.meta && js.meta.chain.ok && js.entries.length <= 5 && safe && bobDenied);
  }

  // 151. Login-anomalieën: nieuw land, onmogelijke reis en massadownload na login.
  {
    const la = await import('../src/login-anomaly.js');
    const seen = []; la.setAnomalyListener((a) => seen.push(a.kind));
    const t0 = Date.now();
    const first = la.onLogin('reiziger', { ip: '1.1.1.1', country: 'NL', now: t0 - 10 * 3600000 });
    const same = la.onLogin('reiziger', { ip: '1.1.1.2', country: 'NL', now: t0 - 3600000 });
    const jump = la.onLogin('reiziger', { ip: '9.9.9.9', country: 'BR', now: t0 });
    const origC = config.loginBurstCount; config.loginBurstCount = 3;
    la.onLogin('schraper', { ip: '2.2.2.2', now: t0 });
    const hits = [1, 2, 3, 4].map(() => la.onDownload('schraper', 10, t0 + 1000));
    const late = (la.onLogin('laat', { now: t0 }), [1, 2, 3, 4, 5].map(() => la.onDownload('laat', 1, t0 + 3600000)));
    config.loginBurstCount = origC;
    // Via HTTP: een login met landheader wordt geregistreerd.
    await fetch(H + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', [config.geoHeader]: 'NL' }, body: JSON.stringify({ username: 'wormtest', password: 'wormtestpw1' }) });
    const auditHas = fs.readFileSync(config.auditLog, 'utf8').includes('"login_anomaly"');
    ok('login-anomalie: nieuw land + onmogelijke reis + massadownload na login gedetecteerd',
      first.length === 0 && same.length === 0 && jump.includes('nieuw land') && jump.includes('onmogelijke reis') &&
      hits.join() === 'false,false,false,true' && late.every((x) => !x) && seen.includes('massadownload na login') &&
      la.knownCountries('wormtest').includes('NL') && auditHas);
  }

  // 152. Eerlijke taakwachtrij: een tweede gebruiker hoeft niet achter 6 taken van een ander te wachten.
  {
    const jobsMod = await import('../src/jobs.js');
    const order = [];
    jobsMod._registerTestType('traag', async (job) => { order.push(job.user); await new Promise((r) => setTimeout(r, 40)); return {}; });
    const ids = [];
    for (let i = 0; i < 6; i++) ids.push(jobsMod.enqueue('veel', 'traag').id);
    ids.push(jobsMod.enqueue('weinig', 'traag').id);
    for (const id of ids) await jobsMod.waitFor(id, 10000);
    ok('taakwachtrij: eerlijke verdeling tussen gebruikers', order.length === 7 && order.indexOf('weinig') <= 2);
  }

  // 153. SFTP-uploads worden na het sluiten gecontroleerd (DLP-blokkade → quarantaine).
  {
    const origDlp = config.dlp.action; config.dlp.action = 'block';
    const { homeDir: hd } = await import('../src/users.js');
    const r = await new Promise((res) => {
      const c = new ssh2.Client();
      c.on('ready', () => c.sftp((e, s) => {
        s.writeFile('/kaartsftp.txt', 'Kaart 4111 1111 1111 1111 voor betaling.', (err) => { c.end(); res({ err: !!err }); });
      }));
      c.on('error', () => res(null));
      c.connect({ host: '127.0.0.1', port: 2239, username: 'wormtest', password: 'wormtestpw1' });
    });
    config.dlp.action = origDlp;
    ok('security: SFTP-upload met gevoelige data wordt geweigerd en verwijderd',
      r && r.err && !fs.existsSync(path.join(hd('wormtest'), 'kaartsftp.txt')));
  }

  // 154. Gasttoegang: eenmalige link, alleen de gedeelde map, geen andere API's, intrekken.
  {
    const home = path.join(config.storageDir, 'admin');
    fs.mkdirSync(path.join(home, 'gastmap', 'sub'), { recursive: true });
    fs.writeFileSync(path.join(home, 'gastmap', 'sub', 'offerte.txt'), 'offerte');
    fs.writeFileSync(path.join(home, 'geheim.txt'), 'niet voor gasten');
    const cr = await fetch(H + '/api/guests', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/gastmap', mode: 'ro', days: 3, label: 'Accountant' }) });
    const g = await cr.json();
    const token = g.link.split('/gast/')[1];
    const first = await fetch(H + '/gast/' + token, { redirect: 'manual' });
    const gc = (first.headers.get('set-cookie') || '').split(';')[0];
    const reuse = await fetch(H + '/gast/' + token, { redirect: 'manual' });
    const gh = { Cookie: gc };
    const who = await (await fetch(H + '/api/whoami', { headers: gh })).json();
    const sub = await (await fetch(H + `/api/shared/list?owner=admin&path=${encodeURIComponent('/gastmap/sub')}`, { headers: gh })).json();
    const dl = await fetch(H + `/api/shared/download?owner=admin&path=${encodeURIComponent('/gastmap/sub/offerte.txt')}`, { headers: gh });
    const outside = await fetch(H + `/api/shared/download?owner=admin&path=${encodeURIComponent('/geheim.txt')}`, { headers: gh });
    const ownList = await fetch(H + '/api/list?path=/', { headers: gh });
    const apikey = await fetch(H + '/api/apikeys', { method: 'POST', headers: { ...gh, 'Content-Type': 'application/json' }, body: '{}' });
    const upload = await fetch(H + `/api/shared/mkdir?owner=admin`, { method: 'POST', headers: { ...gh, 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: 'admin', path: '/gastmap/nieuw' }) });
    const pwLogin = await fetch(H + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: g.guest, password: '' }) });
    const list = await (await fetch(H + '/api/guests', { headers: jar() })).json();
    const del = await fetch(H + '/api/guests/' + g.guest, { method: 'DELETE', headers: jar() });
    const after = await fetch(H + '/api/whoami', { headers: gh });
    ok('gasttoegang: eenmalige link, alleen gedeelde map (lezen), rest geblokkeerd, intrekken werkt',
      cr.ok && g.guest.startsWith('gast-') && first.status === 302 && gc.startsWith('sid=') && reuse.status === 400 &&
      who.role === 'guest' && who.guestExpires > Date.now() && (sub.items || []).some((i) => i.name === 'offerte.txt') &&
      dl.ok && (await dl.text()) === 'offerte' && outside.status === 403 && ownList.status === 403 && apikey.status === 403 &&
      upload.status === 403 && pwLogin.status !== 200 && list.guests.some((x) => x.guest === g.guest && x.path === '/gastmap') &&
      del.ok && after.status === 401 && !fs.existsSync(path.join(config.storageDir, 'admin', 'gastmap', 'nieuw')));
  }

  // 155. Gasten verlopen automatisch (account + deling weg); geen gasten voor gelabelde/niet-bestaande mappen.
  {
    const guestsMod = await import('../src/guests.js');
    const { getUser: gu, userExists: ue } = await import('../src/users.js');
    const g = guestsMod.createGuest('admin', { path: '/gastmap', days: 1 });
    const { updateUser: uu } = await import('../src/users.js');
    uu(g.guest, { expires: Date.now() - 1000 });
    const gone = guestsMod.sweepGuests();
    const noFolder = await fetch(H + '/api/guests', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/bestaatniet' }) });
    const traversal = await fetch(H + '/api/guests', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/../..' }) });
    ok('gasttoegang: automatisch verlopen en ongeldige mappen geweigerd',
      gone.includes(g.guest) && !ue(g.guest) && !(gu('admin').shares || []).some((s) => s.to === g.guest) &&
      noFolder.status === 400 && traversal.status === 400);
  }

  // 156. Leesbevestigingen: registreren via gedeelde map en deellink, eigenaar telt niet, melding bij eerste keer.
  {
    const home = path.join(config.storageDir, 'admin');
    fs.mkdirSync(path.join(home, 'lees'), { recursive: true });
    fs.writeFileSync(path.join(home, 'lees', 'brief.txt'), 'brief');
    await fetch(H + '/api/receipts', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/lees', on: true }) });
    const g = await (await fetch(H + '/api/guests', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/lees', label: 'Lezer' }) })).json();
    const r = await fetch(H + '/gast/' + g.link.split('/gast/')[1], { redirect: 'manual' });
    const gh = { Cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
    await fetch(H + `/api/shared/download?owner=admin&path=${encodeURIComponent('/lees/brief.txt')}`, { headers: gh });
    await fetch(H + `/api/shared/download?owner=admin&path=${encodeURIComponent('/lees/brief.txt')}`, { headers: gh });
    await fetch(H + '/api/download?path=' + encodeURIComponent('/lees/brief.txt'), { headers: jar() }); // eigenaar zelf telt niet
    const sh = await (await fetch(H + '/api/share', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/lees/brief.txt' }) })).json();
    if (sh.token) await fetch(H + '/s/' + sh.token);
    const rc = await (await fetch(H + '/api/receipts?path=' + encodeURIComponent('/lees/brief.txt'), { headers: jar() })).json();
    const notes = await (await fetch(H + '/api/notifications', { headers: jar() })).json().catch(() => ({}));
    const noteTxt = JSON.stringify(notes);
    const guestCant = (await fetch(H + '/api/receipts?path=/', { headers: gh })).status === 403;
    ok('leesbevestigingen: gast + deellink geregistreerd, eigenaar niet, melding verstuurd',
      rc.tracked === 'parent' && rc.reads.filter((x) => x.who === g.guest).length === 2 && !rc.reads.some((x) => x.who === 'admin') &&
      (!sh.token || rc.reads.some((x) => x.via === 'deellink')) && noteTxt.includes('Leesbevestiging') && guestCant);
  }

  // 157. FTPS: alleen versleuteld, eigen thuismap, upload/download, beschermingen, AV/DLP, geen actieve modus.
  {
    const net = await import('node:net'); const tlsMod = await import('node:tls');
    // Minimale FTPS-client (expliciet, passief).
    function ftps() {
      let sock; let buf = ''; const waiters = [];
      const feed = () => { let m; while (waiters.length && (m = /^(\d{3}) [^\n]*\n/m.exec(buf))) { const end = buf.indexOf(m[0]) + m[0].length; const text = buf.slice(0, end); buf = buf.slice(end); waiters.shift()({ code: +m[1], text }); } };
      const next = () => new Promise((r) => { waiters.push(r); feed(); });
      const bind = (s) => { sock = s; s.setEncoding('utf8'); s.on('data', (d) => { buf += d; feed(); }); s.on('error', () => {}); };
      const cmd = async (line) => { sock.write(line + '\r\n'); return next(); };
      const api = {
        open: () => new Promise((res) => { const s = net.connect(2240, '127.0.0.1'); bind(s); next().then(res); }),
        cmd,
        tls: async () => { const r = await cmd('AUTH TLS'); if (r.code !== 234) return r; sock.removeAllListeners('data'); const t = tlsMod.connect({ socket: sock, rejectUnauthorized: false }); await new Promise((ok2) => t.once('secureConnect', ok2)); bind(t); return r; },
        data: async (line, upload) => {
          const e = await cmd('EPSV'); if (e.code !== 229) return { reply: e };
          const port = +/\|\|\|(\d+)\|/.exec(e.text)[1];
          const d = tlsMod.connect({ port, host: '127.0.0.1', rejectUnauthorized: false });
          await new Promise((ok2) => d.once('secureConnect', ok2));
          const pre = await cmd(line);
          let body = '';
          if (upload !== undefined) d.end(upload); else d.on('data', (c) => { body += c; });
          await new Promise((ok2) => d.once('close', ok2));
          const fin = pre.code < 400 ? await next() : pre;
          return { pre, fin, body };
        },
        end: () => sock.destroy(),
      };
      return api;
    }
    // Onversleuteld inloggen wordt geweigerd.
    const plain = ftps(); await plain.open(); const plainUser = await plain.cmd('USER wormtest'); plain.end();
    const c = ftps(); await c.open(); await c.tls();
    await c.cmd('USER wormtest'); const pass = await c.cmd('PASS wormtestpw1');
    const pbsz = await c.cmd('PBSZ 0'); const prot = await c.cmd('PROT P');
    const up = await c.data('STOR ftpsproef.txt', 'via ftps');
    const list = await c.data('LIST');
    const get = await c.data('RETR ftpsproef.txt');
    const size = await c.cmd('SIZE ftpsproef.txt');
    const escape = await c.cmd('CWD ../../..'); const pwd = await c.cmd('PWD');
    const active = await c.cmd('PORT 127,0,0,1,4,1');
    const retentionMod = await import('../src/retention.js');
    const { homeDir: hdF } = await import('../src/users.js'); const home = hdF('wormtest');
    fs.writeFileSync(path.join(home, 'worm-ftps.txt'), 'x'); retentionMod.setRetention(home, '/worm-ftps.txt', Date.now() + 86400000);
    const delWorm = await c.cmd('DELE worm-ftps.txt');
    const origDlp = config.dlp.action; config.dlp.action = 'block';
    const dlp = await c.data('STOR kaart-ftps.txt', 'Kaart 4111 1111 1111 1111 betaling');
    config.dlp.action = origDlp;
    await c.cmd('RNFR ftpsproef.txt'); const rn = await c.cmd('RNTO hernoemd-ftps.txt');
    await c.cmd('QUIT'); c.end();
    const bad = ftps(); await bad.open(); await bad.tls(); await bad.cmd('USER wormtest'); const badPass = await bad.cmd('PASS fout'); bad.end();
    ok('FTPS: TLS verplicht, upload/list/download, geen uitbraak, geen actieve modus, WORM + DLP afgedwongen',
      plainUser.code === 530 && pass.code === 230 && pbsz.code === 200 && prot.code === 200 &&
      up.fin && up.fin.code === 226 && fs.readFileSync(path.join(home, 'hernoemd-ftps.txt'), 'utf8') === 'via ftps' &&
      list.body.includes('ftpsproef.txt') && get.body === 'via ftps' && size.text.startsWith('213 8') &&
      pwd.text.includes('"/"') && active.code === 502 && delWorm.code === 550 && fs.existsSync(path.join(home, 'worm-ftps.txt')) &&
      dlp.fin && dlp.fin.code === 550 && !fs.existsSync(path.join(home, 'kaart-ftps.txt')) && rn.code === 250 && badPass.code === 530 &&
      /"ftps"/.test(fs.readFileSync(config.auditLog, 'utf8')));
  }

  // 158. Gefaseerde update: schaduw-instantie start los van de echte data en slaagt voor de zelftest.
  {
    // Asynchroon, niet met spawnSync: de webserver draait in dít proces, en
    // spawnSync legt de event loop tot 45 s stil. Daarna sloten de keep-alive-
    // timers van de server de verbindingen precies toen de volgende test er
    // één hergebruikte — af en toe "fetch failed", en alleen op main.
    const { spawn } = await import('node:child_process');
    const r = await new Promise((resolve) => {
      const kind = spawn(process.execPath, ['scripts/shadow-check.mjs', '--port', '18765', '--timeout', '45000']);
      let stdout = '';
      kind.stdout.on('data', (d) => { stdout += d; });
      kind.stderr.resume();
      const stop = setTimeout(() => kind.kill('SIGKILL'), 90000);
      kind.on('close', (status) => { clearTimeout(stop); resolve({ status, stdout }); });
    });
    let rep = {}; try { rep = JSON.parse(r.stdout); } catch { /* geen json */ }
    ok('gefaseerde update: schaduw-controle slaagt en rapporteert alle stappen',
      r.status === 0 && rep.ok === true && rep.checks.length >= 12 && rep.checks.every((x) => x.ok) && !/AUTH_PASS/.test(r.stdout));
  }

  // 159. Security: uploaden/verwijderen in een gedeelde rw-map volgt dezelfde regels (WORM, DLP, quotum, deelmap-root).
  {
    const retentionMod = await import('../src/retention.js');
    const home = path.join(config.storageDir, 'admin');
    fs.mkdirSync(path.join(home, 'samen'), { recursive: true });
    fs.writeFileSync(path.join(home, 'samen', 'jaarrekening.pdf'), 'origineel');
    retentionMod.setRetention(home, '/samen/jaarrekening.pdf', Date.now() + 86400000);
    const g = await (await fetch(H + '/api/guests', { method: 'POST', headers: jar({ 'Content-Type': 'application/json' }), body: JSON.stringify({ path: '/samen', mode: 'rw' }) })).json();
    const r = await fetch(H + '/gast/' + g.link.split('/gast/')[1], { redirect: 'manual' });
    const gh = { Cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
    const up = async (name, body) => { const fd = new FormData(); fd.append('files', new Blob([body]), name); const x = await fetch(H + `/api/shared/upload?owner=admin&path=${encodeURIComponent('/samen')}`, { method: 'POST', headers: gh, body: fd }); return { status: x.status, j: await x.json().catch(() => ({})) }; };
    const overwrite = await up('jaarrekening.pdf', 'VERVALST');
    const origDlp = config.dlp.action; config.dlp.action = 'block';
    const dlp = await up('kaart.txt', 'Kaart 4111 1111 1111 1111 betalen');
    config.dlp.action = origDlp;
    const okUp = await up('offerte.txt', 'gewoon');
    const delWorm = await fetch(H + '/api/shared/delete', { method: 'POST', headers: { ...gh, 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: 'admin', path: '/samen/jaarrekening.pdf' }) });
    const delRoot = await fetch(H + '/api/shared/delete', { method: 'POST', headers: { ...gh, 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: 'admin', path: '/samen' }) });
    const delOk = await fetch(H + '/api/shared/delete', { method: 'POST', headers: { ...gh, 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: 'admin', path: '/samen/offerte.txt' }) });
    ok('security: gedeelde map — geen overschrijven van WORM, DLP-blokkade, share-root en WORM niet te wissen',
      overwrite.status === 403 && fs.readFileSync(path.join(home, 'samen', 'jaarrekening.pdf'), 'utf8') === 'origineel' &&
      dlp.status === 403 && !fs.existsSync(path.join(home, 'samen', 'kaart.txt')) && okUp.status === 200 && okUp.j.uploaded.includes('offerte.txt') &&
      delWorm.status === 423 && delRoot.status === 403 && delOk.ok && fs.existsSync(path.join(home, 'samen')) && !fs.existsSync(path.join(home, 'samen', 'offerte.txt')));

    // 160. Gasten kunnen niet via WebDAV/tus met hun sessiecookie.
    const dav = await fetch(H + '/webdav/stiekem.txt', { method: 'PUT', headers: gh, body: 'x' });
    const davGet = await fetch(H + '/webdav/', { method: 'PROPFIND', headers: { ...gh, Depth: '1' } });
    const tusPost = await fetch(H + '/tus', { method: 'POST', headers: { ...gh, 'Tus-Resumable': '1.0.0', 'Upload-Length': '1' } });
    ok('security: gasten geen toegang tot WebDAV en tus', dav.status === 403 && davGet.status === 403 && tusPost.status === 403);
  }

  // 161. FTPS: commando's die in hetzelfde pakket na AUTH TLS meekomen worden niet uitgevoerd (STARTTLS-injectie).
  {
    const net = await import('node:net'); const tlsMod = await import('node:tls');
    const res = await new Promise((resolve) => {
      const s = net.connect(2240, '127.0.0.1'); let b = ''; let stage = 0;
      s.setEncoding('utf8');
      s.on('data', async (d) => {
        b += d;
        if (stage === 0 && b.includes('220 ')) { stage = 1; b = ''; s.write('AUTH TLS\r\nUSER wormtest\r\n'); }
        else if (stage === 1 && b.includes('234 ')) {
          stage = 2; s.removeAllListeners('data');
          const t = tlsMod.connect({ socket: s, rejectUnauthorized: false }, () => { t.setEncoding('utf8'); let tb = ''; t.on('data', (x) => { tb += x; if (/\n$/.test(tb)) { resolve({ reply: tb, extra: b }); t.destroy(); } }); t.write('PASS wormtestpw1\r\n'); });
          t.on('error', () => resolve(null));
        }
      });
      s.on('error', () => resolve(null));
    });
    ok('security: FTPS negeert commando\'s die vóór de TLS-handshake geïnjecteerd worden',
      res && /^503 /.test(res.reply) && !/331/.test(res.extra));
  }

  // 162. FTPS: maximaal aantal gelijktijdige verbindingen per IP.
  {
    const net = await import('node:net');
    const socks = []; const greetings = [];
    for (let i = 0; i < 9; i++) {
      greetings.push(await new Promise((resolve) => { const s = net.connect(2240, '127.0.0.1'); socks.push(s); s.setEncoding('utf8'); s.once('data', (d) => resolve(d.slice(0, 3))); s.on('error', () => resolve('err')); setTimeout(() => resolve('timeout'), 3000); }));
    }
    socks.forEach((s) => s.destroy());
    ok('security: FTPS begrenst gelijktijdige verbindingen per IP', greetings.slice(0, 8).every((g) => g === '220') && greetings[8] === '421');
  }

  // 163. HTTPS aan zonder bestaand certificaat: self-signed wordt (async) aangemaakt.
  {
    const tlsMod = await import('../src/tls.js');
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-tls-'));
    const orig = { ...config.tls };
    Object.assign(config.tls, { enabled: true, certPath: path.join(d, 'c', 'cert.pem'), keyPath: path.join(d, 'k', 'key.pem') });
    let res = null; let err = null;
    try { res = await tlsMod.prepareTls(); } catch (e) { err = e; }
    const again = tlsMod.ensureTls();
    Object.assign(config.tls, orig);
    ok('HTTPS: self-signed certificaat wordt aangemaakt als het ontbreekt',
      !err && res && String(res.cert).includes('BEGIN CERTIFICATE') && fs.existsSync(path.join(d, 'k', 'key.pem')) &&
      String(again.cert).includes('BEGIN CERTIFICATE') && (fs.statSync(path.join(d, 'k', 'key.pem')).mode & 0o777) === 0o600);
  }

  // 164. Volledige virusscan: bewaart het tijdstip (overleeft herstarts) en zet
  // bij een onbereikbare scanner NIETS in quarantaine, ook niet bij fail-closed.
  {
    const av = await import('../src/av-schedule.js');
    const { homeDir: hd2 } = await import('../src/users.js');
    const probe = path.join(hd2('admin'), 'av-probe.txt');
    fs.writeFileSync(probe, 'gewoon bestand');
    const ok1 = await av.scanAll();
    const state = JSON.parse(fs.readFileSync(process.env.AV_SCAN_STATE_FILE, 'utf8'));
    const orig = { clamscan: config.clamscan, failClosed: config.antivirus.failClosed };
    config.clamscan = '/bestaat/niet/clamdscan'; config.antivirus.failClosed = true;
    let res2 = null; let err2 = null;
    try { res2 = await av.scanAll(); } catch (e) { err2 = e; }
    config.clamscan = orig.clamscan; config.antivirus.failClosed = orig.failClosed;
    ok('virusscan: tijdstip bewaard; onbereikbare scanner zet niets in quarantaine (ook fail-closed)',
      ok1.scanned > 0 && state.lastRun > 0 && fs.existsSync(probe) &&
      (err2 ? /onbereikbaar/.test(err2.message) : (res2.infected.length === 0 && res2.unscannable > 0)));
  }

  // 165. Webhook: Discord-embed met titel/tekst en filter via WEBHOOK_EVENTS.
  {
    const n = await import('../src/notify.js');
    const f = n.formatWebhook('discord', 'alert', { key: 'k', subject: 'Schijf vol', message: '95% gebruikt' });
    const e = f.body.embeds && f.body.embeds[0];
    const origEv = config.webhookEvents;
    config.webhookEvents = ['alert', 'quarantine'];
    const wants = [n.webhookWants('alert'), n.webhookWants('upload')];
    config.webhookEvents = [];
    const all = n.webhookWants('upload');
    config.webhookEvents = origEv;
    ok('webhook: Discord-embed en WEBHOOK_EVENTS-filter',
      e && e.title === 'Schijf vol' && e.description === '95% gebruikt' && wants[0] === true && wants[1] === false && all === true);
  }

  console.log(`\n${passed} tests geslaagd.`);
  web.close(); sftp.close(); if (ftpsServer) ftpsServer.close();
  process.exit(0);
} catch (err) {
  console.error('\nTEST MISLUKT:', err.message);
  web.close(); sftp.close();
  process.exit(1);
}
