import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { homeDir } from './users.js';
import { resolveWithin } from './paths.js';
import * as locks from './locks.js';
import * as retention from './retention.js';
import * as labels from './labels.js';
import * as tags from './tags.js';
import { audit } from './audit.js';

// Bestandsverloop-workflow op basis van inactiviteit. Per gebruiker één of meer
// beleidsregels op een map: bestanden die langer dan `warnDays` niet gewijzigd
// zijn geven een waarschuwing, na `archiveDays` gaan ze naar de Archief-map, en
// na `deleteDays` worden ze verwijderd. Vergrendelde en onder-bewaarplicht
// staande bestanden worden altijd overgeslagen. Verwijderen gaat naar de
// prullenbak (herstelbaar).

function readAll() { return readJson(config.lifecycleFile, () => ({})); }
function writeAll(obj) { writeJson(config.lifecycleFile, obj, { mode: 0o600 }); }

export function listPolicies(user) { return readAll()[user] || []; }

export function addPolicy(user, { path: p = '/', warnDays = 0, archiveDays = 0, deleteDays = 0 }) {
  const all = readAll();
  const list = all[user] || [];
  const pol = {
    id: randomBytes(5).toString('hex'),
    path: String(p || '/').slice(0, 300),
    warnDays: Math.max(0, parseInt(warnDays, 10) || 0),
    archiveDays: Math.max(0, parseInt(archiveDays, 10) || 0),
    deleteDays: Math.max(0, parseInt(deleteDays, 10) || 0),
    enabled: true,
  };
  list.push(pol);
  all[user] = list;
  writeAll(all);
  return pol;
}

export function deletePolicy(user, id) {
  const all = readAll();
  const list = all[user] || [];
  const next = list.filter((r) => r.id !== id);
  if (next.length === list.length) return false;
  all[user] = next;
  writeAll(all);
  return true;
}

const DAY = 86400000;

// Loop (begrensd) door een map en bepaal per bestand de te nemen actie.
function scanPolicy(home, pol, now) {
  const dir = resolveWithin(home, pol.path || '/');
  const out = [];
  let visited = 0;
  const walk = (abs, rel) => {
    if (visited > 20000) return;
    let entries; try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (visited > 20000) return;
      if (e.name.startsWith('.')) continue;
      if (e.name === config.lifecycleArchiveDir) continue; // niet de archiefmap zelf verwerken
      const childRel = (rel === '/' ? '' : rel) + '/' + e.name;
      const full = path.join(abs, e.name);
      if (e.isDirectory()) { walk(full, childRel); continue; }
      visited++;
      let ageDays; try { ageDays = (now - fs.statSync(full).mtimeMs) / DAY; } catch { continue; }
      let action = null;
      if (pol.deleteDays && ageDays >= pol.deleteDays) action = 'delete';
      else if (pol.archiveDays && ageDays >= pol.archiveDays) action = 'archive';
      else if (pol.warnDays && ageDays >= pol.warnDays) action = 'warn';
      if (action) out.push({ rel: childRel, ageDays: Math.floor(ageDays), action });
    }
  };
  walk(dir, pol.path && pol.path !== '/' ? pol.path.replace(/\/+$/, '') : '/');
  return out;
}

// Dry-run: wat zou er gebeuren voor deze gebruiker (geen wijzigingen).
export function preview(user) {
  const home = homeDir(user);
  const items = [];
  for (const pol of listPolicies(user)) {
    if (pol.enabled === false) continue;
    for (const it of scanPolicy(home, pol, Date.now())) items.push({ policyId: pol.id, ...it });
  }
  return { items };
}

// Voer het beleid uit voor één gebruiker. `notify` is een callback
// (title, body) => void voor waarschuwingen.
export function runForUser(user, notify) {
  const home = homeDir(user);
  const now = Date.now();
  let warned = 0, archived = 0, deleted = 0; const skipped = [];
  for (const pol of listPolicies(user)) {
    if (pol.enabled === false) continue;
    for (const it of scanPolicy(home, pol, now)) {
      // Vergrendeld of onder bewaarplicht: nooit aanraken.
      if (locks.lockOwner(home, it.rel) || retention.retainedUntil(home, it.rel)) { skipped.push(it.rel); continue; }
      try {
        if (it.action === 'warn') {
          if (typeof notify === 'function') notify('Bestand verloopt binnenkort', `${it.rel} is ${it.ageDays} dagen ongewijzigd.`);
          warned++;
        } else if (it.action === 'archive') {
          const toRel = path.posix.join('/', config.lifecycleArchiveDir, it.rel);
          const from = resolveWithin(home, it.rel);
          const to = resolveWithin(home, toRel);
          fs.mkdirSync(path.dirname(to), { recursive: true });
          if (!fs.existsSync(to)) {
            fs.renameSync(from, to);
            // Classificatie en tags verhuizen mee, zodat een gearchiveerd "geheim"
            // bestand niet ongemerkt deelbaar wordt.
            labels.movePath(home, it.rel, toRel); tags.movePath(user, it.rel, toRel);
            archived++;
          }
        } else if (it.action === 'delete') {
          // Naar de prullenbak (herstelbaar) i.p.v. definitief wissen; de gewone
          // prullenbak-opschoning ruimt het later op.
          const trash = path.join(home, config.trashName);
          fs.mkdirSync(trash, { recursive: true });
          fs.renameSync(resolveWithin(home, it.rel), path.join(trash, Date.now() + '_' + path.basename(it.rel)));
          labels.removePath(home, it.rel); tags.removePath(user, it.rel);
          deleted++;
        }
      } catch { skipped.push(it.rel); }
    }
  }
  if (warned || archived || deleted) audit('lifecycle', user, 'lifecycle_run', { warned, archived, deleted });
  return { warned, archived, deleted, skipped };
}

let timer = null;
// Scheduler: draai periodiek voor alle gebruikers met beleid.
export function startScheduler(notifyFactory) {
  if (timer) return;
  const ms = Math.max(1, config.lifecycleIntervalHours) * 3600000;
  timer = setInterval(() => {
    const all = readAll();
    for (const user of Object.keys(all)) {
      try { runForUser(user, notifyFactory ? notifyFactory(user) : null); } catch (e) { console.error('[lifecycle]', e.message); }
    }
  }, ms);
  if (timer.unref) timer.unref();
}
export function stopScheduler() { if (timer) { clearInterval(timer); timer = null; } }
