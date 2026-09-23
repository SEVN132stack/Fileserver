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

const CATEGORIES = {
  afbeelding: /\.(jpe?g|png|gif|webp|bmp|tiff?|svg|heic)$/i,
  video: /\.(mp4|mkv|mov|avi|webm|m4v)$/i,
  audio: /\.(mp3|wav|flac|aac|ogg|m4a|opus)$/i,
  document: /\.(pdf|docx?|odt|rtf|txt|md|pptx?|xlsx?|csv|ods|odp)$/i,
  archief: /\.(zip|tar|gz|bz2|7z|rar|xz)$/i,
};
export const COLLECTION_TYPES = Object.keys(CATEGORIES);

// Filters voor een slimme collectie (alle optioneel). Onbekende/ongeldige waarden
// worden weggelaten zodat een collectie nooit een ongeldige staat krijgt.
function cleanFilters(f = {}) {
  const out = {};
  if (f.type && CATEGORIES[f.type]) out.type = f.type;
  if (f.tag) out.tag = String(f.tag).trim().toLowerCase().slice(0, 40);
  if (f.label) out.label = String(f.label).slice(0, 20);
  const n = (v) => Math.max(0, parseInt(v, 10) || 0);
  if (n(f.minKb)) out.minKb = n(f.minKb);
  if (n(f.maxKb)) out.maxKb = n(f.maxKb);
  if (n(f.modifiedWithinDays)) out.modifiedWithinDays = n(f.modifiedWithinDays);
  if (n(f.olderThanDays)) out.olderThanDays = n(f.olderThanDays);
  return out;
}

export function addSaved(user, { name, query = '', content = false, path = '/', filters = {} }) {
  const f = cleanFilters(filters);
  if (!name || (!query && !Object.keys(f).length)) throw new Error('Naam en een zoekterm of minstens één filter zijn verplicht');
  const all = readAll();
  const list = all[user] || [];
  const item = {
    id: randomBytes(5).toString('hex'),
    name: String(name).slice(0, 60),
    query: String(query).slice(0, 200),
    content: !!content,
    path: String(path).slice(0, 300) || '/',
    filters: f,
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

// Evalueer een slimme collectie live: loop (begrensd) door de home en pas de
// zoekterm (op bestandsnaam) en filters toe. `ctx` levert tags/labels aan zodat
// deze module vrij blijft van andere afhankelijkheden.
export function evaluate(files, item, ctx = {}) {
  const f = item.filters || {};
  const q = String(item.query || '').toLowerCase();
  const base = String(item.path || '/').replace(/\/+$/, '');
  const now = Date.now();
  const out = [];
  for (const file of files) {
    if (out.length >= 500) break;
    const rel = file.rel;
    if (base && base !== '' && !rel.startsWith(base + '/')) continue;
    const name = rel.split('/').pop();
    if (q && !name.toLowerCase().includes(q)) continue;
    if (f.type && !CATEGORIES[f.type].test(name)) continue;
    if (f.minKb && file.size < f.minKb * 1024) continue;
    if (f.maxKb && file.size > f.maxKb * 1024) continue;
    if (f.modifiedWithinDays && now - file.mtime > f.modifiedWithinDays * 86400000) continue;
    if (f.olderThanDays && now - file.mtime < f.olderThanDays * 86400000) continue;
    if (f.tag && !(ctx.tagsOf ? ctx.tagsOf(rel) : []).includes(f.tag)) continue;
    if (f.label && (ctx.labelOf ? ctx.labelOf(rel) : '') !== f.label) continue;
    out.push({ path: rel, size: file.size, mtime: file.mtime });
  }
  return out;
}
