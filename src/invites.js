import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';

// Zelfregistratie met invite-codes: een admin maakt een code aan (optioneel met
// rol/quota/vervaldatum en max. aantal gebruik); nieuwe accounts kunnen zich
// alleen met een geldige code registreren.

function readAll() {
  return readJson(config.invitesFile, () => []);
}
function writeAll(list) { writeJson(config.invitesFile, list, { mode: 0o600 }); }

export function createInvite({ role = 'user', quota = 0, maxUses = 1, expiresInDays = 7 } = {}) {
  const list = readAll();
  const code = randomBytes(9).toString('base64url');
  const invite = {
    code, role: ['user', 'readonly'].includes(role) ? role : 'user',
    quota: Number(quota) || 0, maxUses: Math.max(1, Number(maxUses) || 1), uses: 0,
    expires: expiresInDays > 0 ? Date.now() + expiresInDays * 86400000 : 0, created: Date.now(),
  };
  list.push(invite);
  writeAll(list);
  return invite;
}

export function listInvites() { return readAll(); }

export function deleteInvite(code) {
  const list = readAll();
  const next = list.filter((i) => i.code !== code);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

// Valideer een code zonder te verbruiken.
export function checkInvite(code) {
  const inv = readAll().find((i) => i.code === code);
  if (!inv) return null;
  if (inv.expires && inv.expires < Date.now()) return null;
  if (inv.uses >= inv.maxUses) return null;
  return inv;
}

// Verbruik één gebruik van de code (na succesvolle registratie).
export function consumeInvite(code) {
  const list = readAll();
  const inv = list.find((i) => i.code === code);
  if (!inv) return false;
  inv.uses += 1;
  writeAll(list);
  return true;
}
