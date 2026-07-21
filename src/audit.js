import fs from 'node:fs';
import { config } from './config.js';

// Roteer het audit-log als het te groot wordt: hernoem naar .1, .2, ... en
// bewaar de laatste K bestanden.
function rotateIfNeeded() {
  try {
    const st = fs.statSync(config.auditLog);
    if (st.size < config.logMaxBytes) return;
  } catch {
    return; // bestaat nog niet
  }
  const keep = config.logKeep;
  try {
    const oldest = `${config.auditLog}.${keep}`;
    if (fs.existsSync(oldest)) fs.rmSync(oldest);
    for (let i = keep - 1; i >= 1; i--) {
      const src = `${config.auditLog}.${i}`;
      if (fs.existsSync(src)) fs.renameSync(src, `${config.auditLog}.${i + 1}`);
    }
    fs.renameSync(config.auditLog, `${config.auditLog}.1`);
  } catch (err) {
    console.error('[audit] rotatie mislukt:', err.message);
  }
}

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
    rotateIfNeeded();
    fs.appendFileSync(config.auditLog, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('[audit] kon niet schrijven:', err.message);
  }
}
