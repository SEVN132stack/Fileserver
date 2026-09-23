import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';

// Achtergrond-taakwachtrij met voortgang. Zware bewerkingen (grote ZIP's,
// thumbnails vooraf genereren) draaien asynchroon in plaats van een HTTP-verzoek
// minutenlang open te houden. Taken zijn per gebruiker, hebben voortgang (0-100),
// zijn annuleerbaar en hun resultaat verloopt automatisch.
//
// Taaktypes worden geregistreerd met `register(type, handler)`; een handler krijgt
// (job, ctx) waarbij ctx.progress(pct, msg), ctx.cancelled() en ctx.resultPath
// beschikbaar zijn.

const handlers = new Map();
const jobs = new Map(); // id -> job
const queue = [];
let running = 0;
let onUpdate = () => {};

const CONCURRENCY = Math.max(1, config.jobConcurrency || 2);
const MAX_PER_USER = 10;
const RESULT_TTL_MS = config.jobResultTtlMs || 3600000;

export function register(type, handler) { handlers.set(type, handler); }
export function setUpdateListener(fn) { onUpdate = typeof fn === 'function' ? fn : () => {}; }
export function resultDir() { return path.join(config.chunkDir, 'jobs'); }

const pub = (j) => ({ id: j.id, type: j.type, label: j.label, status: j.status, progress: j.progress, message: j.message, created: j.created, finished: j.finished, hasResult: !!j.resultPath && j.status === 'done', error: j.error });

function emit(j) { try { onUpdate(j.user, pub(j)); } catch { /* nvt */ } }

export function enqueue(user, type, params = {}, label = '') {
  if (!handlers.has(type)) throw new Error('Onbekend taaktype');
  const active = [...jobs.values()].filter((j) => j.user === user && (j.status === 'queued' || j.status === 'running')).length;
  if (active >= MAX_PER_USER) throw new Error('Te veel lopende taken');
  const id = randomBytes(8).toString('hex');
  const job = { id, user, type, params, label: String(label || type).slice(0, 120), status: 'queued', progress: 0, message: '', created: Date.now(), finished: 0, resultPath: null, error: null, cancel: false };
  jobs.set(id, job);
  queue.push(id);
  emit(job);
  setImmediate(pump);
  return pub(job);
}

// Eerlijke planning: kies steeds de wachtende taak van de gebruiker met de minste
// lopende taken; bij gelijkstand de gebruiker die het langst niet bediend is. Zo
// kan één gebruiker met veel taken de wachtrij niet voor anderen bezet houden.
const runningPerUser = new Map();
const lastServed = new Map();
function pickNext() {
  let best = -1; let bestKey = null;
  for (let i = 0; i < queue.length; i++) {
    const job = jobs.get(queue[i]);
    if (!job || job.status !== 'queued') { queue.splice(i, 1); i--; continue; }
    const key = [runningPerUser.get(job.user) || 0, lastServed.get(job.user) || 0, job.created];
    if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) { best = i; bestKey = key; }
  }
  if (best < 0) return null;
  return jobs.get(queue.splice(best, 1)[0]);
}
function pump() {
  while (running < CONCURRENCY && queue.length) {
    const job = pickNext();
    if (!job) break;
    running++;
    runningPerUser.set(job.user, (runningPerUser.get(job.user) || 0) + 1);
    lastServed.set(job.user, Date.now() + Math.random()); // strikt oplopend bij gelijke ms
    run(job).finally(() => {
      running--;
      runningPerUser.set(job.user, Math.max(0, (runningPerUser.get(job.user) || 1) - 1));
      setImmediate(pump);
    });
  }
}

// Alleen voor tests: registreer een eenvoudig taaktype.
export function _registerTestType(type, fn) { handlers.set(type, fn); }

async function run(job) {
  job.status = 'running'; emit(job);
  const ctx = {
    progress: (pct, msg) => {
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      if (p !== job.progress || msg) { job.progress = p; if (msg) job.message = String(msg).slice(0, 200); emit(job); }
    },
    cancelled: () => job.cancel,
    resultPath: (ext) => {
      fs.mkdirSync(resultDir(), { recursive: true });
      job.resultPath = path.join(resultDir(), job.id + (ext || ''));
      return job.resultPath;
    },
  };
  try {
    const out = await handlers.get(job.type)(job, ctx);
    if (job.cancel) { job.status = 'cancelled'; cleanupResult(job); }
    else { job.status = 'done'; job.progress = 100; if (out && out.message) job.message = String(out.message).slice(0, 200); if (out && out.filename) job.filename = out.filename; }
  } catch (err) {
    job.status = job.cancel ? 'cancelled' : 'error';
    job.error = job.cancel ? null : String(err.message || err).slice(0, 200);
    cleanupResult(job);
  }
  job.finished = Date.now();
  emit(job);
}

function cleanupResult(job) {
  if (job.resultPath) { try { fs.rmSync(job.resultPath, { force: true }); } catch { /* weg */ } job.resultPath = null; }
}

export function list(user) {
  sweep();
  return [...jobs.values()].filter((j) => j.user === user).sort((a, b) => b.created - a.created).slice(0, 50).map(pub);
}

export function get(user, id) {
  const j = jobs.get(id);
  return j && j.user === user ? j : null;
}

export function cancel(user, id) {
  const j = get(user, id);
  if (!j || (j.status !== 'queued' && j.status !== 'running')) return false;
  j.cancel = true;
  if (j.status === 'queued') { j.status = 'cancelled'; j.finished = Date.now(); emit(j); }
  return true;
}

export function remove(user, id) {
  const j = get(user, id);
  if (!j || j.status === 'running' || j.status === 'queued') return false;
  cleanupResult(j);
  jobs.delete(id);
  return true;
}

// Verwijder verlopen resultaten en oude, afgeronde taken.
export function sweep() {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (j.finished && now - j.finished > RESULT_TTL_MS) { cleanupResult(j); jobs.delete(id); }
  }
}

// Ruim bij opstart resultaten van een vorige run op (die zijn niet meer te koppelen).
export function init() {
  try { fs.rmSync(resultDir(), { recursive: true, force: true }); } catch { /* nvt */ }
  const t = setInterval(sweep, 600000); if (t.unref) t.unref();
}

// Alleen voor tests: wacht tot een taak klaar is.
export async function waitFor(id, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const j = jobs.get(id);
    if (!j || ['done', 'error', 'cancelled'].includes(j.status)) return j ? pub(j) : null;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}
