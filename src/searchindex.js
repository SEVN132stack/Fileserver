import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { canPreviewOffice, officePreview } from './office.js';

// Lichte omgekeerde index (inverted index) voor snelle bestandsnaam- en
// inhoudzoekacties over grote opslag. In plaats van bij elke zoekopdracht de
// hele mappenboom te doorlopen en tekstbestanden te lezen, bouwen we periodiek
// (of op verzoek) een index: token -> bestandspaden. Zoeken is dan een
// doorsnede van korte lijsten.

const TEXT_EXT = /\.(txt|md|csv|log|json|xml|html?|css|js|ts|py|sh|yml|yaml|ini|conf)$/i;
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

let index = null; // { built, tokens: Map<token, Set<relPath>>, names: Map<relPath, name> }

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9_]{2,}/g) || []);
}

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === config.trashName || e.name === config.versionsName || e.name === '.metadata.json') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

// (Her)bouw de index over de volledige opslag.
export function buildIndex() {
  const files = [];
  walk(config.storageDir, files);
  const tokens = new Map();
  const names = new Map();
  const add = (tok, rel) => {
    let set = tokens.get(tok);
    if (!set) { set = new Set(); tokens.set(tok, set); }
    set.add(rel);
  };
  for (const full of files) {
    const rel = path.relative(config.storageDir, full).split(path.sep).join('/');
    const base = path.basename(full);
    names.set(rel, base);
    for (const t of tokenize(base)) add(t, rel);
    if (TEXT_EXT.test(base)) {
      try {
        if (fs.statSync(full).size <= MAX_CONTENT_BYTES) {
          for (const t of new Set(tokenize(fs.readFileSync(full, 'utf8')))) add(t, rel);
        }
      } catch { /* overslaan */ }
    } else if (config.indexOfficeContent && canPreviewOffice(base)) {
      // Volledige-tekst-zoeken in kantoordocumenten (docx/xlsx/pptx): extraheer
      // de platte tekst en indexeer die net als gewone tekstbestanden.
      try {
        if (fs.statSync(full).size <= MAX_CONTENT_BYTES) {
          const { text } = officePreview(full);
          if (text) for (const t of new Set(tokenize(text))) add(t, rel);
        }
      } catch { /* niet-parseerbaar office-bestand overslaan */ }
    }
  }
  index = { built: Date.now(), tokens, names };
  persist();
  return { files: files.length, tokens: tokens.size };
}

function persist() {
  try {
    const obj = { built: index.built, tokens: {}, names: {} };
    for (const [t, set] of index.tokens) obj.tokens[t] = [...set];
    for (const [rel, name] of index.names) obj.names[rel] = name;
    fs.writeFileSync(config.searchIndexFile, JSON.stringify(obj), { mode: 0o600 });
  } catch (err) { console.error('[searchindex] opslaan mislukt:', err.message); }
}

function loadFromDisk() {
  try {
    const obj = JSON.parse(fs.readFileSync(config.searchIndexFile, 'utf8'));
    const tokens = new Map();
    for (const [t, arr] of Object.entries(obj.tokens || {})) tokens.set(t, new Set(arr));
    const names = new Map(Object.entries(obj.names || {}));
    index = { built: obj.built || 0, tokens, names };
    return true;
  } catch { return false; }
}

export function isReady() {
  if (index) return true;
  return loadFromDisk();
}

// Zoek binnen de home van één gebruiker. Geeft home-relatieve paden terug, of
// null als er (nog) geen index is (dan valt de aanroeper terug op live zoeken).
export function query(homeName, q) {
  if (!isReady()) return null;
  const terms = tokenize(q);
  const prefix = homeName + '/';
  let candidates = null;
  if (terms.length) {
    for (const term of terms) {
      // Prefix-match op tokens (zodat "doc" ook "document" vindt).
      const hits = new Set();
      for (const [tok, set] of index.tokens) {
        if (tok.startsWith(term)) for (const rel of set) hits.add(rel);
      }
      candidates = candidates === null ? hits : new Set([...candidates].filter((r) => hits.has(r)));
      if (!candidates.size) break;
    }
  } else {
    candidates = new Set(index.names.keys());
  }
  const out = [];
  for (const rel of candidates || []) {
    if (!rel.startsWith(prefix)) continue;
    out.push('/' + rel.slice(prefix.length));
  }
  return out;
}

export function startSearchIndexScheduler() {
  loadFromDisk();
  if (!config.searchIndexIntervalMinutes || config.searchIndexIntervalMinutes <= 0) return;
  if (!index) { try { buildIndex(); } catch { /* later opnieuw */ } }
  setInterval(() => {
    try { buildIndex(); } catch (err) { console.error('[searchindex]', err.message); }
  }, config.searchIndexIntervalMinutes * 60000).unref();
}
