import fs from 'node:fs';
import path from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import ssh2 from 'ssh2';
import { config } from './config.js';

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
  for (const u of users.values()) {
    fs.mkdirSync(homeDir(u.username), { recursive: true });
  }
  fs.mkdirSync(config.authorizedKeysDir, { recursive: true });
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

// Mappen die met deze gebruiker gedeeld zijn: [{owner, path, label}].
export function sharedWith(username) {
  const out = [];
  for (const u of users.values()) {
    for (const s of u.shares || []) {
      if (s.to === username) {
        out.push({ owner: u.username, path: s.path, label: s.label || `${u.username}:${s.path}` });
      }
    }
  }
  return out;
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
    totp: !!u.totp,
    external: !!u.external,
    shares: u.shares || [],
  }));
}

// --- Beheerfuncties (gebruikt door CLI en admin-dashboard) ---

export function addUser({ username, password, home, role = 'user', quota = 0 }) {
  if (users.has(username)) throw new Error('Gebruiker bestaat al');
  users.set(username, {
    username,
    password: hashPassword(password),
    home: home || username,
    role,
    quota,
    totp: null,
    shares: [],
  });
  saveUsers();
  fs.mkdirSync(homeDir(username), { recursive: true });
}

export function updateUser(username, patch) {
  const u = users.get(username);
  if (!u) throw new Error('Gebruiker niet gevonden');
  if (patch.password) u.password = hashPassword(patch.password);
  if (patch.role) u.role = patch.role;
  if (patch.quota !== undefined) u.quota = patch.quota;
  if (patch.bw !== undefined) u.bw = patch.bw;
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
