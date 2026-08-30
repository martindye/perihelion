import fs from 'node:fs';
const d = fs.readFileSync(new URL('./ngc-vii118.xml', import.meta.url), 'utf8');
const rows = d.match(/<TR>([\s\S]*?)<\/TR>/g) || [];
const cells = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };
const R = rows.map(cells);
// M31 = NGC 224 = (10.6846°, 41.2692°). Find rows near it.
const raOf = s => { const t = s.split(/\s+/).map(Number); return t.length === 2 ? (t[0] + t[1] / 60) * 15 : t.length === 3 ? (t[0] + t[1] / 60 + t[2] / 3600) * 15 : NaN; };
const decOf = s => { const neg = s.startsWith('-'); const t = s.replace(/^[+-]/, '').split(/\s+/).map(Number); const v = t[0] + t[1] / 60 + (t[2] || 0) / 3600; return neg ? -v : v; };
console.log('recno | name | type | RAraw | DEraw | RAdeg | DEdeg');
let shown = 0;
for (let i = 0; i < R.length && shown < 12; i++) {
  const r = R[i]; if (r.length < 6) continue;
  const ra = raOf(r[3]), dec = decOf(r[4]);
  if (Number.isNaN(ra) || Number.isNaN(dec)) continue;
  if (Math.abs(ra - 10.6846) < 0.05 && Math.abs(dec - 41.2692) < 0.05) {
    console.log((r[0] || '?').padStart(6), '|', (r[1] || '').padEnd(8), '|', (r[2] || '').padEnd(3), '|', r[3].padEnd(8), r[4].padEnd(8), ra.toFixed(4), dec.toFixed(4));
    shown++;
  }
}
console.log('\n-- also: what recno has Name containing "224" or "M31" near the top? --');
for (let i = 0; i < 80; i++) {
  const r = R[i]; if (!r || r.length < 6) continue;
  if (/M31|224/.test(r[1] || '')) console.log('recno', r[0], 'name', r[1], r[3], r[4]);
}
console.log('\nfirst 5 rows recno/name/RA/DE:');
for (let i = 0; i < 5; i++) console.log(' ', R[i][0], '|', R[i][1], '|', R[i][3], R[i][4]);
