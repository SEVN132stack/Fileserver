import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

// Stabiele permalink per bestand: een UUID die altijd naar hetzelfde bestand
// verwijst (zolang het niet hernoemd/verwijderd wordt). Opslag: uuid -> {user, path}.
// Er is per (gebruiker, pad) hoogstens één UUID, zodat de link stabiel blijft.

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

// Geef de bestaande UUID voor (user, path) terug of maak er een aan.
export function getOrCreate(user, path) {
  const d = read();
  for (const [uuid, v] of Object.entries(d)) {
    if (v.user === user && v.path === path) return uuid;
  }
  const uuid = randomUUID();
  d[uuid] = { user, path, created: Date.now() };
  write(d);
  return uuid;
}

export function resolve(uuid) {
  return read()[uuid] || null;
}

// Verplaats/hernoem: laat de permalink het bestand volgen.
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

// Verwijder alle permalinks voor een pad (en onderliggende paden).
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
  return Object.entries(read()).filter(([, v]) => v.user === user).map(([uuid, v]) => ({ uuid, path: v.path }));
}
