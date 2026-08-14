import fs from 'node:fs';

// Kleine JSON-datastore met een mtime-gebaseerde lees-cache. Veel modules lezen
// hun hele JSON-bestand bij elke bewerking opnieuw van schijf en parsen het;
// onder intensief gebruik is dat merkbare latency. Deze helper parset alleen
// opnieuw wanneer het bestand echt is gewijzigd (andere mtime/grootte) en geeft
// anders het in-memory object terug. Schrijvers werken de cache meteen bij, en
// externe wijzigingen (andere proces) worden opgemerkt via de mtime.

const cache = new Map(); // file -> { mtimeMs, size, data }

// Lees (en cache) het JSON-bestand. `fallback` wordt geretourneerd als het
// bestand ontbreekt of onleesbaar is. Het geretourneerde object mag door de
// aanroeper worden gemuteerd mits daarna writeJson() met datzelfde object wordt
// aangeroepen (zoals de bestaande readAll/writeAll-patronen doen).
export function readJson(file, fallback) {
  let st;
  try { st = fs.statSync(file); } catch { return typeof fallback === 'function' ? fallback() : fallback; }
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.data;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    cache.set(file, { mtimeMs: st.mtimeMs, size: st.size, data });
    return data;
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

// Schrijf het JSON-bestand en ververs de cache, zodat de eerstvolgende readJson
// niet opnieuw hoeft te parsen.
export function writeJson(file, data, opts = {}) {
  fs.writeFileSync(file, JSON.stringify(data), opts);
  try {
    const st = fs.statSync(file);
    cache.set(file, { mtimeMs: st.mtimeMs, size: st.size, data });
  } catch { cache.delete(file); }
}
