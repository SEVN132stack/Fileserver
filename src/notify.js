import { config } from './config.js';

// Bouw de webhook-payload in het formaat van de gekozen dienst, zodat berichten
// er netjes uitzien in Slack/Discord/Teams/ntfy i.p.v. ruwe JSON.
// Kleur per soort gebeurtenis (Discord-embeds).
const DISCORD_COLORS = { alert: 15105570, quarantine: 15158332, delete: 15158332, upload: 3066993, lifecycle_warn: 15105570 };

export function formatWebhook(type, event, detail) {
  const text = `[${event}] ` + Object.entries(detail).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ');
  switch (type) {
    case 'slack': return { headers: {}, body: { text: `*${event}*\n${text}` } };
    case 'discord': {
      // Embed met titel (onderwerp) en tekst, zoals de deploy-meldingen; overige
      // velden als regels eronder.
      const { subject, message, key, ...rest } = detail;
      const extra = Object.entries(rest).map(([k, v]) => `**${k}**: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
      const description = [message, extra].filter(Boolean).join('\n\n').slice(0, 4000);
      return { headers: {}, body: { username: 'Fileserver', embeds: [{ title: String(subject || event).slice(0, 250), description, color: DISCORD_COLORS[event] || 3447003, timestamp: new Date().toISOString() }] } };
    }
    case 'teams': return { headers: {}, body: { text: `**${event}** — ${text}` } };
    case 'ntfy': return { headers: { 'Content-Type': 'text/plain', Title: event }, body: text, raw: true };
    default: return { headers: {}, body: { event, ...detail, ts: new Date().toISOString() } };
  }
}

// Stuur een notificatie naar een webhook (Slack/Discord/Teams/ntfy/generiek).
// Doet niets als er geen WEBHOOK_URL is ingesteld. Faalt stil.
// Hoort deze gebeurtenis bij WEBHOOK_EVENTS (leeg = alles)?
export const webhookWants = (event) => !config.webhookEvents.length || config.webhookEvents.includes(event);

export function notify(event, detail = {}) {
  if (!config.webhookUrl || !webhookWants(event)) return;
  const fmt = formatWebhook(config.webhookType, event, detail);
  fetch(config.webhookUrl, {
    method: 'POST',
    headers: fmt.raw ? fmt.headers : { 'Content-Type': 'application/json', ...fmt.headers },
    body: fmt.raw ? fmt.body : JSON.stringify(fmt.body),
  }).catch((err) => console.error('[notify] webhook mislukt:', err.message));
}
