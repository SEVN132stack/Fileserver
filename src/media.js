import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { config } from './config.js';

// Video-posterframes en audio-golfvormen via ffmpeg (optioneel; alleen als
// FFMPEG_CMD is ingesteld). Resultaten worden in de thumbnail-cache bewaard.

const VIDEO = /\.(mp4|webm|mov|mkv|avi|m4v)$/i;
const AUDIO = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;
export const canPoster = (name) => VIDEO.test(name);
export const canWaveform = (name) => AUDIO.test(name);
export const hasFfmpeg = () => !!config.ffmpegCmd;

// Cachesleutel: hash van pad + grootte + wijzigingstijd. (Voorheen de eerste 40
// base64-tekens van het pad: alle bestanden onder dezelfde home deelden dan één
// cachebestand. Grootte/mtime erbij zodat een gewijzigd bestand opnieuw gaat.)
function cachePath(srcPath, suffix) {
  let st = { size: 0, mtimeMs: 0 }; try { st = fs.statSync(srcPath); } catch { /* bestaat niet */ }
  const key = createHash('sha256').update(`${srcPath}\0${st.size}\0${st.mtimeMs}`).digest('base64url').slice(0, 32);
  return path.join(config.thumbDir, key + suffix);
}

// Eén ffmpeg-proces tegelijk: een map vol video's vraagt anders tientallen
// posterframes tegelijk op, wat op een kleine server het geheugen opblaast.
let queue = Promise.resolve();
function run(args) {
  const job = queue.then(() => new Promise((resolve, reject) => {
    const [cmd, ...base] = config.ffmpegCmd.split(' ');
    execFile(cmd, [...base, '-hide_banner', '-loglevel', 'error', '-threads', '1', ...args], { timeout: 60000 }, (err) => (err ? reject(err) : resolve()));
  }));
  queue = job.catch(() => {});
  return job;
}

// Genereer (of hergebruik) een posterframe (JPEG) op ~1s in de video. 0:V:0 is
// de eerste echte videostroom (mkv's hebben soms een cover-bijlage als eerste
// stroom); yuvj420p omdat de JPEG-encoder 10-bit/HDR-materiaal anders weigert.
// Is de video korter dan 1s, dan levert -ss 1 niets op: dan het eerste frame.
export async function videoPoster(srcPath) {
  if (!config.ffmpegCmd) return null;
  const out = cachePath(srcPath, '.poster.jpg');
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(config.thumbDir, { recursive: true });
  const args = ['-i', srcPath, '-map', '0:V:0', '-frames:v', '1', '-vf', 'scale=320:-2,format=yuvj420p', out];
  try { await run(['-y', '-ss', '1', ...args]); } catch { /* hieronder opnieuw */ }
  if (!fs.existsSync(out)) await run(['-y', ...args]);
  return fs.existsSync(out) ? out : null;
}

// Afspeelbare MP4 voor containers die browsers niet kennen (mkv/avi). Eerst
// zonder hercoderen (-c copy, snel en zonder kwaliteitsverlies; werkt voor
// H.264/AAC); lukt dat niet, dan hercoderen naar H.264/AAC. Eigen wachtrij,
// zodat een lange omzetting de posterframes niet blokkeert.
export const needsRemux = (name) => /\.(mkv|avi)$/i.test(name);
let playQueue = Promise.resolve();
const pending = new Map();
// Mislukte omzettingen onthouden (per cachesleutel, dus per versie van het
// bestand), zodat een kapot bestand niet bij elke poging opnieuw tot een uur
// CPU kost. Na een dag mag het opnieuw.
const failed = new Map();
const FAIL_TTL = 24 * 3600000;
function ff(args, timeout) {
  return new Promise((resolve, reject) => {
    const [cmd, ...base] = config.ffmpegCmd.split(' ');
    execFile(cmd, [...base, '-hide_banner', '-loglevel', 'error', '-threads', '1', ...args], { timeout }, (err) => (err ? reject(err) : resolve()));
  });
}
export async function playableMp4(srcPath) {
  if (!config.ffmpegCmd) return null;
  const out = cachePath(srcPath, '.play.mp4');
  if (fs.existsSync(out)) { const now = new Date(); try { fs.utimesSync(out, now, now); } catch { /* ok */ } return out; }
  if (pending.has(out)) return pending.get(out);
  if (Date.now() - (failed.get(out) || 0) < FAIL_TTL) throw new Error('omzetten eerder mislukt; probeer het later opnieuw');
  const job = playQueue.then(async () => {
    fs.mkdirSync(config.thumbDir, { recursive: true });
    const tmp = out + '.tmp.mp4';
    try {
      try {
        await ff(['-y', '-i', srcPath, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', tmp], 15 * 60000);
      } catch {
        await ff(['-y', '-i', srcPath, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', tmp], 60 * 60000);
      }
    } catch (err) {
      fs.rmSync(tmp, { force: true }); // geen half bestand in de cache laten staan
      failed.set(out, Date.now());
      throw err;
    }
    fs.renameSync(tmp, out);
    pruneCache('.play.mp4', config.playCacheBytes);
    return out;
  }).finally(() => pending.delete(out));
  playQueue = job.catch(() => {});
  pending.set(out, job);
  return job;
}

// Houd de afspeelcache onder een maximum: oudst-gebruikte bestanden eerst weg.
function pruneCache(suffix, maxBytes) {
  try {
    // Restanten van afgebroken omzettingen (bv. herstart tijdens het omzetten).
    for (const f of fs.readdirSync(config.thumbDir).filter((n) => n.endsWith('.tmp.mp4'))) {
      const p = path.join(config.thumbDir, f);
      if (!pending.has(p.slice(0, -'.tmp.mp4'.length)) && Date.now() - fs.statSync(p).mtimeMs > 2 * 3600000) fs.rmSync(p, { force: true });
    }
    const files = fs.readdirSync(config.thumbDir).filter((f) => f.endsWith(suffix))
      .map((f) => { const p = path.join(config.thumbDir, f); const st = fs.statSync(p); return { p, size: st.size, t: st.mtimeMs }; })
      .sort((a, b) => b.t - a.t);
    let total = 0;
    for (const f of files) { total += f.size; if (total > maxBytes) fs.rmSync(f.p, { force: true }); }
  } catch { /* opruimen is best-effort */ }
}

// Genereer (of hergebruik) een golfvorm-afbeelding (PNG) voor audio.
export async function audioWaveform(srcPath) {
  if (!config.ffmpegCmd) return null;
  const out = cachePath(srcPath, '.wave.png');
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(config.thumbDir, { recursive: true });
  await run(['-y', '-i', srcPath, '-filter_complex', 'showwavespic=s=480x120:colors=#38bdf8', '-frames:v', '1', out]);
  return fs.existsSync(out) ? out : null;
}
