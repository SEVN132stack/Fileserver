import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { config } from './config.js';

// Roteer het audit-log als het te groot wordt: hernoem naar .1, .2, ... en
// bewaar de laatste K bestanden.
function rotateIfNeeded() {
  try {
    const st = fs.statSync(config.auditLog);
    if (st.size < config.logMaxBytes) return;
  } catch {
    return; // bestaat nog niet
  }
  const keep = config.logKeep;
  try {
    const oldest = `${config.auditLog}.${keep}`;
    if (fs.existsSync(oldest)) fs.rmSync(oldest);
    for (let i = keep - 1; i >= 1; i--) {
      const src = `${config.auditLog}.${i}`;
      if (fs.existsSync(src)) fs.renameSync(src, `${config.auditLog}.${i + 1}`);
    }
    fs.renameSync(config.auditLog, `${config.auditLog}.1`);
  } catch (err) {
    console.error('[audit] rotatie mislukt:', err.message);
  }
}

// --- Onvervalsbaar audit-log (hash-keten) ---
// Elke regel bevat een `hash` = sha256(prevHash + kern-inhoud). De keten loopt
// door over rotaties heen; de laatste hash staat in een sidecar-bestand zodat
// hij een herstart overleeft. Wie een regel wijzigt of verwijdert breekt de
// keten, wat bij verificatie zichtbaar wordt.
const chainFile = () => config.auditLog + '.chain';
let lastHash = null;

function loadLastHash() {
  if (lastHash !== null) return lastHash;
  try { lastHash = fs.readFileSync(chainFile(), 'utf8').trim(); }
  catch { lastHash = ''; }
  return lastHash;
}

function entryHash(prev, core) {
  return createHash('sha256').update(prev + '\n' + core).digest('hex');
}

// Schrijf een regel naar het audit-log: wie deed wat, wanneer en via welk
// kanaal (web of sftp). Append-only, één JSON-object per regel, hash-geketend.
export function audit(channel, user, action, detail = {}) {
  const core = {
    ts: new Date().toISOString(),
    channel,
    user: user || null,
    action,
    ...detail,
  };
  const prev = loadLastHash();
  const coreStr = JSON.stringify(core);
  const hash = entryHash(prev, coreStr);
  const entry = { ...core, prev: prev || null, hash };
  try {
    rotateIfNeeded();
    fs.appendFileSync(config.auditLog, JSON.stringify(entry) + '\n');
    fs.writeFileSync(chainFile(), hash, { mode: 0o600 });
    lastHash = hash;
  } catch (err) {
    console.error('[audit] kon niet schrijven:', err.message);
  }
  // Optioneel doorsturen naar een SIEM/extern log-endpoint (fire-and-forget).
  if (config.siemUrl) {
    fetch(config.siemUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      .catch(() => {});
  }
}

// Verifieer de hash-keten van het huidige audit-log (en optioneel de geroteerde
// bestanden). Geeft terug of de keten intact is en zo niet, de eerste regel die
// niet klopt. Regels zonder hash (van vóór deze functie) worden overgeslagen.
export function verifyChain() {
  const files = [];
  for (let i = config.logKeep; i >= 1; i--) {
    const f = `${config.auditLog}.${i}`;
    if (fs.existsSync(f)) files.push(f);
  }
  if (fs.existsSync(config.auditLog)) files.push(config.auditLog);

  let prev = '';
  let checked = 0;
  let line = 0;
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
    for (const l of raw) {
      line++;
      let e;
      try { e = JSON.parse(l); } catch { return { ok: false, brokenAt: line, reason: 'ongeldige JSON' }; }
      if (!e.hash) { continue; } // legacy-regel zonder keten: overslaan, keten hervat
      const { hash, prev: entryPrev, ...core } = e;
      const expect = entryHash(entryPrev || '', JSON.stringify(core));
      if (expect !== hash) return { ok: false, brokenAt: line, reason: 'hash klopt niet' };
      if (prev && entryPrev && entryPrev !== prev) return { ok: false, brokenAt: line, reason: 'keten onderbroken (ontbrekende regel?)' };
      prev = hash;
      checked++;
    }
  }
  return { ok: true, checked };
}
