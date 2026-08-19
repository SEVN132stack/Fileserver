import fs from 'node:fs';
import { PDFDocument, degrees } from 'pdf-lib';

// PDF-bewerking via pdf-lib: samenvoegen, splitsen (pagina-selectie) en roteren.
// Alle operaties produceren nieuwe PDF-bytes; originelen blijven ongewijzigd.

export const isPdf = (name) => /\.pdf$/i.test(name);

// Voeg meerdere PDF's samen tot één document.
export async function mergePdfs(paths) {
  const out = await PDFDocument.create();
  for (const p of paths) {
    const src = await PDFDocument.load(fs.readFileSync(p), { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((pg) => out.addPage(pg));
  }
  return Buffer.from(await out.save());
}

// Parse een pagina-selectie als "1-3,5,8-10" (1-gebaseerd) naar 0-gebaseerde indexen.
export function parseRanges(spec, pageCount) {
  const idx = new Set();
  for (const part of String(spec).split(',')) {
    const s = part.trim();
    if (!s) continue;
    const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { for (let i = +m[1]; i <= +m[2]; i++) if (i >= 1 && i <= pageCount) idx.add(i - 1); }
    else if (/^\d+$/.test(s)) { const i = +s; if (i >= 1 && i <= pageCount) idx.add(i - 1); }
  }
  return [...idx].sort((a, b) => a - b);
}

// Maak een nieuwe PDF met alleen de geselecteerde pagina's.
export async function splitPdf(path, rangeSpec) {
  const src = await PDFDocument.load(fs.readFileSync(path), { ignoreEncryption: true });
  const indices = parseRanges(rangeSpec, src.getPageCount());
  if (!indices.length) throw new Error('Geen geldige pagina\'s geselecteerd');
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((pg) => out.addPage(pg));
  return Buffer.from(await out.save());
}

// Roteer alle pagina's (of een selectie) met een veelvoud van 90 graden.
export async function rotatePdf(path, deg, rangeSpec = '') {
  const doc = await PDFDocument.load(fs.readFileSync(path), { ignoreEncryption: true });
  const count = doc.getPageCount();
  const which = rangeSpec ? parseRanges(rangeSpec, count) : [...Array(count).keys()];
  const step = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  for (const i of which) {
    const pg = doc.getPage(i);
    const cur = pg.getRotation().angle || 0;
    pg.setRotation(degrees((cur + step) % 360));
  }
  return Buffer.from(await doc.save());
}
