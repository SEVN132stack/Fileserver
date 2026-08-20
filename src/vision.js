import fs from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';
import { config } from './config.js';

// Beeldherkenning: laat een extern commando (VISION_CMD) labels/gezichten/objecten
// uit een afbeelding halen. De labels worden per bestand opgeslagen
// ("<home>|<pad>" -> [labels]) zodat je erop kunt zoeken. Het commando krijgt het
// bestandspad als laatste argument en schrijft JSON naar stdout: een array van
// strings, of een object met een `labels`-array.

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i;
export function hasVision() { return !!config.visionCmd; }
export function canDetect(name) { return hasVision() && IMG_EXT.test(name); }

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.visionFile, 'utf8')); }
  catch { return {}; }
}
function writeAll(obj) { fs.writeFileSync(config.visionFile, JSON.stringify(obj), { mode: 0o600 }); }
const key = (home, p) => `${home}|${p}`;

// Normaliseer de uitvoer van het commando naar een array van labelstrings.
export function parseLabels(stdout) {
  let data;
  try { data = JSON.parse(stdout); } catch { return []; }
  const arr = Array.isArray(data) ? data : Array.isArray(data?.labels) ? data.labels : [];
  const out = [];
  for (const item of arr) {
    const label = typeof item === 'string' ? item : (item && item.label);
    if (label) out.push(String(label).trim().toLowerCase().slice(0, 64));
  }
  return [...new Set(out)].slice(0, 100);
}

export function setLabels(home, p, labels) {
  const all = readAll();
  if (labels && labels.length) all[key(home, p)] = labels;
  else delete all[key(home, p)];
  writeAll(all);
}
export function getLabels(home, p) { return readAll()[key(home, p)] || []; }

export function movePath(home, from, to) {
  const all = readAll();
  const k = key(home, from);
  if (all[k]) { all[key(home, to)] = all[k]; delete all[k]; writeAll(all); }
}
export function removePath(home, p) {
  const all = readAll();
  if (all[key(home, p)]) { delete all[key(home, p)]; writeAll(all); }
}

// Bevat een van de labels de zoekterm? (voor de zoekintegratie)
export function labelMatches(home, p, query) {
  const labels = readAll()[key(home, p)];
  return !!labels && labels.some((l) => l.includes(query));
}

// Zoek alle bestanden van een gebruiker met een bepaald label.
export function findByLabel(home, label) {
  const q = String(label).toLowerCase();
  const all = readAll();
  const prefix = `${home}|`;
  const out = [];
  for (const [k, labels] of Object.entries(all)) {
    if (k.startsWith(prefix) && labels.some((l) => l.includes(q))) out.push(k.slice(prefix.length));
  }
  return out;
}

// Draai het herkennings-commando op een bestand en bewaar de labels
// (fire-and-forget vanuit de upload).
export function runVision(home, relPath, absPath) {
  if (!config.visionCmd) return;
  try { if (fs.statSync(absPath).size > config.visionMaxBytes) return; } catch { return; }
  const [cmd, ...args] = config.visionCmd.split(' ');
  execFile(cmd, [...args, absPath], { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
    if (err) return; // herkenning mislukt: stil overslaan
    const labels = parseLabels(stdout || '');
    if (labels.length) setLabels(home, relPath, labels);
  });
}

// Synchrone variant voor een expliciete "analyseer nu"-actie vanuit de UI.
export function detectSync(home, relPath, absPath) {
  if (!config.visionCmd) throw new Error('vision disabled');
  const [cmd, ...args] = config.visionCmd.split(' ');
  const stdout = execFileSync(cmd, [...args, absPath], { timeout: 120000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' });
  const labels = parseLabels(stdout || '');
  setLabels(home, relPath, labels);
  return labels;
}
