const fs = require('fs');
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const html = fs.readFileSync(B + 'messier.html', 'utf8');
for (const id of ['M1', 'M8', 'M32', 'M33', 'M45', 'M57', 'M63', 'M104']) {
  const blk = html.split(/<tr[ >]/).find(b => new RegExp('<th[^>]*>.*?<a[^>]*>' + id + '</a>', 's').test(b));
  if (!blk) { console.log(id, 'no block'); continue; }
  const cells = [...blk.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(x => x[1]);
  console.log('=== ' + id + ' cells=' + cells.length);
  for (let k = Math.max(0, cells.length - 3); k < cells.length; k++) {
    console.log('  cell[' + k + ']:', JSON.stringify(cells[k].replace(/data-mw='[^']*'/g, '[DATA-MW]').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)));
  }
  console.log('  raw RA cell head:', JSON.stringify(cells[cells.length - 2].slice(0, 400)));
}
