import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';

// Fijnmazige uitgaande webhook-abonnementen: meerdere endpoints, elk met een
// filter op event-type en pad-prefix, en een payload-template met {{velden}}.
// Aanvulling op de enkele WEBHOOK_URL: hiermee kun je verschillende systemen
// gericht op specifieke events abonneren.

export const EVENTS = ['upload', 'delete', 'rename', 'share_create', 'login', 'download', 'quarantine'];

function readAll() { return readJson(config.webhookSubsFile, () => []); }
function writeAll(list) { writeJson(config.webhookSubsFile, list, { mode: 0o600 }); }

export function listSubs() { return readAll().map(({ secret, ...s }) => ({ ...s, hasSecret: !!secret })); }

export function addSub({ url, events = [], pathPrefix = '', template = '', secret = '' }) {
  if (!/^https?:\/\//.test(url || '')) throw new Error('Ongeldige URL');
  const list = readAll();
  const sub = {
    id: randomBytes(5).toString('hex'), url: String(url).slice(0, 500),
    events: Array.isArray(events) ? events.filter((e) => EVENTS.includes(e)) : [],
    pathPrefix: String(pathPrefix || '').slice(0, 200),
    template: String(template || '').slice(0, 2000),
    secret: String(secret || '').slice(0, 200),
    enabled: true, deliveries: 0, lastStatus: 0,
  };
  list.push(sub);
  writeAll(list);
  return sub;
}

export function deleteSub(id) {
  const list = readAll();
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

// Vervang {{veld}} in de template door waarden uit het detail-object.
function render(template, event, detail) {
  const data = { event, ...detail, ts: new Date().toISOString() };
  if (!template) return JSON.stringify(data);
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => {
    const v = k.split('.').reduce((o, part) => (o == null ? undefined : o[part]), data);
    return v === undefined ? '' : String(v);
  });
}

// Bezorg een event bij alle passende abonnementen (fire-and-forget met korte timeout).
export function deliver(event, detail = {}) {
  const list = readAll();
  if (!list.length) return;
  const p = (detail.path || detail.from || '').toString();
  let changed = false;
  for (const sub of list) {
    if (!sub.enabled) continue;
    if (sub.events.length && !sub.events.includes(event)) continue;
    if (sub.pathPrefix && !p.startsWith(sub.pathPrefix)) continue;
    const bodyText = render(sub.template, event, detail);
    const headers = { 'Content-Type': sub.template ? 'text/plain' : 'application/json', 'X-FS-Event': event };
    if (sub.secret) headers['X-FS-Secret'] = sub.secret;
    fetch(sub.url, { method: 'POST', headers, body: bodyText, signal: AbortSignal.timeout(10000) })
      .then((res) => { sub.lastStatus = res.status; writeAll(readAll().map((s) => (s.id === sub.id ? { ...s, lastStatus: res.status, deliveries: (s.deliveries || 0) + 1 } : s))); })
      .catch(() => { });
    changed = true;
  }
  return changed;
}
