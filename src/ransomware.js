import { config } from './config.js';
import { alert } from './alerts.js';

// Ransomware-/massa-wijziging-detectie: telt destructieve acties (verwijderen,
// hernoemen, overschrijven) per gebruiker binnen een tijdvenster en slaat alarm
// als de drempel wordt overschreden.
const counts = new Map(); // user -> { count, first }
const alerted = new Set();

export function recordMutation(user, action) {
  if (!user) return false;
  const now = Date.now();
  const rec = counts.get(user) || { count: 0, first: now };
  if (now - rec.first > config.ransomware.windowMs) {
    rec.count = 0;
    rec.first = now;
    alerted.delete(user);
  }
  rec.count += 1;
  counts.set(user, rec);
  if (rec.count >= config.ransomware.threshold && !alerted.has(user)) {
    alerted.add(user);
    alert(`ransomware-${user}`,
      'Mogelijk ransomware/massa-wijziging',
      `Gebruiker '${user}' voerde ${rec.count} destructieve acties uit binnen ${Math.round(config.ransomware.windowMs / 1000)}s (laatste: ${action}). Controleer direct.`,
      { force: true });
    return true;
  }
  return false;
}
