import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';

// QR-apparaatkoppeling. Stroom:
// 1. Een ingelogd apparaat start een koppeling -> korte, eenmalige code (+ QR).
// 2. Het nieuwe apparaat (niet ingelogd) scant de QR en "claimt" de code. Het
//    krijgt een eigen claim-geheim terug dat alleen dat apparaat kent.
// 3. Het ingelogde apparaat ziet wie wil koppelen (browser + IP) en keurt goed
//    of af. Er gebeurt NIETS zonder expliciete goedkeuring.
// 4. Het nieuwe apparaat vraagt de status op met code + claim-geheim en krijgt
//    na goedkeuring precies één keer een sessie.
//
// Codes leven alleen in het geheugen (nooit op schijf) en verlopen snel; een
// herstart maakt lopende koppelingen ongeldig.

const TTL_MS = 3 * 60 * 1000; // code geldig voor claimen/goedkeuren
const pairings = new Map(); // code -> record

function sweep() {
  const now = Date.now();
  for (const [code, p] of pairings) if (p.expires < now) pairings.delete(code);
}

function safeEq(a, b) {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

export function startPairing(user) {
  sweep();
  // Per gebruiker maximaal een paar openstaande koppelingen.
  let open = 0; for (const p of pairings.values()) if (p.user === user) open++;
  if (open >= 5) throw new Error('Te veel openstaande koppelingen');
  const code = randomBytes(24).toString('base64url');
  pairings.set(code, { user, created: Date.now(), expires: Date.now() + TTL_MS, status: 'waiting', claim: null, claimSecret: null });
  return { code, expires: Date.now() + TTL_MS };
}

// Het nieuwe apparaat claimt de code (eenmalig).
export function claim(code, { ua = '', ip = '', name = '' } = {}) {
  sweep();
  const p = pairings.get(String(code || ''));
  if (!p || p.status !== 'waiting') return null;
  p.status = 'claimed';
  p.claim = { ua: String(ua).slice(0, 300), ip: String(ip).slice(0, 64), name: String(name).replace(/[^\w .-]/g, '').slice(0, 40), at: Date.now() };
  p.claimSecret = randomBytes(24).toString('base64url');
  // Controlecode afgeleid van het claim-geheim (dat alleen het claimende apparaat
  // kent), NIET van de QR-code: wie de QR meekijkt en zelf claimt, toont een andere code.
  p.checkCode = createHash('sha256').update(p.claimSecret).digest('hex').slice(0, 6).toUpperCase();
  return { claimSecret: p.claimSecret, checkCode: p.checkCode, expires: p.expires };
}

// Het ingelogde apparaat bekijkt de status van zijn eigen koppeling.
export function pendingFor(user, code) {
  sweep();
  const p = pairings.get(String(code || ''));
  if (!p || p.user !== user) return null;
  return { status: p.status, claim: p.claim, checkCode: p.checkCode || null, expires: p.expires };
}

export function decide(user, code, approve) {
  sweep();
  const p = pairings.get(String(code || ''));
  if (!p || p.user !== user || p.status !== 'claimed') return null;
  p.status = approve ? 'approved' : 'denied';
  if (!approve) setTimeout(() => pairings.delete(code), 30000).unref?.();
  return { status: p.status, claim: p.claim };
}

// Het nieuwe apparaat vraagt de status op. Bij 'approved' + juist geheim wordt de
// koppeling afgerond (eenmalig) en krijgt de aanroeper de gebruikersnaam terug.
export function poll(code, claimSecret) {
  sweep();
  const p = pairings.get(String(code || ''));
  if (!p || !p.claimSecret || !safeEq(claimSecret, p.claimSecret)) return { status: 'invalid' };
  if (p.status === 'approved') {
    pairings.delete(code); // eenmalig
    return { status: 'approved', user: p.user, claim: p.claim };
  }
  return { status: p.status };
}

// Alleen voor tests.
export function _reset() { pairings.clear(); }
