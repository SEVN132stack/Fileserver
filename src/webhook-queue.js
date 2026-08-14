import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { formatWebhook } from './notify.js';

// Betrouwbare uitgaande webhooks: berichten worden in een wachtrij gezet en met
// exponentiële backoff opnieuw geprobeerd tot ze slagen of het maximum bereiken.
// Een afleveringslog houdt de laatste pogingen bij (zichtbaar voor de admin).

let queue = [];   // { id, event, detail, attempts, nextTry }
let log = [];     // { id, event, ok, status, attempts, ts }

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(config.webhookQueueFile, 'utf8'));
    queue = d.queue || []; log = d.log || [];
  } catch { queue = []; log = []; }
}
function save() {
  try { fs.writeFileSync(config.webhookQueueFile, JSON.stringify({ queue, log: log.slice(-200) }), { mode: 0o600 }); }
  catch { /* negeren */ }
}
load();

export function enqueue(event, detail = {}) {
  if (!config.webhookUrl) return;
  queue.push({ id: randomBytes(6).toString('hex'), event, detail, attempts: 0, nextTry: Date.now() });
  save();
}

export function deliveryLog() { return [...log].reverse(); }
export function queueLength() { return queue.length; }

async function attempt(item) {
  const fmt = formatWebhook(config.webhookType, item.event, item.detail);
  try {
    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: fmt.raw ? fmt.headers : { 'Content-Type': 'application/json', ...fmt.headers },
      body: fmt.raw ? fmt.body : JSON.stringify(fmt.body),
    });
    item.attempts++;
    if (res.ok) { log.push({ id: item.id, event: item.event, ok: true, status: res.status, attempts: item.attempts, ts: Date.now() }); return true; }
    return false;
  } catch { item.attempts++; return false; }
}

// Verwerk de wachtrij: probeer alle items waarvan de nextTry verstreken is.
export async function processQueue() {
  if (!config.webhookUrl || !queue.length) return;
  const now = Date.now();
  const remaining = [];
  for (const item of queue) {
    if (item.nextTry > now) { remaining.push(item); continue; }
    const ok = await attempt(item);
    if (ok) continue;
    if (item.attempts >= config.webhookMaxRetries) {
      log.push({ id: item.id, event: item.event, ok: false, status: 0, attempts: item.attempts, ts: Date.now() });
      continue; // opgegeven
    }
    item.nextTry = now + Math.min(3600000, 1000 * 2 ** item.attempts); // exponentiële backoff, max 1u
    remaining.push(item);
  }
  queue = remaining;
  save();
}

export function startWebhookWorker() {
  if (!config.webhookUrl) return;
  setInterval(() => { processQueue().catch(() => {}); }, 15000).unref();
}
