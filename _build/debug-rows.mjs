/* debug-rows.mjs — dump parsed cells for a few Messier rows */
import fs from 'node:fs';
const d = fs.readFileSync(new URL('./messier.html', import.meta.url), 'utf8');
const strip = h => h.replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&deg;/g, '°')
  .replace(/&prime;/g, '′').replace(/&Prime;/g, '″').replace(/&times;/g, '×')
  .replace(/\s+/g, ' ').trim();
const ti = d.indexOf('id="mwuw"'), t0 = d.lastIndexOf('<table', ti), t1 = d.indexOf('</table>', ti);
const tbl = d.slice(t0, t1);
const rows = tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
console.log('rows:', rows.length);
const cells = r => {
  const re = /<(td|th)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1>)/g;
  let m; const cc = [];
  while ((m = re.exec(r))) cc.push(strip(m[2]));
  return cc;
};
for (const rid of ['M 31', 'M31', 'M 33', 'M 51', 'M 104', 'M 1']) {
  const row = rows.find(r => { const c = cells(r); return c[0] && c[0].includes(rid.trim()) && c.length > 3; });
  if (!row) { console.log(rid, ': NOT FOUND'); continue; }
  const c = cells(row);
  console.log('---', rid, 'cells:', c.length);
  c.forEach((x, i) => console.log(' [' + i + ']', JSON.stringify(x.slice(0, 44))));
}
