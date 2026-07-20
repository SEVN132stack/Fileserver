'use strict';
// Client-side end-to-end-versleuteling met Web Crypto (AES-GCM).
// De server ziet alleen versleutelde bytes; de sleutel verlaat de browser nooit.
// Formaat van een versleuteld bestand: "FSE1" | salt(16) | iv(12) | ciphertext.

const MAGIC = new TextEncoder().encode('FSE1');

async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

// Versleutel een File -> Blob (met .enc-conventie door de aanroeper).
window.fseEncrypt = async function (file, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const data = new Uint8Array(await file.arrayBuffer());
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(MAGIC.length + 16 + 12 + ct.length);
  out.set(MAGIC, 0); out.set(salt, MAGIC.length); out.set(iv, MAGIC.length + 16); out.set(ct, MAGIC.length + 28);
  return new Blob([out], { type: 'application/octet-stream' });
};

// Ontsleutel een ArrayBuffer -> Uint8Array (gooit bij verkeerd wachtwoord).
window.fseDecrypt = async function (buffer, passphrase) {
  const all = new Uint8Array(buffer);
  const magic = new TextDecoder().decode(all.slice(0, 4));
  if (magic !== 'FSE1') throw new Error('Geen versleuteld FSE1-bestand');
  const salt = all.slice(4, 20), iv = all.slice(20, 32), ct = all.slice(32);
  const key = await deriveKey(passphrase, salt);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
};
