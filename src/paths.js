import path from 'node:path';
import fs from 'node:fs';

// Houd een door de gebruiker aangeleverd pad altijd binnen een basismap
// (bijv. de home-map van een gebruiker). Voorkomt path-traversal.
// Geeft het absolute pad terug of gooit een fout.
export function resolveWithin(baseDir, userPath = '/') {
  const normalized = path.posix
    .normalize('/' + String(userPath).replace(/\\/g, '/'))
    .replace(/^\/+/, '/');
  const absPath = path.join(baseDir, normalized);
  const rel = path.relative(baseDir, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Ongeldig pad');
  }
  return absPath;
}

// Vertaal een absoluut pad binnen een basismap terug naar een pad dat de
// client ziet (met "/" als home).
export function toClientPath(baseDir, absPath) {
  const rel = path.relative(baseDir, absPath);
  return '/' + rel.split(path.sep).join('/');
}

// Bereken de totale grootte (bytes) van een map, recursief.
function computeDirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    try {
      if (e.isDirectory()) total += computeDirSize(full);
      else total += fs.statSync(full).size;
    } catch {
      /* overslaan */
    }
  }
  return total;
}

// dirSize is een recursieve tree-walk en wordt op hete paden aangeroepen
// (quota-checks bij elke listing/upload). Om te voorkomen dat we bij elk
// verzoek de hele boom opnieuw statten, cachen we het resultaat kort per map.
// Bij mutaties (upload/verwijderen/verplaatsen) wordt de cache ge-invalideerd
// zodat quota-checks niet op verouderde data draaien.
const SIZE_TTL_MS = parseInt(process.env.DIRSIZE_CACHE_MS || '5000', 10);
const sizeCache = new Map(); // dir -> { size, at }

export function dirSize(dir) {
  if (SIZE_TTL_MS <= 0) return computeDirSize(dir);
  const now = Date.now();
  const hit = sizeCache.get(dir);
  if (hit && now - hit.at < SIZE_TTL_MS) return hit.size;
  const size = computeDirSize(dir);
  sizeCache.set(dir, { size, at: now });
  return size;
}

// Maak de cache voor een map (en alle bovenliggende gecachete mappen) leeg.
// Aan te roepen na elke wijziging die de grootte beïnvloedt.
export function invalidateDirSize(dir) {
  if (!dir) return;
  for (const key of sizeCache.keys()) {
    if (dir === key || dir.startsWith(key + path.sep) || key.startsWith(dir + path.sep)) {
      sizeCache.delete(key);
    }
  }
  sizeCache.delete(dir);
}

// Periodiek opruimen van verlopen cache-entries.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sizeCache) if (now - v.at >= SIZE_TTL_MS) sizeCache.delete(k);
}, 60000).unref();
