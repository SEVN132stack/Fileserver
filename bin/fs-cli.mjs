#!/usr/bin/env node
// Eenvoudige CLI-client voor de fileserver, voor scripting en automatisering.
// Authenticatie via een API-sleutel (maak er één in de web-UI onder 🔑api).
//
//   export FS_URL=https://transfer.voorbeeld.nl
//   export FS_KEY=fsk_xxxxxxxx
//   fs-cli ls /                     # map tonen
//   fs-cli get /map/bestand.pdf .   # downloaden naar lokale map
//   fs-cli put ./lokaal.txt /map    # uploaden
//   fs-cli mkdir /nieuwe-map
//   fs-cli rm /map/bestand.pdf      # naar prullenbak
//   fs-cli share /map/bestand.pdf   # publieke deel-link maken
//
// Werkt ook met een rclone-WebDAV-remote; deze CLI is bedoeld voor snelle
// scripts zonder rclone.

import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.FS_URL || 'http://localhost:8080').replace(/\/+$/, '');
const KEY = process.env.FS_KEY || '';
if (!KEY) { console.error('Zet FS_KEY (een API-sleutel, fsk_...). Zie de web-UI onder 🔑api.'); process.exit(1); }

const auth = { Authorization: 'Bearer ' + KEY };
const enc = encodeURIComponent;

async function api(pathname, opts = {}) {
  const r = await fetch(BASE + pathname, { ...opts, headers: { ...auth, ...(opts.headers || {}) } });
  if (r.status === 401) { console.error('Niet geautoriseerd — controleer FS_KEY.'); process.exit(1); }
  return r;
}

const [cmd, ...args] = process.argv.slice(2);

try {
  switch (cmd) {
    case 'ls': {
      const p = args[0] || '/';
      const d = await (await api('/api/list?path=' + enc(p))).json();
      for (const it of d.items || []) {
        const size = it.isDir ? '<dir>' : String(it.size);
        console.log(`${it.isDir ? 'd' : '-'} ${size.padStart(10)}  ${it.name}`);
      }
      break;
    }
    case 'get': {
      const remote = args[0]; const destDir = args[1] || '.';
      if (!remote) throw new Error('gebruik: get <remote-pad> [lokale-map]');
      const r = await api('/api/download?path=' + enc(remote));
      if (!r.ok) throw new Error('download mislukt (' + r.status + ')');
      const buf = Buffer.from(await r.arrayBuffer());
      const out = path.join(destDir, path.basename(remote));
      fs.writeFileSync(out, buf);
      console.log('opgeslagen:', out, `(${buf.length} bytes)`);
      break;
    }
    case 'put': {
      const local = args[0]; const remoteDir = args[1] || '/';
      if (!local) throw new Error('gebruik: put <lokaal-bestand> [remote-map]');
      const data = fs.readFileSync(local);
      const fd = new FormData();
      fd.append('files', new Blob([data]), path.basename(local));
      const r = await api('/api/upload?path=' + enc(remoteDir), { method: 'POST', body: fd });
      console.log(r.ok ? 'geüpload: ' + path.basename(local) : 'upload mislukt (' + r.status + ')');
      break;
    }
    case 'mkdir': {
      const p = args[0]; if (!p) throw new Error('gebruik: mkdir <pad>');
      const parent = path.posix.dirname(p) || '/';
      const name = path.posix.basename(p);
      const r = await api('/api/mkdir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: parent, name }) });
      console.log(r.ok ? 'map aangemaakt: ' + p : 'mislukt (' + r.status + ')');
      break;
    }
    case 'rm': {
      const p = args[0]; if (!p) throw new Error('gebruik: rm <pad>');
      const r = await api('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p }) });
      console.log(r.ok ? 'verwijderd (naar prullenbak): ' + p : 'mislukt (' + r.status + ')');
      break;
    }
    case 'share': {
      const p = args[0]; if (!p) throw new Error('gebruik: share <pad>');
      const r = await (await api('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p }) })).json();
      if (r.error) throw new Error(r.error);
      console.log(BASE + r.url);
      break;
    }
    default:
      console.log('fs-cli — commando\'s: ls, get, put, mkdir, rm, share');
      console.log('zie de kop van bin/fs-cli.mjs voor voorbeelden.');
      if (cmd) process.exit(1);
  }
} catch (err) {
  console.error('fout:', err.message);
  process.exit(1);
}
