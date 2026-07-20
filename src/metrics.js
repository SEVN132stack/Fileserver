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
};

export function inc(name, by = 1) {
  if (name in counters) counters[name] += by;
}
export function setGauge(name, value) {
  if (name in gauges) gauges[name] = value;
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
  return lines.join('\n') + '\n';
}
