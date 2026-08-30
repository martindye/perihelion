import fs from 'node:fs';
const d = fs.readFileSync(new URL('./ngc-vii118.xml', import.meta.url), 'utf8');
const rows = d.match(/<TR>[\s\S]*?<\/TR>/g) || [];
const cells = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };
const R = rows.map(cells);
const raOf = s => { const t = s.split(/\s+/).map(Number); return t.length === 2 ? (t[0] + t[1] / 60) * 15 : t.length === 3 ? (t[0] + t[1] / 60 + t[2] / 3600) * 15 : NaN; };
const decOf = s => { const neg = s.startsWith('-'); const t = s.replace(/^[+-]/, '').split(/\s+/).map(Number); return (neg ? -1 : 1) * ((t[0] || 0) + (t[1] || 0) / 60 + (t[2] || 0) / 3600); };
const rows2 = R.map(r => ({ recno: r[0], name: (r[1] || '').replace(/\s+/g, ''), type: r[2], ra: raOf(r[3] || ''), dec: decOf(r[4] || '') }));

// Known J2000 positions (deg) of famous NGC objects — check what the file labels each position
const probes = [
  ['M31  (NGC 224)', 10.6846, 41.2692],
  ['M51  (NGC 5194)', 202.489, 47.195],
  ['M83  (NGC 5586?)', 204.9375, -29.8639],
  ['M101 (NGC 5457)', 210.802, 54.349],
  ['M81  (NGC 3031)', 148.898, 69.065],
  ['M104 (NGC 4579)', 189.845, -11.623],
  ['NGC 4565', 177.665, 25.996],
  ['NGC 4414', 181.465, 31.524],
];
for (const [label, ra, dec] of probes) {
  let best = null, bd = 1e9;
  for (const r of rows2) {
    if (Number.isNaN(r.ra) || Number.isNaN(r.dec)) continue;
    const dd = Math.hypot((r.ra - ra) * Math.cos(dec * Math.PI / 180), r.dec - dec);
    if (dd < bd) { bd = dd; best = r; }
  }
  console.log(label.padEnd(18), '-> file says: name="' + best.name + '" recno ' + best.recno, ' type ' + best.type, ' at', (best.ra).toFixed(3), best.dec.toFixed(3), ' d=' + (bd * 60).toFixed(1) + "'");
}
