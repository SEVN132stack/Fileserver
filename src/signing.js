import fs from 'node:fs';
import { generateKeyPairSync, sign as edSign, verify as edVerify, createHash } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { audit } from './audit.js';

// Digitale ondertekening & verificatie. De server heeft een Ed25519-sleutelpaar
// (bij de eerste keer gegenereerd, privé-sleutel op 0600). Een bestand wordt
// ondertekend door de SHA-256-hash te ondertekenen; het register bewaart wie
// wanneer wat heeft getekend, zodat handtekeningen later controleerbaar zijn.

let keys = null;
function loadKeys() {
  if (keys) return keys;
  try {
    const raw = JSON.parse(fs.readFileSync(config.signingKeyFile, 'utf8'));
    keys = { publicKey: raw.publicKey, privateKey: raw.privateKey };
  } catch {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    keys = { publicKey, privateKey };
    try { fs.writeFileSync(config.signingKeyFile, JSON.stringify(keys), { mode: 0o600 }); } catch { /* alleen in-memory */ }
  }
  return keys;
}

export function publicKeyPem() { return loadKeys().publicKey; }

function fileHash(absFile) { return createHash('sha256').update(fs.readFileSync(absFile)).digest('hex'); }

const regKey = (home, p) => `${home}|${p}`;
function readReg() { return readJson(config.signaturesFile, () => ({})); }
function writeReg(o) { writeJson(config.signaturesFile, o, { mode: 0o600 }); }

// Onderteken een bestand. Geeft de handtekening (base64) + hash terug en legt
// het vast in het register.
export function signFile(home, relPath, absFile, user) {
  const hash = fileHash(absFile);
  const signature = edSign(null, Buffer.from(hash, 'hex'), loadKeys().privateKey).toString('base64');
  const rec = { hash, signature, by: user, ts: Date.now() };
  const all = readReg();
  const k = regKey(home, relPath);
  all[k] = all[k] || [];
  all[k].push(rec);
  writeReg(all);
  audit('web', user, 'sign', { path: relPath });
  return rec;
}

export function listSignatures(home, relPath) { return readReg()[regKey(home, relPath)] || []; }

// Controleer een bestand tegen zijn handtekeningen. Geeft per handtekening of hij
// klopt én of het bestand sinds ondertekening ongewijzigd is (hash-match).
export function verifyFile(home, relPath, absFile) {
  const currentHash = fileHash(absFile);
  return listSignatures(home, relPath).map((rec) => {
    let valid = false;
    try { valid = edVerify(null, Buffer.from(rec.hash, 'hex'), loadKeys().publicKey, Buffer.from(rec.signature, 'base64')); } catch { valid = false; }
    return { by: rec.by, ts: rec.ts, valid, unchanged: rec.hash === currentHash };
  });
}
