import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { audit } from './audit.js';

// Data-classificatielabels per bestand: openbaar / intern / vertrouwelijk / geheim.
// Gekeyed op "<home>|<pad>". Beleid: vertrouwelijke/geheime bestanden mogen niet
// via een publieke deel-link naar buiten.

export const LABELS = ['openbaar', 'intern', 'vertrouwelijk', 'geheim'];
const RANK = { openbaar: 0, intern: 1, vertrouwelijk: 2, geheim: 3 };

const key = (home, p) => `${home}|${p}`;
function readAll() { return readJson(config.labelsFile, () => ({})); }
function writeAll(obj) { writeJson(config.labelsFile, obj, { mode: 0o600 }); }

export function getLabel(home, p) {
  return readAll()[key(home, p)] || null;
}

export function setLabel(home, p, label, user) {
  const all = readAll();
  const k = key(home, p);
  if (!label || label === 'openbaar') delete all[k];
  else {
    if (!LABELS.includes(label)) throw new Error('Onbekend label');
    all[k] = label;
  }
  writeAll(all);
  audit('web', user, 'label_set', { path: p, label: label || 'openbaar' });
  return all[k] || 'openbaar';
}

// Mag dit bestand publiek gedeeld worden? (vertrouwelijk en hoger niet)
// Het label van een map geldt ook voor alles erin: het strengste label van het
// pad zelf of een bovenliggende map is bepalend.
export function effectiveLabel(home, p) {
  const all = readAll();
  const parts = String(p || '/').split('/').filter(Boolean);
  let best = null;
  for (let i = parts.length; i >= 0; i--) {
    const cand = '/' + parts.slice(0, i).join('/');
    for (const k of [cand, cand === '/' ? '' : cand + '/']) {
      const l = all[key(home, k)];
      if (l && (!best || RANK[l] > RANK[best])) best = l;
    }
  }
  return best;
}

export function mayShare(home, p) {
  const label = effectiveLabel(home, p);
  return !label || RANK[label] < RANK.vertrouwelijk;
}

export function listLabels(home) {
  const all = readAll();
  const prefix = home + '|';
  const out = {};
  for (const [k, v] of Object.entries(all)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  return out;
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
