import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';

// Toegangsaanvraag-workflow: een gebruiker vraagt toegang tot een map van een
// andere gebruiker; de eigenaar keurt goed (waarna een share ontstaat) of af.

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.accessRequestsFile, 'utf8')); }
  catch { return []; }
}
function writeAll(list) { fs.writeFileSync(config.accessRequestsFile, JSON.stringify(list), { mode: 0o600 }); }

export function createRequest(requester, owner, path, mode = 'ro', note = '') {
  const list = readAll();
  // Voorkom dubbele openstaande aanvragen voor dezelfde combinatie.
  if (list.some((r) => r.status === 'pending' && r.requester === requester && r.owner === owner && r.path === path)) {
    return null;
  }
  const req = {
    id: randomBytes(6).toString('hex'), requester, owner, path,
    mode: mode === 'rw' ? 'rw' : 'ro', note: String(note).slice(0, 500),
    status: 'pending', created: Date.now(),
  };
  list.push(req);
  writeAll(list);
  return req;
}

// Aanvragen die op mijn goedkeuring wachten (ik ben eigenaar).
export function incoming(owner) {
  return readAll().filter((r) => r.owner === owner && r.status === 'pending');
}
// Mijn eigen (uitgaande) aanvragen.
export function outgoing(requester) {
  return readAll().filter((r) => r.requester === requester);
}

export function getRequest(id) {
  return readAll().find((r) => r.id === id) || null;
}

// Zet de status; alleen de eigenaar mag beslissen. Geeft de aanvraag terug.
export function decide(id, owner, approve) {
  const list = readAll();
  const req = list.find((r) => r.id === id);
  if (!req || req.owner !== owner || req.status !== 'pending') return null;
  req.status = approve ? 'approved' : 'denied';
  req.decidedAt = Date.now();
  writeAll(list);
  return req;
}
