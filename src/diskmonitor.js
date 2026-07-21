import fs from 'node:fs';
import { config } from './config.js';
import { alert } from './alerts.js';

// Bewaak de vrije schijfruimte van de opslagmap en waarschuw onder een drempel.
export function checkDisk() {
  try {
    const st = fs.statfsSync(config.storageDir);
    const total = st.blocks * st.bsize;
    const free = st.bfree * st.bsize;
    const freePct = total > 0 ? (free / total) * 100 : 100;
    if (freePct < config.diskWarnPercent) {
      alert('disk-low', 'Schijf bijna vol',
        `Nog ${freePct.toFixed(1)}% vrij (${(free / 1e9).toFixed(1)} GB van ${(total / 1e9).toFixed(1)} GB).`);
    }
    return { total, free, freePct };
  } catch (err) {
    return { error: err.message };
  }
}

export function startDiskMonitor() {
  setInterval(checkDisk, 30 * 60 * 1000).unref(); // elk half uur
}
