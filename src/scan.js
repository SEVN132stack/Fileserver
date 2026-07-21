import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { config } from './config.js';

// Meerdere antivirus-engines met expliciete foutdetectie. Elke engine geeft:
//   { clean: true }            -> schoon
//   { clean: false, engine }   -> besmet
//   { skipped: true }          -> engine niet geconfigureerd
//   { error: true, engine }    -> kon niet scannen (onbereikbaar/niet geïnstalleerd)
//
// Beleid (zie aggregate):
//   - besmet bij één engine  -> besmet
//   - minstens één schoon     -> schoon
//   - geen enkele kon scannen -> failClosed ? besmet-geblokkeerd : schoon

function clamavCheck(filePath) {
  return new Promise((resolve) => {
    if (!config.clamscan) return resolve({ skipped: true });
    execFile(config.clamscan, ['--no-summary', filePath], { timeout: config.antivirus.timeoutMs }, (err, stdout) => {
      if (err && err.code === 1) return resolve({ clean: false, engine: 'clamav', detail: (stdout || '').trim() });
      if (err) return resolve({ error: true, engine: 'clamav', detail: err.message });
      resolve({ clean: true, engine: 'clamav' });
    });
  });
}

function vtVerdict(stats) {
  const malicious = (stats.malicious || 0) + (stats.suspicious || 0);
  if (malicious >= config.virustotal.minDetections) {
    return { clean: false, engine: 'virustotal', detail: `${malicious} engines markeren dit bestand` };
  }
  return { clean: true, engine: 'virustotal' };
}

async function virustotalCheck(filePath) {
  if (!config.virustotal.apiKey) return { skipped: true };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.antivirus.timeoutMs);
  try {
    const buf = fs.readFileSync(filePath);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const res = await fetch('https://www.virustotal.com/api/v3/files/' + sha256, {
      headers: { 'x-apikey': config.virustotal.apiKey }, signal: ctrl.signal,
    });
    if (res.ok) {
      const data = await res.json();
      return vtVerdict(data?.data?.attributes?.last_analysis_stats || {});
    }
    if (res.status === 404) {
      // Onbekend bij VT: optioneel uploaden en analyseren.
      if (config.virustotal.upload && fs.statSync(filePath).size <= config.virustotal.maxUploadBytes) {
        return await vtUploadAndPoll(buf, ctrl.signal);
      }
      return { clean: true, engine: 'virustotal' }; // legitiem onbekend
    }
    return { error: true, engine: 'virustotal', detail: 'HTTP ' + res.status };
  } catch (err) {
    return { error: true, engine: 'virustotal', detail: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function vtUploadAndPoll(buf, signal) {
  const form = new FormData();
  form.append('file', new Blob([buf]), 'upload.bin');
  const up = await fetch('https://www.virustotal.com/api/v3/files', {
    method: 'POST', headers: { 'x-apikey': config.virustotal.apiKey }, body: form, signal,
  });
  if (!up.ok) return { error: true, engine: 'virustotal', detail: 'upload HTTP ' + up.status };
  const id = (await up.json())?.data?.id;
  if (!id) return { error: true, engine: 'virustotal', detail: 'geen analyse-id' };
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const a = await fetch('https://www.virustotal.com/api/v3/analyses/' + id, { headers: { 'x-apikey': config.virustotal.apiKey } });
    if (!a.ok) continue;
    const ad = await a.json();
    if (ad?.data?.attributes?.status === 'completed') return vtVerdict(ad.data.attributes.stats || {});
  }
  return { error: true, engine: 'virustotal', detail: 'analyse niet op tijd afgerond' };
}

// Combineer de resultaten van alle engines tot één verdict.
export function aggregate(results, failClosed = config.antivirus.failClosed) {
  const infected = results.find((r) => r.clean === false);
  if (infected) return infected;
  if (results.some((r) => r.clean === true)) return { clean: true };
  const configured = results.filter((r) => !r.skipped);
  if (!configured.length) return { clean: true }; // antivirus staat uit
  // Geen enkele geconfigureerde engine kon een oordeel geven.
  if (failClosed) {
    return { clean: false, engine: 'scan-unavailable', detail: 'geen antivirus-engine kon het bestand scannen (fail-closed)' };
  }
  return { clean: true };
}

export async function scanFile(filePath) {
  const results = await Promise.all([clamavCheck(filePath), virustotalCheck(filePath)]);
  return aggregate(results);
}
