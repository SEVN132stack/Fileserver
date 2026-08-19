import fs from 'node:fs';
import sharp from 'sharp';

// Server-side beeldbewerking via sharp: roteren, spiegelen, bijsnijden en
// schalen. Bedoeld voor de in-browser beeldbewerker; het resultaat wordt als
// nieuw bestand opgeslagen (het origineel blijft behouden).

const IMG = /\.(jpe?g|png|webp|gif|tiff?|avif)$/i;
export const canEdit = (name) => IMG.test(name);

// ops: { rotate?:0|90|180|270, flip?:bool, flop?:bool, crop?:{left,top,width,height}, resize?:{width?,height?} }
export async function transform(srcPath, ops = {}) {
  if (!fs.existsSync(srcPath)) throw new Error('Bestand niet gevonden');
  let img = sharp(srcPath, { failOn: 'none' });
  const meta = await img.metadata();

  if (ops.crop) {
    const c = ops.crop;
    const left = Math.max(0, Math.round(c.left || 0));
    const top = Math.max(0, Math.round(c.top || 0));
    const width = Math.min((meta.width || 0) - left, Math.round(c.width || 0));
    const height = Math.min((meta.height || 0) - top, Math.round(c.height || 0));
    if (width > 0 && height > 0) img = img.extract({ left, top, width, height });
  }
  if (ops.rotate) img = img.rotate(((Number(ops.rotate) % 360) + 360) % 360);
  if (ops.flip) img = img.flip();
  if (ops.flop) img = img.flop();
  if (ops.resize && (ops.resize.width || ops.resize.height)) {
    img = img.resize({
      width: ops.resize.width ? Math.max(1, Math.round(ops.resize.width)) : null,
      height: ops.resize.height ? Math.max(1, Math.round(ops.resize.height)) : null,
      fit: 'inside', withoutEnlargement: false,
    });
  }
  return img.toBuffer();
}
