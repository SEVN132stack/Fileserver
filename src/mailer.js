import { randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from './config.js';

// Wachtwoord-reset via e-mail. Tokens leven in het geheugen met een korte TTL.
const tokens = new Map(); // token -> { user, expires }
const TTL = 60 * 60 * 1000; // 1 uur

let transport = null;
function getTransport() {
  if (transport) return transport;
  if (!config.smtp.host) return null;
  transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transport;
}

export function createResetToken(user) {
  const token = randomBytes(24).toString('base64url');
  tokens.set(token, { user, expires: Date.now() + TTL });
  return token;
}

export function consumeResetToken(token) {
  const rec = tokens.get(token);
  if (!rec || rec.expires < Date.now()) {
    tokens.delete(token);
    return null;
  }
  tokens.delete(token);
  return rec.user;
}

// Verstuur de resetlink. Zonder SMTP wordt de link in de console gelogd zodat
// het ook zonder mailserver bruikbaar is (ontwikkeling/klein gebruik).
export async function sendResetMail(email, link, username) {
  const t = getTransport();
  if (!t || !email) {
    console.log(`[reset] Resetlink voor ${username}: ${link}`);
    return { sent: false };
  }
  await t.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Wachtwoord resetten — SFTP Fileserver',
    text: `Hallo ${username},\n\nKlik op de volgende link om je wachtwoord te resetten (1 uur geldig):\n${link}\n\nAls je dit niet hebt aangevraagd, kun je deze mail negeren.`,
  });
  return { sent: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [t, r] of tokens) if (r.expires < now) tokens.delete(t);
}, 300000).unref();
