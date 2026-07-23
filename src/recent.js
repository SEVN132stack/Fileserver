// Recent geopende/gedownloade bestanden per gebruiker (in-memory, laatste 30).
const recent = new Map(); // user -> [{ path, ts }]

export function recordRecent(user, p) {
  if (!user || !p) return;
  const list = (recent.get(user) || []).filter((r) => r.path !== p);
  list.unshift({ path: p, ts: Date.now() });
  recent.set(user, list.slice(0, 30));
}

export function listRecent(user) {
  return recent.get(user) || [];
}
