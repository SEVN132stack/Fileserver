import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';

// Opgeslagen zoekopdrachten / "slimme mappen": een gebruiker bewaart een
// zoekopdracht (term, wel/niet in inhoud, startpad) onder een naam en kan die
// later met één klik opnieuw uitvoeren. Opgeslagen per gebruiker.

function readAll() { return readJson(config.savedSearchesFile, () => ({})); }
function writeAll(obj) { writeJson(config.savedSearchesFile, obj, { mode: 0o600 }); }

export function listSaved(user) {
  return readAll()[user] || [];
}

export function addSaved(user, { name, query, content = false, path = '/' }) {
  if (!name || !query) throw new Error('Naam en zoekterm zijn verplicht');
  const all = readAll();
  const list = all[user] || [];
  const item = {
    id: randomBytes(5).toString('hex'),
    name: String(name).slice(0, 60),
    query: String(query).slice(0, 200),
    content: !!content,
    path: String(path).slice(0, 300) || '/',
  };
  list.push(item);
  all[user] = list;
  writeAll(all);
  return item;
}

export function deleteSaved(user, id) {
  const all = readAll();
  const list = all[user] || [];
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  all[user] = next;
  writeAll(all);
  return true;
}
