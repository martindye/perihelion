import fs from 'node:fs';
const d = fs.readFileSync(new URL('./ngc-vii118.xml', import.meta.url), 'utf8');
const rows = d.match(/<TR>([\s\S]*?)<\/TR>/g) || [];
const cells = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };
// raw row for recno 225 (NGC 224 = M31) and neighbors
for (const i of [223, 224, 225, 5193, 5194]) {
  const r = cells(rows[i]);
  console.log('idx', i, '(recno', r[0] + '):', JSON.stringify(r.slice(0, 8)));
}
/* also check the FIELD ucd/units declarations */
const flds = d.match(/<FIELDS>[\s\S]*?<\/FIELDS>/);
console.log('\nFIELDS block:');
console.log(flds ? flds[0].replace(/></g, '>\n<').slice(0, 1500) : '(none)');
