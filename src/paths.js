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
export function dirSize(dir) {
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
      if (e.isDirectory()) total += dirSize(full);
      else total += fs.statSync(full).size;
    } catch {
      /* overslaan */
    }
  }
  return total;
}
