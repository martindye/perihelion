import fs from 'node:fs';
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const html = fs.readFileSync(B + 'messier.html', 'utf8');
const plainCell = c => c.replace(/data-mw='[^']*'/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
for (const want of ['M45', 'M57', 'M13', 'M42']) {
  for (const blk of html.split(/<tr[ >]/).slice(1)) {
    const nm = blk.match(/<th[^>]*>.*?<a[^>]*>(M\d+)<\/a>/s);
    if (!nm) continue;
    if (!nm[1].startsWith(want) || want !== nm[1]) continue;
    const cells = [...blk.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(x => x[1]);
    console.log('=== ' + nm[1] + '  cells=' + cells.length);
    cells.forEach((c, i) => console.log('  [' + i + '] ' + JSON.stringify(plainCell(c)).slice(0, 110)));
    break;
  }
}
