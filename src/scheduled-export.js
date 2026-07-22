import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { config } from './config.js';
import { audit } from './audit.js';
import { alert } from './alerts.js';

// Geplande/terugkerende exports: kopieer periodiek een map naar een externe
// bestemming met rsync/rclone. Elke export heeft een bron (pad in de opslag),
// een commando (bijv. "rclone copy" of "rsync -a") en een bestemming; het pad
// wordt als voorlaatste, de bestemming als laatste argument meegegeven.

function readAll() {
  try { return JSON.parse(fs.readFileSync(config.scheduledExportsFile, 'utf8')); }
  catch { return []; }
}
function writeAll(list) { fs.writeFileSync(config.scheduledExportsFile, JSON.stringify(list, null, 2), { mode: 0o600 }); }

export function listExports() { return readAll(); }

export function addExport({ label, srcPath, cmd, dest, intervalMinutes }) {
  const list = readAll();
  const id = Math.random().toString(36).slice(2, 10);
  list.push({ id, label: label || srcPath, srcPath, cmd, dest, intervalMinutes: Number(intervalMinutes) || 0, lastRun: 0, lastOk: null });
  writeAll(list);
  return id;
}
export function deleteExport(id) {
  const list = readAll().filter((e) => e.id !== id);
  writeAll(list);
  return true;
}

// Voer één export uit.
export function runExport(id) {
  return new Promise((resolve) => {
    const list = readAll();
    const e = list.find((x) => x.id === id);
    if (!e) return resolve({ ok: false, error: 'niet gevonden' });
    const abs = path.join(config.storageDir, e.srcPath.replace(/^\/+/, ''));
    const [cmd, ...args] = e.cmd.split(' ');
    execFile(cmd, [...args, abs, e.dest], { timeout: 3600000 }, (err) => {
      e.lastRun = Date.now();
      e.lastOk = !err;
      writeAll(list);
      if (err) {
        alert('export-failed-' + id, 'Geplande export mislukt', `Export '${e.label}' faalde: ${err.message}`);
        return resolve({ ok: false, error: err.message });
      }
      audit('system', null, 'scheduled_export', { id, src: e.srcPath, dest: e.dest });
      resolve({ ok: true });
    });
  });
}

export function startScheduledExports() {
  const iv = config.scheduledExportIntervalMinutes;
  if (!iv || iv <= 0) return;
  setInterval(() => {
    const now = Date.now();
    for (const e of readAll()) {
      const due = e.intervalMinutes > 0 && (now - (e.lastRun || 0)) >= e.intervalMinutes * 60000;
      if (due) runExport(e.id).catch(() => {});
    }
  }, iv * 60000).unref();
}
