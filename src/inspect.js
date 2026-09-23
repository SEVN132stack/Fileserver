import path from 'node:path';
import { config } from './config.js';
import { scanFile } from './scan.js';
import { scanFileForDlp } from './dlp.js';
import { quarantine } from './quarantine.js';
import { setMeta } from './metadata.js';
import { audit } from './audit.js';
import { alert as sysAlert } from './alerts.js';

// Eén gedeelde upload-inspectie voor alle kanalen die buiten de web-upload om
// schrijven (SFTP, WebDAV, tus): antivirus + DLP, met dezelfde afhandeling als
// de web-upload. Zo is er geen kanaal meer dat de controles omzeilt.
//
// Retourneert { ok: true } of { ok: false, reason: 'malware'|'dlp', detail }.
// Bij een afkeuring staat het bestand al in quarantaine (niet meer op zijn plek).
export async function inspectUpload({ abs, user, home, relPath, via }) {
  // Bestandsnaam uit het doelpad (tijdelijke uploadbestanden hebben geen extensie,
  // en DLP/AV kijken naar het type).
  const filename = relPath ? path.posix.basename(relPath) : path.basename(abs);
  const targetPath = path.posix.dirname(relPath || '/' + filename);
  let verdict = null;
  try { verdict = await scanFile(abs); } catch { /* scanner onbereikbaar: fail-open, zoals de web-upload */ }
  if (verdict && verdict.clean === false) {
    quarantine(abs, { user, home, targetPath, filename, detail: verdict.detail });
    audit(via, user, 'quarantined', { file: filename, via, detail: verdict.detail });
    sysAlert('quarantine', 'Bestand in quarantaine', `Upload '${filename}' van '${user}' via ${via} is besmet: ${verdict.detail || ''}`);
    return { ok: false, reason: 'malware', detail: verdict.detail };
  }
  const dlp = scanFileForDlp(abs, filename);
  if (dlp) {
    audit(via, user, 'dlp_hit', { file: filename, types: dlp.types, action: config.dlp.action, via });
    sysAlert(`dlp-${user}-${filename}`, 'DLP: gevoelige gegevens in upload', `Upload '${filename}' van '${user}' via ${via} bevat mogelijk: ${dlp.types.join(', ')}.`);
    if (config.dlp.action === 'block') {
      quarantine(abs, { user, home, targetPath, filename, detail: 'DLP: ' + dlp.types.join(', ') });
      return { ok: false, reason: 'dlp', detail: dlp.types.join(', ') };
    }
    try { setMeta(home, relPath, { dlp: dlp.types }); } catch { /* optioneel */ }
  }
  return { ok: true };
}
