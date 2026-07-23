import { config } from './config.js';

// Bouw de webhook-payload in het formaat van de gekozen dienst, zodat berichten
// er netjes uitzien in Slack/Discord/Teams/ntfy i.p.v. ruwe JSON.
export function formatWebhook(type, event, detail) {
  const text = `[${event}] ` + Object.entries(detail).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ');
  switch (type) {
    case 'slack': return { headers: {}, body: { text: `*${event}*\n${text}` } };
    case 'discord': return { headers: {}, body: { content: `**${event}**\n${text}` } };
    case 'teams': return { headers: {}, body: { text: `**${event}** — ${text}` } };
    case 'ntfy': return { headers: { 'Content-Type': 'text/plain', Title: event }, body: text, raw: true };
    default: return { headers: {}, body: { event, ...detail, ts: new Date().toISOString() } };
  }
}

// Stuur een notificatie naar een webhook (Slack/Discord/Teams/ntfy/generiek).
// Doet niets als er geen WEBHOOK_URL is ingesteld. Faalt stil.
export function notify(event, detail = {}) {
  if (!config.webhookUrl) return;
  const fmt = formatWebhook(config.webhookType, event, detail);
  fetch(config.webhookUrl, {
    method: 'POST',
    headers: fmt.raw ? fmt.headers : { 'Content-Type': 'application/json', ...fmt.headers },
    body: fmt.raw ? fmt.body : JSON.stringify(fmt.body),
  }).catch((err) => console.error('[notify] webhook mislukt:', err.message));
}
