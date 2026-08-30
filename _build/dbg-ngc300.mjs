import fs from 'node:fs';
const d = fs.readFileSync(new URL('./ngc-vii118.xml', import.meta.url), 'utf8');
const rows = d.match(/<TR>[\s\S]*?<\/TR>/g) || [];
const cells = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };
const R = rows.map(cells);
/* 1) what is at the true NGC 300 position (23.3242, -37.2089)? */
const raOf = s => { const t = s.split(/\s+/).map(Number); return (t[0] + t[1] / 60) * 15; };
const decOf = s => { const neg = s.startsWith('-'); const t = s.replace(/^[+-]/, '').split(/\s+/).map(Number); return (neg ? -1 : 1) * ((t[0] || 0) + (t[1] || 0) / 60 + (t[2] || 0) / 3600); };
let best = null, bd = 1e9;
for (const r of R) {
  if (r.length < 8) continue;
  const ra = raOf(r[3] || ''), dec = decOf(r[4] || '');
  if (Number.isNaN(ra) || Number.isNaN(dec)) continue;
  const dd = Math.hypot((ra - 23.3242) * Math.cos(37.2 * Math.PI / 180), dec + 37.2089);
  if (dd < bd) { bd = dd; best = r; }
}
console.log('nearest file row to true NGC 300 (23.3242, -37.2089):', JSON.stringify(best.slice(0, 8)), ' d =', (bd * 60).toFixed(1) + "'");
/* 2) all rows named I102 / 102 / I 102 */
for (const r of R) {
  const n = (r[1] || '').replace(/\s+/g, '');
  if (n === 'I102' || n === '102' || n === 'I 102') console.log('named 102:', JSON.stringify(r.slice(0, 8)));
}
