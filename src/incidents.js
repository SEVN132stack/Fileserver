import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { audit } from './audit.js';

// Statuspagina-inhoud: incidenten (met historie) en geplande onderhoudsvensters.
// Beheerd door een admin; de publieke statuspagina toont de actuele status en de
// historie.

function readAll() { return readJson(config.incidentsFile, () => ({ incidents: [], maintenance: [] })); }
function writeAll(obj) { writeJson(config.incidentsFile, obj, { mode: 0o600 }); }

const SEV = ['info', 'minor', 'major', 'critical'];

export function addIncident({ title, body = '', severity = 'minor' }, actor) {
  if (!title) throw new Error('Titel verplicht');
  const all = readAll();
  const inc = {
    id: randomBytes(5).toString('hex'), title: String(title).slice(0, 200), body: String(body).slice(0, 2000),
    severity: SEV.includes(severity) ? severity : 'minor', status: 'open', created: Date.now(), resolvedAt: 0,
  };
  all.incidents.unshift(inc);
  all.incidents = all.incidents.slice(0, 200);
  writeAll(all);
  audit('web', actor, 'incident_add', { id: inc.id, severity: inc.severity });
  return inc;
}

export function resolveIncident(id, actor) {
  const all = readAll();
  const inc = all.incidents.find((i) => i.id === id);
  if (!inc || inc.status === 'resolved') return null;
  inc.status = 'resolved'; inc.resolvedAt = Date.now();
  writeAll(all);
  audit('web', actor, 'incident_resolve', { id });
  return inc;
}

export function deleteIncident(id) {
  const all = readAll();
  const n = all.incidents.length;
  all.incidents = all.incidents.filter((i) => i.id !== id);
  if (all.incidents.length === n) return false;
  writeAll(all); return true;
}

export function addMaintenance({ title, start, end }, actor) {
  const all = readAll();
  const m = { id: randomBytes(5).toString('hex'), title: String(title || 'Onderhoud').slice(0, 200), start: Number(start) || Date.now(), end: Number(end) || (Date.now() + 3600000) };
  all.maintenance.unshift(m);
  all.maintenance = all.maintenance.slice(0, 100);
  writeAll(all);
  audit('web', actor, 'maintenance_add', { id: m.id });
  return m;
}

export function deleteMaintenance(id) {
  const all = readAll();
  const n = all.maintenance.length;
  all.maintenance = all.maintenance.filter((m) => m.id !== id);
  if (all.maintenance.length === n) return false;
  writeAll(all); return true;
}

export function listAll() { return readAll(); }

// Publieke samenvatting voor de statuspagina.
export function publicStatus() {
  const all = readAll();
  const now = Date.now();
  const openIncidents = all.incidents.filter((i) => i.status === 'open');
  const upcomingMaintenance = all.maintenance.filter((m) => m.end > now).sort((a, b) => a.start - b.start);
  const activeMaintenance = upcomingMaintenance.some((m) => m.start <= now && m.end >= now);
  const worst = openIncidents.reduce((w, i) => Math.max(w, SEV.indexOf(i.severity)), -1);
  const state = activeMaintenance ? 'onderhoud' : worst >= 2 ? 'storing' : worst >= 0 ? 'verstoord' : 'operationeel';
  return {
    state,
    openIncidents: openIncidents.map(({ id, title, severity, created }) => ({ id, title, severity, created })),
    recentIncidents: all.incidents.slice(0, 20).map(({ id, title, severity, status, created, resolvedAt }) => ({ id, title, severity, status, created, resolvedAt })),
    maintenance: upcomingMaintenance.map(({ id, title, start, end }) => ({ id, title, start, end })),
  };
}
