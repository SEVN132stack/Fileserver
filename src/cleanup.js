import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { listUsers, homeDir } from './users.js';
import { getSetting } from './settings.js';
import { audit } from './audit.js';

// Geplande opschoning: verwijder prullenbak-items ouder dan N dagen uit elke
// home-map. N komt uit de runtime-instelling (admin-UI) of de .env-default.

export function runCleanup() {
  const days = getSetting('cleanupTrashDays') || config.cleanupTrashDays;
  if (!days || days <= 0) return { removed: 0 };
  const cutoff = Date.now() - days * 86400000;
  let removed = 0;
  for (const u of listUsers()) {
    const trash = path.join(homeDir(u.username), config.trashName);
    if (!fs.existsSync(trash)) continue;
    for (const name of fs.readdirSync(trash)) {
      const full = path.join(trash, name);
      // Prullenbak-items hebben een prefix "<timestamp>_"; anders mtime gebruiken.
      const m = name.match(/^(\d+)_/);
      const ts = m ? parseInt(m[1], 10) : fs.statSync(full).mtimeMs;
      if (ts < cutoff) {
        try { fs.rmSync(full, { recursive: true, force: true }); removed++; } catch { /* negeren */ }
      }
    }
  }
  if (removed) audit('system', null, 'cleanup', { removed, days });
  return { removed };
}

export function startCleanupScheduler() {
  const ms = Math.max(1, config.cleanupIntervalHours) * 3600000;
  setInterval(() => {
    try { runCleanup(); } catch (err) { console.error('[cleanup]', err.message); }
  }, ms).unref();
}
