import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { resolveWithin } from './paths.js';
import { homeDir } from './users.js';
import { retainedUntil } from './retention.js';
import { audit } from './audit.js';

// Per-gebruiker geplande taken: elke gebruiker kan zelf terugkerende opschoon-
// taken instellen binnen zijn eigen opslag. Types:
//  - 'cleanup'     : verwijder bestanden in een map ouder dan N dagen
//  - 'empty-trash' : leeg de eigen prullenbak
// Taken draaien alleen binnen de eigen home (resolveWithin) en respecteren WORM.

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.userTasksFile, 'utf8')); }
  catch { return []; }
}
function writeAll(list) { fs.writeFileSync(config.userTasksFile, JSON.stringify(list), { mode: 0o600 }); }

export function listTasks(user) {
  return readAll().filter((t) => t.user === user);
}

export function addTask(user, { type, path: p = '/', olderThanDays = 30, intervalHours = 24 }) {
  if (!['cleanup', 'empty-trash'].includes(type)) throw new Error('Onbekend taaktype');
  const list = readAll();
  const task = {
    id: randomBytes(6).toString('hex'), user, type, path: p,
    olderThanDays: Math.max(0, Number(olderThanDays) || 0),
    intervalHours: Math.max(1, Number(intervalHours) || 24),
    lastRun: 0, created: Date.now(),
  };
  list.push(task);
  writeAll(list);
  return task;
}

export function deleteTask(user, id) {
  const list = readAll();
  const next = list.filter((t) => !(t.id === id && t.user === user));
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

// Voer één taak uit. Geeft het aantal verwijderde items terug.
export function runTask(task) {
  const home = homeDir(task.user);
  let removed = 0;
  const cutoff = Date.now() - task.olderThanDays * 86400000;
  const cleanupDir = (dir, respectAge) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      let st; try { st = fs.statSync(full); } catch { continue; }
      const rel = '/' + path.relative(home, full).split(path.sep).join('/');
      if (retainedUntil(home, rel)) continue; // WORM: nooit auto-verwijderen
      if (!respectAge || st.mtimeMs < cutoff) {
        try { fs.rmSync(full, { recursive: true, force: true }); removed++; } catch { /* skip */ }
      }
    }
  };
  try {
    if (task.type === 'empty-trash') {
      cleanupDir(path.join(home, config.trashName), false);
    } else {
      const dir = resolveWithin(home, task.path || '/');
      cleanupDir(dir, true);
    }
  } catch { /* ongeldig pad */ }
  if (removed) audit('system', task.user, 'user_task_run', { type: task.type, path: task.path, removed });
  return removed;
}

export function startUserTasksScheduler() {
  const iv = config.userTasksIntervalMinutes;
  if (!iv || iv <= 0) return;
  setInterval(() => {
    const now = Date.now();
    const list = readAll();
    let changed = false;
    for (const t of list) {
      if (now - (t.lastRun || 0) < t.intervalHours * 3600000) continue;
      try { runTask(t); } catch (e) { console.error('[user-task]', e.message); }
      t.lastRun = now; changed = true;
    }
    if (changed) writeAll(list);
  }, iv * 60000).unref();
}
