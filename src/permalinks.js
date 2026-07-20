import fs from 'node:fs';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

// Stabiele permalink per bestand: een UUID die altijd naar hetzelfde bestand
// verwijst (zolang het niet hernoemd/verwijderd wordt). Optioneel met wachtwoord
// en vervaldatum. Opslag: uuid -> { user, path, password, expires, created }.

function read() {
  try {
    return JSON.parse(fs.readFileSync(config.permalinksFile, 'utf8'));
  } catch {
    return {};
  }
}
function write(d) {
  fs.writeFileSync(config.permalinksFile, JSON.stringify(d, null, 2), { mode: 0o600 });
}

function hash(pw) {
  const salt = randomBytes(12).toString('hex');
  return `${salt}$${scryptSync(pw, salt, 32).toString('hex')}`;
}
function verify(pw, stored) {
  const [salt, h] = String(stored).split('$');
  if (!salt || !h) return false;
  const calc = scryptSync(pw, salt, 32);
  const known = Buffer.from(h, 'hex');
  return calc.length === known.length && timingSafeEqual(calc, known);
}

// Geef de bestaande UUID voor (user, path) terug of maak er een aan. Met opts
// worden wachtwoord/vervaldatum (opnieuw) ingesteld.
export function getOrCreate(user, path, opts = {}) {
  const d = read();
  let uuid = Object.keys(d).find((k) => d[k].user === user && d[k].path === path);
  if (!uuid) {
    uuid = randomUUID();
    d[uuid] = { user, path, password: null, expires: 0, created: Date.now() };
  }
  if (opts.password !== undefined) d[uuid].password = opts.password ? hash(opts.password) : null;
  if (opts.expiresInHours !== undefined) d[uuid].expires = opts.expiresInHours ? Date.now() + opts.expiresInHours * 3600000 : 0;
  write(d);
  return uuid;
}

export function resolve(uuid) {
  const d = read();
  const s = d[uuid];
  if (!s) return null;
  if (s.expires && s.expires < Date.now()) {
    delete d[uuid];
    write(d);
    return null;
  }
  return s;
}

export function checkPassword(entry, password) {
  if (!entry.password) return true;
  return !!password && verify(password, entry.password);
}

export function updatePath(user, oldPath, newPath) {
  const d = read();
  let changed = false;
  for (const v of Object.values(d)) {
    if (v.user === user && (v.path === oldPath || v.path.startsWith(oldPath + '/'))) {
      v.path = newPath + v.path.slice(oldPath.length);
      changed = true;
    }
  }
  if (changed) write(d);
}

export function removeForPath(user, path) {
  const d = read();
  let changed = false;
  for (const [uuid, v] of Object.entries(d)) {
    if (v.user === user && (v.path === path || v.path.startsWith(path + '/'))) {
      delete d[uuid];
      changed = true;
    }
  }
  if (changed) write(d);
}

export function listForUser(user) {
  return Object.entries(read())
    .filter(([, v]) => v.user === user)
    .map(([uuid, v]) => ({ uuid, path: v.path, hasPassword: !!v.password, expires: v.expires || 0 }));
}

// Beheer (admin): alle permalinks tonen, verwijderen of aanpassen.
export function listAll() {
  return Object.entries(read()).map(([uuid, v]) => ({
    uuid, user: v.user, path: v.path, hasPassword: !!v.password, expires: v.expires || 0, created: v.created,
  }));
}
export function adminDelete(uuid) {
  const d = read();
  if (!d[uuid]) return false;
  delete d[uuid];
  write(d);
  return true;
}
export function adminUpdate(uuid, opts = {}) {
  const d = read();
  const s = d[uuid];
  if (!s) return false;
  if (opts.password !== undefined) s.password = opts.password ? hash(opts.password) : null;
  if (opts.expiresInHours !== undefined) s.expires = opts.expiresInHours ? Date.now() + Number(opts.expiresInHours) * 3600000 : 0;
  write(d);
  return true;
}
