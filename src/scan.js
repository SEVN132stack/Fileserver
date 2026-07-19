import { execFile } from 'node:child_process';
import { config } from './config.js';

// Scan een bestand met ClamAV (clamdscan/clamscan) als dat is geconfigureerd.
// Geeft { clean: true } terug als er niets is ingesteld of het bestand schoon is,
// of { clean: false, detail } bij een vondst.
export function scanFile(filePath) {
  return new Promise((resolve) => {
    if (!config.clamscan) return resolve({ clean: true });
    execFile(config.clamscan, ['--no-summary', filePath], (err, stdout) => {
      // clamscan geeft exitcode 1 bij een vondst, 0 bij schoon, 2 bij fout.
      if (err && err.code === 1) return resolve({ clean: false, detail: (stdout || '').trim() });
      resolve({ clean: true });
    });
  });
}
