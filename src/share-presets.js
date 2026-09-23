import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';

// Herbruikbare profielen voor deel-links (bijv. "Klant — 7 dagen, 5 downloads,
// wachtwoord"). Een preset bevat nooit een wachtwoord in platte tekst: met
// `autoPassword` wordt per aangemaakte link een willekeurig wachtwoord gegenereerd
// dat één keer aan de maker wordt getoond.

function readAll() { return readJson(config.sharePresetsFile, () => ({})); }
function writeAll(obj) { writeJson(config.sharePresetsFile, obj, { mode: 0o600 }); }

const num = (v, max) => Math.min(max, Math.max(0, parseInt(v, 10) || 0));

export function listPresets(user) { return readAll()[user] || []; }
export function getPreset(user, id) { return listPresets(user).find((p) => p.id === id) || null; }

export function addPreset(user, { name, expiresInHours = 0, maxDownloads = 0, maxKbps = 0, autoPassword = false }) {
  if (!name) throw new Error('Naam verplicht');
  const all = readAll();
  const list = all[user] || [];
  if (list.length >= 50) throw new Error('Maximaal 50 presets');
  const preset = {
    id: randomBytes(5).toString('hex'),
    name: String(name).slice(0, 60),
    expiresInHours: num(expiresInHours, 24 * 365),
    maxDownloads: num(maxDownloads, 100000),
    maxKbps: num(maxKbps, 10000000),
    autoPassword: !!autoPassword,
  };
  list.push(preset);
  all[user] = list;
  writeAll(all);
  return preset;
}

export function deletePreset(user, id) {
  const all = readAll();
  const list = all[user] || [];
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  all[user] = next;
  writeAll(all);
  return true;
}

// Genereer een leesbaar maar sterk wachtwoord voor een link.
export function generatePassword() { return randomBytes(12).toString('base64url'); }
