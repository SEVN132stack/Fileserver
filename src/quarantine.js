import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';

// Beheer van bestanden in quarantaine. Verdachte uploads worden niet direct
// verwijderd maar apart gezet; een beheerder kan ze bekijken, vrijgeven of wissen.

function readMeta() {
  try { return JSON.parse(fs.readFileSync(config.quarantineMeta, 'utf8')); } catch { return []; }
}
function writeMeta(list) {
  fs.writeFileSync(config.quarantineMeta, JSON.stringify(list, null, 2), { mode: 0o600 });
}

// Verplaats een verdacht bestand naar de quarantaine en registreer het.
export function quarantine(srcPath, { user, home, targetPath, filename, detail }) {
  fs.mkdirSync(config.quarantineDir, { recursive: true });
  const id = randomBytes(8).toString('hex');
  const dest = path.join(config.quarantineDir, id);
  fs.renameSync(srcPath, dest);
  const list = readMeta();
  list.push({ id, user, home, targetPath, filename, detail, ts: new Date().toISOString() });
  writeMeta(list);
  return id;
}

export function listQuarantine() {
  return readMeta();
}

// Geef een bestand vrij: terugzetten naar de oorspronkelijke bestemming.
export function release(id) {
  const list = readMeta();
  const item = list.find((q) => q.id === id);
  if (!item) throw new Error('Niet gevonden');
  const dest = path.join(item.home, item.targetPath.replace(/^\//, ''), item.filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(path.join(config.quarantineDir, id), dest);
  writeMeta(list.filter((q) => q.id !== id));
  return dest;
}

export function remove(id) {
  const list = readMeta();
  if (!list.find((q) => q.id === id)) throw new Error('Niet gevonden');
  try { fs.unlinkSync(path.join(config.quarantineDir, id)); } catch { /* al weg */ }
  writeMeta(list.filter((q) => q.id !== id));
}
