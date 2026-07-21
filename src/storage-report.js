import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Opslagrapport: grootste bestanden en grootste mappen binnen de opslag,
// plus totalen per gebruiker (home-map). Diepte begrensd voor de performance.

export function storageReport(topN = 15) {
  const files = [];
  const dirTotals = new Map();

  function walk(abs, rel, depth) {
    if (depth > 8) return 0;
    let total = 0;
    let entries = [];
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return 0; }
    for (const e of entries) {
      const full = path.join(abs, e.name);
      const r = rel + '/' + e.name;
      if (e.isDirectory()) {
        total += walk(full, r, depth + 1);
      } else {
        let size = 0;
        try { size = fs.statSync(full).size; } catch { /* skip */ }
        total += size;
        files.push({ path: r, size });
      }
    }
    dirTotals.set(rel || '/', total);
    return total;
  }

  const grand = walk(config.storageDir, '', 0);
  files.sort((a, b) => b.size - a.size);
  const dirs = [...dirTotals.entries()].map(([p, size]) => ({ path: p || '/', size }))
    .filter((d) => d.path !== '/').sort((a, b) => b.size - a.size);

  return {
    total: grand,
    largestFiles: files.slice(0, topN),
    largestDirs: dirs.slice(0, topN),
  };
}
