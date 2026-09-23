import { config } from './config.js';

// Koppel-/mountprofielen voor desktop-clients. We genereren kant-en-klare
// configuraties en commando's voor de gangbare manieren om de fileserver als
// netwerkschijf te gebruiken. Er staat NOOIT een wachtwoord in een profiel; de
// gebruiker vult zijn wachtwoord of een API-sleutel zelf in.

// Maak een waarde veilig voor gebruik in een config-regel/commando (geen
// regeleinden of shell-metatekens uit de gebruikersnaam/host laten lekken).
const clean = (s) => String(s || '').replace(/[^\w.@:/[\]-]/g, '');

export function profiles(user, baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  let host = '';
  try { host = new URL(base).hostname; } catch { host = 'localhost'; }
  const u = clean(user);
  const h = clean(host);
  const webdav = `${base}/webdav`;
  const port = config.sftp.port;
  const out = [];
  if (config.webdavEnabled) {
    out.push({
      id: 'rclone-webdav', title: 'rclone (WebDAV)', os: 'alle', file: 'rclone-webdav.conf',
      body: `[fileserver-webdav]\ntype = webdav\nurl = ${webdav}\nvendor = other\nuser = ${u}\n# pass = <uitvoer van: rclone obscure <wachtwoord of API-sleutel>>\n`,
      hint: 'Kopieer naar ~/.config/rclone/rclone.conf en mount met: rclone mount fileserver-webdav: ~/Fileserver --vfs-cache-mode writes',
    });
    out.push({
      id: 'windows', title: 'Windows (netwerkschijf)', os: 'windows', file: 'koppel-fileserver.cmd',
      body: `@echo off\r\nREM Koppelt de fileserver als schijf Z:. Windows vraagt om je wachtwoord.\r\nnet use Z: "${webdav}" /user:${u} /persistent:yes\r\n`,
      hint: 'Windows WebDAV werkt alleen betrouwbaar over HTTPS. Of gebruik: Verkenner → Deze pc → Netwerkverbinding maken.',
    });
    out.push({
      id: 'macos', title: 'macOS (Finder)', os: 'macos', file: null,
      body: webdav,
      hint: 'Finder → Ga → Verbind met server (⌘K) en plak deze URL. Log in met je gebruikersnaam en wachtwoord.',
    });
    out.push({
      id: 'linux-davfs', title: 'Linux (davfs2 / fstab)', os: 'linux', file: 'fileserver-fstab.txt',
      body: `# /etc/fstab\n${webdav} /mnt/fileserver davfs user,noauto,_netdev 0 0\n# /etc/davfs2/secrets (chmod 600):\n# ${webdav} ${u} <wachtwoord>\n`,
      hint: 'Installeer davfs2, maak /mnt/fileserver aan en mount met: mount /mnt/fileserver',
    });
  }
  out.push({
    id: 'rclone-sftp', title: 'rclone (SFTP)', os: 'alle', file: 'rclone-sftp.conf',
    body: `[fileserver-sftp]\ntype = sftp\nhost = ${h}\nport = ${port}\nuser = ${u}\n# key_file = ~/.ssh/id_ed25519   (aanbevolen)\n`,
    hint: 'SFTP met een SSH-sleutel is de veiligste en snelste optie.',
  });
  out.push({
    id: 'sshfs', title: 'sshfs (Linux/macOS)', os: 'linux', file: null,
    body: `sshfs -p ${port} ${u}@${h}:/ ~/Fileserver -o reconnect,ServerAliveInterval=15`,
    hint: 'Vereist sshfs (macOS: macFUSE + sshfs).',
  });
  return out;
}

// Diagnose: waarschuw voor configuraties die in de praktijk tot problemen leiden.
export function diagnose(baseUrl) {
  const checks = [];
  const add = (ok, label, detail) => checks.push({ ok, label, detail });
  let https = false;
  try { https = new URL(baseUrl).protocol === 'https:'; } catch { /* nvt */ }
  add(!!config.appBaseUrl, 'Externe basis-URL ingesteld', config.appBaseUrl ? config.appBaseUrl : 'APP_BASE_URL ontbreekt: profielen gebruiken de huidige host, die van buitenaf mogelijk niet klopt.');
  add(https, 'HTTPS', https ? 'Verbindingen zijn versleuteld.' : 'Zonder HTTPS weigert Windows WebDAV Basic-auth en gaan wachtwoorden onversleuteld over het netwerk.');
  add(config.webdavEnabled, 'WebDAV ingeschakeld', config.webdavEnabled ? '/webdav is beschikbaar.' : 'WEBDAV_ENABLED=false: alleen SFTP-profielen zijn bruikbaar.');
  add(true, 'SFTP-poort', `SFTP luistert op poort ${config.sftp.port}; zorg dat die van buitenaf bereikbaar is als je buiten het netwerk wilt koppelen.`);
  return { checks, ok: checks.every((c) => c.ok) };
}
