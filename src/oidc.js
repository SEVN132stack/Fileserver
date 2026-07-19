import { randomBytes } from 'node:crypto';
import { config } from './config.js';

// Minimale OpenID Connect (Authorization Code Flow). Optioneel en standaard uit.
// Provisioneert automatisch een lokale gebruiker op basis van de claims.

let meta = null;
const states = new Map(); // state -> vervaltijd

async function discovery() {
  if (meta) return meta;
  const url = config.oidc.issuer.replace(/\/$/, '') + '/.well-known/openid-configuration';
  meta = await (await fetch(url)).json();
  return meta;
}

export async function getAuthUrl() {
  const m = await discovery();
  const state = randomBytes(16).toString('hex');
  states.set(state, Date.now() + 600000);
  const p = new URLSearchParams({
    client_id: config.oidc.clientId,
    redirect_uri: config.oidc.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  return `${m.authorization_endpoint}?${p}`;
}

export function validState(state) {
  const exp = states.get(state);
  if (!exp || exp < Date.now()) return false;
  states.delete(state);
  return true;
}

function decodeJwt(token) {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
}

// Wissel de code in voor tokens en geef de gebruikersclaims terug.
export async function exchange(code) {
  const m = await discovery();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.oidc.redirectUri,
    client_id: config.oidc.clientId,
    client_secret: config.oidc.clientSecret,
  });
  const res = await fetch(m.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokens = await res.json();
  if (!tokens.id_token) throw new Error('Geen id_token ontvangen');
  const claims = decodeJwt(tokens.id_token);
  return {
    username: claims.preferred_username || claims.email || claims.sub,
    email: claims.email,
  };
}
