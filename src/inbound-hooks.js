import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { audit } from './audit.js';
import { buildIndex } from './searchindex.js';
import { makeBackup } from './backup.js';
import { checkQuotas } from './quota-warn.js';
import { enqueue } from './webhook-queue.js';

// Inkomende webhooks / API-triggers: een admin maakt een geheime token die aan
// één vooraf toegestane actie is gekoppeld. Een externe dienst (Zapier/Make/CI)
// POST't naar /api/hooks/<token> om die actie te starten — zonder inloggegevens,
// maar strikt beperkt tot de gekozen actie (geen willekeurige uitvoering).

// Toegestane acties (allowlist). Elke actie is een veilige, begrensde operatie.
const ACTIONS = {
  reindex: async () => ({ ok: true, ...buildIndex() }),
  backup: async () => { const f = await makeBackup(); return { ok: true, backup: f.split('/').pop() }; },
  'check-quotas': async () => ({ ok: true, ...checkQuotas() }),
  notify: async (payload) => { enqueue('inbound', { message: String(payload && payload.message || 'Inkomende trigger') }); return { ok: true }; },
};

export function actionNames() { return Object.keys(ACTIONS); }

function readAll() { return readJson(config.inboundHooksFile, () => []); }
function writeAll(list) { writeJson(config.inboundHooksFile, list, { mode: 0o600 }); }

export function listHooks() { return readAll(); }

export function createHook(action, label = '') {
  if (!ACTIONS[action]) throw new Error('Onbekende actie');
  const list = readAll();
  const hook = { token: 'ih_' + randomBytes(18).toString('base64url'), action, label: String(label).slice(0, 80), created: Date.now(), lastFired: 0, fires: 0 };
  list.push(hook);
  writeAll(list);
  return hook;
}

export function deleteHook(token) {
  const list = readAll();
  const next = list.filter((h) => h.token !== token);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

// Voer de aan de token gekoppelde actie uit. Geeft null als de token onbekend is.
export async function fireHook(token, payload) {
  const list = readAll();
  const hook = list.find((h) => h.token === token);
  if (!hook) return null;
  const fn = ACTIONS[hook.action];
  if (!fn) return { error: 'Actie niet meer beschikbaar' };
  hook.lastFired = Date.now();
  hook.fires = (hook.fires || 0) + 1;
  writeAll(list);
  audit('system', null, 'inbound_hook', { action: hook.action, label: hook.label });
  try { return await fn(payload); }
  catch (err) { return { error: err.message }; }
}
