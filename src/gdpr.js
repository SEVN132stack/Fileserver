import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from './config.js';
import { getUser, deleteUser, homeDir } from './users.js';
import { listShares } from './shares.js';
import * as permalinks from './permalinks.js';
import { audit, rechainAll } from './audit.js';

// AVG/GDPR-toolkit: dataportabiliteit (alles exporteren) en het recht op
// vergetelheid (verwijderen + anonimiseren), beide met een audit-spoor.

function fileTree(dir, base = '') {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === config.trashName) continue;
    const full = path.join(dir, e.name);
    const rel = base + '/' + e.name;
    if (e.isDirectory()) out.push(...fileTree(full, rel));
    else { try { const st = fs.statSync(full); out.push({ path: rel, size: st.size, mtime: st.mtimeMs }); } catch { /* skip */ } }
  }
  return out;
}

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

// Verzamel alle gegevens die de app over deze gebruiker heeft.
export function exportUser(username) {
  const u = getUser(username);
  if (!u) throw new Error('Gebruiker niet gevonden');
  const { password, pwHistory, totp, ...profile } = u; // geen geheimen exporteren
  const comments = readJson(config.commentsFile) || {};
  const myComments = [];
  for (const [k, list] of Object.entries(comments)) for (const c of list) if (c.user === username) myComments.push({ key: k, ...c });
  const auditLines = [];
  try {
    for (const line of fs.readFileSync(config.auditLog, 'utf8').trim().split('\n')) {
      const e = JSON.parse(line); if (e.user === username) auditLines.push(e);
    }
  } catch { /* geen log */ }
  return {
    exportedAt: new Date().toISOString(),
    profile,
    files: fileTree(homeDir(username)),
    shares: listShares(username),
    permalinks: permalinks.listForUser ? permalinks.listForUser(username) : [],
    comments: myComments,
    auditTrail: auditLines,
  };
}

// Verwijder de gebruiker en al zijn gegevens; anonimiseer het audit-log zodat de
// geschiedenis (integriteit) blijft bestaan maar niet meer herleidbaar is.
export function forgetUser(username, requestedBy) {
  const u = getUser(username);
  if (!u) throw new Error('Gebruiker niet gevonden');
  const anon = 'anon-' + createHash('sha256').update(username).digest('hex').slice(0, 10);

  // 1. Bestanden verwijderen.
  try { fs.rmSync(homeDir(username), { recursive: true, force: true }); } catch { /* al weg */ }

  // 2. Uit de JSON-stores verwijderen (comments, tags, permalinks, shares, apikeys,
  //    notificaties, retentie, expiry, locks).
  for (const file of [config.commentsFile, config.tagsFile, config.permalinksFile, config.linksFile, config.sharesFile,
    config.apiKeysFile, config.notificationsFile, config.retentionFile, config.expiryFile, config.locksFile]) {
    const data = readJson(file);
    if (!data) continue;
    let changed = false;
    if (Array.isArray(data)) continue;
    for (const k of Object.keys(data)) {
      const v = data[k];
      // Sleutels die met de gebruiker(shome) beginnen, of records met .user.
      if (k === username || k.startsWith(homeDir(username) + '|') || k.startsWith(username + '|') || (v && v.user === username)) {
        delete data[k]; changed = true;
      } else if (Array.isArray(v)) {
        // Lijst-waarden (bijv. commentaren op andermans bestanden): verwijder de
        // items die door deze gebruiker zijn geplaatst, zodat er geen persoons-
        // gegevens achterblijven.
        const filtered = v.filter((item) => !(item && item.user === username));
        if (filtered.length !== v.length) {
          if (filtered.length) data[k] = filtered; else delete data[k];
          changed = true;
        }
      }
    }
    if (changed) { try { fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 }); } catch { /* negeren */ } }
  }

  // 3. Audit-log anonimiseren (gebruikersnaam vervangen; hashes worden opnieuw
  //    berekend zou de keten breken, dus we vervangen alleen het user-veld —
  //    de keten blijft over de originele inhoud verifieerbaar tot dit punt).
  try {
    const lines = fs.readFileSync(config.auditLog, 'utf8').trim().split('\n').filter(Boolean);
    const rewritten = lines.map((l) => { try { const e = JSON.parse(l); if (e.user === username) e.user = anon; return JSON.stringify(e); } catch { return l; } });
    fs.writeFileSync(config.auditLog, rewritten.join('\n') + '\n');
  } catch { /* geen log */ }

  // 4. Het account zelf verwijderen.
  deleteUser(username);
  audit('web', requestedBy || null, 'gdpr_forget', { subject: anon });
  // 5. De hash-keten herbouwen zodat integriteitsverificatie geldig blijft na
  //    de (wettelijk vereiste) anonimisering.
  try { rechainAll(); } catch { /* niet-fataal */ }
  return { ok: true, anonymizedAs: anon };
}
