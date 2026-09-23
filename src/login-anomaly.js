import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { alert } from './alerts.js';
import { audit } from './audit.js';

// Login-anomalieën (v3.43):
//  - nieuw land: inloggen vanuit een land dat nog niet bij deze gebruiker hoort;
//  - onmogelijke reis: ander land dan de vorige login binnen LOGIN_TRAVEL_HOURS;
//  - massadownload na login: > LOGIN_BURST_COUNT downloads of > LOGIN_BURST_BYTES
//    binnen LOGIN_BURST_MINUTES na een login.
// Land komt uit de GEO_HEADER (bv. cf-ipcountry van een proxy). Zonder land
// worden alleen de download-controles gedaan.

const file = () => config.loginHistoryFile;
const MAX_COUNTRIES = 50;
const bursts = new Map(); // user -> { since, count, bytes, alerted }
let listener = () => {};
export function setAnomalyListener(fn) { listener = typeof fn === 'function' ? fn : () => {}; }

function raise(user, kind, message, detail) {
  audit('security', user, 'login_anomaly', { kind, ...detail });
  alert(`login-anomaly-${kind}-${user}-${detail.country || ''}`, 'Verdachte login: ' + kind, message, { force: kind === 'onmogelijke reis' });
  try { listener({ user, kind, message, ...detail }); } catch { /* nvt */ }
}

// Aanroepen bij elke geslaagde login. Geeft de gevonden anomalieën terug.
export function onLogin(user, { ip = '', country = '', now = Date.now() } = {}) {
  const found = [];
  const all = readJson(file(), {});
  const h = all[user] || { countries: [], last: null };
  const c = String(country || '').toUpperCase().slice(0, 2);
  if (c && c !== 'XX' && c !== 'T1') {
    if (h.countries.length && !h.countries.includes(c)) {
      found.push('nieuw land');
      raise(user, 'nieuw land', `${user} logde in vanuit ${c} (nieuw; eerder: ${h.countries.join(', ')}) — IP ${ip}.`, { country: c, ip });
    }
    const travelMs = (config.loginTravelHours || 0) * 3600000;
    if (travelMs && h.last && h.last.country && h.last.country !== c && now - h.last.ts < travelMs) {
      found.push('onmogelijke reis');
      const mins = Math.round((now - h.last.ts) / 60000);
      raise(user, 'onmogelijke reis', `${user} logde in vanuit ${c}, ${mins} min na een login vanuit ${h.last.country} (${h.last.ip}) — mogelijk gestolen inloggegevens.`, { country: c, ip, previous: h.last.country, minutes: mins });
    }
    if (!h.countries.includes(c)) h.countries = [...h.countries, c].slice(-MAX_COUNTRIES);
    h.last = { country: c, ip, ts: now };
    all[user] = h;
    writeJson(file(), all);
  }
  bursts.set(user, { since: now, count: 0, bytes: 0, alerted: false });
  return found;
}

// Aanroepen bij elke download.
export function onDownload(user, bytes = 0, now = Date.now()) {
  const b = bursts.get(user);
  if (!b || b.alerted) return false;
  if (now - b.since > (config.loginBurstMinutes || 30) * 60000) { bursts.delete(user); return false; }
  b.count++; b.bytes += Number(bytes) || 0;
  const overC = config.loginBurstCount > 0 && b.count > config.loginBurstCount;
  const overB = config.loginBurstBytes > 0 && b.bytes > config.loginBurstBytes;
  if (!overC && !overB) return false;
  b.alerted = true;
  const mins = Math.max(1, Math.round((now - b.since) / 60000));
  raise(user, 'massadownload na login', `${user} downloadde ${b.count} bestanden (${(b.bytes / 1e6).toFixed(1)} MB) binnen ${mins} min na inloggen.`, { count: b.count, bytes: b.bytes });
  return true;
}

export function knownCountries(user) { return (readJson(file(), {})[user] || { countries: [] }).countries; }
