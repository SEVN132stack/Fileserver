import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';

// Delta-uploads op blokniveau voor grote bestanden. De client splitst het nieuwe
// bestand in blokken van vaste grootte en stuurt alleen de SHA-256 per blok. De
// server vergelijkt met het bestaande bestand en vraagt alleen de gewijzigde
// blokken op. Bij het afronden wordt het nieuwe bestand samengesteld uit
// ongewijzigde oude blokken + ontvangen blokken, en volledig geverifieerd:
//  - elk ontvangen blok moet overeenkomen met de opgegeven hash;
//  - elk hergebruikt oud blok wordt opnieuw gehasht (het oude bestand kan intussen
//    gewijzigd zijn);
//  - als de client een SHA-256 van het hele bestand meestuurt, moet die kloppen.
// Pas dan wordt het doelbestand atomair vervangen. Onafgemaakte sessies verlopen.

const SESSION_TTL = 3600000;
const MIN_BS = 256 * 1024;
const MAX_BS = 16 * 1048576;
const sessions = new Map(); // id -> session

export function sessionDir() { return path.join(config.chunkDir, 'delta'); }
const HEX = /^[0-9a-f]{64}$/;

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.created > SESSION_TTL) { drop(id); }
}
function drop(id) {
  const s = sessions.get(id); if (!s) return;
  try { fs.rmSync(s.dir, { recursive: true, force: true }); } catch { /* weg */ }
  sessions.delete(id);
}

// Hash per blok van een bestaand bestand. Asynchroon en blok voor blok, zodat
// een zeer groot bestand de event loop (en daarmee de hele server) niet blokkeert.
export async function blockHashes(absFile, blockSize) {
  const out = [];
  let fh; try { fh = await fsp.open(absFile, 'r'); } catch { return out; }
  try {
    const buf = Buffer.allocUnsafe(blockSize);
    let pos = 0;
    for (;;) {
      const { bytesRead } = await fh.read(buf, 0, blockSize, pos);
      if (!bytesRead) break;
      out.push(createHash('sha256').update(buf.subarray(0, bytesRead)).digest('hex'));
      pos += bytesRead;
    }
  } finally { await fh.close(); }
  return out;
}

// Start een sessie. Retourneert de indexen van de blokken die de client moet sturen.
export async function start(user, absTarget, relTarget, { size, sha256, blockSize, blocks }) {
  sweep();
  const bs = parseInt(blockSize, 10);
  const total = Number(size);
  if (!Number.isFinite(bs) || bs < MIN_BS || bs > MAX_BS) throw new Error('Ongeldige blokgrootte');
  if (!Number.isFinite(total) || total < 0) throw new Error('Ongeldige grootte');
  // Optioneel: hash van het hele bestand (bijv. vanaf een CLI). Browsers kunnen niet
  // streamend hashen; elk blok wordt sowieso afzonderlijk geverifieerd.
  if (sha256 && !HEX.test(String(sha256))) throw new Error('Ongeldige hash');
  const n = total === 0 ? 0 : Math.ceil(total / bs);
  if (n > 100000) throw new Error('Bestand te groot voor deze blokgrootte (max. 100.000 blokken)');
  if (!Array.isArray(blocks) || blocks.length !== n || !blocks.every((h) => HEX.test(String(h)))) throw new Error('Bloklijst klopt niet met de grootte');
  let open = 0; for (const s of sessions.values()) if (s.user === user) open++;
  if (open >= 5) throw new Error('Te veel lopende delta-uploads');
  // Reserveer de sessieplek vóór het (asynchrone) hashen, zodat parallelle starts de limiet niet omzeilen.
  const id = randomBytes(12).toString('hex');
  const dir = path.join(sessionDir(), id);
  const sess = { id, user, absTarget, relTarget, size: total, sha256, bs, blocks, need: new Set(), got: new Set(), dir, created: Date.now(), ready: false };
  sessions.set(id, sess);
  let old;
  try { old = fs.existsSync(absTarget) && fs.statSync(absTarget).isFile() ? await blockHashes(absTarget, bs) : []; }
  catch (err) { sessions.delete(id); throw err; }
  const need = [];
  for (let i = 0; i < n; i++) if (old[i] !== blocks[i]) need.push(i);
  await fsp.mkdir(dir, { recursive: true });
  sess.need = new Set(need); sess.ready = true;
  return { id, need, reuse: n - need.length, blockSize: bs };
}

export function getSession(user, id) {
  const s = sessions.get(String(id || ''));
  return s && s.user === user && s.ready ? s : null;
}

// Ontvang één (gewijzigd) blok; de hash wordt direct gecontroleerd.
export async function putBlock(user, id, index, buf) {
  const s = getSession(user, id);
  if (!s) throw new Error('Sessie niet gevonden');
  const i = parseInt(index, 10);
  if (!s.need.has(i)) throw new Error('Dit blok is niet nodig');
  const expectLen = i === Math.ceil(s.size / s.bs) - 1 ? s.size - i * s.bs : s.bs;
  if (buf.length !== expectLen) throw new Error('Onjuiste bloklengte');
  if (createHash('sha256').update(buf).digest('hex') !== s.blocks[i]) throw new Error('Blok-hash klopt niet');
  await fsp.writeFile(path.join(s.dir, String(i)), buf);
  s.got.add(i);
  return { received: s.got.size, needed: s.need.size };
}

// Stel het bestand samen, verifieer alles en vervang het doel atomair.
// `verify(tmpPath)` (async) mag het samengestelde bestand afkeuren (bijv. virusscan);
// `beforeReplace()` wordt vlak voor het vervangen aangeroepen (bijv. versie-snapshot).
export async function finish(user, id, { verify, beforeReplace } = {}) {
  const s = getSession(user, id);
  if (!s) throw new Error('Sessie niet gevonden');
  for (const i of s.need) if (!s.got.has(i)) throw new Error(`Blok ${i} ontbreekt nog`);
  const n = s.size === 0 ? 0 : Math.ceil(s.size / s.bs);
  const tmp = path.join(s.dir, 'assembled');
  // Voorkom dat twee gelijktijdige finish-aanroepen dezelfde sessie samenstellen.
  if (s.finishing) throw new Error('Wordt al afgerond');
  s.finishing = true;
  const out = await fsp.open(tmp, 'w');
  const whole = createHash('sha256');
  let oldFh = null;
  try {
    const buf = Buffer.allocUnsafe(s.bs);
    for (let i = 0; i < n; i++) {
      let chunk;
      if (s.need.has(i)) chunk = await fsp.readFile(path.join(s.dir, String(i)));
      else {
        if (oldFh === null) oldFh = await fsp.open(s.absTarget, 'r');
        const { bytesRead } = await oldFh.read(buf, 0, s.bs, i * s.bs);
        chunk = buf.subarray(0, bytesRead);
        // Het oude bestand kan sinds de start gewijzigd zijn: hergebruik alleen als de hash nog klopt.
        if (createHash('sha256').update(chunk).digest('hex') !== s.blocks[i]) { s.finishing = false; throw new Error('Bestaand bestand is intussen gewijzigd; start de upload opnieuw'); }
      }
      whole.update(chunk);
      await out.write(chunk);
    }
  } catch (err) { s.finishing = false; throw err; }
  finally {
    await out.close();
    if (oldFh !== null) await oldFh.close();
  }
  const digest = whole.digest('hex');
  if (s.sha256 && digest !== s.sha256) { drop(id); throw new Error('Controlesom van het samengestelde bestand klopt niet'); }
  if (typeof verify === 'function') {
    const why = await verify(tmp, s);
    if (why) { drop(id); throw new Error(why); }
  }
  if (typeof beforeReplace === 'function') beforeReplace(s);
  fs.mkdirSync(path.dirname(s.absTarget), { recursive: true });
  try { fs.renameSync(tmp, s.absTarget); }
  catch (err) {
    if (err.code !== 'EXDEV') throw err;
    // Andere schijf/volume: kopieer naar een tijdelijke naam naast het doel en hernoem dan atomair.
    const side = s.absTarget + '.delta-' + s.id;
    await fsp.copyFile(tmp, side); fs.renameSync(side, s.absTarget);
  }
  const result = { ok: true, path: s.relTarget, size: s.size, sha256: digest, sentBlocks: s.need.size, reusedBlocks: n - s.need.size };
  drop(id);
  return result;
}

export function abort(user, id) { const s = getSession(user, id); if (!s) return false; drop(s.id); return true; }

export function init() {
  try { fs.rmSync(sessionDir(), { recursive: true, force: true }); } catch { /* nvt */ }
  const t = setInterval(sweep, 600000); if (t.unref) t.unref();
}
