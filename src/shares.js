import fs from 'node:fs';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

// Publieke deel-links: token -> { user, path, expires, password (hash|null) }.

function read() {
  if (!fs.existsSync(config.sharesFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(config.sharesFile, 'utf8'));
  } catch {
    return {};
  }
}
function write(data) {
  fs.writeFileSync(config.sharesFile, JSON.stringify(data, null, 2), { mode: 0o600 });
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

export function createShare(user, path, { expiresInHours, password } = {}) {
  const data = read();
  const token = randomBytes(12).toString('base64url');
  data[token] = {
    user,
    path,
    expires: expiresInHours ? Date.now() + expiresInHours * 3600000 : 0,
    password: password ? hash(password) : null,
    created: Date.now(),
  };
  write(data);
  return token;
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
  return s;
}

export function checkSharePassword(share, password) {
  if (!share.password) return true;
  return !!password && verify(password, share.password);
}

export function listShares(user) {
  const data = read();
  return Object.entries(data)
    .filter(([, s]) => s.user === user)
    .map(([token, s]) => ({ token, path: s.path, expires: s.expires, hasPassword: !!s.password }));
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
