import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { resolveWithin } from './paths.js';
import { audit } from './audit.js';

// Gedeelde teamruimtes: een benoemde ruimte met meerdere leden, elk met een rol.
// Rollen: 'viewer' (alleen lezen), 'editor' (lezen + schrijven), 'admin' (beheer
// leden + verwijderen). Elke ruimte heeft een eigen map onder TEAM_SPACES_DIR.

const ROLES = ['viewer', 'editor', 'admin'];
const RANK = { viewer: 1, editor: 2, admin: 3 };

function readAll() { return readJson(config.teamsFile, () => []); }
function writeAll(list) { writeJson(config.teamsFile, list, { mode: 0o600 }); }

export function teamDir(id) { return path.join(config.teamSpacesDir, path.basename(id)); }

export function getTeam(id) { return readAll().find((t) => t.id === id) || null; }

// De rol van een gebruiker in een team (of null als geen lid).
export function memberRole(team, user) {
  if (!team) return null;
  return team.members[user] || null;
}

export function canRead(team, user) { return !!memberRole(team, user); }
export function canWrite(team, user) { const r = memberRole(team, user); return r && RANK[r] >= RANK.editor; }
export function isTeamAdmin(team, user) { return memberRole(team, user) === 'admin'; }

// Teams waarvan de gebruiker lid is (met eigen rol).
export function teamsFor(user) {
  return readAll()
    .filter((t) => t.members[user])
    .map((t) => ({ id: t.id, name: t.name, role: t.members[user], members: Object.keys(t.members).length }));
}

export function createTeam(name, creator) {
  const list = readAll();
  const id = randomBytes(6).toString('hex');
  const team = { id, name: String(name).slice(0, 100) || 'Team', created: Date.now(), members: { [creator]: 'admin' } };
  list.push(team);
  writeAll(list);
  fs.mkdirSync(teamDir(id), { recursive: true });
  audit('web', creator, 'team_create', { id, name: team.name });
  return team;
}

export function setMember(id, user, roleArg, actor) {
  if (!ROLES.includes(roleArg)) throw new Error('Onbekende rol');
  const list = readAll();
  const team = list.find((t) => t.id === id);
  if (!team) throw new Error('Team niet gevonden');
  team.members[user] = roleArg;
  writeAll(list);
  audit('web', actor, 'team_member_set', { id, user, role: roleArg });
  return team;
}

export function removeMember(id, user, actor) {
  const list = readAll();
  const team = list.find((t) => t.id === id);
  if (!team) throw new Error('Team niet gevonden');
  // Voorkom dat de laatste admin wordt verwijderd (team zou onbeheerbaar worden).
  const admins = Object.entries(team.members).filter(([, r]) => r === 'admin').map(([u]) => u);
  if (admins.length === 1 && admins[0] === user) throw new Error('Kan de laatste beheerder niet verwijderen');
  delete team.members[user];
  writeAll(list);
  audit('web', actor, 'team_member_remove', { id, user });
  return team;
}

export function deleteTeam(id, actor) {
  const list = readAll();
  const idx = list.findIndex((t) => t.id === id);
  if (idx < 0) return false;
  list.splice(idx, 1);
  writeAll(list);
  try { fs.rmSync(teamDir(id), { recursive: true, force: true }); } catch { /* al weg */ }
  audit('web', actor, 'team_delete', { id });
  return true;
}

// Veilig een pad binnen de team-map oplossen (geen traversal).
export function resolveTeamPath(id, p) {
  return resolveWithin(teamDir(id), p || '/');
}
