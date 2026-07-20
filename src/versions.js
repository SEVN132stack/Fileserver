import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Versiegeschiedenis per bestand. Vóór het overschrijven van een bestaand
// bestand wordt de vorige inhoud bewaard onder .versions/<pad>/<timestamp>.
// De laatste N versies blijven bewaard (config.keepVersions).

function versionsRoot(home) {
  return path.join(home, config.versionsName);
}

// Relatief pad binnen home -> map met versies van dat bestand. Het pad wordt
// genormaliseerd en binnen de versies-root gehouden (geen path-traversal).
function versionDir(home, relPath) {
  const norm = path.posix.normalize('/' + String(relPath).replace(/\\/g, '/')).replace(/^\/+/, '');
  const root = versionsRoot(home);
  const abs = path.join(root, norm);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Ongeldig pad');
  return abs;
}

// Maak een momentopname van een bestand (indien het bestaat) vóór overschrijven.
export function snapshot(home, absFile) {
  if (config.keepVersions <= 0) return;
  if (!fs.existsSync(absFile) || fs.statSync(absFile).isDirectory()) return;
  const rel = '/' + path.relative(home, absFile).split(path.sep).join('/');
  if (rel.startsWith('/' + config.versionsName)) return; // geen versies van versies
  const vdir = versionDir(home, rel);
  fs.mkdirSync(vdir, { recursive: true });
  const stamp = Date.now() + '';
  fs.copyFileSync(absFile, path.join(vdir, stamp));
  prune(vdir);
}

function prune(vdir) {
  const files = fs.readdirSync(vdir).sort();
  const excess = files.length - config.keepVersions;
  for (let i = 0; i < excess; i++) {
    try { fs.unlinkSync(path.join(vdir, files[i])); } catch { /* negeren */ }
  }
}

export function listVersions(home, relPath) {
  const vdir = versionDir(home, relPath);
  if (!fs.existsSync(vdir)) return [];
  return fs.readdirSync(vdir).sort().reverse().map((v) => ({
    version: v,
    date: new Date(parseInt(v, 10)).toISOString(),
    size: fs.statSync(path.join(vdir, v)).size,
  }));
}

export function versionPath(home, relPath, version) {
  const p = path.join(versionDir(home, relPath), path.basename(version));
  if (!fs.existsSync(p)) throw new Error('Versie niet gevonden');
  return p;
}
