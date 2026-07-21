import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { resolveWithin } from './paths.js';

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

  try {
    if (method === 'OPTIONS') {
      res.set('Allow', 'OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, HEAD');
      res.set('DAV', '1');
      return res.status(200).end();
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
      if (method === 'HEAD') return res.status(200).end();
      return res.sendFile(abs);
    }

    if (readonly) return res.status(403).end();

    if (method === 'PUT') {
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      const ws = fs.createWriteStream(abs);
      req.pipe(ws);
      ws.on('close', () => res.status(201).end());
      ws.on('error', () => res.status(500).end());
      return;
    }

    if (method === 'DELETE') {
      await fsp.rm(abs, { recursive: true, force: true });
      return res.status(204).end();
    }

    if (method === 'MKCOL') {
      await fsp.mkdir(abs, { recursive: false });
      return res.status(201).end();
    }

    if (method === 'MOVE') {
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
