import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { config } from './config.js';
import { alert } from './alerts.js';

// Config-drift-detectie: waarschuw als gevoelige databestanden (gebruikers,
// instellingen, deel-links, bans) buiten de app om zijn gewijzigd — een teken
// van handmatig geknoei of een inbreuk. De app roept markWritten() aan wanneer
// hij zo'n bestand zelf schrijft, zodat legitieme wijzigingen geen vals alarm geven.

const expected = new Map(); // pad -> hash

function hashFile(file) {
  try { return createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
  catch { return ''; }
}

function watched() {
  return [config.usersFile, config.settingsFile, config.sharesFile, config.bansFile];
}

// Registreer dat de app dit bestand zojuist (legitiem) heeft geschreven.
export function markWritten(file) {
  expected.set(file, hashFile(file));
}

// Leg de huidige toestand vast als baseline.
export function baseline() {
  for (const f of watched()) expected.set(f, hashFile(f));
}

// Controleer alle bewaakte bestanden tegen de verwachte hash.
export function check() {
  const drifted = [];
  for (const f of watched()) {
    const cur = hashFile(f);
    const exp = expected.get(f);
    if (exp === undefined) { expected.set(f, cur); continue; }
    if (cur !== exp) {
      drifted.push(f);
      expected.set(f, cur); // opnieuw ijken zodat je niet blijft alarmeren
    }
  }
  if (drifted.length) {
    alert('config-drift', 'Configuratie buiten de app om gewijzigd',
      `Deze bestanden zijn gewijzigd zonder dat de applicatie ze schreef: ${drifted.join(', ')}. Controleer op ongewenste toegang.`,
      { force: true });
  }
  return { drifted };
}

export function startConfigDriftMonitor() {
  if (!config.configDriftIntervalMinutes || config.configDriftIntervalMinutes <= 0) return;
  baseline();
  setInterval(() => {
    try { check(); } catch (err) { console.error('[config-drift]', err.message); }
  }, config.configDriftIntervalMinutes * 60000).unref();
}
