// Preload voor de schaduw-instantie (via --import): blokkeert alle uitgaande
// netwerkverbindingen behalve loopback. De schaduw draait met een kopie van de
// echte datastores (webhook-wachtrij, abonnementen, geplande rapporten…); zonder
// deze sandbox zou hij echte webhooks/e-mails/SIEM-berichten kunnen versturen.
import net from 'node:net';
import dns from 'node:dns';

const LOOPBACK = /^(127\.|::1$|::ffff:127\.|localhost$)/i;
const deny = (host) => { const e = new Error(`schaduw-sandbox: uitgaande verbinding naar ${host} geblokkeerd`); e.code = 'ESHADOWBLOCKED'; return e; };

const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const o = typeof args[0] === 'object' && args[0] !== null ? (Array.isArray(args[0]) ? args[0][0] : args[0]) : { port: args[0], host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  const host = o && (o.host || o.hostname || (o.path ? 'unix' : 'localhost'));
  if (o && !o.path && !LOOPBACK.test(String(host))) {
    process.nextTick(() => this.destroy(deny(host)));
    return this;
  }
  return origConnect.apply(this, args);
};

const origFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input));
  if (!LOOPBACK.test(url.hostname.replace(/^\[|\]$/g, ''))) throw deny(url.hostname);
  return origFetch(input, init);
};

// DNS-lookups naar buiten zijn niet nodig; ook blokkeren (geen datalek via DNS).
const origLookup = dns.lookup;
dns.lookup = (host, ...rest) => {
  const cb = rest[rest.length - 1];
  if (!LOOPBACK.test(String(host))) return process.nextTick(() => cb(deny(host)));
  return origLookup(host, ...rest);
};
