import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { resolveWithin, dirSize } from './paths.js';
import { config } from './config.js';
import { quota } from './users.js';
import { scanFile } from './scan.js';
import { quarantine } from './quarantine.js';
import { audit } from './audit.js';
import { retainedUntil } from './retention.js';
import { lockOwner } from './locks.js';
import { isE2ERequired } from './e2e-folders.js';

// In-memory WebDAV-locks: token -> { home, path, user, expires }. Nodig omdat
// Windows Verkenner en macOS Finder een LOCK sturen vóór een PUT; zonder LOCK-
// ondersteuning weigeren die clients te schrijven.
const davLocks = new Map();
const LOCK_TTL = 3600000; // 1 uur
function lockTokenFor(home, p) {
  const now = Date.now();
  for (const [tok, l] of davLocks) {
    if (l.expires < now) { davLocks.delete(tok); continue; }
    if (l.home === home && l.path === p) return tok;
  }
  return null;
}
// Zwakke ETag op basis van grootte + mtime (property-caching voor clients).
function etagOf(stat) { return `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`; }

// Minimale WebDAV-implementatie zodat je de opslag als netwerkschijf kunt
// koppelen. Ondersteunt OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL en MOVE.
// Gaat uit van req.home (home-map van de geauthenticeerde gebruiker) en een
// mount op /webdav.

const MOUNT = '/webdav';

function davPath(req) {
  // app.use(MOUNT, ...) heeft het mount-prefix al van req.path verwijderd.
  let p = decodeURIComponent(req.path || '/');
  if (!p.startsWith('/')) p = '/' + p;
  return p;
}

function xmlResponse(href, stat) {
  const isDir = stat.isDirectory();
  return `<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:resourcetype>${isDir ? '<D:collection/>' : ''}</D:resourcetype>
      <D:getcontentlength>${isDir ? 0 : stat.size}</D:getcontentlength>
      <D:getlastmodified>${new Date(stat.mtimeMs).toUTCString()}</D:getlastmodified>
      <D:getetag>${etagOf(stat)}</D:getetag>
      <D:supportedlock><D:lockentry><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype></D:lockentry></D:supportedlock>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`;
}

export async function handleWebdav(req, res) {
  let abs;
  try {
    abs = resolveWithin(req.home, davPath(req));
  } catch {
    return res.status(400).end();
  }

  const readonly = req.userRole === 'readonly';
  const method = req.method;
  const relPath = davPath(req);

  // Compliance-/vergrendelingscontroles voor wijzigende methodes — gelijk aan de
  // web-upload, zodat WebDAV geen achterdeur is om WORM/E2E/locks te omzeilen.
  const blockMutation = () => {
    if (retainedUntil(req.home, relPath)) return 'Onder bewaarplicht (WORM) — niet wijzigbaar';
    if (lockOwner(req.home, relPath)) return 'Bestand is vergrendeld';
    return null;
  };

  try {
    if (method === 'OPTIONS') {
      res.set('Allow', 'OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, HEAD, LOCK, UNLOCK');
      res.set('DAV', '1, 2'); // 2 = class-2 locking
      return res.status(200).end();
    }

    // LOCK/UNLOCK: minimale exclusieve write-lock zodat Windows/macOS-mounts
    // kunnen schrijven. De lock wordt ook zichtbaar in de app (via locks.js).
    if (method === 'LOCK') {
      if (readonly) return res.status(403).end();
      const blocked = blockMutation();
      if (blocked) return res.status(423).end(blocked);
      let token = lockTokenFor(req.home, relPath);
      if (!token) {
        token = 'opaquelocktoken:' + randomBytes(16).toString('hex');
        davLocks.set(token, { home: req.home, path: relPath, user: req.user, expires: Date.now() + LOCK_TTL });
      } else {
        davLocks.get(token).expires = Date.now() + LOCK_TTL; // refresh
      }
      res.set('Lock-Token', `<${token}>`);
      res.status(200).set('Content-Type', 'application/xml; charset=utf-8');
      return res.end(`<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:"><D:lockdiscovery><D:activelock>
  <D:locktype><D:write/></D:locktype>
  <D:lockscope><D:exclusive/></D:lockscope>
  <D:depth>0</D:depth>
  <D:timeout>Second-${LOCK_TTL / 1000}</D:timeout>
  <D:locktoken><D:href>${token}</D:href></D:locktoken>
</D:activelock></D:lockdiscovery></D:prop>`);
    }

    if (method === 'UNLOCK') {
      const tok = (req.headers['lock-token'] || '').replace(/[<>]/g, '');
      if (tok && davLocks.has(tok)) davLocks.delete(tok);
      return res.status(204).end();
    }

    if (method === 'PROPFIND') {
      if (!fs.existsSync(abs)) return res.status(404).end();
      const stat = fs.statSync(abs);
      const base = req.originalUrl.replace(/\/+$/, '');
      let responses = xmlResponse(base || MOUNT + '/', stat);
      if (stat.isDirectory() && req.headers.depth !== '0') {
        for (const name of await fsp.readdir(abs)) {
          const childStat = fs.statSync(path.join(abs, name));
          responses += xmlResponse(`${base}/${encodeURIComponent(name)}`, childStat);
        }
      }
      res.status(207).set('Content-Type', 'application/xml; charset=utf-8');
      return res.end(`<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">${responses}</D:multistatus>`);
    }

    if (method === 'GET' || method === 'HEAD') {
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return res.status(404).end();
      const stat = fs.statSync(abs);
      const etag = etagOf(stat);
      res.set('ETag', etag);
      res.set('Last-Modified', new Date(stat.mtimeMs).toUTCString());
      // Property-caching: als de client een geldige ETag heeft, 304 teruggeven.
      if (req.headers['if-none-match'] && req.headers['if-none-match'] === etag) return res.status(304).end();
      if (method === 'HEAD') return res.status(200).end();
      return res.sendFile(abs);
    }

    if (readonly) return res.status(403).end();

    if (method === 'PUT') {
      const blocked = blockMutation();
      if (blocked) return res.status(423).end(blocked);
      if (isE2ERequired(req.home, relPath) && !/\.enc$/i.test(relPath)) return res.status(422).end('Map vereist end-to-end-versleuteling (.enc)');
      // Uploadgrootte-limiet (Content-Length) en quotum, net als de web-upload.
      const len = parseInt(req.headers['content-length'] || '0', 10);
      if (config.maxUploadBytes > 0 && len > config.maxUploadBytes) return res.status(413).end('Bestand te groot');
      const q = quota(req.user);
      if (q > 0 && dirSize(req.home) + len > q) return res.status(507).end('Quota overschreden');
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      const ws = fs.createWriteStream(abs);
      // Harde afkap als er meer binnenkomt dan toegestaan (ontbrekende/foute CL).
      let received = 0;
      if (config.maxUploadBytes > 0) {
        req.on('data', (c) => {
          received += c.length;
          if (received > config.maxUploadBytes) { req.destroy(); ws.destroy(); fs.rm(abs, { force: true }, () => {}); }
        });
      }
      req.pipe(ws);
      ws.on('close', async () => {
        if (res.headersSent) return;
        // Antivirus-scan na afloop, gelijk aan de web-upload; besmet → quarantaine.
        try {
          const verdict = await scanFile(abs);
          if (verdict.clean === false) {
            quarantine(abs, { user: req.user, home: req.home, targetPath: path.posix.dirname(davPath(req)), filename: path.basename(abs), detail: verdict.detail });
            audit('web', req.user, 'quarantined', { file: path.basename(abs), via: 'webdav', detail: verdict.detail });
            return res.status(422).end('Bestand geweigerd (virusscan)');
          }
        } catch { /* scanner onbereikbaar: laat door zoals de web-upload bij fail-open */ }
        res.status(201).end();
      });
      ws.on('error', () => { if (!res.headersSent) res.status(500).end(); });
      return;
    }

    if (method === 'DELETE') {
      const blocked = blockMutation();
      if (blocked) return res.status(423).end(blocked);
      await fsp.rm(abs, { recursive: true, force: true });
      return res.status(204).end();
    }

    if (method === 'MKCOL') {
      await fsp.mkdir(abs, { recursive: false });
      return res.status(201).end();
    }

    if (method === 'MOVE') {
      const blocked = blockMutation();
      if (blocked) return res.status(423).end(blocked);
      const dest = req.headers.destination || '';
      const destPath = decodeURIComponent(new URL(dest, 'http://x').pathname.slice(MOUNT.length));
      const destAbs = resolveWithin(req.home, destPath);
      await fsp.mkdir(path.dirname(destAbs), { recursive: true });
      await fsp.rename(abs, destAbs);
      return res.status(201).end();
    }

    res.status(405).end();
  } catch (err) {
    res.status(500).end(err.message);
  }
}

export const WEBDAV_MOUNT = MOUNT;
