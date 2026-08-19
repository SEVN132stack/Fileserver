import { execFile } from 'node:child_process';
import { config } from './config.js';

// Transcoderen op verzoek: zet een videobestand om naar een web-vriendelijk
// formaat (mp4/H.264 of webm/VP9) via ffmpeg. Alleen actief als FFMPEG_CMD is
// ingesteld; anders geeft het endpoint netjes aan dat de functie uit staat.

const VIDEO = /\.(mp4|mkv|mov|avi|webm|m4v|flv|wmv|mpe?g)$/i;
export const canTranscode = (name) => VIDEO.test(name);
export const hasFfmpeg = () => !!config.ffmpegCmd;

export const FORMATS = {
  mp4: { ext: '.mp4', args: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart'] },
  webm: { ext: '.webm', args: ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-c:a', 'libopus'] },
};

// Transcodeer srcPath naar destPath in het gekozen formaat. Rejectet als ffmpeg
// ontbreekt of faalt.
export function transcode(srcPath, destPath, format = 'mp4') {
  return new Promise((resolve, reject) => {
    if (!config.ffmpegCmd) return reject(new Error('Transcoderen staat uit (FFMPEG_CMD niet ingesteld)'));
    const fmt = FORMATS[format] || FORMATS.mp4;
    const [cmd, ...base] = config.ffmpegCmd.split(' ');
    execFile(cmd, [...base, '-y', '-i', srcPath, ...fmt.args, destPath], { timeout: 600000 }, (err) => (err ? reject(err) : resolve(destPath)));
  });
}
