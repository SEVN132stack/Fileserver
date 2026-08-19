import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { resolveWithin } from './paths.js';
import { officePreview, canPreviewOffice } from './office.js';

// Slimme naamgeving-suggesties: stel een betere bestandsnaam voor op basis van
// de inhoud (eerste kop/regel van tekst/office) of de EXIF-opnamedatum (foto's).

const IMG = /\.(jpe?g|png|webp|tiff?|heic|gif)$/i;
const TEXT = /\.(txt|md|csv|log|json|xml|html?|ya?ml)$/i;

function slug(s) {
  return String(s).toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'bestand';
}

async function exifDate(file) {
  try {
    const meta = await sharp(file, { failOn: 'none' }).metadata();
    if (meta.exif) {
      const m = meta.exif.toString('latin1').match(/(\d{4}):(\d{2}):(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
  } catch { /* geen EXIF */ }
  try { return new Date(fs.statSync(file).mtime).toISOString().slice(0, 10); } catch { return null; }
}

function firstHeading(text) {
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/^#+\s*/, '').trim();
    if (line.length >= 3) return line;
  }
  return '';
}

// Geef een voorgestelde bestandsnaam (incl. extensie), of null als er geen
// zinnige suggestie is.
export async function suggestName(home, relPath) {
  const abs = resolveWithin(home, relPath);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return null;
  const ext = path.extname(relPath);
  const base = path.basename(relPath, ext);

  if (IMG.test(relPath)) {
    const date = await exifDate(abs);
    if (date) return `${date}_${slug(base)}${ext.toLowerCase()}`;
    return null;
  }

  let text = '';
  if (TEXT.test(relPath)) {
    try { if (fs.statSync(abs).size <= 1048576) text = fs.readFileSync(abs, 'utf8'); } catch { /* skip */ }
  } else if (canPreviewOffice(relPath)) {
    // Groottelimiet: office-bestanden worden volledig in het geheugen geparseerd.
    try { if (fs.statSync(abs).size <= 20 * 1024 * 1024) { const o = officePreview(abs); text = (o && o.text) || ''; } } catch { /* skip */ }
  }
  const heading = firstHeading(text);
  if (heading) {
    const s = slug(heading);
    if (s && s !== slug(base)) return `${s}${ext.toLowerCase()}`;
  }
  return null;
}
