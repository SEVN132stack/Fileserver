import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { listUsers, getEmail } from './users.js';
import { sendMail } from './mailer.js';

// Digest-notificaties: verzamel meldingen per gebruiker en verstuur periodiek
// (dagelijks/wekelijks) één samenvattings-e-mail in plaats van losse mailtjes.
// Voorkeuren en de verzamelbuffer staan in één bestand per gebruiker.

// store: { [user]: { frequency: 'off'|'daily'|'weekly', items: [{ts, text}], lastSent } }
function readAll() { return readJson(config.digestPrefsFile, () => ({})); }
function writeAll(obj) { writeJson(config.digestPrefsFile, obj, { mode: 0o600 }); }

export function getPref(user) {
  const rec = readAll()[user];
  return { frequency: (rec && rec.frequency) || 'off' };
}

export function setFrequency(user, frequency) {
  const ok = ['off', 'daily', 'weekly'].includes(frequency);
  if (!ok) throw new Error('Ongeldige frequentie');
  const all = readAll();
  all[user] = all[user] || { frequency: 'off', items: [], lastSent: 0 };
  all[user].frequency = frequency;
  writeAll(all);
  return all[user];
}

// Voeg een item aan de digest-buffer toe (alleen als de gebruiker een digest wil).
export function recordForDigest(user, text) {
  const all = readAll();
  const rec = all[user];
  if (!rec || rec.frequency === 'off') return;
  rec.items = rec.items || [];
  rec.items.push({ ts: Date.now(), text: String(text).slice(0, 300) });
  if (rec.items.length > 500) rec.items = rec.items.slice(-500);
  writeAll(all);
}

// Verstuur digests die "verschuldigd" zijn (op basis van frequentie). Geeft het
// aantal verzonden digests terug.
export async function sendDueDigests(now = Date.now()) {
  const all = readAll();
  let sent = 0;
  for (const u of listUsers()) {
    const rec = all[u.username];
    if (!rec || rec.frequency === 'off' || !(rec.items || []).length) continue;
    const periodMs = rec.frequency === 'weekly' ? 7 * 86400000 : 86400000;
    if (rec.lastSent && now - rec.lastSent < periodMs) continue;
    const to = getEmail(u.username);
    const lines = rec.items.map((i) => `• ${new Date(i.ts).toLocaleString()} — ${i.text}`).join('\n');
    const body = `Samenvatting van ${rec.items.length} gebeurtenis(sen):\n\n${lines}`;
    if (to) { try { await sendMail({ to, subject: `Je ${rec.frequency === 'weekly' ? 'wekelijkse' : 'dagelijkse'} samenvatting`, text: body }); } catch { /* mail faalt: buffer behouden */ continue; } }
    rec.items = [];
    rec.lastSent = now;
    sent++;
  }
  writeAll(all);
  return sent;
}

export function startDigestScheduler() {
  const iv = Math.max(1, config.digestIntervalHours) * 3600000;
  setInterval(() => { sendDueDigests().catch((e) => console.error('[digest]', e.message)); }, iv).unref();
}
