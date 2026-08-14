import fs from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { config } from './config.js';
import { alert } from './alerts.js';

// Certificaat-vervalbewaking: waarschuw ruim voordat het eigen TLS-certificaat
// verloopt (alleen relevant bij TLS_ENABLED; achter Caddy regelt Caddy dit zelf).

// Geef het aantal dagen tot verval terug (of null als er geen cert is).
export function daysUntilExpiry() {
  try {
    const cert = new X509Certificate(fs.readFileSync(config.tls.certPath));
    const notAfter = new Date(cert.validTo).getTime();
    return Math.floor((notAfter - Date.now()) / 86400000);
  } catch { return null; }
}

export function checkCert() {
  if (!config.tls.enabled) return { skipped: true };
  const days = daysUntilExpiry();
  if (days === null) return { error: 'geen certificaat' };
  if (days <= config.certWarnDays) {
    alert('cert-expiry', 'TLS-certificaat verloopt binnenkort',
      `Het TLS-certificaat verloopt over ${days} dag(en). Vernieuw het (of gebruik automatische verlenging).`,
      { force: days <= 3 });
  }
  return { days };
}

export function startCertMonitor() {
  if (!config.tls.enabled) return;
  checkCert();
  setInterval(() => { try { checkCert(); } catch (e) { console.error('[cert]', e.message); } }, 24 * 3600000).unref();
}
