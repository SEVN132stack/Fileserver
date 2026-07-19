import { randomBytes } from 'node:crypto';

// Eenvoudige in-memory sessie-opslag met cookie-token.
const sessions = new Map();
const TTL_MS = 12 * 60 * 60 * 1000; // 12 uur

export function createSession(username) {
  const token = randomBytes(24).toString('base64url');
  sessions.set(token, { username, expires: Date.now() + TTL_MS });
  return token;
}

export function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return s;
}

export function destroySession(token) {
  sessions.delete(token);
}

// Parse de sessie-cookie uit een verzoek.
export function tokenFromReq(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) if (s.expires < now) sessions.delete(t);
}, 60000).unref();
