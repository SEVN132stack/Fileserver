import { randomBytes } from 'node:crypto';
import { config } from './config.js';

// Passwordless magic-link: een eenmalige, kortlevende token die per e-mail wordt
// verstuurd en na aanklikken een sessie aanmaakt. Tokens leven in het geheugen.

const tokens = new Map(); // token -> { user, expires }

export function createMagicToken(user) {
  const token = randomBytes(24).toString('base64url');
  tokens.set(token, { user, expires: Date.now() + config.magicLinkTtlMinutes * 60000 });
  return token;
}

// Eenmalig verbruiken; geeft de gebruikersnaam terug of null.
export function consumeMagicToken(token) {
  const rec = tokens.get(token);
  if (!rec) return null;
  tokens.delete(token);
  if (rec.expires < Date.now()) return null;
  return rec.user;
}

setInterval(() => {
  const now = Date.now();
  for (const [t, r] of tokens) if (r.expires < now) tokens.delete(t);
}, 60000).unref();
