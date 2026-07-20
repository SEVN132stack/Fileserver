'use strict';
// Browser-zijde E2E-sleutelbeheer.
// - Elke gebruiker heeft een RSA-OAEP-sleutelpaar. De publieke sleutel gaat naar
//   de server; de private sleutel blijft in localStorage (verlaat de browser niet).
// - Per map bestaat een AES-GCM-sleutel. Die wordt met de publieke sleutel
//   "gewrapt" en in de server-keyring bewaard. Delen = de map-sleutel wrappen met
//   de publieke sleutel van de ontvanger en in diens keyring plaatsen.

const LS = 'fse_privkey';
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function ensureKeypair() {
  let priv = localStorage.getItem(LS);
  if (priv) return;
  const kp = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['wrapKey', 'unwrapKey']);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const prv = await crypto.subtle.exportKey('jwk', kp.privateKey);
  localStorage.setItem(LS, JSON.stringify(prv));
  await fetch('/api/keys/pubkey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jwk: pub }) });
}

async function myPrivateKey() {
  const jwk = JSON.parse(localStorage.getItem(LS));
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['unwrapKey']);
}
async function pubKeyOf(user) {
  const { pubkey } = await (await fetch('/api/keys/pubkey?user=' + encodeURIComponent(user))).json();
  if (!pubkey) throw new Error('Geen publieke sleutel voor ' + user);
  return crypto.subtle.importKey('jwk', pubkey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['wrapKey']);
}

// Haal (of maak) de AES-sleutel voor een map. Retourneert een CryptoKey.
window.fseFolderKey = async function (folder) {
  await ensureKeypair();
  const { ring } = await (await fetch('/api/keyring')).json();
  if (ring[folder]) {
    const priv = await myPrivateKey();
    return crypto.subtle.unwrapKey('raw', unb64(ring[folder].wrappedKey), priv, { name: 'RSA-OAEP' }, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  // Nieuwe map-sleutel aanmaken en gewrapt opslaan.
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const myPub = await pubKeyOf(await currentUser());
  const wrapped = await crypto.subtle.wrapKey('raw', key, myPub, { name: 'RSA-OAEP' });
  await fetch('/api/keyring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder, wrappedKey: b64(wrapped) }) });
  return key;
};

// Deel de map-sleutel met een andere gebruiker.
window.fseShareFolderKey = async function (folder, toUser) {
  const key = await window.fseFolderKey(folder);
  const raw = await crypto.subtle.exportKey('raw', key);
  const imported = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  const toPub = await pubKeyOf(toUser);
  const wrapped = await crypto.subtle.wrapKey('raw', imported, toPub, { name: 'RSA-OAEP' });
  await fetch('/api/keyring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: toUser, folder, wrappedKey: b64(wrapped) }) });
};

async function currentUser() {
  return (await (await fetch('/api/whoami')).json()).user;
}

// Roteer de sleutel van een map: maak een nieuwe AES-sleutel, versleutel alle
// .enc-bestanden in de map opnieuw en sla de nieuwe (gewrapte) sleutel op.
window.fseRotateFolder = async function (folder, encFiles) {
  const oldKey = await window.fseFolderKey(folder);
  const newKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  for (const path of encFiles || []) {
    const buf = await (await fetch('/api/download?path=' + encodeURIComponent(path))).arrayBuffer();
    const plain = await window.fseDecKey(buf, oldKey);
    const reblob = await window.fseEncKey(new Blob([plain]), newKey);
    const fd = new FormData(); fd.append('files', reblob, path.split('/').pop());
    await fetch('/api/upload?path=' + encodeURIComponent(folder), { method: 'POST', body: fd });
  }
  const raw = await crypto.subtle.exportKey('raw', newKey);
  const imp = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  const myPub = await pubKeyOf(await currentUser());
  const wrapped = await crypto.subtle.wrapKey('raw', imp, myPub, { name: 'RSA-OAEP' });
  await fetch('/api/keyring/rotate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder, wrappedKey: b64(wrapped) }) });
  return true;
};

// Controleer of er map-sleutels aan rotatie toe zijn (automatische herinnering).
window.fseCheckRotation = async function () {
  try {
    const { due } = await (await fetch('/api/keyring/due')).json();
    return due || [];
  } catch { return []; }
};

// Versleutel/ontsleutel met een CryptoKey (AES-GCM). Formaat: iv(12)|ct.
window.fseEncKey = async function (file, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await file.arrayBuffer()));
  const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12);
  return new Blob([out], { type: 'application/octet-stream' });
};
window.fseDecKey = async function (buffer, key) {
  const all = new Uint8Array(buffer);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12)));
};
