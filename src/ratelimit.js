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

// Generieke sliding-window-rate-limiter (los van de brute-force-teller). Telt
// verzoeken per sleutel binnen een venster en weigert boven het maximum. Voor
// het beschermen van dure/publieke endpoints (downloads, API) tegen misbruik.
const buckets = new Map(); // key -> { count, reset }
export function rateHit(key, max, windowMs) {
  if (!max || max <= 0) return { allowed: true };
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count += 1;
  if (b.count > max) return { allowed: false, retryAfterMs: b.reset - now };
  return { allowed: true };
}

// Express-middlewarefabriek: beperk `max` verzoeken per IP per venster.
export function rateLimiter(prefix, getLimits) {
  return (req, res, next) => {
    const { max, windowMs } = getLimits();
    if (!max || max <= 0) return next();
    const ip = req.ip || req.socket.remoteAddress || 'onbekend';
    const r = rateHit(`${prefix}:${ip}`, max, windowMs);
    if (!r.allowed) {
      res.set('Retry-After', Math.ceil(r.retryAfterMs / 1000));
      return res.status(429).json({ error: 'Te veel verzoeken, probeer later opnieuw.' });
    }
    next();
  };
}

// Ruim af en toe oude records op.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 120000).unref();

setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of attempts) {
    if ((!rec.blockedUntil || rec.blockedUntil < now) && now - rec.first > config.rateLimit.windowMs) {
      attempts.delete(key);
    }
  }
}, 60000).unref();
