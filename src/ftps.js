import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import tls from 'node:tls';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import selfsigned from 'selfsigned';
import { config } from './config.js';
import { resolveWithin, toClientPath as toClient, dirSize, invalidateDirSize } from './paths.js';
import { homeDir, verifyPassword, userExists, isReadonly, quota, isExpired, role } from './users.js';
import { checkAllowed, recordFailure, recordSuccess } from './ratelimit.js';
import { isBanned, ban } from './bans.js';
import { isBlockedIp } from './geoblock.js';
import { audit } from './audit.js';
import { recordMutation } from './ransomware.js';
import { checkHoneypot } from './honeypot.js';
import { retainedUntil } from './retention.js';
import { lockOwner } from './locks.js';
import { isE2ERequired } from './e2e-folders.js';
import { inspectUpload } from './inspect.js';

// FTPS-server (v3.45) voor apparaten en software die alleen FTP spreken
// (scanners, camera's, boekhoudpakketten). Bewust beperkt en streng:
//  - alleen versleuteld: expliciet (AUTH TLS) of impliciet (TLS vanaf het begin);
//    zonder TLS kan niemand inloggen en PROT P is verplicht voor data;
//  - alleen passieve modus (PASV/EPSV); de dataverbinding moet van hetzelfde IP
//    komen (geen FTP-bounce of het "stelen" van een datakanaal); PORT/EPRT = 502;
//  - dezelfde regels als SFTP: thuismap, quotum, alleen-lezen, bewaarplicht,
//    vergrendelingen, E2E-mappen, AV/DLP na upload, rate-limit/ban, audit.
// Uit zolang FTPS_PORT niet gezet is.

const LINE_MAX = 4096;
const IDLE_MS = 5 * 60000;
const DATA_WAIT_MS = 30000;
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function ftpsCredentials() {
  const c = config.ftps;
  for (const [cp, kp] of [[c.certPath, c.keyPath], [config.tls.certPath, config.tls.keyPath]]) {
    if (cp && kp && fs.existsSync(cp) && fs.existsSync(kp)) return { cert: fs.readFileSync(cp), key: fs.readFileSync(kp) };
  }
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'sftp-fileserver-ftps' }], { days: 3650, keySize: 2048, algorithm: 'sha256' });
  fs.mkdirSync(path.dirname(c.certPath), { recursive: true });
  fs.writeFileSync(c.certPath, pems.cert);
  fs.writeFileSync(c.keyPath, pems.private, { mode: 0o600 });
  console.log(`[ftps] Self-signed certificaat gegenereerd: ${c.certPath}`);
  return { cert: pems.cert, key: pems.private };
}

function listLine(name, st) {
  const d = st.mtime; const recent = Date.now() - d.getTime() < 180 * 86400000;
  const when = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${recent ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ' ' + d.getFullYear()}`;
  return `${st.isDirectory() ? 'd' : '-'}rw-r--r-- 1 ftp ftp ${String(st.size).padStart(12, ' ')} ${when} ${name}`;
}
const mlsTime = (d) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
const mlsLine = (name, st) => `type=${st.isDirectory() ? 'dir' : 'file'};size=${st.size};modify=${mlsTime(st.mtime)}; ${name}`;

let pasvCursor = 0;
function listenPasv(host) {
  const { pasvMin, pasvMax } = config.ftps;
  const span = Math.max(1, pasvMax - pasvMin + 1);
  return new Promise((resolve, reject) => {
    let tries = 0;
    const attempt = () => {
      if (tries++ >= Math.min(span, 50)) return reject(new Error('geen vrije passieve poort'));
      const port = pasvMin + (pasvCursor++ % span);
      const srv = net.createServer();
      srv.once('error', attempt);
      srv.listen(port, host, () => resolve(srv));
    };
    attempt();
  });
}

class Session {
  constructor(socket, secureContext, implicit) {
    this.sock = socket; this.ctx = secureContext; this.secure = implicit; this.protP = false;
    this.ip = (socket.remoteAddress || '').replace(/^::ffff:/, '');
    this.user = null; this.pendingUser = null; this.home = null; this.cwd = '/';
    this.rnfr = null; this.rest = 0; this.pasv = null; this.busy = false; this.closed = false;
    this.buf = '';
    // Impliciet: TLS vanaf het eerste byte, met dezelfde context als de datakanalen
    // (anders faalt TLS-sessiehervatting, die veel clients op het datakanaal eisen).
    if (implicit) { socket = new tls.TLSSocket(socket, { isServer: true, secureContext }); socket.on('error', () => this.close()); }
    this.attach(socket);
    this.reply(220, 'SFTP Fileserver FTPS gereed' + (implicit ? '' : ' (gebruik AUTH TLS)'));
  }

  attach(sock) {
    this.sock = sock;
    sock.setEncoding('utf8');
    sock.setTimeout(IDLE_MS, () => { this.reply(421, 'Tijd verstreken'); this.close(); });
    sock.on('data', (d) => this.onData(d));
    sock.on('error', () => this.close());
    sock.on('close', () => { if (sock === this.sock) this.close(); });
  }

  reply(code, text) { if (!this.closed) try { this.sock.write(`${code} ${text}\r\n`); } catch { /* weg */ } }
  multi(code, lines) { if (!this.closed) this.sock.write(`${code}-${lines[0]}\r\n${lines.slice(1).map((l) => ' ' + l + '\r\n').join('')}${code} Einde\r\n`); }

  close() {
    if (this.closed) return; this.closed = true;
    this.closePasv();
    try { this.sock.destroy(); } catch { /* weg */ }
  }
  closePasv() { if (this.pasv) { try { this.pasv.server.close(); } catch { /* weg */ } try { this.pasv.socket && this.pasv.socket.destroy(); } catch { /* weg */ } this.pasv = null; } }

  onData(d) {
    this.buf += d;
    if (this.buf.length > LINE_MAX && !this.buf.includes('\n')) { this.reply(500, 'Regel te lang'); return this.close(); }
    let i;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).replace(/\r$/, ''); this.buf = this.buf.slice(i + 1);
      this.queue = (this.queue || Promise.resolve()).then(() => this.handle(line)).catch(() => this.reply(451, 'Interne fout'));
    }
  }

  // --- hulpfuncties ---
  rel(arg) { const p = !arg ? this.cwd : arg.startsWith('/') ? arg : path.posix.join(this.cwd, arg); return path.posix.normalize('/' + p).replace(/\/+$/, '') || '/'; }
  abs(arg) { return resolveWithin(this.home, this.rel(arg)); }
  clientPath(abs) { return toClient(this.home, abs); }
  blocked(rel, checkE2E) {
    if (retainedUntil(this.home, rel)) return true;
    if (lockOwner(this.home, rel)) return true;
    if (checkE2E && isE2ERequired(this.home, path.posix.dirname(rel)) && !/\.enc$/i.test(rel)) return true;
    return false;
  }
  canWrite() { return !isReadonly(this.user); }

  async openData() {
    if (!this.pasv) throw Object.assign(new Error('Gebruik eerst PASV of EPSV'), { code: 425 });
    const p = this.pasv;
    const secure = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(Object.assign(new Error('Geen (versleutelde) dataverbinding'), { code: 425 })), DATA_WAIT_MS);
      p.waiter = (err, s) => { clearTimeout(t); if (err) reject(Object.assign(err, { code: 425 })); else resolve(s); };
      if (p.ready) p.waiter(...p.ready);
    });
    this.pasv = null; try { p.server.close(); } catch { /* weg */ }
    return secure;
  }

  async startPasv() {
    this.closePasv();
    const host = config.ftps.host === '::' ? '0.0.0.0' : config.ftps.host;
    const server = await listenPasv(host);
    const p = { server, socket: null, waiter: null, ready: null };
    server.on('connection', (s) => {
      const rip = (s.remoteAddress || '').replace(/^::ffff:/, '');
      if (rip !== this.ip || p.socket) { s.destroy(); audit('ftps', this.user, 'data_rejected', { ip: rip }); return; }
      // Direct TLS starten: de client stuurt zijn ClientHello meteen na verbinden.
      const secure = new tls.TLSSocket(s, { isServer: true, secureContext: this.ctx });
      p.socket = secure;
      const done = (err) => { const r = err ? [err] : [null, secure]; if (p.waiter) p.waiter(...r); else p.ready = r; };
      secure.once('secure', () => done(null));
      secure.once('error', (e) => done(e));
    });
    this.pasv = p;
    return server.address().port;
  }

  async sendData(text) {
    const d = await this.openData();
    this.reply(150, 'Gegevens volgen');
    await new Promise((resolve) => d.end(text, resolve));
    this.reply(226, 'Klaar');
  }

  async handle(line) {
    if (this.closed) return;
    const sp = line.indexOf(' ');
    const cmd = (sp < 0 ? line : line.slice(0, sp)).toUpperCase();
    const arg = sp < 0 ? '' : line.slice(sp + 1);

    // Altijd toegestaan
    if (cmd === 'QUIT') { this.reply(221, 'Tot ziens'); return this.close(); }
    if (cmd === 'NOOP') return this.reply(200, 'OK');
    if (cmd === 'FEAT') return this.multi(211, ['Mogelijkheden:', 'AUTH TLS', 'PBSZ', 'PROT', 'EPSV', 'PASV', 'MLSD', 'MLST type*;size*;modify*;', 'SIZE', 'MDTM', 'REST STREAM', 'UTF8']);
    if (cmd === 'SYST') return this.reply(215, 'UNIX Type: L8');
    if (cmd === 'OPTS') return this.reply(/^utf8 on$/i.test(arg) ? 200 : 501, /^utf8 on$/i.test(arg) ? 'UTF8 aan' : 'Niet ondersteund');
    if (cmd === 'AUTH') {
      if (!/^(TLS|SSL|TLS-C)$/i.test(arg)) return this.reply(504, 'Alleen AUTH TLS');
      if (this.secure) return this.reply(503, 'Al versleuteld');
      this.reply(234, 'Start TLS');
      const raw = this.sock; raw.removeAllListeners('data'); raw.removeAllListeners('close'); raw.removeAllListeners('error'); raw.setTimeout(0);
      const s = new tls.TLSSocket(raw, { isServer: true, secureContext: this.ctx });
      s.once('secure', () => { this.secure = true; });
      s.on('error', () => this.close());
      this.buf = '';
      return this.attach(s);
    }
    if (!this.secure) { return this.reply(530, 'Versleuteling vereist: gebruik AUTH TLS'); }
    if (cmd === 'PBSZ') return this.reply(200, 'PBSZ=0');
    if (cmd === 'PROT') { if (arg.toUpperCase() === 'P') { this.protP = true; return this.reply(200, 'Data versleuteld'); } return this.reply(536, 'Alleen PROT P'); }

    if (cmd === 'USER') { this.pendingUser = arg.trim().slice(0, 64); this.user = null; return this.reply(331, 'Wachtwoord vereist'); }
    if (cmd === 'PASS') return this.login(arg);
    if (!this.user) return this.reply(530, 'Eerst inloggen');

    try {
      switch (cmd) {
        case 'PWD': case 'XPWD': return this.reply(257, `"${this.cwd.replace(/"/g, '""')}" is de huidige map`);
        case 'TYPE': return this.reply(200, 'Type ingesteld');
        case 'MODE': return this.reply(arg.toUpperCase() === 'S' ? 200 : 504, 'Mode S');
        case 'STRU': return this.reply(arg.toUpperCase() === 'F' ? 200 : 504, 'Structuur F');
        case 'CWD': case 'XCWD': {
          const abs = this.abs(arg); const st = await fsp.stat(abs).catch(() => null);
          if (!st || !st.isDirectory()) return this.reply(550, 'Map bestaat niet');
          this.cwd = this.clientPath(abs); return this.reply(250, 'OK');
        }
        case 'CDUP': case 'XCUP': this.cwd = this.clientPath(this.abs('..')); return this.reply(250, 'OK');
        case 'PASV': {
          if (!this.protP) return this.reply(521, 'Eerst PROT P');
          const port = await this.startPasv();
          const addr = (config.ftps.pasvAddress || this.sock.localAddress || '127.0.0.1').replace(/^::ffff:/, '');
          if (!/^\d+\.\d+\.\d+\.\d+$/.test(addr)) return this.reply(425, 'Gebruik EPSV (IPv6)');
          return this.reply(227, `Passieve modus (${addr.split('.').join(',')},${port >> 8},${port & 255})`);
        }
        case 'EPSV': {
          if (!this.protP) return this.reply(521, 'Eerst PROT P');
          if (/^all$/i.test(arg)) return this.reply(200, 'EPSV ALL');
          const port = await this.startPasv();
          return this.reply(229, `Passieve modus (|||${port}|)`);
        }
        case 'PORT': case 'EPRT': return this.reply(502, 'Actieve modus uitgeschakeld; gebruik PASV/EPSV');
        case 'LIST': case 'NLST': case 'MLSD': {
          const target = arg.replace(/^-[a-zA-Z]+\s*/, '');
          const abs = this.abs(target); const st = await fsp.stat(abs).catch(() => null);
          if (!st) return this.reply(550, 'Bestaat niet');
          let entries = st.isDirectory() ? await fsp.readdir(abs, { withFileTypes: true }) : null;
          const out = [];
          if (!entries) out.push(cmd === 'MLSD' ? mlsLine(path.basename(abs), st) : cmd === 'NLST' ? path.basename(abs) : listLine(path.basename(abs), st));
          else {
            entries = entries.filter((e) => !e.name.startsWith('.') && e.name !== config.trashName);
            for (const e of entries.slice(0, 20000)) {
              const s2 = await fsp.stat(path.join(abs, e.name)).catch(() => null); if (!s2) continue;
              out.push(cmd === 'MLSD' ? mlsLine(e.name, s2) : cmd === 'NLST' ? e.name : listLine(e.name, s2));
            }
          }
          return this.sendData(out.join('\r\n') + (out.length ? '\r\n' : ''));
        }
        case 'MLST': {
          const abs = this.abs(arg); const st = await fsp.stat(abs).catch(() => null);
          if (!st) return this.reply(550, 'Bestaat niet');
          return this.multi(250, ['Info', mlsLine(this.clientPath(abs), st)]);
        }
        case 'SIZE': { const st = await fsp.stat(this.abs(arg)).catch(() => null); return st && st.isFile() ? this.reply(213, String(st.size)) : this.reply(550, 'Geen bestand'); }
        case 'MDTM': { const st = await fsp.stat(this.abs(arg)).catch(() => null); return st ? this.reply(213, mlsTime(st.mtime)) : this.reply(550, 'Bestaat niet'); }
        case 'REST': { const n = parseInt(arg, 10); if (!(n >= 0)) return this.reply(501, 'Ongeldig'); this.rest = n; return this.reply(350, `Hervatten vanaf ${n}`); }
        case 'RETR': return this.retr(arg);
        case 'STOR': case 'APPE': return this.stor(arg, cmd === 'APPE');
        case 'DELE': {
          if (!this.canWrite()) return this.reply(550, 'Alleen-lezen');
          const abs = this.abs(arg); const rel = this.clientPath(abs);
          if (this.blocked(rel)) return this.reply(550, 'Beschermd (bewaarplicht of vergrendeld)');
          const st = await fsp.stat(abs).catch(() => null); if (!st || !st.isFile()) return this.reply(550, 'Geen bestand');
          await fsp.unlink(abs); invalidateDirSize(this.home); recordMutation(this.user, 'delete'); checkHoneypot(this.user, rel, 'delete');
          audit('ftps', this.user, 'delete', { path: rel }); return this.reply(250, 'Verwijderd');
        }
        case 'MKD': case 'XMKD': {
          if (!this.canWrite()) return this.reply(550, 'Alleen-lezen');
          const abs = this.abs(arg); await fsp.mkdir(abs, { recursive: true });
          audit('ftps', this.user, 'mkdir', { path: this.clientPath(abs) }); return this.reply(257, `"${this.clientPath(abs)}" aangemaakt`);
        }
        case 'RMD': case 'XRMD': {
          if (!this.canWrite()) return this.reply(550, 'Alleen-lezen');
          const abs = this.abs(arg); const rel = this.clientPath(abs);
          if (rel === '/' || this.blocked(rel)) return this.reply(550, 'Niet toegestaan');
          await fsp.rmdir(abs).catch((e) => { throw Object.assign(e, { code: 550 }); });
          audit('ftps', this.user, 'rmdir', { path: rel }); return this.reply(250, 'Verwijderd');
        }
        case 'RNFR': {
          if (!this.canWrite()) return this.reply(550, 'Alleen-lezen');
          const abs = this.abs(arg); if (!fs.existsSync(abs)) return this.reply(550, 'Bestaat niet');
          if (this.blocked(this.clientPath(abs))) return this.reply(550, 'Beschermd');
          this.rnfr = abs; return this.reply(350, 'Wacht op RNTO');
        }
        case 'RNTO': {
          if (!this.rnfr) return this.reply(503, 'Eerst RNFR');
          const from = this.rnfr; this.rnfr = null;
          const to = this.abs(arg); const relTo = this.clientPath(to);
          if (this.clientPath(from) === '/' || this.blocked(relTo, true)) return this.reply(550, 'Niet toegestaan');
          await fsp.rename(from, to);
          recordMutation(this.user, 'rename'); checkHoneypot(this.user, this.clientPath(from), 'rename');
          audit('ftps', this.user, 'rename', { from: this.clientPath(from), to: relTo }); return this.reply(250, 'Hernoemd');
        }
        case 'ALLO': return this.reply(202, 'Niet nodig');
        case 'ABOR': this.closePasv(); return this.reply(226, 'Afgebroken');
        default: return this.reply(502, 'Niet ondersteund');
      }
    } catch (err) {
      return this.reply(typeof err.code === 'number' ? err.code : 550, err.code === 'ENOENT' ? 'Bestaat niet' : 'Mislukt');
    }
  }

  login(pass) {
    const user = this.pendingUser; this.pendingUser = null;
    const key = 'ftps:' + this.ip;
    const fail = (reason) => {
      recordFailure(key);
      audit('ftps', user || '', 'login_failed', { ip: this.ip, reason });
      if (!checkAllowed(key).allowed && !isBanned(this.ip)) { ban(this.ip, Date.now() + config.rateLimit.blockMs); audit('ftps', user || '', 'ip_banned', { ip: this.ip }); }
      this.reply(530, 'Inloggen mislukt');
    };
    if (!user) return this.reply(503, 'Eerst USER');
    if (isBanned(this.ip) || !checkAllowed(key).allowed) { this.reply(530, 'Te veel pogingen'); return this.close(); }
    if (config.requireHardwareKey) return fail('hardware-sleutel vereist');
    if (!userExists(user)) return fail('onbekende gebruiker');
    if (isExpired(user)) return fail('account verlopen');
    if (role(user) === 'guest') return fail('gasten hebben geen FTPS');
    if (!verifyPassword(user, pass)) return fail('wachtwoord');
    recordSuccess(key);
    this.user = user; this.home = homeDir(user); fs.mkdirSync(this.home, { recursive: true }); this.cwd = '/';
    audit('ftps', user, 'login', { ip: this.ip });
    return this.reply(230, 'Ingelogd');
  }

  async retr(arg) {
    const abs = this.abs(arg); const rel = this.clientPath(abs);
    const st = await fsp.stat(abs).catch(() => null);
    if (!st || !st.isFile()) return this.reply(550, 'Geen bestand');
    const start = Math.min(this.rest, st.size); this.rest = 0;
    const d = await this.openData();
    this.reply(150, `Bezig met ${path.basename(abs)} (${st.size} bytes)`);
    checkHoneypot(this.user, rel, 'read');
    try { await pipeline(fs.createReadStream(abs, { start }), d); } catch { return this.reply(426, 'Overdracht afgebroken'); }
    audit('ftps', this.user, 'download', { path: rel });
    return this.reply(226, 'Klaar');
  }

  async stor(arg, append) {
    if (!this.canWrite()) return this.reply(550, 'Alleen-lezen');
    const abs = this.abs(arg); const rel = this.clientPath(abs);
    if (rel === '/' || this.blocked(rel, true)) return this.reply(550, 'Beschermd (bewaarplicht, vergrendeld of E2E-map)');
    const q = quota(this.user);
    if (q > 0 && dirSize(this.home) >= q) return this.reply(552, 'Quotum overschreden');
    const offset = this.rest; this.rest = 0;
    const d = await this.openData();
    this.reply(150, 'Klaar om te ontvangen');
    let written = 0; let over = false;
    const flags = append ? 'a' : offset > 0 ? 'r+' : 'w';
    const ws = fs.createWriteStream(abs, { flags, start: append ? undefined : offset || undefined });
    const base = q > 0 ? dirSize(this.home) : 0;
    d.on('data', (c) => { written += c.length; if (q > 0 && base + written > q && !over) { over = true; d.destroy(); } });
    try { await pipeline(d, ws); } catch { /* afgebroken of quotum */ }
    invalidateDirSize(this.home);
    if (over) { await fsp.unlink(abs).catch(() => {}); return this.reply(552, 'Quotum overschreden'); }
    audit('ftps', this.user, 'upload', { path: rel, bytes: written });
    recordMutation(this.user, 'write'); checkHoneypot(this.user, rel, 'write');
    const verdict = await inspectUpload({ abs, user: this.user, home: this.home, relPath: rel, via: 'ftps' });
    if (!verdict.ok) return this.reply(550, verdict.reason === 'malware' ? 'Geweigerd: besmet bestand' : 'Geweigerd: gevoelige gegevens');
    return this.reply(226, 'Opgeslagen');
  }
}

export async function startFtpsServer() {
  const c = config.ftps;
  if (!c.port) return null;
  const creds = await ftpsCredentials();
  const secureContext = tls.createSecureContext({ ...creds, minVersion: 'TLSv1.2' });
  const onConn = (implicit) => (sock) => {
    const ip = (sock.remoteAddress || '').replace(/^::ffff:/, '');
    if (isBanned(ip) || isBlockedIp(ip)) { sock.destroy(); return; }
    new Session(sock, secureContext, implicit); // eslint-disable-line no-new
  };
  const server = net.createServer(onConn(c.implicit));
  server.on('error', (e) => console.error('[ftps]', e.message));
  await new Promise((resolve) => server.listen(c.port, c.host, resolve));
  console.log(`[ftps] ${c.implicit ? 'Impliciete' : 'Expliciete'} FTPS op ${c.host}:${server.address().port} (passief ${c.pasvMin}-${c.pasvMax})`);
  return server;
}
