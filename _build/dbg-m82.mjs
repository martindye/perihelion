import fs from 'node:fs';
const D = new URL('./', import.meta.url);
const d = fs.readFileSync(new URL('ngc-vii118.xml', D), 'utf8');
const rows = d.match(/<TR>[\s\S]*?<\/TR>/g) || [];
const cells = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };
const raOf = s => { const t = s.split(/\s+/).map(Number); return (t[0] + t[1] / 60) * 15; };
const decOf = s => { const neg = s.startsWith('-'); const t = s.replace(/^[+-]/, '').split(/\s+/).map(Number); return (neg ? -1 : 1) * ((t[0] || 0) + (t[1] || 0) / 60 + (t[2] || 0) / 3600); };
// M82 true J2000: 09h55m53.9s +69d40'47" = (148.9746, 69.6797)
let best = [], bd = 1e9;
for (const tr of rows) {
  const r = cells(tr);
  if (r.length < 8) continue;
  const ra = raOf(r[3] || ''), dec = decOf(r[4] || '');
  if (Number.isNaN(ra) || Number.isNaN(dec)) continue;
  const dd = Math.hypot((ra - 148.9746) * Math.cos(69.68 * Math.PI / 180), dec - 69.6797);
  if (dd < bd) { bd = dd; best = [r, dd]; }
}
console.log('nearest file row to M82 J2000 pos:', JSON.stringify(best[0].slice(0, 11)), ' d =', (best[1] * 60).toFixed(1) + ' arcmin');
// also: which row has name 5101 (shown earlier at 13h21 -27) and any name near 69.68?
const hits = [];
for (const tr of rows) {
  const r = cells(tr);
  const dec = decOf(r[4] || '');
  if (!Number.isNaN(dec) && Math.abs(dec - 69.68) < 0.5) hits.push(r.slice(0, 8));
}
console.log('rows with dec near +69.68:');
hits.forEach(h => console.log('  ', JSON.stringify(h)));
