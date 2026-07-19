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

// Maak users.json bij de eerste start op basis van de standaardgebruiker uit .env.
export function ensureUsers() {
  if (!fs.existsSync(config.usersFile)) {
    const data = {
      users: [
        {
          username: config.auth.username,
          password: hashPassword(config.auth.password),
          home: config.auth.username,
        },
      ],
    };
    fs.writeFileSync(config.usersFile, JSON.stringify(data, null, 2), { mode: 0o600 });
    console.log(`[init] users.json aangemaakt met gebruiker '${config.auth.username}'.`);
  }
  load();
  // Zorg dat elke home-map bestaat.
  for (const u of users.values()) {
    fs.mkdirSync(homeDir(u.username), { recursive: true });
  }
  fs.mkdirSync(config.authorizedKeysDir, { recursive: true });
}

export function homeDir(username) {
  const u = users.get(username);
  const home = (u && u.home) || username;
  return path.join(config.storageDir, home);
}

export function userExists(username) {
  return users.has(username);
}

export function verifyPassword(username, password) {
  const u = users.get(username);
  if (!u) return false;
  return verifyHash(password, u.password);
}

// Controleer of een aangeboden publieke sleutel voorkomt in de authorized_keys
// van de gebruiker (bestand authorized_keys/<gebruiker>).
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
