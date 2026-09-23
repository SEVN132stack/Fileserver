import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { resolveWithin } from './paths.js';
import { audit } from './audit.js';

// Map-/projectsjablonen: een admin definieert benoemde sjablonen (een lijst
// mappen en bestanden). Een gebruiker instantieert zo'n sjabloon in één klik in
// een doelmap, bijv. een vaste projectstructuur met lege ondermappen en een
// README. Handig om nieuwe projecten consistent op te zetten.

function readAll() { return readJson(config.templatesFile, () => []); }
function writeAll(list) { writeJson(config.templatesFile, list, { mode: 0o600 }); }

export function listTemplates() { return readAll(); }
export function getTemplate(id) { return readAll().find((t) => t.id === id) || null; }

// entries: [{ path: 'subfolder/naam', type: 'dir'|'file', content?: '' }]
export function addTemplate({ name, entries }, owner) {
  if (!name) throw new Error('Naam verplicht');
  const clean = (Array.isArray(entries) ? entries : []).slice(0, 200).map((e) => ({
    path: String(e.path || '').replace(/^\/+/, '').slice(0, 300),
    type: e.type === 'file' ? 'file' : 'dir',
    content: e.type === 'file' ? String(e.content || '').slice(0, 20000) : undefined,
  })).filter((e) => e.path && !e.path.includes('..'));
  const list = readAll();
  const tpl = { id: randomBytes(5).toString('hex'), name: String(name).slice(0, 80), entries: clean, owner, created: Date.now() };
  list.push(tpl);
  writeAll(list);
  return tpl;
}

export function deleteTemplate(id) {
  const list = readAll();
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

// Instantieer een sjabloon in `basePath` binnen de home van de gebruiker.
// Bestaande bestanden/mappen worden nooit overschreven.
export function applyTemplate(home, basePath, id, user) {
  const tpl = getTemplate(id);
  if (!tpl) return { error: 'Sjabloon niet gevonden', status: 404 };
  const base = resolveWithin(home, basePath || '/');
  fs.mkdirSync(base, { recursive: true });
  let created = 0; const skipped = [];
  for (const e of tpl.entries) {
    let dest;
    try { dest = resolveWithin(home, path.posix.join(basePath || '/', e.path)); } catch { skipped.push(e.path); continue; }
    try {
      if (e.type === 'dir') { fs.mkdirSync(dest, { recursive: true }); created++; }
      else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (fs.existsSync(dest)) { skipped.push(e.path); continue; }
        fs.writeFileSync(dest, e.content || ''); created++;
      }
    } catch { skipped.push(e.path); }
  }
  audit('web', user, 'template_apply', { id, base: basePath, created });
  return { ok: true, created, skipped };
}
