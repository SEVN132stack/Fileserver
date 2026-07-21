import { config } from './config.js';

// Stuur een notificatie naar een webhook (bijv. Slack/Discord/eigen endpoint).
// Doet niets als er geen WEBHOOK_URL is ingesteld. Faalt stil.
export function notify(event, detail = {}) {
  if (!config.webhookUrl) return;
  const payload = { event, ...detail, ts: new Date().toISOString() };
  fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.error('[notify] webhook mislukt:', err.message));
}
