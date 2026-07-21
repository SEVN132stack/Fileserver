import { config } from './config.js';
import { notify } from './notify.js';
import { sendMail } from './mailer.js';
import { audit } from './audit.js';

// Centrale alert-functie: logt, stuurt een webhook en (indien ingesteld) een
// e-mail. Dedupliceert dezelfde sleutel binnen een venster zodat je niet
// overspoeld wordt.
const lastSent = new Map();
const DEDUP_MS = 60 * 60 * 1000; // 1 uur

export function alert(key, subject, message, { force = false } = {}) {
  const now = Date.now();
  if (!force && lastSent.get(key) && now - lastSent.get(key) < DEDUP_MS) return;
  lastSent.set(key, now);

  console.warn(`[alert] ${subject}: ${message}`);
  audit('system', null, 'alert', { key, subject });
  notify('alert', { key, subject, message });
  if (config.alertEmail) {
    sendMail({ to: config.alertEmail, subject: `[Fileserver] ${subject}`, text: message })
      .catch((e) => console.error('[alert-mail]', e.message));
  }
}
