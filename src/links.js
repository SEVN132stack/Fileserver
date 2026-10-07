import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

// Interne links: een vaste UUID per bestand/map die alleen voor ingelogde
// gebruikers werkt en het item in de app opent (/o/<uuid>). Anders dan een
// permalink geeft zo'n link geen publieke toegang. De UUID blijft geldig bij
// hernoemen/verplaatsen en vervalt bij verwijderen.
// Opslag: uuid -> { user, path, created }.

function read() {
  try { return JSON.parse(fs.readFileSync(config.linksFile, 'utf8')); } catch { return {}; }
}
function write(d) {
  // Eerst naar een tijdelijk bestand en dan hernoemen: een crash tijdens het
  // schrijven laat anders een half JSON-bestand achter, waarna alle links weg zijn.
  const tmp = config.linksFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, config.linksFile);
}

export function getOrCreate(user, path) {
  const d = read();
  let uuid = Object.keys(d).find((k) => d[k].user === user && d[k].path === path);
  if (!uuid) {
    uuid = randomUUID();
    d[uuid] = { user, path, created: Date.now() };
    write(d);
  }
  return uuid;
}

export function resolve(uuid) {
  return read()[uuid] || null;
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
