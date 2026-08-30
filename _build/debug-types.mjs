/* debug-types.mjs — dump raw type cell + data-sort-value for every row */
import fs from 'node:fs';
const d = fs.readFileSync(new URL('./messier.html', import.meta.url), 'utf8');
const ti = d.indexOf('id="mwuw"'), t0 = d.lastIndexOf('<table', ti), t1 = d.indexOf('</table>', ti);
const tbl = d.slice(t0, t1);
const rows = tbl.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
for (const r of rows) {
  const idm = r.match(/>(M\d{1,3})</);
  const id = idm ? idm[1] : '?';
  /* split cells on the td/th boundaries, keeping raw html */
  const parts = r.split(/<\/t[dh]>|<(?:td|th)[^>]*>/);
  /* type cell is index 8 in the parts array (each td = 2 fragments: open+content, close empty) */
  let typeRaw = '', sortv = '';
  for (const p of parts) {
    const sv = p.match(/data-sort-value="([^"]+)"/);
    if (sv) { sortv = sv[1]; break; }
  }
  const sn = r.match(/>(M\d{1,3})\s*(?:<[^>]*>)*\s*([A-Za-z][A-Za-z ()\/\-]*)</);
  console.log(id, '| sortv=' + JSON.stringify(sortv));
}
