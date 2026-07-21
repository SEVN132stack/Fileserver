'use strict';
// Browser-zijde rsync-delta: berekent een delta van een lokaal bestand t.o.v.
// de handtekening die de server van de bestaande versie levert. Zo worden alleen
// gewijzigde blokken verstuurd (efficiënt bijwerken van grote bestanden).

const RS_M = 65536;

async function sha1hex(bytes) {
  const d = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function weakOf(buf, start, end) {
  let a = 0, b = 0;
  for (let k = start; k < end; k++) { a = (a + buf[k]) % RS_M; b = (b + (end - k) * buf[k]) % RS_M; }
  return { a, b, s: (a + RS_M * b) >>> 0 };
}

// sig = { blockSize, blocks: [{weak, strong, len}] }; buf = Uint8Array.
window.fseComputeDelta = async function (sig, buf) {
  const S = sig.blockSize;
  const map = new Map();
  sig.blocks.forEach((blk, index) => {
    if (blk.len !== S) return;
    if (!map.has(blk.weak)) map.set(blk.weak, []);
    map.get(blk.weak).push({ index, strong: blk.strong });
  });

  const ops = [];
  let literals = [];
  const flush = () => { if (literals.length) { ops.push({ d: btoa(String.fromCharCode(...literals)) }); literals = []; } };

  const N = buf.length;
  let off = 0;
  let w = N >= S ? weakOf(buf, 0, S) : null;
  while (off < N) {
    if (off + S <= N && w) {
      const cands = map.get(w.s);
      let matched = false;
      if (cands) {
        const str = await sha1hex(buf.subarray(off, off + S));
        const hit = cands.find((c) => c.strong === str);
        if (hit) { flush(); ops.push({ c: hit.index }); off += S; w = off + S <= N ? weakOf(buf, off, off + S) : null; matched = true; }
      }
      if (!matched) {
        literals.push(buf[off]);
        const next = off + 1;
        if (next + S <= N) {
          const oldB = buf[off], newB = buf[off + S];
          let a = (w.a - oldB + newB) % RS_M; if (a < 0) a += RS_M;
          let b = (w.b - S * oldB + a) % RS_M; if (b < 0) b += RS_M;
          w = { a, b, s: (a + RS_M * b) >>> 0 };
        }
        off = next;
      }
    } else { literals.push(buf[off]); off += 1; }
  }
  flush();
  const literalBytes = ops.filter((o) => o.d !== undefined).reduce((n, o) => n + atob(o.d).length, 0);
  return { blockSize: S, ops, literalBytes, total: N };
};
