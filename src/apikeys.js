import fs from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { config } from './config.js';

// Per-gebruiker API-sleutels voor scripts/integraties. De sleutel wordt maar één
// keer getoond; opgeslagen wordt alleen de SHA-256-hash. Scope 'read' geeft
// alleen-lezen toegang; 'write' volledige (binnen de rechten van de gebruiker).

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.apiKeysFile, 'utf8')); }
  catch { return {}; } // id -> { user, name, scope, hash, created, lastUsed }
}
function writeAll(obj) { fs.writeFileSync(config.apiKeysFile, JSON.stringify(obj), { mode: 0o600 }); }
const sha = (s) => createHash('sha256').update(s).digest('hex');

// Maak een sleutel aan; geeft de leesbare sleutel terug (eenmalig).
export function createKey(user, name, scope = 'read') {
  const all = readAll();
  const id = randomBytes(6).toString('hex');
  const secret = randomBytes(24).toString('base64url');
  const token = `fsk_${id}_${secret}`;
  all[id] = { user, name: name || 'api-key', scope: scope === 'write' ? 'write' : 'read', hash: sha(token), created: Date.now(), lastUsed: 0 };
  writeAll(all);
  return { id, token };
}

// Zoek de gebruiker + scope bij een aangeboden sleutel (of null).
export function resolveKey(token) {
  if (!token || !token.startsWith('fsk_')) return null;
  const id = token.split('_')[1];
  const all = readAll();
  const rec = all[id];
  if (!rec) return null;
  if (rec.hash !== sha(token)) return null;
  rec.lastUsed = Date.now();
  writeAll(all);
  return { user: rec.user, scope: rec.scope };
}

export function listKeys(user) {
  return Object.entries(readAll())
    .filter(([, r]) => r.user === user)
    .map(([id, r]) => ({ id, name: r.name, scope: r.scope, created: r.created, lastUsed: r.lastUsed }));
}

export function revokeKey(user, id) {
  const all = readAll();
  if (all[id] && all[id].user === user) { delete all[id]; writeAll(all); return true; }
  return false;
}
