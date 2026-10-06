import express from 'express';
import compression from 'compression';
import multer from 'multer';
import archiver from 'archiver';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { resolveWithin, dirSize, toClientPath, invalidateDirSize } from './paths.js';
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
import { onLogin as loginAnomaly, onDownload as loginBurst } from './login-anomaly.js';
import { searchAudit, exportAudit } from './audit-search.js';
import * as guests from './guests.js';
import { inspectUpload } from './inspect.js';
const { isGuest } = guests;
import * as receipts from './receipts.js';
import * as savedsearch from './savedsearch.js';
import * as labels from './labels.js';
import { suggestName } from './naming.js';
import * as imgedit from './imgedit.js';
import * as pdfedit from './pdfedit.js';
import * as transcodeMod from './transcode.js';
import * as transcribeMod from './transcribe.js';
import * as rules from './rules.js';
import * as subscriptions from './subscriptions.js';
import * as digest from './digest.js';
import * as inboundHooks from './inbound-hooks.js';
import { recipes as integrationRecipes } from './recipes.js';
import { getTags, setTags, findByTag } from './tags.js';
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
import { getSettings, updateSettings, getSetting, settingsSchema } from './settings.js';
import * as sla from './sla.js';
import { runCleanup } from './cleanup.js';
import { storageReport } from './storage-report.js';
import { qrSvg } from './qr.js';
import * as permalinks from './permalinks.js';
import { checkForUpdate } from './updatecheck.js';
import { checkDisk } from './diskmonitor.js';
import { verifyLatestBackup, restoreTest } from './backup.js';
import * as integrity from './integrity.js';
import * as coldstore from './coldstore.js';
import * as serverSnaps from './server-snapshots.js';
import { runSelfTest } from './selftest.js';
import * as incidents from './incidents.js';
import { openapiSpec } from './openapi.js';
import * as eventhooks from './eventhooks.js';
import * as webhookSubs from './webhook-subs.js';
import * as comments from './comments.js';
import * as signing from './signing.js';
import { shred } from './shredder.js';
import * as fileTasks from './file-tasks.js';
import * as vision from './vision.js';
import * as aiAssistant from './ai-assistant.js';
import * as organizeSuggest from './organize-suggest.js';
import * as emailUpload from './email-upload.js';
import * as hotfolder from './hotfolder.js';
import * as chatbot from './chatbot.js';
import * as insights from './insights.js';
import * as scheduledReports from './scheduled-reports.js';
import * as templates from './templates.js';
import * as lifecycle from './lifecycle.js';
import * as sharePresets from './share-presets.js';
import * as portals from './portals.js';
import * as pairing from './device-pairing.js';
import * as mountProfiles from './mount-profiles.js';
import * as intelligence from './intelligence.js';
import * as jobs from './jobs.js';
import * as blockdelta from './blockdelta.js';
import { walkFiles } from './analysis.js';
import { recordMutation } from './ransomware.js';
import { checkHoneypot } from './honeypot.js';
import { passwordPwnedCount, isExpired } from './users.js';
import { alert as sysAlert } from './alerts.js';
import { listSessions, revokeSession } from './sessions.js';
import {
  validatePassword, isLocked, recordLoginFailure, recordLoginSuccess,
  isKnownDevice, rememberDevice, getCredentials,
  recordDevice, listDevices, isTrustedDevice, trustDevice, forgetDevice,
} from './users.js';
import * as webauthn from './webauthn.js';
import { createHash, randomBytes } from 'node:crypto';
import { handleTus, TUS_MOUNT } from './tus.js';
import { quarantine, listQuarantine, release as qRelease, remove as qRemove } from './quarantine.js';
import { snapshot, listVersions, versionPath } from './versions.js';
import { lineDiff, diffStat } from './diff.js';
import * as reviews from './reviews.js';
import * as teams from './teams.js';
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
import * as pins from './pins.js';
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

// Centrale event-emitter: voedt zowel het plugin-/extensiesysteem (externe
// commando's) als de fijnmazige uitgaande webhook-abonnementen.
function emitEvent(event, detail = {}) {
  try { eventhooks.fireEvent(event, detail); } catch { /* niet-fataal */ }
  try { webhookSubs.deliver(event, detail); } catch { /* niet-fataal */ }
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
    emitEvent('login', { user: username, ip });
    // Break-glass nood-account: elk gebruik is een luid alarm.
    if (isBreakglass(username)) {
      sysAlert(`breakglass-${Date.now()}`, '⚠ BREAK-GLASS nood-account gebruikt',
        `Het break-glass nood-account '${username}' is ingelogd vanaf ${ip} (${req.headers['user-agent'] || 'onbekend'}). Controleer of dit legitiem is.`, { force: true });
      audit('web', username, 'breakglass_login', { ip });
    }
    // Nieuw/vertrouwd apparaat. Bij REQUIRE_DEVICE_APPROVAL mag een onvertrouwd
    // apparaat niet inloggen (het eerste apparaat wordt automatisch vertrouwd).
    const deviceId = createHash('sha256').update((req.headers['user-agent'] || '') + '|' + ip).digest('hex').slice(0, 16);
    const dev = recordDevice(username, { id: deviceId, ua: req.headers['user-agent'] || '', ip });
    if (dev.isNew) {
      rememberDevice(username, deviceId);
      const to = getEmail(username);
      if (to) sendMail({ to, subject: 'Nieuwe login op je account', text: `Er is ingelogd op je account vanaf een nieuw apparaat.\nIP: ${ip}\nBrowser: ${req.headers['user-agent'] || 'onbekend'}\nTijd: ${new Date().toISOString()}\n\nWas jij dit niet? Wijzig direct je wachtwoord.` }).catch((e) => console.error('[login-mail]', e.message));
    }
    if (config.requireDeviceApproval && !dev.trusted) {
      audit('web', username, 'login_blocked', { ip, reason: 'apparaat niet vertrouwd', deviceId });
      return res.status(403).json({ error: 'Dit apparaat is nog niet vertrouwd. Keur het goed vanaf een vertrouwd apparaat.' });
    }
    const sid = createSession(username, { ip, ua: req.headers['user-agent'] });
    res.set('Set-Cookie', `sid=${sid}; ${cookieAttrs('Strict')}`);
    metrics.inc('fileserver_logins_total');
    emitAdmin('activity', { kind: 'login', user: username });
    audit('web', username, 'login', { ip, country: countryOf(req) });
    try { loginAnomaly(username, { ip, country: countryOf(req) }); } catch (err) { console.error('[login-anomaly]', err.message); }
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
    try { loginAnomaly(user, { ip: clientIp(req), country: countryOf(req) }); } catch { /* nvt */ }
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

  // Zelf-gehoste API-docs-schil (publiek; de spec zelf zit achter auth, zie hieronder).
  app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'docs.html')));

  // Publieke status (geen geheimen): voor een status-/uptime-pagina, incl.
  // incidenten en geplande onderhoudsvensters.
  app.get('/api/status-public', (req, res) => {
    res.json({ status: 'ok', version: config.version, uptime: Math.round(process.uptime()), ...incidents.publicStatus() });
  });

  // Inkomende webhook / API-trigger (publiek, per-token vooraf toegestane actie).
  // Staat vóór de generieke /api-limiter, dus los per-IP begrenzen.
  app.post('/api/hooks/:token', express.json({ limit: '64kb' }), async (req, res) => {
    if (!rateHit(`hook:${clientIp(req)}`, 30, 60000).allowed) return res.status(429).json({ error: 'Te veel verzoeken' });
    const result = await inboundHooks.fireHook(req.params.token, req.body || {});
    if (result === null) return res.status(404).json({ error: 'Onbekende hook' });
    res.json(result);
  });

  // Upload via e-mail (publiek, token-beschermd): een mailprovider POST't een
  // geparste e-mail met bijlagen; die worden in de inbox van de gebruiker geplaatst.
  app.post('/api/email-inbox/:token', express.json({ limit: '30mb' }), async (req, res) => {
    if (!rateHit(`eml:${clientIp(req)}`, 30, 60000).allowed) return res.status(429).json({ error: 'Te veel verzoeken' });
    const result = await emailUpload.deliver(req.params.token, req.body || {});
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    emitToUser(result.user, 'change', { action: 'email-upload' });
    res.json(result);
  });

  // Chat-bot (publiek, token-beschermd): inkomend commando -> tekstantwoord.
  app.post('/api/chat/command', express.json({ limit: '16kb' }), (req, res) => {
    if (!rateHit(`chat:${clientIp(req)}`, 60, 60000).allowed) return res.status(429).json({ error: 'Te veel verzoeken' });
    const token = req.get('X-Bot-Token') || (req.body && req.body.token) || '';
    if (!chatbot.checkToken(token)) return res.status(401).json({ error: 'Ongeldige of ontbrekende token' });
    const reply = chatbot.handle((req.body && req.body.text) || '');
    res.json({ text: reply, response_type: 'ephemeral' });
  });

  // Publieke read-only galerij van een gedeelde afbeeldingsmap.
  app.get('/g/:token', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'gallery.html')));
  const imageRe = /\.(jpe?g|png|gif|webp|bmp|avif|svg)$/i;
  app.get('/api/s/:token/gallery', (req, res) => {
    const share = getShare(req.params.token);
    if (!share || share.type === 'upload') return res.status(404).json({ error: 'Niet gevonden' });
    if (!checkSharePassword(share, req.query.pw)) return res.status(401).json({ error: 'Wachtwoord vereist' });
    try {
      const base = resolveWithin(homeDir(share.user), share.path);
      if (!fs.statSync(base).isDirectory()) return res.status(400).json({ error: 'Geen map' });
      const images = fs.readdirSync(base).filter((n) => imageRe.test(n));
      res.json({ name: path.basename(base), images });
    } catch { res.status(404).json({ error: 'Niet gevonden' }); }
  });
  app.get('/api/s/:token/raw', downloadLimiter, (req, res) => {
    const share = getShare(req.params.token);
    if (!share || share.type === 'upload') return res.status(404).end();
    if (!checkSharePassword(share, req.query.pw)) return res.status(401).end();
    try {
      const base = resolveWithin(homeDir(share.user), share.path);
      // Alleen bestanden binnen de gedeelde map; alleen afbeeldingen.
      const file = resolveWithin(base, req.query.file || '');
      if (!imageRe.test(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.status(404).end();
      res.sendFile(file);
    } catch { res.status(400).end(); }
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
  app.get('/api/branding', (req, res) => res.json({ appName: getSetting('appName'), logoUrl: getSetting('logoUrl'), accent: getSetting('accent'), bannerText: getSetting('bannerText'), bannerLevel: getSetting('bannerLevel'), defaultStyle: getSetting('defaultStyle') }));
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
    receipts.recordRead(entry.user, entry.path, 'permalink ' + clientIp(req), 'permalink', { ip: clientIp(req) });
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
    receipts.recordRead(share.user, share.path, 'deellink ' + clientIp(req), 'deellink', { ip: clientIp(req) });
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
    subscriptions.notifySubscribers(share.user, 'externe aanlevering', share.path, 'upload');
    emitToUser(share.user, 'change', { action: 'drop_upload' });
    // Token is een gevalideerde random string, maar escape defensief tegen reflectie.
    const safeToken = encodeURIComponent(req.params.token);
    res.send('<p style="font-family:sans-serif">✅ Bedankt, je bestanden zijn ontvangen. <a href="/s/' + safeToken + '">Meer uploaden</a></p>');
  });

  // --- v3.39: QR-apparaatkoppeling (publieke kant: nieuw apparaat) ---
  app.get('/pair', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'pair.html')));
  app.post('/api/pair/claim', express.json({ limit: '4kb' }), (req, res) => {
    if (!rateHit(`pairclaim:${clientIp(req)}`, 20, 600000).allowed) return res.status(429).json({ error: 'Te veel pogingen' });
    const r = pairing.claim((req.body || {}).code, { ua: req.headers['user-agent'] || '', ip: clientIp(req), name: (req.body || {}).name || '' });
    if (!r) return res.status(404).json({ error: 'Code ongeldig, al gebruikt of verlopen' });
    res.json({ ok: true, claimSecret: r.claimSecret, checkCode: r.checkCode, expires: r.expires });
  });
  app.post('/api/pair/status', express.json({ limit: '4kb' }), (req, res) => {
    if (!rateHit(`pairpoll:${clientIp(req)}`, 120, 60000).allowed) return res.status(429).json({ error: 'Te veel verzoeken' });
    const b = req.body || {};
    const r = pairing.poll(b.code, b.claimSecret);
    if (r.status === 'invalid') return res.status(404).json({ status: 'invalid' });
    if (r.status !== 'approved') return res.json({ status: r.status });
    const user = r.user;
    if (!userExists(user) || isExpired(user)) return res.status(403).json({ status: 'denied' });
    // Het goedgekeurde apparaat wordt als vertrouwd geregistreerd.
    const ip = clientIp(req); const ua = req.headers['user-agent'] || '';
    const deviceId = createHash('sha256').update(ua + '|' + ip).digest('hex').slice(0, 16);
    recordDevice(user, { id: deviceId, ua, ip });
    trustDevice(user, deviceId, true);
    rememberDevice(user, deviceId);
    const sid = createSession(user, { ip, ua });
    res.set('Set-Cookie', `sid=${sid}; ${cookieAttrs('Strict')}`);
    recordLogin(user);
    try { loginAnomaly(user, { ip, country: countryOf(req) }); } catch { /* nvt */ }
    audit('web', user, 'login', { method: 'qr-pairing', ip, device: (r.claim && r.claim.name) || '' });
    res.json({ status: 'approved' });
  });

  // --- v3.38: klantportalen (publiek, token + optioneel wachtwoord) ---
  app.get('/p/:token', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'portal.html')));
  const portalGuard = (req, res) => {
    if (!rateHit(`portal:${clientIp(req)}`, 120, 60000).allowed) { res.status(429).json({ error: 'Te veel verzoeken' }); return null; }
    const portal = portals.getPortal(req.params.token);
    if (!portal) { res.status(404).json({ error: 'Portaal niet gevonden' }); return null; }
    // Alleen via header: een wachtwoord in de query-string belandt in proxy-/serverlogs.
    const pw = req.get('X-Portal-Password') || '';
    if (!portals.checkPassword(portal, pw)) {
      // Wachtwoordpogingen extra beperken (brute-force).
      if (!rateHit(`portalpw:${clientIp(req)}`, 20, 600000).allowed) { res.status(429).json({ error: 'Te veel pogingen' }); return null; }
      res.status(401).json({ error: 'Wachtwoord vereist', needPassword: true }); return null;
    }
    return portal;
  };
  app.get('/api/portal/:token', (req, res) => {
    const portal = portalGuard(req, res); if (!portal) return;
    try {
      const subRel = String(req.query.sub || '');
      const ownerHome = homeDir(portal.owner);
      // Als vertrouwelijk/geheim gelabelde items nooit via een portaal tonen.
      const files = portals.listing(portal, subRel).filter((f) => labels.mayShare(ownerHome, path.posix.join(portal.path, subRel, f.name)));
      if (!req.query.sub) portals.bump(req.params.token, 'views');
      res.json({ name: portal.name, title: portal.title, accent: portal.accent, allowUpload: portal.allowUpload, files });
    } catch { res.status(404).json({ error: 'Map niet gevonden' }); }
  });
  app.get('/api/portal/:token/download', (req, res) => {
    const portal = portalGuard(req, res); if (!portal) return;
    let abs;
    try { ({ abs } = portals.resolveInPortal(portal, req.query.path || '')); } catch { return res.status(400).json({ error: 'Ongeldig pad' }); }
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory() || path.basename(abs).startsWith('.')) return res.status(404).json({ error: 'Bestand niet gevonden' });
    const ownerHome = homeDir(portal.owner);
    const relInHome = '/' + path.relative(ownerHome, abs).split(path.sep).join('/');
    if (!labels.mayShare(ownerHome, relInHome)) return res.status(404).json({ error: 'Bestand niet gevonden' });
    audit('web', portal.owner, 'portal_download', { token: req.params.token.slice(0, 8), path: req.query.path, ip: clientIp(req) });
    res.download(abs, path.basename(abs));
  });
  // Anonieme uploads nooit in het geheugen bufferen: naar een tijdelijke map op schijf,
  // met een harde grootte- en aantalslimiet (ook als MAX_UPLOAD_BYTES=0 / onbeperkt is).
  const portalUpload = multer({
    dest: path.join(os.tmpdir(), 'fs-portal-up'),
    limits: { fileSize: config.maxUploadBytes > 0 ? Math.min(config.maxUploadBytes, config.portalMaxUploadBytes) : config.portalMaxUploadBytes, files: 20, fields: 10 },
  });
  const cleanupTmp = (files) => { for (const f of files || []) { try { fs.rmSync(f.path, { force: true }); } catch { /* weg */ } } };
  app.post('/api/portal/:token/upload', (req, res, next) => { const p = portalGuard(req, res); if (!p) return; if (!p.allowUpload) return res.status(403).json({ error: 'Aanleveren niet toegestaan' }); req.portal = p; next(); },
    (req, res, next) => portalUpload.array('files')(req, res, (err) => {
      if (err) { cleanupTmp(req.files); return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Bestand te groot' : 'Upload mislukt' }); }
      next();
    }),
    async (req, res) => {
      const portal = req.portal;
      const files = req.files || [];
      try {
        const incoming = files.reduce((n, f) => n + f.size, 0);
        const q = quota(portal.owner);
        if (q > 0 && dirSize(homeDir(portal.owner)) + incoming > q) return res.status(413).json({ error: 'Opslaglimiet van de eigenaar bereikt' });
        const { base } = portals.resolveInPortal(portal, '');
        const dest = path.join(base, config.portalUploadDir);
        fs.mkdirSync(dest, { recursive: true });
        const saved = []; const rejected = [];
        for (const f of files) {
          const safe = path.basename(f.originalname).replace(/[^\w.\- ]+/g, '_').slice(0, 200) || 'bestand';
          let clean = true; try { clean = (await scanFile(f.path)).clean !== false; } catch { /* scan niet beschikbaar */ }
          if (!clean) { rejected.push(safe); continue; }
          // DLP-beleid geldt ook voor externe aanleveringen.
          const dlp = scanFileForDlp(f.path, safe);
          if (dlp && config.dlp.action === 'block') { audit('web', portal.owner, 'dlp_hit', { file: safe, types: dlp.types, via: 'portal' }); rejected.push(safe); continue; }
          let target = path.join(dest, safe);
          if (fs.existsSync(target)) { const ext = path.extname(safe); target = path.join(dest, path.basename(safe, ext) + '-' + randomBytes(3).toString('hex') + ext); }
          fs.copyFileSync(f.path, target);
          saved.push(path.basename(target));
        }
        if (saved.length) {
          invalidateDirSize(homeDir(portal.owner));
          portals.bump(req.params.token, 'uploads');
          notifications.notifyUser(portal.owner, 'Nieuwe aanlevering via portaal', `${saved.length} bestand(en) in portaal "${portal.name}".`);
          emitToUser(portal.owner, 'change', { action: 'portal_upload' });
        }
        audit('web', portal.owner, 'portal_upload', { token: req.params.token.slice(0, 8), saved: saved.length, rejected: rejected.length, ip: clientIp(req) });
        res.json({ ok: true, saved, rejected });
      } finally { cleanupTmp(files); }
    });

  // --- Alles hieronder vereist authenticatie ---
  app.use('/api', (req, res, next) => (req.path === '/events' ? next() : apiLimiter(req, res, next)));
  // --- v3.44: gasttoegang via eenmalige link ---
  app.get('/gast/:token', (req, res) => {
    if (!rateHit(`guestlink:${clientIp(req)}`, 20, 60000).allowed) return res.status(429).send('Te veel pogingen.');
    const user = guests.consumeLink(req.params.token);
    if (!user) return res.status(400).send('Deze gastlink is ongeldig, al gebruikt of verlopen. Vraag de afzender om een nieuwe.');
    const ip = clientIp(req);
    const sid = createSession(user, { ip, ua: req.headers['user-agent'] });
    res.set('Set-Cookie', `sid=${sid}; ${cookieAttrs('Lax')}`);
    recordLogin(user);
    try { loginAnomaly(user, { ip, country: countryOf(req) }); } catch { /* nvt */ }
    audit('web', user, 'login', { method: 'guest-link', ip, owner: getUser(user).guestOf });
    const owner = getUser(user).guestOf;
    if (owner) { try { notifications.notifyUser(owner, 'Gast heeft ingelogd', `${getUser(user).guestLabel || user} heeft je gastlink gebruikt.`); } catch { /* nvt */ } }
    res.redirect('/');
  });

  app.use('/api', authenticate);
  // Gasten mogen alleen een beperkte set routes gebruiken (gedeelde map, reacties).
  app.use('/api', (req, res, next) => {
    if (req.user && isGuest(req.user) && !req.impersonating && !guests.guestAllowed(req.path)) return res.status(403).json({ error: 'Niet beschikbaar voor gasten', code: 'guest' });
    next();
  });

  // OpenAPI-spec (achter auth: geen onnodige API-map voor anonieme bezoekers;
  // tooling authenticeert met een API-sleutel of sessie).
  app.get('/api/openapi.json', (req, res) => {
    const base = config.appBaseUrl || `${req.protocol}://${req.get('host')}`;
    res.json(openapiSpec(base));
  });

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

  // Gasten hebben alleen de gedeelde-map-API; geen WebDAV/tus (die zouden via de
  // sessiecookie anders gewoon werken).
  function guestBlock(req, res, next) { if (req.user && isGuest(req.user) && !req.impersonating) return res.status(403).end('Niet beschikbaar voor gasten'); next(); }

  // WebDAV (Basic Auth; eigen mount).
  if (config.webdavEnabled) {
    app.use(WEBDAV_MOUNT, authenticate, guestBlock, (req, res) => handleWebdav(req, res));
  }

  // tus resumable-uploadprotocol.
  app.use(TUS_MOUNT, authenticate, guestBlock, (req, res) => handleTus(req, res));

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
      guestExpires: isGuest(req.user) ? getUser(req.user).expires : undefined,
      require2fa: config.requireTwoFactor === 'all' || (config.requireTwoFactor === 'admin' && req.userRole === 'admin'),
      has2fa: !!getUser(req.user)?.totp || getCredentials(req.user).length > 0,
      mustChangePassword: !isGuest(req.user) && isPasswordExpired(req.user),
      branding: { appName: getSetting('appName'), logoUrl: getSetting('logoUrl'), accent: getSetting('accent'), bannerText: getSetting('bannerText'), bannerLevel: getSetting('bannerLevel'), defaultStyle: getSetting('defaultStyle') },
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
      // Transparante decompressie: als het bestand cold-gecomprimeerd is (.gz),
      // decomprimeer on-the-fly zodat de gebruiker het onder de originele naam krijgt.
      const cold = coldstore.coldPathFor(file);
      if (cold) {
        audit('web', req.user, 'download', { path: req.query.path, country: countryOf(req), cold: true });
        recordRecent(req.user, req.query.path || '');
        const buf = coldstore.decompress(cold);
        recordDownload(req.user, buf.length); loginBurst(req.user, buf.length);
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(file).replace(/[\r\n"]/g, '')}"`);
        return res.end(buf);
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.status(404).json({ error: 'Niet gevonden' });
      audit('web', req.user, 'download', { path: req.query.path, country: countryOf(req) });
      recordRecent(req.user, req.query.path || '');
      { const sz = fs.statSync(file).size; recordDownload(req.user, sz); loginBurst(req.user, sz); }
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
      // @-vermeldingen: meld genoemde, bestaande gebruikers.
      const mentioned = new Set((String(req.body.text).match(/@([a-zA-Z0-9_.-]{2,32})/g) || []).map((m) => m.slice(1)));
      for (const u of mentioned) {
        if (u !== req.user && userExists(u) && (!isGuest(req.user) || u === owner)) { // gasten: alleen de eigenaar
          try { notifications.notifyUser(u, 'Je bent genoemd in een reactie', `${req.user} noemde je bij ${req.body.path || 'een bestand'}: ${String(req.body.text).slice(0, 140)}`); } catch { /* niet-fataal */ }
        }
      }
      res.json({ comments: list });
    } catch (err) { res.status(403).json({ error: err.message }); }
  });
  app.delete('/api/comments', express.json(), (req, res) => {
    const ok = comments.deleteComment(req.user, req.body.path || '', req.body.index, req.user, isAdmin(req.user));
    res.json({ ok });
  });

  // Digitale ondertekening & verificatie.
  app.get('/api/signing/pubkey', (req, res) => res.type('text/plain').send(signing.publicKeyPem()));
  app.get('/api/signatures', (req, res) => res.json({ signatures: signing.listSignatures(req.home, req.query.path || '') }));
  app.post('/api/sign', requireWrite, express.json(), (req, res) => {
    try {
      const rel = req.body.path || '';
      const abs = resolveWithin(req.home, rel);
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return res.status(404).json({ error: 'Bestand niet gevonden' });
      res.json({ ok: true, signature: signing.signFile(req.home, rel, abs, req.user) });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.get('/api/verify', (req, res) => {
    try {
      const rel = req.query.path || '';
      const abs = resolveWithin(req.home, rel);
      if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Bestand niet gevonden' });
      res.json({ results: signing.verifyFile(req.home, rel, abs) });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Taken/actiepunten op bestanden (los van de geplande gebruikerstaken op /api/tasks).
  app.get('/api/file-tasks', (req, res) => res.json({ tasks: fileTasks.tasksFor(req.user) }));
  app.post('/api/file-tasks', requireWrite, express.json(), (req, res) => {
    try { res.json({ ok: true, task: fileTasks.createTask(req.body || {}, req.user) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/file-tasks/:id/status', requireWrite, express.json(), (req, res) => {
    try { const t = fileTasks.setStatus(req.params.id, req.body.status, req.user); if (!t) return res.status(404).json({ error: 'Taak niet gevonden' }); res.json({ ok: true, task: t }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/file-tasks/:id', requireWrite, (req, res) => res.json({ ok: fileTasks.deleteTask(req.params.id, req.user) }));

  // --- v3.33: AI & slimme organisatie ---
  // AI-assistent: stuur een vraag (optioneel met de inhoud van een bestand als
  // context) naar een extern commando. Uit = nette 501.
  app.post('/api/ai/ask', requireWrite, express.json(), async (req, res) => {
    if (!aiAssistant.hasAi()) return res.status(501).json({ error: 'AI-assistent staat uit (AI_CMD)' });
    try {
      let context = '';
      if (req.body.path) {
        try {
          const abs = resolveWithin(req.home, req.body.path);
          const st = fs.statSync(abs);
          // Lees hoogstens 2x aiMaxContext bytes (geen geheugen-DoS op grote bestanden);
          // buildPrompt begrenst de uiteindelijke contextlengte alsnog.
          if (!st.isDirectory()) {
            const cap = Math.max(4096, config.aiMaxContext * 2);
            const fd = fs.openSync(abs, 'r');
            try { const b = Buffer.alloc(Math.min(cap, st.size)); const n = fs.readSync(fd, b, 0, b.length, 0); context = b.subarray(0, n).toString('utf8'); }
            finally { fs.closeSync(fd); }
          }
        } catch { /* geen leesbare context */ }
      }
      const answer = await aiAssistant.ask(req.body.question || '', context);
      audit('web', req.user, 'ai-ask', { path: req.body.path || null });
      res.json({ answer });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Beeldherkenning: analyseer een afbeelding nu en geef de labels terug; en
  // haal opgeslagen labels op of zoek bestanden op label.
  app.get('/api/vision/labels', (req, res) => res.json({ labels: vision.getLabels(req.home, req.query.path || '') }));
  app.get('/api/vision/search', (req, res) => res.json({ files: vision.findByLabel(req.home, req.query.label || '') }));
  app.post('/api/vision/detect', requireWrite, express.json(), (req, res) => {
    if (!vision.hasVision()) return res.status(501).json({ error: 'Beeldherkenning staat uit (VISION_CMD)' });
    try {
      const rel = req.body.path || '';
      const abs = resolveWithin(req.home, rel);
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return res.status(404).json({ error: 'Bestand niet gevonden' });
      const labels = vision.detectSync(req.home, rel, abs);
      audit('web', req.user, 'vision-detect', { path: rel, labels: labels.length });
      res.json({ ok: true, labels });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Mapstructuur-suggesties (lokaal): stel een indeling voor en pas hem toe.
  app.get('/api/organize/suggest', (req, res) => {
    try { res.json(organizeSuggest.suggest(req.home, req.query.path || '/', req.query.mode || 'type')); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/organize/apply', requireWrite, express.json(), (req, res) => {
    try {
      const result = organizeSuggest.apply(req.home, req.body.moves || [], {
        isLocked: (rel) => !!locks.lockOwner(req.home, rel) || !!retention.retainedUntil(req.home, rel),
        onMoved: (from, to) => {
          permalinks.updatePath(req.user, from, to);
          tags.movePath(req.user, from, to);
          locks.movePath(req.home, from, to);
          expiry.movePath(req.home, from, to);
          ocr.movePath(req.home, from, to);
          vision.movePath(req.home, from, to);
          labels.movePath(req.home, from, to);
        },
      });
      audit('web', req.user, 'organize-apply', { moved: result.moved });
      emitToUser(req.user, 'change', { action: 'organize' });
      res.json({ ok: true, ...result });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // --- v3.34: invoer & integraties ---
  // Upload via e-mail: token voor de eigen inbox ophalen/aanmaken/intrekken.
  app.get('/api/email/token', (req, res) => res.json({ token: emailUpload.tokenFor(req.user) }));
  app.post('/api/email/token', requireWrite, (req, res) => res.json({ token: emailUpload.ensureToken(req.user) }));
  app.delete('/api/email/token', requireWrite, (req, res) => res.json({ ok: emailUpload.revokeToken(req.user) }));

  // Chat-bot: token-status (admin ziet of de bot is ingesteld).
  app.get('/api/chat/status', (req, res) => res.json({ enabled: chatbot.enabled(), user: config.chatBotUser || null }));

  // Hot-folder: status + handmatige scan (admin).
  app.get('/api/hotfolder/status', requireAdmin, (req, res) => res.json({ enabled: hotfolder.enabled(), dir: config.hotfolderDir || null, user: config.hotfolderUser || null, target: config.hotfolderTarget }));
  app.post('/api/hotfolder/scan', requireAdmin, async (req, res) => {
    const r = await hotfolder.scanOnce();
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    if (r.imported.length && config.hotfolderUser) emitToUser(config.hotfolderUser, 'change', { action: 'hotfolder' });
    res.json(r);
  });

  // --- v3.35: weergave & inzicht ---
  // Kaartweergave: foto's met GPS-coördinaten.
  app.get('/api/geo/photos', async (req, res) => {
    try { res.json({ photos: await insights.geoPhotos(req.home, req.query.path || '/') }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  // Tijdlijnweergave: bestanden gesorteerd op datum, gebucket per maand.
  app.get('/api/timeline', async (req, res) => {
    try { res.json(await insights.timeline(req.home, req.query.path || '/')); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  // Relatiegrafiek: bestanden verbonden via gedeelde tags.
  app.get('/api/graph/tags', (req, res) => {
    try { res.json(insights.tagGraph(req.user)); }
    catch (err) { res.status(400).json({ error: err.message }); }
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
  // Diff-weergave: verschil tussen een oudere versie en het huidige bestand
  // (of tussen twee versies via ?version=&to=). Alleen zinvol voor tekst.
  app.get('/api/version/diff', (req, res) => {
    try {
      const MAX = 2 * 1024 * 1024; // 2 MB per zijde
      const oldPath = versionPath(req.home, req.query.path || '', req.query.version || '');
      const newAbs = req.query.to
        ? versionPath(req.home, req.query.path || '', req.query.to)
        : resolveWithin(req.home, req.query.path || '');
      if (!fs.existsSync(newAbs)) return res.status(404).json({ error: 'Doelbestand niet gevonden' });
      if (fs.statSync(oldPath).size > MAX || fs.statSync(newAbs).size > MAX) {
        return res.status(413).json({ error: 'Bestand te groot voor diff (max 2 MB)' });
      }
      const oldText = fs.readFileSync(oldPath, 'utf8');
      const newText = fs.readFileSync(newAbs, 'utf8');
      const hunks = lineDiff(oldText, newText);
      res.json({ hunks, stat: diffStat(hunks) });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // --- Goedkeuringsworkflow (review-status per bestand) ---
  app.get('/api/review', (req, res) => res.json({ review: reviews.getReview(req.home, req.query.path || '') }));
  app.get('/api/reviews', (req, res) => res.json({ reviews: reviews.listReviews(req.home) }));
  app.post('/api/review', requireWrite, express.json(), (req, res) => {
    try {
      const p = req.body.path || '';
      resolveWithin(req.home, p); // padvalidatie
      res.json({ ok: true, review: reviews.requestReview(req.home, p, req.user, req.body.note || '') });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/review/decide', requireWrite, express.json(), (req, res) => {
    // Goedkeuren mag: een admin, óf de eigenaar (dit is de eigen home).
    if (req.userRole !== 'admin' && req.impersonating) return res.status(403).json({ error: 'Geen rechten' });
    const r = reviews.decideReview(req.home, req.body.path || '', req.user, !!req.body.approve, req.body.note || '');
    if (!r) return res.status(404).json({ error: 'Geen openstaande review' });
    res.json({ ok: true, review: r });
  });

  // --- Gedeelde teamruimtes ---
  app.get('/api/teams', (req, res) => res.json({ teams: teams.teamsFor(req.user) }));
  app.post('/api/teams', requireWrite, express.json(), (req, res) => {
    try { res.json({ ok: true, team: teams.createTeam(req.body.name || 'Team', req.user) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  // Hulp: haal team op en controleer minimaal de gevraagde toegang.
  const teamGuard = (need) => (req, res, next) => {
    const team = teams.getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team niet gevonden' });
    const ok = need === 'read' ? teams.canRead(team, req.user)
      : need === 'write' ? teams.canWrite(team, req.user)
      : teams.isTeamAdmin(team, req.user);
    if (!ok) return res.status(403).json({ error: 'Geen toegang tot deze teamruimte' });
    req.team = team;
    next();
  };
  app.post('/api/teams/:id/members', teamGuard('admin'), express.json(), (req, res) => {
    try { res.json({ ok: true, team: teams.setMember(req.params.id, req.body.user, req.body.role, req.user) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/teams/:id/members/:user', teamGuard('admin'), (req, res) => {
    try { res.json({ ok: true, team: teams.removeMember(req.params.id, req.params.user, req.user) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/teams/:id', teamGuard('admin'), (req, res) => res.json({ ok: teams.deleteTeam(req.params.id, req.user) }));
  app.get('/api/teams/:id/list', teamGuard('read'), async (req, res) => {
    try {
      const dir = teams.resolveTeamPath(req.params.id, req.query.path || '/');
      const items = await listDir(teams.teamDir(req.params.id), dir);
      res.json({ path: req.query.path || '/', role: teams.memberRole(req.team, req.user), items });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.get('/api/teams/:id/download', teamGuard('read'), (req, res) => {
    try {
      const file = teams.resolveTeamPath(req.params.id, req.query.path || '');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.status(404).json({ error: 'Niet gevonden' });
      audit('web', req.user, 'team_download', { id: req.params.id, path: req.query.path });
      res.download(file);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/teams/:id/mkdir', teamGuard('write'), express.json(), (req, res) => {
    try {
      const dir = teams.resolveTeamPath(req.params.id, req.body.path || '');
      fs.mkdirSync(dir, { recursive: true });
      res.json({ ok: true });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/teams/:id/file', teamGuard('write'), (req, res) => {
    try {
      const file = teams.resolveTeamPath(req.params.id, req.query.path || '');
      fs.rmSync(file, { recursive: true, force: true });
      audit('web', req.user, 'team_delete_file', { id: req.params.id, path: req.query.path });
      res.json({ ok: true });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  const teamUpload = multer({ storage: multer.memoryStorage(), limits: mlimits });
  app.post('/api/teams/:id/upload', teamGuard('write'), teamUpload.single('file'), async (req, res) => {
    let tmp;
    try {
      if (!req.file) return res.status(400).json({ error: 'Geen bestand' });
      // Grootte-cap per teamruimte (schijf-uitputting voorkomen).
      if (config.teamSpaceMaxBytes > 0) {
        const used = dirSize(teams.teamDir(req.params.id));
        if (used + req.file.buffer.length > config.teamSpaceMaxBytes) return res.status(413).json({ error: 'Teamruimte is vol' });
      }
      const dest = teams.resolveTeamPath(req.params.id, path.posix.join(req.query.path || '/', req.file.originalname));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // Schrijf eerst naar een tijdelijk bestand en scan op malware vóór plaatsing,
      // net als de gewone upload- en drop-link-paden (team-bestanden worden door
      // andere leden gedownload, dus mogen niet ongescand binnenkomen).
      tmp = dest + '.scan-' + Date.now();
      fs.writeFileSync(tmp, req.file.buffer);
      const scan = await scanFile(tmp);
      if (!scan.clean) {
        fs.rmSync(tmp, { force: true }); tmp = undefined;
        audit('web', req.user, 'team_upload_blocked', { id: req.params.id, file: req.file.originalname, detail: scan.detail });
        sysAlert(`team-av-${req.user}`, 'Besmet bestand geweigerd in teamruimte', `Upload '${req.file.originalname}' van '${req.user}' is geweigerd: ${scan.detail || ''}`);
        return res.status(422).json({ error: 'Bestand geweigerd (mogelijk besmet)' });
      }
      fs.renameSync(tmp, dest); tmp = undefined;
      audit('web', req.user, 'team_upload', { id: req.params.id, path: req.query.path });
      res.json({ ok: true });
    } catch (err) {
      if (tmp) { try { fs.rmSync(tmp, { force: true }); } catch { /* al weg */ } }
      res.status(400).json({ error: err.message });
    }
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
      // Beeldherkenning: labels uit afbeeldingen halen (asynchroon) voor zoeken.
      if (vision.canDetect(f.originalname)) vision.runVision(req.home, relUp, f.path);
      // Thumbnails vooraf genereren (lijst 56px + raster 200px), één voor één op de achtergrond.
      if (config.thumbPrecache && canThumbnail(f.originalname)) precacheThumb(f.path);
      // Regelgebaseerde automatisering: tag/verplaats/notificeer op basis van pad+extensie.
      try {
        let sizeBytes = 0; try { sizeBytes = fs.statSync(f.path).size; } catch { /* nvt */ }
        rules.applyRules(req.user, relUp, {
          tag: (rel, tag) => { const cur = tags.getTags(req.user, rel); tags.setTags(req.user, rel, [...new Set([...cur, tag])]); },
          move: (rel, destDir) => {
            const from = resolveWithin(req.home, rel);
            const to = resolveWithin(req.home, path.posix.join(destDir || '/', path.basename(rel)));
            try { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to); tags.movePath(req.user, rel, toClientPath(req.home, to)); labels.movePath(req.home, rel, toClientPath(req.home, to)); return toClientPath(req.home, to); } catch { return rel; }
          },
          notify: (rel) => notifications.notifyUser(req.user, 'Automatiseringsregel', `Regel toegepast op ${rel}`),
          label: (rel, label) => { try { labels.setLabel(req.home, rel, label, req.user); } catch { /* ongeldig label */ } },
        }, { sizeBytes });
      } catch { /* regels mogen upload niet breken */ }
      runPostUpload(f.path);
    }
    audit('web', req.user, 'upload', { path: req.query.path || '/', files: names });
    emitEvent('upload', { user: req.user, path: req.query.path || '/', files: names });
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
      vision.movePath(req.home, req.body.from, req.body.to);
      folderInfo.movePath(req.home, req.body.from, req.body.to);
      reviews.movePath(req.home, req.body.from, req.body.to);
      labels.movePath(req.home, req.body.from, req.body.to);
      receipts.movePath(req.user, req.body.from, req.body.to);
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
        // Veilig verwijderen ("shredder"): overschrijf de inhoud en sla de
        // prullenbak over, zodat de data niet terug te halen is.
        if (req.body.shred && config.shredPasses > 0) {
          try { shred(abs, config.shredPasses); audit('web', req.user, 'shred', { path: p }); } catch { await fsp.rm(abs, { recursive: true, force: true }); }
        } else {
          const dest = path.join(trash, Date.now() + '_' + path.basename(abs));
          await fsp.rename(abs, dest).catch(async () => {
            await fsp.rm(abs, { recursive: true, force: true });
          });
        }
        permalinks.removeForPath(req.user, p);
        tags.removePath(req.user, p);
        locks.removePath(req.home, p);
        expiry.removePath(req.home, p);
        ocr.removePath(req.home, p);
        vision.removePath(req.home, p);
        reviews.removePath(req.home, p);
        labels.removePath(req.home, p);
        recordMutation(req.user, 'delete'); checkHoneypot(req.user, p, 'delete');
        audit('web', req.user, 'delete', { path: p });
        emitEvent('delete', { user: req.user, path: p });
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
        if (retention.retainedUntil(req.home, p)) continue; // bewaarplicht: niet verplaatsen
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
        vision.movePath(req.home, p, destRel);
        labels.movePath(req.home, p, destRel);
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

  // Vastgezette mappen (dashboard-snelkoppelingen).
  app.get('/api/pins', (req, res) => res.json({ pins: pins.listPins(req.user) }));
  app.post('/api/pins', requireWrite, express.json(), (req, res) => res.json({ ok: true, pins: pins.addPin(req.user, req.body.path || '/') }));
  app.delete('/api/pins', requireWrite, express.json(), (req, res) => res.json({ ok: pins.removePin(req.user, req.body.path || '') }));

  // Duplicaten & opschoon-suggesties.
  app.get('/api/duplicates', (req, res) => res.json(findDuplicates(req.home)));

  // --- v3.41: achtergrondtaken, delta-uploads en preview-precaching ---
  jobs.init(); blockdelta.init(); guests.initGuests();
  receipts.setReceiptNotifier((owner, p, who, via) => { try { notifications.notifyUser(owner, 'Leesbevestiging', `${who} heeft ${p} geopend (${via}).`); emitToUser(owner, 'receipt', { path: p, who, via }); } catch { /* nvt */ } });
  jobs.setUpdateListener((user, j) => emitToUser(user, 'job', j));
  jobs.register('zip', async (job, ctx) => {
    const home = homeDir(job.user);
    const dir = resolveWithin(home, job.params.path || '/');
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error('Map niet gevonden');
    const files = walkFiles(dir);
    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > config.jobMaxZipBytes) throw new Error(`Map te groot voor een ZIP-taak (max. ${Math.round(config.jobMaxZipBytes / 1073741824)} GB)`);
    const out = ctx.resultPath('.zip');
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(out);
      const archive = archiver('zip', { zlib: { level: 6 } });
      let done = 0;
      archive.on('entry', (e) => {
        done += (e.stats && e.stats.size) || 0;
        ctx.progress(total ? (done / total) * 99 : 99, `${files.length} bestanden · ${(done / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB`);
        if (ctx.cancelled()) archive.abort();
      });
      archive.on('error', reject); ws.on('error', reject); ws.on('close', resolve);
      archive.pipe(ws);
      for (const f of files) archive.file(f.full, { name: f.rel.replace(/^\//, '') });
      archive.finalize();
    });
    audit('web', job.user, 'zip', { path: job.params.path, async: true, files: files.length });
    return { filename: (path.basename(dir) || 'archief') + '.zip', message: `${files.length} bestanden, ${(total / 1048576).toFixed(1)} MB` };
  });
  jobs.register('thumbs', async (job, ctx) => {
    const home = homeDir(job.user);
    const dir = resolveWithin(home, job.params.path || '/');
    const imgs = walkFiles(dir).filter((f) => canThumbnail(f.full)).slice(0, 20000);
    let made = 0;
    for (let i = 0; i < imgs.length; i++) {
      if (ctx.cancelled()) break;
      if (await getThumbnail(imgs[i].full, 56)) made++;
      await getThumbnail(imgs[i].full, 200);
      ctx.progress(((i + 1) / imgs.length) * 100, `${i + 1} / ${imgs.length} afbeeldingen`);
    }
    return { message: `${made} van ${imgs.length} afbeeldingen voorbereid` };
  });
  app.get('/api/jobs', (req, res) => res.json({ jobs: jobs.list(req.user) }));
  app.post('/api/jobs', express.json(), (req, res) => {
    const { type, path: p } = req.body || {};
    if (!['zip', 'thumbs'].includes(type)) return res.status(400).json({ error: 'Onbekend taaktype' });
    try { resolveWithin(req.home, p || '/'); } catch { return res.status(400).json({ error: 'Ongeldig pad' }); }
    // Beperk bewaarde ZIP-resultaten per gebruiker (schijfruimte).
    if (type === 'zip' && jobs.list(req.user).filter((j) => j.type === 'zip' && (j.status === 'queued' || j.status === 'running' || j.hasResult)).length >= 3) {
      return res.status(429).json({ error: 'Maximaal 3 ZIP-taken tegelijk; download of verwijder eerst een eerdere.' });
    }
    try {
      const label = (type === 'zip' ? 'ZIP van ' : 'Previews voor ') + (p || '/');
      res.json({ ok: true, job: jobs.enqueue(req.user, type, { path: p || '/' }, label) });
    } catch (err) { res.status(429).json({ error: err.message }); }
  });
  app.post('/api/jobs/:id/cancel', (req, res) => res.json({ ok: jobs.cancel(req.user, req.params.id) }));
  app.delete('/api/jobs/:id', (req, res) => res.json({ ok: jobs.remove(req.user, req.params.id) }));
  app.get('/api/jobs/:id/result', downloadLimiter, (req, res) => {
    const j = jobs.get(req.user, req.params.id);
    if (!j || j.status !== 'done' || !j.resultPath || !fs.existsSync(j.resultPath)) return res.status(404).json({ error: 'Geen resultaat (verlopen of niet van jou)' });
    res.download(j.resultPath, (j.filename || 'resultaat').replace(/[\r\n"]/g, ''));
  });

  // Delta-uploads op blokniveau (alleen gewijzigde blokken van grote bestanden versturen).
  const deltaGuard = (req, rel) => {
    const holder = locks.lockOwner(req.home, rel);
    if (holder) return [423, `Vergrendeld door ${holder}`];
    if (retention.retainedUntil(req.home, rel)) return [423, 'Onder bewaarplicht — niet wijzigbaar'];
    if (e2eFolders.isE2ERequired(req.home, path.posix.dirname(rel)) && !/\.enc$/i.test(rel)) return [422, 'Deze map vereist end-to-end-versleutelde bestanden (.enc)'];
    return null;
  };
  app.post('/api/upload/delta/start', requireWrite, express.json({ limit: '12mb' }), async (req, res) => {
    try {
      const b = req.body || {};
      const rel = String(b.path || '');
      const abs = resolveWithin(req.home, rel);
      if (path.resolve(abs) === path.resolve(req.home) || (fs.existsSync(abs) && fs.statSync(abs).isDirectory())) return res.status(400).json({ error: 'Geen geldig bestandspad' });
      const g = deltaGuard(req, rel); if (g) return res.status(g[0]).json({ error: g[1] });
      const q = quota(req.user);
      const oldSize = fs.existsSync(abs) ? fs.statSync(abs).size : 0;
      if (q > 0 && dirSize(req.home) - oldSize + Number(b.size || 0) > q) return res.status(413).json({ error: 'Quota overschreden' });
      res.json(await blockdelta.start(req.user, abs, rel, b));
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.put('/api/upload/delta/:id/:index', requireWrite, express.raw({ type: '*/*', limit: 17 * 1048576 }), async (req, res) => {
    try { res.json(await blockdelta.putBlock(req.user, req.params.id, req.params.index, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0))); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/upload/delta/:id/finish', requireWrite, async (req, res) => {
    try {
      const r = await blockdelta.finish(req.user, req.params.id, {
        verify: async (tmp, s) => {
          const g = deltaGuard(req, s.relTarget); if (g) return g[1];
          const sc = await scanFile(tmp);
          if (!sc.clean) { audit('web', req.user, 'upload_blocked', { path: s.relTarget, reason: 'malware', via: 'delta' }); return 'Upload geweigerd: malware gedetecteerd'; }
          const dlp = scanFileForDlp(tmp, s.relTarget);
          if (dlp && config.dlp.action === 'block') { audit('web', req.user, 'dlp_hit', { file: s.relTarget, types: dlp.types, via: 'delta' }); return 'Upload geweigerd: gevoelige gegevens (DLP)'; }
          return null;
        },
        beforeReplace: (s) => { if (fs.existsSync(s.absTarget)) snapshot(req.home, s.absTarget); },
      });
      invalidateDirSize(req.home);
      recordMutation(req.user, 'edit');
      audit('web', req.user, 'upload', { path: r.path, via: 'delta', sentBlocks: r.sentBlocks, reusedBlocks: r.reusedBlocks });
      metrics.inc('fileserver_uploads_total');
      emitToUser(req.user, 'change', { action: 'upload' });
      if (config.thumbPrecache && canThumbnail(r.path)) precacheThumb(resolveWithin(req.home, r.path));
      res.json(r);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/upload/delta/:id', requireWrite, (req, res) => res.json({ ok: blockdelta.abort(req.user, req.params.id) }));

  // --- v3.40: data-intelligentie ---
  // Verplaats één bestand naar de prullenbak met dezelfde metadata-opruiming als /api/delete.
  const trashOne = (req, p) => {
    const abs = resolveWithin(req.home, p);
    const trash = path.join(req.home, config.trashName);
    fs.mkdirSync(trash, { recursive: true });
    fs.renameSync(abs, path.join(trash, Date.now() + '_' + path.basename(abs)));
    permalinks.removeForPath(req.user, p); tags.removePath(req.user, p); locks.removePath(req.home, p);
    expiry.removePath(req.home, p); ocr.removePath(req.home, p); vision.removePath(req.home, p);
    reviews.removePath(req.home, p); labels.removePath(req.home, p);
    recordMutation(req.user, 'delete');
    audit('web', req.user, 'delete', { path: p, via: 'dedupe' });
  };
  const collectDownloaded = (user) => {
    const downloaded = new Set();
    try {
      for (const line of tailLines(config.auditLog, 50000)) {
        let e; try { e = JSON.parse(line); } catch { continue; }
        if (e.user === user && e.action === 'download' && e.path) downloaded.add(e.path);
      }
    } catch { /* geen log */ }
    return downloaded;
  };
  app.get('/api/duplicates/plan', (req, res) => {
    try { res.json(intelligence.planDedupe(req.home, { strategy: req.query.strategy || 'oldest', prefer: req.query.prefer || '' })); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/duplicates/apply', requireWrite, express.json({ limit: '2mb' }), (req, res) => {
    const r = intelligence.applyDedupe(req.home, (req.body || {}).items, {
      isProtected: (rel) => !!locks.lockOwner(req.home, rel) || !!retention.retainedUntil(req.home, rel),
      trash: (rel) => trashOne(req, rel),
    });
    if (r.removed) { invalidateDirSize(req.home); emitToUser(req.user, 'change', { action: 'dedupe' }); }
    audit('web', req.user, 'dedupe_apply', { removed: r.removed, reclaimed: r.reclaimed, skipped: r.skipped.length });
    res.json({ ok: true, ...r });
  });
  app.get('/api/cleanup-advice', (req, res) => {
    const days = Math.max(1, Math.min(3650, parseInt(req.query.oldDays, 10) || 365));
    const mb = Math.max(1, Math.min(100000, parseInt(req.query.largeMb, 10) || 100));
    res.json(intelligence.cleanupAdvice(req.home, collectDownloaded(req.user), { oldDays: days, largeBytes: mb * 1048576 }));
  });
  app.get('/api/search/snippets', (req, res) => {
    if (!rateHit(`snip:${req.user}`, 30, 60000).allowed) return res.status(429).json({ error: 'Te veel zoekopdrachten' });
    res.json(intelligence.searchSnippets(req.home, req.query.q || ''));
  });
  app.get('/api/saved-searches/:id/items', (req, res) => {
    const item = savedsearch.listSaved(req.user).find((x) => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Collectie niet gevonden' });
    const items = savedsearch.evaluate(walkFiles(req.home), item, {
      tagsOf: (rel) => tags.getTags(req.user, rel),
      labelOf: (rel) => labels.getLabel(req.home, rel),
    });
    res.json({ collection: item, items });
  });
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

  // Opgeslagen zoekopdrachten / slimme mappen (per gebruiker).
  app.get('/api/saved-searches', (req, res) => res.json({ searches: savedsearch.listSaved(req.user) }));
  app.post('/api/saved-searches', requireWrite, express.json(), (req, res) => {
    try { res.json({ ok: true, search: savedsearch.addSaved(req.user, req.body || {}) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/saved-searches/:id', requireWrite, (req, res) => res.json({ ok: savedsearch.deleteSaved(req.user, req.params.id) }));

  // Hulp: schrijf bewerkte media-bytes weg als nieuw bestand binnen de home,
  // met quotacontrole en versie-snapshot bij overschrijven.
  const saveDerived = async (req, res, relPath, buf, auditAction) => {
    const dest = resolveWithin(req.home, relPath);
    const q = quota(req.user);
    if (q > 0) {
      const exists = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
      if (dirSize(req.home) - exists + buf.length > q) return res.status(413).json({ error: 'Quota overschreden' });
    }
    if (fs.existsSync(dest)) snapshot(req.home, dest);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, buf);
    audit('web', req.user, auditAction, { path: relPath });
    emitToUser(req.user, 'change', { action: auditAction });
    res.json({ ok: true, path: relPath, size: buf.length });
  };
  const derivedName = (rel, suffix, ext) => {
    const dir = path.posix.dirname(rel);
    const base = path.basename(rel, path.extname(rel));
    return path.posix.join(dir === '.' ? '/' : dir, `${base}${suffix}${ext || path.extname(rel)}`);
  };

  // In-browser beeldbewerker (roteren/spiegelen/bijsnijden/schalen via sharp).
  app.post('/api/image/transform', requireWrite, express.json(), async (req, res) => {
    try {
      const rel = req.body.path || '';
      if (!imgedit.canEdit(rel)) return res.status(400).json({ error: 'Geen bewerkbare afbeelding' });
      const src = resolveWithin(req.home, rel);
      const buf = await imgedit.transform(src, req.body.ops || {});
      await saveDerived(req, res, req.body.dest || derivedName(rel, '-bewerkt'), buf, 'image_edit');
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // PDF-bewerker: samenvoegen / splitsen / roteren.
  app.post('/api/pdf/merge', requireWrite, express.json(), async (req, res) => {
    try {
      const paths = (req.body.paths || []).map((p) => { if (!pdfedit.isPdf(p)) throw new Error('Alleen PDF-bestanden'); return resolveWithin(req.home, p); });
      if (paths.length < 2) return res.status(400).json({ error: 'Minstens 2 PDF\'s nodig' });
      const buf = await pdfedit.mergePdfs(paths);
      await saveDerived(req, res, req.body.dest || '/samengevoegd.pdf', buf, 'pdf_merge');
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/pdf/split', requireWrite, express.json(), async (req, res) => {
    try {
      const rel = req.body.path || '';
      if (!pdfedit.isPdf(rel)) return res.status(400).json({ error: 'Alleen PDF-bestanden' });
      const buf = await pdfedit.splitPdf(resolveWithin(req.home, rel), req.body.ranges || '');
      await saveDerived(req, res, req.body.dest || derivedName(rel, '-selectie'), buf, 'pdf_split');
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/pdf/rotate', requireWrite, express.json(), async (req, res) => {
    try {
      const rel = req.body.path || '';
      if (!pdfedit.isPdf(rel)) return res.status(400).json({ error: 'Alleen PDF-bestanden' });
      const buf = await pdfedit.rotatePdf(resolveWithin(req.home, rel), Number(req.body.degrees) || 90, req.body.ranges || '');
      await saveDerived(req, res, req.body.dest || derivedName(rel, '-gedraaid'), buf, 'pdf_rotate');
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Transcoderen op verzoek (video -> mp4/webm via ffmpeg).
  app.post('/api/transcode', requireWrite, express.json(), async (req, res) => {
    if (!transcodeMod.hasFfmpeg()) return res.status(501).json({ error: 'Transcoderen staat uit (FFMPEG_CMD)' });
    try {
      const rel = req.body.path || '';
      if (!transcodeMod.canTranscode(rel)) return res.status(400).json({ error: 'Geen ondersteund videobestand' });
      const fmt = transcodeMod.FORMATS[req.body.format] ? req.body.format : 'mp4';
      const destRel = derivedName(rel, '-web', transcodeMod.FORMATS[fmt].ext);
      await transcodeMod.transcode(resolveWithin(req.home, rel), resolveWithin(req.home, destRel), fmt);
      audit('web', req.user, 'transcode', { path: rel, format: fmt });
      emitToUser(req.user, 'change', { action: 'transcode' });
      res.json({ ok: true, path: destRel });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Automatische transcriptie (audio/video -> tekst via TRANSCRIBE_CMD).
  app.post('/api/transcribe', requireWrite, express.json(), async (req, res) => {
    if (!transcribeMod.hasTranscriber()) return res.status(501).json({ error: 'Transcriptie staat uit (TRANSCRIBE_CMD)' });
    try {
      const rel = req.body.path || '';
      if (!transcribeMod.canTranscribe(rel)) return res.status(400).json({ error: 'Geen ondersteund mediabestand' });
      const text = await transcribeMod.transcribe(resolveWithin(req.home, rel));
      const destRel = derivedName(rel, '-transcript', '.txt');
      await saveDerived(req, res, destRel, Buffer.from(text, 'utf8'), 'transcribe');
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Slimme naamgeving-suggestie voor een bestand.
  app.get('/api/rename-suggestion', async (req, res) => {
    try { res.json({ suggestion: await suggestName(req.home, req.query.path || '') }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Regelgebaseerde automatisering (per gebruiker).
  app.get('/api/rules', (req, res) => res.json({ rules: rules.listRules(req.user) }));
  app.post('/api/rules', requireWrite, express.json(), (req, res) => {
    try { res.json({ ok: true, rule: rules.addRule(req.user, req.body || {}) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/rules/:id', requireWrite, (req, res) => res.json({ ok: rules.deleteRule(req.user, req.params.id) }));
  app.post('/api/rules/:id/enabled', requireWrite, express.json(), (req, res) => {
    const r = rules.setRuleEnabled(req.user, req.params.id, !!req.body.enabled);
    if (!r) return res.status(404).json({ error: 'Regel niet gevonden' });
    res.json({ ok: true, rule: r });
  });

  // --- v3.39: QR-koppeling (ingelogde kant) ---
  // Alleen een echte browsersessie mag koppelen (geen API-sleutel/Basic-auth, geen impersonatie).
  const interactiveSession = (req) => {
    const t = tokenFromReq(req);
    return !!(t && getSession(t)) && !req.impersonating && !req.apiScope;
  };
  app.post('/api/pair/start', async (req, res) => {
    if (!interactiveSession(req)) return res.status(403).json({ error: 'Koppelen kan alleen vanuit een ingelogde browsersessie' });
    try {
      const { code, expires } = pairing.startPairing(req.user);
      const base = config.appBaseUrl || `${req.protocol}://${req.get('host')}`;
      const url = `${base}/pair#${code}`;
      audit('web', req.user, 'pair_start', {});
      res.json({ code, url, expires, qr: await qrSvg(url) });
    } catch (err) { res.status(429).json({ error: err.message }); }
  });
  app.get('/api/pair/pending', (req, res) => {
    const p = pairing.pendingFor(req.user, req.query.code);
    if (!p) return res.status(404).json({ error: 'Onbekende of verlopen koppeling' });
    res.json(p);
  });
  app.post('/api/pair/decide', express.json(), (req, res) => {
    if (!interactiveSession(req)) return res.status(403).json({ error: 'Alleen vanuit een ingelogde browsersessie' });
    const r = pairing.decide(req.user, (req.body || {}).code, !!(req.body || {}).approve);
    if (!r) return res.status(404).json({ error: 'Niets om te beslissen' });
    audit('web', req.user, r.status === 'approved' ? 'pair_approve' : 'pair_deny', { ip: r.claim && r.claim.ip });
    res.json({ ok: true, status: r.status });
  });

  // --- v3.39: desktop-koppelprofielen + diagnose ---
  const safeBase = (req) => {
    try { return new URL(config.appBaseUrl || `${req.protocol}://${req.get('host')}`).origin; } catch { return 'http://localhost'; }
  };
  app.get('/api/mount-profiles', (req, res) => {
    const base = safeBase(req);
    res.json({ profiles: mountProfiles.profiles(req.user, base), diagnose: mountProfiles.diagnose(base) });
  });
  app.get('/api/mount-profiles/:id/download', (req, res) => {
    const base = safeBase(req);
    const p = mountProfiles.profiles(req.user, base).find((x) => x.id === req.params.id && x.file);
    if (!p) return res.status(404).json({ error: 'Profiel niet gevonden' });
    res.setHeader('Content-Disposition', `attachment; filename="${p.file}"`);
    res.type('text/plain').send(p.body);
  });

  // --- v3.38: deel-presets en portaalbeheer ---
  app.get('/api/share-presets', (req, res) => res.json({ presets: sharePresets.listPresets(req.user) }));
  app.post('/api/share-presets', requireWrite, express.json(), (req, res) => {
    try { res.json({ ok: true, preset: sharePresets.addPreset(req.user, req.body || {}) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/share-presets/:id', requireWrite, (req, res) => res.json({ ok: sharePresets.deletePreset(req.user, req.params.id) }));
  app.get('/api/portals', (req, res) => res.json({ portals: portals.listPortals(req.user) }));
  app.post('/api/portals', requireWrite, express.json(), (req, res) => {
    const body = req.body || {};
    if (!labels.mayShare(req.home, body.path || '/')) return res.status(403).json({ error: 'Deze map is als vertrouwelijk/geheim gelabeld en mag niet extern gedeeld worden.' });
    try {
      const token = portals.createPortal(req.user, body);
      audit('web', req.user, 'portal_create', { path: body.path, upload: !!body.allowUpload });
      res.json({ ok: true, token, url: `/p/${token}` });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/portals/:token', requireWrite, (req, res) => {
    const ok = portals.deletePortal(req.user, req.params.token);
    if (ok) audit('web', req.user, 'portal_delete', {});
    res.json({ ok });
  });

  // --- v3.37: geplande rapporten (admin) ---
  app.get('/api/admin/scheduled-reports', requireAdmin, (req, res) => res.json({ reports: scheduledReports.listReports() }));
  app.post('/api/admin/scheduled-reports', requireAdmin, express.json(), (req, res) => {
    try { res.json({ ok: true, report: scheduledReports.addReport(req.body || {}, req.user) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/admin/scheduled-reports/:id', requireAdmin, (req, res) => res.json({ ok: scheduledReports.deleteReport(req.params.id) }));
  app.post('/api/admin/scheduled-reports/:id/run', requireAdmin, async (req, res) => {
    const job = scheduledReports.listReports().find((r) => r.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Rapport niet gevonden' });
    try { res.json(await scheduledReports.runReport(job)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  // --- v3.37: map-/projectsjablonen ---
  app.get('/api/templates', (req, res) => res.json({ templates: templates.listTemplates() }));
  app.post('/api/admin/templates', requireAdmin, express.json(), (req, res) => {
    try { res.json({ ok: true, template: templates.addTemplate(req.body || {}, req.user) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/admin/templates/:id', requireAdmin, (req, res) => res.json({ ok: templates.deleteTemplate(req.params.id) }));
  app.post('/api/templates/:id/apply', requireWrite, express.json(), (req, res) => {
    const tpl = templates.getTemplate(req.params.id);
    const q = quota(req.user);
    const bytes = tpl ? tpl.entries.reduce((n, e) => n + Buffer.byteLength(e.content || ''), 0) : 0;
    if (q > 0 && dirSize(req.home) + bytes > q) return res.status(413).json({ error: 'Quota overschreden' });
    const r = templates.applyTemplate(req.home, req.body.path || '/', req.params.id, req.user);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    emitToUser(req.user, 'change', { action: 'template' });
    res.json(r);
  });

  // --- v3.37: bestandsverloop-workflow (per gebruiker) ---
  app.get('/api/lifecycle', (req, res) => res.json({ policies: lifecycle.listPolicies(req.user) }));
  app.post('/api/lifecycle', requireWrite, express.json(), (req, res) => res.json({ ok: true, policy: lifecycle.addPolicy(req.user, req.body || {}) }));
  app.delete('/api/lifecycle/:id', requireWrite, (req, res) => res.json({ ok: lifecycle.deletePolicy(req.user, req.params.id) }));
  app.get('/api/lifecycle/preview', (req, res) => res.json(lifecycle.preview(req.user)));
  app.post('/api/lifecycle/run', requireWrite, (req, res) => {
    const r = lifecycle.runForUser(req.user, (title, body) => { try { notifications.notifyUser(req.user, title, body); } catch { /* nvt */ } });
    emitToUser(req.user, 'change', { action: 'lifecycle' });
    res.json({ ok: true, ...r });
  });

  // Map-abonnementen.
  app.get('/api/subscriptions', (req, res) => res.json({ subscriptions: subscriptions.listSubscriptions(req.user) }));
  app.post('/api/subscriptions', requireWrite, express.json(), (req, res) =>
    res.json({ ok: true, subscriptions: subscriptions.subscribe(req.user, req.body.prefix || '/') }));
  app.delete('/api/subscriptions/:id', requireWrite, (req, res) => res.json({ ok: subscriptions.unsubscribe(req.user, req.params.id) }));

  // Digest-notificatievoorkeur.
  app.get('/api/digest', (req, res) => res.json(digest.getPref(req.user)));
  app.post('/api/digest', requireWrite, express.json(), (req, res) => {
    try { res.json({ ok: true, ...digest.setFrequency(req.user, req.body.frequency) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Data-classificatielabels per bestand.
  app.get('/api/labels', (req, res) => res.json({ labels: labels.listLabels(req.home), options: labels.LABELS }));
  app.get('/api/label', (req, res) => res.json({ label: labels.getLabel(req.home, req.query.path || '') || 'openbaar' }));
  app.post('/api/label', requireWrite, express.json(), (req, res) => {
    try {
      resolveWithin(req.home, req.body.path || '');
      res.json({ ok: true, label: labels.setLabel(req.home, req.body.path || '', req.body.label, req.user) });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Vertrouwde apparaten: lijst + vertrouwen/vergeten (eigen account).
  app.get('/api/devices', (req, res) => res.json({ devices: listDevices(req.user) }));
  app.post('/api/devices/:id/trust', requireWrite, express.json(), (req, res) =>
    res.json({ ok: trustDevice(req.user, req.params.id, req.body && req.body.trusted !== false) }));
  app.delete('/api/devices/:id', requireWrite, (req, res) => res.json({ ok: forgetDevice(req.user, req.params.id) }));
  // Admin kan een apparaat voor een gebruiker vertrouwen (voorkomt uitsluiting).
  app.post('/api/admin/devices/:user/:id/trust', requireAdmin, (req, res) =>
    res.json({ ok: trustDevice(req.params.user, req.params.id, true) }));

  // Sessie-forensics: per actieve sessie recente acties, IP-historie en of er
  // sprake is van een geografische sprong (login vanuit meerdere landen).
  app.get('/api/session-forensics', (req, res) => {
    const sessions = listSessions(req.user, req.sid);
    const ipHistory = new Map(); // ip -> {count, countries:Set, last}
    const recent = [];
    const countries = new Set();
    for (const line of tailLines(config.auditLog, 20000)) {
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (e.user !== req.user) continue;
      if (e.ip) {
        const h = ipHistory.get(e.ip) || { ip: e.ip, count: 0, countries: new Set(), last: e.ts };
        h.count++; if (e.country) { h.countries.add(e.country); countries.add(e.country); } h.last = e.ts;
        ipHistory.set(e.ip, h);
      }
      if (['login', 'login_blocked', 'download', 'upload', 'delete', 'share_create'].includes(e.action)) {
        recent.push({ ts: e.ts, action: e.action, ip: e.ip || '', country: e.country || '' });
      }
    }
    res.json({
      sessions,
      ipHistory: [...ipHistory.values()].map((h) => ({ ...h, countries: [...h.countries] })).sort((a, b) => (a.last < b.last ? 1 : -1)).slice(0, 50),
      recent: recent.slice(-100).reverse(),
      geoJump: countries.size > 1,
      countries: [...countries],
    });
  });

  // Bulk-tagging: voeg een tag toe aan (of verwijder van) meerdere bestanden ineens.
  app.post('/api/bulk-tag', requireWrite, express.json(), (req, res) => {
    const { paths, tag, remove } = req.body || {};
    if (!Array.isArray(paths) || !tag) return res.status(400).json({ error: 'paths en tag zijn verplicht' });
    let changed = 0;
    for (const p of paths.slice(0, 1000)) {
      try {
        resolveWithin(req.home, p); // padvalidatie
        const cur = new Set(getTags(req.user, p) || []);
        if (remove) cur.delete(tag); else cur.add(String(tag).slice(0, 40));
        setTags(req.user, p, [...cur]);
        changed++;
      } catch { /* ongeldig pad overslaan */ }
    }
    res.json({ ok: true, changed });
  });
  // Tag-galerij: alle bestanden met een bepaalde tag.
  app.get('/api/by-tag', (req, res) => res.json({ tag: req.query.tag || '', paths: findByTag(req.user, req.query.tag || '') }));

  // Integratie-recepten (Zapier/Make) + beheer van inkomende hooks (admin).
  app.get('/api/integrations/recipes', (req, res) => {
    const base = config.appBaseUrl || `${req.protocol}://${req.get('host')}`;
    res.json({ recipes: integrationRecipes(base), actions: inboundHooks.actionNames() });
  });
  app.get('/api/admin/hooks', requireAdmin, (req, res) => res.json({ hooks: inboundHooks.listHooks(), actions: inboundHooks.actionNames() }));
  app.post('/api/admin/hooks', requireAdmin, express.json(), (req, res) => {
    try { res.json({ ok: true, hook: inboundHooks.createHook(req.body.action, req.body.label || '') }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/admin/hooks/:token', requireAdmin, (req, res) => res.json({ ok: inboundHooks.deleteHook(req.params.token) }));

  // Plugin-/extensiesysteem: event -> extern commando (alleen admin; standaard uit).
  app.get('/api/admin/eventhooks', requireAdmin, (req, res) => res.json({ hooks: eventhooks.listHooks(), events: eventhooks.EVENTS, enabled: config.eventHooksEnabled }));
  app.post('/api/admin/eventhooks', requireAdmin, express.json(), (req, res) => {
    try { res.json({ ok: true, hook: eventhooks.addHook(req.body || {}) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/admin/eventhooks/:id', requireAdmin, (req, res) => res.json({ ok: eventhooks.deleteHook(req.params.id) }));

  // Fijnmazige uitgaande webhook-abonnementen (filters + payload-template).
  app.get('/api/admin/webhook-subs', requireAdmin, (req, res) => res.json({ subs: webhookSubs.listSubs(), events: webhookSubs.EVENTS }));
  app.post('/api/admin/webhook-subs', requireAdmin, express.json(), (req, res) => {
    try { res.json({ ok: true, sub: webhookSubs.addSub(req.body || {}) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/admin/webhook-subs/:id', requireAdmin, (req, res) => res.json({ ok: webhookSubs.deleteSub(req.params.id) }));

  // Interactief analytics-overzicht (admin): actie-verdeling, top-gebruikers en
  // een dag-tijdlijn, afgeleid uit het audit-log.
  app.get('/api/admin/report/analytics', requireAdmin, (req, res) => {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = Date.now() - days * 86400000;
    const byAction = {};
    const byUser = {};
    const timeline = {}; // 'YYYY-MM-DD' -> count
    let total = 0;
    for (const line of tailLines(config.auditLog, 50000)) {
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (!e.ts || new Date(e.ts).getTime() < since) continue;
      byAction[e.action] = (byAction[e.action] || 0) + 1;
      if (e.user) {
        byUser[e.user] = byUser[e.user] || { downloads: 0, uploads: 0, total: 0 };
        byUser[e.user].total++;
        if (e.action === 'download') byUser[e.user].downloads++;
        if (e.action === 'upload') byUser[e.user].uploads++;
      }
      const day = new Date(e.ts).toISOString().slice(0, 10);
      timeline[day] = (timeline[day] || 0) + 1;
      total++;
    }
    const topUsers = Object.entries(byUser)
      .map(([user, v]) => ({ user, ...v }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
    res.json({ days, total, byAction, topUsers, timeline });
  });

  // Geconsolideerd admin-dashboard: opslaggroei, top-opslag per gebruiker,
  // actieve gebruikers en kern-totalen in één aanroep (voor de grafiek-UI).
  app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
    // Opslaggroei-tijdlijn uit de historische samples.
    const samples = getHistory(0);
    const storageTrend = samples.map((s) => ({ ts: s.ts, diskFree: s.fileserver_disk_free_percent ?? null, bytesUp: s.fileserver_bytes_uploaded_total ?? 0 }));
    // Top-opslag per gebruiker.
    const topStorage = listUsers().map((u) => {
      let used = 0; try { used = dirSize(homeDir(u.username)); } catch { /* map ontbreekt */ }
      return { user: u.username, used, quota: u.quota || 0 };
    }).sort((a, b) => b.used - a.used).slice(0, 8);
    // Actieve gebruikers (uniek) in de laatste 24 uur uit het audit-log.
    const since = Date.now() - 86400000;
    const active = new Set();
    for (const line of tailLines(config.auditLog, 20000)) {
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (e.user && e.ts && new Date(e.ts).getTime() >= since) active.add(e.user);
    }
    res.json({ storageTrend, topStorage, activeUsers24h: active.size, totals: metrics.snapshot(), users: listUsernames().length });
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
    // Classificatiebeleid: vertrouwelijke/geheime bestanden mogen niet publiek.
    if (!labels.mayShare(req.home, req.body.path || '')) {
      audit('web', req.user, 'share_blocked', { path: req.body.path, reason: 'classificatie' });
      return res.status(403).json({ error: 'Dit bestand is als vertrouwelijk/geheim gelabeld en mag niet publiek gedeeld worden.' });
    }
    // Optioneel een preset als basis; expliciete velden in de body gaan voor.
    let preset = null;
    if (req.body.presetId) {
      preset = sharePresets.getPreset(req.user, String(req.body.presetId));
      if (!preset) return res.status(404).json({ error: 'Preset niet gevonden' });
    }
    const pick = (k) => (req.body[k] !== undefined && req.body[k] !== '' ? Number(req.body[k]) : (preset ? preset[k] : 0)) || 0;
    let password = req.body.password || null;
    let generatedPassword = null;
    if (!password && preset && preset.autoPassword) { password = generatedPassword = sharePresets.generatePassword(); }
    const token = createShare(req.user, req.body.path, {
      expiresInHours: pick('expiresInHours'),
      password,
      maxDownloads: pick('maxDownloads'),
      maxKbps: pick('maxKbps'),
    });
    audit('web', req.user, 'share_create', { path: req.body.path, preset: preset ? preset.id : undefined });
    emitEvent('share_create', { user: req.user, path: req.body.path, token });
    notifyShare('share_create', req.user, { path: req.body.path, token });
    emitAdmin('activity', { kind: 'share', user: req.user });
    res.json({ token, url: `/s/${token}`, ...(generatedPassword ? { password: generatedPassword } : {}) });
  });
  app.get('/api/shares', (req, res) => res.json({ shares: listShares(req.user) }));
  app.delete('/api/share/:token', (req, res) => res.json({ ok: deleteShare(req.user, req.params.token) }));

  // Drop-link (upload-portaal) aanmaken.
  app.post('/api/droplink', requireWrite, express.json(), (req, res) => {
    const token = createShare(req.user, req.body.path || '/', {
      type: 'upload',
      expiresInHours: req.body.expiresInHours ? Number(req.body.expiresInHours) : 0,
      password: req.body.password || null,
      // Brandbare brievenbus: burn=true -> vervalt na de eerste aanlevering.
      maxUploads: req.body.burn ? 1 : (req.body.maxUploads ? Number(req.body.maxUploads) : 0),
    });
    audit('web', req.user, 'droplink_create', { path: req.body.path, burn: !!req.body.burn });
    res.json({ token, url: `/s/${token}` });
  });

  // Stabiele permalink voor een bestand ophalen/aanmaken (optioneel met
  // wachtwoord en vervaldatum).
  app.post('/api/permalink', requireWrite, express.json(), (req, res) => {
    try {
      const rel = req.body.path || '';
      resolveWithin(req.home, rel); // valideer dat het pad binnen de home valt
      // Classificatiebeleid geldt ook voor permalinks (publieke egress).
      if (!labels.mayShare(req.home, rel)) {
        audit('web', req.user, 'permalink_blocked', { path: rel, reason: 'classificatie' });
        return res.status(403).json({ error: 'Dit bestand is als vertrouwelijk/geheim gelabeld en mag niet publiek gedeeld worden.' });
      }
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
    return { abs, ownerHome, mode: match.mode, base: resolveWithin(ownerHome, match.path) };
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
      receipts.recordRead(req.query.owner, req.query.path || '/', req.user, isGuest(req.user) ? 'gast' : 'gedeelde map', { ip: clientIp(req) });
      res.download(abs, path.basename(abs));
    } catch (err) {
      res.status(403).json({ error: err.message });
    }
  });
  // Schrijven in een met mij gedeelde 'rw'-map.
  // v3.45.1: eerst naar een tijdelijke map; pas na alle controles (bewaarplicht,
  // vergrendeling, E2E, quotum van de eigenaar, AV/DLP) naar de gedeelde map.
  // Voorheen schreef multer direct in de map van de eigenaar — zonder die checks
  // en met overschrijven van bestaande (ook bewaarplichtige) bestanden.
  const sharedUpload = multer({ limits: mlimits, dest: path.join(config.chunkDir, 'shared-up') });
  const sharedProtected = (ownerHome, rel, checkE2E) =>
    !!(retention.retainedUntil(ownerHome, rel) || locks.lockOwner(ownerHome, rel) ||
      (checkE2E && e2eFolders.isE2ERequired(ownerHome, path.posix.dirname(rel)) && !/\.enc$/i.test(rel)));
  app.post('/api/shared/upload', (req, res, next) => {
    try { resolveShared(req, req.query.path || '/', true); } catch (err) { return res.status(403).json({ error: err.message }); }
    next();
  }, sharedUpload.array('files'), async (req, res) => {
    const owner = String(req.query.owner || ''); const base = req.query.path || '/';
    const uploaded = []; const rejected = [];
    for (const f of req.files || []) {
      const name = path.basename(f.originalname || 'bestand');
      try {
        const { abs, ownerHome } = resolveShared(req, path.posix.join(base, name), true);
        const rel = toClientPath(ownerHome, abs);
        if (sharedProtected(ownerHome, rel, true)) { rejected.push({ name, reason: 'beschermd (bewaarplicht, vergrendeld of E2E-map)' }); continue; }
        const q = quota(owner);
        if (q > 0 && dirSize(ownerHome) + f.size > q) { rejected.push({ name, reason: 'quotum van de eigenaar vol' }); continue; }
        const verdict = await inspectUpload({ abs: f.path, user: req.user, home: ownerHome, relPath: rel, via: 'web' });
        if (!verdict.ok) { rejected.push({ name, reason: verdict.reason === 'malware' ? 'besmet' : 'gevoelige gegevens' }); continue; }
        await fsp.mkdir(path.dirname(abs), { recursive: true });
        try { await fsp.rename(f.path, abs); } catch { await fsp.copyFile(f.path, abs); }
        invalidateDirSize(ownerHome);
        uploaded.push(name);
      } catch (err) { rejected.push({ name, reason: err.message }); }
      finally { fs.rmSync(f.path, { force: true }); }
    }
    audit('web', req.user, 'shared_upload', { owner, path: base, files: uploaded, rejected: rejected.length });
    if (uploaded.length) {
      subscriptions.notifySubscribers(owner, req.user, base, 'upload');
      emitToUser(owner, 'change', { action: 'shared_upload' });
    }
    res.status(uploaded.length || !rejected.length ? 200 : 403).json({ uploaded, rejected });
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
      const { abs, ownerHome, base } = resolveShared(req, req.body.path, true);
      const rel = toClientPath(ownerHome, abs);
      if (abs === base) return res.status(403).json({ error: 'De gedeelde map zelf kan niet verwijderd worden' });
      if (rel === '/' || sharedProtected(ownerHome, rel, false)) return res.status(423).json({ error: 'Beschermd (bewaarplicht of vergrendeld)' });
      await fsp.rm(abs, { recursive: true, force: true });
      invalidateDirSize(ownerHome);
      audit('web', req.user, 'shared_delete', { owner: req.body.owner, path: req.body.path });
      emitToUser(req.body.owner, 'change', { action: 'shared_delete' });
      res.json({ ok: true });
    } catch (err) { res.status(403).json({ error: err.message }); }
  });

  // --- v3.44: gasten beheren (eigenaar) ---
  app.get('/api/guests', (req, res) => res.json({ guests: guests.listGuests(req.user) }));
  app.post('/api/guests', requireWrite, express.json(), (req, res) => {
    try {
      const abs = resolveWithin(req.home, String(req.body.path || ''));
      const rel = toClientPath(req.home, abs);
      if (rel === '/' || !fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return res.status(400).json({ error: 'Kies een bestaande submap (niet je hele thuismap)' });
      if (!labels.mayShare(req.home, rel)) return res.status(403).json({ error: 'Deze map mag door het label niet gedeeld worden' });
      if (config.requireTwoFactor === 'all') return res.status(403).json({ error: 'Gasttoegang is uitgeschakeld: het beleid vereist 2FA voor alle accounts en gasten loggen in met een eenmalige link' });
      const g = guests.createGuest(req.user, { path: rel, mode: req.body.mode, days: req.body.days, label: req.body.label, email: req.body.email });
      const link = `${(config.appBaseUrl || `${req.protocol}://${req.get('host')}`)}/gast/${g.token}`;
      audit('web', req.user, 'guest_create', { guest: g.guest, path: rel, mode: req.body.mode === 'rw' ? 'rw' : 'ro', expires: g.expires });
      let mailed = false;
      if (req.body.email && /^[^@\s]+@[^@\s]+$/.test(req.body.email)) {
        try { sendMail({ to: req.body.email, subject: `${req.user} deelt een map met je`, text: `Je bent als gast uitgenodigd voor de map ${rel}.\n\nOpen deze eenmalige link (7 dagen geldig):\n${link}\n\nToegang vervalt op ${new Date(g.expires).toLocaleDateString('nl-NL')}.` }).catch(() => {}); mailed = true; } catch { /* geen mail */ }
      }
      res.json({ guest: g.guest, link, expires: g.expires, mailed });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/guests/:name/link', requireWrite, (req, res) => {
    try { const t = guests.renewLink(req.user, req.params.name); audit('web', req.user, 'guest_link', { guest: req.params.name }); res.json({ link: `${(config.appBaseUrl || `${req.protocol}://${req.get('host')}`)}/gast/${t}` }); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });
  app.delete('/api/guests/:name', (req, res) => {
    try { guests.removeGuest(req.user, req.params.name); revokeAllForUser(req.params.name); audit('web', req.user, 'guest_remove', { guest: req.params.name }); res.json({ ok: true }); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });

  // --- v3.44: leesbevestigingen ---
  app.get('/api/receipts', (req, res) => res.json(receipts.getReceipts(req.user, String(req.query.path || '/'))));
  app.get('/api/receipts/all', (req, res) => res.json({ tracked: receipts.listTracked(req.user) }));
  app.post('/api/receipts', requireWrite, express.json(), (req, res) => {
    try { resolveWithin(req.home, String(req.body.path || '')); } catch { return res.status(400).json({ error: 'Ongeldig pad' }); }
    const on = receipts.setTracking(req.user, req.body.path, !!req.body.on);
    audit('web', req.user, on ? 'receipts_on' : 'receipts_off', { path: req.body.path });
    res.json({ tracked: on });
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
  app.post('/api/2fa/setup', async (req, res) => {
    const secret = generateSecret();
    req._pendingSecret = secret;
    const otpauth = otpauthUrl(secret, req.user);
    res.json({ secret, otpauth, qr: await qrSvg(otpauth) });
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
  // Doorzoekbaar audit-log met filters (gebruiker, actie, kanaal, periode, tekst).
  app.get('/api/admin/audit/search', requireAdmin, async (req, res) => {
    try { res.json(await searchAudit(req.query)); } catch (err) { res.status(500).json({ error: err.message }); }
  });
  // Export (CSV/JSON) met SHA-256 van de inhoud en de ketencontrole.
  app.get('/api/admin/audit/export', requireAdmin, async (req, res) => {
    const fmt = req.query.format === 'csv' ? 'csv' : 'json';
    try {
      const x = await exportAudit(req.query, fmt, req.user);
      audit('web', req.user, 'audit_export', { format: fmt, count: x.meta.count, sha256: x.sha256, chainOk: x.meta.chain.ok });
      res.set('Content-Type', x.contentType);
      res.set('Content-Disposition', `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.${fmt}"`);
      res.set('X-Export-Sha256', x.sha256);
      res.set('X-Audit-Chain', x.meta.chain.ok ? `intact;${x.meta.chain.checked}` : `broken;${x.meta.chain.brokenAt}`);
      res.send(x.body);
    } catch (err) { res.status(500).json({ error: err.message }); }
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

  // Compressie-at-rest: comprimeer koude (lang niet gewijzigde) bestanden.
  app.post('/api/admin/coldstore/run', requireAdmin, (req, res) => {
    const days = req.body && req.body.days ? Number(req.body.days) : config.coldStoreDays;
    res.json({ ok: true, ...coldstore.compressCold(config.storageDir, days) });
  });
  // Warm een cold-bestand in de eigen home weer op (uitpakken).
  app.post('/api/warmup', requireWrite, express.json(), (req, res) => {
    try { res.json({ ok: coldstore.warmUp(resolveWithin(req.home, req.body.path || '')) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  // Server-brede point-in-time snapshots (alleen admin).
  app.get('/api/admin/server-snapshots', requireAdmin, (req, res) => res.json({ snapshots: serverSnaps.listServerSnapshots() }));
  app.post('/api/admin/server-snapshots', requireAdmin, express.json(), (req, res) =>
    res.json({ ok: true, ...serverSnaps.createServerSnapshot((req.body && req.body.label) || '') }));
  app.post('/api/admin/server-snapshots/:id/restore', requireAdmin, (req, res) => {
    try { res.json(serverSnaps.restoreServerSnapshot(req.params.id, req.user)); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });
  app.delete('/api/admin/server-snapshots/:id', requireAdmin, (req, res) => res.json({ ok: serverSnaps.deleteServerSnapshot(req.params.id) }));

  // Zelftest / chaos-knop: continuïteitscontroles op verzoek.
  app.post('/api/admin/selftest', requireAdmin, (req, res) => res.json(runSelfTest()));

  // Statuspagina-beheer: incidenten + onderhoudsvensters (alleen admin).
  app.get('/api/admin/incidents', requireAdmin, (req, res) => res.json(incidents.listAll()));
  app.post('/api/admin/incidents', requireAdmin, express.json(), (req, res) => {
    try { res.json({ ok: true, incident: incidents.addIncident(req.body || {}, req.user) }); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/admin/incidents/:id/resolve', requireAdmin, (req, res) => {
    const inc = incidents.resolveIncident(req.params.id, req.user);
    if (!inc) return res.status(404).json({ error: 'Incident niet gevonden' });
    res.json({ ok: true, incident: inc });
  });
  app.delete('/api/admin/incidents/:id', requireAdmin, (req, res) => res.json({ ok: incidents.deleteIncident(req.params.id) }));
  app.post('/api/admin/maintenance', requireAdmin, express.json(), (req, res) =>
    res.json({ ok: true, maintenance: incidents.addMaintenance(req.body || {}, req.user) }));
  app.delete('/api/admin/maintenance/:id', requireAdmin, (req, res) => res.json({ ok: incidents.deleteMaintenance(req.params.id) }));

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
  app.get('/api/admin/settings', requireAdmin, (req, res) => res.json({ settings: getSettings(), schema: settingsSchema() }));
  app.put('/api/admin/settings', requireAdmin, express.json(), (req, res) => {
    const settings = updateSettings(req.body || {});
    audit('web', req.user, 'settings_update', { keys: Object.keys(req.body || {}) });
    res.json({ settings });
  });

  // Beschikbaarheid/SLA-dashboard: uptime, MTTR en dag-tijdlijn uit de incident-historie.
  app.get('/api/admin/sla', requireAdmin, (req, res) => {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
    res.json(sla.compute(days));
  });

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
      // En de herkende beeldlabels (gezichten/objecten) meenemen bij zoeken.
      if (!match && !e.isDirectory()) {
        const rel = '/' + path.relative(home, full).split(path.sep).join('/');
        if (vision.labelMatches(home, rel, query)) match = true;
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

// Thumbnails vooraf genereren, strikt één tegelijk (een bulk-upload van duizenden
// foto's mag de CPU niet dichttrekken). Fouten zijn niet-fataal.
let thumbChain = Promise.resolve();
let thumbQueued = 0;
function precacheThumb(absFile) {
  if (thumbQueued > 5000) return; // wachtrij vol: thumbnails volgen dan bij het bekijken
  thumbQueued++;
  thumbChain = thumbChain
    .then(() => getThumbnail(absFile, 56))
    .then(() => getThumbnail(absFile, 200))
    .catch(() => {})
    .finally(() => { thumbQueued--; });
}
