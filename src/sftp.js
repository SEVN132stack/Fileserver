import fs from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import ssh2 from 'ssh2';
import { config } from './config.js';
import { resolveSafe } from './util.js';

const { Server, utils } = ssh2;
const { STATUS_CODE: SFTP_STATUS_CODE, OPEN_MODE: SFTP_OPEN_MODE } = utils.sftp;

// Vergelijk twee strings zonder timing-lek.
function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Vertaal een absoluut opslagpad terug naar een pad t.o.v. de opslag-root,
// zodat de client altijd "/" als hoofdmap ziet.
function toClientPath(absPath) {
  const rel = path.relative(config.storageDir, absPath);
  return '/' + rel.split(path.sep).join('/');
}

export function startSftpServer() {
  const hostKey = fs.readFileSync(config.hostKeyPath);

  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    client.on('authentication', (ctx) => {
      const okUser = safeEqual(ctx.username || '', config.auth.username);
      if (ctx.method === 'password' && okUser && safeEqual(ctx.password || '', config.auth.password)) {
        return ctx.accept();
      }
      if (ctx.method === 'none') return ctx.reject(['password']);
      return ctx.reject();
    });

    client.on('ready', () => {
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
              abs = resolveSafe(filename);
            } catch {
              return sftp.status(reqid, SFTP_STATUS_CODE.FAILURE);
            }
            const reading = flags & SFTP_OPEN_MODE.READ;
            let fd;
            try {
              fd = fs.openSync(abs, reading ? 'r' : 'w');
            } catch {
              return sftp.status(reqid, SFTP_STATUS_CODE.NO_SUCH_FILE);
            }
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
              abs = resolveSafe(dirpath);
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
              abs = resolveSafe(p);
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

          // --- Bewerkingen ---
          sftp.on('REMOVE', (reqid, p) => {
            try { fs.unlinkSync(resolveSafe(p)); sftp.status(reqid, SFTP_STATUS_CODE.OK); }
            catch { sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); }
          });
          sftp.on('MKDIR', (reqid, p) => {
            try { fs.mkdirSync(resolveSafe(p), { recursive: true }); sftp.status(reqid, SFTP_STATUS_CODE.OK); }
            catch { sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); }
          });
          sftp.on('RMDIR', (reqid, p) => {
            try { fs.rmSync(resolveSafe(p), { recursive: true, force: true }); sftp.status(reqid, SFTP_STATUS_CODE.OK); }
            catch { sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); }
          });
          sftp.on('RENAME', (reqid, oldPath, newPath) => {
            try { fs.renameSync(resolveSafe(oldPath), resolveSafe(newPath)); sftp.status(reqid, SFTP_STATUS_CODE.OK); }
            catch { sftp.status(reqid, SFTP_STATUS_CODE.FAILURE); }
          });
          sftp.on('REALPATH', (reqid, p) => {
            let abs;
            try {
              abs = resolveSafe(p);
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
