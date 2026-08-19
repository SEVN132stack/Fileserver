import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { audit } from './audit.js';

// Plugin-/extensiesysteem: een admin koppelt een event (upload/delete/share/login)
// aan een extern commando. Bij het event draait het commando met de event-details
// als JSON in de omgevingsvariabele FS_EVENT. Krachtig, dus standaard UIT
// (EVENT_HOOKS_ENABLED=true) en alleen door een admin te beheren.

export const EVENTS = ['upload', 'delete', 'rename', 'share_create', 'login', 'download'];

function readAll() { return readJson(config.eventHooksFile, () => []); }
function writeAll(list) { writeJson(config.eventHooksFile, list, { mode: 0o600 }); }

export function listHooks() { return readAll(); }

export function addHook({ event, command, label = '' }) {
  if (!EVENTS.includes(event)) throw new Error('Onbekend event');
  if (!command) throw new Error('Commando verplicht');
  const list = readAll();
  const hook = { id: randomBytes(5).toString('hex'), event, command: String(command).slice(0, 500), label: String(label).slice(0, 80), enabled: true, fires: 0 };
  list.push(hook);
  writeAll(list);
  return hook;
}

export function deleteHook(id) {
  const list = readAll();
  const next = list.filter((h) => h.id !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

// Vuur alle hooks voor een event af (alleen als de functie is ingeschakeld).
export function fireEvent(event, detail = {}) {
  if (!config.eventHooksEnabled) return;
  const list = readAll();
  let changed = false;
  for (const hook of list) {
    if (!hook.enabled || hook.event !== event) continue;
    const [cmd, ...args] = hook.command.split(' ');
    execFile(cmd, args, { timeout: 30000, env: { ...process.env, FS_EVENT: JSON.stringify({ event, ...detail }) } }, (err) => {
      if (err) console.error(`[eventhook ${hook.id}]`, err.message);
    });
    hook.fires = (hook.fires || 0) + 1; changed = true;
    audit('system', null, 'eventhook_fire', { id: hook.id, event });
  }
  if (changed) writeAll(list);
}
