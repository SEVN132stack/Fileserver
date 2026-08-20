import fs from 'node:fs';
import path from 'node:path';
import { resolveWithin } from './paths.js';

// Automatische mapstructuur-suggesties (volledig lokaal, geen AI nodig).
// Analyseert de losse bestanden in een map en stelt een nette indeling voor:
// - "type": groepeer per soort (Afbeeldingen, Documenten, Video, ...)
// - "ext":  groepeer per extensie (PDF, DOCX, ...)
// - "date": groepeer per jaar (op basis van wijzigingsdatum)
// De suggestie is een lijst voorgestelde verplaatsingen; toepassen gebeurt in een
// aparte stap zodat de gebruiker het eerst kan bekijken.

const CATEGORIES = [
  ['Afbeeldingen', /\.(jpe?g|png|gif|webp|bmp|tiff?|svg|heic)$/i],
  ['Video', /\.(mp4|mkv|mov|avi|webm|m4v|wmv|flv)$/i],
  ['Audio', /\.(mp3|wav|flac|aac|ogg|m4a|opus)$/i],
  ['Documenten', /\.(pdf|docx?|odt|rtf|txt|md|pptx?|xlsx?|csv|ods|odp)$/i],
  ['Archieven', /\.(zip|tar|gz|bz2|7z|rar|xz)$/i],
  ['Code', /\.(js|ts|py|java|c|cpp|h|go|rs|rb|php|sh|html?|css|json|ya?ml)$/i],
];

function categoryOf(name) {
  for (const [cat, re] of CATEGORIES) if (re.test(name)) return cat;
  return 'Overig';
}

function folderFor(mode, name, mtime) {
  if (mode === 'ext') {
    const ext = path.extname(name).replace('.', '').toUpperCase();
    return ext || 'Zonder-extensie';
  }
  if (mode === 'date') return String(new Date(mtime).getFullYear());
  return categoryOf(name); // 'type'
}

// Bekijk de losse bestanden in `relDir` en stel een indeling voor volgens `mode`.
export function suggest(home, relDir, mode = 'type') {
  const dir = resolveWithin(home, relDir || '/');
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return { error: 'map niet gevonden' }; }

  const groups = {}; // folder -> [namen]
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name.startsWith('.')) continue;
    let mtime = Date.now();
    try { mtime = fs.statSync(path.join(dir, e.name)).mtimeMs; } catch { /* val terug op nu */ }
    const folder = folderFor(mode, e.name, mtime);
    (groups[folder] ||= []).push(e.name);
  }

  // Alleen groepen met >1 bestand zijn de moeite waard om een submap voor te maken.
  const base = (relDir || '/').replace(/\/+$/, '');
  const moves = [];
  for (const [folder, names] of Object.entries(groups)) {
    if (names.length < 2) continue;
    for (const name of names) {
      moves.push({ from: `${base}/${name}`.replace(/\/+/g, '/'), to: `${base}/${folder}/${name}`.replace(/\/+/g, '/'), folder });
    }
  }
  const summary = Object.entries(groups)
    .filter(([, n]) => n.length >= 2)
    .map(([folder, n]) => ({ folder, count: n.length }))
    .sort((a, b) => b.count - a.count);
  return { mode, base: base || '/', folders: summary, moves };
}

// Pas een lijst voorgestelde verplaatsingen toe (van/naar zijn paden binnen home).
// Retourneert hoeveel bestanden zijn verplaatst en welke overgeslagen.
export function apply(home, moves) {
  let moved = 0; const skipped = [];
  for (const mv of Array.isArray(moves) ? moves : []) {
    let src, dest;
    try {
      src = resolveWithin(home, mv.from);
      dest = resolveWithin(home, mv.to);
    } catch { skipped.push(mv.from); continue; }
    try {
      if (!fs.existsSync(src) || fs.existsSync(dest)) { skipped.push(mv.from); continue; }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(src, dest);
      moved++;
    } catch { skipped.push(mv.from); }
  }
  return { moved, skipped };
}
