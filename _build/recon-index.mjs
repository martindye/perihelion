/* Inspect NGC index table (Messier cross-refs) + Messier common names from Wikipedia */
import fs from 'node:fs';
const dir = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const xml = fs.readFileSync(dir + 'ngc-vii118.xml', 'utf8');

/* The file has two <TABLE> sections. Split on them. */
const tables = [...xml.matchAll(/<TABLE[^>]*>([\s\S]*?)<\/TABLE>/g)];
console.log('tables found:', tables.length);
for (const [ti, t] of tables.entries()) {
  const trs = [...t[1].matchAll(/<TR>([\s\S]*?)<\/TR>/g)];
  console.log(`table ${ti}: ${trs.length} rows; first 3:`);
  for (const r of trs.slice(0, 3)) {
    const cells = [...r[1].matchAll(/<TD>([\s\S]*?)<\/TD>/g)].map(c => c[1].trim());
    console.log('   ', JSON.stringify(cells));
  }
}
/* index table: find rows whose Name/Comment contains "M " (Messier refs) */
const idx = tables[1] || tables[0];
const rows = [...idx[1].matchAll(/<TR>([\s\S]*?)<\/TR>/g)].map(r =>
  [...r[1].matchAll(/<TD>([\s\S]*?)<\/TD>/g)].map(c => c[1].trim()));
let mCount = 0;
const mRows = [];
for (const r of rows) {
  if (r.length < 3) continue;
  /* fields: Object, Name, Comment — look for M-refs anywhere */
  const all = r.join(' | ');
  const mm = all.match(/\bM\s?\d{1,3}\b/g);
  if (mm) { mCount++; if (mRows.length < 12) mRows.push(all); }
}
console.log('\nindex rows mentioning M#:', mCount);
mRows.forEach(r => console.log('  ', r.slice(0, 150)));

/* Wikipedia Messier: extract M#, common name (cell 3), NGC list (cell 2) */
const wiki = fs.readFileSync(dir + 'messier.html', 'utf8');
const trs = [...wiki.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map(m => m[0])
  .filter(t => /<th[^>]*>(?:<a[^>]*>)?\s*M\d{1,3}\b/.test(t));
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&apos;/g, "'").replace(/&#8209;/g, '-').replace(/&minus;/g, '-').replace(/\s+/g, ' ').trim();
const out = [];
for (const t of trs) {
  const cells = [...t.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => strip(c[1]));
  const m = /M(\d{1,3})/.exec(cells[0] || '');
  if (!m) continue;
  out.push({ m: +m[1], ngc: cells[1] || '', common: cells[2] || '' });
}
console.log('\nMessier name table:', out.length);
for (const o of out.slice(0, 14)) console.log('  M' + o.m, '|', o.ngc, '|', o.common);
fs.writeFileSync(dir + 'messier-names.json', JSON.stringify(out, null, 1));
console.log('wrote messier-names.json');
