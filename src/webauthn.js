import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { config } from './config.js';
import { getCredentials, addCredential, updateCredentialCounter } from './users.js';

// Passkeys / WebAuthn. Uitdagingen worden kort in het geheugen bewaard.
const challenges = new Map(); // key -> { challenge, expires }
const CH_TTL = 5 * 60 * 1000;

function putChallenge(key, challenge) {
  challenges.set(key, { challenge, expires: Date.now() + CH_TTL });
}
function takeChallenge(key) {
  const c = challenges.get(key);
  challenges.delete(key);
  if (!c || c.expires < Date.now()) return null;
  return c.challenge;
}

export async function registrationOptions(username) {
  const opts = await generateRegistrationOptions({
    rpName: config.webauthn.rpName,
    rpID: config.webauthn.rpID,
    userName: username,
    attestationType: 'none',
    excludeCredentials: getCredentials(username).map((c) => ({ id: c.credID })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  putChallenge('reg:' + username, opts.challenge);
  return opts;
}

export async function verifyRegistration(username, response) {
  const expectedChallenge = takeChallenge('reg:' + username);
  if (!expectedChallenge) throw new Error('Uitdaging verlopen');
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.webauthn.origin,
    expectedRPID: config.webauthn.rpID,
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error('Verificatie mislukt');
  const { credential } = verification.registrationInfo;
  addCredential(username, {
    credID: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
  });
  return true;
}

export async function authenticationOptions(username) {
  const opts = await generateAuthenticationOptions({
    rpID: config.webauthn.rpID,
    allowCredentials: getCredentials(username).map((c) => ({ id: c.credID })),
    userVerification: 'preferred',
  });
  putChallenge('auth:' + username, opts.challenge);
  return opts;
}

export async function verifyAuthentication(username, response) {
  const expectedChallenge = takeChallenge('auth:' + username);
  if (!expectedChallenge) throw new Error('Uitdaging verlopen');
  const cred = getCredentials(username).find((c) => c.credID === response.id);
  if (!cred) throw new Error('Onbekende passkey');
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.webauthn.origin,
    expectedRPID: config.webauthn.rpID,
    credential: {
      id: cred.credID,
      publicKey: Buffer.from(cred.publicKey, 'base64url'),
      counter: cred.counter,
    },
  });
  if (!verification.verified) throw new Error('Verificatie mislukt');
  updateCredentialCounter(username, cred.credID, verification.authenticationInfo.newCounter);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, c] of challenges) if (c.expires < now) challenges.delete(k);
}, 60000).unref();
