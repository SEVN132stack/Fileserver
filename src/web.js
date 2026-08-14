import express from 'express';
import compression from 'compression';
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
import { audit, verifyChain, tailLines } from './audit.js';
import { blockReason } from './geoblock.js';
import * as jit from './jit.js';
import { recordDownload } from './anomaly.js';
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
import * as accessLog from './access-log.js';
import { watermarkImage, canWatermark } from './watermark.js';
import * as locks from './locks.js';
import * as scheduledExport from './scheduled-export.js';
import { organize as organizePhotos } from './photo-organize.js';
import { officePreview, canPreviewOffice } from './office.js';
import { videoPoster, audioWaveform, canPoster, canWaveform, hasFfmpeg } from './media.js';
import { runAcme } from './acme.js';
import * as configDrift from './config-drift.js';
import { revokeAllForUser, startImpersonation, stopImpersonation } from './sessions.js';
import { isPasswordExpired, isPasswordReused, isBreakglass, recordLogin, lastLogin } from './users.js';
import { scanFileForDlp } from './dlp.js';
import { rateLimiter, rateHit } from './ratelimit.js';
import * as retention from './retention.js';
import * as expiry from './expiry.js';
import * as e2eFolders from './e2e-folders.js';
import * as apikeys from './apikeys.js';
import * as notifications from './notifications.js';
import * as presence from './presence.js';
import { findDuplicates, cleanupSuggestions } from './analysis.js';
import { canConvert, convertImage, convertDocToPdf, transcodeAv } from './convert.js';
import { recordRecent, listRecent } from './recent.js';
import * as gdpr from './gdpr.js';
import { requestLogger } from './log.js';
import * as ocr from './ocr.js';
import { classifyFile } from './autotag.js';
import * as accessRequests from './access-requests.js';
import { epubCover, stlInfo } from './richpreview.js';
import * as userTasks from './user-tasks.js';
import { generateRecoveryCodes, recoveryCodesRemaining, useRecoveryCode } from './users.js';
import * as invites from './invites.js';
import * as folderInfo from './folder-info.js';
import * as snapshots from './snapshots.js';
import { dedupeUser } from './dedup.js';
import { daysUntilExpiry } from './cert-monitor.js';
import * as webhookQueue from './webhook-queue.js';
import { createMagicToken, consumeMagicToken } from './magic-link.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const clientIp = (req) => req.ip || req.socket.remoteAddress || 'onbekend';
// Landcode uit de proxy-header (bijv. CF-IPCountry), voor de toegang-heatmap.
const countryOf = (req) => (req.headers[config.geoHeader] || '').toString().toUpperCase().slice(0, 2) || undefined;
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
      // Admin-impersonatie: acteer als de doelgebruiker, maar onthoud de echte
      // admin voor de audit. Alleen geldig als de echte gebruiker admin is en
      // het doel bestaat.
      let effective = s.username;
      if (s.impersonating && isAdmin(s.username) && userExists(s.impersonating)) {
        effective = s.impersonating;
        req.realUser = s.username;
        req.impersonating = true;
      }
      req.user = effective;
      req.home = homeDir(effective);
      req.userRole = jit.effectiveRole(effective, role(effective));
      req.sid = token;
      return next();
    }
  }

  // 2. API-sleutel (Authorization: Bearer fsk_... of X-API-Key). Scope 'read'
  //    geeft alleen-lezen toegang.
  const apiKeyHeader = req.headers['x-api-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (apiKeyHeader && apiKeyHeader.startsWith('fsk_')) {
    // Rate-limit API-sleutel-pogingen per IP (naast de enorme keyspace), zodat
    // een aanvaller niet ongelimiteerd sleutels kan proberen.
    if (!checkAllowed('apikey:' + ip).allowed) return res.status(429).send('Te veel pogingen.');
    const resolved = apikeys.resolveKey(apiKeyHeader);
    if (resolved && userExists(resolved.user) && !isExpired(resolved.user)) {
      recordSuccess('apikey:' + ip);
      req.user = resolved.user;
      req.home = homeDir(resolved.user);
      req.userRole = jit.effectiveRole(resolved.user, role(resolved.user));
      req.apiScope = resolved.scope;
      if (resolved.scope !== 'write') req.apiReadonly = true;
      return next();
    }
    recordFailure('apikey:' + ip);
    return res.status(401).json({ error: 'Ongeldige API-sleutel' });
  }

  // 3. HTTP Basic Auth (voor API-clients, SFTP-parity en WebDAV).
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
      req.userRole = jit.effectiveRole(user, role(user));
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
  if (req.apiReadonly) return res.status(403).json({ error: 'API-sleutel is alleen-lezen' });
  if (isReadonly(req.user)) return res.status(403).json({ error: 'Alleen-lezen account' });
  next();
}
function requireAdmin(req, res, next) {
  // API-sleutels geven nooit beheertoegang: ze omzeilen 2FA/step-up en zijn
  // langlevende credentials. Beheeracties vereisen een interactieve sessie.
  if (req.apiScope) return res.status(403).json({ error: 'API-sleutels hebben geen beheertoegang' });
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
  // Vertrouw alleen de geconfigureerde proxy-hop(s) (zie TRUST_PROXY): 'true'/'false',
  // een getal (aantal hops) of een IP/subnet. Voorkomt IP-spoofing via XFF.
  const tp = config.trustProxy;
  app.set('trust proxy', tp === 'true' ? true : tp === 'false' ? false : (/^\d+$/.test(tp) ? parseInt(tp, 10) : tp));
  app.disable('x-powered-by');

  // Gzip-compressie voor tekstuele responses (JSON-listings, HTML/JS/CSS). Dit
  // scheelt fors bandbreedte en laadtijd. We slaan bewust over:
  //  - Server-Sent Events: moeten ongebufferd blijven stromen;
  //  - byte-range/partial (206) downloads: compressie zou de Content-Range breken;
  //  - reeds niet-comprimeerbare types (afbeeldingen, zip, webp) — dat doet de
  //    standaardfilter van `compression` al op basis van het content-type.
  app.use(compression({
    filter: (req, res) => {
      if (res.getHeader('Content-Range') || res.statusCode === 206) return false;
      const type = String(res.getHeader('Content-Type') || '');
      if (type.includes('text/event-stream')) return false;
      return compression.filter(req, res);
    },
  }));

  // Maximale uploadgrootte per bestand (0 = onbeperkt) voor alle multer-uploads.
  const mlimits = config.maxUploadBytes > 0 ? { fileSize: config.maxUploadBytes } : undefined;
  // Sla een cookie-attribuutstring op basis van de Secure-instelling.
  const cookieSecure = config.cookieSecure === 'true' || config.cookieSecure === 'on'
    || (config.cookieSecure === 'auto' && config.tls.enabled);
  const cookieAttrs = (sameSite = 'Strict') => `HttpOnly; SameSite=${sameSite}; Path=/${cookieSecure ? '; Secure' : ''}`;

  // Gestructureerde request-logging + correlation-id (actief bij LOG_JSON=true).
  app.use(requestLogger());

  // Rate-limiters (per IP): algemeen voor de API en strenger voor downloads.
  const apiLimiter = rateLimiter('api', () => config.apiRateLimit);
  const downloadLimiter = rateLimiter('dl', () => config.downloadRateLimit);

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
    const geo = blockReason(ip, countryOf(req));
    if (geo) { audit('web', (req.body || {}).username || '', 'login_failed', { ip, reason: `geo-blok (${geo})` }); return res.status(403).json({ error: 'Toegang vanaf deze locatie is geblokkeerd' }); }
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
      // Accepteer de TOTP-code óf een geldige eenmalige herstelcode.
      if (!verifyTotp(u.totp, token) && !useRecoveryCode(username, token)) {
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
      res.set('Set-Cookie', `sid=${sid}; ${cookieAttrs('Strict')}`);
      return res.json({ ok: true, role: role(username), mustEnroll2fa: true });
    }
    recordSuccess('web:' + ip);
    recordLoginSuccess(username);
    recordLogin(username);
    // Break-glass nood-account: elk gebruik is een luid alarm.
    if (isBreakglass(username)) {
      sysAlert(`breakglass-${Date.now()}`, '⚠ BREAK-GLASS nood-account gebruikt',
        `Het break-glass nood-account '${username}' is ingelogd vanaf ${ip} (${req.headers['user-agent'] || 'onbekend'}). Controleer of dit legitiem is.`, { force: true });
      audit('web', username, 'breakglass_login', { ip });
    }
    // Nieuw-apparaat-melding per e-mail.
    const deviceId = createHash('sha256').update((req.headers['user-agent'] || '') + '|' + ip).digest('hex').slice(0, 16);
    if (!isKnownDevice(username, deviceId)) {
      rememberDevice(username, deviceId);
      const to = getEmail(username);
      if (to) sendMail({ to, subject: 'Nieuwe login op je account', text: `Er is ingelogd op je account vanaf een nieuw apparaat.\nIP: ${ip}\nBrowser: ${req.headers['user-agent'] || 'onbekend'}\nTijd: ${new Date().toISOString()}\n\nWas jij dit niet? Wijzig direct je wachtwoord.` }).catch((e) => console.error('[login-mail]', e.message));
    }
    const sid = createSession(username, { ip, ua: req.headers['user-agent'] });
    res.set('Set-Cookie', `sid=${sid}; ${cookieAttrs('Strict')}`);
    metrics.inc('fileserver_logins_total');
    emitAdmin('activity', { kind: 'login', user: username });
    audit('web', username, 'login', { ip, country: countryOf(req) });
    res.json({ ok: true, role: role(username), mustChangePassword: isPasswordExpired(username) });
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
  // Magic-link login: stuur een eenmalige inloglink per e-mail.
  app.post('/api/login/magic', express.json(), async (req, res) => {
    // Deze publieke endpoint verstuurt e-mail en staat vóór de generieke
    // /api-limiter: los per-IP begrenzen tegen e-mail-bombardement / misbruik.
    const ip = clientIp(req);
    if (!rateHit(`magic:${ip}`, 5, 15 * 60000).allowed) return res.status(429).json({ error: 'Te veel verzoeken, probeer later opnieuw.' });
    const { username } = req.body || {};
    if (username && userExists(username) && !isExpired(username)) {
      const token = createMagicToken(username);
      const base = config.appBaseUrl || `${req.protocol}://${req.get('host')}`;
      const to = getEmail(username);
      if (to) sendMail({ to, subject: 'Je inloglink', text: `Klik om in te loggen (geldig ${config.magicLinkTtlMinutes} min):\n${base}/api/login/magic/verify?token=${token}` }).catch((e) => console.error('[magic]', e.message));
      audit('web', username, 'magic_requested', { ip: clientIp(req) });
    }
    res.json({ ok: true }); // geen accountenumeratie
  });
  app.get('/api/login/magic/verify', (req, res) => {
    const user = consumeMagicToken(req.query.token);
    if (!user || !userExists(user) || isExpired(user)) return res.status(400).send('Link ongeldig of verlopen.');
    const sid = createSession(user, { ip: clientIp(req), ua: req.headers['user-agent'] });
    res.set('Set-Cookie', `sid=${sid}; ${cookieAttrs('Lax')}`);
    recordLogin(user);
    audit('web', user, 'login', { method: 'magic' });
    res.redirect('/');
  });

  // Zelfregistratie met een invite-code (publiek).
  app.post('/api/register', express.json(), (req, res) => {
    // Publiek + vóór de generieke /api-limiter: per-IP begrenzen tegen misbruik
    // en het raden van invite-codes.
    const ip = clientIp(req);
    if (!rateHit(`register:${ip}`, 10, 15 * 60000).allowed) return res.status(429).json({ error: 'Te veel verzoeken, probeer later opnieuw.' });
    const { code, username, password, email } = req.body || {};
    const inv = invites.checkInvite(code);
    if (!inv) return res.status(400).json({ error: 'Ongeldige of verlopen invite-code' });
    if (!username || !/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) return res.status(400).json({ error: 'Ongeldige gebruikersnaam' });
    if (userExists(username)) return res.status(409).json({ error: 'Gebruikersnaam bestaat al' });
    const perr = validatePassword(password || '');
    if (perr) return res.status(400).json({ error: perr });
    // Verbruik de code vóór het aanmaken van het account, zodat een enkele
    // single-use code niet via gelijktijdige verzoeken (TOCTOU) twee accounts
    // kan opleveren.
    if (!invites.consumeInvite(code)) return res.status(400).json({ error: 'Ongeldige of verlopen invite-code' });
    addUser({ username, password, role: inv.role, quota: inv.quota, email: email || '' });
    audit('web', username, 'self_register', { role: inv.role });
    res.json({ ok: true });
  });

  // Publieke status (geen geheimen): voor een status-/uptime-pagina.
  app.get('/api/status-public', (req, res) => {
    res.json({ status: 'ok', version: config.version, uptime: Math.round(process.uptime()) });
  });

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
    if (isPasswordReused(user, password)) return res.status(400).json({ error: 'Je hebt dit wachtwoord recent al gebruikt — kies een ander.' });
    updateUser(user, { password });
    audit('web', user, 'reset_done');
    res.json({ ok: true });
  });

  // Eigen wachtwoord wijzigen (ingelogd) — met hergebruik-controle.
  app.post('/api/change-password', authenticate, express.json(), async (req, res) => {
    const { current, password } = req.body || {};
    if (!verifyPassword(req.user, current || '')) return res.status(401).json({ error: 'Huidig wachtwoord onjuist' });
    const perr = validatePassword(password || '');
    if (perr) return res.status(400).json({ error: perr });
    if (await passwordPwnedCount(password) > 0) return res.status(400).json({ error: 'Dit wachtwoord komt voor in een datalek — kies een ander.' });
    if (isPasswordReused(req.user, password)) return res.status(400).json({ error: 'Je hebt dit wachtwoord recent al gebruikt — kies een ander.' });
    updateUser(req.user, { password });
    audit('web', req.user, 'password_changed');
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
    // Per-gebruiker metrics (met gebruikersnamen) alleen als de endpoint met een
    // token is beschermd, anders lekken ze publiek.
    res.end(metrics.render(!!config.metrics.token));
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
      // Voorkom account-overname: een OIDC-identiteit mag nooit inloggen op een
      // bestaand lokaal (niet-OIDC) account met dezelfde naam. Alleen door OIDC
      // aangemaakte (external) accounts, of nieuwe namen, zijn toegestaan.
      const existing = getUser(username);
      if (existing && !existing.external) {
        audit('web', username, 'login_failed', { method: 'oidc', reason: 'naam botst met lokaal account' });
        return res.status(409).send('Er bestaat al een lokaal account met deze naam. Neem contact op met de beheerder.');
      }
      ensureExternalUser(username, email);
      const sid = createSession(username);
      res.set('Set-Cookie', `sid=${sid}; ${cookieAttrs('Lax')}`);
      audit('web', username, 'login', { method: 'oidc' });
      res.redirect('/');
    } catch (err) {
      res.status(500).send('OIDC-fout: ' + err.message);
    }
  });

  // --- Passkey-login (geen auth) ---
  app.get('/api/webauthn/enabled', (req, res) => res.json({ enabled: config.webauthn.enabled }));
  // Publieke branding (voor de login-/reset-pagina's).
  app.get('/api/branding', (req, res) => res.json({ appName: getSetting('appName'), logoUrl: getSetting('logoUrl'), accent: getSetting('accent') }));
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
      res.set('Set-Cookie', `sid=${sid}; ${cookieAttrs('Strict')}`);
      metrics.inc('fileserver_logins_total');
      audit('web', username, 'login', { method: 'passkey', ip });
      res.json({ ok: true, role: role(username) });
    } catch (err) { res.status(401).json({ error: err.message }); }
  });

  // --- Permalink per bestand (stabiele UUID-link, geen auth) ---
  app.get('/f/:uuid', downloadLimiter, (req, res) => {
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
    audit('web', entry.user, 'permalink_access', { path: entry.path, uuid: req.params.uuid, ip: clientIp(req), country: countryOf(req) });
    accessLog.recordAccess({ owner: entry.user, kind: 'permalink', ref: req.params.uuid, path: entry.path, ip: clientIp(req) });
    if (fs.statSync(abs).isDirectory()) {
      res.attachment(name + '.zip');
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      archive.directory(abs, false);
      return archive.finalize();
    }
    // Watermerk op afbeeldingen (indien ingeschakeld).
    if (config.watermarkShares && canWatermark(name)) {
      return watermarkImage(abs, `${entry.user} · ${new Date().toISOString().slice(0, 10)}`).then((buf) => {
        if (!buf) return res.download(abs, name);
        res.setHeader('Content-Disposition', `${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="${name.replace(/[\r\n"]/g, '')}"`);
        res.end(buf);
      });
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

  app.get('/s/:token', downloadLimiter, (req, res) => {
    const share = getShare(req.params.token);
    if (!share) return res.status(404).send('Link niet gevonden of verlopen.');
    if (!checkSharePassword(share, req.query.pw)) return res.send(pwForm());

    // Drop-link (upload-portaal): toon een uploadformulier i.p.v. download.
    if (share.type === 'upload') {
      const pw = req.query.pw ? `?pw=${encodeURIComponent(req.query.pw)}` : '';
      return res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <div style="font-family:system-ui,sans-serif;max-width:420px;margin:3rem auto;padding:1.5rem;border:1px solid #ccc;border-radius:10px">
        <h2>📤 Bestanden aanleveren</h2>
        <p style="color:#666">Vul je naam in en kies bestanden. Ze komen in een map met jouw naam.</p>
        <form method="post" action="/s/${req.params.token}/upload${pw}" enctype="multipart/form-data">
          <input name="uploader" placeholder="Je naam (optioneel)" style="width:100%;padding:.5rem;margin-bottom:.6rem;box-sizing:border-box">
          <input type="file" name="files" multiple required>
          <button style="margin-top:1rem;padding:.6rem 1.2rem">Uploaden</button>
        </form></div>`);
    }

    const abs = resolveWithin(homeDir(share.user), share.path);
    const name = path.basename(abs);
    audit('web', share.user, 'share_access', { path: share.path, token: req.params.token, country: countryOf(req) });
    notifyShare('share_access', share.user, { path: share.path, ip: clientIp(req) });
    accessLog.recordAccess({ owner: share.user, kind: 'share', ref: req.params.token, path: share.path, ip: clientIp(req) });
    countDownload(req.params.token);
    if (fs.statSync(abs).isDirectory()) {
      res.attachment(name + '.zip');
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      archive.directory(abs, false);
      return archive.finalize();
    }
    if (config.watermarkShares && canWatermark(name)) {
      return watermarkImage(abs, `${req.params.token.slice(0, 8)} · ${new Date().toISOString().slice(0, 10)}`).then((buf) => {
        if (!buf) return res.download(abs, name);
        res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[\r\n"]/g, '')}"`);
        res.end(buf);
      });
    }
    // Optionele snelheidslimiet voor deze deel-link (KB/s).
    if (share.maxKbps > 0) {
      res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[\r\n"]/g, '')}"`);
      res.setHeader('Content-Length', fs.statSync(abs).size);
      return fs.createReadStream(abs).pipe(throttleStream(share.maxKbps * 1024)).pipe(res);
    }
    res.download(abs, name);
  });

  // Ontvang uploads op een drop-link (geen account nodig).
  const dropUpload = multer({
    limits: mlimits,
    storage: multer.diskStorage({
      destination(req, file, cb) {
        const share = getShare(req.params.token);
        if (!share || share.type !== 'upload' || !checkSharePassword(share, req.query.pw)) return cb(new Error('Ongeldige link'));
        try {
          // Optioneel: leg de aangeleverde bestanden in een submap per inzender.
          const uploader = (req.body && req.body.uploader || '').toString().replace(/[^a-zA-Z0-9 _.-]/g, '').trim().slice(0, 40);
          const rel = uploader ? path.posix.join(share.path, uploader) : share.path;
          const dir = resolveWithin(homeDir(share.user), rel);
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
    // Quotabewaking: anonieme drop-uploads mogen het quotum van de eigenaar niet
    // overschrijden (voorkomt schijf-vol-misbruik via een deel-link).
    const ownerHome = homeDir(share.user);
    const q = quota(share.user);
    if (q > 0 && dirSize(ownerHome) > q) {
      for (const f of req.files || []) { try { fs.unlinkSync(f.path); } catch { /* al weg */ } }
      return res.status(413).send('Opslaglimiet bereikt; upload geweigerd.');
    }
    // Scan aangeleverde bestanden; besmette naar quarantaine.
    for (const f of req.files || []) {
      const scan = await scanFile(f.path);
      if (!scan.clean) { quarantine(f.path, { user: share.user, home: homeDir(share.user), targetPath: share.path, filename: f.originalname, detail: scan.detail }); }
    }
    countUpload(req.params.token);
    audit('web', share.user, 'drop_upload', { path: share.path, files: (req.files || []).map((f) => f.originalname), ip: clientIp(req) });
    notifyShare('drop_upload', share.user, { path: share.path, ip: clientIp(req) });
    notifications.notifyUser(share.user, 'Nieuwe upload via drop-link', `Er zijn bestanden aangeleverd in ${share.path}.`);
    emitToUser(share.user, 'change', { action: 'drop_upload' });
    // Token is een gevalideerde random string, maar escape defensief tegen reflectie.
    const safeToken = encodeURIComponent(req.params.token);
    res.send('<p style="font-family:sans-serif">✅ Bedankt, je bestanden zijn ontvangen. <a href="/s/' + safeToken + '">Meer uploaden</a></p>');
  });

  // --- Alles hieronder vereist authenticatie ---
  app.use('/api', (req, res, next) => (req.path === '/events' ? next() : apiLimiter(req, res, next)));
  app.use('/api', authenticate);

  // Onderhoudsmodus: alleen admins mogen erdoor.
  app.use('/api', (req, res, next) => {
    if (getSetting('maintenance') && !isAdmin(req.user) && req.path !== '/whoami') {
      return res.status(503).json({ error: 'Onderhoudsmodus actief' });
    }
    next();
  });

  // Tweefactor server-side afdwingen: als het beleid 2FA vereist en de gebruiker
  // heeft nog geen TOTP/passkey, dan is alleen het inschrijven (+ basisacties)
  // toegestaan. Zo is REQUIRE_2FA een echte poort, niet slechts een UI-hint.
  const enroll2faAllowed = new Set(['/whoami', '/logout', '/logout-all', '/2fa/setup', '/2fa/enable',
    '/webauthn/register/options', '/webauthn/register/verify', '/branding', '/change-password']);
  app.use('/api', (req, res, next) => {
    const needs = config.requireTwoFactor === 'all' || (config.requireTwoFactor === 'admin' && isAdmin(req.user));
    if (!needs) return next();
    const has = !!getUser(req.user)?.totp || getCredentials(req.user).length > 0;
    if (has || enroll2faAllowed.has(req.path)) return next();
    return res.status(403).json({ error: 'Tweefactor-authenticatie is verplicht — schrijf eerst in', code: 'enroll2fa' });
  });

  // WebDAV (Basic Auth; eigen mount).
  if (config.webdavEnabled) {
    app.use(WEBDAV_MOUNT, authenticate, (req, res) => handleWebdav(req, res));
  }

  // tus resumable-uploadprotocol.
  app.use(TUS_MOUNT, authenticate, (req, res) => handleTus(req, res));

  const upload = multer({
    limits: mlimits,
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
        // Weiger overschrijven van een vergrendeld of onder-bewaarplicht bestand.
        const relPath = path.posix.join(req.query.path || '/', file.originalname);
        const holder = locks.lockOwner(req.home, relPath);
        if (holder) return cb(new Error(`Vergrendeld door ${holder}`));
        if (retention.retainedUntil(req.home, relPath)) return cb(new Error('Onder bewaarplicht'));
        // E2E-verplichte map: alleen versleutelde (.enc) bestanden toestaan.
        if (e2eFolders.isE2ERequired(req.home, relPath) && !/\.enc$/i.test(file.originalname)) {
          return cb(new Error('Deze map vereist end-to-end-versleuteling (.enc)'));
        }
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
      mustChangePassword: isPasswordExpired(req.user),
      branding: { appName: getSetting('appName'), logoUrl: getSetting('logoUrl'), accent: getSetting('accent') },
      impersonating: !!req.impersonating,
      realUser: req.realUser || null,
    });
  });

  // Admin-impersonatie starten/stoppen ("bekijk als gebruiker").
  app.post('/api/admin/impersonate', requireAdmin, express.json(), (req, res) => {
    const target = req.body && req.body.username;
    if (req.impersonating) return res.status(400).json({ error: 'Al aan het impersoneren' });
    if (!target || !userExists(target)) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    if (target === req.user) return res.status(400).json({ error: 'Kan jezelf niet impersoneren' });
    startImpersonation(req.sid, target);
    audit('web', req.user, 'impersonate_start', { target });
    sysAlert(`impersonate-${req.user}-${target}`, 'Admin-impersonatie gestart', `Admin '${req.user}' bekijkt nu als '${target}'.`);
    res.json({ ok: true, impersonating: target });
  });
  app.post('/api/impersonate/stop', (req, res) => {
    if (!req.impersonating) return res.status(400).json({ error: 'Niet aan het impersoneren' });
    audit('web', req.realUser, 'impersonate_stop', { target: req.user });
    stopImpersonation(req.sid);
    res.json({ ok: true });
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

  app.get('/api/download', downloadLimiter, (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.status(404).json({ error: 'Niet gevonden' });
      audit('web', req.user, 'download', { path: req.query.path, country: countryOf(req) });
      recordRecent(req.user, req.query.path || '');
      recordDownload(req.user, fs.statSync(file).size);
      checkHoneypot(req.user, req.query.path || '', 'download');
      metrics.inc('fileserver_downloads_total');
      metrics.inc('fileserver_bytes_downloaded_total', fs.statSync(file).size);
      metrics.incUser(req.user, 'down', fs.statSync(file).size);
      emitAdmin('activity', { kind: 'download', user: req.user });
      const bw = bandwidth(req.user);
      const total = fs.statSync(file).size;
      const fname = path.basename(file).replace(/[\r\n"]/g, '');
      res.setHeader('Accept-Ranges', 'bytes');
      // Hervatbare download: honoreer een Range-verzoek (206 Partial Content).
      const range = req.headers.range;
      let start = 0, end = total - 1, status = 200;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          if (m[1]) start = parseInt(m[1], 10);
          if (m[2]) end = parseInt(m[2], 10);
          if (isNaN(start) || start < 0 || start > end || end >= total) {
            res.setHeader('Content-Range', `bytes */${total}`);
            return res.status(416).end();
          }
          status = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        }
      }
      res.status(status);
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      res.setHeader('Content-Length', end - start + 1);
      const stream = fs.createReadStream(file, { start, end });
      (bw > 0 ? stream.pipe(throttleStream(bw)) : stream).pipe(res);
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
      const holder = locks.lockOwner(req.home, req.query.path || '');
      if (holder) return res.status(423).json({ error: `Vergrendeld door ${holder} — eerst ontgrendelen` });
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
        notifications.notifyUser(req.user, 'Bestand in quarantaine', `'${f.originalname}' is als besmet gemarkeerd.`);
        continue;
      }
      // DLP: gevoelige gegevens (BSN/creditcard/IBAN/wachtwoorden) detecteren.
      const dlp = scanFileForDlp(f.path, f.originalname);
      if (dlp) {
        audit('web', req.user, 'dlp_hit', { file: f.originalname, types: dlp.types, action: config.dlp.action });
        sysAlert(`dlp-${req.user}-${f.originalname}`, 'DLP: gevoelige gegevens in upload',
          `Upload '${f.originalname}' van '${req.user}' bevat mogelijk: ${dlp.types.join(', ')}.`);
        if (config.dlp.action === 'block') {
          quarantine(f.path, { user: req.user, home: req.home, targetPath: req.query.path || '/', filename: f.originalname, detail: 'DLP: ' + dlp.types.join(', ') });
          infected.push(f.originalname + ' (DLP)');
          continue;
        }
        try { setMeta(req.home, path.posix.join(req.query.path || '/', f.originalname), { dlp: dlp.types }); } catch { /* optioneel */ }
      }
      names.push(f.originalname);
      const relUp = path.posix.join(req.query.path || '/', f.originalname);
      // Self-destruct: vervaldatum instellen als de client die meegeeft.
      const expDays = Number(req.query.expiresInDays) || 0;
      if (expDays > 0) expiry.setExpiry(req.home, relUp, Date.now() + expDays * 86400000);
      // Automatische categorisatie: tags afleiden uit type/inhoud.
      if (config.autoTag) {
        try {
          const auto = classifyFile(f.originalname, f.path);
          if (auto.length) { const cur = tags.getTags(req.user, relUp); tags.setTags(req.user, relUp, [...new Set([...cur, ...auto])]); }
        } catch { /* niet-fataal */ }
      }
      // OCR: tekst uit afbeeldingen/PDF's halen (asynchroon) voor doorzoekbaarheid.
      if (ocr.canOcr(f.originalname)) ocr.runOcr(req.home, relUp, f.path);
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
  const chunkUpload = multer({ storage: multer.memoryStorage(), limits: mlimits });
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
      const holder = locks.lockOwner(req.home, req.query.path || '');
      if (holder) return res.status(423).json({ error: `Vergrendeld door ${holder} — eerst ontgrendelen` });
      const rUntil = retention.retainedUntil(req.home, req.query.path || '');
      if (rUntil) return res.status(423).json({ error: `Bewaarplicht t/m ${new Date(rUntil).toLocaleDateString()} — niet wijzigbaar` });
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
      const lockHolder = locks.lockOwner(req.home, req.body.from || '');
      if (lockHolder) return res.status(423).json({ error: `Vergrendeld door ${lockHolder} — eerst ontgrendelen` });
      if (retention.retainedUntil(req.home, req.body.from || '')) return res.status(423).json({ error: 'Onder bewaarplicht — niet te hernoemen/verplaatsen' });
      const from = resolveWithin(req.home, req.body.from || '');
      const to = resolveWithin(req.home, req.body.to || '');
      await fsp.mkdir(path.dirname(to), { recursive: true });
      await fsp.rename(from, to);
      permalinks.updatePath(req.user, req.body.from, req.body.to);
      tags.movePath(req.user, req.body.from, req.body.to);
      locks.movePath(req.home, req.body.from, req.body.to);
      expiry.movePath(req.home, req.body.from, req.body.to);
      ocr.movePath(req.home, req.body.from, req.body.to);
      folderInfo.movePath(req.home, req.body.from, req.body.to);
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
        if (locks.lockOwner(req.home, p)) continue; // vergrendelde items overslaan
        if (retention.retainedUntil(req.home, p)) continue; // bewaarplicht: niet verwijderen
        const abs = resolveWithin(req.home, p);
        if (path.resolve(abs) === path.resolve(req.home)) continue;
        const dest = path.join(trash, Date.now() + '_' + path.basename(abs));
        await fsp.rename(abs, dest).catch(async () => {
          await fsp.rm(abs, { recursive: true, force: true });
        });
        permalinks.removeForPath(req.user, p);
        tags.removePath(req.user, p);
        locks.removePath(req.home, p);
        expiry.removePath(req.home, p);
        ocr.removePath(req.home, p);
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
        if (locks.lockOwner(req.home, p)) continue;
        const abs = resolveWithin(req.home, p);
        if (path.resolve(abs) === path.resolve(req.home)) continue;
        const dest = path.join(targetDir, path.basename(abs));
        await fsp.rename(abs, dest);
        const destRel = '/' + path.relative(req.home, dest).split(path.sep).join('/');
        permalinks.updatePath(req.user, p, destRel);
        tags.movePath(req.user, p, destRel);
        locks.movePath(req.home, p, destRel);
        expiry.movePath(req.home, p, destRel);
        ocr.movePath(req.home, p, destRel);
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

  // PWA share-target: bestanden vanuit een andere app "delen naar" de fileserver.
  const shareTargetUpload = multer({
    limits: mlimits,
    storage: multer.diskStorage({
      destination(req, file, cb) { fs.mkdirSync(req.home, { recursive: true }); cb(null, req.home); },
      filename(req, file, cb) { cb(null, path.basename(file.originalname)); },
    }),
  });
  app.post('/share-target', authenticate, shareTargetUpload.array('files'), (req, res) => {
    audit('web', req.user, 'share_target_upload', { files: (req.files || []).map((f) => f.originalname) });
    emitToUser(req.user, 'change', { action: 'share_target' });
    res.redirect('/');
  });

  // Toegangslog voor gedeelde bestanden: wie downloadde wat en wanneer.
  app.get('/api/share-access', (req, res) => {
    res.json({ access: accessLog.accessForOwner(req.user, req.query.path) });
  });

  // "Overal uitloggen": trek alle sessies van deze gebruiker in.
  app.post('/api/logout-all', (req, res) => {
    const n = revokeAllForUser(req.user);
    audit('web', req.user, 'logout_all', { sessions: n });
    res.set('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
    res.json({ ok: true, revoked: n });
  });

  // Bestandsvergrendeling.
  app.get('/api/locks', (req, res) => res.json({ locks: locks.listLocks(req.home) }));
  app.post('/api/lock', requireWrite, express.json(), (req, res) => {
    const r = locks.lock(req.home, req.body.path || '', req.user);
    if (!r.ok) return res.status(423).json({ error: `Vergrendeld door ${r.by}` });
    audit('web', req.user, 'lock', { path: req.body.path });
    res.json({ ok: true });
  });
  app.post('/api/unlock', requireWrite, express.json(), (req, res) => {
    const r = locks.unlock(req.home, req.body.path || '', req.user, isAdmin(req.user));
    if (!r.ok) return res.status(403).json({ error: `Alleen ${r.by} of een admin kan ontgrendelen` });
    audit('web', req.user, 'unlock', { path: req.body.path });
    res.json({ ok: true });
  });

  // Automatische foto-ordening (EXIF-datum -> jaar/maand + dubbele-detectie).
  app.post('/api/organize-photos', requireWrite, express.json(), async (req, res) => {
    try {
      const r = await organizePhotos(req.home, req.body.src || '/', req.body.dest || req.body.src || '/');
      audit('web', req.user, 'organize_photos', { src: req.body.src, moved: r.moved, duplicates: r.duplicates });
      emitToUser(req.user, 'change', { action: 'organize_photos' });
      res.json(r);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // WORM/retentie: bewaarplicht instellen (mag niet verkort worden).
  app.get('/api/retention', (req, res) => res.json({ retention: retention.listRetention(req.home) }));
  app.post('/api/retention', requireWrite, express.json(), (req, res) => {
    const days = Number(req.body.days) || 0;
    if (days <= 0) return res.status(400).json({ error: 'Aantal dagen vereist' });
    const until = retention.setRetention(req.home, req.body.path || '', Date.now() + days * 86400000);
    audit('web', req.user, 'retention_set', { path: req.body.path, until });
    res.json({ ok: true, until });
  });

  // Self-destruct / vervaldatum per bestand.
  app.get('/api/expiry', (req, res) => res.json({ expiresAt: expiry.getExpiry(req.home, req.query.path || '') }));
  app.post('/api/expiry', requireWrite, express.json(), (req, res) => {
    const days = Number(req.body.days) || 0;
    expiry.setExpiry(req.home, req.body.path || '', days > 0 ? Date.now() + days * 86400000 : 0);
    audit('web', req.user, 'expiry_set', { path: req.body.path, days });
    res.json({ ok: true });
  });

  // E2E-verplichte mappen.
  app.get('/api/e2e-folders', (req, res) => res.json({ folders: e2eFolders.listE2E(req.home) }));
  app.post('/api/e2e-folders', requireWrite, express.json(), (req, res) => {
    e2eFolders.setE2E(req.home, req.body.folder || '/', !!req.body.on);
    audit('web', req.user, 'e2e_folder', { folder: req.body.folder, on: !!req.body.on });
    res.json({ ok: true, folders: e2eFolders.listE2E(req.home) });
  });

  // Per-gebruiker API-sleutels.
  app.get('/api/apikeys', (req, res) => res.json({ keys: apikeys.listKeys(req.user) }));
  app.post('/api/apikeys', requireWrite, express.json(), (req, res) => {
    const { id, token } = apikeys.createKey(req.user, req.body.name, req.body.scope);
    audit('web', req.user, 'apikey_create', { id, scope: req.body.scope || 'read' });
    res.json({ ok: true, id, token }); // token wordt maar één keer getoond
  });
  app.delete('/api/apikeys/:id', requireWrite, (req, res) => {
    const ok = apikeys.revokeKey(req.user, req.params.id);
    if (ok) audit('web', req.user, 'apikey_revoke', { id: req.params.id });
    res.json({ ok });
  });

  // In-app notificatiecentrum.
  app.get('/api/notifications', (req, res) => res.json({ items: notifications.listNotifications(req.user), unread: notifications.unreadCount(req.user) }));
  app.post('/api/notifications/read', express.json(), (req, res) => { notifications.markRead(req.user, req.body && req.body.id); res.json({ ok: true }); });
  app.delete('/api/notifications', (req, res) => { notifications.clearAll(req.user); res.json({ ok: true }); });

  // Aanwezigheid ("wie kijkt nu naar dit bestand").
  app.post('/api/presence', express.json(), (req, res) => {
    const p = req.body.path || '';
    if (req.body.action === 'leave') presence.leave(req.home, p, req.user);
    else presence.touch(req.home, p, req.user);
    res.json({ viewers: presence.viewers(req.home, p, req.user) });
  });

  // Recent geopende bestanden.
  app.get('/api/recent', (req, res) => res.json({ items: listRecent(req.user) }));

  // Duplicaten & opschoon-suggesties.
  app.get('/api/duplicates', (req, res) => res.json(findDuplicates(req.home)));
  app.get('/api/cleanup-suggestions', (req, res) => {
    // Bepaal welke bestanden ooit gedownload zijn uit het audit-log van deze gebruiker.
    const downloaded = new Set();
    try {
      for (const line of tailLines(config.auditLog, 50000)) {
        let e; try { e = JSON.parse(line); } catch { continue; }
        if (e.user === req.user && e.action === 'download' && e.path) downloaded.add(e.path);
      }
    } catch { /* geen log */ }
    res.json(cleanupSuggestions(req.home, downloaded));
  });

  // Server-side conversie (afbeelding/document/av).
  app.get('/api/convert', downloadLimiter, async (req, res) => {
    try {
      const src = resolveWithin(req.home, req.query.path || '');
      if (!fs.existsSync(src)) return res.status(404).json({ error: 'Niet gevonden' });
      const to = String(req.query.to || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const name = path.basename(src).replace(/\.[^.]+$/, '') + '.' + to;
      if (/\.(jpe?g|png|webp|gif|tiff?|heic|heif|avif|bmp)$/i.test(src) && ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff'].includes(to)) {
        const buf = await convertImage(src, to);
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        return res.end(buf);
      }
      // Ruim het tijdelijke conversieresultaat op na verzending. LibreOffice
      // schrijft in een fsconv-tmp-map; verwijder die map, anders het losse bestand.
      const cleanup = (p) => { try { const parent = path.dirname(p); fs.rmSync(path.basename(parent).startsWith('fsconv-') ? parent : p, { recursive: true, force: true }); } catch { /* al weg */ } };
      const out = to === 'pdf' ? await convertDocToPdf(src) : await transcodeAv(src, to);
      return res.download(out, name, () => cleanup(out));
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Rclone-/WebDAV-profiel genereren (voor CLI-clients).
  app.get('/api/rclone-config', (req, res) => {
    const base = config.appBaseUrl || `${req.protocol}://${req.get('host')}`;
    const conf = `[zepta-nas]\ntype = webdav\nurl = ${base}/webdav\nvendor = other\nuser = ${req.user}\n# pass = <voer je wachtwoord in met: rclone obscure <wachtwoord>>\n`;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="rclone-zepta-nas.conf"');
    res.end(conf);
  });

  // Wijzigingen sinds een tijdstip (voor de desktop-sync-client): de volledige
  // boom met mtime + grootte, zodat de client lokaal kan diffen. `since` filtert.
  app.get('/api/changes', (req, res) => {
    const since = parseInt(req.query.since || '0', 10) || 0;
    const out = [];
    const walk = (dir) => {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (dir === req.home && (e.name === config.trashName || e.name === config.versionsName || e.name === '.metadata.json')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        let st; try { st = fs.statSync(full); } catch { continue; }
        if (st.mtimeMs <= since) continue;
        out.push({ path: '/' + path.relative(req.home, full).split(path.sep).join('/'), size: st.size, mtime: st.mtimeMs });
      }
    };
    walk(req.home);
    res.json({ now: Date.now(), files: out });
  });

  // Toegangsaanvraag-workflow.
  app.post('/api/access-request', requireWrite, express.json(), (req, res) => {
    const { owner, path: p, mode, note } = req.body || {};
    if (!owner || !userExists(owner)) return res.status(404).json({ error: 'Eigenaar niet gevonden' });
    if (owner === req.user) return res.status(400).json({ error: 'Je bent zelf de eigenaar' });
    const r = accessRequests.createRequest(req.user, owner, p || '/', mode, note);
    if (!r) return res.status(409).json({ error: 'Er is al een openstaande aanvraag' });
    notifications.notifyUser(owner, 'Nieuwe toegangsaanvraag', `${req.user} vraagt toegang tot ${p} (${r.mode}).`);
    audit('web', req.user, 'access_request', { owner, path: p, mode: r.mode });
    res.json({ ok: true, id: r.id });
  });
  app.get('/api/access-requests', (req, res) => {
    res.json({ incoming: accessRequests.incoming(req.user), outgoing: accessRequests.outgoing(req.user) });
  });
  app.post('/api/access-request/:id/decide', requireWrite, express.json(), (req, res) => {
    const approve = !!(req.body && req.body.approve);
    const r = accessRequests.decide(req.params.id, req.user, approve);
    if (!r) return res.status(404).json({ error: 'Aanvraag niet gevonden of al beslist' });
    if (approve) {
      // Ken de deling toe namens de eigenaar (req.user is de eigenaar).
      const u = getUser(req.user);
      const shares = (u.shares || []).filter((s) => !(s.to === r.requester && s.path === r.path));
      shares.push({ to: r.requester, path: r.path, mode: r.mode });
      updateUser(req.user, { shares });
    }
    notifications.notifyUser(r.requester, approve ? 'Toegang goedgekeurd' : 'Toegang geweigerd', `Je aanvraag voor ${r.path} is ${approve ? 'goedgekeurd' : 'geweigerd'}.`);
    audit('web', req.user, approve ? 'access_approve' : 'access_deny', { requester: r.requester, path: r.path });
    res.json({ ok: true });
  });

  // Rijke preview: EPUB-omslag of STL (3D)-informatie.
  app.get('/api/richpreview', downloadLimiter, (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      if (!fs.existsSync(file)) return res.status(404).json({ error: 'Niet gevonden' });
      // Groottelimiet: EPUB/STL worden volledig in het geheugen ingelezen en
      // geparseerd, dus weiger buitensporig grote bestanden (geheugen/CPU-DoS).
      if (fs.statSync(file).size > 104857600) return res.status(413).json({ error: 'Bestand te groot voor preview (max 100 MB)' });
      if (/\.epub$/i.test(file)) {
        const cover = epubCover(file);
        if (!cover) return res.status(404).json({ error: 'Geen omslag gevonden' });
        res.setHeader('Content-Type', /\.png$/i.test(cover.name) ? 'image/png' : 'image/jpeg');
        return res.end(cover.buffer);
      }
      if (/\.stl$/i.test(file)) return res.json(stlInfo(file) || { error: 'Kon STL niet lezen' });
      res.status(400).json({ error: 'Geen rijke preview voor dit type' });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Per-gebruiker geplande taken.
  app.get('/api/tasks', (req, res) => res.json({ tasks: userTasks.listTasks(req.user) }));
  app.post('/api/tasks', requireWrite, express.json(), (req, res) => {
    try {
      const t = userTasks.addTask(req.user, req.body || {});
      audit('web', req.user, 'task_add', { type: t.type, path: t.path });
      res.json({ ok: true, task: t });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/tasks/:id/run', requireWrite, (req, res) => {
    const t = userTasks.listTasks(req.user).find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Taak niet gevonden' });
    const removed = userTasks.runTask(t);
    res.json({ ok: true, removed });
  });
  app.delete('/api/tasks/:id', requireWrite, (req, res) => res.json({ ok: userTasks.deleteTask(req.user, req.params.id) }));

  // 2FA-herstelcodes.
  app.get('/api/2fa/recovery-codes', (req, res) => res.json({ remaining: recoveryCodesRemaining(req.user) }));
  app.post('/api/2fa/recovery-codes', requireWrite, (req, res) => {
    const codes = generateRecoveryCodes(req.user);
    audit('web', req.user, 'recovery_codes_generated');
    res.json({ ok: true, codes }); // eenmalig getoond
  });

  // Per-map beschrijving/kleur/icoon.
  app.get('/api/folder-info', (req, res) => res.json(folderInfo.getInfo(req.home, req.query.path || '/')));
  app.post('/api/folder-info', requireWrite, express.json(), (req, res) => {
    res.json({ ok: true, info: folderInfo.setInfo(req.home, req.body.path || '/', req.body) });
  });

  // Onveranderbare snapshots.
  app.get('/api/snapshots', (req, res) => res.json({ snapshots: snapshots.listSnapshots(req.user) }));
  app.post('/api/snapshots', requireWrite, express.json(), (req, res) => {
    try { res.json({ ok: true, ...snapshots.createSnapshot(req.user, (req.body && req.body.label) || '') }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/snapshots/:id/restore', requireWrite, (req, res) => {
    try { res.json(snapshots.restoreSnapshot(req.user, req.params.id)); emitToUser(req.user, 'change', { action: 'snapshot_restore' }); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });
  app.delete('/api/snapshots/:id', requireWrite, (req, res) => res.json({ ok: snapshots.deleteSnapshot(req.user, req.params.id) }));

  // Opslag-deduplicatie (reflink) van de eigen home.
  app.post('/api/dedup', requireWrite, (req, res) => {
    const r = dedupeUser(req.user);
    res.json(r);
  });

  // Activiteitenfeed per map (uit het audit-log van de eigen gebruiker).
  app.get('/api/activity', (req, res) => {
    const prefix = (req.query.path || '/').toString();
    const out = [];
    try {
      const lines = tailLines(config.auditLog, 20000);
      for (const l of lines) {
        let e; try { e = JSON.parse(l); } catch { continue; }
        if (e.user !== req.user) continue;
        const p = e.path || e.from || (e.files && e.files[0]) || '';
        if (prefix !== '/' && !String(p).startsWith(prefix)) continue;
        if (!['upload', 'edit', 'delete', 'rename', 'grant', 'version_restore'].includes(e.action)) continue;
        out.push({ ts: e.ts, action: e.action, path: p });
      }
    } catch { /* geen log */ }
    res.json({ activity: out.slice(-200).reverse() });
  });

  // "Gezien door": toegangen tot een van mijn deel-links.
  app.get('/api/share-receipts', (req, res) => {
    const all = accessLog.accessForOwner(req.user);
    const ref = req.query.token;
    res.json({ access: ref ? all.filter((a) => a.ref === ref) : all });
  });

  // Bestandssjablonen: bestanden onder /.templates kunnen als basis dienen.
  app.get('/api/templates', async (req, res) => {
    try {
      const dir = resolveWithin(req.home, '/.templates');
      if (!fs.existsSync(dir)) return res.json({ templates: [] });
      res.json({ templates: (await fsp.readdir(dir)).filter((n) => !n.startsWith('.')) });
    } catch { res.json({ templates: [] }); }
  });
  app.post('/api/from-template', requireWrite, express.json(), async (req, res) => {
    try {
      const src = resolveWithin(req.home, path.posix.join('/.templates', path.basename(req.body.template || '')));
      const dest = resolveWithin(req.home, req.body.dest || '');
      if (!fs.existsSync(src)) return res.status(404).json({ error: 'Sjabloon niet gevonden' });
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.copyFile(src, dest);
      audit('web', req.user, 'from_template', { template: req.body.template, dest: req.body.dest });
      emitToUser(req.user, 'change', { action: 'from_template' });
      res.json({ ok: true });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Just-in-time toegang: verzoek + status voor de gebruiker; beheer voor admin.
  app.get('/api/jit/status', (req, res) => {
    const el = jit.activeElevation(req.user);
    res.json({ effectiveRole: req.userRole, elevation: el ? { role: el.role, until: el.until } : null });
  });
  app.post('/api/jit/request', express.json(), (req, res) => {
    try {
      const { role: wantRole, reason, hours } = req.body || {};
      const r = jit.requestElevation(req.user, wantRole, reason, hours);
      res.json({ ok: true, id: r.id });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.get('/api/admin/jit', requireAdmin, (req, res) => res.json({ requests: jit.listRequests().slice(-100).reverse() }));
  app.post('/api/admin/jit/:id', requireAdmin, express.json(), (req, res) => {
    const r = jit.decide(req.params.id, req.user, !!(req.body && req.body.approve));
    if (!r) return res.status(404).json({ error: 'Verzoek niet gevonden of al besloten' });
    res.json({ ok: true, request: r });
  });

  // Admin: invite-codes beheren.
  app.get('/api/admin/invites', requireAdmin, (req, res) => res.json({ invites: invites.listInvites() }));
  app.post('/api/admin/invites', requireAdmin, express.json(), (req, res) => {
    const inv = invites.createInvite(req.body || {});
    audit('web', req.user, 'invite_create', { code: inv.code, role: inv.role });
    res.json({ ok: true, invite: inv });
  });
  app.delete('/api/admin/invites/:code', requireAdmin, (req, res) => res.json({ ok: invites.deleteInvite(req.params.code) }));

  // Admin: webhook-afleveringslog + certificaatstatus.
  app.get('/api/admin/webhooks', requireAdmin, (req, res) => res.json({ queued: webhookQueue.queueLength(), log: webhookQueue.deliveryLog() }));
  app.get('/api/admin/cert', requireAdmin, (req, res) => res.json({ enabled: config.tls.enabled, daysUntilExpiry: daysUntilExpiry() }));

  // Office-preview (docx/xlsx/pptx -> platte tekst).
  app.get('/api/office-preview', (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      if (!canPreviewOffice(file)) return res.status(400).json({ error: 'Geen Office-bestand' });
      const r = officePreview(file);
      res.json(r || { error: 'Kon niet lezen' });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Video-posterframe / audio-golfvorm (vereist FFMPEG_CMD).
  app.get('/api/poster', async (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      if (!hasFfmpeg()) return res.status(501).json({ error: 'ffmpeg niet geconfigureerd' });
      const out = canWaveform(file) ? await audioWaveform(file) : (canPoster(file) ? await videoPoster(file) : null);
      if (!out) return res.status(404).json({ error: 'Geen preview' });
      res.sendFile(out);
    } catch (err) { res.status(400).json({ error: err.message }); }
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
      maxKbps: req.body.maxKbps ? Number(req.body.maxKbps) : 0,
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
    limits: mlimits,
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
    const lines = tailLines(config.auditLog, 200).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
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
      ? tailLines(config.auditLog, 8).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse()
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

  // Rapportage-overzicht: opslag per gebruiker/afdeling, top-downloaders,
  // inactieve accounts.
  app.get('/api/admin/report/overview', requireAdmin, (req, res) => {
    const now = Date.now();
    const users = listUsers().map((u) => {
      let used = 0;
      try { used = dirSize(homeDir(u.username)); } catch { /* map ontbreekt */ }
      return { username: u.username, tenant: u.tenant || '', used, quota: u.quota || 0,
        lastLogin: u.lastLogin || 0, inactiveDays: u.lastLogin ? Math.floor((now - u.lastLogin) / 86400000) : null };
    });
    const perTenant = {};
    for (const u of users) { const t = u.tenant || '(geen)'; perTenant[t] = (perTenant[t] || 0) + u.used; }
    const inactive = users.filter((u) => !u.lastLogin || (now - u.lastLogin) > config.inactiveDays * 86400000)
      .map((u) => ({ username: u.username, lastLogin: u.lastLogin }));
    const topTraffic = metrics.userTraffic().slice(0, 10);
    res.json({ users, perTenant, inactive, topTraffic, inactiveDays: config.inactiveDays });
  });

  // Toegang-heatmap: aantal gebeurtenissen per uur-van-de-dag en per weekdag,
  // plus per land (indien de proxy de landcode meestuurt), afgeleid uit het audit-log.
  app.get('/api/admin/report/heatmap', requireAdmin, (req, res) => {
    const hours = new Array(24).fill(0);
    const weekdays = new Array(7).fill(0);
    const countries = {};
    let total = 0;
    try {
      const raw = tailLines(config.auditLog, 20000);
      for (const line of raw) {
        let e; try { e = JSON.parse(line); } catch { continue; }
        if (!e.ts) continue;
        if (!['login', 'download', 'upload', 'share_access', 'permalink_access'].includes(e.action)) continue;
        const d = new Date(e.ts);
        hours[d.getHours()]++; weekdays[d.getDay()]++; total++;
        if (e.country) countries[e.country] = (countries[e.country] || 0) + 1;
      }
    } catch { /* geen log */ }
    res.json({ hours, weekdays, countries, total });
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
  // Config-drift-controle (databestanden buiten de app om gewijzigd?).
  app.get('/api/admin/config-drift', requireAdmin, (req, res) => res.json(configDrift.check()));
  // TLS-certificaat verlengen via het ACME-commando.
  app.post('/api/admin/acme/renew', requireAdmin, async (req, res) => res.json(await runAcme()));
  // Geplande exports (rsync/rclone) beheren.
  app.get('/api/admin/exports', requireAdmin, (req, res) => res.json({ exports: scheduledExport.listExports() }));
  app.post('/api/admin/exports', requireAdmin, express.json(), (req, res) => {
    const id = scheduledExport.addExport(req.body || {});
    audit('web', req.user, 'export_add', { id });
    res.json({ ok: true, id });
  });
  app.delete('/api/admin/exports/:id', requireAdmin, (req, res) => { scheduledExport.deleteExport(req.params.id); res.json({ ok: true }); });
  app.post('/api/admin/exports/:id/run', requireAdmin, async (req, res) => res.json(await scheduledExport.runExport(req.params.id)));
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
  // AVG/GDPR: dataportabiliteit (export) en recht op vergetelheid (forget).
  app.get('/api/admin/gdpr/export/:user', requireAdmin, (req, res) => {
    try {
      const data = gdpr.exportUser(req.params.user);
      audit('web', req.user, 'gdpr_export', { subject: req.params.user });
      res.setHeader('Content-Disposition', `attachment; filename="gdpr-${req.params.user}.json"`);
      res.json(data);
    } catch (err) { res.status(404).json({ error: err.message }); }
  });
  app.post('/api/admin/gdpr/forget/:user', requireAdmin, requireReauth, (req, res) => {
    try {
      if (req.params.user === req.user) return res.status(400).json({ error: 'Kan jezelf niet vergeten' });
      const r = gdpr.forgetUser(req.params.user, req.user);
      sysAlert(`gdpr-forget-${req.params.user}`, 'AVG: gebruiker vergeten', `Alle data van '${req.params.user}' is verwijderd/geanonimiseerd door '${req.user}'.`);
      res.json(r);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // WORM-retentie opheffen (nood-correctie): admin-only, step-up, luid gealarmeerd.
  app.post('/api/admin/retention/release', requireAdmin, requireReauth, express.json(), (req, res) => {
    const target = req.body && req.body.user;
    const p = (req.body && req.body.path) || '';
    if (!target || !userExists(target)) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    const ok = retention.releaseRetention(homeDir(target), p);
    if (ok) {
      audit('web', req.user, 'retention_release', { subject: target, path: p });
      sysAlert(`retention-release-${target}-${p}`, '⚠ WORM-bewaarplicht opgeheven',
        `Admin '${req.user}' heeft de bewaarplicht op '${p}' van '${target}' opgeheven. Controleer of dit legitiem is.`, { force: true });
    }
    res.json({ ok });
  });

  app.post('/api/admin/import', requireAdmin, requireReauth, express.json({ limit: '20mb' }), (req, res) => {
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

  // Centrale foutafhandeling: een te groot bestand (multer-limiet) geeft 413
  // i.p.v. een generieke 500. Overige onverwachte fouten worden netjes 500.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err && (err.code === 'LIMIT_FILE_SIZE' || err instanceof multer.MulterError)) {
      const mb = config.maxUploadBytes ? Math.round(config.maxUploadBytes / 1e6) : 0;
      return res.status(413).json({ error: mb ? `Bestand te groot (max ${mb} MB)` : 'Bestand te groot' });
    }
    // Upload-beleidsweigeringen (vergrendeld, bewaarplicht, E2E-verplicht): 422.
    if (err && /Vergrendeld|bewaarplicht|end-to-end/i.test(err.message || '')) {
      return res.status(422).json({ error: err.message });
    }
    console.error('[web] onverwachte fout:', err && err.message);
    res.status(500).json({ error: 'Interne fout' });
  });

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
      // Ook de via OCR herkende tekst (afbeeldingen/PDF's) meenemen bij inhoud-zoeken.
      if (!match && inContent && !e.isDirectory()) {
        const rel = '/' + path.relative(home, full).split(path.sep).join('/');
        if (ocr.ocrMatches(home, rel, query)) match = true;
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
