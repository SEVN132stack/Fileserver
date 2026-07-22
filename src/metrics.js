// Eenvoudige Prometheus-metrics. Tel gebeurtenissen en stel ze bloot in het
// tekst-expositieformaat op /metrics.
const counters = {
  fileserver_uploads_total: 0,
  fileserver_downloads_total: 0,
  fileserver_logins_total: 0,
  fileserver_login_failures_total: 0,
  fileserver_deletes_total: 0,
  fileserver_bytes_uploaded_total: 0,
  fileserver_bytes_downloaded_total: 0,
};
const gauges = {
  fileserver_active_sse_clients: 0,
  fileserver_disk_free_percent: 100,
};

// Per-gebruiker verkeer (bytes up/down), voor gelabelde Prometheus-metrics.
const perUser = new Map(); // user -> { up, down }

export function inc(name, by = 1) {
  if (name in counters) counters[name] += by;
}

// Tel verkeer per gebruiker. dir is 'up' of 'down'.
export function incUser(user, dir, bytes) {
  if (!user || !bytes) return;
  const rec = perUser.get(user) || { up: 0, down: 0 };
  if (dir === 'up') rec.up += bytes; else rec.down += bytes;
  perUser.set(user, rec);
}

// Momentopname van het per-gebruiker-verkeer (voor het admin-overzicht).
export function userTraffic() {
  return [...perUser.entries()].map(([user, r]) => ({ user, up: r.up, down: r.down }))
    .sort((a, b) => (b.up + b.down) - (a.up + a.down));
}

const escLabel = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
export function setGauge(name, value) {
  if (name in gauges) gauges[name] = value;
}

// Momentopname van alle tellers/gauges (voor het admin-overzicht).
export function snapshot() {
  return { ...counters, ...gauges };
}

export function render() {
  const lines = [];
  for (const [k, v] of Object.entries(counters)) {
    lines.push(`# TYPE ${k} counter`);
    lines.push(`${k} ${v}`);
  }
  for (const [k, v] of Object.entries(gauges)) {
    lines.push(`# TYPE ${k} gauge`);
    lines.push(`${k} ${v}`);
  }
  if (perUser.size) {
    lines.push('# TYPE fileserver_user_bytes_uploaded_total counter');
    for (const [user, r] of perUser) lines.push(`fileserver_user_bytes_uploaded_total{user="${escLabel(user)}"} ${r.up}`);
    lines.push('# TYPE fileserver_user_bytes_downloaded_total counter');
    for (const [user, r] of perUser) lines.push(`fileserver_user_bytes_downloaded_total{user="${escLabel(user)}"} ${r.down}`);
  }
  return lines.join('\n') + '\n';
}
