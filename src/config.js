import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.js';

// Laad .env voordat er ook maar iets uit process.env wordt gelezen, zodat
// wachtwoorden en keys altijd uit .env komen en nooit uit de broncode.
loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const bool = (v, def = false) =>
  v === undefined ? def : ['1', 'true', 'yes', 'ja', 'on'].includes(String(v).toLowerCase());
const abs = (p) => (path.isAbsolute(p) ? p : path.join(rootDir, p));

if (!process.env.AUTH_PASS) {
  console.error('[fout] AUTH_PASS ontbreekt. Zet het in .env (zie .env.example).');
  process.exit(1);
}

// Alle bestanden worden opgeslagen in deze map. Zowel de SFTP-server als de
// web UI werken op exact dezelfde opslag, zodat wat je via SFTP uploadt ook
// zichtbaar is in de browser en andersom. Elke gebruiker heeft een eigen
// submap (home) binnen deze opslag.
export const config = {
  rootDir,
  storageDir: abs(process.env.STORAGE_DIR || 'storage'),
  hostKeyPath: abs(process.env.HOST_KEY_PATH || 'host.key'),
  // Bestand met gebruikers (gehashte wachtwoorden). Nooit in git.
  usersFile: abs(process.env.USERS_FILE || 'users.json'),
  // Map met per-gebruiker SSH publieke sleutels (authorized_keys).
  authorizedKeysDir: abs(process.env.AUTHORIZED_KEYS_DIR || 'authorized_keys'),
  // Audit-logbestand.
  auditLog: abs(process.env.AUDIT_LOG || 'audit.log'),

  web: {
    port: parseInt(process.env.WEB_PORT || '8080', 10),
    host: process.env.WEB_HOST || '0.0.0.0',
  },

  sftp: {
    port: parseInt(process.env.SFTP_PORT || '2222', 10),
    host: process.env.SFTP_HOST || '0.0.0.0',
  },

  // HTTPS voor de web UI. Als ingeschakeld en er geen cert bestaat, wordt er
  // automatisch een self-signed certificaat gegenereerd.
  tls: {
    enabled: bool(process.env.TLS_ENABLED, false),
    certPath: abs(process.env.TLS_CERT || 'tls/cert.pem'),
    keyPath: abs(process.env.TLS_KEY || 'tls/key.pem'),
  },

  // Brute-force-bescherming: max mislukte pogingen per IP/gebruiker binnen het
  // venster; daarna tijdelijk geblokkeerd.
  rateLimit: {
    maxAttempts: parseInt(process.env.RATE_MAX_ATTEMPTS || '5', 10),
    windowMs: parseInt(process.env.RATE_WINDOW_MS || '60000', 10),
    blockMs: parseInt(process.env.RATE_BLOCK_MS || '300000', 10),
  },

  // Bestand met persistente IP-bans.
  bansFile: abs(process.env.BANS_FILE || 'bans.json'),
  // Bestand met publieke deel-links.
  sharesFile: abs(process.env.SHARES_FILE || 'shares.json'),
  // Prullenbak-map (binnen elke home). Verwijderde bestanden gaan hierheen.
  trashName: process.env.TRASH_NAME || '.trash',
  // Opslagquota per gebruiker in bytes (0 = onbeperkt).
  defaultQuota: parseInt(process.env.DEFAULT_QUOTA || '0', 10),

  // Sessie-geheim (voor cookie-ondertekening). Uit .env; anders vluchtig.
  sessionSecret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),

  // WebDAV-endpoint aan/uit (op /webdav).
  webdavEnabled: bool(process.env.WEBDAV_ENABLED, true),

  // Webhook-URL voor notificaties bij gebeurtenissen (leeg = uit).
  webhookUrl: process.env.WEBHOOK_URL || '',

  // Standaardgebruiker, gebruikt om users.json bij de eerste start te vullen.
  auth: {
    username: process.env.AUTH_USER || 'admin',
    password: process.env.AUTH_PASS,
  },
};
