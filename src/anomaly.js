import { config } from './config.js';
import { alert } from './alerts.js';

// Anomalie-detectie: houd per gebruiker het downloadvolume in een voortschrijdend
// uur-venster bij en alarmeer bij ongebruikelijk veel downloads of bytes. Bedoeld
// om bulk-exfiltratie (bijv. een gecompromitteerd account) snel op te merken.

const windows = new Map(); // user -> { start, count, bytes }
const HOUR = 3600000;

export function recordDownload(user, bytes = 0) {
  if (!config.anomalyDlCount && !config.anomalyDlBytes) return; // uitgeschakeld
  const now = Date.now();
  let w = windows.get(user);
  if (!w || now - w.start >= HOUR) { w = { start: now, count: 0, bytes: 0, alerted: false }; windows.set(user, w); }
  w.count += 1;
  w.bytes += Number(bytes) || 0;
  if (w.alerted) return;
  const overCount = config.anomalyDlCount > 0 && w.count > config.anomalyDlCount;
  const overBytes = config.anomalyDlBytes > 0 && w.bytes > config.anomalyDlBytes;
  if (overCount || overBytes) {
    w.alerted = true;
    alert(`anomaly-dl-${user}`, 'Ongebruikelijk downloadvolume',
      `${user} heeft in het afgelopen uur ${w.count} downloads (${(w.bytes / 1e6).toFixed(1)} MB) gedaan — mogelijk data-exfiltratie.`,
      { force: overBytes });
  }
}

// Alleen voor tests/inspectie: het huidige venster van een gebruiker.
export function windowFor(user) { return windows.get(user) || null; }

// Periodiek opruimen van oude vensters.
setInterval(() => {
  const now = Date.now();
  for (const [u, w] of windows) if (now - w.start >= HOUR) windows.delete(u);
}, HOUR).unref();
