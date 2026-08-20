import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { audit } from './audit.js';
import { notifyUser } from './notifications.js';

// Taken/actiepunten op bestanden: wijs een bestand toe aan iemand met een titel,
// deadline en status (open/bezig/klaar). Zo kun je "review dit", "onderteken dit"
// enz. koppelen aan een concreet bestand.

const STATUS = ['open', 'bezig', 'klaar'];
function readAll() { return readJson(config.tasksFile, () => []); }
function writeAll(list) { writeJson(config.tasksFile, list, { mode: 0o600 }); }

export function createTask({ path = '', title, assignee, due = 0 }, creator) {
  if (!title) throw new Error('Titel verplicht');
  const task = {
    id: randomBytes(6).toString('hex'),
    path: String(path).slice(0, 300), title: String(title).slice(0, 200),
    assignee: String(assignee || creator), creator, due: Number(due) || 0,
    status: 'open', created: Date.now(),
  };
  const list = readAll(); list.push(task); writeAll(list);
  audit('web', creator, 'task_create', { id: task.id, assignee: task.assignee });
  if (task.assignee !== creator) { try { notifyUser(task.assignee, 'Nieuwe taak toegewezen', `${creator}: ${task.title}${task.path ? ' (' + task.path + ')' : ''}`); } catch { /* niet-fataal */ } }
  return task;
}

// Taken die aan de gebruiker zijn toegewezen of door hem/haar zijn aangemaakt.
export function tasksFor(user) {
  return readAll().filter((t) => t.assignee === user || t.creator === user)
    .sort((a, b) => (a.status === 'klaar') - (b.status === 'klaar') || (a.due || 9e15) - (b.due || 9e15));
}

export function setStatus(id, status, user) {
  if (!STATUS.includes(status)) throw new Error('Ongeldige status');
  const list = readAll();
  const t = list.find((x) => x.id === id);
  if (!t) return null;
  if (t.assignee !== user && t.creator !== user) throw new Error('Geen rechten');
  t.status = status; writeAll(list);
  return t;
}

export function deleteTask(id, user) {
  const list = readAll();
  const t = list.find((x) => x.id === id);
  if (!t) return false;
  if (t.creator !== user && t.assignee !== user) return false;
  writeAll(list.filter((x) => x.id !== id));
  return true;
}
