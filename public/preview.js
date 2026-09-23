// Betere preview (v3.44): Markdown met inhoudsopgave, CSV als sorteerbare tabel
// en syntax-highlighting voor code. Alles wordt eerst ge-escaped; er komt nooit
// ruwe bestandsinhoud als HTML in de pagina.
(function () {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const slug = (s, used) => { let b = s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'kop'; let x = b, i = 2; while (used.has(x)) x = b + '-' + i++; used.add(x); return x; };

  // --- Markdown + inhoudsopgave ---
  function markdown(src) {
    const used = new Set(); const toc = [];
    const blocks = []; // codeblokken apart houden zodat er niets in wordt opgemaakt
    let h = esc(src).replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => { blocks.push(highlightEscaped(code, lang)); return `\u0000${blocks.length - 1}\u0000`; });
    h = h.replace(/^(#{1,4}) (.*)$/gm, (m, hs, text) => { const lvl = hs.length; const id = 'md-' + slug(text, used); toc.push({ lvl, id, text }); return `<h${lvl + 1} id="${id}">${text}</h${lvl + 1}>`; });
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    h = h.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
    h = h.replace(/^[-*] \[( |x)\] (.*)$/gm, (m, c, t) => `<li class="task">${c === 'x' ? '☑' : '☐'} ${t}</li>`);
    h = h.replace(/^[-*] (.*)$/gm, '<li>$1</li>').replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
    h = h.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
    h = h.replace(/^(?:---|\*\*\*)$/gm, '<hr>');
    h = h.replace(/\n{2,}/g, '<br><br>');
    h = h.replace(/\u0000(\d+)\u0000/g, (m, i) => `<pre class="code">${blocks[+i]}</pre>`);
    const tocHtml = toc.length >= 2 ? `<nav class="md-toc"><b>Inhoud</b><ul>${toc.map((t) => `<li style="margin-left:${(t.lvl - 1) * .9}rem"><a href="#${t.id}" data-toc="${t.id}">${t.text}</a></li>`).join('')}</ul></nav>` : '';
    return { html: h, toc: tocHtml, headings: toc.length };
  }

  // --- CSV ---
  function parseCsv(text, max = 5000) {
    const first = text.split('\n', 1)[0];
    const delim = [';', '\t', ',', '|'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"' && cell === '') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = []; if (rows.length > max) break; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return { rows: rows.filter((r) => r.length > 1 || r[0] !== ''), delim, truncated: rows.length > max };
  }
  const num = (v) => { const s = String(v).trim().replace(/\s/g, ''); if (!/^-?[\d.,]+$/.test(s)) return null; const n = parseFloat(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
  function csvTable(text) {
    const { rows, truncated } = parseCsv(text);
    if (!rows.length) return '<p class="muted">Leeg bestand.</p>';
    const [head, ...body] = rows;
    const id = 'csv' + Math.random().toString(36).slice(2, 8);
    return `<div class="csv-wrap"><input class="csv-filter" data-csvfilter="${id}" placeholder="Filter rijen…"> <span class="muted">${body.length} rijen${truncated ? ' (ingekort)' : ''} · klik op een kolom om te sorteren</span>
      <div style="overflow:auto;max-height:66vh"><table class="csv" id="${id}"><thead><tr>${head.map((c, i) => `<th data-csvsort="${i}" tabindex="0">${esc(c)} <span class="dir"></span></th>`).join('')}</tr></thead>
      <tbody>${body.map((r) => `<tr>${head.map((_, i) => `<td>${esc(r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }
  function sortTable(th) {
    const table = th.closest('table'); const col = +th.dataset.csvsort; const tb = table.tBodies[0];
    const asc = th.dataset.sortdir !== 'asc';
    table.querySelectorAll('th').forEach((x) => { x.dataset.sortdir = ''; x.querySelector('.dir').textContent = ''; });
    th.dataset.sortdir = asc ? 'asc' : 'desc'; th.querySelector('.dir').textContent = asc ? '▲' : '▼';
    const rows = [...tb.rows]; const key = (r) => r.cells[col] ? r.cells[col].textContent : '';
    const allNum = rows.every((r) => key(r) === '' || num(key(r)) !== null);
    rows.sort((a, b) => { const x = key(a), y = key(b); const d = allNum ? (num(x) ?? -Infinity) - (num(y) ?? -Infinity) : x.localeCompare(y, 'nl', { numeric: true, sensitivity: 'base' }); return asc ? d : -d; });
    tb.append(...rows);
  }
  document.addEventListener('click', (e) => {
    const th = e.target.closest && e.target.closest('th[data-csvsort]'); if (th) return sortTable(th);
    const a = e.target.closest && e.target.closest('a[data-toc]'); if (a) { e.preventDefault(); const t = document.getElementById(a.dataset.toc); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  document.addEventListener('keydown', (e) => { const th = e.target.closest && e.target.closest('th[data-csvsort]'); if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sortTable(th); } });
  document.addEventListener('input', (e) => {
    const id = e.target.dataset && e.target.dataset.csvfilter; if (!id) return;
    const q = e.target.value.toLowerCase(); const t = document.getElementById(id);
    for (const r of t.tBodies[0].rows) r.style.display = !q || r.textContent.toLowerCase().includes(q) ? '' : 'none';
  });

  // --- Syntax-highlighting (lichtgewicht tokenizer op ge-escapete tekst) ---
  const KW = {
    js: 'await async break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null return static super switch this throw true try typeof undefined var void while yield of',
    py: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self',
    sh: 'if then else elif fi for in do done while until case esac function return export local echo exit set unset source',
    sql: 'select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit as null is in like distinct union all primary key',
    go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false',
    css: 'important', json: 'true false null', yaml: 'true false null yes no', java: 'abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true false try void while',
  };
  const LANG = { js: 'js', mjs: 'js', cjs: 'js', ts: 'js', tsx: 'js', jsx: 'js', py: 'py', sh: 'sh', bash: 'sh', zsh: 'sh', sql: 'sql', go: 'go', css: 'css', scss: 'css', json: 'json', yml: 'yaml', yaml: 'yaml', java: 'java', kt: 'java', c: 'java', h: 'java', cpp: 'java', cs: 'java', rs: 'go', php: 'js', rb: 'py', ini: 'sh', conf: 'sh', toml: 'sh', html: 'html', htm: 'html', xml: 'html', svg: 'html', vue: 'html' };
  function highlightEscaped(code, langOrExt) {
    const lang = LANG[String(langOrExt || '').toLowerCase()] || String(langOrExt || '').toLowerCase();
    if (lang === 'html') return code.replace(/(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([\w:-]+)|([\w:-]+)(=)(&quot;[^&]*?&quot;)/g, (m, com, lt, tag, attr, eq, val) => com ? `<span class="t-c">${com}</span>` : tag ? `${lt}<span class="t-k">${tag}</span>` : `<span class="t-a">${attr}</span>${eq}<span class="t-s">${val}</span>`);
    const kws = new Set((KW[lang] || KW.js).split(' '));
    const hashC = ['py', 'sh', 'yaml'].includes(lang);
    const re = hashC
      ? /(#[^\n]*)|(&quot;(?:[^&\n]|&(?!quot;))*?&quot;|'[^'\n]*')|(\b\d[\d_.]*\b)|([A-Za-z_]\w*)/g
      : lang === 'sql'
        ? /(--[^\n]*|\/\*[\s\S]*?\*\/)|('[^'\n]*'|&quot;[^\n]*?&quot;)|(\b\d[\d_.]*\b)|([A-Za-z_]\w*)/g
        : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;(?:[^&\n]|&(?!quot;))*?&quot;|'[^'\n]*'|`[^`]*`)|(\b\d[\d_.]*\b)|([A-Za-z_$][\w$]*)/g;
    return code.replace(re, (m, com, str, n, word) => {
      if (com) return `<span class="t-c">${com}</span>`;
      if (str) return `<span class="t-s">${str}</span>`;
      if (n) return `<span class="t-n">${n}</span>`;
      if (word && kws.has(lang === 'sql' ? word.toLowerCase() : word)) return `<span class="t-k">${word}</span>`;
      return m;
    });
  }
  function code(text, ext) {
    const lines = esc(text).split('\n');
    const hl = highlightEscaped(lines.join('\n'), ext).split('\n');
    return `<pre class="code numbered">${hl.map((l, i) => `<span class="ln">${i + 1}</span>${l}`).join('\n')}</pre>`;
  }
  const isCode = (name) => /\.(m?js|cjs|tsx?|jsx|py|sh|bash|zsh|sql|go|css|scss|json|ya?ml|java|kt|c|h|cpp|cs|rs|php|rb|ini|conf|toml|html?|xml|svg|vue)$/i.test(name);

  window.Preview = { markdown, csvTable, parseCsv, code, isCode, highlightEscaped };
})();
