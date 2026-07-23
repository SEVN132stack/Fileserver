import fs from 'node:fs';
import { config } from './config.js';

// WORM/retentie-vergrendeling: een bestand kan tot een bepaalde datum niet
// worden gewijzigd of verwijderd — óók niet door een admin of de eigenaar. Voor
// wettelijke bewaarplicht/compliance. Sleutel: "<home>|<pad>" -> until (ms).

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.retentionFile, 'utf8')); }
  catch { return {}; }
}
function writeAll(obj) { fs.writeFileSync(config.retentionFile, JSON.stringify(obj), { mode: 0o600 }); }
const key = (home, p) => `${home}|${p}`;

// Stel (of verleng) een retentie in. Verkorten mag niet (WORM): een bestaande,
// verdere datum blijft staan.
export function setRetention(home, p, untilMs) {
  const all = readAll();
  const k = key(home, p);
  const cur = all[k] || 0;
  all[k] = Math.max(cur, untilMs);
  writeAll(all);
  return all[k];
}

// Is dit pad nu onder retentie (en dus onwijzigbaar)? Geeft de einddatum of 0.
export function retainedUntil(home, p) {
  const until = readAll()[key(home, p)] || 0;
  return until > Date.now() ? until : 0;
}

// Retentie opheffen. Bewust voorbehouden aan een admin (via een apart endpoint
// met step-up), zwaar geaudit en gealarmeerd — voor het corrigeren van échte
// vergissingen, niet voor routinematig gebruik. Zonder deze uitweg zou een per
// ongeluk ingestelde bewaarplicht een bestand permanent onaanraakbaar maken.
export function releaseRetention(home, p) {
  const all = readAll();
  const k = key(home, p);
  if (!all[k]) return false;
  delete all[k];
  writeAll(all);
  return true;
}

export function listRetention(home) {
  const all = readAll();
  const prefix = home + '|';
  return Object.entries(all)
    .filter(([k, until]) => k.startsWith(prefix) && until > Date.now())
    .map(([k, until]) => ({ path: k.slice(prefix.length), until }));
}
