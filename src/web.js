import express from 'express';
import multer from 'multer';
import archiver from 'archiver';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { resolveWithin } from './paths.js';
import { homeDir, verifyPassword, userExists } from './users.js';
import { checkAllowed, recordFailure, recordSuccess } from './ratelimit.js';
import { audit } from './audit.js';
import { ensureTls } from './tls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// HTTP Basic Auth met wachtwoordcontrole tegen de gebruikersopslag, plus
// brute-force-bescherming per IP.
function basicAuth(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'onbekend';
  const gate = checkAllowed('web:' + ip);
  if (!gate.allowed) {
    res.set('Retry-After', Math.ceil(gate.retryAfterMs / 1000));
    return res.status(429).send('Te veel mislukte pogingen. Probeer later opnieuw.');
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (userExists(user) && verifyPassword(user, pass)) {
      recordSuccess('web:' + ip);
      req.user = user;
      req.home = homeDir(user);
      return next();
    }
    recordFailure('web:' + ip);
    audit('web', user, 'login_failed', { ip });
  }
  res.set('WWW-Authenticate', 'Basic realm="SFTP Fileserver"');
  res.status(401).send('Authenticatie vereist');
}

export function createWebServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(basicAuth);
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Uploads streamen rechtstreeks naar de doelmap binnen de home van de gebruiker.
  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, cb) {
        try {
          const dir = resolveWithin(req.home, req.query.path || '/');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        } catch (err) {
          cb(err);
        }
      },
      filename(req, file, cb) {
        cb(null, path.basename(file.originalname));
      },
    }),
  });

  // Huidige gebruiker.
  app.get('/api/whoami', (req, res) => res.json({ user: req.user }));

  // Lijst van een map, met optioneel zoeken (recursief) en sorteren.
  app.get('/api/list', async (req, res) => {
    try {
      const dir = resolveWithin(req.home, req.query.path || '/');
      const query = (req.query.q || '').toString().toLowerCase();

      let items;
      if (query) {
        items = await searchRecursive(req.home, dir, query);
      } else {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        items = await Promise.all(
          entries.map(async (e) => {
            const stat = await fsp.stat(path.join(dir, e.name)).catch(() => null);
            return {
              name: e.name,
              path: '/' + path.relative(req.home, path.join(dir, e.name)).split(path.sep).join('/'),
              isDir: e.isDirectory(),
              size: stat ? stat.size : 0,
              mtime: stat ? stat.mtimeMs : 0,
            };
          }),
        );
      }

      const sort = (req.query.sort || 'name').toString();
      const dir2 = (req.query.order || 'asc') === 'desc' ? -1 : 1;
      items.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        let cmp = 0;
        if (sort === 'size') cmp = a.size - b.size;
        else if (sort === 'mtime') cmp = a.mtime - b.mtime;
        else cmp = a.name.localeCompare(b.name);
        return cmp * dir2;
      });
      res.json({ path: req.query.path || '/', items });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Download een bestand (als bijlage).
  app.get('/api/download', (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        return res.status(404).json({ error: 'Bestand niet gevonden' });
      }
      audit('web', req.user, 'download', { path: req.query.path });
      res.download(file, path.basename(file));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Toon een bestand inline in de browser (preview).
  app.get('/api/preview', (req, res) => {
    try {
      const file = resolveWithin(req.home, req.query.path || '');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        return res.status(404).json({ error: 'Bestand niet gevonden' });
      }
      res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(file) + '"');
      res.sendFile(file);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Download een map als ZIP-archief.
  app.get('/api/zip', (req, res) => {
    try {
      const dir = resolveWithin(req.home, req.query.path || '/');
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return res.status(404).json({ error: 'Map niet gevonden' });
      }
      const name = (path.basename(dir) || 'archief') + '.zip';
      res.attachment(name);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => res.status(500).end(err.message));
      archive.pipe(res);
      archive.directory(dir, false);
      audit('web', req.user, 'zip', { path: req.query.path });
      archive.finalize();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Upload een of meerdere bestanden.
  app.post('/api/upload', upload.array('files'), (req, res) => {
    const names = (req.files || []).map((f) => f.originalname);
    audit('web', req.user, 'upload', { path: req.query.path || '/', files: names });
    res.json({ uploaded: names });
  });

  // Maak een nieuwe map aan.
  app.post('/api/mkdir', express.json(), async (req, res) => {
    try {
      const target = resolveWithin(req.home, path.posix.join(req.body.path || '/', req.body.name || ''));
      await fsp.mkdir(target, { recursive: true });
      audit('web', req.user, 'mkdir', { path: req.body.path, name: req.body.name });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Hernoem of verplaats een bestand/map.
  app.post('/api/rename', express.json(), async (req, res) => {
    try {
      const from = resolveWithin(req.home, req.body.from || '');
      const to = resolveWithin(req.home, req.body.to || '');
      await fsp.mkdir(path.dirname(to), { recursive: true });
      await fsp.rename(from, to);
      audit('web', req.user, 'rename', { from: req.body.from, to: req.body.to });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Verwijder een bestand of map.
  app.post('/api/delete', express.json(), async (req, res) => {
    try {
      const target = resolveWithin(req.home, req.body.path || '');
      if (path.resolve(target) === path.resolve(req.home)) {
        return res.status(400).json({ error: 'Kan hoofdmap niet verwijderen' });
      }
      await fsp.rm(target, { recursive: true, force: true });
      audit('web', req.user, 'delete', { path: req.body.path });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return app;
}

// Zoek recursief (max diepte) naar bestanden/mappen waarvan de naam de query bevat.
async function searchRecursive(home, dir, query, depth = 6) {
  const out = [];
  async function walk(current, d) {
    if (d < 0) return;
    let entries = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.name.toLowerCase().includes(query)) {
        const stat = await fsp.stat(full).catch(() => null);
        out.push({
          name: e.name,
          path: '/' + path.relative(home, full).split(path.sep).join('/'),
          isDir: e.isDirectory(),
          size: stat ? stat.size : 0,
          mtime: stat ? stat.mtimeMs : 0,
        });
      }
      if (e.isDirectory()) await walk(full, d - 1);
    }
  }
  await walk(dir, depth);
  return out;
}

export function startWebServer() {
  const app = createWebServer();
  const tls = ensureTls();
  if (tls) {
    const server = https.createServer({ cert: tls.cert, key: tls.key }, app);
    return server.listen(config.web.port, config.web.host, () => {
      console.log(`[web] Web UI (HTTPS) draait op https://${config.web.host}:${config.web.port}`);
    });
  }
  const server = http.createServer(app);
  return server.listen(config.web.port, config.web.host, () => {
    console.log(`[web] Web UI (HTTP) draait op http://${config.web.host}:${config.web.port}`);
  });
}
