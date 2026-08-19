import fs from 'node:fs';
import { config } from './config.js';
import { ensureStorage, ensureHostKey } from './util.js';
import { ensureUsers, listUsernames } from './users.js';
import { startWebServer } from './web.js';
import { startSftpServer } from './sftp.js';
import { startBackupScheduler } from './backup.js';
import { startMetricsHistory } from './metrics-history.js';
import { startCleanupScheduler } from './cleanup.js';
import { startDiskMonitor } from './diskmonitor.js';
import { startIntegrityScheduler } from './integrity.js';
import { startAvScheduler } from './av-schedule.js';
import { startSearchIndexScheduler } from './searchindex.js';
import { startScheduledExports } from './scheduled-export.js';
import { startAcmeScheduler } from './acme.js';
import { startConfigDriftMonitor } from './config-drift.js';
import { startExpiryScheduler } from './expiry.js';
import { startReportScheduler } from './report-email.js';
import { startUserTasksScheduler } from './user-tasks.js';
import { startWebhookWorker } from './webhook-queue.js';
import { startQuotaWarnScheduler } from './quota-warn.js';
import { startCertMonitor } from './cert-monitor.js';
import { startDigestScheduler } from './digest.js';

// Startpunt: bereidt opslag, host key en gebruikers voor en start beide servers.
ensureStorage();
ensureHostKey();
ensureUsers();
fs.mkdirSync(config.chunkDir, { recursive: true });
fs.mkdirSync(config.thumbDir, { recursive: true });
fs.mkdirSync(config.quarantineDir, { recursive: true });
startBackupScheduler();
startMetricsHistory();
startCleanupScheduler();
startDiskMonitor();
startIntegrityScheduler();
startAvScheduler();
startSearchIndexScheduler();
startScheduledExports();
startAcmeScheduler();
startConfigDriftMonitor();
startExpiryScheduler();
startReportScheduler();
startUserTasksScheduler();
startWebhookWorker();
startQuotaWarnScheduler();
startCertMonitor();
startDigestScheduler();

startWebServer();
startSftpServer();

const scheme = config.tls.enabled ? 'https' : 'http';
console.log('\n=== SFTP Fileserver gestart ===');
console.log(`Opslagmap : ${config.storageDir}`);
console.log(`Web UI    : ${scheme}://localhost:${config.web.port}`);
console.log(`SFTP      : sftp -P ${config.sftp.port} <gebruiker>@localhost`);
if (config.webdavEnabled) console.log(`WebDAV    : ${scheme}://localhost:${config.web.port}/webdav`);
if (config.oidc.enabled) console.log('SSO (OIDC): ingeschakeld');
if (config.clamscan) console.log('Virusscan : ' + config.clamscan);
console.log(`Gebruikers: ${listUsernames().join(', ')}`);
console.log('================================\n');

process.on('SIGINT', () => {
  console.log('\nAfsluiten...');
  process.exit(0);
});
