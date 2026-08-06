import fs from 'node:fs';
import { inflateRawSync } from 'node:zlib';

// Lichte preview van Office-bestanden (docx/xlsx/pptx). Deze zijn ZIP-archieven
// met XML erin. We lezen zonder externe bibliotheek de relevante XML-onderdelen
// (via een minimale ZIP-lezer + zlib) en halen de platte tekst eruit. Geen
// volledige rendering, maar genoeg om de inhoud snel te bekijken.

// Zoek en decomprimeer één entry uit een ZIP-buffer op naam (of naam-prefix).
export function readZipEntries(buf, match) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) return [];
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    off += 46 + nameLen + extraLen + commentLen;
    if (!match(name)) continue;
    // Lokale header lezen om de echte dataoffset te bepalen.
    if (buf.readUInt32LE(localOff) !== 0x04034b50) continue;
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    try {
      const data = method === 0 ? comp : inflateRawSync(comp);
      out.push({ name, data });
    } catch { /* overslaan */ }
  }
  return out;
}

// Strip XML-tags; behandel alineagrenzen als regeleinden.
function xmlToText(xml) {
  return xml
    .replace(/<\/w:p>|<\/a:p>|<\/text:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const isOffice = (name) => /\.(docx|xlsx|pptx)$/i.test(name);
export function canPreviewOffice(name) { return isOffice(name); }

// Geef {type, text} terug of null als het geen ondersteund Office-bestand is.
export function officePreview(filePath) {
  const lower = filePath.toLowerCase();
  const buf = fs.readFileSync(filePath);
  if (lower.endsWith('.docx')) {
    const [doc] = readZipEntries(buf, (n) => n === 'word/document.xml');
    return { type: 'docx', text: doc ? xmlToText(doc.data.toString('utf8')) : '' };
  }
  if (lower.endsWith('.pptx')) {
    const slides = readZipEntries(buf, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const text = slides.map((s, i) => `— Dia ${i + 1} —\n` + xmlToText(s.data.toString('utf8'))).join('\n\n');
    return { type: 'pptx', text };
  }
  if (lower.endsWith('.xlsx')) {
    const [shared] = readZipEntries(buf, (n) => n === 'xl/sharedStrings.xml');
    const strings = shared
      ? (shared.data.toString('utf8').match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => xmlToText(t)).filter(Boolean)
      : [];
    return { type: 'xlsx', text: strings.join('\n') };
  }
  return null;
}
