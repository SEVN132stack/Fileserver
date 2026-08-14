import { config } from './config.js';
import { listUsers, homeDir, getEmail, quota } from './users.js';
import { dirSize } from './paths.js';
import { sendMail } from './mailer.js';
import { alert } from './alerts.js';

// Quota-waarschuwing: mail gebruikers wier opslaggebruik boven een drempel komt,
// zodat ze ruimte kunnen vrijmaken vóór ze tegen de limiet aanlopen.

export function checkQuotas() {
  if (!config.quotaWarnPercent || config.quotaWarnPercent <= 0) return { warned: 0 };
  let warned = 0;
  for (const u of listUsers()) {
    const q = quota(u.username);
    if (!q) continue;
    let used = 0; try { used = dirSize(homeDir(u.username)); } catch { continue; }
    const pct = (used / q) * 100;
    if (pct < config.quotaWarnPercent) continue;
    warned++;
    const to = getEmail(u.username);
    const msg = `Je opslag zit op ${pct.toFixed(0)}% (${(used / 1e9).toFixed(2)} GB van ${(q / 1e9).toFixed(2)} GB). Maak ruimte vrij om problemen te voorkomen.`;
    if (to) sendMail({ to, subject: 'Opslag bijna vol', text: msg }).catch(() => {});
    // Ook een gededupliceerd systeem-alarm (voor de beheerder / webhook).
    alert(`quota-${u.username}`, 'Gebruiker bijna over quota', `${u.username}: ${msg}`);
  }
  return { warned };
}

export function startQuotaWarnScheduler() {
  if (!config.quotaWarnPercent || config.quotaWarnPercent <= 0) return;
  setInterval(() => { try { checkQuotas(); } catch (e) { console.error('[quota-warn]', e.message); } },
    Math.max(1, config.quotaWarnIntervalHours) * 3600000).unref();
}
