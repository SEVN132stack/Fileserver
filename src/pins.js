import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';

// Vastgezette mappen per gebruiker: snelkoppelingen die op het dashboard bovenaan
// verschijnen. Server-side bewaard zodat ze op elk apparaat beschikbaar zijn.

function readAll() { return readJson(config.pinsFile, () => ({})); }
function writeAll(obj) { writeJson(config.pinsFile, obj, { mode: 0o600 }); }

export function listPins(user) { return readAll()[user] || []; }

export function addPin(user, p) {
  const all = readAll();
  const list = all[user] || [];
  const pinPath = String(p || '/').slice(0, 300) || '/';
  if (!list.includes(pinPath)) { list.push(pinPath); all[user] = list.slice(0, 50); writeAll(all); }
  return all[user];
}

export function removePin(user, p) {
  const all = readAll();
  const list = all[user] || [];
  const next = list.filter((x) => x !== p);
  if (next.length === list.length) return false;
  all[user] = next; writeAll(all); return true;
}
