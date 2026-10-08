import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { config } from './config.js';
import { toClientPath } from './paths.js';

// OCR: haal tekst uit afbeeldingen en gescande PDF's via een extern programma
// (bijv. tesseract), zodat de inhoud doorzoekbaar wordt. De uitkomst wordt per
// bestand opgeslagen ("<home>|<pad>" -> tekst) en meegenomen in het zoeken.

const OCR_EXT = /\.(png|jpe?g|tiff?|bmp|gif|webp|pdf)$/i;
export function canOcr(name) { return !!config.ocrCmd && OCR_EXT.test(name); }

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.ocrFile, 'utf8')); }
  catch { return {}; }
}
function writeAll(obj) {
  const tmp = config.ocrFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 });
  fs.renameSync(tmp, config.ocrFile);
}
const key = (home, p) => `${home}|${p}`;

// Sla OCR-tekst voor een bestand op (gebruikt door de scanner en door tests).
// Met { tried: true } wordt ook een lege uitkomst bewaard, zodat de achtergrond-
// verwerking een bestand zonder tekst niet steeds opnieuw probeert.
export function setOcrText(home, p, text, { tried = false } = {}) {
  const all = readAll();
  if (text) all[key(home, p)] = String(text).slice(0, 200000); // begrens
  else if (tried) all[key(home, p)] = '';
  else delete all[key(home, p)];
  writeAll(all);
}
export function getOcrText(home, p) {
  return readAll()[key(home, p)] || '';
}
export function movePath(home, from, to) {
  const all = readAll();
  const k = key(home, from);
  if (all[k]) { all[key(home, to)] = all[k]; delete all[k]; writeAll(all); }
}
export function removePath(home, p) {
  const all = readAll();
  if (all[key(home, p)]) { delete all[key(home, p)]; writeAll(all); }
}

// Bevat de OCR-tekst van dit bestand de zoekterm? (voor de zoekintegratie)
export function ocrMatches(home, p, query) {
  const t = readAll()[key(home, p)];
  return !!t && t.toLowerCase().includes(query);
}

// --- Uitvoeren ---
// Strikt één OCR-taak tegelijk: een bulk-upload van honderden foto's zou anders
// honderden tesseract-processen tegelijk starten.
let chain = Promise.resolve(); let queued = 0;
function enqueue(fn) {
  if (queued > 10000) return Promise.resolve(); // wachtrij vol: de achtergrondverwerking pakt het later op
  queued++;
  const job = chain.then(fn).finally(() => { queued--; });
  chain = job.catch(() => {});
  return job;
}
function exec(cmd, args, timeout = 120000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => (err ? reject(err) : resolve(String(stdout || ''))));
  });
}
// Afbeelding → tekst. Bij tesseract met OCR_LANG (standaard Nederlands + Engels);
// ontbreekt dat taalpakket, dan opnieuw zonder taalkeuze.
async function ocrImage(file) {
  const [cmd, ...base] = config.ocrCmd.split(' ');
  const lang = path.basename(cmd) === 'tesseract' && config.ocrLang ? ['-l', config.ocrLang] : [];
  try { return await exec(cmd, [...base, file, 'stdout', ...lang]); } catch (err) {
    if (!lang.length) throw err;
    return exec(cmd, [...base, file, 'stdout']);
  }
}
// PDF → tekst. Eerst de tekstlaag (pdftotext); is die (vrijwel) leeg, dan is het
// een scan: pagina's renderen (pdftoppm) en OCR'en. Tesseract leest zelf geen PDF.
async function ocrPdf(file) {
  const pages = String(config.ocrMaxPages);
  try {
    const text = await exec('pdftotext', ['-layout', '-l', pages, file, '-']);
    if (text.replace(/\s/g, '').length >= 50) return text;
  } catch { /* geen poppler of geen tekstlaag */ }
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ocr-'));
  try {
    await exec('pdftoppm', ['-r', '200', '-gray', '-png', '-l', pages, file, path.join(dir, 'p')], 300000);
    let out = '';
    for (const pg of (await fsp.readdir(dir)).sort()) out += (await ocrImage(path.join(dir, pg))) + '\n';
    return out;
  } finally { await fsp.rm(dir, { recursive: true, force: true }); }
}
async function ocrFile(absPath) {
  return /\.pdf$/i.test(absPath) ? ocrPdf(absPath) : ocrImage(absPath);
}

// OCR na een upload (fire-and-forget, via de wachtrij). De tekst wordt bewaard;
// lukt het niet, dan wordt het bestand als geprobeerd gemarkeerd.
export function runOcr(home, relPath, absPath) {
  if (!config.ocrCmd) return Promise.resolve();
  try { if (fs.statSync(absPath).size > config.ocrMaxBytes) return Promise.resolve(); } catch { return Promise.resolve(); }
  return enqueue(async () => {
    let text = '';
    try { text = (await ocrFile(absPath)).trim(); } catch { /* mislukt: als geprobeerd markeren */ }
    setOcrText(home, relPath, text, { tried: true });
  });
}

// Achtergrondverwerking: bestanden die nog geen OCR hebben (bestaande bestanden,
// en uploads via SFTP/WebDAV/chunked) alsnog verwerken. Per ronde begrensd.
function walk(dir, out) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === config.trashName || e.name === config.versionsName) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && OCR_EXT.test(e.name)) out.push(full);
  }
}
let backfilling = false;
export async function backfill(limit = 200) {
  if (!config.ocrCmd || backfilling) return { skipped: true };
  backfilling = true;
  try {
    const all = readAll(); let done = 0;
    let homes = []; try { homes = fs.readdirSync(config.storageDir, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { /* geen opslag */ }
    for (const h of homes) {
      const home = path.join(config.storageDir, h.name);
      const files = []; walk(home, files);
      for (const f of files) {
        if (done >= limit) return { done };
        const rel = toClientPath(home, f);
        if (key(home, rel) in all) continue;
        await runOcr(home, rel, f);
        if (!(key(home, rel) in readAll())) setOcrText(home, rel, '', { tried: true }); // te groot e.d.
        done++;
      }
    }
    return { done };
  } finally { backfilling = false; }
}
export function startOcrBackfill() {
  if (!config.ocrCmd) return;
  const tick = () => { backfill().catch((e) => console.error('[ocr]', e.message)); };
  setTimeout(tick, 15 * 60000).unref(); // niet direct na een herstart/deploy
  setInterval(tick, 3600000).unref();
}
