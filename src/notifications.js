import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';

// In-app notificatiecentrum: meldingen per gebruiker (naast e-mail/webhook),
// zichtbaar via een belletje in de UI.

function readAll() {
  return readJson(config.notificationsFile, () => ({})); // user -> [{ id, ts, title, body, read }]
}
function writeAll(obj) { writeJson(config.notificationsFile, obj, { mode: 0o600 }); }

export function notifyUser(user, title, body) {
  if (!user) return;
  const all = readAll();
  const list = all[user] || [];
  list.unshift({ id: randomBytes(6).toString('hex'), ts: Date.now(), title, body: body || '', read: false });
  all[user] = list.slice(0, 100); // bewaar de laatste 100
  writeAll(all);
}

export function listNotifications(user) {
  return readAll()[user] || [];
}
export function unreadCount(user) {
  return (readAll()[user] || []).filter((n) => !n.read).length;
}
export function markRead(user, id) {
  const all = readAll();
  const list = all[user] || [];
  for (const n of list) if (id === undefined || n.id === id) n.read = true;
  all[user] = list;
  writeAll(all);
}
export function clearAll(user) {
  const all = readAll();
  delete all[user];
  writeAll(all);
}
