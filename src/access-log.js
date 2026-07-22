import fs from 'node:fs';
import { config } from './config.js';

// Toegangslog voor gedeelde bestanden: registreer per download wie (IP + optioneel
// naam), wanneer en welk bestand/link. De eigenaar ziet dit terug in de UI, zodat
// je weet of en wanneer je gedeelde bestand is opgehaald.

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.shareAccessFile, 'utf8')); }
  catch { return []; }
}
function writeAll(list) {
  // Houd het log begrensd (laatste 5000 regels).
  const trimmed = list.slice(-5000);
  fs.writeFileSync(config.shareAccessFile, JSON.stringify(trimmed), { mode: 0o600 });
}

// owner: eigenaar van de link; kind: 'share' | 'permalink'; ref: token/uuid.
export function recordAccess({ owner, kind, ref, path, ip, name }) {
  const list = readAll();
  list.push({ ts: Date.now(), owner, kind, ref, path, ip: ip || '', name: name || '' });
  writeAll(list);
}

// Alle toegangen tot bestanden van één eigenaar (nieuwste eerst).
export function accessForOwner(owner, path) {
  return readAll()
    .filter((r) => r.owner === owner && (path === undefined || r.path === path))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 500);
}
