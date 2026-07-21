import fs from 'node:fs';
import { config } from './config.js';

// Gebruikersgroepen: { naam: [gebruikers...] }. Delen kan naar 'group:<naam>'.
function read() {
  try {
    return JSON.parse(fs.readFileSync(config.groupsFile, 'utf8'));
  } catch {
    return {};
  }
}
function write(d) {
  fs.writeFileSync(config.groupsFile, JSON.stringify(d, null, 2), { mode: 0o600 });
}

export function listGroups() {
  return read();
}
export function setGroup(name, members) {
  const d = read();
  d[name] = [...new Set(members)];
  write(d);
}
export function deleteGroup(name) {
  const d = read();
  delete d[name];
  write(d);
}
// Groepen waar een gebruiker lid van is.
export function groupsOf(username) {
  const d = read();
  return Object.keys(d).filter((g) => (d[g] || []).includes(username));
}
// Is `username` lid van doel 'group:<naam>' of exact die gebruiker?
export function targetMatches(target, username) {
  if (target === username) return true;
  if (target && target.startsWith('group:')) {
    const g = target.slice(6);
    return (read()[g] || []).includes(username);
  }
  return false;
}
