import { config } from './config.js';
import { ensureStorage, ensureHostKey } from './util.js';
import { startWebServer } from './web.js';
import { startSftpServer } from './sftp.js';

// Startpunt: bereidt opslag + host key voor en start beide servers.
ensureStorage();
ensureHostKey();

startWebServer();
startSftpServer();

console.log('\n=== SFTP Fileserver gestart ===');
console.log(`Opslagmap : ${config.storageDir}`);
console.log(`Web UI    : http://localhost:${config.web.port}`);
console.log(`SFTP      : sftp -P ${config.sftp.port} ${config.auth.username}@localhost`);
console.log(`Gebruiker : ${config.auth.username}`);
console.log('================================\n');

process.on('SIGINT', () => {
  console.log('\nAfsluiten...');
  process.exit(0);
});
