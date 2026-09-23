import fs from 'node:fs';
import path from 'node:path';
import ssh2 from 'ssh2';
import { config } from './config.js';
import { resolveWithin, toClientPath as toClient, dirSize } from './paths.js';
import { homeDir, verifyPassword, verifyPublicKey, userExists, isReadonly, quota, isExpired } from './users.js';
import { checkAllowed, recordFailure, recordSuccess } from './ratelimit.js';
import { isBanned, ban } from './bans.js';
import { isBlockedIp } from './geoblock.js';
import { audit } from './audit.js';
import { recordMutation } from './ransomware.js';
import { checkHoneypot } from './honeypot.js';
import { retainedUntil } from './retention.js';
import { lockOwner } from './locks.js';
import { isE2ERequired } from './e2e-folders.js';

const { Server, utils } = ssh2;
const { STATUS_CODE: SFTP_STATUS_CODE, OPEN_MODE: SFTP_OPEN_MODE } = utils.sftp;

export function startSftpServer() {
  const hostKey = fs.readFileSync(config.hostKeyPath);

  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    const ip = (client._sock && client._sock.remoteAddress) || 'onbekend';
    let username = null;

    client.on('authentication', (ctx) => {
      const key = 'sftp:' + ip;
      if (isBanned(ip)) return ctx.reject();
      if (isBlockedIp(ip)) { audit('sftp', ctx.username || '', 'login_failed', { ip, reason: 'ip geblokkeerd' }); return ctx.reject(); }
      const gate = checkAllowed(key);
      if (!gate.allowed) return ctx.reject();

      const fail = (reason, extra = {}) => {
        recordFailure(key);
        audit('sftp', ctx.username || '', 'login_failed', { ip, ...extra });
        if (!checkAllowed(key).allowed && !isBanned(ip)) {
          ban(ip, Date.now() + config.rateLimit.blockMs);
          audit('sftp', ctx.username || '', 'ip_banned', { ip });
        }
      };

      const user = ctx.username || '';
      if (!userExists(user)) {
        fail('onbekende gebruiker', { reason: 'onbekende gebruiker' });
        return ctx.reject();
      }
      if (isExpired(user)) {
        audit('sftp', user, 'login_failed', { ip, reason: 'account verlopen' });
        return ctx.reject();
      }

      if (ctx.method === 'password') {
        if (config.requireHardwareKey) { audit('sftp', user, 'login_failed', { ip, reason: 'hardware-sleutel vereist' }); return ctx.reject(['publickey']); }
        if (!config.sftpPasswordAuth) { audit('sftp', user, 'login_failed', { ip, reason: 'wachtwoord-auth uit' }); return ctx.reject(['publickey']); }
        if (verifyPassword(user, ctx.password || '')) {
          recordSuccess(key);
          username = user;
          return ctx.accept();
        }
        fail('password', { method: 'password' });
        return ctx.reject();
      }

      if (ctx.method === 'publickey') {
        // Hardware-backed FIDO2-sleutels hebben een 'sk-'-algoritme.
        if (config.requireHardwareKey && !String(ctx.key.algo).startsWith('sk-')) {
          audit('sftp', user, 'login_failed', { ip, reason: 'niet-hardware sleutel geweigerd' });
          return ctx.reject();
        }
        if (verifyPublicKey(user, ctx.key.algo, ctx.key.data)) {
          recordSuccess(key);
          username = user;
          return ctx.accept();
        }
        fail('publickey', { method: 'publickey' });
        return ctx.reject();
      }

      return ctx.reject(['password', 'publickey']);
    });

    client.on('ready', () => {
      const home = homeDir(username);
      fs.mkdirSync(home, { recursive: true });
      audit('sftp', username, 'login', { ip });

      // Alle padbewerkingen blijven binnen de home-map van deze gebruiker.
      const resolve = (p) => resolveWithin(home, p);
      const toClientPath = (abs) => toClient(home, abs);
      const readonly = isReadonly(username);
      // Is dit (client-)pad beschermd? checkE2E: ook weigeren als het in een
      // E2E-verplichte map terechtkomt zonder .enc-extensie (schrijven/hernoemen-naar).
      const blocked = (rel, checkE2E) => {
        if (retainedUntil(home, rel)) return true;
        if (lockOwner(home, rel)) return true;
        if (checkE2E && isE2ERequired(home, path.posix.dirname(rel)) && !/\.enc$/i.test(rel)) return true;
        return false;
      };

      client.on('session', (accept) => {
        const session = accept();
        session.on('sftp', (acceptSftp) => {
          const sftp = acceptSftp();
          const handles = new Map();
          let handleCount = 0;

          const newHandle = (data) => {
            const id = handleCount++;
            const buf = Buffer.alloc(4);
            buf.writeUInt32BE(id, 0);
            handles.set(id, data);
            return buf;
          };
          const getHandle = (buf) => handles.get(buf.readUInt32BE(0));

          // --- Bestand openen (lezen/schrijven) ---
          sftp.on('OPEN', (reqid, filename, flags) => {
            let abs;
            try {
              abs = resolve(filename);
            } catch {
              return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            }
            // Schrijven = alles wat niet puur lezen is (ook READ|WRITE).
            const reading = (flags & SFTP_OPEN_MODE.READ) && !(flags & (SFTP_OPEN_MODE.WRITE | SFTP_OPEN_MODE.APPEND | SFTP_OPEN_MODE.CREAT | SFTP_OPEN_MODE.TRUNC));
            if (!reading && readonly) return sftp.status(reqid, SFTP_STATUS_CODE.PERMISSION_DENIED);
            if (!reading && blocked(toClientPath(abs), true)) return sftp.status(reqid, SFTP_STATUS_CODE.PERMISSION_DENIED);
            // Quota: weiger schrijven als de home-map al over het quotum zit.
            if (!reading) {
              const q = quota(username);
              if (q > 0 && dirSize(home) >= q) return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            }
            let fd;
            try {
              fd = fs.openSync(abs, reading ? 'r' : 'w');
            } catch {
              return sftp.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE);
            }
            if (!reading) { audit('sftp', username, 'upload', { path: toClientPath(abs) }); recordMutation(username, 'write'); checkHoneypot(username, toClientPath(abs), 'write'); }
            sftp.handle(reqid, newHandle({ fd, path: abs }));
          });

          sftp.on('READ', (reqid, handle, offset, length) => {
            const h = getHandle(handle);
            if (!h) return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            const buf = Buffer.alloc(length);
            fs.read(h.fd, buf, 0, length, offset, (err, bytesRead) => {
              if (err) return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
              if (bytesRead === 0) return sftp.status(reqid, SFTP_STATUS_CODE.EOF);
              sftp.data(reqid, buf.subarray(0, bytesRead));
            });
          });

          sftp.on('WRITE', (reqid, handle, offset, data) => {
            const h = getHandle(handle);
            if (!h) return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            fs.write(h.fd, data, 0, data.length, offset, (err) => {
              sftp.status(reqid, err ? SFTP_STATUS_CODE.FAILURE : SFTP_STATUS_CODE.OK);
            });
          });

          sftp.on('CLOSE', (reqid, handle) => {
            const h = getHandle(handle);
            if (h && typeof h.fd === 'number') {
              try { fs.closeSync(h.fd); } catch { /* al gesloten */ }
            }
            handles.delete(handle.readUInt32BE(0));
            sftp.status(reqid, SFTP_STATUS_CODE.OK);
          });

          // --- Map inhoud opvragen ---
          sftp.on('OPENDIR', (reqid, dirpath) => {
            let abs;
            try {
              abs = resolve(dirpath);
            } catch {
              return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            }
            if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
              return sftp.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE);
            }
            sftp.handle(reqid, newHandle({ dir: abs, read: false }));
          });

          sftp.on('READDIR', (reqid, handle) => {
            const h = getHandle(handle);
            if (!h || !h.dir) return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            if (h.read) return sftp.status(reqid, SFTP_STATUS_CODE.EOF);
            h.read = true;
            const names = fs.readdirSync(h.dir).map((name) => {
              const st = fs.statSync(path.join(h.dir, name));
              return {
                filename: name,
                longname: `${st.isDirectory() ? 'd' : '-'}rw-r--r-- 1 user user ${st.size} ${name}`,
                attrs: { mode: st.mode, size: st.size, mtime: st.mtimeMs / 1000, atime: st.atimeMs / 1000 },
              };
            });
            sftp.name(reqid, names);
          });

          // --- Bestandsinformatie ---
          const doStat = (reqid, p) => {
            let abs;
            try {
              abs = resolve(p);
            } catch {
              return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            }
            fs.stat(abs, (err, st) => {
              if (err) return sftp.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE);
              sftp.attrs(reqid, {
                mode: st.mode, size: st.size,
                uid: 0, gid: 0,
                atime: st.atimeMs / 1000, mtime: st.mtimeMs / 1000,
              });
            });
          };
          sftp.on('STAT', doStat);
          sftp.on('LSTAT', doStat);
          sftp.on('FSTAT', (reqid, handle) => {
            const h = getHandle(handle);
            if (!h) return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            doStat(reqid, toClientPath(h.path || h.dir));
          });

          // --- Bewerkingen (geblokkeerd voor alleen-lezen accounts) ---
          const denyIfReadonly = (reqid) => {
            if (readonly) { sftp.status(reqid, SFTP_STATUS_CODE.PERMISSION_DENIED); return true; }
            return false;
          };
          // Weiger wijzigingen aan beschermde paden: bewaarplicht (WORM), locks van een
          // andere gebruiker, en onversleutelde bestanden in E2E-verplichte mappen.
          const denyIfProtected = (reqid, ...paths) => {
            for (const p of paths) {
              let rel; try { rel = toClientPath(resolve(p)); } catch { sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); return true; }
              if (blocked(rel, false)) { sftp.status(reqid, SFTP_STATUS_CODE.PERMISSION_DENIED); return true; }
            }
            return false;
          };
          sftp.on('REMOVE', (reqid, p) => {
            if (denyIfReadonly(reqid) || denyIfProtected(reqid, p)) return;
            try { fs.unlinkSync(resolve(p)); recordMutation(username, 'delete'); checkHoneypot(username, p, 'delete'); audit('sftp', username, 'delete', { path: p }); sftp.status(reqid, SFTP_STATUS_CODE.OK); }
            catch { sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); }
          });
          sftp.on('MKDIR', (reqid, p) => {
            if (denyIfReadonly(reqid)) return;
            try { fs.mkdirSync(resolve(p), { recursive: true }); audit('sftp', username, 'mkdir', { path: p }); sftp.status(reqid, SFTP_STATUS_CODE.OK); }
            catch { sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); }
          });
          sftp.on('RMDIR', (reqid, p) => {
            if (denyIfReadonly(reqid) || denyIfProtected(reqid, p)) return;
            try { fs.rmSync(resolve(p), { recursive: true, force: true }); recordMutation(username, 'delete'); audit('sftp', username, 'delete', { path: p }); sftp.status(reqid, SFTP_STATUS_CODE.OK); }
            catch { sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); }
          });
          sftp.on('RENAME', (reqid, oldPath, newPath) => {
            if (denyIfReadonly(reqid) || denyIfProtected(reqid, oldPath, newPath)) return;
            try { if (blocked(toClientPath(resolve(newPath)), true)) return sftp.status(reqid, SFTP_STATUS_CODE.PERMISSION_DENIED); } catch { return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); }
            try { fs.renameSync(resolve(oldPath), resolve(newPath)); recordMutation(username, 'rename'); checkHoneypot(username, oldPath, 'rename'); audit('sftp', username, 'rename', { from: oldPath, to: newPath }); sftp.status(reqid, SFTP_STATUS_CODE.OK); }
            catch { sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); }
          });
          sftp.on('REALPATH', (reqid, p) => {
            let abs;
            try {
              abs = resolve(p);
            } catch {
              return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            }
            sftp.name(reqid, [{ filename: toClientPath(abs), longname: toClientPath(abs), attrs: {} }]);
          });
        });
      });
    });

    client.on('error', (err) => console.error('[sftp] clientfout:', err.message));
  });

  server.listen(config.sftp.port, config.sftp.host, () => {
    console.log(`[sftp] SFTP-server draait op ${config.sftp.host}:${config.sftp.port}`);
  });

  return server;
}
