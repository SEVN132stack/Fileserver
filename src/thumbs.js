import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from './config.js';

// Thumbnail-cache met sharp. Genereert verkleinde afbeeldingen en bewaart ze op
// schijf (gekeyd op pad + wijzigingstijd + breedte), zodat grote afbeeldingen
// niet telkens volledig verstuurd worden. Valt netjes terug als sharp of het
// bestandstype niet bruikbaar is.
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = null;
}

const THUMBABLE = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;

export function canThumbnail(name) {
  return !!sharp && THUMBABLE.test(name);
}

// Geeft het pad naar een (gecachete) thumbnail terug, of null bij een fout.
export async function getThumbnail(absFile, width = 200) {
  if (!canThumbnail(absFile)) return null;
  let stat;
  try {
    stat = fs.statSync(absFile);
  } catch {
    return null;
  }
  const key = createHash('sha1').update(absFile + stat.mtimeMs + 'w' + width).digest('hex');
  const out = path.join(config.thumbDir, key + '.webp');
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(config.thumbDir, { recursive: true });
  try {
    await sharp(absFile).resize({ width, withoutEnlargement: true }).webp({ quality: 70 }).toFile(out);
    return out;
  } catch {
    return null;
  }
}
