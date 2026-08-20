import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';

// Veilig verwijderen ("shredder"): overschrijf de bestandsinhoud met willekeurige
// bytes vóór verwijdering, zodat de data niet triviaal terug te halen is. Werkt
// op reguliere bestanden; mappen worden recursief behandeld. NB: op copy-on-write-
// of geflashte bestandssystemen (SSD/reflink/snapshots) is overschrijven niet
// gegarandeerd afdoende — dit is een best-effort maatregel.

function shredOne(absFile, passes) {
  let size = 0;
  try { size = fs.statSync(absFile).size; } catch { return; }
  if (size > 0) {
    const fd = fs.openSync(absFile, 'r+');
    try {
      for (let p = 0; p < passes; p++) {
        let written = 0;
        while (written < size) {
          const chunk = randomBytes(Math.min(65536, size - written));
          fs.writeSync(fd, chunk, 0, chunk.length, written);
          written += chunk.length;
        }
        fs.fsyncSync(fd);
      }
    } finally { fs.closeSync(fd); }
  }
  fs.rmSync(absFile, { force: true });
}

// Verwijder een pad veilig (bestand of map) met N overschrijf-passes.
export function shred(absPath, passes = config.shredPasses) {
  const n = Math.max(1, passes || 1);
  let st;
  try { st = fs.statSync(absPath); } catch { return false; }
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(absPath)) shred(`${absPath}/${e}`, n);
    fs.rmSync(absPath, { recursive: true, force: true });
  } else {
    shredOne(absPath, n);
  }
  return true;
}
