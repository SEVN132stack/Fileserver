// Testscript voor de e-mailconfiguratie (Brevo / SMTP).
// Gebruik:  node scripts/sendmail.mjs <ontvanger> [onderwerp] [tekst]
// Leest de instellingen uit .env (SMTP_* of BREVO_API_KEY).
import { config } from '../src/config.js';
import { sendMail } from '../src/mailer.js';

const to = process.argv[2];
const subject = process.argv[3] || 'Testmail — SFTP Fileserver';
const text = process.argv[4] || 'Dit is een testmail van de SFTP Fileserver. Als je dit ontvangt, werkt de e-mailconfiguratie.';

if (!to) {
  console.error('Gebruik: node scripts/sendmail.mjs <ontvanger> [onderwerp] [tekst]');
  process.exit(1);
}

console.log('Verzendmethode :', config.brevo.apiKey ? 'Brevo API' : (config.smtp.host ? `SMTP (${config.smtp.host}:${config.smtp.port})` : 'geen — wordt gelogd'));
console.log('Afzender       :', config.brevo.apiKey ? config.brevo.from : config.smtp.from);
console.log('Ontvanger      :', to);

try {
  const res = await sendMail({ to, subject, text });
  console.log('Resultaat      :', JSON.stringify(res));
  console.log(res.sent ? '✅ Verzonden.' : 'ℹ️  Niet verzonden (zie hierboven / console-log).');
  process.exit(0);
} catch (err) {
  console.error('❌ Fout bij verzenden:', err.message);
  process.exit(1);
}
