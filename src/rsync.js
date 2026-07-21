import fs from 'node:fs';
import { createHash } from 'node:crypto';

// Echte rsync-achtige delta op byte-niveau met een rollende zwakke checksum
// (Adler/rsync) + sterke SHA-1-controle. Hierdoor worden overeenkomende blokken
// op willekeurige byte-offsets herkend (invoegen/verwijderen), i.p.v. alleen op
// vaste blokgrenzen.

const M = 65536;
export const DEFAULT_BLOCK = 2048;

function strong(buf) {
  return createHash('sha1').update(buf).digest('hex');
}

// Zwakke checksum voor buf[start, end).
function weakOf(buf, start, end) {
  let a = 0;
  let b = 0;
  for (let k = start; k < end; k++) {
    a = (a + buf[k]) % M;
    b = (b + (end - k) * buf[k]) % M;
  }
  return { a, b, s: (a + M * b) >>> 0 };
}

// Bereken de handtekening van een bestand: per volledig blok een zwakke+sterke checksum.
export function signature(absFile, blockSize = DEFAULT_BLOCK) {
  const blocks = [];
  if (!fs.existsSync(absFile)) return { blockSize, blocks };
  const buf = fs.readFileSync(absFile);
  for (let i = 0; i < buf.length; i += blockSize) {
    const end = Math.min(i + blockSize, buf.length);
    const w = weakOf(buf, i, end);
    blocks.push({ weak: w.s, strong: strong(buf.subarray(i, end)), len: end - i });
  }
  return { blockSize, blocks };
}

// Bereken een delta van een nieuwe buffer t.o.v. een handtekening.
// Retourneert ops: [{ c: blokindex } | { d: base64 }].
export function computeDelta(sig, buf) {
  const S = sig.blockSize;
  const map = new Map(); // weak -> [{index, strong, len}]
  sig.blocks.forEach((blk, index) => {
    if (blk.len !== S) return; // alleen volledige blokken matchen
    if (!map.has(blk.weak)) map.set(blk.weak, []);
    map.get(blk.weak).push({ index, strong: blk.strong });
  });

  const ops = [];
  let literals = [];
  const flush = () => {
    if (literals.length) { ops.push({ d: Buffer.from(literals).toString('base64') }); literals = []; }
  };

  const N = buf.length;
  let off = 0;
  let w = N >= S ? weakOf(buf, 0, S) : null;

  while (off < N) {
    if (off + S <= N && w) {
      const cands = map.get(w.s);
      let matched = false;
      if (cands) {
        const str = strong(buf.subarray(off, off + S));
        const hit = cands.find((c) => c.strong === str);
        if (hit) {
          flush();
          ops.push({ c: hit.index });
          off += S;
          w = off + S <= N ? weakOf(buf, off, off + S) : null;
          matched = true;
        }
      }
      if (!matched) {
        literals.push(buf[off]);
        const next = off + 1;
        if (next + S <= N) {
          // Rol het venster één byte op.
          const oldByte = buf[off];
          const newByte = buf[off + S];
          let a = (w.a - oldByte + newByte) % M; if (a < 0) a += M;
          let b = (w.b - S * oldByte + a) % M; if (b < 0) b += M;
          w = { a, b, s: (a + M * b) >>> 0 };
        }
        off = next;
      }
    } else {
      literals.push(buf[off]);
      off += 1;
    }
  }
  flush();
  return { blockSize: S, ops };
}

// Pas een delta toe op basis van het bestaande bestand -> tijdelijk bestand.
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
