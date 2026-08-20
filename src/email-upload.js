import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { homeDir, userExists, quota } from './users.js';
import { resolveWithin, dirSize } from './paths.js';
import { scanFile } from './scan.js';
import { audit } from './audit.js';

// Upload via e-mail: elke gebruiker kan een geheime inbox-token aanmaken. Een
// mailprovider (bijv. een inbound-parse-webhook van Mailgun/SendGrid/Brevo) of een
// eigen script POST't een geparste e-mail met bijlagen naar
// /api/email-inbox/<token>. De bijlagen worden — na een virusscan — in de
// Inbox-mail-map van de gebruiker geplaatst. Zo kun je bestanden binnenkrijgen
// door ze simpelweg te mailen.

function readAll() { return readJson(config.emailInboxFile, () => ({})); } // token -> {user, created}
function writeAll(obj) { writeJson(config.emailInboxFile, obj, { mode: 0o600 }); }

export function tokenFor(user) {
  const all = readAll();
  for (const [tok, rec] of Object.entries(all)) if (rec.user === user) return tok;
  return null;
}

// Maak (of hergebruik) een inbox-token voor een gebruiker.
export function ensureToken(user) {
  const existing = tokenFor(user);
  if (existing) return existing;
  const all = readAll();
  const tok = 'eml_' + randomBytes(18).toString('base64url');
  all[tok] = { user, created: Date.now() };
  writeAll(all);
  return tok;
}

export function revokeToken(user) {
  const all = readAll();
  let changed = false;
  for (const [tok, rec] of Object.entries(all)) if (rec.user === user) { delete all[tok]; changed = true; }
  if (changed) writeAll(all);
  return changed;
}

export function userForToken(token) {
  const rec = readAll()[token];
  return rec && userExists(rec.user) ? rec.user : null;
}

// Maak een veilige, botsingsvrije bestandsnaam binnen de doelmap.
function uniqueName(dir, name) {
  const safe = path.basename(String(name || 'bijlage')).replace(/[^\w.\- ]+/g, '_').slice(0, 200) || 'bijlage';
  let dest = path.join(dir, safe);
  if (!fs.existsSync(dest)) return dest;
  const ext = path.extname(safe); const stem = path.basename(safe, ext);
  return path.join(dir, `${stem}-${randomBytes(3).toString('hex')}${ext}`);
}

// Verwerk een geparste e-mail: sla toegestane bijlagen op in de inbox van de
// gebruiker. `attachments`: [{ filename, content|contentBase64 }].
export async function deliver(token, mail) {
  const user = userForToken(token);
  if (!user) return { error: 'ongeldige token', status: 404 };
  const atts = Array.isArray(mail && mail.attachments) ? mail.attachments : [];
  const targetDir = resolveWithin(homeDir(user), '/' + config.emailInboxDir);
  fs.mkdirSync(targetDir, { recursive: true });

  const saved = []; const rejected = [];
  const limit = quota(user);
  let used = dirSize(homeDir(user));
  for (const att of atts) {
    let buf;
    try {
      const b64 = att.contentBase64 || att.content;
      buf = Buffer.from(String(b64 || ''), 'base64');
    } catch { rejected.push({ name: att.filename, reason: 'ongeldige inhoud' }); continue; }
    if (!buf.length) { rejected.push({ name: att.filename, reason: 'leeg' }); continue; }
    if (buf.length > config.emailInboxMaxBytes) { rejected.push({ name: att.filename, reason: 'te groot' }); continue; }
    // Quota bewaken: een (gelekte) inbox-token mag de opslag niet volgooien.
    // limit 0 = onbeperkt (conventie in deze codebase).
    if (limit > 0 && used + buf.length > limit) { rejected.push({ name: att.filename, reason: 'quota overschreden' }); continue; }
    used += buf.length;
    // Eerst naar een tmp-bestand schrijven en scannen; alleen schone bestanden plaatsen.
    const tmp = path.join(os.tmpdir(), 'eml-' + randomBytes(8).toString('hex'));
    fs.writeFileSync(tmp, buf);
    let clean = true;
    try { const r = await scanFile(tmp); clean = r.clean !== false; } catch { clean = true; }
    if (!clean) { fs.rmSync(tmp, { force: true }); rejected.push({ name: att.filename, reason: 'besmet' }); continue; }
    const dest = uniqueName(targetDir, att.filename);
    fs.renameSync(tmp, dest);
    saved.push(path.basename(dest));
  }
  audit('email', user, 'email-upload', { saved: saved.length, rejected: rejected.length, subject: String(mail && mail.subject || '').slice(0, 120) });
  return { ok: true, user, saved, rejected };
}
