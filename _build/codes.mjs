import fs from 'node:fs';
const d = fs.readFileSync(new URL('./messier.html', import.meta.url), 'utf8');
const ti = d.indexOf('id="mwuw"'), t1 = d.indexOf('</table>', ti);
const tbl = d.slice(d.lastIndexOf('<table', ti), t1);
const rows = tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
const codes = {};
for (const r of rows) {
  const cm = r.match(/data-sort-value=\\"([A-Z]+)\\"/);
  if (cm) codes[cm[1]] = (codes[cm[1]] || 0) + 1;
}
console.log(JSON.stringify(codes, null, 1));
/* also: for each galaxy-code row, print id + display text */
for (const r of rows) {
  const cm = r.match(/data-sort-value=\\"([A-Z]+)\\"/);
  if (!cm) continue;
  if (!/^(GS|GED|GE|GIR|GAL|G)/.test(cm[1]) || cm[1] === 'CG') continue;
  const id = (r.match(/>(M\d{1,3})</) || [])[1];
  const txt = r.replace(/data-mw='[^']*'/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const t = txt.match(/(Spiral|Elliptical|Irregular|Lenticular|Spiral|Dwarf)[^|]{0,30}/);
  console.log(cm[1], id, (t || ['?'])[0].slice(0, 40));
}
