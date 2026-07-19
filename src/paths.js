import path from 'node:path';

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
