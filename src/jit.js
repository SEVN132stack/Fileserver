import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { audit } from './audit.js';
import { alert } from './alerts.js';

// Just-in-time toegang: een gebruiker vraagt tijdelijk een hogere rol aan (met
// reden). Een admin keurt goed; de verhoging vervalt automatisch na de gevraagde
// duur (begrensd door JIT_MAX_HOURS). Zo krijgt niemand permanent admin-rechten.

const ROLES = ['user', 'readonly', 'admin'];

function readAll() { return readJson(config.jitFile, () => []); }
function writeAll(list) { writeJson(config.jitFile, list, { mode: 0o600 }); }

export function listRequests() { return readAll(); }

export function requestElevation(user, role, reason = '', hours = 1) {
  if (!ROLES.includes(role)) throw new Error('Onbekende rol');
  const h = Math.min(Math.max(0.25, Number(hours) || 1), config.jitMaxHours);
  const list = readAll();
  const req = {
    id: randomBytes(6).toString('hex'), user, role, reason: String(reason).slice(0, 500),
    hours: h, status: 'pending', created: Date.now(), approvedBy: null, until: 0,
  };
  list.push(req);
  writeAll(list);
  audit('web', user, 'jit_request', { id: req.id, role, hours: h });
  alert(`jit-${req.id}`, 'JIT-toegangsverzoek', `${user} vraagt rol '${role}' voor ${h}u: ${req.reason}`);
  return req;
}

export function decide(id, approver, approve) {
  const list = readAll();
  const req = list.find((r) => r.id === id);
  if (!req || req.status !== 'pending') return null;
  req.status = approve ? 'approved' : 'denied';
  req.approvedBy = approver;
  req.decidedAt = Date.now();
  if (approve) req.until = Date.now() + req.hours * 3600000;
  writeAll(list);
  audit('web', approver, approve ? 'jit_approve' : 'jit_deny', { id, user: req.user, role: req.role });
  return req;
}

// De momenteel actieve verhoging voor een gebruiker (of null).
export function activeElevation(user) {
  const now = Date.now();
  const active = readAll().filter((r) => r.user === user && r.status === 'approved' && r.until > now);
  if (!active.length) return null;
  // Hoogste/laatste verhoging wint.
  return active.sort((a, b) => b.until - a.until)[0];
}

// De effectieve rol: de tijdelijke JIT-rol indien actief, anders de basisrol.
export function effectiveRole(user, baseRole) {
  const el = activeElevation(user);
  if (!el) return baseRole;
  // Verhoog alleen; verlaag nooit onder de basisrol (admin blijft admin).
  if (baseRole === 'admin') return 'admin';
  return el.role;
}
