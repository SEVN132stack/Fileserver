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
  const contents = `# Automatisch gegenereerd bij de eerste start.
# Alle geheimen (wachtwoorden, keys) horen hier — nooit in de broncode.

# Inloggegevens voor zowel SFTP als de web UI.
AUTH_USER=admin
AUTH_PASS=${password}

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

// Laadt de variabelen uit .env in process.env (bestaande waarden winnen).
export function loadEnv() {
  ensureEnvFile();
  if (!fs.existsSync(envPath)) return;
  // Node 20.6+ / 22 heeft een ingebouwde .env-parser.
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
    return;
  }
  // Fallback voor oudere Node-versies.
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const key = m[1];
    let val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
