// Eenvoudige regel-gebaseerde diff (Myers-achtige LCS). Bedoeld voor het tonen
// van verschillen tussen twee tekstversies van een bestand in de web-UI.
// Geeft een lijst hunks terug: { type: 'eq'|'add'|'del', line }.

export function lineDiff(oldText, newText) {
  const a = String(oldText).split('\n');
  const b = String(newText).split('\n');
  const n = a.length, m = b.length;
  // LCS-lengtematrix (begrensd: bij zeer grote invoer valt hij terug op een
  // grove regel-voor-regel vergelijking om geheugen te sparen).
  if (n * m > 4_000_000) return coarse(a, b);
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'eq', line: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ type: 'del', line: a[i] }); i++; }
    else { out.push({ type: 'add', line: b[j] }); j++; }
  }
  while (i < n) { out.push({ type: 'del', line: a[i++] }); }
  while (j < m) { out.push({ type: 'add', line: b[j++] }); }
  return out;
}

function coarse(a, b) {
  const out = [];
  const len = Math.max(a.length, b.length);
  for (let k = 0; k < len; k++) {
    if (a[k] === b[k]) out.push({ type: 'eq', line: a[k] });
    else { if (k < a.length) out.push({ type: 'del', line: a[k] }); if (k < b.length) out.push({ type: 'add', line: b[k] }); }
  }
  return out;
}

// Samenvatting: aantal toegevoegde/verwijderde regels.
export function diffStat(hunks) {
  let added = 0, removed = 0;
  for (const h of hunks) { if (h.type === 'add') added++; else if (h.type === 'del') removed++; }
  return { added, removed };
}
