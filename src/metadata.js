import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Per-gebruiker metadata voor bestanden: tags, commentaar en favorieten.
// Opgeslagen als één JSON-bestand in de home-map van de gebruiker.
const FILE = '.metadata.json';

function file(home) {
  return path.join(home, FILE);
}
function read(home) {
  try {
    return JSON.parse(fs.readFileSync(file(home), 'utf8'));
  } catch {
    return {};
  }
}
function write(home, data) {
  fs.writeFileSync(file(home), JSON.stringify(data, null, 2));
}

export function getMeta(home, p) {
  return read(home)[p] || { tags: [], comment: '', favorite: false };
}

export function getAllMeta(home) {
  return read(home);
}

export function setMeta(home, p, patch) {
  const data = read(home);
  const cur = data[p] || { tags: [], comment: '', favorite: false };
  if (patch.tags !== undefined) cur.tags = patch.tags;
  if (patch.comment !== undefined) cur.comment = patch.comment;
  if (patch.favorite !== undefined) cur.favorite = !!patch.favorite;
  // Verwijder lege metadata weer.
  if (!cur.tags.length && !cur.comment && !cur.favorite) delete data[p];
  else data[p] = cur;
  write(home, data);
  return cur;
}

export const METADATA_FILE = FILE;
