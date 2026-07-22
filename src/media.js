import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { config } from './config.js';

// Video-posterframes en audio-golfvormen via ffmpeg (optioneel; alleen als
// FFMPEG_CMD is ingesteld). Resultaten worden in de thumbnail-cache bewaard.

const VIDEO = /\.(mp4|webm|mov|mkv|avi|m4v)$/i;
const AUDIO = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;
export const canPoster = (name) => VIDEO.test(name);
export const canWaveform = (name) => AUDIO.test(name);
export const hasFfmpeg = () => !!config.ffmpegCmd;

function cachePath(srcPath, suffix) {
  const key = Buffer.from(srcPath).toString('base64url').slice(0, 40);
  return path.join(config.thumbDir, key + suffix);
}

function run(args) {
  return new Promise((resolve, reject) => {
    const [cmd, ...base] = config.ffmpegCmd.split(' ');
    execFile(cmd, [...base, ...args], { timeout: 60000 }, (err) => (err ? reject(err) : resolve()));
  });
}

// Genereer (of hergebruik) een posterframe (JPEG) op ~1s in de video.
export async function videoPoster(srcPath) {
  if (!config.ffmpegCmd) return null;
  const out = cachePath(srcPath, '.poster.jpg');
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(config.thumbDir, { recursive: true });
  await run(['-y', '-ss', '1', '-i', srcPath, '-frames:v', '1', '-vf', 'scale=320:-1', out]);
  return fs.existsSync(out) ? out : null;
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
