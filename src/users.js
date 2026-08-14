import fs from 'node:fs';
import path from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import ssh2 from 'ssh2';
import { config } from './config.js';
import { targetMatches } from './groups.js';
import { markWritten } from './config-drift.js';

const { parseKey } = ssh2.utils;

// Hash een wachtwoord met scrypt + willekeurige salt.
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyHash(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const calc = scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return calc.length === known.length && timingSafeEqual(calc, known);
}

let users = new Map();

function load() {
  const raw = JSON.parse(fs.readFileSync(config.usersFile, 'utf8'));
  users = new Map((raw.users || []).map((u) => [u.username, u]));
}

export function saveUsers() {
  const data = { users: [...users.values()] };
  fs.writeFileSync(config.usersFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  markWritten(config.usersFile);
}

// Maak users.json bij de eerste start op basis van de standaardgebruiker uit .env.
export function ensureUsers() {
  if (!fs.existsSync(config.usersFile)) {
    const data = {
      users: [
        {
          username: config.auth.username,
          password: hashPassword(config.auth.password),
          home: config.auth.username,
          role: 'admin',
          quota: config.defaultQuota,
          totp: null,
          shares: [],
        },
      ],
    };
    fs.writeFileSync(config.usersFile, JSON.stringify(data, null, 2), { mode: 0o600 });
    console.log(`[init] users.json aangemaakt met admin '${config.auth.username}'.`);
  }
  load();
  // Break-glass nood-admin: aanmaken/bijwerken op basis van .env. Dit account is
  // bedoeld voor noodgevallen; elk gebruik wordt luid gealarmeerd (zie web.js).
  if (config.breakglass.user && config.breakglass.password) {
    const bg = users.get(config.breakglass.user) || { username: config.breakglass.user, home: config.breakglass.user, shares: [] };
    bg.password = hashPassword(config.breakglass.password);
    bg.role = 'admin';
    bg.breakglass = true;
    bg.pwChangedAt = bg.pwChangedAt || Date.now();
    users.set(bg.username, bg);
    saveUsers();
  }
  for (const u of users.values()) {
    fs.mkdirSync(homeDir(u.username), { recursive: true });
  }
  fs.mkdirSync(config.authorizedKeysDir, { recursive: true });
}

// Is dit het break-glass nood-account?
export function isBreakglass(username) {
  const u = users.get(username);
  return !!(u && u.breakglass);
}

// Laatste login-tijd (voor het opsporen van inactieve accounts).
export function recordLogin(username) {
  const u = users.get(username);
  if (u) { u.lastLogin = Date.now(); saveUsers(); }
}
export function lastLogin(username) {
  const u = users.get(username);
  return (u && u.lastLogin) || 0;
}

export function getUser(username) {
  return users.get(username);
}

export function homeDir(username) {
  const u = users.get(username);
  const home = (u && u.home) || username;
  return path.join(config.storageDir, home);
}

export function userExists(username) {
  return users.has(username);
}

export function role(username) {
  const u = users.get(username);
  return (u && u.role) || 'user';
}

export function isAdmin(username) {
  return role(username) === 'admin';
}

export function isReadonly(username) {
  return role(username) === 'readonly';
}

export function quota(username) {
  const u = users.get(username);
  return u && typeof u.quota === 'number' ? u.quota : config.defaultQuota;
}

export function bandwidth(username) {
  const u = users.get(username);
  return u && typeof u.bw === 'number' && u.bw > 0 ? u.bw : config.defaultBandwidth;
}

// Provisioneer (indien nodig) een gebruiker die extern is geauthenticeerd (OIDC).
export function ensureExternalUser(username, email) {
  if (users.has(username)) return;
  users.set(username, {
    username, password: 'external$none', home: username, role: 'user',
    quota: config.defaultQuota, bw: 0, totp: null, shares: [], email, external: true,
  });
  saveUsers();
  fs.mkdirSync(homeDir(username), { recursive: true });
}

// Mappen die met deze gebruiker gedeeld zijn: [{owner, path, label, mode}].
// mode is 'ro' (alleen-lezen) of 'rw' (lezen + schrijven).
export function sharedWith(username) {
  const out = [];
  for (const u of users.values()) {
    if (u.username === username) continue;
    for (const s of u.shares || []) {
      if (targetMatches(s.to, username)) {
        out.push({ owner: u.username, path: s.path, label: s.label || `${u.username}:${s.path}`, mode: s.mode || 'ro' });
      }
    }
  }
  return out;
}

export function getEmail(username) {
  const u = users.get(username);
  return u && u.email ? u.email : null;
}

export function verifyPassword(username, password) {
  const u = users.get(username);
  if (!u) return false;
  return verifyHash(password, u.password);
}

export function verifyPublicKey(username, keyAlgo, keyData) {
  const file = path.join(config.authorizedKeysDir, username);
  if (!fs.existsSync(file)) return false;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  for (const line of lines) {
    const parsed = parseKey(line.trim());
    if (!parsed || parsed instanceof Error) continue;
    if (parsed.type !== keyAlgo) continue;
    const pub = parsed.getPublicSSH();
    if (pub.length === keyData.length && timingSafeEqual(pub, keyData)) return true;
  }
  return false;
}

export function listUsernames() {
  return [...users.keys()];
}

export function listUsers() {
  return [...users.values()].map((u) => ({
    username: u.username,
    home: u.home || u.username,
    role: u.role || 'user',
    quota: u.quota || 0,
    bw: u.bw || 0,
    email: u.email || '',
    totp: !!u.totp,
    external: !!u.external,
    expires: u.expires || 0,
    tenant: u.tenant || '',
    lastLogin: u.lastLogin || 0,
    breakglass: !!u.breakglass,
    shares: u.shares || [],
  }));
}

// --- Beheerfuncties (gebruikt door CLI en admin-dashboard) ---

export function addUser({ username, password, home, role = 'user', quota = 0, email = '' }) {
  if (users.has(username)) throw new Error('Gebruiker bestaat al');
  users.set(username, {
    username,
    password: hashPassword(password),
    home: home || username,
    role,
    quota,
    email,
    totp: null,
    pwChangedAt: Date.now(),
    shares: [],
  });
  saveUsers();
  fs.mkdirSync(homeDir(username), { recursive: true });
}

export function updateUser(username, patch) {
  const u = users.get(username);
  if (!u) throw new Error('Gebruiker niet gevonden');
  if (patch.password) {
    // Bewaar de oude hash in de geschiedenis (geen hergebruik) en de wijzigdatum.
    u.pwHistory = (u.pwHistory || []);
    if (u.password) u.pwHistory.push(u.password);
    if (u.pwHistory.length > config.passwordHistory) u.pwHistory = u.pwHistory.slice(-config.passwordHistory);
    u.password = hashPassword(patch.password);
    u.pwChangedAt = Date.now();
  }
  if (patch.role) u.role = patch.role;
  if (patch.email !== undefined) u.email = patch.email;
  if (patch.quota !== undefined) u.quota = patch.quota;
  if (patch.bw !== undefined) u.bw = patch.bw;
  if (patch.expires !== undefined) u.expires = patch.expires;
  if (patch.tenant !== undefined) u.tenant = patch.tenant;
  if (patch.totp !== undefined) u.totp = patch.totp;
  if (patch.shares !== undefined) u.shares = patch.shares;
  saveUsers();
}

export function deleteUser(username) {
  if (!users.delete(username)) throw new Error('Gebruiker niet gevonden');
  saveUsers();
}

export function reload() {
  load();
}

// --- Wachtwoordbeleid ---
export function validatePassword(pw) {
  const p = config.passwordPolicy;
  if (!pw || pw.length < p.minLength) return `Wachtwoord moet minstens ${p.minLength} tekens zijn`;
  if (p.requireMixed && !(/[a-zA-Z]/.test(pw) && /[0-9]/.test(pw))) return 'Wachtwoord moet letters én cijfers bevatten';
  return null;
}

// Controleer via HaveIBeenPwned (k-anonymity) of een wachtwoord in een lek
// voorkomt. Geeft het aantal keer terug (0 = niet gevonden). Faalt open bij
// netwerkproblemen.
export async function passwordPwnedCount(pw) {
  if (!config.hibpCheck) return 0;
  try {
    const sha1 = (await import('node:crypto')).createHash('sha1').update(pw).digest('hex').toUpperCase();
    const res = await fetch('https://api.pwnedpasswords.com/range/' + sha1.slice(0, 5), { headers: { 'User-Agent': 'sftp-fileserver' } });
    if (!res.ok) return 0;
    const text = await res.text();
    const suffix = sha1.slice(5);
    for (const line of text.split('\n')) {
      const [suf, cnt] = line.trim().split(':');
      if (suf === suffix) return parseInt(cnt, 10) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

// --- Wachtwoordverval & -hergebruik ---
// Moet de gebruiker het wachtwoord wijzigen (te oud)?
export function isPasswordExpired(username) {
  if (!config.passwordMaxAgeDays) return false;
  const u = users.get(username);
  if (!u) return false;
  const changed = u.pwChangedAt || 0;
  if (!changed) return false; // onbekend: niet forceren tot de eerste wijziging
  return Date.now() - changed > config.passwordMaxAgeDays * 86400000;
}
// Is het nieuwe wachtwoord gelijk aan het huidige of een recent gebruikt wachtwoord?
export function isPasswordReused(username, newPassword) {
  const u = users.get(username);
  if (!u) return false;
  const candidates = [u.password, ...(u.pwHistory || [])];
  return candidates.some((h) => h && verifyHash(newPassword, h));
}

// --- Accountvervaldatum ---
export function isExpired(username) {
  const u = users.get(username);
  return !!(u && u.expires && u.expires < Date.now());
}

// --- 2FA-herstelcodes ---
// Genereer N eenmalige herstelcodes, sla alleen de hashes op en geef de leesbare
// codes één keer terug. Bij inloggen kan een code een verloren authenticator
// vervangen; een gebruikte code vervalt.
export function generateRecoveryCodes(username, n = 10) {
  const u = users.get(username);
  if (!u) throw new Error('Gebruiker niet gevonden');
  const codes = [];
  const hashes = [];
  for (let i = 0; i < n; i++) {
    const c = randomBytes(5).toString('hex'); // 10 hex-tekens
    codes.push(c);
    hashes.push(scryptSync(c, 'recovery', 32).toString('hex'));
  }
  u.recoveryCodes = hashes;
  saveUsers();
  return codes;
}
export function recoveryCodesRemaining(username) {
  const u = users.get(username);
  return (u && u.recoveryCodes) ? u.recoveryCodes.length : 0;
}
// Verbruik een herstelcode (constant-tijd-vergelijking). true = geldig + verbruikt.
export function useRecoveryCode(username, code) {
  const u = users.get(username);
  if (!u || !u.recoveryCodes || !code) return false;
  const calc = scryptSync(String(code).trim(), 'recovery', 32);
  const idx = u.recoveryCodes.findIndex((h) => {
    const known = Buffer.from(h, 'hex');
    return known.length === calc.length && timingSafeEqual(known, calc);
  });
  if (idx < 0) return false;
  u.recoveryCodes.splice(idx, 1);
  saveUsers();
  return true;
}

// --- Accountvergrendeling (per gebruiker, in-memory) ---
const lockState = new Map(); // username -> { count, until }
export function isLocked(username) {
  const st = lockState.get(username);
  return !!(st && st.until && st.until > Date.now());
}
export function recordLoginFailure(username) {
  const st = lockState.get(username) || { count: 0, until: 0 };
  st.count += 1;
  if (st.count >= config.lockout.maxAttempts) {
    st.until = Date.now() + config.lockout.durationMs;
    st.count = 0;
  }
  lockState.set(username, st);
}
export function recordLoginSuccess(username) {
  lockState.delete(username);
}

// --- Bekende apparaten (voor nieuw-apparaat-melding) ---
export function isKnownDevice(username, deviceId) {
  const u = users.get(username);
  return !!(u && (u.devices || []).includes(deviceId));
}
export function rememberDevice(username, deviceId) {
  const u = users.get(username);
  if (!u) return;
  u.devices = u.devices || [];
  if (!u.devices.includes(deviceId)) {
    u.devices.push(deviceId);
    if (u.devices.length > 50) u.devices = u.devices.slice(-50);
    saveUsers();
  }
}

// --- Passkeys / WebAuthn-credentials ---
export function getCredentials(username) {
  const u = users.get(username);
  return (u && u.credentials) || [];
}
export function addCredential(username, cred) {
  const u = users.get(username);
  if (!u) return;
  u.credentials = u.credentials || [];
  u.credentials.push(cred);
  saveUsers();
}
export function updateCredentialCounter(username, credID, counter) {
  const u = users.get(username);
  if (!u || !u.credentials) return;
  const c = u.credentials.find((x) => x.credID === credID);
  if (c) { c.counter = counter; saveUsers(); }
}
