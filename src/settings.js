import fs from 'node:fs';
import { config } from './config.js';
import { markWritten } from './config-drift.js';

// Runtime-instellingen die via de admin-UI aanpasbaar zijn, als overlay op de
// .env-defaults. Geheimen blijven in .env; hier alleen bedienbare schakelaars.
const DEFAULTS = {
  maintenance: false, // onderhoudsmodus: niet-admins krijgen 503
  cleanupTrashDays: config.cleanupTrashDays,
  registrationOpen: false, // (gereserveerd) zelfregistratie
  // Globale mededeling (banner) bovenaan de UI voor alle gebruikers.
  bannerText: '',
  bannerLevel: 'info', // info | warning | critical
  // Branding (huisstijl), zichtbaar in de UI.
  appName: config.branding.appName,
  logoUrl: config.branding.logoUrl,
  accent: config.branding.accent,
  defaultStyle: 'systeem', // licht | donker | zakelijk | systeem
};

// Getypeerd schema zodat de admin-UI de instellingen dynamisch kan renderen.
// Alleen bedienbare schakelaars — geheimen blijven in .env.
const SCHEMA = [
  { key: 'maintenance', type: 'boolean', label: 'Onderhoudsmodus (alleen admins hebben toegang)' },
  { key: 'registrationOpen', type: 'boolean', label: 'Zelfregistratie toestaan' },
  { key: 'cleanupTrashDays', type: 'number', label: 'Prullenbak automatisch legen na (dagen, 0 = uit)', min: 0 },
  { key: 'bannerText', type: 'text', label: 'Mededeling (banner) — leeg = geen', max: 280 },
  { key: 'bannerLevel', type: 'enum', label: 'Banner-niveau', options: ['info', 'warning', 'critical'] },
  { key: 'appName', type: 'text', label: 'App-naam (huisstijl)', max: 60 },
  { key: 'logoUrl', type: 'text', label: 'Logo-URL', max: 500 },
  { key: 'accent', type: 'text', label: 'Accentkleur (CSS)', max: 40 },
  { key: 'defaultStyle', type: 'enum', label: 'Standaardstijl van de app (gebruikers kunnen zelf kiezen)', options: ['systeem', 'licht', 'donker', 'zakelijk'] },
];

export function settingsSchema() { return SCHEMA; }

let current = { ...DEFAULTS };

function load() {
  try {
    current = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(config.settingsFile, 'utf8')) };
  } catch {
    current = { ...DEFAULTS };
  }
}
load();

export function getSettings() {
  return { ...current };
}
export function getSetting(key) {
  return current[key];
}
// Valideer/coerce een waarde volgens het schema, zodat de UI geen ongeldige of
// te grote waarden kan opslaan.
function coerce(key, value) {
  const spec = SCHEMA.find((s) => s.key === key);
  if (!spec) return undefined;
  switch (spec.type) {
    case 'boolean': return value === true || value === 'true';
    case 'number': { const n = parseInt(value, 10); if (!Number.isFinite(n)) return DEFAULTS[key]; return Math.max(spec.min ?? 0, n); }
    case 'enum': return spec.options.includes(value) ? value : DEFAULTS[key];
    case 'text': default: return String(value ?? '').slice(0, spec.max || 500);
  }
}

export function updateSettings(patch) {
  for (const k of Object.keys(patch)) {
    if (k in DEFAULTS) { const v = coerce(k, patch[k]); if (v !== undefined) current[k] = v; }
  }
  fs.writeFileSync(config.settingsFile, JSON.stringify(current, null, 2), { mode: 0o600 });
  markWritten(config.settingsFile);
  return getSettings();
}
