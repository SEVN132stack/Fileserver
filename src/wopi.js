import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

// Koppeling met Collabora Online via WOPI. De fileserver is de WOPI-host:
// Collabora haalt het bestand op en slaat het op via /wopi/files/<id>, met een
// ondertekend, kortlevend token (geen sessie-cookie; Collabora praat server-
// naar-server). Het file-id is een hash van het absolute pad: hetzelfde bestand
// in meerdere tabbladen/apparaten — en de eigenaar plus gebruikers met wie het
// gedeeld is — komt in dezelfde Collabora-sessie (samen bewerken).

export const OFFICE = /\.(docx?|odt|rtf|xlsx?|ods|csv|pptx?|odp)$/i;
export const enabled = () => !!config.collaboraUrl;
export const canEdit = (name) => enabled() && OFFICE.test(name) && !/\.csv$/i.test(name);

export const fileId = (absPath) => createHash('sha256').update(absPath).digest('base64url').slice(0, 32);

const sign = (data) => createHmac('sha256', config.sessionSecret).update('wopi\0' + data).digest('base64url');

// Intrekken: tokens die vóór dit moment zijn uitgegeven gelden niet meer (bij
// uitloggen overal, wachtwoordwijziging, sessies intrekken). In het geheugen,
// net als de sessies zelf.
const revokedAt = new Map();
export function revokeUser(user) { revokedAt.set(user, Date.now()); }

// Token: base64url(JSON{u,o,p,w,id,iat,exp}).handtekening. o = eigenaar van het
// bestand bij een met de gebruiker gedeeld bestand (anders leeg: eigen home).
export function makeToken({ user, owner, path, write, id }) {
  const iat = Date.now();
  const exp = iat + config.wopiTokenHours * 3600000;
  const data = Buffer.from(JSON.stringify({ u: user, o: owner || undefined, p: path, w: !!write, id, iat, exp })).toString('base64url');
  return { token: `${data}.${sign(data)}`, ttl: exp };
}

export function verifyToken(token, id) {
  const [data, sig] = String(token || '').split('.');
  if (!data || !sig) return null;
  const want = Buffer.from(sign(data)); const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let t; try { t = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); } catch { return null; }
  if (!t || t.exp < Date.now() || t.id !== id) return null;
  if (revokedAt.has(t.u) && !(t.iat > revokedAt.get(t.u))) return null;
  return { user: t.u, owner: t.o || null, path: t.p, write: !!t.w };
}

// Discovery: per extensie de editor-URL (urlsrc) van Collabora. Een uur gecachet.
// Collabora zet daarin het adres waarop het zelf werd aangesproken (intern,
// bv. 127.0.0.1:9980); de browser moet via het publieke domein (publicBase),
// waar de reverse proxy /browser e.d. naar Collabora doorstuurt.
let cache = { at: 0, map: null };
export async function actionUrl(ext, publicBase) {
  if (!cache.map || Date.now() - cache.at > 3600000) {
    const r = await fetch(config.collaboraUrl + '/hosting/discovery', { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('Collabora niet bereikbaar (' + r.status + ')');
    const xml = await r.text();
    const map = {};
    for (const m of xml.matchAll(/<action\b[^>]*>/g)) {
      const a = m[0];
      const name = /\bname="([^"]+)"/.exec(a)?.[1]; const e = /\bext="([^"]+)"/.exec(a)?.[1]; const url = /\burlsrc="([^"]+)"/.exec(a)?.[1];
      if (!e || !url) continue;
      // 'edit' heeft voorrang boven 'view'.
      if (name === 'edit' || !map[e]) map[e] = url.replace(/&amp;/g, '&').replace(/<[^>]*>/g, '');
    }
    cache = { at: Date.now(), map };
  }
  const url = cache.map[ext.toLowerCase()];
  if (!url) throw new Error('Collabora kan .' + ext + ' niet openen');
  const u = new URL(url);
  return publicBase ? publicBase.replace(/\/$/, '') + u.pathname + u.search : url;
}
