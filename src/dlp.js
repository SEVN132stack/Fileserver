import fs from 'node:fs';
import { config } from './config.js';

// DLP (Data Loss Prevention): controleer tekstuele uploads op gevoelige gegevens
// zoals BSN's, creditcardnummers, IBAN's en wachtwoorden-in-klare-tekst. Afhankelijk
// van DLP_ACTION wordt de upload geblokkeerd of alleen gemarkeerd (met alarm).

const TEXT_EXT = /\.(txt|md|csv|log|json|xml|html?|ya?ml|ini|conf|sql|env|tsv|rtf)$/i;

// Elfproef voor een Nederlands BSN (9 cijfers).
function isValidBsn(digits) {
  if (!/^\d{9}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += parseInt(digits[i], 10) * (9 - i);
  sum -= parseInt(digits[8], 10);
  return sum % 11 === 0;
}

// Luhn-check voor creditcardnummers.
function isValidLuhn(number) {
  const d = number.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(d)) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

const DETECTORS = [
  { type: 'bsn', re: /\b\d{9}\b/g, validate: isValidBsn },
  { type: 'creditcard', re: /\b(?:\d[ -]*?){13,19}\b/g, validate: isValidLuhn },
  { type: 'iban', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, validate: (m) => /^NL\d{2}[A-Z]{4}\d{10}$/.test(m.replace(/\s/g, '')) || /^[A-Z]{2}\d{2}/.test(m) },
  { type: 'wachtwoord', re: /(?:password|wachtwoord|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*\S{4,}/gi, validate: () => true },
];

// Scan een tekstblok en geef de gevonden gevoelige typen terug (met aantallen).
export function scanText(text) {
  const findings = {};
  for (const det of DETECTORS) {
    const matches = text.match(det.re) || [];
    let count = 0;
    for (const m of matches) {
      if (det.validate(det.type === 'creditcard' ? m : m.trim())) count++;
    }
    if (count > 0) findings[det.type] = count;
  }
  return findings;
}

// Scan een bestand op schijf (alleen tekstbestanden tot DLP_MAX_BYTES).
// Geeft { hits: {type:count}, types: [...] } of null als er niets/niet van
// toepassing is.
export function scanFileForDlp(filePath, originalName) {
  if (config.dlp.action === 'off') return null;
  if (!TEXT_EXT.test(originalName || filePath)) return null;
  let text;
  try {
    if (fs.statSync(filePath).size > config.dlp.maxBytes) return null;
    text = fs.readFileSync(filePath, 'utf8');
  } catch { return null; }
  const hits = scanText(text);
  const types = Object.keys(hits);
  if (!types.length) return null;
  return { hits, types };
}
