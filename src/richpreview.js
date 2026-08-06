import fs from 'node:fs';
import { readZipEntries } from './office.js';

// Rijke previews voor formaten zonder ingebouwde browserweergave:
//  - EPUB: haal de omslag (cover) eruit als afbeelding.
//  - STL (3D): lees het aantal driehoeken en de afmetingen (bounding box) uit.
// EPUB is een ZIP; STL is een simpel binair/ASCII 3D-formaat. Beide zonder
// externe bibliotheken.

const IMG = /\.(jpe?g|png|gif|webp)$/i;

// EPUB-omslag: zoek in de ZIP een afbeelding met 'cover' in de naam, anders de
// eerste afbeelding. Geeft { buffer, name } of null.
export function epubCover(file) {
  const buf = fs.readFileSync(file);
  const images = readZipEntries(buf, (n) => IMG.test(n));
  if (!images.length) return null;
  const cover = images.find((e) => /cover/i.test(e.name)) || images[0];
  return { buffer: cover.data, name: cover.name.split('/').pop() };
}

// STL-informatie: aantal driehoeken en bounding box (afmetingen). Ondersteunt
// zowel binaire als ASCII STL.
export function stlInfo(file) {
  const buf = fs.readFileSync(file);
  const isAscii = buf.subarray(0, 5).toString('latin1').toLowerCase() === 'solid'
    && buf.subarray(0, Math.min(buf.length, 512)).toString('latin1').includes('facet');
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const acc = (x, y, z) => {
    if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
  };
  let triangles = 0;
  if (isAscii) {
    const text = buf.toString('latin1');
    const verts = text.match(/vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g) || [];
    for (const v of verts) {
      const m = v.match(/vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/);
      acc(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
    triangles = (text.match(/facet\s+normal/g) || []).length;
  } else {
    // Binair: 80-byte header, uint32 aantal driehoeken, dan 50 bytes per driehoek.
    if (buf.length < 84) return null;
    triangles = buf.readUInt32LE(80);
    for (let i = 0; i < triangles; i++) {
      const base = 84 + i * 50 + 12; // sla normaal-vector (12 bytes) over
      if (base + 36 > buf.length) break;
      for (let v = 0; v < 3; v++) {
        const o = base + v * 12;
        acc(buf.readFloatLE(o), buf.readFloatLE(o + 4), buf.readFloatLE(o + 8));
      }
    }
  }
  const dims = min[0] === Infinity ? null : {
    x: +(max[0] - min[0]).toFixed(3), y: +(max[1] - min[1]).toFixed(3), z: +(max[2] - min[2]).toFixed(3),
  };
  return { format: isAscii ? 'ascii' : 'binary', triangles, dimensions: dims };
}
