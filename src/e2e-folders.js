import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Mappen waar client-side end-to-end-encryptie verplicht is: uploads moeten dan
// versleuteld (.enc) worden aangeleverd. De server kan de inhoud niet lezen
// (zero-knowledge); hij dwingt alleen af dát het versleuteld is. Sleutel per
// gebruiker: "<home>|<mappad>".

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.e2eFoldersFile, 'utf8')); }
  catch { return {}; }
}
function writeAll(obj) { fs.writeFileSync(config.e2eFoldersFile, JSON.stringify(obj), { mode: 0o600 }); }
const norm = (p) => '/' + String(p).replace(/^\/+|\/+$/g, '');

export function setE2E(home, folder, on) {
  const all = readAll();
  all[home] = all[home] || [];
  const f = norm(folder);
  all[home] = all[home].filter((x) => x !== f);
  if (on) all[home].push(f);
  writeAll(all);
}

export function listE2E(home) {
  return readAll()[home] || [];
}

// Valt dit pad binnen een E2E-verplichte map?
export function isE2ERequired(home, filePath) {
  const p = norm(filePath);
  return (readAll()[home] || []).some((f) => p === f || p.startsWith(f + '/'));
}
