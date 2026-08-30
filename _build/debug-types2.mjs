/* debug-types2.mjs — dump type cell (display text + sort value) per row */
import fs from 'node:fs';
const d = fs.readFileSync(new URL('./messier.html', import.meta.url), 'utf8');
const ti = d.indexOf('id="mwuw"'), t0 = d.lastIndexOf('<table', ti), t1 = d.indexOf('</table>', ti);
const tbl = d.slice(t0, t1);
const rows = tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
const clean = h => h
  .replace(/data-mw='[^']*'/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&deg;/g, '°')
  .replace(/&prime;/g, '′').replace(/&Prime;/g, '″').replace(/&times;/g, '×')
  .replace(/\s+/g, ' ').trim();
for (const r of rows) {
  const idm = r.match(/>(M\d{1,3})</);
  if (!idm) continue;
  /* split into raw cell fragments: content between each td/th open and the next close */
  const cellRe = /<(td|th)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1>)/g;
  let m; const raw = [];
  while ((m = cellRe.exec(r))) raw.push(m[2]);
  const typeRaw = raw[4] || '';
  const sortv = (typeRaw.match(/data-sort-value="([^"]*)"/) || [])[1] || '';
  console.log(idm[1], '| sort=' + JSON.stringify(sortv), '| text=' + JSON.stringify(clean(typeRaw).slice(0, 60)));
}
