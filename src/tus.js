import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { resolveWithin } from './paths.js';
import { audit } from './audit.js';
import { inc } from './metrics.js';
import { emitToUser } from './events.js';

// Minimale implementatie van het tus 1.0.0 resumable-uploadprotocol
// (creation + core). Interopt met standaard tus-clients (Uppy, tus-js-client).
// Gemount op /tus; vereist authenticatie (req.user, req.home aanwezig).

const MOUNT = '/tus';
const dir = () => path.join(config.chunkDir, 'tus');

function metaFile(id) { return path.join(dir(), id + '.json'); }
function dataFile(id) { return path.join(dir(), id + '.bin'); }

function decodeMetadata(header) {
  const out = {};
  for (const part of (header || '').split(',')) {
    const [k, v] = part.trim().split(' ');
    if (k) out[k] = v ? Buffer.from(v, 'base64').toString('utf8') : '';
  }
  return out;
}

function tusHeaders(res) {
  res.set('Tus-Resumable', '1.0.0');
}

export async function handleTus(req, res) {
  tusHeaders(res);
  fs.mkdirSync(dir(), { recursive: true });
  const sub = req.path.replace(/^\//, ''); // id of leeg
  const readonly = req.userRole === 'readonly';

  if (req.method === 'OPTIONS') {
    res.set('Tus-Version', '1.0.0');
    res.set('Tus-Extension', 'creation');
    res.set('Tus-Max-Size', '107374182400');
    return res.status(204).end();
  }

  // POST /tus : nieuwe upload aanmaken.
  if (req.method === 'POST' && !sub) {
    if (readonly) return res.status(403).end();
    const length = parseInt(req.headers['upload-length'] || '0', 10);
    const meta = decodeMetadata(req.headers['upload-metadata']);
    const id = randomBytes(12).toString('hex');
    await fsp.writeFile(metaFile(id), JSON.stringify({
      length, offset: 0,
      filename: path.basename(meta.filename || 'upload.bin'),
      targetPath: meta.path || '/',
      user: req.user,
    }));
    await fsp.writeFile(dataFile(id), '');
    res.set('Location', `${MOUNT}/${id}`);
    return res.status(201).end();
  }

  if (!sub || !fs.existsSync(metaFile(sub))) return res.status(404).end();
  const meta = JSON.parse(await fsp.readFile(metaFile(sub), 'utf8'));
  if (meta.user !== req.user) return res.status(403).end();

  // HEAD : huidige offset opvragen (voor hervatten).
  if (req.method === 'HEAD') {
    res.set('Upload-Offset', String(meta.offset));
    res.set('Upload-Length', String(meta.length));
    res.set('Cache-Control', 'no-store');
    return res.status(200).end();
  }

  // PATCH : bytes toevoegen op de aangegeven offset.
  if (req.method === 'PATCH') {
    if (readonly) return res.status(403).end();
    const offset = parseInt(req.headers['upload-offset'] || '-1', 10);
    if (offset !== meta.offset) return res.status(409).end();
    const ws = fs.createWriteStream(dataFile(sub), { flags: 'a' });
    let written = 0;
    req.on('data', (c) => { written += c.length; });
    req.pipe(ws);
    ws.on('close', async () => {
      meta.offset += written;
      await fsp.writeFile(metaFile(sub), JSON.stringify(meta));
      res.set('Upload-Offset', String(meta.offset));
      if (meta.offset >= meta.length) {
        // Klaar: verplaats naar de home-map van de gebruiker.
        try {
          const dest = resolveWithin(req.home, path.posix.join(meta.targetPath, meta.filename));
          await fsp.mkdir(path.dirname(dest), { recursive: true });
          await fsp.rename(dataFile(sub), dest);
          await fsp.rm(metaFile(sub), { force: true });
          audit('web', req.user, 'upload', { path: meta.targetPath, files: [meta.filename], tus: true });
          inc('fileserver_uploads_total');
          inc('fileserver_bytes_uploaded_total', meta.length);
          emitToUser(req.user, 'change', { action: 'upload' });
        } catch (err) {
          return res.status(500).end(err.message);
        }
      }
      res.status(204).end();
    });
    ws.on('error', () => res.status(500).end());
    return;
  }

  res.status(405).end();
}

export const TUS_MOUNT = MOUNT;
