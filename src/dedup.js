import fs from 'node:fs';
import path from 'node:path';
import { findDuplicates } from './analysis.js';
import { homeDir } from './users.js';
import { retainedUntil } from './retention.js';
import { audit } from './audit.js';

// Opslag-deduplicatie: vervang identieke bestanden door reflink-kopieën
// (copy-on-write). Zo delen ze dezelfde blokken op schijf (ruimtebesparing),
// maar blijft elk bestand logisch los — een wijziging aan de één triggert
// copy-on-write en raakt de ander niet. Vereist een bestandssysteem met
// reflink-ondersteuning (btrfs/XFS/APFS); anders wordt er niets gededupliceerd.

const FICLONE_FORCE = fs.constants.COPYFILE_FICLONE_FORCE;

export function dedupeUser(user) {
  const home = homeDir(user);
  const { groups } = findDuplicates(home);
  let reflinked = 0, saved = 0;
  let supported = true;
  for (const g of groups) {
    const [keep, ...rest] = g.paths;
    const keepAbs = path.join(home, keep.replace(/^\//, ''));
    for (const dupRel of rest) {
      if (retainedUntil(home, dupRel)) continue; // WORM: niet aanraken
      const dupAbs = path.join(home, dupRel.replace(/^\//, ''));
      const tmp = dupAbs + '.reflink-' + Date.now();
      try {
        fs.copyFileSync(keepAbs, tmp, FICLONE_FORCE); // faalt als FS geen reflink kan
        fs.renameSync(tmp, dupAbs);
        reflinked++; saved += g.size;
      } catch (err) {
        try { fs.rmSync(tmp, { force: true }); } catch { /* al weg */ }
        if (err && (err.code === 'ENOTSUP' || err.code === 'EOPNOTSUPP' || err.code === 'EINVAL')) { supported = false; break; }
      }
    }
    if (!supported) break;
  }
  if (reflinked) audit('web', user, 'dedup', { reflinked, saved });
  return { supported, reflinked, saved, duplicateGroups: groups.length };
}
