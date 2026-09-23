import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { homeDir } from './users.js';
import { resolveWithin } from './paths.js';
import { sendMail } from './mailer.js';
import { buildReport } from './report-email.js';
import * as sla from './sla.js';
import { audit } from './audit.js';

// Geplande rapporten: een admin definieert rapport-taken (type + cadans +
// bestemming). Een scheduler draait due taken en levert het rapport per e-mail
// of als tekstbestand in de Rapporten-map van de eigenaar.

const TYPES = ['overview', 'sla'];
const CADENCE = { daily: 86400000, weekly: 604800000, monthly: 2592000000 };
const DEST = ['email', 'folder'];

function readAll() { return readJson(config.scheduledReportsFile, () => []); }
function writeAll(list) { writeJson(config.scheduledReportsFile, list, { mode: 0o600 }); }

export function listReports() { return readAll(); }

export function addReport({ type, cadence, dest, target = '' }, owner) {
  if (!TYPES.includes(type)) throw new Error('Onbekend rapporttype');
  if (!CADENCE[cadence]) throw new Error('Onbekende cadans');
  if (!DEST.includes(dest)) throw new Error('Onbekende bestemming');
  const list = readAll();
  const job = { id: randomBytes(5).toString('hex'), type, cadence, dest, target: String(target).slice(0, 200), owner, created: Date.now(), lastRun: 0 };
  list.push(job);
  writeAll(list);
  return job;
}

export function deleteReport(id) {
  const list = readAll();
  const next = list.filter((r) => r.id !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

// Stel de rapporttekst samen voor een type.
export function renderReport(type) {
  if (type === 'sla') {
    const s = sla.compute(30);
    return [
      `Beschikbaarheidsrapport (30 dagen) — ${new Date().toLocaleDateString()}`,
      ``,
      `Uptime: ${s.uptimePct.toFixed(3)}%`,
      `Open incidenten: ${s.openIncidents}`,
      `Opgelost (30d): ${s.resolvedCount}`,
      `MTTR: ${s.mttrMs ? (s.mttrMs / 3600000).toFixed(1) + ' uur' : '—'}`,
      `Incidenten per severity: ${Object.entries(s.bySeverity).map(([k, v]) => `${k}=${v}`).join(', ') || 'geen'}`,
    ].join('\n');
  }
  return buildReport(); // 'overview'
}

// Voer één rapport-taak uit (ongeacht of hij due is). Retourneert het resultaat.
export async function runReport(job) {
  const text = renderReport(job.type);
  const subject = `Fileserver-rapport: ${job.type}`;
  if (job.dest === 'email') {
    const to = job.target || config.alertEmail;
    if (!to) return { skipped: 'geen ontvanger' };
    await sendMail({ to, subject, text });
  } else {
    const dir = resolveWithin(homeDir(job.owner), '/' + config.scheduledReportsDir);
    fs.mkdirSync(dir, { recursive: true });
    const name = `${job.type}-${new Date().toISOString().slice(0, 10)}-${randomBytes(2).toString('hex')}.txt`;
    fs.writeFileSync(path.join(dir, name), text);
  }
  // lastRun bijwerken.
  const list = readAll();
  const j = list.find((r) => r.id === job.id);
  if (j) { j.lastRun = Date.now(); writeAll(list); }
  audit('report', job.owner, 'scheduled_report_run', { id: job.id, type: job.type, dest: job.dest });
  return { ok: true };
}

// Scheduler: draai due taken (cadans verstreken sinds lastRun).
export function startScheduler() {
  const tick = async () => {
    const now = Date.now();
    for (const job of readAll()) {
      if (now - (job.lastRun || 0) >= CADENCE[job.cadence]) {
        try { await runReport(job); } catch (e) { console.error('[scheduled-report]', e.message); }
      }
    }
  };
  const t = setInterval(tick, 3600000); // elk uur controleren
  if (t.unref) t.unref();
}
