import { toClientPath } from './paths.js';
import * as permalinks from './permalinks.js';
import * as links from './links.js';

// Houd permalinks (/f/) en interne links (/o/) bij wanneer bestanden buiten de
// web-app om worden hernoemd of verwijderd (SFTP, WebDAV). Paden worden in
// hetzelfde formaat opgeslagen als in de web-app ('/map/bestand').
export function linksMoved(user, home, fromAbs, toAbs) {
  try {
    const from = toClientPath(home, fromAbs); const to = toClientPath(home, toAbs);
    permalinks.updatePath(user, from, to); links.updatePath(user, from, to);
  } catch { /* de bestandsbewerking zelf is al gelukt; links bijwerken is best-effort */ }
}
export function linksRemoved(user, home, abs) {
  try {
    const p = toClientPath(home, abs);
    permalinks.removeForPath(user, p); links.removeForPath(user, p);
  } catch { /* best-effort, zie hierboven */ }
}
