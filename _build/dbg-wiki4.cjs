const fs = require('fs');
const html = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/messier.html', 'utf8');
function cellRaDec(blk) {
  const ri = blk.indexOf('"wt":"RA"'), di = blk.indexOf('"wt":"DEC"');
  const grab = (s) => {
    const m = s.match(/"params":\{"1":\{"wt":"([+-]?\d+)"\},"2":\{"wt":"([\d.]+)"\}(?:,"3":\{"wt":"([\d.]+)"\})?/);
    return m ? [m[1], m[2], m[3]] : null;
  };
  return [grab(blk.slice(ri, ri + 800)), grab(blk.slice(di, di + 800))];
}
for (const id of ['M10', 'M11', 'M12', 'M13', 'M14', 'M70']) {
  const blk = html.split(/<tr[ >]/).find(b => new RegExp('<th[^>]*>.*?<a[^>]*>(' + id + ')</a>', 's').test(b));
  if (!blk) { console.log(id, 'no block'); continue; }
  const [ra, dec] = cellRaDec(blk);
  console.log(id, 'RA', JSON.stringify(ra), 'DEC', JSON.stringify(dec));
}
