import fs from 'node:fs';
import { config } from './config.js';

// Runtime-instellingen die via de admin-UI aanpasbaar zijn, als overlay op de
// .env-defaults. Geheimen blijven in .env; hier alleen bedienbare schakelaars.
const DEFAULTS = {
  maintenance: false, // onderhoudsmodus: niet-admins krijgen 503
  cleanupTrashDays: config.cleanupTrashDays,
  registrationOpen: false, // (gereserveerd) zelfregistratie
};

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
export function updateSettings(patch) {
  for (const k of Object.keys(patch)) {
    if (k in DEFAULTS) current[k] = patch[k];
  }
  fs.writeFileSync(config.settingsFile, JSON.stringify(current, null, 2), { mode: 0o600 });
  return getSettings();
}
