import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Serverzijde-opslag voor E2E-sleutelbeheer. De server bewaart alleen:
//  - de publieke sleutel per gebruiker (om map-sleutels naartoe te versleutelen);
//  - per gebruiker een keyring: per map een met de publieke sleutel *gewrapte*
//    AES-sleutel. De server ziet nooit de klaartekst-sleutel of het wachtwoord.
const file = () => config.keyringFile;

function read() {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return { pubkeys: {}, rings: {} }; }
}
function write(data) {
  fs.writeFileSync(file(), JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function setPubkey(user, jwk) {
  const d = read();
  d.pubkeys[user] = jwk;
  write(d);
}
export function getPubkey(user) {
  return read().pubkeys[user] || null;
}

// Bewaar een (gewrapte) map-sleutel in de keyring van een gebruiker. Bij een
// bestaande sleutel wordt het versienummer opgehoogd (rotatie).
export function putKey(user, folder, wrappedKey, from) {
  const d = read();
  d.rings[user] = d.rings[user] || {};
  const prev = d.rings[user][folder];
  d.rings[user][folder] = {
    wrappedKey,
    from: from || user,
    ts: Date.now(),
    version: prev ? (prev.version || 1) + 1 : 1,
  };
  write(d);
}
export function getRing(user) {
  return read().rings[user] || {};
}
export function removeKey(user, folder) {
  const d = read();
  if (d.rings[user]) { delete d.rings[user][folder]; write(d); }
}

// Mappen waarvan de sleutel ouder is dan het rotatiebeleid (dagen).
export function dueForRotation(user, afterDays) {
  if (!afterDays || afterDays <= 0) return [];
  const ring = getRing(user);
  const cutoff = Date.now() - afterDays * 86400000;
  return Object.entries(ring).filter(([, v]) => (v.ts || 0) < cutoff).map(([folder, v]) => ({ folder, version: v.version || 1, ts: v.ts }));
}
