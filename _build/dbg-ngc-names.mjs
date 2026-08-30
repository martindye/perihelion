import fs from 'node:fs';
const d = fs.readFileSync(new URL('./ngc-vii118.xml', import.meta.url), 'utf8');
const rows = d.match(/<TR>([\s\S]*?)<\/TR>/g) || [];
const cells = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };
const R = rows.map(cells);
const want = ['224', '253', '300', '55', '5586', '5128', '1300', '1316', '1365', '4622', '4945'];
for (const w of want) {
  const hits = R.filter(r => (r[1] || '').replace(/\s+/g, '') === w);
  console.log('Name=="' + w + '":', hits.length ? hits.map(r => r[0] + '|' + r[2] + '|' + r[3] + ' ' + r[4]).join(' ; ') : 'NONE');
}
/* also: how many rows per Name shape */
const shapes = { ngc: 0, icI: 0, other: 0 };
for (const r of R) {
  const n = (r[1] || '').replace(/\s+/g, '');
  if (/^\d{1,4}$/.test(n)) shapes.ngc++;
  else if (/^I\d{1,5}$/.test(n)) shapes.icI++;
  else shapes.other++;
}
console.log('Name shapes:', shapes);
/* samples of 'other' */
let c = 0;
for (const r of R) {
  const n = (r[1] || '').replace(/\s+/g, '');
  if (!/^\d{1,4}$/.test(n) && !/^I\d{1,5}$/.test(n) && n && c < 10) { console.log('  other:', r[0], JSON.stringify(r[1]), r[2]); c++; }
}
