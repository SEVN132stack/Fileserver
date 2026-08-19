import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { markWritten } from './config-drift.js';
import { readJson, writeJson } from './jsoncache.js';

// Publieke deel-links: token -> { user, path, expires, password (hash|null) }.

function read() {
  return readJson(config.sharesFile, () => ({}));
}
function write(data) {
  writeJson(config.sharesFile, data, { mode: 0o600 });
  markWritten(config.sharesFile);
}

function hash(pw) {
  const salt = randomBytes(12).toString('hex');
  return `${salt}$${scryptSync(pw, salt, 32).toString('hex')}`;
}
function verify(pw, stored) {
  const [salt, h] = stored.split('$');
  const calc = scryptSync(pw, salt, 32);
  const known = Buffer.from(h, 'hex');
  return calc.length === known.length && timingSafeEqual(calc, known);
}

export function createShare(user, path, { expiresInHours, password, maxDownloads, maxUploads, type, maxKbps } = {}) {
  const data = read();
  const token = randomBytes(12).toString('base64url');
  data[token] = {
    user,
    path,
    type: type === 'upload' ? 'upload' : 'download', // 'upload' = drop-link (aanleveren)
    expires: expiresInHours ? Date.now() + expiresInHours * 3600000 : 0,
    password: password ? hash(password) : null,
    maxDownloads: maxDownloads ? Number(maxDownloads) : 0,
    // Maximaal aantal uploads voor een drop-/brievenbus-link (0 = onbeperkt).
    // Een "brandbare" brievenbus zet dit op 1: na de eerste aanlevering vervalt hij.
    maxUploads: maxUploads ? Number(maxUploads) : 0,
    maxKbps: maxKbps ? Number(maxKbps) : 0, // downloadsnelheidslimiet (KB/s), 0 = geen
    downloads: 0,
    uploads: 0,
    created: Date.now(),
  };
  write(data);
  return token;
}

// Registreer een upload op een drop-link. Geeft true als de link daarna nog
// bruikbaar is; bij het bereiken van maxUploads wordt de link verwijderd (burn).
export function countUpload(token) {
  const data = read();
  const s = data[token];
  if (!s) return false;
  s.uploads = (s.uploads || 0) + 1;
  if (s.maxUploads && s.uploads >= s.maxUploads) { delete data[token]; write(data); return false; }
  write(data);
  return true;
}

export function getShare(token) {
  const data = read();
  const s = data[token];
  if (!s) return null;
  if (s.expires && s.expires < Date.now()) {
    delete data[token];
    write(data);
    return null;
  }
  if (s.maxDownloads && s.downloads >= s.maxDownloads) {
    delete data[token];
    write(data);
    return null;
  }
  return s;
}

// Registreer een download; verwijdert de link als het maximum is bereikt.
export function countDownload(token) {
  const data = read();
  const s = data[token];
  if (!s) return;
  s.downloads = (s.downloads || 0) + 1;
  if (s.maxDownloads && s.downloads >= s.maxDownloads) delete data[token];
  write(data);
}

export function checkSharePassword(share, password) {
  if (!share.password) return true;
  return !!password && verify(password, share.password);
}

export function listShares(user) {
  const data = read();
  return Object.entries(data)
    .filter(([, s]) => s.user === user)
    .map(([token, s]) => ({ token, path: s.path, type: s.type || 'download', expires: s.expires, hasPassword: !!s.password, maxDownloads: s.maxDownloads || 0, maxUploads: s.maxUploads || 0, downloads: s.downloads || 0, uploads: s.uploads || 0 }));
}

// Alle deel-links (voor het admin-dashboard).
export function listAllShares() {
  const data = read();
  return Object.entries(data).map(([token, s]) => ({
    token, user: s.user, path: s.path, type: s.type || 'download', expires: s.expires,
    hasPassword: !!s.password, maxDownloads: s.maxDownloads || 0, downloads: s.downloads || 0, uploads: s.uploads || 0,
    created: s.created,
  }));
}

export function deleteShare(user, token) {
  const data = read();
  if (data[token] && data[token].user === user) {
    delete data[token];
    write(data);
    return true;
  }
  return false;
}

// Beheer (admin): elke link verwijderen of aanpassen.
export function adminDeleteShare(token) {
  const data = read();
  if (!data[token]) return false;
  delete data[token];
  write(data);
  return true;
}
export function adminUpdateShare(token, opts = {}) {
  const data = read();
  const s = data[token];
  if (!s) return false;
  if (opts.password !== undefined) s.password = opts.password ? hash(opts.password) : null;
  if (opts.expiresInHours !== undefined) s.expires = opts.expiresInHours ? Date.now() + Number(opts.expiresInHours) * 3600000 : 0;
  if (opts.maxDownloads !== undefined) s.maxDownloads = opts.maxDownloads ? Number(opts.maxDownloads) : 0;
  write(data);
  return true;
}
