import fs from 'node:fs';
import { config } from './config.js';
import { listUsers, homeDir } from './users.js';
import { dirSize } from './paths.js';
import { sendMail } from './mailer.js';
import { snapshot } from './metrics.js';
import { verifyChain } from './audit.js';

// Periodiek (bijv. wekelijks) een beknopt overzicht mailen naar ALERT_EMAIL:
// opslaggebruik, aantal gebruikers, inactieve accounts en de beveiligingsstatus.

function fmt(n) { return n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : (n / 1e6).toFixed(1) + ' MB'; }

export function buildReport() {
  const users = listUsers();
  const now = Date.now();
  let total = 0;
  const rows = users.map((u) => {
    let used = 0; try { used = dirSize(homeDir(u.username)); } catch { /* map weg */ }
    total += used;
    const inactive = u.lastLogin ? Math.floor((now - u.lastLogin) / 86400000) : null;
    return { username: u.username, used, inactive };
  }).sort((a, b) => b.used - a.used);
  const inactive = rows.filter((r) => r.inactive === null || r.inactive > config.inactiveDays);
  const chain = verifyChain();
  const m = snapshot();
  const lines = [
    `Fileserver weekrapport — ${new Date().toLocaleDateString()}`,
    ``,
    `Totale opslag: ${fmt(total)} over ${users.length} gebruiker(s).`,
    `Uploads: ${m.fileserver_uploads_total} · Downloads: ${m.fileserver_downloads_total} · Mislukte logins: ${m.fileserver_login_failures_total}`,
    `Audit-log-integriteit: ${chain.ok ? 'intact (' + chain.checked + ' regels)' : '⚠ GEBROKEN bij regel ' + chain.brokenAt}`,
    ``,
    `Grootste gebruikers:`,
    ...rows.slice(0, 10).map((r) => `  - ${r.username}: ${fmt(r.used)}`),
    ``,
    `Inactief (>${config.inactiveDays} dagen): ${inactive.map((r) => r.username).join(', ') || 'geen'}`,
  ];
  return lines.join('\n');
}

export async function sendReport() {
  if (!config.alertEmail) return { skipped: true };
  const text = buildReport();
  await sendMail({ to: config.alertEmail, subject: 'Fileserver weekrapport', text });
  return { ok: true };
}

export function startReportScheduler() {
  if (!config.reportEmailIntervalHours || config.reportEmailIntervalHours <= 0) return;
  setInterval(() => { sendReport().catch((e) => console.error('[report]', e.message)); }, config.reportEmailIntervalHours * 3600000).unref();
}
