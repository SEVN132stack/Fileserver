import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { resolveSafe } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Eenvoudige HTTP Basic Auth met dezelfde inloggegevens als SFTP.
function basicAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user === config.auth.username && pass === config.auth.password) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="SFTP Fileserver"');
  res.status(401).send('Authenticatie vereist');
}

export function createWebServer() {
  const app = express();
  app.use(basicAuth);
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Multer schrijft uploads rechtstreeks naar de doelmap binnen de opslag.
  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, cb) {
        try {
          const dir = resolveSafe(req.query.path || '/');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        } catch (err) {
          cb(err);
        }
      },
      filename(req, file, cb) {
        // Behoud de originele bestandsnaam (zonder mappaden).
        cb(null, path.basename(file.originalname));
      },
    }),
  });

  // Lijst van bestanden en mappen op een gegeven pad.
  app.get('/api/list', async (req, res) => {
    try {
      const dir = resolveSafe(req.query.path || '/');
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (e) => {
          const stat = await fsp.stat(path.join(dir, e.name)).catch(() => null);
          return {
            name: e.name,
            isDir: e.isDirectory(),
            size: stat ? stat.size : 0,
            mtime: stat ? stat.mtimeMs : 0,
          };
        }),
      );
      items.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
      res.json({ path: req.query.path || '/', items });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Download een bestand.
  app.get('/api/download', (req, res) => {
    try {
      const file = resolveSafe(req.query.path || '');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        return res.status(404).json({ error: 'Bestand niet gevonden' });
      }
      res.download(file, path.basename(file));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Upload een of meerdere bestanden.
  app.post('/api/upload', upload.array('files'), (req, res) => {
    res.json({ uploaded: (req.files || []).map((f) => f.originalname) });
  });

  // Maak een nieuwe map aan.
  app.post('/api/mkdir', express.json(), async (req, res) => {
    try {
      const target = resolveSafe(path.posix.join(req.body.path || '/', req.body.name || ''));
      await fsp.mkdir(target, { recursive: true });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Verwijder een bestand of map.
  app.post('/api/delete', express.json(), async (req, res) => {
    try {
      const target = resolveSafe(req.body.path || '');
      if (path.resolve(target) === path.resolve(config.storageDir)) {
        return res.status(400).json({ error: 'Kan hoofdmap niet verwijderen' });
      }
      await fsp.rm(target, { recursive: true, force: true });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return app;
}

export function startWebServer() {
  const app = createWebServer();
  return app.listen(config.web.port, config.web.host, () => {
    console.log(`[web] Web UI draait op http://${config.web.host}:${config.web.port}`);
  });
}
