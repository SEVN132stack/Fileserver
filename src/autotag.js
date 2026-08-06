import fs from 'node:fs';
import path from 'node:path';

// Automatische categorisatie: leid tags af uit het bestandstype en (voor
// tekstbestanden) uit sleutelwoorden in de inhoud. Zo worden uploads vanzelf
// geordend zonder handmatig labelen.

const TYPE_TAGS = [
  { re: /\.(jpe?g|png|gif|webp|tiff?|bmp|heic|heif|avif)$/i, tag: 'afbeelding' },
  { re: /\.(mp4|webm|mov|mkv|avi|m4v)$/i, tag: 'video' },
  { re: /\.(mp3|wav|flac|ogg|m4a|aac)$/i, tag: 'audio' },
  { re: /\.(pdf|docx?|odt|rtf|txt|md)$/i, tag: 'document' },
  { re: /\.(xlsx?|ods|csv|tsv)$/i, tag: 'spreadsheet' },
  { re: /\.(pptx?|odp|key)$/i, tag: 'presentatie' },
  { re: /\.(zip|tar|gz|7z|rar|bz2|xz)$/i, tag: 'archief' },
  { re: /\.(js|ts|py|java|c|cpp|cs|go|rs|rb|php|sh|html?|css|json|ya?ml|sql)$/i, tag: 'code' },
  { re: /\.(stl|obj|step|stp|iges|igs|3mf|dwg|dxf)$/i, tag: '3d-cad' },
  { re: /\.(epub|mobi|azw3?)$/i, tag: 'e-book' },
];

// Sleutelwoorden -> categorie voor tekstuele inhoud.
const CONTENT_TAGS = [
  { tag: 'factuur', words: ['factuur', 'invoice', 'btw', 'te betalen', 'factuurnummer', 'iban'] },
  { tag: 'contract', words: ['overeenkomst', 'contract', 'ondergetekende', 'algemene voorwaarden', 'partijen'] },
  { tag: 'cv', words: ['curriculum vitae', 'werkervaring', 'opleiding', 'vaardigheden'] },
  { tag: 'financieel', words: ['balans', 'winst', 'verlies', 'jaarrekening', 'omzet'] },
  { tag: 'medisch', words: ['diagnose', 'patiënt', 'behandeling', 'huisarts', 'recept'] },
];

const TEXT_EXT = /\.(txt|md|csv|log|json|xml|html?|ya?ml|ini|conf|rtf)$/i;

// Bepaal de tags voor een bestand op basis van naam + (optioneel) inhoud.
export function classify(name, text = '') {
  const tags = new Set();
  for (const t of TYPE_TAGS) if (t.re.test(name)) tags.add(t.tag);
  if (text) {
    const low = text.toLowerCase();
    for (const c of CONTENT_TAGS) if (c.words.some((w) => low.includes(w))) tags.add(c.tag);
  }
  return [...tags];
}

// Lees (indien tekstbestand en niet te groot) wat inhoud voor de classificatie.
export function classifyFile(name, absPath) {
  let text = '';
  if (TEXT_EXT.test(name)) {
    try { if (fs.statSync(absPath).size <= 1048576) text = fs.readFileSync(absPath, 'utf8'); } catch { /* skip */ }
  }
  return classify(path.basename(name), text);
}
