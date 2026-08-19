import { execFile } from 'node:child_process';
import { config } from './config.js';

// Automatische transcriptie: spraak-naar-tekst voor audio/video via een extern
// commando (bijv. whisper). Alleen actief als TRANSCRIBE_CMD is ingesteld. Het
// commando krijgt het bronbestand als laatste argument en schrijft platte tekst
// naar stdout.

const MEDIA = /\.(mp3|wav|m4a|aac|ogg|flac|mp4|mkv|mov|webm|m4v)$/i;
export const canTranscribe = (name) => !!config.transcribeCmd && MEDIA.test(name);
export const hasTranscriber = () => !!config.transcribeCmd;

// Geef de getranscribeerde tekst terug (of rejectet). Begrensd in tijd en
// uitvoergrootte om resource-uitputting te voorkomen.
export function transcribe(srcPath) {
  return new Promise((resolve, reject) => {
    if (!config.transcribeCmd) return reject(new Error('Transcriptie staat uit (TRANSCRIBE_CMD niet ingesteld)'));
    const [cmd, ...args] = config.transcribeCmd.split(' ');
    execFile(cmd, [...args, srcPath], { timeout: 600000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(String(stdout || '').trim());
    });
  });
}
