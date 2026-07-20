import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Serverzijde-opslag voor E2E-sleutelbeheer. De server bewaart alleen:
//  - de publieke sleutel per gebruiker (om map-sleutels naartoe te versleutelen);
//  - per gebruiker een keyring: per map een met de publieke sleutel *gewrapte*
//    AES-sleutel. De server ziet nooit de klaartekst-sleutel of het wachtwoord.
const file = () => path.join(config.rootDir, 'keyring.json');

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

// Bewaar een (gewrapte) map-sleutel in de keyring van een gebruiker.
export function putKey(user, folder, wrappedKey, from) {
  const d = read();
  d.rings[user] = d.rings[user] || {};
  d.rings[user][folder] = { wrappedKey, from: from || user, ts: Date.now() };
  write(d);
}
export function getRing(user) {
  return read().rings[user] || {};
}
export function removeKey(user, folder) {
  const d = read();
  if (d.rings[user]) { delete d.rings[user][folder]; write(d); }
}
