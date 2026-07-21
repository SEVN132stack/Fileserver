import { Transform } from 'node:stream';

// Transform-stream die de doorvoer beperkt tot ongeveer `bytesPerSec`.
// Gebruikt voor bandbreedtelimiet per gebruiker bij downloads.
export function throttleStream(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return new Transform({ transform(c, e, cb) { cb(null, c); } });
  let allowance = bytesPerSec;
  let last = Date.now();
  return new Transform({
    transform(chunk, _enc, cb) {
      const now = Date.now();
      allowance += ((now - last) / 1000) * bytesPerSec;
      last = now;
      if (allowance > bytesPerSec) allowance = bytesPerSec;
      const send = () => {
        if (chunk.length <= allowance) {
          allowance -= chunk.length;
          cb(null, chunk);
        } else {
          const wait = ((chunk.length - allowance) / bytesPerSec) * 1000;
          setTimeout(() => {
            allowance = 0;
            cb(null, chunk);
          }, Math.max(1, wait));
        }
      };
      send();
    },
  });
}
