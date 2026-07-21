import { randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from './config.js';

// E-mail via Brevo (API-sleutel), anders generieke SMTP (bijv. Brevo SMTP-relay).
// Zonder configuratie wordt inhoud in de console gelogd.
const tokens = new Map(); // reset-token -> { user, expires }
const TTL = 60 * 60 * 1000;

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

// Verstuur een e-mail. Volgorde: Brevo API > SMTP > console-log.
export async function sendMail({ to, subject, text }) {
  if (!to) return { sent: false, reason: 'geen ontvanger' };

  if (config.brevo.apiKey) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': config.brevo.apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: config.brevo.from, name: config.brevo.fromName },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) throw new Error('Brevo API-fout: ' + res.status + ' ' + (await res.text()));
    return { sent: true, via: 'brevo' };
  }

  const t = getTransport();
  if (t) {
    await t.sendMail({ from: config.smtp.from, to, subject, text });
    return { sent: true, via: 'smtp' };
  }

  console.log(`[mail] (niet verzonden — geen mailconfig) aan ${to}: ${subject}\n${text}`);
  return { sent: false };
}

export function createResetToken(user) {
  const token = randomBytes(24).toString('base64url');
  tokens.set(token, { user, expires: Date.now() + TTL });
  return token;
}
export function consumeResetToken(token) {
  const rec = tokens.get(token);
  if (!rec || rec.expires < Date.now()) { tokens.delete(token); return null; }
  tokens.delete(token);
  return rec.user;
}

export async function sendResetMail(email, link, username) {
  if (!email) { console.log(`[reset] Resetlink voor ${username}: ${link}`); return { sent: false }; }
  return sendMail({
    to: email,
    subject: 'Wachtwoord resetten — SFTP Fileserver',
    text: `Hallo ${username},\n\nKlik om je wachtwoord te resetten (1 uur geldig):\n${link}\n\nNiet aangevraagd? Negeer deze mail.`,
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [t, r] of tokens) if (r.expires < now) tokens.delete(t);
}, 300000).unref();
