import path from 'node:path';
import { config } from './config.js';
import { alert } from './alerts.js';

// Honeypot-/canary-bestanden: bepaalde paden zijn lokaas. Toegang of wijziging
// duidt op verkenning/ransomware en triggert direct een alarm.
function isHoneypot(relPath) {
  const norm = path.posix.normalize('/' + String(relPath).replace(/^\/+/, ''));
  return config.honeypots.some((h) => {
    const hp = path.posix.normalize('/' + h.replace(/^\/+/, ''));
    return norm === hp || norm.endsWith(hp);
  });
}

export function checkHoneypot(user, relPath, action) {
  if (!config.honeypots.length) return false;
  if (isHoneypot(relPath)) {
    alert(`honeypot-${relPath}`,
      'Honeypot aangeraakt',
      `Gebruiker '${user}' deed '${action}' op lokaas-bestand '${relPath}'. Mogelijk kwaadaardige activiteit.`,
      { force: true });
    return true;
  }
  return false;
}
