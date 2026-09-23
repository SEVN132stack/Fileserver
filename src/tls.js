import fs from 'node:fs';
import path from 'node:path';
import selfsigned from 'selfsigned';
import { config } from './config.js';

// Zorg dat er een TLS-certificaat is als HTTPS is ingeschakeld. Bestaat er nog
// geen, dan wordt er automatisch een self-signed certificaat gegenereerd.
// selfsigned v5 genereert asynchroon, dus dit moet vóór startWebServer() worden
// afgewacht (server.js doet dat). Geeft { cert, key } terug of null als HTTPS uit staat.
export async function prepareTls() {
  if (!config.tls.enabled) return null;
  const { certPath, keyPath } = config.tls;
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) return ensureTls();

  const attrs = [{ name: 'commonName', value: 'sftp-fileserver' }];
  const pems = await selfsigned.generate(attrs, {
    days: 3650,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }] }],
  });

  fs.mkdirSync(path.dirname(certPath), { recursive: true });
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath, pems.private, { mode: 0o600 });
  console.log(`[init] Self-signed TLS-certificaat gegenereerd: ${certPath}`);
  return { cert: pems.cert, key: pems.private };
}

// Synchroon: lees het (door prepareTls klaargezette) certificaat.
export function ensureTls() {
  if (!config.tls.enabled) return null;
  const { certPath, keyPath } = config.tls;
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    throw new Error(`TLS staat aan maar ${certPath} / ${keyPath} ontbreekt — roep eerst prepareTls() aan`);
  }
  return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
}
