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

  // Map voor onvoltooide, hervatbare uploads.
  chunkDir: abs(process.env.CHUNK_DIR || 'uploads-tmp'),

  // Standaard bandbreedtelimiet voor downloads (bytes/s per stream, 0 = geen).
  defaultBandwidth: parseInt(process.env.DEFAULT_BANDWIDTH || '0', 10),

  // Antivirus: pad naar clamdscan/clamscan (leeg = uit). Uploads worden dan
  // gescand; vondsten gaan in quarantaine.
  clamscan: process.env.CLAMSCAN || '',

  // VirusTotal (optioneel): hash-lookup bij upload. Bij >= minDetections
  // positieve engines wordt het bestand als besmet beschouwd. Met upload=true
  // worden onbekende bestanden geüpload en geanalyseerd.
  virustotal: {
    apiKey: process.env.VT_API_KEY || '',
    minDetections: parseInt(process.env.VT_MIN_DETECTIONS || '1', 10),
    upload: bool(process.env.VT_UPLOAD, false),
    maxUploadBytes: parseInt(process.env.VT_MAX_UPLOAD_BYTES || '33554432', 10), // 32MB VT-limiet
  },

  // Antivirus-beleid. failClosed: als GEEN enkele engine het bestand kon scannen
  // (onbereikbaar/niet geïnstalleerd), wordt de upload geweigerd i.p.v. doorgelaten.
  // timeoutMs: maximale wachttijd per engine.
  antivirus: {
    failClosed: bool(process.env.AV_FAIL_CLOSED, false),
    timeoutMs: parseInt(process.env.AV_TIMEOUT_MS || '15000', 10),
  },

  // Optioneel commando dat na elke upload draait (bijv. `aws s3 cp` voor een
  // off-site backup). Ontvangt het bestandspad als argument. Leeg = uit.
  postUploadCmd: process.env.POST_UPLOAD_CMD || '',

  // OpenID Connect (SSO). Alle vier vereist om in te schakelen.
  oidc: {
    issuer: process.env.OIDC_ISSUER || '',
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
    redirectUri: process.env.OIDC_REDIRECT_URI || '',
    get enabled() { return !!(this.issuer && this.clientId && this.clientSecret && this.redirectUri); },
  },

  // Externe basis-URL (voor reset-links in e-mails).
  appBaseUrl: process.env.APP_BASE_URL || '',

  // E-mail. Bij voorkeur via Brevo (API-sleutel), anders generieke SMTP.
  // Zonder configuratie wordt de resetlink alleen in de console gelogd.
  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    from: process.env.BREVO_FROM || process.env.SMTP_FROM || 'fileserver@localhost',
    fromName: process.env.BREVO_FROM_NAME || 'SFTP Fileserver',
  },
  smtp: {
    // Handig voor Brevo SMTP-relay: SMTP_HOST=smtp-relay.brevo.com, poort 587.
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'fileserver@localhost',
  },

  // Map voor bestanden in quarantaine (antivirus-vondsten).
  quarantineDir: abs(process.env.QUARANTINE_DIR || 'quarantine'),
  quarantineMeta: abs(process.env.QUARANTINE_META || 'quarantine.json'),

  // Versiegeschiedenis per bestand: aantal versies dat bewaard blijft (0 = uit).
  versionsName: process.env.VERSIONS_NAME || '.versions',
  keepVersions: parseInt(process.env.KEEP_VERSIONS || '10', 10),

  // E-mailadres dat notificaties ontvangt bij deel-gebeurtenissen (leeg = uit;
  // valt terug op het e-mailadres van de eigenaar).
  notifyEmail: process.env.NOTIFY_EMAIL || '',

  // Automatische E2E-sleutelrotatie: map-sleutels ouder dan dit aantal dagen
  // worden door de client geroteerd (0 = uit).
  keyRotateDays: parseInt(process.env.KEY_ROTATE_DAYS || '0', 10),

  // Prometheus-metrics op /metrics. Optioneel bearer-token.
  metrics: {
    enabled: bool(process.env.METRICS_ENABLED, true),
    token: process.env.METRICS_TOKEN || '',
  },

  // Ingebouwde back-upplanner: maakt periodiek een ZIP van de opslag en
  // bewaart de laatste N. 0 minuten = uit.
  backup: {
    intervalMinutes: parseInt(process.env.BACKUP_INTERVAL_MINUTES || '0', 10),
    dir: abs(process.env.BACKUP_DIR || 'backups'),
    keep: parseInt(process.env.BACKUP_KEEP || '7', 10),
  },

  // Cache-map voor thumbnails.
  thumbDir: abs(process.env.THUMB_DIR || 'thumbs-cache'),

  // Historische metrics: periodiek een sample wegschrijven en de laatste N bewaren.
  metricsHistory: {
    file: abs(process.env.METRICS_HISTORY_FILE || 'metrics-history.json'),
    intervalSeconds: parseInt(process.env.METRICS_HISTORY_INTERVAL || '60', 10),
    keep: parseInt(process.env.METRICS_HISTORY_KEEP || '1440', 10), // 24u bij 1/min
  },

  // E2E-keyring-bestand (publieke sleutels + gewrapte map-sleutels).
  keyringFile: abs(process.env.KEYRING_FILE || 'keyring.json'),
  // Groepen-bestand (voor delen/rechten per groep).
  groupsFile: abs(process.env.GROUPS_FILE || 'groups.json'),
  // Runtime-instellingen die via de admin-UI aanpasbaar zijn (overlay op .env).
  settingsFile: abs(process.env.SETTINGS_FILE || 'settings.json'),

  // Toegang beperken tot bepaalde IP's/CIDR's (komma-gescheiden; leeg = alles toe).
  ipAllowlist: (process.env.IP_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean),

  // Wachtwoordbeleid.
  passwordPolicy: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
    requireMixed: bool(process.env.PASSWORD_REQUIRE_MIXED, false), // letters + cijfers
  },
  // Accountvergrendeling: na N mislukte pogingen op een account, lock voor M ms.
  lockout: {
    maxAttempts: parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '10', 10),
    durationMs: parseInt(process.env.LOCKOUT_DURATION_MS || '900000', 10), // 15 min
  },

  // Geplande opschoning: prullenbak-items ouder dan N dagen verwijderen (0 = uit).
  cleanupTrashDays: parseInt(process.env.CLEANUP_TRASH_DAYS || '0', 10),
  cleanupIntervalHours: parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24', 10),

  // WebAuthn/passkeys.
  webauthn: {
    rpName: process.env.WEBAUTHN_RP_NAME || 'SFTP Fileserver',
    // rpID = domein (bijv. transfer.zepta-nas.nl); origin = volledige URL.
    rpID: process.env.WEBAUTHN_RP_ID || '',
    origin: process.env.WEBAUTHN_ORIGIN || '',
    get enabled() { return !!(this.rpID && this.origin); },
  },

  version: '3.9.0',

  // Standaardgebruiker, gebruikt om users.json bij de eerste start te vullen.
  auth: {
    username: process.env.AUTH_USER || 'admin',
    password: process.env.AUTH_PASS,
  },
};
