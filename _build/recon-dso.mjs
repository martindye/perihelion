/* Recon: NGC 2000.0 (VII/118) type distribution + epoch check + Messier table parse */
import fs from 'node:fs';
const dir = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';

/* ---- 1. NGC file: parse rows, count types ---- */
const xml = fs.readFileSync(dir + 'ngc-vii118.xml', 'utf8');
const rows = [...xml.matchAll(/<TR>(.*?)<\/TR>/gs)].map(m =>
  [...m[1].matchAll(/<TD>(.*?)<\/TD>/gs)].map(c => c[1].trim()));
console.log('NGC rows:', rows.length);
const typeCount = {};
for (const r of rows) {
  if (r.length < 4) continue;
  const t = r[2] || '(empty)';
  typeCount[t] = (typeCount[t] || 0) + 1;
}
console.log('type distribution:');
Object.entries(typeCount).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log('  ' + JSON.stringify(t) + ': ' + n));

/* ---- 2. epoch check: NGC 1434 (Pleiades core; J2000 ≈ 03h47m, +24°07') ---- */
const plei = rows.filter(r => ['1434','1435','1438','1439','1440','1441'].includes(r[1]));
console.log('\nPleiades NGC entries:');
for (const r of plei) console.log('  ', r.slice(0, 11).join(' | '));

/* sample of each non-galaxy type */
const byType = new Map();
for (const r of rows) {
  const t = r[2] || '(empty)';
  if (!byType.has(t)) byType.set(t, r);
}
console.log('\nfirst example per type:');
for (const [t, r] of byType) console.log('  ' + JSON.stringify(t) + ' -> ' + r.slice(0, 12).join(' | '));

/* ---- 3. Messier table from Wikipedia HTML ---- */
const wiki = fs.readFileSync(dir + 'messier.html', 'utf8');
/* rows: <tr ...>...<th...>M1</a>... then <td> cells ... </tr> */
const trs = [...wiki.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map(m => m[0])
  .filter(t => /<th[^>]*>(?:<a[^>]*>)?\s*M\d{1,3}\b/.test(t) || /M110/.test(t));
console.log('\nMessier table rows found:', trs.length);
const cells = h => [...h.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c =>
  c[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim());
const sample = [];
for (const t of trs.slice(0, 3)) sample.push(cells(t));
for (const m42 of trs.filter(t => t.includes('>M42<') || t.includes('M42</a'))) {
  console.log('M42 cells:', JSON.stringify(cells(m42)));
}
for (const m of trs.filter(t => />M1</.test(t) && /M1</.test(t)).slice(0,1)) {
  console.log('M1 cells: ', JSON.stringify(cells(m)));
}
for (const m of trs.filter(t => /M110/.test(t) && !/M11/.test(t.replace('M110',''))).slice(0,1)) {
  console.log('M110 cells:', JSON.stringify(cells(m)));
}
/* count how many M-rows parsed with >= 6 cells */
let ok = 0;
for (const t of trs) if (cells(t).length >= 6) ok++;
console.log('rows with >=6 cells:', ok);
