import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { readJson, writeJson } from './jsoncache.js';
import { homeDir, userExists } from './users.js';
import { resolveWithin } from './paths.js';

// Klantportalen: een gebrande, publieke ruimte gekoppeld aan één map in de home
// van de eigenaar. Een klant ziet daar de bestanden (downloaden) en kan — als dat
// is toegestaan — bestanden aanleveren. Toegang via een geheime token plus een
// optioneel wachtwoord. Alles blijft strikt binnen de portaalmap.

function readAll() { return readJson(config.portalsFile, () => ({})); } // token -> portal
function writeAll(obj) { writeJson(config.portalsFile, obj, { mode: 0o600 }); }

function hash(pw) {
  const salt = randomBytes(12).toString('hex');
  return `${salt}$${scryptSync(pw, salt, 32).toString('hex')}`;
}
function verify(pw, stored) {
  const [salt, h] = String(stored).split('$');
  const calc = scryptSync(String(pw), salt, 32);
  const known = Buffer.from(h, 'hex');
  return calc.length === known.length && timingSafeEqual(calc, known);
}

const COLOR = /^#[0-9a-fA-F]{3,8}$/;

export function createPortal(owner, { name, path: p, title = '', accent = '', allowUpload = false, password = '', expiresInDays = 0 }) {
  if (!name) throw new Error('Naam verplicht');
  // Valideer dat de map bestaat binnen de home van de eigenaar.
  const base = resolveWithin(homeDir(owner), p || '/');
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) throw new Error('Map niet gevonden');
  const all = readAll();
  const token = 'pt_' + randomBytes(18).toString('base64url');
  const days = Math.max(0, parseInt(expiresInDays, 10) || 0);
  all[token] = {
    owner,
    name: String(name).slice(0, 80),
    path: p || '/',
    title: String(title || name).slice(0, 120),
    accent: COLOR.test(String(accent)) ? String(accent) : '',
    allowUpload: !!allowUpload,
    password: password ? hash(String(password)) : null,
    expires: days ? Date.now() + days * 86400000 : 0,
    created: Date.now(),
    views: 0, uploads: 0,
  };
  writeAll(all);
  return token;
}

export function listPortals(owner) {
  return Object.entries(readAll())
    .filter(([, v]) => v.owner === owner)
    .map(([token, v]) => ({ token, name: v.name, path: v.path, title: v.title, allowUpload: v.allowUpload, hasPassword: !!v.password, expires: v.expires, views: v.views, uploads: v.uploads }));
}

export function deletePortal(owner, token) {
  const all = readAll();
  if (!all[token] || all[token].owner !== owner) return false;
  delete all[token];
  writeAll(all);
  return true;
}

// Haal een geldig portaal op (verlopen of eigenaar weg = null).
export function getPortal(token) {
  const all = readAll();
  const p = all[token];
  if (!p) return null;
  if (p.expires && p.expires < Date.now()) return null;
  if (!userExists(p.owner)) return null;
  return p;
}

export function checkPassword(portal, pw) {
  if (!portal.password) return true;
  if (!pw) return false;
  try { return verify(pw, portal.password); } catch { return false; }
}

export function bump(token, field) {
  const all = readAll();
  if (!all[token]) return;
  all[token][field] = (all[token][field] || 0) + 1;
  writeAll(all);
}

// Los een pad binnen het portaal op (nooit erbuiten).
export function resolveInPortal(portal, sub = '') {
  const base = resolveWithin(homeDir(portal.owner), portal.path);
  const clean = String(sub || '').replace(/\\/g, '/');
  const abs = path.resolve(base, '.' + (clean.startsWith('/') ? clean : '/' + clean));
  if (abs !== base && !abs.startsWith(base + path.sep)) throw new Error('Pad buiten portaal');
  return { base, abs };
}

// Lijst de inhoud van een (sub)map in het portaal (verborgen items weggelaten).
export function listing(portal, sub = '') {
  const { abs } = resolveInPortal(portal, sub);
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => {
      let size = 0; try { if (!e.isDirectory()) size = fs.statSync(path.join(abs, e.name)).size; } catch { /* nvt */ }
      return { name: e.name, isDir: e.isDirectory(), size };
    })
    .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
}
