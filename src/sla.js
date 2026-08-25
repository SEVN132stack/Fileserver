import { config } from './config.js';
import { listAll } from './incidents.js';

// Beschikbaarheids-/SLA-berekening op basis van de incident-historie. Downtime =
// de tijd dat er een openstaand incident was met een "downtime"-severity
// (standaard major/critical). Uptime% = 1 - downtime / vensterduur. We rapporteren
// ook een dag-tijdlijn, de MTTR (gemiddelde hersteltijd) en telling per severity.

const DAY = 86400000;

// Overlap (ms) tussen [aStart,aEnd) en [bStart,bEnd).
function overlap(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function compute(days = 30, now = Date.now()) {
  const windowMs = Math.max(1, days) * DAY;
  const start = now - windowMs;
  const { incidents } = listAll();
  const downSev = new Set(config.slaDowntimeSeverities);

  // Downtime-incidenten (afgerond op het venster).
  const downing = incidents.filter((i) => downSev.has(i.severity));
  let downtime = 0;
  for (const i of downing) {
    const end = i.resolvedAt || now; // nog open = tot nu
    downtime += overlap(i.created, end, start, now);
  }
  const uptimePct = Math.max(0, Math.min(100, (1 - downtime / windowMs) * 100));

  // Dag-tijdlijn: uptime% per dag (nieuw -> oud niet; oud -> nieuw).
  const timeline = [];
  for (let d = 0; d < days; d++) {
    const dayStart = start + d * DAY;
    const dayEnd = Math.min(dayStart + DAY, now);
    if (dayEnd <= dayStart) break;
    let down = 0;
    for (const i of downing) {
      const end = i.resolvedAt || now;
      down += overlap(i.created, end, dayStart, dayEnd);
    }
    const span = dayEnd - dayStart;
    timeline.push({ day: new Date(dayStart).toISOString().slice(0, 10), uptime: Math.max(0, Math.min(100, (1 - down / span) * 100)) });
  }

  // MTTR: gemiddelde hersteltijd van in dit venster opgeloste incidenten.
  const resolved = incidents.filter((i) => i.resolvedAt && i.resolvedAt >= start && i.resolvedAt <= now);
  const mttrMs = resolved.length ? Math.round(resolved.reduce((s, i) => s + (i.resolvedAt - i.created), 0) / resolved.length) : 0;

  // Telling per severity binnen het venster (op basis van aanvang).
  const bySeverity = {};
  for (const i of incidents) {
    if (i.created >= start && i.created <= now) bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
  }

  const openNow = incidents.filter((i) => i.status !== 'resolved').length;
  return {
    days, uptimePct: +uptimePct.toFixed(4), downtimeMs: downtime, timeline,
    mttrMs, resolvedCount: resolved.length, bySeverity, openIncidents: openNow,
    downtimeSeverities: [...downSev],
  };
}
