// Realtime updates via Server-Sent Events (SSE). Elke ingelogde gebruiker
// krijgt een stroom met wijzigings-events op zijn eigen bestanden, zodat de
// web UI automatisch kan verversen als er via SFTP/WebDAV iets verandert.

import { setGauge } from './metrics.js';
import { invalidateDirSize } from './paths.js';
import { homeDir } from './users.js';

const clients = new Map(); // user -> Set<res>
const adminClients = new Set(); // res-verbindingen van admin-dashboards

function updateGauge() {
  let total = 0;
  for (const set of clients.values()) total += set.size;
  setGauge('fileserver_active_sse_clients', total);
}

export function addClient(user, res) {
  if (!clients.has(user)) clients.set(user, new Set());
  clients.get(user).add(res);
  updateGauge();
  res.on('close', () => {
    const set = clients.get(user);
    if (set) {
      set.delete(res);
      if (!set.size) clients.delete(user);
    }
    updateGauge();
  });
}

// Stuur een event naar alle verbindingen van een gebruiker.
export function emitToUser(user, event, data = {}) {
  // Een 'change'-event betekent dat er iets aan de bestanden van de gebruiker is
  // gewijzigd: invalideer de gecachete map-grootte zodat quota-checks en de
  // quota-weergave direct kloppen (ook als er geen SSE-client verbonden is).
  if (event === 'change') { try { invalidateDirSize(homeDir(user)); } catch { /* geen home */ } }
  const set = clients.get(user);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      /* verbinding weg */
    }
  }
}

// Admin-dashboard-verbindingen (live overzicht).
export function addAdminClient(res) {
  adminClients.add(res);
  res.on('close', () => adminClients.delete(res));
}

// Broadcast een activiteits-event naar alle admin-dashboards.
export function emitAdmin(event, data = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of adminClients) {
    try {
      res.write(payload);
    } catch {
      /* verbinding weg */
    }
  }
}
