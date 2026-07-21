import { config } from './config.js';

// Controleert of er een nieuwere versie op GitHub beschikbaar is (laatste
// release, met tags als fallback). Resultaat wordt kort gecachet.
let cache = { ts: 0, data: null };

function parseVer(v) {
  return String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
}
function isNewer(remote, local) {
  const a = parseVer(remote);
  const b = parseVer(local);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

export async function checkForUpdate() {
  if (!config.updateCheck) return { enabled: false };
  if (Date.now() - cache.ts < 6 * 3600 * 1000 && cache.data) return cache.data;
  const current = config.version;
  try {
    let latest = null;
    const rel = await fetch(`https://api.github.com/repos/${config.updateRepo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'sftp-fileserver' },
    });
    if (rel.ok) {
      latest = (await rel.json()).tag_name;
    } else {
      const tags = await fetch(`https://api.github.com/repos/${config.updateRepo}/tags`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'sftp-fileserver' },
      });
      if (tags.ok) { const arr = await tags.json(); latest = arr[0] && arr[0].name; }
    }
    const data = latest
      ? { enabled: true, current, latest: latest.replace(/^v/, ''), updateAvailable: isNewer(latest, current) }
      : { enabled: true, current, latest: null, updateAvailable: false };
    cache = { ts: Date.now(), data };
    return data;
  } catch (err) {
    return { enabled: true, current, error: err.message };
  }
}
