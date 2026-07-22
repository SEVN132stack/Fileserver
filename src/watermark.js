import sharp from 'sharp';

// Onzichtbaar-ish watermerk op een gedeelde afbeelding: een halftransparante
// tekstregel (ontvanger + tijd) rechtsonder. Zo is een gelekte afbeelding te
// herleiden naar de deel-link/ontvanger. Alleen voor rasterafbeeldingen.

const IMG = /\.(jpe?g|png|webp|gif|tiff?)$/i;
export function canWatermark(name) { return IMG.test(name); }

// Geef een Buffer met de gewatermerkte afbeelding terug (of null bij fout).
export async function watermarkImage(filePath, label) {
  try {
    const img = sharp(filePath, { failOn: 'none' });
    const meta = await img.metadata();
    const w = meta.width || 800;
    const h = meta.height || 600;
    const fontSize = Math.max(12, Math.round(w / 45));
    const text = String(label).replace(/[<&>]/g, '');
    const svg = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <text x="${w - 10}" y="${h - 10}" text-anchor="end"
          font-family="sans-serif" font-size="${fontSize}"
          fill="white" fill-opacity="0.35" stroke="black" stroke-opacity="0.2" stroke-width="0.5">${text}</text>
      </svg>`,
    );
    return await img.composite([{ input: svg, top: 0, left: 0 }]).toBuffer();
  } catch {
    return null;
  }
}
