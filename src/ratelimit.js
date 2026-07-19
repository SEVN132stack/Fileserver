import { config } from './config.js';

// Eenvoudige in-memory brute-force-bescherming. Per sleutel (bijv. IP of
// gebruikersnaam) worden mislukte pogingen geteld; na te veel pogingen binnen
// het venster volgt een tijdelijke blokkade.
const attempts = new Map();

export function checkAllowed(key) {
  const rec = attempts.get(key);
  if (!rec) return { allowed: true };
  const now = Date.now();
  if (rec.blockedUntil && rec.blockedUntil > now) {
    return { allowed: false, retryAfterMs: rec.blockedUntil - now };
  }
  return { allowed: true };
}

export function recordFailure(key) {
  const now = Date.now();
  const rec = attempts.get(key) || { count: 0, first: now, blockedUntil: 0 };
  if (now - rec.first > config.rateLimit.windowMs) {
    rec.count = 0;
    rec.first = now;
  }
  rec.count += 1;
  if (rec.count >= config.rateLimit.maxAttempts) {
    rec.blockedUntil = now + config.rateLimit.blockMs;
    rec.count = 0;
    rec.first = now;
  }
  attempts.set(key, rec);
}

export function recordSuccess(key) {
  attempts.delete(key);
}

// Ruim af en toe oude records op.
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of attempts) {
    if ((!rec.blockedUntil || rec.blockedUntil < now) && now - rec.first > config.rateLimit.windowMs) {
      attempts.delete(key);
    }
  }
}, 60000).unref();
