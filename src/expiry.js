import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { resolveWithin } from './paths.js';
import { audit } from './audit.js';
import { retainedUntil } from './retention.js';

// Self-destruct/verlopende bestanden: een bestand kan een vervaldatum krijgen en
// wordt daarna automatisch verwijderd. Sleutel: "<home>|<pad>" -> expiresAt (ms).

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.expiryFile, 'utf8')); }
  catch { return {}; }
}
function writeAll(obj) { fs.writeFileSync(config.expiryFile, JSON.stringify(obj), { mode: 0o600 }); }
const key = (home, p) => `${home}|${p}`;

export function setExpiry(home, p, expiresAt) {
  const all = readAll();
  if (expiresAt) all[key(home, p)] = expiresAt;
  else delete all[key(home, p)];
  writeAll(all);
}
export function getExpiry(home, p) {
  return readAll()[key(home, p)] || 0;
}
export function movePath(home, from, to) {
  const all = readAll();
  const k = key(home, from);
  if (all[k]) { all[key(home, to)] = all[k]; delete all[k]; writeAll(all); }
}
export function removePath(home, p) {
  const all = readAll();
  if (all[key(home, p)]) { delete all[key(home, p)]; writeAll(all); }
}

// Verwijder alle verlopen bestanden. `homeResolver(homeAbs)` niet nodig: de
// sleutel bevat al de absolute home + client-pad.
export function sweepExpired() {
  const all = readAll();
  const now = Date.now();
  let removed = 0;
  let changed = false;
  for (const [k, when] of Object.entries(all)) {
    if (when > now) continue;
    const sep = k.indexOf('|');
    const home = k.slice(0, sep);
    const rel = k.slice(sep + 1);
    // WORM-bewaarplicht gaat vóór self-destruct: een bestand onder retentie mag
    // niet automatisch worden verwijderd. Laat de vervaldatum staan en probeer
    // later opnieuw (zodra de bewaarplicht is verlopen).
    if (retainedUntil(home, rel)) continue;
    try {
      const abs = resolveWithin(home, rel);
      if (fs.existsSync(abs)) { fs.rmSync(abs, { recursive: true, force: true }); removed++; audit('system', null, 'file_expired', { home, path: rel }); }
    } catch { /* ongeldig pad: toch opruimen uit de lijst */ }
    delete all[k]; changed = true;
  }
  if (changed) writeAll(all);
  return { removed };
}

export function startExpiryScheduler() {
  const iv = config.expiryIntervalMinutes;
  if (!iv || iv <= 0) return;
  setInterval(() => { try { sweepExpired(); } catch (e) { console.error('[expiry]', e.message); } }, iv * 60000).unref();
}
