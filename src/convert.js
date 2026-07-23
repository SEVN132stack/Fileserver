import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import sharp from 'sharp';
import { config } from './config.js';

// Server-side bestandsconversie. Afbeeldingen gaan via sharp (incl. HEIC→JPG als
// de sharp-build libheif ondersteunt). Documenten→PDF via LibreOffice (SOFFICE_CMD).
// Audio/video-transcode via ffmpeg (FFMPEG_CMD).

const IMG_TO = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff']);
const IMG_FROM = /\.(jpe?g|png|webp|gif|tiff?|heic|heif|avif|bmp)$/i;
const DOC_FROM = /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt)$/i;
const AV_FROM = /\.(mp4|webm|mov|mkv|avi|m4v|mp3|wav|flac|ogg|m4a|aac)$/i;

export function canConvert(name) {
  return IMG_FROM.test(name) || (config.sofficeCmd && DOC_FROM.test(name)) || (config.ffmpegCmd && AV_FROM.test(name));
}

// Converteer een afbeelding naar een doelformaat; geeft een Buffer terug.
export async function convertImage(src, to) {
  const fmt = to === 'jpg' ? 'jpeg' : to;
  if (!IMG_TO.has(to)) throw new Error('Onbekend doelformaat');
  return sharp(src, { failOn: 'none' }).toFormat(fmt).toBuffer();
}

// Converteer een document naar PDF via LibreOffice; geeft het pad naar de PDF.
export function convertDocToPdf(src) {
  return new Promise((resolve, reject) => {
    if (!config.sofficeCmd) return reject(new Error('LibreOffice niet geconfigureerd (SOFFICE_CMD)'));
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fsconv-'));
    const [cmd, ...base] = config.sofficeCmd.split(' ');
    execFile(cmd, [...base, '--headless', '--convert-to', 'pdf', '--outdir', outDir, src], { timeout: 120000 }, (err) => {
      if (err) return reject(err);
      const pdf = path.join(outDir, path.basename(src).replace(/\.[^.]+$/, '') + '.pdf');
      if (fs.existsSync(pdf)) resolve(pdf); else reject(new Error('Conversie leverde geen PDF op'));
    });
  });
}

// Transcodeer audio/video via ffmpeg; geeft het pad naar het resultaat.
export function transcodeAv(src, to) {
  return new Promise((resolve, reject) => {
    if (!config.ffmpegCmd) return reject(new Error('ffmpeg niet geconfigureerd (FFMPEG_CMD)'));
    const out = path.join(os.tmpdir(), 'fsconv-' + Date.now() + '.' + to);
    const [cmd, ...base] = config.ffmpegCmd.split(' ');
    execFile(cmd, [...base, '-y', '-i', src, out], { timeout: 600000 }, (err) => {
      if (err) return reject(err);
      fs.existsSync(out) ? resolve(out) : reject(new Error('Transcode leverde niets op'));
    });
  });
}
