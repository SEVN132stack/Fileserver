import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envPath = process.env.ENV_FILE || path.join(rootDir, '.env');

// Zorgt dat er altijd een .env bestaat met inloggegevens. Bij de allereerste
// start (geen .env aanwezig) wordt er automatisch een sterk, willekeurig
// wachtwoord gegenereerd en weggeschreven, zodat wachtwoorden en keys nooit
// hardcoded in de broncode staan maar altijd in .env leven.
function ensureEnvFile() {
  if (fs.existsSync(envPath)) return false;
  const password = randomBytes(18).toString('base64url');
  const sessionSecret = randomBytes(32).toString('base64url');
  const contents = `# Automatisch gegenereerd bij de eerste start.
# Alle geheimen (wachtwoorden, keys) horen hier — nooit in de broncode.

# Inloggegevens voor zowel SFTP als de web UI.
AUTH_USER=admin
AUTH_PASS=${password}

# Geheim voor het ondertekenen van sessie-cookies.
SESSION_SECRET=${sessionSecret}

# Netwerkpoorten en -interfaces.
WEB_PORT=8080
WEB_HOST=0.0.0.0
SFTP_PORT=2222
SFTP_HOST=0.0.0.0

# Opslag en SSH host key.
STORAGE_DIR=./storage
HOST_KEY_PATH=./host.key
`;
  fs.writeFileSync(envPath, contents, { mode: 0o600 });
  console.log(`[init] Nieuw .env-bestand aangemaakt met een willekeurig wachtwoord: ${envPath}`);
  console.log(`[init] Wachtwoord voor gebruiker 'admin': ${password}`);
  return true;
}

// Geheimen die uit een bestand (Docker/Podman secrets, Kubernetes, HashiCorp
// Vault-agent, systemd LoadCredential) geladen mogen worden i.p.v. uit .env.
// Beperkt tot een vaste lijst zodat de `_FILE`-conventie niet botst met de
// bestaande pad-instellingen (USERS_FILE, BANS_FILE, ...) die géén geheimen zijn.
const SECRET_VARS = [
  'AUTH_PASS', 'SESSION_SECRET', 'SMTP_PASS', 'SMTP_USER', 'BREVO_API_KEY',
  'VT_API_KEY', 'BACKUP_PASSWORD', 'METRICS_TOKEN', 'OIDC_CLIENT_SECRET',
];

// Los bestand-gebaseerde geheimen op. Voor `<SECRET>_FILE` wordt de inhoud als
// `<SECRET>` in process.env gezet; ook de systemd $CREDENTIALS_DIRECTORY wordt
// doorzocht op een bestand met de naam van het geheim.
export function resolveFileSecrets() {
  const credDir = process.env.CREDENTIALS_DIRECTORY; // door systemd gezet
  for (const name of SECRET_VARS) {
    // 1. Expliciete <SECRET>_FILE-verwijzing.
    const fileRef = process.env[name + '_FILE'];
    if (fileRef) {
      try { process.env[name] = fs.readFileSync(fileRef, 'utf8').replace(/\r?\n$/, ''); }
      catch (err) { console.error(`[secrets] kon ${name}_FILE niet lezen (${fileRef}): ${err.message}`); }
      continue;
    }
    // 2. systemd-credential met dezelfde naam.
    if (credDir && process.env[name] === undefined) {
      try { process.env[name] = fs.readFileSync(path.join(credDir, name), 'utf8').replace(/\r?\n$/, ''); }
      catch { /* niet aanwezig */ }
    }
  }
}

// Laadt de variabelen uit .env in process.env (bestaande waarden winnen).
export function loadEnv() {
  ensureEnvFile();
  if (!fs.existsSync(envPath)) return;
  // Node 20.6+ / 22 heeft een ingebouwde .env-parser.
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
  // Fallback voor oudere Node-versies.
  else {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      const key = m[1];
      let val = m[2].replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
  // Na .env: bestand-gebaseerde geheimen laten winnen (Docker/systemd/Vault).
  resolveFileSecrets();
}
