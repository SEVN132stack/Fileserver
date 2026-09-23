import { randomBytes, createHash } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { addUser, updateUser, deleteUser, getUser, userExists, listUsernames, role } from './users.js';

// Gasttoegang (v3.44): een gebruiker nodigt iemand van buiten uit voor één map.
// De gast wordt een tijdelijk account met rol 'guest' zonder bruikbaar wachtwoord
// (dus geen SFTP/WebDAV/wachtwoord-login) dat alleen via een eenmalige link
// inlogt en uitsluitend de gedeelde map ziet. Na de vervaldatum wordt het
// account met de deling automatisch verwijderd.

const MAX_DAYS = 90;
const LINK_TTL_MS = 7 * 86400000;
const tokFile = () => config.guestTokensFile;
const h = (t) => createHash('sha256').update(String(t)).digest('hex');

export const isGuest = (user) => role(user) === 'guest';

function newLink(guest) {
  const token = randomBytes(24).toString('base64url');
  const all = readJson(tokFile(), {});
  for (const [k, v] of Object.entries(all)) if (v.guest === guest || v.expires < Date.now()) delete all[k]; // één geldige link per gast
  all[h(token)] = { guest, expires: Date.now() + LINK_TTL_MS };
  writeJson(tokFile(), all);
  return token;
}

// Eenmalig verbruiken; geeft de gastnaam terug of null.
export function consumeLink(token) {
  if (typeof token !== 'string' || token.length > 100) return null;
  const all = readJson(tokFile(), {});
  const rec = all[h(token)];
  if (!rec) return null;
  delete all[h(token)]; writeJson(tokFile(), all);
  if (rec.expires < Date.now() || !userExists(rec.guest) || !isGuest(rec.guest)) return null;
  const u = getUser(rec.guest);
  if (u.expires && u.expires < Date.now()) return null;
  return rec.guest;
}

export function createGuest(owner, { path: p, mode = 'ro', days = 7, label = '', email = '' } = {}) {
  if (isGuest(owner)) throw new Error('Gasten kunnen geen gasten uitnodigen');
  if (typeof p !== 'string' || !p.startsWith('/')) throw new Error('Ongeldige map');
  const d = Math.max(1, Math.min(MAX_DAYS, parseInt(days, 10) || 7));
  let name;
  do { name = 'gast-' + randomBytes(4).toString('hex'); } while (userExists(name));
  addUser({ username: name, password: randomBytes(32).toString('base64url'), role: 'guest', quota: 1, email: String(email || '').slice(0, 200) });
  updateUser(name, { expires: Date.now() + d * 86400000, disablePassword: true, guestOf: owner, guestLabel: String(label || email || name).slice(0, 80) });
  const o = getUser(owner);
  const shares = (o.shares || []).filter((s) => s.to !== name);
  shares.push({ to: name, path: p, mode: mode === 'rw' ? 'rw' : 'ro', label: `Gedeeld door ${owner}` });
  updateUser(owner, { shares });
  return { guest: name, token: newLink(name), expires: getUser(name).expires };
}

export function listGuests(owner) {
  const o = getUser(owner);
  const grants = (o && o.shares) || [];
  return listUsernames().filter((n) => isGuest(n) && getUser(n).guestOf === owner).map((n) => {
    const u = getUser(n); const g = grants.find((s) => s.to === n) || {};
    return { guest: n, label: u.guestLabel || n, email: u.email || '', path: g.path || null, mode: g.mode || 'ro', expires: u.expires || 0, lastLogin: u.lastLogin || 0 };
  });
}

function ownedGuest(owner, name) {
  if (!userExists(name) || !isGuest(name) || getUser(name).guestOf !== owner) throw new Error('Gast niet gevonden');
}

export function renewLink(owner, name) { ownedGuest(owner, name); return newLink(name); }

export function removeGuest(owner, name) {
  ownedGuest(owner, name);
  const o = getUser(owner);
  if (o) updateUser(owner, { shares: (o.shares || []).filter((s) => s.to !== name) });
  const all = readJson(tokFile(), {});
  for (const [k, v] of Object.entries(all)) if (v.guest === name) delete all[k];
  writeJson(tokFile(), all);
  deleteUser(name);
}

// Verlopen gasten opruimen (account + deling). Geeft de verwijderde namen terug.
export function sweepGuests(now = Date.now()) {
  const gone = [];
  for (const n of listUsernames()) {
    if (!isGuest(n)) continue;
    const u = getUser(n);
    if ((u.expires && u.expires < now) || !u.guestOf || !userExists(u.guestOf)) { try { removeGuest(u.guestOf, n); gone.push(n); } catch { try { deleteUser(n); gone.push(n); } catch { /* nvt */ } } }
  }
  return gone;
}

export function initGuests() { const t = setInterval(() => sweepGuests(), 3600000); if (t.unref) t.unref(); }

// Welke API-routes een gast mag gebruiken (verder alles 403).
const GUEST_ALLOW = [/^\/whoami$/, /^\/logout$/, /^\/shared\//, /^\/comments$/, /^\/events$/];
export function guestAllowed(apiPath) { return GUEST_ALLOW.some((r) => r.test(apiPath)); }
