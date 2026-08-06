import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { config } from './config.js';

// OCR: haal tekst uit afbeeldingen en gescande PDF's via een extern programma
// (bijv. tesseract), zodat de inhoud doorzoekbaar wordt. De uitkomst wordt per
// bestand opgeslagen ("<home>|<pad>" -> tekst) en meegenomen in het zoeken.

const OCR_EXT = /\.(png|jpe?g|tiff?|bmp|gif|webp|pdf)$/i;
export function canOcr(name) { return !!config.ocrCmd && OCR_EXT.test(name); }

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.ocrFile, 'utf8')); }
  catch { return {}; }
}
function writeAll(obj) { fs.writeFileSync(config.ocrFile, JSON.stringify(obj), { mode: 0o600 }); }
const key = (home, p) => `${home}|${p}`;

// Sla OCR-tekst voor een bestand op (gebruikt door de scanner en door tests).
export function setOcrText(home, p, text) {
  const all = readAll();
  if (text) all[key(home, p)] = String(text).slice(0, 200000); // begrens
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

// Draai het OCR-commando op een bestand en bewaar de tekst (asynchroon,
// fire-and-forget vanuit de upload). Het commando krijgt het bestandspad en moet
// de herkende tekst naar stdout schrijven (zoals `tesseract <file> stdout`).
export function runOcr(home, relPath, absPath) {
  if (!config.ocrCmd) return;
  try { if (fs.statSync(absPath).size > config.ocrMaxBytes) return; } catch { return; }
  const [cmd, ...args] = config.ocrCmd.split(' ');
  execFile(cmd, [...args, absPath, 'stdout'], { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
    if (err) return; // OCR mislukt: stil overslaan
    const text = (stdout || '').trim();
    if (text) setOcrText(home, relPath, text);
  });
}
