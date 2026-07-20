import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { config } from './config.js';

// Meerdere antivirus-engines. Een bestand geldt als besmet zodra één engine het
// markeert. Ondersteund: lokale ClamAV (clamdscan/clamscan) en VirusTotal
// (hash-lookup). Beide zijn optioneel; zonder configuratie is alles "schoon".

function clamavCheck(filePath) {
  return new Promise((resolve) => {
    if (!config.clamscan) return resolve({ clean: true });
    execFile(config.clamscan, ['--no-summary', filePath], (err, stdout) => {
      if (err && err.code === 1) return resolve({ clean: false, engine: 'clamav', detail: (stdout || '').trim() });
      resolve({ clean: true });
    });
  });
}

async function virustotalCheck(filePath) {
  if (!config.virustotal.apiKey) return { clean: true };
  try {
    const buf = fs.readFileSync(filePath);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const res = await fetch('https://www.virustotal.com/api/v3/files/' + sha256, {
      headers: { 'x-apikey': config.virustotal.apiKey },
    });
    if (res.status === 404) return { clean: true }; // onbekend bij VT
    if (!res.ok) return { clean: true }; // faal open bij API-problemen
    const data = await res.json();
    const stats = data?.data?.attributes?.last_analysis_stats || {};
    const malicious = (stats.malicious || 0) + (stats.suspicious || 0);
    if (malicious >= config.virustotal.minDetections) {
      return { clean: false, engine: 'virustotal', detail: `${malicious} engines markeren dit bestand` };
    }
    return { clean: true };
  } catch {
    return { clean: true };
  }
}

// Scan met alle geconfigureerde engines.
export async function scanFile(filePath) {
  const results = await Promise.all([clamavCheck(filePath), virustotalCheck(filePath)]);
  const hit = results.find((r) => !r.clean);
  return hit || { clean: true };
}
