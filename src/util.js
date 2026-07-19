import fs from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { config } from './config.js';

// Zorg dat de opslagmap bestaat.
export function ensureStorage() {
  fs.mkdirSync(config.storageDir, { recursive: true });
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
