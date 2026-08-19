import { config } from './config.js';
import { verifyLatestBackup, restoreTest } from './backup.js';
import { verify as verifyIntegrity } from './integrity.js';
import { alert } from './alerts.js';
import { audit } from './audit.js';

// Zelftest ("chaos-knop"): draai de belangrijkste continuïteitscontroles achter
// elkaar — is de nieuwste back-up geldig, laat die zich (structureel) herstellen,
// en klopt de integriteits-baseline nog? Eén samenvattend rapport; bij een
// probleem gaat er een alarm uit.

export function runSelfTest() {
  const backup = safe(verifyLatestBackup);
  const restore = safe(restoreTest);
  const integrity = safe(() => verifyIntegrity());
  const ok = !!(backup.ok !== false && restore.ok !== false && integrity && integrity.ok !== false);
  const report = { ok, ranAt: Date.now(), backup, restore, integrity };
  audit('system', null, 'selftest', { ok });
  if (!ok) {
    const failing = [!backup.ok && 'back-up', !restore.ok && 'herstel-test', integrity && integrity.ok === false && 'integriteit'].filter(Boolean).join(', ');
    alert('selftest', 'Zelftest gefaald', `De continuïteits-zelftest faalde op: ${failing}.`, { force: true });
  }
  return report;
}

function safe(fn) { try { return fn() || { ok: true }; } catch (err) { return { ok: false, error: err.message }; } }

export function startSelfTestScheduler() {
  if (!config.selfTestIntervalHours || config.selfTestIntervalHours <= 0) return;
  setInterval(() => { try { runSelfTest(); } catch (e) { console.error('[selftest]', e.message); } },
    config.selfTestIntervalHours * 3600000).unref();
}
