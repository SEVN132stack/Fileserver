import fs from 'node:fs';
import { config } from './config.js';

// Schrijf een regel naar het audit-log: wie deed wat, wanneer en via welk
// kanaal (web of sftp). Append-only, één JSON-object per regel.
export function audit(channel, user, action, detail = {}) {
  const entry = {
    ts: new Date().toISOString(),
    channel,
    user: user || null,
    action,
    ...detail,
  };
  try {
    fs.appendFileSync(config.auditLog, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('[audit] kon niet schrijven:', err.message);
  }
}
