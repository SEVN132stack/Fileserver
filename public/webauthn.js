'use strict';
// Browser-helpers voor WebAuthn/passkeys: vertaal de server-opties naar de
// native WebAuthn-API en terug (base64url-codering).
const b64uToBuf = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); const pad = s.length % 4 ? 4 - (s.length % 4) : 0; s += '='.repeat(pad); const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b.buffer; };
const bufToB64u = (buf) => { const b = new Uint8Array(buf); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

window.fseWebAuthnCreate = async function (opts) {
  opts.challenge = b64uToBuf(opts.challenge);
  opts.user.id = b64uToBuf(opts.user.id);
  if (opts.excludeCredentials) opts.excludeCredentials = opts.excludeCredentials.map((c) => ({ ...c, id: b64uToBuf(c.id) }));
  const cred = await navigator.credentials.create({ publicKey: opts });
  return serializeCredential(cred);
};

window.fseWebAuthnGet = async function (opts) {
  opts.challenge = b64uToBuf(opts.challenge);
  if (opts.allowCredentials) opts.allowCredentials = opts.allowCredentials.map((c) => ({ ...c, id: b64uToBuf(c.id) }));
  const cred = await navigator.credentials.get({ publicKey: opts });
  return serializeCredential(cred);
};

function serializeCredential(cred) {
  const r = cred.response;
  const out = { id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type, clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}, response: {} };
  if (r.attestationObject) { out.response.attestationObject = bufToB64u(r.attestationObject); out.response.clientDataJSON = bufToB64u(r.clientDataJSON); }
  else { out.response.authenticatorData = bufToB64u(r.authenticatorData); out.response.clientDataJSON = bufToB64u(r.clientDataJSON); out.response.signature = bufToB64u(r.signature); if (r.userHandle) out.response.userHandle = bufToB64u(r.userHandle); }
  return out;
}
