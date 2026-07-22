import { execFile } from 'node:child_process';
import { config } from './config.js';
import { audit } from './audit.js';
import { alert } from './alerts.js';

// Automatische TLS-certificaten via een extern ACME-programma (certbot of
// acme.sh). We schrijven geen eigen ACME-implementatie; in plaats daarvan roept
// deze module een beproefd commando aan om certificaten op te halen/te verlengen.
// Voorbeeld: ACME_CMD="certbot renew --quiet". Na afloop moet de reverse proxy /
// het proces het nieuwe certificaat oppikken (bijv. via TLS_CERT/TLS_KEY).

export function runAcme() {
  return new Promise((resolve) => {
    if (!config.acmeCmd) return resolve({ skipped: true });
    const [cmd, ...args] = config.acmeCmd.split(' ');
    execFile(cmd, args, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        alert('acme-failed', 'TLS-certificaat verlengen mislukt', err.message);
        return resolve({ ok: false, error: err.message });
      }
      audit('system', null, 'acme_renew', { ok: true });
      resolve({ ok: true, output: (stdout || stderr || '').slice(-500) });
    });
  });
}

export function startAcmeScheduler() {
  if (!config.acmeCmd || !config.acmeRenewIntervalHours || config.acmeRenewIntervalHours <= 0) return;
  // Direct bij start één keer proberen, daarna periodiek.
  runAcme().catch(() => {});
  setInterval(() => { runAcme().catch(() => {}); }, config.acmeRenewIntervalHours * 3600000).unref();
}
