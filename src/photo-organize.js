import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { resolveWithin } from './paths.js';

// Automatische foto-ordening: verplaats afbeeldingen uit een bronmap naar
// jaar/maand-submappen (YYYY/MM) op basis van de EXIF-opnamedatum (met de
// bestandsdatum als terugval). Identieke bestanden (zelfde SHA-256) worden als
// duplicaat overgeslagen, zodat je bibliotheek niet vol dubbele foto's komt.

const IMG = /\.(jpe?g|png|webp|tiff?|heic|gif)$/i;

// Haal de opnamedatum uit de EXIF-blob (DateTimeOriginal als ASCII), anders mtime.
async function photoDate(file) {
  try {
    const meta = await sharp(file, { failOn: 'none' }).metadata();
    if (meta.exif) {
      const m = meta.exif.toString('latin1').match(/(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/);
      if (m) return { year: m[1], month: m[2] };
    }
  } catch { /* geen/kapotte EXIF */ }
  const d = fs.statSync(file).mtime;
  return { year: String(d.getFullYear()), month: String(d.getMonth() + 1).padStart(2, '0') };
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// Organiseer alle afbeeldingen in `srcRel` naar `destRel`/YYYY/MM binnen home.
export async function organize(home, srcRel, destRel) {
  const srcDir = resolveWithin(home, srcRel || '/');
  const destBase = resolveWithin(home, destRel || srcRel || '/');
  let entries = [];
  try { entries = fs.readdirSync(srcDir, { withFileTypes: true }); } catch { return { error: 'bronmap niet gevonden' }; }

  const seen = new Set();
  let moved = 0; const duplicates = []; let skipped = 0;
  for (const e of entries) {
    if (!e.isFile() || !IMG.test(e.name)) { skipped++; continue; }
    const full = path.join(srcDir, e.name);
    let digest;
    try { digest = sha256(full); } catch { continue; }
    if (seen.has(digest)) { duplicates.push(e.name); continue; }
    seen.add(digest);
    const { year, month } = await photoDate(full);
    const targetDir = path.join(destBase, year, month);
    fs.mkdirSync(targetDir, { recursive: true });
    let dest = path.join(targetDir, e.name);
    // Naamconflict: voeg een korte hash toe.
    if (fs.existsSync(dest) && path.resolve(dest) !== path.resolve(full)) {
      const ext = path.extname(e.name);
      dest = path.join(targetDir, path.basename(e.name, ext) + '-' + digest.slice(0, 6) + ext);
    }
    if (path.resolve(dest) !== path.resolve(full)) fs.renameSync(full, dest);
    moved++;
  }
  return { moved, duplicates: duplicates.length, duplicateNames: duplicates.slice(0, 50), skipped };
}
