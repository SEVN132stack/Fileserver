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
  // Permalinks: stabiele per-bestand-link (uuid -> pad).
  permalinksFile: abs(process.env.PERMALINKS_FILE || 'permalinks.json'),
  // Gedeelde bestandscommentaren (zichtbaar voor iedereen met toegang).
  commentsFile: abs(process.env.COMMENTS_FILE || 'comments.json'),
  // Manifest voor bestandsintegriteit (checksums).
  integrityFile: abs(process.env.INTEGRITY_FILE || 'integrity.json'),

  // Alerts: e-mailadres dat waarschuwingen ontvangt (leeg = alleen webhook/log).
  alertEmail: process.env.ALERT_EMAIL || process.env.NOTIFY_EMAIL || '',
  // Schijfruimte-bewaking: waarschuwen als vrije ruimte onder dit percentage komt.
  diskWarnPercent: parseInt(process.env.DISK_WARN_PERCENT || '10', 10),

  // Audit-log-rotatie: roteer als het bestand groter wordt dan N bytes; bewaar K.
  logMaxBytes: parseInt(process.env.LOG_MAX_BYTES || '5242880', 10), // 5MB
  logKeep: parseInt(process.env.LOG_KEEP || '5', 10),

  // Update-checker: GitHub-repo (owner/repo) om op nieuwe releases te controleren.
  updateRepo: process.env.UPDATE_REPO || 'SEVN132stack/Fileserver',
  updateCheck: bool(process.env.UPDATE_CHECK, true),

  // Back-up-versleuteling: wachtwoord om de ZIP met AES-256-GCM te versleutelen
  // (leeg = onversleuteld). En optioneel commando voor off-site kopie.
  backupPassword: process.env.BACKUP_PASSWORD || '',
  backupUploadCmd: process.env.BACKUP_UPLOAD_CMD || '',

  // Ransomware-detectie: alarm als één gebruiker meer dan N wijzigingen/
  // verwijderingen doet binnen het venster (ms).
  ransomware: {
    threshold: parseInt(process.env.RANSOMWARE_THRESHOLD || '50', 10),
    windowMs: parseInt(process.env.RANSOMWARE_WINDOW_MS || '60000', 10),
  },

  // 2FA/passkey afdwingen: 'off' | 'admin' | 'all'.
  requireTwoFactor: (process.env.REQUIRE_2FA || 'off').toLowerCase(),

  // Fail2ban: commando dat draait bij ban/unban (ontvangt: <ban|unban> <ip>).
  banCmd: process.env.BAN_CMD || '',

  // Geo-blokkering: toegestane landcodes (komma-gescheiden, leeg = alle). Vereist
  // dat de reverse proxy de landcode in een header zet (bijv. CF-IPCountry).
  geoAllow: (process.env.GEO_ALLOW || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
  geoHeader: (process.env.GEO_HEADER || 'cf-ipcountry').toLowerCase(),

  // SFTP: wachtwoord-authenticatie toestaan (false = alleen SSH-sleutels).
  sftpPasswordAuth: bool(process.env.SFTP_PASSWORD_AUTH, true),

  // Periodieke integriteitscontrole (uren, 0 = uit).
  integrityIntervalHours: parseInt(process.env.INTEGRITY_INTERVAL_HOURS || '0', 10),

  // Honeypot-/canary-paden (komma-gescheiden, relatief in een home). Toegang of
  // wijziging triggert direct een alarm.
  honeypots: (process.env.HONEYPOTS || '').split(',').map((s) => s.trim()).filter(Boolean),

  // SIEM: audit-regels doorsturen naar een extern log-endpoint (HTTP POST).
  siemUrl: process.env.SIEM_URL || '',

  // Wachtwoord gecompromitteerd-check via HaveIBeenPwned (k-anonymity).
  hibpCheck: bool(process.env.PASSWORD_HIBP, false),
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

  // --- v3.15 ---
  // Sessie-binding: koppel een sessie aan het IP en/of de User-Agent waarmee is
  // ingelogd. 'off' | 'ip' | 'ua' | 'both'. Voorkomt cookie-diefstal-hergebruik.
  sessionBindMode: (process.env.SESSION_BIND || 'both').toLowerCase(),
  // Step-up: gevoelige beheeracties vereisen een recente wachtwoord-herbevestiging
  // (in ms). 0 = uit.
  reauthWindowMs: parseInt(process.env.REAUTH_WINDOW_MS || '300000', 10), // 0 = uit; standaard 5 min

  // Zoekindex: omgekeerde index voor snelle bestandsnaam-/inhoudzoekacties.
  searchIndexFile: abs(process.env.SEARCH_INDEX_FILE || 'search-index.json'),
  searchIndexIntervalMinutes: parseInt(process.env.SEARCH_INDEX_INTERVAL || '0', 10), // 0 = alleen op verzoek

  // Tags/labels per bestand (voor bulk-organisatie en filteren).
  tagsFile: abs(process.env.TAGS_FILE || 'tags.json'),

  // ClamAV-onderhoud: definitie-updates (freshclam) en geplande volledige scan.
  freshclamCmd: process.env.FRESHCLAM_CMD || '',
  avScanIntervalHours: parseInt(process.env.AV_SCAN_INTERVAL_HOURS || '0', 10), // 0 = uit
  freshclamIntervalHours: parseInt(process.env.FRESHCLAM_INTERVAL_HOURS || '0', 10), // 0 = uit

  // Back-up herstel-test: ontsleutel + valideer de ZIP-structuur na elke back-up.
  backupRestoreTest: bool(process.env.BACKUP_RESTORE_TEST, false),

  // --- v3.16 ---
  // Express 'trust proxy': hoeveel/welke proxies te vertrouwen voor het bepalen
  // van het client-IP (X-Forwarded-For). Standaard '1' = alleen de directe proxy
  // (bijv. Caddy) vertrouwen — voorkomt dat een client zijn IP kan spoofen om
  // bans/rate-limiting/geo/IP-allowlist te omzeilen. Zet op 'true' als je meerdere
  // proxies hebt, of 'false' als de app direct (zonder proxy) benaderbaar is.
  trustProxy: process.env.TRUST_PROXY || '1',
  // Maximale uploadgrootte per bestand (bytes, 0 = onbeperkt). Beschermt tegen
  // schijf-vol-DoS, ook via anonieme drop-links.
  maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES || '0', 10),
  // Cookie 'Secure'-vlag forceren, ook als TLS_ENABLED=false (bijv. achter een
  // TLS-terminerende reverse proxy zoals Caddy). 'auto' = alleen bij eigen TLS.
  cookieSecure: (process.env.COOKIE_SECURE || 'auto').toLowerCase(),
  // Sessie-timeout bij inactiviteit (ms, 0 = uit; naast de vaste 12u TTL).
  idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT_MS || '0', 10),
  // Wachtwoordverval (dagen, 0 = uit) en hoeveel oude hashes onthouden (geen hergebruik).
  passwordMaxAgeDays: parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '0', 10),
  passwordHistory: parseInt(process.env.PASSWORD_HISTORY || '5', 10),
  // Toegangslog voor gedeelde bestanden (wie downloadde wat, wanneer).
  shareAccessFile: abs(process.env.SHARE_ACCESS_FILE || 'share-access.json'),
  // Watermerk op gedeelde afbeeldingen (alleen afbeeldingen; via sharp).
  watermarkShares: bool(process.env.WATERMARK_SHARES, false),
  // Bestandsvergrendeling (locks).
  locksFile: abs(process.env.LOCKS_FILE || 'locks.json'),
  // Geplande exports (rsync/rclone naar externe bestemming).
  scheduledExportsFile: abs(process.env.SCHEDULED_EXPORTS_FILE || 'scheduled-exports.json'),
  scheduledExportIntervalMinutes: parseInt(process.env.SCHEDULED_EXPORT_INTERVAL || '60', 10),
  // ffmpeg voor video-poster/audio-golfvorm (leeg = uit).
  ffmpegCmd: process.env.FFMPEG_CMD || '',
  // ACME: extern commando (certbot/acme.sh) voor TLS-certificaten + verlengen.
  acmeCmd: process.env.ACME_CMD || '',
  acmeRenewIntervalHours: parseInt(process.env.ACME_RENEW_INTERVAL_HOURS || '0', 10),
  // Config-drift: waarschuw als deze bestanden buiten de app om wijzigen.
  configDriftIntervalMinutes: parseInt(process.env.CONFIG_DRIFT_INTERVAL || '0', 10),
  // Branding (ook via admin-instellingen aanpasbaar): naam/logo/accentkleur.
  branding: {
    appName: process.env.APP_NAME || 'SFTP Fileserver',
    logoUrl: process.env.LOGO_URL || '',
    accent: process.env.ACCENT_COLOR || '',
  },

  // --- v3.17 ---
  // DLP (Data Loss Prevention): scan tekstuele uploads op gevoelige patronen
  // (BSN, creditcard, IBAN, wachtwoorden). action: 'off' | 'flag' | 'block'.
  dlp: {
    action: (process.env.DLP_ACTION || 'off').toLowerCase(), // off|flag|block
    maxBytes: parseInt(process.env.DLP_MAX_BYTES || '2097152', 10), // scan max 2MB/bestand
  },
  // Break-glass nood-admin: normaal gesproken ongebruikt; elk gebruik alarmeert
  // luid en wordt extra geaudit. Leeg = uit.
  breakglass: {
    user: process.env.BREAKGLASS_USER || '',
    password: process.env.BREAKGLASS_PASSWORD || '',
  },
  // Algemene API-rate-limiting per IP (naast de login-brute-force-bescherming).
  apiRateLimit: {
    max: parseInt(process.env.API_RATE_MAX || '0', 10), // 0 = uit
    windowMs: parseInt(process.env.API_RATE_WINDOW_MS || '60000', 10),
  },
  // Download-rate-limiting per IP (beschermt tegen scraping/afpersing).
  downloadRateLimit: {
    max: parseInt(process.env.DOWNLOAD_RATE_MAX || '0', 10), // 0 = uit
    windowMs: parseInt(process.env.DOWNLOAD_RATE_WINDOW_MS || '60000', 10),
  },
  // Inactieve accounts: markeer als "inactief" na dit aantal dagen zonder login.
  inactiveDays: parseInt(process.env.INACTIVE_DAYS || '90', 10),

  // --- v3.18 ---
  // WORM/retentie: bestanden onwijzigbaar/onverwijderbaar tot een datum.
  retentionFile: abs(process.env.RETENTION_FILE || 'retention.json'),
  // Self-destruct: bestand-vervaldata (auto-verwijderen). Scheduler-interval (min).
  expiryFile: abs(process.env.EXPIRY_FILE || 'file-expiry.json'),
  expiryIntervalMinutes: parseInt(process.env.EXPIRY_INTERVAL || '60', 10),
  // E2E-verplichte mappen: uploads moeten versleuteld (.enc) zijn.
  e2eFoldersFile: abs(process.env.E2E_FOLDERS_FILE || 'e2e-folders.json'),
  // API-keys (per gebruiker, hashed).
  apiKeysFile: abs(process.env.API_KEYS_FILE || 'api-keys.json'),
  // In-app notificaties.
  notificationsFile: abs(process.env.NOTIFICATIONS_FILE || 'notifications.json'),
  // Favorieten/recent worden in metadata resp. in-memory bijgehouden.
  // Document→PDF conversie via LibreOffice (leeg = uit). Bijv. 'soffice'.
  sofficeCmd: process.env.SOFFICE_CMD || '',
  // Wekelijks e-mailrapport naar ALERT_EMAIL (0 = uit; anders interval in uren).
  reportEmailIntervalHours: parseInt(process.env.REPORT_EMAIL_INTERVAL_HOURS || '0', 10),
  // Webhook-formaat: generic | slack | discord | teams | ntfy.
  webhookType: (process.env.WEBHOOK_TYPE || 'generic').toLowerCase(),
  // Gestructureerde JSON-logging (voor log-aggregatie/OpenTelemetry-collectors).
  logJson: bool(process.env.LOG_JSON, false),

  version: '3.18.3',

  // Standaardgebruiker, gebruikt om users.json bij de eerste start te vullen.
  auth: {
    username: process.env.AUTH_USER || 'admin',
    password: process.env.AUTH_PASS,
  },
};
