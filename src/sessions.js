import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { revokeUser as revokeWopi } from './wopi.js';

// Sessie-opslag met metadata, zodat een gebruiker actieve sessies kan bekijken
// en op afstand kan intrekken.
const sessions = new Map(); // token -> { id, username, expires, created, ip, ua }
const TTL_MS = 12 * 60 * 60 * 1000;

export function createSession(username, meta = {}) {
  const token = randomBytes(24).toString('base64url');
  const id = randomBytes(6).toString('hex');
  sessions.set(token, {
    id, username, expires: Date.now() + TTL_MS, created: Date.now(), lastSeen: Date.now(),
    ip: meta.ip || '', ua: (meta.ua || '').slice(0, 200),
  });
  return token;
}

export function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  // Inactiviteits-timeout: sessie verloopt als er te lang niets gebeurt.
  if (config.idleTimeoutMs > 0 && Date.now() - s.lastSeen > config.idleTimeoutMs) {
    sessions.delete(token);
    return null;
  }
  s.lastSeen = Date.now();
  return s;
}

// Admin-impersonatie: laat een sessie tijdelijk als een andere gebruiker
// functioneren ("bekijk als"). De echte (admin-)identiteit blijft bewaard voor
// de audit en om terug te schakelen.
export function startImpersonation(token, targetUser) {
  const s = sessions.get(token);
  if (!s) return false;
  s.impersonating = targetUser;
  return true;
}
export function stopImpersonation(token) {
  const s = sessions.get(token);
  if (s) delete s.impersonating;
}

// Trek alle sessies van een gebruiker in ("overal uitloggen").
export function revokeAllForUser(username) {
  revokeWopi(username); // ook openstaande Office-bewerktokens
  let n = 0;
  for (const [token, s] of sessions) {
    if (s.username === username) { sessions.delete(token); n++; }
  }
  return n;
}

// Markeer dat de gebruiker zich zojuist opnieuw met wachtwoord heeft
// geauthenticeerd (step-up), voor gevoelige beheeracties.
export function markReauth(token) {
  const s = sessions.get(token);
  if (s) s.reauthAt = Date.now();
}
export function reauthedWithin(token, windowMs) {
  const s = sessions.get(token);
  return !!(s && s.reauthAt && Date.now() - s.reauthAt <= windowMs);
}

export function destroySession(token) {
  sessions.delete(token);
}

// Alle actieve sessies van een gebruiker (zonder de token zelf prijs te geven).
export function listSessions(username, currentToken) {
  const out = [];
  for (const [token, s] of sessions) {
    if (s.username === username && s.expires > Date.now()) {
      out.push({ id: s.id, created: s.created, ip: s.ip, ua: s.ua, current: token === currentToken });
    }
  }
  return out.sort((a, b) => b.created - a.created);
}

// Trek een sessie in op id (alleen eigen sessies).
export function revokeSession(username, id) {
  for (const [token, s] of sessions) {
    if (s.username === username && s.id === id) { sessions.delete(token); return true; }
  }
  return false;
}

export function tokenFromReq(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) if (s.expires < now) sessions.delete(t);
}, 60000).unref();
