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
    if (res.ok) {
      const data = await res.json();
      return vtVerdict(data?.data?.attributes?.last_analysis_stats || {});
    }
    if (res.status !== 404) return { clean: true }; // faal open bij API-problemen
    // Onbekend bij VT: optioneel uploaden en analyseren.
    if (config.virustotal.upload && buf.length <= config.virustotal.maxUploadBytes) {
      return await vtUploadAndPoll(buf);
    }
    return { clean: true };
  } catch {
    return { clean: true };
  }
}

function vtVerdict(stats) {
  const malicious = (stats.malicious || 0) + (stats.suspicious || 0);
  if (malicious >= config.virustotal.minDetections) {
    return { clean: false, engine: 'virustotal', detail: `${malicious} engines markeren dit bestand` };
  }
  return { clean: true };
}

// Upload een onbekend bestand naar VirusTotal en pol de analyse.
async function vtUploadAndPoll(buf) {
  const form = new FormData();
  form.append('file', new Blob([buf]), 'upload.bin');
  const up = await fetch('https://www.virustotal.com/api/v3/files', {
    method: 'POST', headers: { 'x-apikey': config.virustotal.apiKey }, body: form,
  });
  if (!up.ok) return { clean: true };
  const id = (await up.json())?.data?.id;
  if (!id) return { clean: true };
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const a = await fetch('https://www.virustotal.com/api/v3/analyses/' + id, { headers: { 'x-apikey': config.virustotal.apiKey } });
    if (!a.ok) continue;
    const ad = await a.json();
    if (ad?.data?.attributes?.status === 'completed') {
      return vtVerdict(ad.data.attributes.stats || {});
    }
  }
  return { clean: true }; // nog niet klaar: faal open
}

// Scan met alle geconfigureerde engines.
export async function scanFile(filePath) {
  const results = await Promise.all([clamavCheck(filePath), virustotalCheck(filePath)]);
  const hit = results.find((r) => !r.clean);
  return hit || { clean: true };
}
