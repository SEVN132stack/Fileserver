import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';

// Tags/labels per bestand, per gebruiker. Sleutel: "<user>|<pad>". Zo kun je
// bestanden ordenen en er in bulk op filteren, los van de mapstructuur.

function readAll() {
  return readJson(config.tagsFile, () => ({}));
}
function writeAll(obj) {
  writeJson(config.tagsFile, obj, { mode: 0o600 });
}

const key = (user, p) => `${user}|${p}`;

export function getTags(user, p) {
  return readAll()[key(user, p)] || [];
}

// Zet de volledige lijst tags voor een bestand (leeg = verwijderen).
export function setTags(user, p, tags) {
  const all = readAll();
  const clean = [...new Set((tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  if (clean.length) all[key(user, p)] = clean;
  else delete all[key(user, p)];
  writeAll(all);
  return clean;
}

// Alle bestanden van een gebruiker met een bepaalde tag.
export function findByTag(user, tag) {
  const all = readAll();
  const want = String(tag).trim().toLowerCase();
  const prefix = user + '|';
  const out = [];
  for (const [k, tags] of Object.entries(all)) {
    if (k.startsWith(prefix) && tags.includes(want)) out.push(k.slice(prefix.length));
  }
  return out;
}

// Alle tags die een gebruiker in gebruik heeft (met aantallen).
export function listTags(user) {
  const all = readAll();
  const prefix = user + '|';
  const counts = {};
  for (const [k, tags] of Object.entries(all)) {
    if (!k.startsWith(prefix)) continue;
    for (const t of tags) counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

// Verplaats de tags mee als een bestand hernoemd/verplaatst wordt.
export function movePath(user, from, to) {
  const all = readAll();
  const k = key(user, from);
  if (all[k]) { all[key(user, to)] = all[k]; delete all[k]; writeAll(all); }
}

export function removePath(user, p) {
  const all = readAll();
  if (all[key(user, p)]) { delete all[key(user, p)]; writeAll(all); }
}
