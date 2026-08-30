import fs from 'node:fs';
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const html = fs.readFileSync(B + 'messier.html', 'utf8');
const plainCell = c => c.replace(/data-mw='[^']*'/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
for (const blk of html.split(/<tr[ >]/).slice(1)) {
  const nm = blk.match(/<th[^>]*>.*?<a[^>]*>(M1)<\/a>/s);
  if (!nm) continue;
  const cells = [...blk.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(x => x[1]);
  const t4 = plainCell(cells[4]);
  console.log('cell4 raw:', JSON.stringify(t4));
  console.log('codes:', [...t4].map(c => c.codePointAt(0).toString(16)).join(' '));
}
