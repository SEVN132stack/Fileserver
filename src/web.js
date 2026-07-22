import express from 'express';
import multer from 'multer';
import archiver from 'archiver';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { resolveWithin, dirSize } from './paths.js';
import {
  homeDir, verifyPassword, userExists, getUser, role, isAdmin, isReadonly,
  quota, sharedWith, listUsers, addUser, updateUser, deleteUser, listUsernames,
} from './users.js';
import { checkAllowed, recordFailure, recordSuccess } from './ratelimit.js';
import { isBanned, ban, unban, listBans } from './bans.js';
import { createSession, getSession, destroySession, tokenFromReq, markReauth, reauthedWithin } from './sessions.js';
import { generateSecret, verifyTotp, otpauthUrl } from './totp.js';
import { createShare, getShare, checkSharePassword, listShares, deleteShare, countDownload, listAllShares, adminDeleteShare, adminUpdateShare } from './shares.js';
import { execFile } from 'node:child_process';
import { audit, verifyChain } from './audit.js';
import { notify } from './notify.js';
import { ensureTls } from './tls.js';
import { handleWebdav, WEBDAV_MOUNT } from './webdav.js';
import { throttleStream } from './throttle.js';
import { scanFile } from './scan.js';
import { runFreshclam, scanAll } from './av-schedule.js';
import { addClient, emitToUser, addAdminClient, emitAdmin } from './events.js';
import { bandwidth, ensureExternalUser, getEmail, reload as reloadUsers } from './users.js';
import { getAuthUrl, validState, exchange } from './oidc.js';
import { createResetToken, consumeResetToken, sendResetMail, sendMail } from './mailer.js';
import { getMeta, getAllMeta, setMeta } from './metadata.js';
import { getThumbnail, canThumbnail } from './thumbs.js';
import * as metrics from './metrics.js';
import { makeBackup } from './backup.js';
import { getHistory, recordSample } from './metrics-history.js';
import { countUpload } from './shares.js';
import { listGroups, setGroup, deleteGroup } from './groups.js';
import { getSettings, updateSettings, getSetting } from './settings.js';
import { runCleanup } from './cleanup.js';
import { storageReport } from './storage-report.js';
import { qrSvg } from './qr.js';
import * as permalinks from './permalinks.js';
import { checkForUpdate } from './updatecheck.js';
import { checkDisk } from './diskmonitor.js';
import { verifyLatestBackup, restoreTest } from './backup.js';
import * as integrity from './integrity.js';
import * as comments from './comments.js';
import { recordMutation } from './ransomware.js';
import { checkHoneypot } from './honeypot.js';
import { passwordPwnedCount, isExpired } from './users.js';
import { alert as sysAlert } from './alerts.js';
import { listSessions, revokeSession } from './sessions.js';
import {
  validatePassword, isLocked, recordLoginFailure, recordLoginSuccess,
  isKnownDevice, rememberDevice, getCredentials,
} from './users.js';
import * as webauthn from './webauthn.js';
import { createHash } from 'node:crypto';
import { handleTus, TUS_MOUNT } from './tus.js';
import { quarantine, listQuarantine, release as qRelease, remove as qRemove } from './quarantine.js';
import { snapshot, listVersions, versionPath } from './versions.js';
import { signature, applyDelta, DEFAULT_BLOCK } from './rsync.js';
import * as keyring from './keyring.js';
import * as searchIndex from './searchindex.js';
import * as tags from './tags.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const clientIp = (req) => req.ip || req.socket.remoteAddress || 'onbekend';
const sanitizeId = (id) => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'x';

// Notificeer een deel-gebeurtenis via webhook én (indien mogelijk) e-mail naar
// de eigenaar of het ingestelde notificatie-adres.
function notifyShare(event, owner, detail) {
  notify(event, { owner, ...detail });
  const to = config.notifyEmail || getEmail(owner);
  if (!to) return;
  const subject = event === 'share_access' ? 'Je gedeelde bestand is gedownload' : 'Er is een deel-link aangemaakt';
  const text = `Gebeurtenis: ${event}\nPad: ${detail.path}\n${detail.ip ? 'IP: ' + detail.ip + '\n' : ''}`;
  sendMail({ to, subject, text }).catch((e) => console.error('[notify-mail]', e.message));
}

// Draai het optionele post-upload-commando (bijv. off-site backup naar S3).
function runPostUpload(filePath) {
  if (!config.postUploadCmd) return;
  const [cmd, ...args] = config.postUploadCmd.split(' ');
  execFile(cmd, [...args, filePath], (err) => {
    if (err) console.error('[post-upload] mislukt:', err.message);
  });
}

// Bepaal de geauthenticeerde gebruiker uit sessie-cookie of Basic Auth.
function authenticate(req, res, next) {
  const ip = clientIp(req);
  if (isBanned(ip)) return res.status(403).send('IP geblokkeerd.');

  // 1. Sessie-cookie.
  const token = tokenFromReq(req);
  if (token) {
    const s = getSession(token);
    if (s && userExists(s.username) && !isExpired(s.username) && sessionBindOk(s, req, ip)) {
      req.user = s.username;
      req.home = homeDir(s.username);
      req.userRole = role(s.username);
      req.sid = token;
      return next();
    }
  }

  // 2. HTTP Basic Auth (voor API-clients, SFTP-parity en WebDAV).
  const gate = checkAllowed('web:' + ip);
  if (!gate.allowed) {
    res.set('Retry-After', Math.ceil(gate.retryAfterMs / 1000));
    return res.status(429).send('Te veel mislukte pogingen. Probeer later opnieuw.');
  }
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (userExists(user) && verifyPassword(user, pass)) {
      recordSuccess('web:' + ip);
      req.user = user;
      req.home = homeDir(user);
      req.userRole = role(user);
      return next();
    }
    onLoginFailure(ip, user);
  }
  res.set('WWW-Authenticate', 'Basic realm="SFTP Fileserver"');
  res.status(401).send('Authenticatie vereist');
}

function onLoginFailure(ip, user) {
  recordFailure('web:' + ip);
  metrics.inc('fileserver_login_failures_total');
  audit('web', user, 'login_failed', { ip });
  if (!checkAllowed('web:' + ip).allowed && !isBanned(ip)) {
    ban(ip, Date.now() + config.rateLimit.blockMs);
    audit('web', user, 'ip_banned', { ip, minutes: Math.round(config.rateLimit.blockMs / 60000) });
  }
}

// Sessie-binding: weiger een sessie-cookie die vanaf een ander IP/User-Agent
// komt dan waarmee is ingelogd (afhankelijk van SESSION_BIND).
function sessionBindOk(s, req, ip) {
  const mode = config.sessionBindMode;
  if (mode === 'off') return true;
  const ua = (req.headers['user-agent'] || '').slice(0, 200);
  const ipOk = mode === 'ua' || !s.ip || s.ip === ip;
  const uaOk = mode === 'ip' || !s.ua || s.ua === ua;
  return ipOk && uaOk;
}

// Step-up: gevoelige acties vereisen een recente wachtwoord-herbevestiging.
function requireReauth(req, res, next) {
  if (!config.reauthWindowMs) return next();
  if (req.sid && reauthedWithin(req.sid, config.reauthWindowMs)) return next();
  // Basic-Auth-clients (geen sessie) leveren elke keer credentials → sta toe.
  if (!req.sid) return next();
  return res.status(403).json({ error: 'Herbevestig je wachtwoord', code: 'reauth' });
}

function requireWrite(req, res, next) {
  if (isReadonly(req.user)) return res.status(403).json({ error: 'Alleen-lezen account' });
  next();
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Alleen voor beheerders' });
  next();
}

async function listDir(home, dir, base = home) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const items = await Promise.all(
    entries
      .filter((e) => !(dir === home && (e.name === config.trashName || e.name === config.versionsName || e.name === '.metadata.json')))
      .map(async (e) => {
        const stat = await fsp.stat(path.join(dir, e.name)).catch(() => null);
        return {
          name: e.name,
          path: '/' + path.relative(base, path.join(dir, e.name)).split(path.sep).join('/'),
          isDir: e.isDirectory(),
          size: stat ? stat.size : 0,
          mtime: stat ? stat.mtimeMs : 0,
        };
      }),
  );
  return items;
}

function sortItems(items, sort, order) {
  const dir = order === 'desc' ? -1 : 1;
  items.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    if (sort === 'size') cmp = a.size - b.size;
    else if (sort === 'mtime') cmp = a.mtime - b.mtime;
    else cmp = a.name.localeCompare(b.name);
    return cmp * dir;
  });
  return items;
}

function ipAllowed(ip) {
  if (!config.ipAllowlist.length) return true;
  // Eenvoudige match: exact IP of prefix (voor CIDR /24-achtig gebruik prefix).
  return config.ipAllowlist.some((entry) => {
    if (entry.includes('/')) return ip.startsWith(entry.split('/')[0].split('.').slice(0, 3).join('.'));
    return ip === entry || (ip && ip.endsWith(entry));
  });
}

export function createWebServer() {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  // Health-endpoint voor uptime-monitoring (geen auth, geen geheimen).
  app.get('/health', (req, res) => res.json({ status: 'ok', version: config.version, uptime: Math.round(process.uptime()) }));

  // Readiness-probe: is de opslag beschrijfbaar en zijn er gebruikers geladen?
  // Geeft 503 terug als iets niet klopt, zodat een load-balancer/systemd kan
  // ingrijpen. Geen auth, geen geheimen.
  app.get('/ready', (req, res) => {
    const checks = { storageWritable: false, usersLoaded: false };
    try {
      const probe = path.join(config.storageDir, '.ready-probe');
      fs.writeFileSync(probe, '1'); fs.rmSync(probe);
      checks.storageWritable = true;
    } catch { /* niet beschrijfbaar */ }
    checks.usersLoaded = listUsernames().length > 0;
    const ready = checks.storageWritable && checks.usersLoaded;
    res.status(ready ? 200 : 503).json({ ready, checks, version: config.version, uptime: Math.round(process.uptime()) });
  });

  // IP-allowlist: buiten de toegestane IP's meteen weigeren.
  app.use((req, res, next) => {
    if (req.path === '/health') return next();
    if (!ipAllowed(clientIp(req))) return res.status(403).send('Toegang geweigerd (IP niet toegestaan).');
    next();
  });

  // Geo-blokkering: alleen toegestane landcodes (via proxy-header).
  app.use((req, res, next) => {
    if (!config.geoAllow.length || req.path === '/health') return next();
    const cc = (req.headers[config.geoHeader] || '').toString().toUpperCase();
    if (cc && !config.geoAllow.includes(cc)) return res.status(403).send('Toegang geweigerd (land niet toegestaan).');
    next();
  });

  // Security-headers op alle antwoorden (de preview-route zet een striktere CSP).
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; frame-ancestors 'self'; base-uri 'self'");
    if (config.tls.enabled) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // --- Login / sessies (geen auth vereist) ---
  app.post('/api/login', express.json(), (req, res) => {
    const ip = clientIp(req);
    if (isBanned(ip)) return res.status(403).json({ error: 'IP geblokkeerd' });
    if (!checkAllowed('web:' + ip).allowed) return res.status(429).json({ error: 'Te veel pogingen' });
    const { username, password, token } = req.body || {};
    if (username && isLocked(username)) return res.status(423).json({ error: 'Account tijdelijk vergrendeld na te veel pogingen' });
    if (username && isExpired(username)) return res.status(403).json({ error: 'Account is verlopen' });
    if (!userExists(username) || !verifyPassword(username, password)) {
      onLoginFailure(ip, username);
      if (username) recordLoginFailure(username);
      return res.status(401).json({ error: 'Onjuiste inloggegevens' });
    }
    const u = getUser(username);
    if (u.totp) {
      if (!token) return res.status(200).json({ need2fa: true });
      if (!verifyTotp(u.totp, token)) {
        onLoginFailure(ip, username);
        recordLoginFailure(username);
        return res.status(401).json({ error: 'Onjuiste 2FA-code' });
      }
    }
    // 2FA/passkey afdwingen: geen 2FA en geen passkey terwijl beleid dit vereist.
    const need2fa = config.requireTwoFactor === 'all' || (config.requireTwoFactor === 'admin' && role(username) === 'admin');
    if (need2fa && !u.totp && getCredentials(username).length === 0) {
      recordSuccess('web:' + ip);
      recordLoginSuccess(username);
      const sid = createSession(username, { ip, ua: req.headers['user-agent'] });
      res.set('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Strict; Path=/${config.tls.enabled ? '; Secure' : ''}`);
      return res.json({ ok: true, role: role(username), mustEnroll2fa: true });
    }
    recordSuccess('web:' + ip);
    recordLoginSuccess(username);
    // Nieuw-apparaat-melding per e-mail.
    const deviceId = createHash('sha256').update((req.headers['user-agent'] || '') + '|' + ip).digest('hex').slice(0, 16);
    if (!isKnownDevice(username, deviceId)) {
      rememberDevice(username, deviceId);
      const to = getEmail(username);
      if (to) sendMail({ to, subject: 'Nieuwe login op je account', text: `Er is ingelogd op je account vanaf een nieuw apparaat.\nIP: ${ip}\nBrowser: ${req.headers['user-agent'] || 'onbekend'}\nTijd: ${new Date().toISOString()}\n\nWas jij dit niet? Wijzig direct je wachtwoord.` }).catch((e) => console.error('[login-mail]', e.message));
    }
    const sid = createSession(username, { ip, ua: req.headers['user-agent'] });
    res.set('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Strict; Path=/${config.tls.enabled ? '; Secure' : ''}`);
    metrics.inc('fileserver_logins_total');
    emitAdmin('activity', { kind: 'login', user: username });
    audit('web', username, 'login', { ip });
    res.json({ ok: true, role: role(username) });
  });

  app.post('/api/logout', (req, res) => {
    const token = tokenFromReq(req);
    if (token) destroySession(token);
    res.set('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
    res.json({ ok: true });
  });

  // Step-up: wachtwoord herbevestigen om een korte periode gevoelige acties te
  // mogen doen (zie requireReauth).
  app.post('/api/reauth', authenticate, express.json(), (req, res) => {
    if (!verifyPassword(req.user, (req.body && req.body.password) || '')) {
      return res.status(401).json({ error: 'Onjuist wachtwoord' });
    }
    if (req.sid) markReauth(req.sid);
    audit('web', req.user, 'reauth', { ip: clientIp(req) });
    res.json({ ok: true });
  });

  // --- Wachtwoord-reset via e-mail (geen auth) ---
  app.post('/api/reset/request', express.json(), async (req, res) => {
    const { username } = req.body || {};
    // Altijd ok teruggeven (geen accountenumeratie).
    if (username && userExists(username)) {
      const token = createResetToken(username);
      const base = config.appBaseUrl || `${req.protocol}://${req.get('host')}`;
      const link = `${base}/reset.html?token=${token}`;
      await sendResetMail(getEmail(username), link, username).catch((e) => console.error('[reset]', e.message));
      audit('web', username, 'reset_requested', { ip: clientIp(req) });
    }
    res.json({ ok: true });
  });
  app.post('/api/reset/confirm', express.json(), async (req, res) => {
    const { token, password } = req.body || {};
    const user = consumeResetToken(token);
    if (!user || !password) return res.status(400).json({ error: 'Ongeldige of verlopen token' });
    const perr = validatePassword(password);
    if (perr) return res.status(400).json({ error: perr });
    if (await passwordPwnedCount(password) > 0) return res.status(400).json({ error: 'Dit wachtwoord komt voor in een datalek — kies een ander.' });
    updateUser(user, { password });
    audit('web', user, 'reset_done');
    res.json({ ok: true });
  });

  // --- Prometheus-metrics (eigen auth via token; geen sessie) ---
  app.get('/metrics', (req, res) => {
    if (!config.metrics.enabled) return res.status(404).end();
    if (config.metrics.token) {
      const auth = req.headers.authorization || '';
      if (auth !== 'Bearer ' + config.metrics.token) return res.status(401).end();
    }
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.end(metrics.render());
  });

  // --- OpenID Connect (SSO), optioneel ---
  app.get('/api/oidc/enabled', (req, res) => res.json({ enabled: config.oidc.enabled }));
  app.get('/api/oidc/login', async (req, res) => {
    if (!config.oidc.enabled) return res.status(404).send('OIDC niet ingeschakeld');
    try {
      res.redirect(await getAuthUrl());
    } catch (err) {
      res.status(500).send('OIDC-fout: ' + err.message);
    }
  });
  app.get('/api/oidc/callback', async (req, res) => {
    if (!config.oidc.enabled) return res.status(404).send('OIDC niet ingeschakeld');
    if (!validState(req.query.state)) return res.status(400).send('Ongeldige state');
    try {
      const { username, email } = await exchange(req.query.code);
      ensureExternalUser(username, email);
      const sid = createSession(username);
      res.set('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/${config.tls.enabled ? '; Secure' : ''}`);
      audit('web', username, 'login', { method: 'oidc' });
      res.redirect('/');
    } catch (err) {
      res.status(500).send('OIDC-fout: ' + err.message);
    }
  });

  // --- Passkey-login (geen auth) ---
  app.get('/api/webauthn/enabled', (req, res) => res.json({ enabled: config.webauthn.enabled }));
  app.post('/api/webauthn/login/options', express.json(), async (req, res) => {
    if (!config.webauthn.enabled || !userExists(req.body.username)) return res.status(400).json({ error: 'Niet beschikbaar' });
    res.json(await webauthn.authenticationOptions(req.body.username));
  });
  app.post('/api/webauthn/login/verify', express.json(), async (req, res) => {
    const ip = clientIp(req);
    try {
      const { username, response } = req.body || {};
      await webauthn.verifyAuthentication(username, response);
      const sid = createSession(username, { ip, ua: req.headers['user-agent'] });
      res.set('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Strict; Path=/${config.tls.enabled ? '; Secure' : ''}`);
      metrics.inc('fileserver_logins_total');
      audit('web', username, 'login', { method: 'passkey', ip });
      res.json({ ok: true, role: role(username) });
    } catch (err) { res.status(401).json({ error: err.message }); }
  });

  // --- Permalink per bestand (stabiele UUID-link, geen auth) ---
  app.get('/f/:uuid', (req, res) => {
    const entry = permalinks.resolve(req.params.uuid);
    if (!entry) return res.status(404).send('Link niet gevonden of verlopen.');
    if (!permalinks.checkPassword(entry, req.query.pw)) {
      return res.send(`<form style="font-family:sans-serif;max-width:320px;margin:3rem auto">
        <h3>Beveiligde link</h3><input name="pw" type="password" placeholder="Wachtwoord" style="width:100%;padding:.5rem">
        <button style="margin-top:.5rem;padding:.5rem 1rem">Openen</button></form>`);
    }
    let abs;
    try { abs = resolveWithin(homeDir(entry.user), entry.path); } catch { return res.status(404).send('Niet gevonden.'); }
    if (!fs.existsSync(abs)) return res.status(404).send('Bestand bestaat niet meer.');
    const name = path.basename(abs);
    checkHoneypot(entry.user, entry.path, 'permalink');
    audit('web', entry.user, 'permalink_access', { path: entry.path, uuid: req.params.uuid, ip: clientIp(req) });
    if (fs.statSync(abs).isDirectory()) {
      res.attachment(name + '.zip');
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      archive.directory(abs, false);
      return archive.finalize();
    }
    // Inline tonen kan met ?inline=1 (afbeeldingen/tekst/pdf); anders downloaden.
    if (req.query.inline === '1') {
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline; filename="' + name.replace(/[\r\n"]/g, '') + '"');
      return res.sendFile(abs);
    }
    res.download(abs, name);
  });

  // --- Publieke deel-links (geen auth) ---
  const pwForm = () => `<form style="font-family:sans-serif;max-width:320px;margin:3rem auto">
    <h3>Beveiligde link</h3><input name="pw" type="password" placeholder="Wachtwoord" style="width:100%;padding:.5rem">
    <button style="margin-top:.5rem;padding:.5rem 1rem">Openen</button></form>`;

  app.get('/s/:token', (req, res) => {
    const share = getShare(req.params.token);
    if (!share) return res.status(404).send('Link niet gevonden of verlopen.');
    if (!checkSharePassword(share, req.query.pw)) return res.send(pwForm());

    // Drop-link (upload-portaal): toon een uploadformulier i.p.v. download.
    if (share.type === 'upload') {
      const pw = req.query.pw ? `?pw=${encodeURIComponent(req.query.pw)}` : '';
      return res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <div style="font-family:system-ui,sans-serif;max-width:420px;margin:3rem auto;padding:1.5rem;border:1px solid #ccc;border-radius:10px">
        <h2>📤 Bestanden aanleveren</h2>
        <p style="color:#666">Kies bestanden om te uploaden naar deze gedeelde map.</p>
        <form method="post" action="/s/${req.params.token}/upload${pw}" enctype="multipart/form-data">
          <input type="file" name="files" multiple required>
          <button style="margin-top:1rem;padding:.6rem 1.2rem">Uploaden</button>
        </form></div>`);
    }

    const abs = resolveWithin(homeDir(share.user), share.path);
    const name = path.basename(abs);
    audit('web', share.user, 'share_access', { path: share.path, token: req.params.token });
    notifyShare('share_access', share.user, { path: share.path, ip: clientIp(req) });
    countDownload(req.params.token);
    if (fs.statSync(abs).isDirectory()) {
      res.attachment(name + '.zip');
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      archive.directory(abs, false);
      return archive.finalize();
    }
    res.download(abs, name);
  });

  // Ontvang uploads op een drop-link (geen account nodig).
  const dropUpload = multer({
    storage: multer.diskStorage({
      destination(req, file, cb) {
        const share = getShare(req.params.token);
        if (!share || share.type !== 'upload' || !checkSharePassword(share, req.query.pw)) return cb(new Error('Ongeldige link'));
        try {
          const dir = resolveWithin(homeDir(share.user), share.path);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        } catch (err) { cb(err); }
      },
      filename(req, file, cb) { cb(null, path.basename(file.originalname)); },
    }),
  });
  app.post('/s/:token/upload', dropUpload.array('files'), async (req, res) => {
    const share = getShare(req.params.token);
    if (!share || share.type !== 'upload') return res.status(404).send('Link niet gevonden.');
    // Scan aangeleverde bestanden; besmette naar quarantaine.
    for (const f of req.files || []) {
      const scan = await scanFile(f.path);
      if (!scan.clean) { quarantine(f.path, { user: share.user, home: homeDir(share.user), targetPath: share.path, filename: f.originalname, detail: scan.detail }); }
    }
    countUpload(req.params.token);
    audit('web', share.user, 'drop_upload', { path: share.path, files: (req.files || []).map((f) => f.originalname), ip: clientIp(req) });
    notifyShare('drop_upload', share.user, { path: share.path, ip: clientIp(req) });
    emitToUser(share.user, 'change', { action: 'drop_upload' });
    res.send('<p style="font-family:sans-serif">✅ Bedankt, je bestanden zijn ontvangen. <a href="/s/' + req.params.token + '">Meer uploaden</a></p>');
  });

  // --- Alles hieronder vereist authenticatie ---
  app.use('/api', authenticate);

  // Onderhoudsmodus: alleen admins mogen erdoor.
  app.use('/api', (req, res, next) => {
    if (getSetting('maintenance') && !isAdmin(req.user) && req.path !== '/whoami') {
      return res.status(503).json({ error: 'Onderhoudsmodus actief' });
    }
    next();
  });

  // WebDAV (Basic Auth; eigen mount).
  if (config.webdavEnabled) {
    app.use(WEBDAV_MOUNT, authenticate, (req, res) => handleWebdav(req, res));
  }

  // tus resumable-uploadprotocol.
  app.use(TUS_MOUNT, authenticate, (req, res) => handleTus(req, res));

  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, cb) {
        try {
          // originalname kan een relatief pad bevatten (map-upload); behoud de mappen.
          const rel = path.posix.join(req.query.path || '/', path.dirname(file.originalname));
          const dir = resolveWithin(req.home, rel);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        } catch (err) {
          cb(err);
        }
      },
      filename(req, file, cb) {
        try {
          // Bewaar de vorige versie vóór overschrijven.
          const rel = path.posix.join(req.query.path || '/', path.dirname(file.originalname));
          snapshot(req.home, path.join(resolveWithin(req.home, rel), path.basename(file.originalname)));
        } catch { /* geen vorige versie */ }
        cb(null, path.basename(file.originalname));
      },
    }),
  });

  app.get('/api/whoami', (req, res) => {
    const used = dirSize(req.home);
    const trash = path.join(req.home, config.trashName);
    res.json({
      user: req.user,
      role: req.userRole,
      quota: quota(req.user),
      used, // telt de prullenbak mee
      trashUsed: fs.existsSync(trash) ? dirSize(trash) : 0,
      bandwidth: bandwidth(req.user),
      shared: sharedWith(req.user),
      require2fa: config.requireTwoFactor === 'all' || (config.requireTwoFactor === 'admin' && req.userRole === 'admin'),
      has2fa: !!getUser(req.user)?.totp || getCredentials(req.user).length > 0,
    });
  });

  // Realtime updates (Server-Sent Events).
  app.get('/api/events', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders?.();
    res.write(': verbonden\n\n');
    addClient(req.user, res);
  });

  app.get('/api/list', async (req, res) => {
    try {
      const dir = resolveWithin(req.home, req.query.path || '/');
      const query = (req.query.q || '').toString().toLowerCase();
      const inContent = req.query.content === '1';
      let items;
      if (query) {
        // Snelle omgekeerde index gebruiken als die bestaat en we vanaf de
        // home-root zoeken; anders live door de mappenboom lopen.
        const homeName = path.basename(req.home);
        const idxPaths = (dir === req.home && searchIndex.isReady()) ? searchIndex.query(homeName, query) : null;
        if (idxPaths) {
          items = (await Promise.all(idxPaths.map(async (p) => {
            const full = resolveWithin(req.home, p);
            const st = await fsp.stat(full).catch(() => null);
            if (!st) return null;
            return { name: path.basename(p), path: p, isDir: st.isDirectory(), size: st.size, mtime: st.mtimeMs };
          }))).filter(Boolean);
        } else {
          items = await searchRecursive(req.home, dir, query, 6, inContent);
        }
      } else {
        items = await listDir(req.home, dir);
      }
      items = sortItems(items, (req.query.sort || 'name').toString(), (req.query.order || 'asc').toString());
      res.json({ path: req.query.path || '/', items });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/download', (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.status(404).json({ error: 'Niet gevonden' });
      audit('web', req.user, 'download', { path: req.query.path });
      checkHoneypot(req.user, req.query.path || '', 'download');
      metrics.inc('fileserver_downloads_total');
      metrics.inc('fileserver_bytes_downloaded_total', fs.statSync(file).size);
      metrics.incUser(req.user, 'down', fs.statSync(file).size);
      emitAdmin('activity', { kind: 'download', user: req.user });
      const bw = bandwidth(req.user);
      if (bw > 0) {
        // Met bandbreedtelimiet: throttle de bytestroom.
        res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(file) + '"');
        res.setHeader('Content-Length', fs.statSync(file).size);
        fs.createReadStream(file).pipe(throttleStream(bw)).pipe(res);
      } else {
        res.download(file, path.basename(file));
      }
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/preview', (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.status(404).json({ error: 'Niet gevonden' });
      // Voorkom dat een geüploade HTML/SVG scripts uitvoert in de app-origin.
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(file).replace(/[\r\n"]/g, '') + '"');
      res.sendFile(file);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Thumbnail (verkleinde, gecachete afbeelding).
  app.get('/api/thumb', async (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      if (!fs.existsSync(file)) return res.status(404).end();
      const width = Math.min(512, parseInt(req.query.w || '200', 10) || 200);
      const thumb = await getThumbnail(file, width);
      if (!thumb) { res.setHeader('Content-Disposition', 'inline'); return res.sendFile(file); }
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.type('webp').sendFile(thumb);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Metadata: tags, commentaar, favorieten.
  app.get('/api/meta', (req, res) => {
    if (req.query.all !== undefined) return res.json({ meta: getAllMeta(req.home) });
    res.json({ meta: getMeta(req.home, req.query.path || '') });
  });
  app.post('/api/meta', requireWrite, express.json(), (req, res) => {
    const meta = setMeta(req.home, req.body.path, {
      tags: req.body.tags, comment: req.body.comment, favorite: req.body.favorite,
    });
    res.json({ meta });
  });
  app.get('/api/favorites', (req, res) => {
    const all = getAllMeta(req.home);
    res.json({ favorites: Object.entries(all).filter(([, m]) => m.favorite).map(([p, m]) => ({ path: p, ...m })) });
  });

  // Gedeelde bestandscommentaren (zichtbaar voor iedereen met toegang).
  // Met ?owner= kan een gebruiker met gedeelde toegang de comments van de
  // eigenaar zien/toevoegen.
  function commentOwner(req, p) {
    const owner = (req.query.owner || (req.body && req.body.owner));
    if (!owner || owner === req.user) return req.user;
    const ok = sharedWith(req.user).some((s) => s.owner === owner && (p === s.path || p.startsWith(s.path + '/') || s.path === '/'));
    if (!ok) throw new Error('Geen toegang');
    return owner;
  }
  app.get('/api/comments', (req, res) => {
    try { res.json({ comments: comments.getComments(commentOwner(req, req.query.path || ''), req.query.path || '') }); }
    catch (err) { res.status(403).json({ error: err.message }); }
  });
  app.post('/api/comments', express.json(), (req, res) => {
    if (!req.body.text) return res.status(400).json({ error: 'Lege comment' });
    try {
      const owner = commentOwner(req, req.body.path || '');
      const list = comments.addComment(owner, req.body.path || '', req.user, req.body.text);
      emitToUser(owner, 'change', { action: 'comment' });
      res.json({ comments: list });
    } catch (err) { res.status(403).json({ error: err.message }); }
  });
  app.delete('/api/comments', express.json(), (req, res) => {
    const ok = comments.deleteComment(req.user, req.body.path || '', req.body.index, req.user, isAdmin(req.user));
    res.json({ ok });
  });

  // --- Versiegeschiedenis ---
  app.get('/api/versions', (req, res) => {
    res.json({ versions: listVersions(req.home, req.query.path || '') });
  });
  app.get('/api/version/download', (req, res) => {
    try {
      const p = versionPath(req.home, req.query.path || '', req.query.version || '');
      res.download(p, path.basename(req.query.path) + '.' + req.query.version);
    } catch (err) { res.status(404).json({ error: err.message }); }
  });
  app.post('/api/version/restore', requireWrite, express.json(), async (req, res) => {
    try {
      const cur = resolveWithin(req.home, req.body.path || '');
      const vp = versionPath(req.home, req.body.path || '', req.body.version || '');
      snapshot(req.home, cur); // huidige versie ook bewaren
      await fsp.copyFile(vp, cur);
      audit('web', req.user, 'version_restore', { path: req.body.path, version: req.body.version });
      emitToUser(req.user, 'change', { action: 'version_restore' });
      res.json({ ok: true });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // --- Delta-sync (rsync-achtig) ---
  app.get('/api/sync/signature', (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      res.json(signature(file, DEFAULT_BLOCK));
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/sync/apply', requireWrite, express.json({ limit: '200mb' }), async (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      // Quota-controle op de nieuwe grootte.
      const newSize = (req.body.ops || []).reduce((n, op) => n + (op.d !== undefined ? Buffer.byteLength(op.d, 'base64') : (req.body.blockSize || DEFAULT_BLOCK)), 0);
      const q = quota(req.user);
      if (q > 0) {
        const oldSize = fs.existsSync(file) ? fs.statSync(file).size : 0;
        if (dirSize(req.home) - oldSize + newSize > q) return res.status(413).json({ error: 'Quota overschreden' });
      }
      snapshot(req.home, file);
      await fsp.mkdir(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp-' + Date.now();
      applyDelta(file, tmp, req.body.blockSize || DEFAULT_BLOCK, req.body.ops || []);
      await fsp.rename(tmp, file);
      audit('web', req.user, 'sync', { path: req.query.path });
      emitToUser(req.user, 'change', { action: 'sync' });
      res.json({ ok: true, size: fs.statSync(file).size });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // --- E2E-sleutelbeheer ---
  app.get('/api/keys/pubkey', (req, res) => res.json({ pubkey: keyring.getPubkey(req.query.user || req.user) }));
  app.post('/api/keys/pubkey', express.json(), (req, res) => { keyring.setPubkey(req.user, req.body.jwk); res.json({ ok: true }); });
  app.get('/api/keyring', (req, res) => res.json({ ring: keyring.getRing(req.user) }));
  app.post('/api/keyring', express.json(), (req, res) => {
    // Sla een (met de eigen publieke sleutel) gewrapte map-sleutel op, of deel er
    // een met een andere gebruiker (dan is target die gebruiker).
    const target = req.body.to || req.user;
    keyring.putKey(target, req.body.folder, req.body.wrappedKey, req.user);
    audit('web', req.user, 'keyshare', { to: target, folder: req.body.folder });
    res.json({ ok: true });
  });
  app.delete('/api/keyring', express.json(), (req, res) => { keyring.removeKey(req.user, req.body.folder); res.json({ ok: true }); });
  // Rotatiebeleid + mappen die aan rotatie toe zijn.
  app.get('/api/keyring/due', (req, res) => res.json({ rotateAfterDays: config.keyRotateDays, due: keyring.dueForRotation(req.user, config.keyRotateDays) }));
  // Een geroteerde (nieuwe, gewrapte) sleutel opslaan; verhoogt de versie.
  app.post('/api/keyring/rotate', express.json(), (req, res) => {
    keyring.putKey(req.user, req.body.folder, req.body.wrappedKey, req.user);
    audit('web', req.user, 'key_rotate', { folder: req.body.folder });
    res.json({ ok: true, version: keyring.getRing(req.user)[req.body.folder].version });
  });

  app.get('/api/zip', (req, res) => {
    try {
      const dir = resolveWithin(req.home, req.query.path || '/');
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return res.status(404).json({ error: 'Map niet gevonden' });
      res.attachment((path.basename(dir) || 'archief') + '.zip');
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => res.status(500).end(err.message));
      archive.pipe(res);
      archive.directory(dir, false);
      audit('web', req.user, 'zip', { path: req.query.path });
      archive.finalize();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk-download: meerdere bestanden/mappen als één ZIP.
  app.post('/api/bulkzip', express.json(), (req, res) => {
    try {
      const paths = req.body.paths || [];
      res.attachment('selectie.zip');
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => res.status(500).end(err.message));
      archive.pipe(res);
      for (const p of paths) {
        const abs = resolveWithin(req.home, p);
        if (!fs.existsSync(abs)) continue;
        if (fs.statSync(abs).isDirectory()) archive.directory(abs, path.basename(abs));
        else archive.file(abs, { name: path.basename(abs) });
      }
      archive.finalize();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/upload', requireWrite, (req, res, next) => {
    // Quota-controle vooraf op basis van Content-Length.
    const q = quota(req.user);
    if (q > 0) {
      const incoming = parseInt(req.headers['content-length'] || '0', 10);
      if (dirSize(req.home) + incoming > q) return res.status(413).json({ error: 'Quota overschreden' });
    }
    next();
  }, upload.array('files'), async (req, res) => {
    const names = [];
    const infected = [];
    for (const f of req.files || []) {
      const scan = await scanFile(f.path);
      if (!scan.clean) {
        // Niet weigeren, maar in quarantaine plaatsen voor beoordeling.
        quarantine(f.path, { user: req.user, home: req.home, targetPath: req.query.path || '/', filename: f.originalname, detail: scan.detail });
        infected.push(f.originalname);
        audit('web', req.user, 'quarantined', { file: f.originalname, detail: scan.detail });
        notify('quarantine', { user: req.user, file: f.originalname });
        sysAlert('quarantine', 'Bestand in quarantaine', `Upload '${f.originalname}' van '${req.user}' is besmet: ${scan.detail||''}`);
        emitAdmin('activity', { kind: 'quarantine', user: req.user });
        continue;
      }
      names.push(f.originalname);
      runPostUpload(f.path);
    }
    audit('web', req.user, 'upload', { path: req.query.path || '/', files: names });
    notify('upload', { user: req.user, files: names });
    emitToUser(req.user, 'change', { action: 'upload' });
    metrics.inc('fileserver_uploads_total', names.length);
    for (const f of req.files || []) { metrics.inc('fileserver_bytes_uploaded_total', f.size || 0); metrics.incUser(req.user, 'up', f.size || 0); }
    emitAdmin('activity', { kind: 'upload', user: req.user });
    if (infected.length) return res.status(422).json({ uploaded: names, infected });
    res.json({ uploaded: names });
  });

  // Hervatbare (chunked) upload voor grote bestanden.
  const chunkUpload = multer({ storage: multer.memoryStorage() });
  app.get('/api/upload/status', (req, res) => {
    const dir = path.join(config.chunkDir, sanitizeId(req.query.uploadId));
    if (!fs.existsSync(dir)) return res.json({ received: [] });
    res.json({ received: fs.readdirSync(dir).map((n) => parseInt(n, 10)).sort((a, b) => a - b) });
  });
  app.post('/api/upload/chunk', requireWrite, chunkUpload.single('chunk'), async (req, res) => {
    try {
      const id = sanitizeId(req.query.uploadId);
      const index = parseInt(req.query.index, 10);
      const total = parseInt(req.query.total, 10);
      const dir = path.join(config.chunkDir, id);
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, String(index)), req.file.buffer);
      const have = fs.readdirSync(dir).length;
      if (have < total) return res.json({ ok: true, complete: false, received: have });

      // Alle chunks binnen: samenvoegen naar het doelbestand.
      const dest = resolveWithin(req.home, path.posix.join(req.query.path || '/', path.basename(req.query.name)));
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      const out = fs.createWriteStream(dest);
      for (let i = 0; i < total; i++) {
        out.write(await fsp.readFile(path.join(dir, String(i))));
      }
      out.end();
      await new Promise((r) => out.on('close', r));
      await fsp.rm(dir, { recursive: true, force: true });

      const scan = await scanFile(dest);
      if (!scan.clean) { await fsp.rm(dest, { force: true }); return res.status(422).json({ error: 'Virus gevonden', detail: scan.detail }); }
      runPostUpload(dest);
      audit('web', req.user, 'upload', { path: req.query.path, files: [req.query.name], chunked: true });
      notify('upload', { user: req.user, files: [req.query.name] });
      emitToUser(req.user, 'change', { action: 'upload' });
      res.json({ ok: true, complete: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Tekst-editor: bestand opslaan.
  app.post('/api/save', requireWrite, express.text({ limit: '5mb', type: '*/*' }), async (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      await fsp.mkdir(path.dirname(file), { recursive: true });
      snapshot(req.home, file);
      await fsp.writeFile(file, req.body ?? '');
      recordMutation(req.user, 'edit'); checkHoneypot(req.user, req.query.path || '', 'edit');
      audit('web', req.user, 'edit', { path: req.query.path });
      emitToUser(req.user, 'change', { action: 'edit' });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/mkdir', requireWrite, express.json(), async (req, res) => {
    try {
      const target = resolveWithin(req.home, path.posix.join(req.body.path || '/', req.body.name || ''));
      await fsp.mkdir(target, { recursive: true });
      audit('web', req.user, 'mkdir', { path: req.body.path, name: req.body.name });
      emitToUser(req.user, 'change', { action: 'mkdir' });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/rename', requireWrite, express.json(), async (req, res) => {
    try {
      const from = resolveWithin(req.home, req.body.from || '');
      const to = resolveWithin(req.home, req.body.to || '');
      await fsp.mkdir(path.dirname(to), { recursive: true });
      await fsp.rename(from, to);
      permalinks.updatePath(req.user, req.body.from, req.body.to);
      tags.movePath(req.user, req.body.from, req.body.to);
      recordMutation(req.user, 'rename'); checkHoneypot(req.user, req.body.from, 'rename');
      audit('web', req.user, 'rename', { from: req.body.from, to: req.body.to });
      emitToUser(req.user, 'change', { action: 'rename' });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Verwijderen = verplaatsen naar de prullenbak.
  app.post('/api/delete', requireWrite, express.json(), async (req, res) => {
    try {
      const targets = req.body.paths || [req.body.path];
      const trash = path.join(req.home, config.trashName);
      await fsp.mkdir(trash, { recursive: true });
      for (const p of targets) {
        const abs = resolveWithin(req.home, p);
        if (path.resolve(abs) === path.resolve(req.home)) continue;
        const dest = path.join(trash, Date.now() + '_' + path.basename(abs));
        await fsp.rename(abs, dest).catch(async () => {
          await fsp.rm(abs, { recursive: true, force: true });
        });
        permalinks.removeForPath(req.user, p);
        tags.removePath(req.user, p);
        recordMutation(req.user, 'delete'); checkHoneypot(req.user, p, 'delete');
        audit('web', req.user, 'delete', { path: p });
        notify('delete', { user: req.user, path: p });
        metrics.inc('fileserver_deletes_total');
      }
      emitAdmin('activity', { kind: 'delete', user: req.user });
      emitToUser(req.user, 'change', { action: 'delete' });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk-verplaatsen: meerdere bestanden/mappen naar één doelmap.
  app.post('/api/bulk/move', requireWrite, express.json(), async (req, res) => {
    try {
      const targetDir = resolveWithin(req.home, req.body.dest || '/');
      await fsp.mkdir(targetDir, { recursive: true });
      let moved = 0;
      for (const p of req.body.paths || []) {
        const abs = resolveWithin(req.home, p);
        if (path.resolve(abs) === path.resolve(req.home)) continue;
        const dest = path.join(targetDir, path.basename(abs));
        await fsp.rename(abs, dest);
        const destRel = '/' + path.relative(req.home, dest).split(path.sep).join('/');
        permalinks.updatePath(req.user, p, destRel);
        tags.movePath(req.user, p, destRel);
        moved++;
      }
      recordMutation(req.user, 'rename');
      audit('web', req.user, 'bulk_move', { count: moved, dest: req.body.dest });
      emitToUser(req.user, 'change', { action: 'bulk_move' });
      res.json({ ok: true, moved });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Tags/labels per bestand.
  app.get('/api/tags', (req, res) => {
    if (req.query.tag) return res.json({ paths: tags.findByTag(req.user, req.query.tag) });
    if (req.query.path !== undefined) return res.json({ tags: tags.getTags(req.user, req.query.path) });
    res.json({ tags: tags.listTags(req.user) });
  });
  app.post('/api/tags', requireWrite, express.json(), (req, res) => {
    const set = tags.setTags(req.user, req.body.path || '', req.body.tags || []);
    audit('web', req.user, 'set_tags', { path: req.body.path, tags: set });
    res.json({ ok: true, tags: set });
  });

  // Prullenbak bekijken / herstellen / legen.
  app.get('/api/trash', async (req, res) => {
    try {
      const trash = path.join(req.home, config.trashName);
      if (!fs.existsSync(trash)) return res.json({ items: [] });
      res.json({ items: await listDir(req.home, trash, trash) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.post('/api/restore', requireWrite, express.json(), async (req, res) => {
    try {
      const trash = path.join(req.home, config.trashName);
      const abs = resolveWithin(trash, req.body.path || '');
      const original = path.basename(abs).replace(/^\d+_/, '');
      const dest = resolveWithin(req.home, '/' + original);
      await fsp.rename(abs, dest);
      audit('web', req.user, 'restore', { path: original });
      emitToUser(req.user, 'change', { action: 'restore' });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.post('/api/trash/empty', requireWrite, async (req, res) => {
    try {
      await fsp.rm(path.join(req.home, config.trashName), { recursive: true, force: true });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Deel-links ---
  app.post('/api/share', requireWrite, express.json(), (req, res) => {
    const token = createShare(req.user, req.body.path, {
      expiresInHours: req.body.expiresInHours ? Number(req.body.expiresInHours) : 0,
      password: req.body.password || null,
      maxDownloads: req.body.maxDownloads ? Number(req.body.maxDownloads) : 0,
    });
    audit('web', req.user, 'share_create', { path: req.body.path });
    notifyShare('share_create', req.user, { path: req.body.path, token });
    emitAdmin('activity', { kind: 'share', user: req.user });
    res.json({ token, url: `/s/${token}` });
  });
  app.get('/api/shares', (req, res) => res.json({ shares: listShares(req.user) }));
  app.delete('/api/share/:token', (req, res) => res.json({ ok: deleteShare(req.user, req.params.token) }));

  // Drop-link (upload-portaal) aanmaken.
  app.post('/api/droplink', requireWrite, express.json(), (req, res) => {
    const token = createShare(req.user, req.body.path || '/', {
      type: 'upload',
      expiresInHours: req.body.expiresInHours ? Number(req.body.expiresInHours) : 0,
      password: req.body.password || null,
    });
    audit('web', req.user, 'droplink_create', { path: req.body.path });
    res.json({ token, url: `/s/${token}` });
  });

  // Stabiele permalink voor een bestand ophalen/aanmaken (optioneel met
  // wachtwoord en vervaldatum).
  app.post('/api/permalink', requireWrite, express.json(), (req, res) => {
    try {
      const rel = req.body.path || '';
      resolveWithin(req.home, rel); // valideer dat het pad binnen de home valt
      const opts = {};
      if (req.body.password !== undefined) opts.password = req.body.password || null;
      if (req.body.expiresInHours !== undefined) opts.expiresInHours = req.body.expiresInHours ? Number(req.body.expiresInHours) : 0;
      const uuid = permalinks.getOrCreate(req.user, rel, opts);
      const base = config.appBaseUrl || `${req.protocol}://${req.get('host')}`;
      audit('web', req.user, 'permalink_create', { path: rel });
      res.json({ uuid, url: `${base}/f/${uuid}` });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // QR-code (SVG) voor een deel-link/tekst.
  app.get('/api/qr', async (req, res) => {
    try {
      const base = config.appBaseUrl || `${req.protocol}://${req.get('host')}`;
      const text = (req.query.text || '').toString();
      const url = text.startsWith('http') ? text : base + text;
      res.type('svg').send(await qrSvg(url));
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // --- Actieve sessies beheren ---
  app.get('/api/sessions', (req, res) => res.json({ sessions: listSessions(req.user, tokenFromReq(req)) }));
  app.delete('/api/sessions/:id', (req, res) => res.json({ ok: revokeSession(req.user, req.params.id) }));

  // --- Passkeys / WebAuthn (aangemeld) ---
  app.get('/api/webauthn/count', (req, res) => res.json({ enabled: config.webauthn.enabled, count: getCredentials(req.user).length }));
  app.post('/api/webauthn/register/options', async (req, res) => {
    if (!config.webauthn.enabled) return res.status(400).json({ error: 'WebAuthn niet geconfigureerd' });
    res.json(await webauthn.registrationOptions(req.user));
  });
  app.post('/api/webauthn/register/verify', express.json(), async (req, res) => {
    try { await webauthn.verifyRegistration(req.user, req.body); audit('web', req.user, 'passkey_added'); res.json({ ok: true }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  // --- Gedeelde mappen van anderen (alleen-lezen of lezen+schrijven) ---
  // needWrite=true vereist dat de deling mode 'rw' heeft.
  function resolveShared(req, pathValue, needWrite = false) {
    const owner = req.query.owner || (req.body && req.body.owner);
    const rel = pathValue !== undefined ? pathValue : (req.query.path || '/');
    const grants = sharedWith(req.user).filter((s) => s.owner === owner);
    if (!grants.length) throw new Error('Geen toegang');
    const ownerHome = homeDir(owner);
    const abs = resolveWithin(ownerHome, rel);
    const match = grants.find((g) => {
      const base = resolveWithin(ownerHome, g.path);
      return abs === base || abs.startsWith(base + path.sep);
    });
    if (!match) throw new Error('Geen toegang');
    if (needWrite && match.mode !== 'rw') throw new Error('Alleen-lezen deling');
    return { abs, ownerHome, mode: match.mode };
  }
  app.get('/api/shared/list', async (req, res) => {
    try {
      const { abs, ownerHome, mode } = resolveShared(req);
      res.json({ mode, items: sortItems(await listDir(ownerHome, abs), 'name', 'asc') });
    } catch (err) {
      res.status(403).json({ error: err.message });
    }
  });
  app.get('/api/shared/download', (req, res) => {
    try {
      const { abs } = resolveShared(req);
      res.download(abs, path.basename(abs));
    } catch (err) {
      res.status(403).json({ error: err.message });
    }
  });
  // Schrijven in een met mij gedeelde 'rw'-map.
  const sharedUpload = multer({
    storage: multer.diskStorage({
      destination(req, file, cb) {
        try { const { abs } = resolveShared(req, req.query.path || '/', true); fs.mkdirSync(abs, { recursive: true }); cb(null, abs); }
        catch (err) { cb(err); }
      },
      filename(req, file, cb) { cb(null, path.basename(file.originalname)); },
    }),
  });
  app.post('/api/shared/upload', sharedUpload.array('files'), (req, res) => {
    audit('web', req.user, 'shared_upload', { owner: req.query.owner, path: req.query.path });
    emitToUser(req.query.owner, 'change', { action: 'shared_upload' });
    res.json({ uploaded: (req.files || []).map((f) => f.originalname) });
  });
  app.post('/api/shared/mkdir', express.json(), async (req, res) => {
    try {
      const { abs } = resolveShared(req, path.posix.join(req.body.path || '/', req.body.name || ''), true);
      await fsp.mkdir(abs, { recursive: true });
      emitToUser(req.body.owner, 'change', { action: 'shared_mkdir' });
      res.json({ ok: true });
    } catch (err) { res.status(403).json({ error: err.message }); }
  });
  app.post('/api/shared/delete', express.json(), async (req, res) => {
    try {
      const { abs } = resolveShared(req, req.body.path, true);
      await fsp.rm(abs, { recursive: true, force: true });
      audit('web', req.user, 'shared_delete', { owner: req.body.owner, path: req.body.path });
      emitToUser(req.body.owner, 'change', { action: 'shared_delete' });
      res.json({ ok: true });
    } catch (err) { res.status(403).json({ error: err.message }); }
  });

  // Een eigen map delen met een andere gebruiker (grant).
  app.post('/api/grant', requireWrite, express.json(), (req, res) => {
    const u = getUser(req.user);
    const shares = (u.shares || []).filter((s) => !(s.to === req.body.to && s.path === req.body.path));
    shares.push({ to: req.body.to, path: req.body.path, mode: req.body.mode === 'rw' ? 'rw' : 'ro' });
    updateUser(req.user, { shares });
    audit('web', req.user, 'grant', { to: req.body.to, path: req.body.path, mode: req.body.mode });
    res.json({ ok: true });
  });
  app.delete('/api/grant', express.json(), (req, res) => {
    const u = getUser(req.user);
    updateUser(req.user, { shares: (u.shares || []).filter((s) => !(s.to === req.body.to && s.path === req.body.path)) });
    res.json({ ok: true });
  });
  app.get('/api/grants', (req, res) => res.json({ grants: (getUser(req.user).shares) || [] }));

  // --- 2FA ---
  app.post('/api/2fa/setup', (req, res) => {
    const secret = generateSecret();
    req._pendingSecret = secret;
    res.json({ secret, otpauth: otpauthUrl(secret, req.user) });
  });
  app.post('/api/2fa/enable', express.json(), (req, res) => {
    const { secret, token } = req.body || {};
    if (!verifyTotp(secret, token)) return res.status(400).json({ error: 'Onjuiste code' });
    updateUser(req.user, { totp: secret });
    audit('web', req.user, '2fa_enabled');
    res.json({ ok: true });
  });
  app.post('/api/2fa/disable', (req, res) => {
    updateUser(req.user, { totp: null });
    audit('web', req.user, '2fa_disabled');
    res.json({ ok: true });
  });

  // --- Admin ---
  app.get('/api/admin/users', requireAdmin, (req, res) => res.json({ users: listUsers() }));
  app.post('/api/admin/users', requireAdmin, express.json(), async (req, res) => {
    try {
      const perr = validatePassword(req.body.password);
      if (perr) return res.status(400).json({ error: perr });
      if (await passwordPwnedCount(req.body.password) > 0) return res.status(400).json({ error: 'Wachtwoord komt voor in een datalek.' });
      addUser(req.body);
      audit('web', req.user, 'admin_add_user', { target: req.body.username });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.patch('/api/admin/users/:name', requireAdmin, express.json(), (req, res) => {
    try {
      updateUser(req.params.name, req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.delete('/api/admin/users/:name', requireAdmin, requireReauth, (req, res) => {
    try {
      deleteUser(req.params.name);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.get('/api/admin/audit', requireAdmin, (req, res) => {
    if (!fs.existsSync(config.auditLog)) return res.json({ lines: [] });
    const lines = fs.readFileSync(config.auditLog, 'utf8').trim().split('\n').slice(-200).filter(Boolean).map((l) => JSON.parse(l));
    res.json({ lines });
  });
  // Verifieer de onvervalsbaarheid van het audit-log (hash-keten).
  app.get('/api/admin/audit/verify', requireAdmin, (req, res) => {
    res.json(verifyChain());
  });
  // Back-ups (alleen admin).
  app.get('/api/admin/backups', requireAdmin, (req, res) => {
    if (!fs.existsSync(config.backup.dir)) return res.json({ backups: [] });
    const backups = fs.readdirSync(config.backup.dir).filter((f) => f.endsWith('.zip'))
      .map((f) => ({ name: f, size: fs.statSync(path.join(config.backup.dir, f)).size })).sort((a, b) => b.name.localeCompare(a.name));
    res.json({ backups });
  });
  app.post('/api/admin/backup', requireAdmin, async (req, res) => {
    try {
      const dest = await makeBackup();
      res.json({ ok: true, file: path.basename(dest) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Overzicht met belangrijke info (alleen admin).
  app.get('/api/admin/overview', requireAdmin, (req, res) => {
    const users = listUsers();
    const backups = fs.existsSync(config.backup.dir) ? fs.readdirSync(config.backup.dir).filter((f) => f.endsWith('.zip')).length : 0;
    const audit = fs.existsSync(config.auditLog)
      ? fs.readFileSync(config.auditLog, 'utf8').trim().split('\n').slice(-8).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse()
      : [];
    res.json({
      metrics: metrics.snapshot(),
      users: { total: users.length, admins: users.filter((u) => u.role === 'admin').length, readonly: users.filter((u) => u.role === 'readonly').length, with2fa: users.filter((u) => u.totp).length },
      storageUsed: dirSize(config.storageDir),
      quarantine: listQuarantine().length,
      shares: listAllShares().length,
      bans: listBans().length,
      backups,
      recentAudit: audit,
      tls: config.tls.enabled,
      webdav: config.webdavEnabled,
      oidc: config.oidc.enabled,
      antivirus: !!(config.clamscan || config.virustotal.apiKey),
    });
  });

  // Alle deel-links met statistieken (alleen admin) + beheer.
  app.get('/api/admin/shares', requireAdmin, (req, res) => res.json({ shares: listAllShares() }));
  app.patch('/api/admin/shares/:token', requireAdmin, express.json(), (req, res) => {
    const ok = adminUpdateShare(req.params.token, req.body || {});
    if (ok) audit('web', req.user, 'admin_share_update', { token: req.params.token });
    res.json({ ok });
  });
  app.delete('/api/admin/shares/:token', requireAdmin, (req, res) => {
    const ok = adminDeleteShare(req.params.token);
    if (ok) audit('web', req.user, 'admin_share_delete', { token: req.params.token });
    res.json({ ok });
  });

  // Alle permalinks (alleen admin) + beheer.
  app.get('/api/admin/permalinks', requireAdmin, (req, res) => res.json({ permalinks: permalinks.listAll() }));
  app.patch('/api/admin/permalinks/:uuid', requireAdmin, express.json(), (req, res) => {
    const ok = permalinks.adminUpdate(req.params.uuid, req.body || {});
    if (ok) audit('web', req.user, 'admin_permalink_update', { uuid: req.params.uuid });
    res.json({ ok });
  });
  app.delete('/api/admin/permalinks/:uuid', requireAdmin, (req, res) => {
    const ok = permalinks.adminDelete(req.params.uuid);
    if (ok) audit('web', req.user, 'admin_permalink_delete', { uuid: req.params.uuid });
    res.json({ ok });
  });

  // Historische metrics voor de dashboardgrafieken (alleen admin).
  app.get('/api/admin/metrics/history', requireAdmin, (req, res) => {
    const minutes = Math.max(0, parseInt(req.query.minutes || '0', 10) || 0);
    res.json({ samples: getHistory(minutes) });
  });
  // Verkeer per gebruiker (bytes up/down) voor het admin-overzicht.
  app.get('/api/admin/metrics/users', requireAdmin, (req, res) => {
    res.json({ users: metrics.userTraffic() });
  });
  // Statusoverzicht: één samenvatting van de gezondheid van het systeem.
  app.get('/api/admin/status', requireAdmin, (req, res) => {
    res.json({
      version: config.version,
      uptime: Math.round(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().rss / 1e6),
      disk: checkDisk(),
      metrics: metrics.snapshot(),
      backup: verifyLatestBackup(),
      auditChain: verifyChain(),
      users: listUsernames().length,
    });
  });

  // Groepen beheren (alleen admin).
  app.get('/api/admin/groups', requireAdmin, (req, res) => res.json({ groups: listGroups() }));
  app.put('/api/admin/groups/:name', requireAdmin, express.json(), (req, res) => { setGroup(req.params.name, req.body.members || []); res.json({ ok: true }); });
  app.delete('/api/admin/groups/:name', requireAdmin, (req, res) => { deleteGroup(req.params.name); res.json({ ok: true }); });

  // Opslagrapport (alleen admin).
  app.get('/api/admin/storage-report', requireAdmin, (req, res) => res.json(storageReport(15)));

  // Runtime-instellingen (onderhoudsmodus, opschoning) — admin-UI-config.
  app.get('/api/admin/settings', requireAdmin, (req, res) => res.json({ settings: getSettings() }));
  app.put('/api/admin/settings', requireAdmin, express.json(), (req, res) => res.json({ settings: updateSettings(req.body || {}) }));

  // Handmatige opschoning starten.
  app.post('/api/admin/cleanup', requireAdmin, (req, res) => res.json(runCleanup()));

  // Onderhoud: update-check, schijf, back-up-verificatie, integriteit.
  app.get('/api/admin/update-check', requireAdmin, async (req, res) => res.json(await checkForUpdate()));
  app.get('/api/admin/disk', requireAdmin, (req, res) => res.json(checkDisk()));
  app.get('/api/admin/backup-verify', requireAdmin, (req, res) => res.json(verifyLatestBackup()));
  app.post('/api/admin/backup-restore-test', requireAdmin, (req, res) => res.json(restoreTest()));
  // Virusscan-onderhoud: definities bijwerken en de volledige opslag scannen.
  app.post('/api/admin/av/freshclam', requireAdmin, async (req, res) => res.json(await runFreshclam()));
  app.post('/api/admin/av/scan-all', requireAdmin, async (req, res) => res.json(await scanAll()));
  // Zoekindex (her)bouwen.
  app.post('/api/admin/search/reindex', requireAdmin, (req, res) => res.json(searchIndex.buildIndex()));
  app.post('/api/admin/integrity/baseline', requireAdmin, (req, res) => res.json(integrity.buildBaseline()));
  app.post('/api/admin/integrity/verify', requireAdmin, (req, res) => res.json(integrity.verify()));

  // Configuratie/gebruikers exporteren en importeren (migratie/herstel).
  app.get('/api/admin/export', requireAdmin, requireReauth, (req, res) => {
    const bundle = {};
    for (const [name, file] of [
      ['users', config.usersFile], ['groups', config.groupsFile], ['settings', config.settingsFile],
      ['shares', config.sharesFile], ['permalinks', config.permalinksFile],
    ]) {
      try { bundle[name] = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { bundle[name] = null; }
    }
    audit('web', req.user, 'config_export');
    res.setHeader('Content-Disposition', 'attachment; filename="fileserver-config.json"');
    res.json({ exportedAt: new Date().toISOString(), version: config.version, ...bundle });
  });
  app.post('/api/admin/import', requireAdmin, express.json({ limit: '20mb' }), (req, res) => {
    const map = { users: config.usersFile, groups: config.groupsFile, settings: config.settingsFile, shares: config.sharesFile, permalinks: config.permalinksFile };
    const imported = [];
    for (const [name, file] of Object.entries(map)) {
      if (req.body[name]) { fs.writeFileSync(file, JSON.stringify(req.body[name], null, 2), { mode: 0o600 }); imported.push(name); }
    }
    reloadUsers();
    audit('web', req.user, 'config_import', { imported });
    res.json({ ok: true, imported, note: 'Herstart aanbevolen om alles te herladen.' });
  });

  // Live-stroom voor het admin-dashboard (SSE).
  app.get('/api/admin/events', requireAdmin, (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders?.();
    res.write(': verbonden\n\n');
    addAdminClient(res);
  });

  // Quarantaine-beheer (alleen admin).
  app.get('/api/admin/quarantine', requireAdmin, (req, res) => res.json({ items: listQuarantine() }));
  app.post('/api/admin/quarantine/:id/release', requireAdmin, (req, res) => {
    try { qRelease(req.params.id); audit('web', req.user, 'quarantine_release', { id: req.params.id }); res.json({ ok: true }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/admin/quarantine/:id', requireAdmin, (req, res) => {
    try { qRemove(req.params.id); res.json({ ok: true }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.get('/api/admin/bans', requireAdmin, (req, res) => res.json({ bans: listBans() }));
  app.post('/api/admin/bans', requireAdmin, express.json(), (req, res) => { ban(req.body.ip, req.body.until || 0); res.json({ ok: true }); });
  app.delete('/api/admin/bans/:ip', requireAdmin, (req, res) => { unban(req.params.ip); res.json({ ok: true }); });

  // Statische bestanden (loginpagina toegankelijk zonder auth).
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

const TEXT_EXT = /\.(txt|md|json|js|mjs|ts|css|html?|csv|log|xml|ya?ml|ini|sh|conf|py|java|c|cpp|go|rs|php|sql)$/i;
async function searchRecursive(home, dir, query, depth = 6, inContent = false) {
  const out = [];
  async function walk(current, d) {
    if (d < 0) return;
    let entries = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (current === home && (e.name === config.trashName || e.name === config.versionsName || e.name === '.metadata.json')) continue;
      const full = path.join(current, e.name);
      let match = e.name.toLowerCase().includes(query);
      // Volledige-tekst zoeken in bestandsinhoud (tekstbestanden, max 2MB).
      if (!match && inContent && !e.isDirectory() && TEXT_EXT.test(e.name)) {
        try {
          const st = await fsp.stat(full);
          if (st.size <= 2 * 1024 * 1024) {
            const content = await fsp.readFile(full, 'utf8');
            if (content.toLowerCase().includes(query)) match = true;
          }
        } catch { /* overslaan */ }
      }
      if (match) {
        const stat = await fsp.stat(full).catch(() => null);
        out.push({
          name: e.name,
          path: '/' + path.relative(home, full).split(path.sep).join('/'),
          isDir: e.isDirectory(),
          size: stat ? stat.size : 0,
          mtime: stat ? stat.mtimeMs : 0,
        });
      }
      if (e.isDirectory()) await walk(full, d - 1);
    }
  }
  await walk(dir, depth);
  return out;
}

export function startWebServer() {
  const app = createWebServer();
  const tls = ensureTls();
  if (tls) {
    const server = https.createServer({ cert: tls.cert, key: tls.key }, app);
    return server.listen(config.web.port, config.web.host, () => {
      console.log(`[web] Web UI (HTTPS) draait op https://${config.web.host}:${config.web.port}`);
    });
  }
  const server = http.createServer(app);
  return server.listen(config.web.port, config.web.host, () => {
    console.log(`[web] Web UI (HTTP) draait op http://${config.web.host}:${config.web.port}`);
  });
}
