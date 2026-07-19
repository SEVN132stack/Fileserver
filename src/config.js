import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Alle bestanden worden opgeslagen in deze map. Zowel de SFTP-server als de
// web UI werken op exact dezelfde opslag, zodat wat je via SFTP uploadt ook
// zichtbaar is in de browser en andersom.
export const config = {
  rootDir,
  // Gedeelde opslagmap voor alle bestanden.
  storageDir: process.env.STORAGE_DIR || path.join(rootDir, 'storage'),
  // Pad naar de SSH host key (wordt automatisch aangemaakt indien afwezig).
  hostKeyPath: process.env.HOST_KEY_PATH || path.join(rootDir, 'host.key'),

  web: {
    port: parseInt(process.env.WEB_PORT || '8080', 10),
    host: process.env.WEB_HOST || '0.0.0.0',
  },

  sftp: {
    port: parseInt(process.env.SFTP_PORT || '2222', 10),
    host: process.env.SFTP_HOST || '0.0.0.0',
  },

  // Inloggegevens voor zowel SFTP als de web UI.
  auth: {
    username: process.env.AUTH_USER || 'admin',
    password: process.env.AUTH_PASS || 'changeme',
  },
};
