import fs from 'node:fs';
const d = fs.readFileSync(new URL('./corwin-vii239a.xml', import.meta.url), 'utf8');
const tables = d.match(/<TABLE[\s\S]*?<\/TABLE>/g) || [];
const parseTable = tb => {
  const fields = [...tb.matchAll(/<FIELD name="([^"]+)"/g)].map(x => x[1]);
  const idx = {}; fields.forEach((f, i) => { if (!(f in idx)) idx[f] = i; });
  const rows = (tb.match(/<TR>[\s\S]*?<\/TR>/g) || []).map(tr => {
    const cells = []; const re = /<TD([^>]*?)(\/>|>)/g; let m;
    while ((m = re.exec(tr))) { const s = m.index + m[0].length; const c = tr.indexOf('</TD>', s); cells.push(tr.slice(s, c).replace(/<[^>]+>/g, '').trim()); }
    return cells;
  });
  return { fields, idx, rows };
};
const T2000 = parseTable(tables[0]), T1950 = parseTable(tables[1]);
console.log('T2000 fields:', T2000.fields.join(' | '));
console.log('T1950 fields:', T1950.fields.join(' | '));
const get = (T, r, n) => { const i = T.idx[n]; return i == null ? '' : (r[i] ?? ''); };
const show = (T, r, tag) => console.log(tag, 'key=' + (get(T, r, 'Cat') + '|' + get(T, r, 'NGC/IC')),
  'RA=' + get(T, r, 'RAJ2000' in T.idx ? 'RAJ2000' : 'RAB1950'), 'DE=' + get(T, r, 'DEJ2000' in T.idx ? 'DEJ2000' : 'DEB1950'), 'raw=', JSON.stringify(r.slice(0, 8)));
console.log('\n-- T2000 (J2000 table) first 3:');
for (let i = 0; i < 3; i++) show(T2000, T2000.rows[i], 'J2000');
console.log('\n-- T1950 (B1950 table) first 3:');
for (let i = 0; i < 3; i++) show(T1950, T1950.rows[i], 'B1950');
// find same key in both
const k2 = new Map(); for (const r of T2000.rows) k2.set(get(T2000, r, 'Cat') + '|' + get(T2000, r, 'NGC/IC'), r);
console.log('\n-- joined (first 5):');
let c = 0;
for (const r15 of T1950.rows) {
  const k = get(T1950, r15, 'Cat') + '|' + get(T1950, r15, 'NGC/IC');
  const j = k2.get(k); if (!j) continue;
  console.log(k, '\n   J2000 RA/DE =', get(T2000, j, 'RAJ2000'), get(T2000, j, 'DEJ2000'),
    '\n   B1950 RA/DE =', get(T1950, r15, 'RAB1950'), get(T1950, r15, 'DEB1950'));
  if (++c >= 5) break;
}
