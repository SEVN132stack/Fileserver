import fs from 'node:fs';
import { createHash } from 'node:crypto';

// Blok-gebaseerde delta-sync (rsync-idee): alleen gewijzigde blokken worden
// verstuurd. De client haalt de blok-handtekeningen van de bestaande versie op,
// bepaalt welke blokken verschillen, en stuurt een delta van kopieer-verwijzingen
// en nieuwe data. Zo worden grote bestanden efficiënt bijgewerkt.

export const DEFAULT_BLOCK = 65536; // 64KB

// Bereken per-blok SHA-256 handtekeningen van een bestand.
export function signature(absFile, blockSize = DEFAULT_BLOCK) {
  const blocks = [];
  if (!fs.existsSync(absFile)) return { blockSize, blocks };
  const fd = fs.openSync(absFile, 'r');
  try {
    const buf = Buffer.alloc(blockSize);
    let read;
    while ((read = fs.readSync(fd, buf, 0, blockSize, null)) > 0) {
      blocks.push(createHash('sha256').update(buf.subarray(0, read)).digest('hex'));
    }
  } finally {
    fs.closeSync(fd);
  }
  return { blockSize, blocks };
}

// Pas een delta toe. ops: [{ c: index } | { d: base64 }]. 'c' kopieert een blok
// uit het bestaande bestand, 'd' voegt nieuwe (base64) data toe.
export function applyDelta(absFile, tmpFile, blockSize, ops) {
  const src = fs.existsSync(absFile) ? fs.openSync(absFile, 'r') : null;
  const out = fs.openSync(tmpFile, 'w');
  try {
    const buf = Buffer.alloc(blockSize);
    for (const op of ops) {
      if (op.c !== undefined) {
        if (src === null) throw new Error('Geen bronbestand voor kopieerblok');
        const read = fs.readSync(src, buf, 0, blockSize, op.c * blockSize);
        fs.writeSync(out, buf, 0, read);
      } else if (op.d !== undefined) {
        const data = Buffer.from(op.d, 'base64');
        fs.writeSync(out, data, 0, data.length);
      }
    }
  } finally {
    if (src !== null) fs.closeSync(src);
    fs.closeSync(out);
  }
}
