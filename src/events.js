// Realtime updates via Server-Sent Events (SSE). Elke ingelogde gebruiker
// krijgt een stroom met wijzigings-events op zijn eigen bestanden, zodat de
// web UI automatisch kan verversen als er via SFTP/WebDAV iets verandert.

import { setGauge } from './metrics.js';

const clients = new Map(); // user -> Set<res>

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
