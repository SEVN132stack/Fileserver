import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from './config.js';
import { resolveWithin } from './paths.js';
import * as tags from './tags.js';

// Weergave & inzicht: kaartweergave (GPS-foto's), tijdlijn en relatiegrafiek.
// Alles werkt op de bestaande opslag; er is geen extern commando nodig.

const IMG = /\.(jpe?g|tiff?)$/i; // formaten die EXIF-GPS kunnen bevatten
const ANY_IMG = /\.(jpe?g|png|gif|webp|tiff?|heic|bmp)$/i;

// --- EXIF GPS-parser (minimale TIFF/EXIF-lezer) ------------------------------
// Leest de GPS-IFD uit een EXIF-blob en geeft {lat, lng} in decimale graden.
export function parseGps(exif) {
  if (!Buffer.isBuffer(exif) || exif.length < 16) return null;
  // EXIF-blobs van sharp beginnen soms met "Exif\0\0"; zoek de TIFF-header.
  let base = 0;
  const idx = exif.indexOf('Exif\0\0');
  if (idx >= 0) base = idx + 6;
  const b = exif.subarray(base);
  if (b.length < 8) return null;
  const le = b[0] === 0x49 && b[1] === 0x49; // 'II' = little-endian
  const be = b[0] === 0x4d && b[1] === 0x4d; // 'MM' = big-endian
  if (!le && !be) return null;
  const u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));

  const readIfd = (offset) => {
    const entries = {};
    if (offset + 2 > b.length) return entries;
    const count = u16(offset);
    for (let i = 0; i < count; i++) {
      const e = offset + 2 + i * 12;
      if (e + 12 > b.length) break;
      entries[u16(e)] = { type: u16(e + 2), count: u32(e + 4), valOff: e + 8 };
    }
    return entries;
  };

  const ifd0 = readIfd(u32(4));
  const gpsPtr = ifd0[0x8825];
  if (!gpsPtr) return null;
  const gps = readIfd(u32(gpsPtr.valOff));

  // Lees `count` rationals (elk 8 bytes: teller/noemer) vanaf de offset-waarde.
  const rationals = (entry) => {
    if (!entry) return null;
    const off = u32(entry.valOff);
    const out = [];
    for (let i = 0; i < entry.count; i++) {
      const o = off + i * 8;
      if (o + 8 > b.length) return null;
      const num = u32(o); const den = u32(o + 4) || 1;
      out.push(num / den);
    }
    return out;
  };
  const toDeg = (dms) => (dms && dms.length === 3 ? dms[0] + dms[1] / 60 + dms[2] / 3600 : null);
  const refChar = (entry) => (entry ? String.fromCharCode(b[entry.valOff]) : '');

  let lat = toDeg(rationals(gps[0x0002]));
  let lng = toDeg(rationals(gps[0x0004]));
  if (lat == null || lng == null) return null;
  if (refChar(gps[0x0001]) === 'S') lat = -lat;
  if (refChar(gps[0x0003]) === 'W') lng = -lng;
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

// Haal de opnamedatum (DateTimeOriginal) of anders de mtime van een bestand.
async function fileDate(abs) {
  try {
    const meta = await sharp(abs, { failOn: 'none' }).metadata();
    if (meta.exif) {
      const m = meta.exif.toString('latin1').match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`).getTime();
    }
  } catch { /* geen EXIF */ }
  try { return fs.statSync(abs).mtimeMs; } catch { return Date.now(); }
}

// Loop (begrensd) recursief door de home van een gebruiker.
function walk(home, relDir, onFile) {
  let visited = 0;
  const rec = (abs, rel) => {
    if (visited > config.insightsMaxScan) return;
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (visited > config.insightsMaxScan) return;
      if (e.name.startsWith('.')) continue;
      const childRel = (rel === '/' ? '' : rel) + '/' + e.name;
      if (e.isDirectory()) rec(path.join(abs, e.name), childRel);
      else { visited++; onFile(path.join(abs, e.name), childRel, e.name); }
    }
  };
  const start = resolveWithin(home, relDir || '/');
  rec(start, relDir && relDir !== '/' ? relDir.replace(/\/+$/, '') : '/');
}

// 17. Kaartweergave: foto's met GPS-coördinaten.
export async function geoPhotos(home, relDir) {
  const candidates = [];
  walk(home, relDir, (abs, rel, name) => { if (IMG.test(name)) candidates.push([abs, rel]); });
  const out = [];
  for (const [abs, rel] of candidates) {
    try {
      const meta = await sharp(abs, { failOn: 'none' }).metadata();
      if (!meta.exif) continue;
      const gps = parseGps(meta.exif);
      if (gps) out.push({ path: rel, lat: gps.lat, lng: gps.lng });
    } catch { /* onleesbaar */ }
  }
  return out;
}

// 18. Tijdlijnweergave: bestanden gesorteerd op datum, gebucket per maand.
export async function timeline(home, relDir) {
  const files = [];
  walk(home, relDir, (abs, rel, name) => files.push([abs, rel, name]));
  const items = [];
  for (const [abs, rel, name] of files) {
    const isImg = ANY_IMG.test(name);
    const ts = isImg ? await fileDate(abs) : (() => { try { return fs.statSync(abs).mtimeMs; } catch { return Date.now(); } })();
    items.push({ path: rel, ts, month: new Date(ts).toISOString().slice(0, 7) });
  }
  items.sort((a, b) => b.ts - a.ts);
  const buckets = {};
  for (const it of items) (buckets[it.month] ||= []).push({ path: it.path, ts: it.ts });
  return { items: items.slice(0, 1000), months: Object.entries(buckets).sort((a, b) => b[0].localeCompare(a[0])).map(([month, list]) => ({ month, count: list.length })) };
}

// 19. Relatiegrafiek: bestanden verbonden via gedeelde tags.
export function tagGraph(user) {
  const tagged = tags.allForUser(user); // { pad: [tags] }
  const paths = Object.keys(tagged);
  const nodes = paths.map((p) => ({ id: p, name: p.split('/').pop(), tags: tagged[p] }));
  const edges = [];
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const shared = tagged[paths[i]].filter((t) => tagged[paths[j]].includes(t));
      if (shared.length) edges.push({ source: paths[i], target: paths[j], tags: shared, weight: shared.length });
    }
  }
  return { nodes, edges };
}
