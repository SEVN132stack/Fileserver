import fs from 'node:fs';
import { config } from './config.js';

// Bestandsvergrendeling: een gebruiker kan een bestand vergrendelen zodat een
// ander (of een tweede sessie) het niet overschrijft/verwijdert tot het weer
// wordt vrijgegeven. Sleutel: "<owner-home>|<pad>".

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.locksFile, 'utf8')); }
  catch { return {}; }
}
function writeAll(obj) { fs.writeFileSync(config.locksFile, JSON.stringify(obj), { mode: 0o600 }); }

const key = (home, p) => `${home}|${p}`;

export function lock(home, p, user) {
  const all = readAll();
  const k = key(home, p);
  const existing = all[k];
  if (existing && existing.user !== user) return { ok: false, by: existing.user };
  all[k] = { user, ts: Date.now() };
  writeAll(all);
  return { ok: true };
}

export function unlock(home, p, user, isAdmin = false) {
  const all = readAll();
  const k = key(home, p);
  const existing = all[k];
  if (!existing) return { ok: true };
  if (existing.user !== user && !isAdmin) return { ok: false, by: existing.user };
  delete all[k];
  writeAll(all);
  return { ok: true };
}

// Is dit pad vergrendeld door iemand anders dan `user`? Geeft de vergrendelaar terug of null.
export function lockedBy(home, p, user) {
  const l = readAll()[key(home, p)];
  if (l && l.user !== user) return l.user;
  return null;
}

// Wie heeft dit pad vergrendeld (ongeacht wie het opvraagt)? Een vergrendeld
// bestand is beschermd tegen wijzigen/verwijderen tot het wordt ontgrendeld —
// ook voor de vergrendelaar zelf (bewuste bescherming tegen (per ongeluk)
// overschrijven en tegen gelijktijdige bewerking).
export function lockOwner(home, p) {
  const l = readAll()[key(home, p)];
  return l ? l.user : null;
}

export function listLocks(home) {
  const all = readAll();
  const prefix = home + '|';
  return Object.entries(all)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, v]) => ({ path: k.slice(prefix.length), user: v.user, ts: v.ts }));
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
