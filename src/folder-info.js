import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';

// Per-map informatie: een beschrijving/README, een kleur en een icoon dat in de
// UI wordt getoond. Sleutel: "<home>|<mappad>".

function readAll() {
  return readJson(config.folderInfoFile, () => ({}));
}
function writeAll(obj) { writeJson(config.folderInfoFile, obj, { mode: 0o600 }); }
const key = (home, p) => `${home}|${p || '/'}`;

export function getInfo(home, p) {
  return readAll()[key(home, p)] || {};
}
export function setInfo(home, p, patch) {
  const all = readAll();
  const k = key(home, p);
  const cur = all[k] || {};
  if (patch.description !== undefined) cur.description = String(patch.description).slice(0, 4000);
  if (patch.color !== undefined) cur.color = String(patch.color).replace(/[^#a-zA-Z0-9]/g, '').slice(0, 12);
  if (patch.icon !== undefined) cur.icon = String(patch.icon).slice(0, 8); // één emoji
  if (!cur.description && !cur.color && !cur.icon) delete all[k];
  else all[k] = cur;
  writeAll(all);
  return cur;
}
export function movePath(home, from, to) {
  const all = readAll();
  const k = key(home, from);
  if (all[k]) { all[key(home, to)] = all[k]; delete all[k]; writeAll(all); }
}
