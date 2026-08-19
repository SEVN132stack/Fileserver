import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { notifyUser } from './notifications.js';
import { recordForDigest } from './digest.js';

// Map-abonnementen: een gebruiker volgt een map (prefix) binnen zijn eigen home
// en krijgt een melding (in-app + digest) bij wijzigingen daarin. Bedoeld om op
// de hoogte te blijven van bijv. drop-link-aanleveringen of gedeelde uploads.

function readAll() { return readJson(config.subscriptionsFile, () => ({})); }
function writeAll(obj) { writeJson(config.subscriptionsFile, obj, { mode: 0o600 }); }

export function listSubscriptions(user) { return readAll()[user] || []; }

export function subscribe(user, prefix = '/') {
  const all = readAll();
  const list = all[user] || [];
  const pref = String(prefix || '/').slice(0, 300) || '/';
  if (!list.some((s) => s.prefix === pref)) {
    list.push({ id: randomBytes(5).toString('hex'), prefix: pref });
    all[user] = list;
    writeAll(all);
  }
  return list;
}

export function unsubscribe(user, id) {
  const all = readAll();
  const list = all[user] || [];
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  all[user] = next;
  writeAll(all);
  return true;
}

// Meld abonnees van `owner` op een wijziging in `relPath`. `actor` (wie de
// wijziging deed) wordt overgeslagen om zelf-ruis te voorkomen.
export function notifySubscribers(owner, actor, relPath, action) {
  const p = relPath.startsWith('/') ? relPath : '/' + relPath;
  for (const sub of listSubscriptions(owner)) {
    const pref = sub.prefix.startsWith('/') ? sub.prefix : '/' + sub.prefix;
    if (pref !== '/' && !p.startsWith(pref)) continue;
    if (owner === actor) continue; // eigen wijziging: niet melden
    const msg = `${actor || 'iemand'} heeft ${action} uitgevoerd in ${sub.prefix} (${p}).`;
    try { notifyUser(owner, 'Wijziging in gevolgde map', msg); } catch { /* niet-fataal */ }
    try { recordForDigest(owner, msg); } catch { /* niet-fataal */ }
  }
}
