import fs from 'node:fs';
import { config } from './config.js';
import { snapshot } from './metrics.js';

// Historische metrics: schrijft periodiek een momentopname van de tellers weg
// (met tijdstempel) in een ring-buffer op schijf, zodat het admin-dashboard
// grafieken over langere tijdvensters kan tonen.

let samples = [];

function load() {
  try {
    samples = JSON.parse(fs.readFileSync(config.metricsHistory.file, 'utf8'));
    if (!Array.isArray(samples)) samples = [];
  } catch {
    samples = [];
  }
}

function persist() {
  try {
    fs.writeFileSync(config.metricsHistory.file, JSON.stringify(samples));
  } catch (err) {
    console.error('[metrics-history] schrijven mislukt:', err.message);
  }
}

export function recordSample() {
  const s = snapshot();
  samples.push({ ts: Date.now(), ...s });
  if (samples.length > config.metricsHistory.keep) samples = samples.slice(-config.metricsHistory.keep);
  persist();
}

// Samples binnen de laatste `minutes` minuten (0 = alles).
export function getHistory(minutes = 0) {
  if (!minutes) return samples;
  const cutoff = Date.now() - minutes * 60000;
  return samples.filter((s) => s.ts >= cutoff);
}

export function startMetricsHistory() {
  load();
  const ms = Math.max(10, config.metricsHistory.intervalSeconds) * 1000;
  setInterval(recordSample, ms).unref();
}
