import fs from 'node:fs';
import { config } from './config.js';

// Gedeelde bestandscommentaren: zichtbaar voor iedereen die toegang heeft tot
// het bestand (i.t.t. de per-gebruiker metadata-comment). Opslag: één bestand
// met { "<eigenaar>|<pad>": [ {user, text, ts} ] }.
function read() {
  try {
    return JSON.parse(fs.readFileSync(config.commentsFile, 'utf8'));
  } catch {
    return {};
  }
}
function write(d) {
  fs.writeFileSync(config.commentsFile, JSON.stringify(d, null, 2), { mode: 0o600 });
}

const key = (owner, p) => `${owner}|${p}`;

export function getComments(owner, p) {
  return read()[key(owner, p)] || [];
}
export function addComment(owner, p, user, text) {
  const d = read();
  const k = key(owner, p);
  d[k] = d[k] || [];
  d[k].push({ user, text: String(text).slice(0, 2000), ts: Date.now() });
  write(d);
  return d[k];
}
export function deleteComment(owner, p, index, requester, isAdmin) {
  const d = read();
  const k = key(owner, p);
  const list = d[k];
  if (!list || !list[index]) return false;
  // Alleen de auteur, de eigenaar of een admin mag verwijderen.
  if (list[index].user !== requester && owner !== requester && !isAdmin) return false;
  list.splice(index, 1);
  write(d);
  return true;
}
