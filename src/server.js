import { config } from './config.js';
import { ensureStorage, ensureHostKey } from './util.js';
import { ensureUsers, listUsernames } from './users.js';
import { startWebServer } from './web.js';
import { startSftpServer } from './sftp.js';

// Startpunt: bereidt opslag, host key en gebruikers voor en start beide servers.
ensureStorage();
ensureHostKey();
ensureUsers();

startWebServer();
startSftpServer();

const scheme = config.tls.enabled ? 'https' : 'http';
console.log('\n=== SFTP Fileserver gestart ===');
console.log(`Opslagmap : ${config.storageDir}`);
console.log(`Web UI    : ${scheme}://localhost:${config.web.port}`);
console.log(`SFTP      : sftp -P ${config.sftp.port} <gebruiker>@localhost`);
console.log(`Gebruikers: ${listUsernames().join(', ')}`);
console.log('================================\n');

process.on('SIGINT', () => {
  console.log('\nAfsluiten...');
  process.exit(0);
});
