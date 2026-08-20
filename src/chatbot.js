import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { homeDir, userExists } from './users.js';
import { resolveWithin } from './paths.js';
import { audit } from './audit.js';

// Chat-bot (Slack/Teams/Discord): een inkomend commando-endpoint dat via een
// gedeelde token wordt beschermd. Een slash-command of bot-integratie POST't een
// tekstcommando en krijgt een tekstantwoord terug. De bot werkt in de home van
// CHAT_BOT_USER. Uitgaande meldingen lopen al via WEBHOOK_URL (notify.js).
//
// Ondersteunde commando's:
//   help                — toon hulp
//   list [pad]          — toon de inhoud van een map
//   search <term>       — zoek bestanden op naam (recursief, begrensd)

export function enabled() {
  return !!(config.chatBotToken && config.chatBotUser && userExists(config.chatBotUser));
}
export function checkToken(token) {
  return enabled() && token === config.chatBotToken;
}

const HELP = [
  'Beschikbare commando\'s:',
  '• `list [pad]` — toon de inhoud van een map',
  '• `search <term>` — zoek bestanden op naam',
  '• `help` — deze hulp',
].join('\n');

function listDir(home, rel) {
  const dir = resolveWithin(home, rel || '/');
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return `Map niet gevonden: ${rel || '/'}`; }
  if (!entries.length) return `(leeg) ${rel || '/'}`;
  const lines = entries.slice(0, 100).map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`);
  const more = entries.length > 100 ? `\n… en nog ${entries.length - 100}` : '';
  return `Inhoud van ${rel || '/'}:\n${lines.join('\n')}${more}`;
}

// Recursief op bestandsnaam zoeken, begrensd op bezochte items en resultaten.
function searchNames(home, term) {
  const q = String(term).toLowerCase();
  const results = []; let visited = 0;
  const walk = (abs, rel) => {
    if (visited > 5000 || results.length >= 50) return;
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (visited > 5000 || results.length >= 50) return;
      visited++;
      const childRel = (rel === '/' ? '' : rel) + '/' + e.name;
      if (e.name.toLowerCase().includes(q)) results.push(childRel);
      if (e.isDirectory()) walk(path.join(abs, e.name), childRel);
    }
  };
  walk(home, '/');
  if (!results.length) return `Geen bestanden gevonden voor "${term}".`;
  return `Gevonden (${results.length}):\n${results.map((r) => `📄 ${r}`).join('\n')}`;
}

// Verwerk één commando-tekst en geef een tekstantwoord.
export function handle(text) {
  if (!enabled()) return 'Chat-bot staat uit.';
  const home = homeDir(config.chatBotUser);
  const raw = String(text || '').trim();
  const [cmd, ...rest] = raw.split(/\s+/);
  const arg = rest.join(' ');
  let reply;
  switch ((cmd || '').toLowerCase()) {
    case 'help': case '': reply = HELP; break;
    case 'list': case 'ls': reply = listDir(home, arg || '/'); break;
    case 'search': case 'find': reply = arg ? searchNames(home, arg) : 'Gebruik: search <term>'; break;
    default: reply = `Onbekend commando: "${cmd}". Typ \`help\` voor hulp.`;
  }
  audit('chatbot', config.chatBotUser, 'chatbot-command', { cmd: (cmd || '').toLowerCase() });
  return reply;
}
