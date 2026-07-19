import path from 'node:path';
import fs from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { config } from './config.js';

// Zorg dat de opslagmap bestaat.
export function ensureStorage() {
  fs.mkdirSync(config.storageDir, { recursive: true });
}

// Voorkom path-traversal: een door de gebruiker aangeleverd pad wordt altijd
// binnen de opslagmap gehouden. Geeft het absolute pad terug of gooit een fout.
export function resolveSafe(userPath = '/') {
  const normalized = path.posix
    .normalize('/' + String(userPath).replace(/\\/g, '/'))
    .replace(/^\/+/, '/');
  const abs = path.join(config.storageDir, normalized);
  const rel = path.relative(config.storageDir, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Ongeldig pad');
  }
  return abs;
}

// Genereer een RSA host key als die nog niet bestaat.
export function ensureHostKey() {
  if (fs.existsSync(config.hostKeyPath)) return;
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  fs.writeFileSync(config.hostKeyPath, privateKey, { mode: 0o600 });
  console.log(`[init] Nieuwe SSH host key aangemaakt: ${config.hostKeyPath}`);
}
