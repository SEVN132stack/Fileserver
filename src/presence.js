// Aanwezigheid ("wie kijkt/bewerkt nu dit bestand"). In-memory, met een korte
// TTL zodat verdwenen sessies vanzelf verlopen. Voortbouwend op de bestaande
// bestandsvergrendeling geeft dit realtime inzicht zonder volledige co-editing.

const presence = new Map(); // "home|path" -> Map(user -> { ts })
const TTL = 30000;

const key = (home, p) => `${home}|${p}`;

export function touch(home, p, user) {
  const k = key(home, p);
  let m = presence.get(k);
  if (!m) { m = new Map(); presence.set(k, m); }
  m.set(user, { ts: Date.now() });
}

export function leave(home, p, user) {
  const m = presence.get(key(home, p));
  if (m) { m.delete(user); if (!m.size) presence.delete(key(home, p)); }
}

// Wie kijkt er nu naar dit bestand (behalve, optioneel, jezelf)?
export function viewers(home, p, exclude) {
  const m = presence.get(key(home, p));
  if (!m) return [];
  const now = Date.now();
  const out = [];
  for (const [user, info] of m) {
    if (now - info.ts > TTL) { m.delete(user); continue; }
    if (user !== exclude) out.push(user);
  }
  return out;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, m] of presence) {
    for (const [user, info] of m) if (now - info.ts > TTL) m.delete(user);
    if (!m.size) presence.delete(k);
  }
}, 30000).unref();
