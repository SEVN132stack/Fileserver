import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { audit } from './audit.js';

// Regelgebaseerde automatisering ("workflow-engine"): per gebruiker een lijst
// regels. Bij een upload wordt elke actieve regel geëvalueerd: als het pad onder
// een prefix valt en/of de extensie matcht, wordt de actie uitgevoerd
// (tag toevoegen / verplaatsen naar map / melding sturen).

const ACTIONS = ['tag', 'move', 'notify', 'label'];

function readAll() { return readJson(config.rulesFile, () => ({})); }
function writeAll(obj) { writeJson(config.rulesFile, obj, { mode: 0o600 }); }

export function listRules(user) { return readAll()[user] || []; }

export function addRule(user, { prefix = '/', ext = '', contains = '', minKb = 0, maxKb = 0, action, arg = '' }) {
  if (!ACTIONS.includes(action)) throw new Error('Onbekende actie');
  const all = readAll();
  const list = all[user] || [];
  const rule = {
    id: randomBytes(5).toString('hex'),
    prefix: String(prefix || '/').slice(0, 300),
    ext: String(ext || '').replace(/[^a-zA-Z0-9.]/g, '').toLowerCase().slice(0, 12),
    contains: String(contains || '').slice(0, 100),
    minKb: Math.max(0, parseInt(minKb, 10) || 0),
    maxKb: Math.max(0, parseInt(maxKb, 10) || 0),
    action, arg: String(arg).slice(0, 200), enabled: true,
  };
  list.push(rule);
  all[user] = list;
  writeAll(all);
  return rule;
}

export function deleteRule(user, id) {
  const all = readAll();
  const list = all[user] || [];
  const next = list.filter((r) => r.id !== id);
  if (next.length === list.length) return false;
  all[user] = next;
  writeAll(all);
  return true;
}

// Schakel een regel aan/uit zonder hem te verwijderen.
export function setRuleEnabled(user, id, enabled) {
  const all = readAll();
  const rule = (all[user] || []).find((r) => r.id === id);
  if (!rule) return null;
  rule.enabled = !!enabled;
  writeAll(all);
  return rule;
}

// Evalueer of een regel matcht. `meta.sizeBytes` optioneel voor grootte-condities.
function matches(rule, relPath, meta = {}) {
  const p = relPath.startsWith('/') ? relPath : '/' + relPath;
  const pref = rule.prefix.startsWith('/') ? rule.prefix : '/' + rule.prefix;
  if (pref !== '/' && !p.startsWith(pref)) return false;
  if (rule.ext) { const e = rule.ext.startsWith('.') ? rule.ext : '.' + rule.ext; if (!p.toLowerCase().endsWith(e)) return false; }
  if (rule.contains && !p.toLowerCase().includes(rule.contains.toLowerCase())) return false;
  if (rule.minKb && (meta.sizeBytes || 0) < rule.minKb * 1024) return false;
  if (rule.maxKb && (meta.sizeBytes || 0) > rule.maxKb * 1024) return false;
  return true;
}

// Evalueer de regels van een gebruiker tegen een pad. `handlers` levert de
// concrete implementaties (tag/move/notify) aan, zodat deze module vrij blijft
// van web/fs-afhankelijkheden. Geeft de toegepaste acties terug.
export function applyRules(user, relPath, handlers = {}, meta = {}) {
  const applied = [];
  for (const rule of listRules(user)) {
    if (!rule.enabled || !matches(rule, relPath, meta)) continue;
    try {
      if (rule.action === 'tag' && handlers.tag) { handlers.tag(relPath, rule.arg); applied.push({ action: 'tag', arg: rule.arg }); }
      else if (rule.action === 'move' && handlers.move) { const to = handlers.move(relPath, rule.arg); applied.push({ action: 'move', to }); relPath = to || relPath; }
      else if (rule.action === 'notify' && handlers.notify) { handlers.notify(relPath, rule.arg); applied.push({ action: 'notify' }); }
      else if (rule.action === 'label' && handlers.label) { handlers.label(relPath, rule.arg); applied.push({ action: 'label', arg: rule.arg }); }
    } catch { /* een falende regel mag de upload niet breken */ }
  }
  if (applied.length) audit('web', user, 'rules_applied', { path: relPath, count: applied.length });
  return { finalPath: relPath, applied };
}

export { path };
