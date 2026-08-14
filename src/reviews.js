import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { audit } from './audit.js';

// Goedkeuringsworkflow: een bestand kan in review worden gezet ("pending"),
// waarna een goedkeurder het goedkeurt of afkeurt. Status per bestand, gekeyed
// op "<home>|<pad>".

const key = (home, p) => `${home}|${p}`;
function readAll() { return readJson(config.reviewsFile, () => ({})); }
function writeAll(obj) { writeJson(config.reviewsFile, obj, { mode: 0o600 }); }

export function getReview(home, p) {
  return readAll()[key(home, p)] || null;
}

export function requestReview(home, p, user, note = '') {
  const all = readAll();
  all[key(home, p)] = {
    status: 'pending', requestedBy: user, note: String(note).slice(0, 500),
    requestedAt: Date.now(), decidedBy: null, decidedAt: 0, decisionNote: '',
  };
  writeAll(all);
  audit('web', user, 'review_request', { path: p });
  return all[key(home, p)];
}

export function decideReview(home, p, approver, approve, note = '') {
  const all = readAll();
  const r = all[key(home, p)];
  if (!r || r.status !== 'pending') return null;
  r.status = approve ? 'approved' : 'rejected';
  r.decidedBy = approver;
  r.decidedAt = Date.now();
  r.decisionNote = String(note).slice(0, 500);
  writeAll(all);
  audit('web', approver, approve ? 'review_approve' : 'review_reject', { path: p });
  return r;
}

// Alle reviews in een home (voor een overzicht/badges).
export function listReviews(home) {
  const all = readAll();
  const prefix = home + '|';
  const out = [];
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(prefix)) out.push({ path: k.slice(prefix.length), ...v });
  }
  return out;
}

// Verplaats/verwijder de reviewstatus wanneer een bestand verplaatst/verwijderd wordt.
export function movePath(home, from, to) {
  const all = readAll();
  const k = key(home, from);
  if (all[k]) { all[key(home, to)] = all[k]; delete all[k]; writeAll(all); }
}
export function removePath(home, p) {
  const all = readAll();
  if (all[key(home, p)]) { delete all[key(home, p)]; writeAll(all); }
}
