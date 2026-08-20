import { execFile } from 'node:child_process';
import { config } from './config.js';

// AI-assistent: stuur een prompt naar een extern commando (AI_CMD) dat de prompt
// op stdin ontvangt en het antwoord naar stdout schrijft. Zo kun je een lokale
// LLM-CLI aansluiten zonder de rest van de server aan te passen. Leeg = uit.

export function hasAi() { return !!config.aiCmd; }

// Bouw een prompt met optionele bestandscontext (begrensd op aiMaxContext tekens).
export function buildPrompt(question, context) {
  const q = String(question || '').slice(0, 4000);
  if (!context) return q;
  const ctx = String(context).slice(0, config.aiMaxContext);
  return `Context:\n${ctx}\n\nVraag: ${q}\n\nAntwoord in het Nederlands.`;
}

// Draai het AI-commando met de prompt op stdin. Belooft de tekst uit stdout.
export function ask(question, context) {
  return new Promise((resolve, reject) => {
    if (!config.aiCmd) { reject(new Error('ai disabled')); return; }
    const prompt = buildPrompt(question, context);
    const [cmd, ...args] = config.aiCmd.split(' ');
    const child = execFile(cmd, args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) { reject(new Error(stderr || err.message)); return; }
      resolve(String(stdout || '').trim());
    });
    child.stdin.end(prompt);
  });
}
