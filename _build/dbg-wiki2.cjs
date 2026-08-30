const fs = require('fs');
const html = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/messier.html', 'utf8');
function tmpls(seg) {
  const m = seg.match(/"params":\{"1":\{"wt":"(-?\d+)"\},"2":\{"wt":"([\d.]+)"\}(?:,"3":\{"wt":"([\d.]+)"\})?/);
  return m ? [m[1], m[2], m[3] || '0'] : null;
}
const got = {}, fail = [];
for (const blk of html.split(/<tr[ >]/).slice(1)) {
  const nm = blk.match(/<th[^>]*>.*?<a[^>]*>(M\d+)<\/a>/s);
  if (!nm) continue;
  const id = nm[1];
  const ri = blk.indexOf('"wt":"RA"'), di = blk.indexOf('"wt":"DEC"');
  if (ri < 0 || di < 0) { fail.push([id, 'noRA/DEC']); continue; }
  const rp = tmpls(blk.slice(ri, ri + 800)), dp = tmpls(blk.slice(di, di + 800));
  if (!rp || !dp) { fail.push([id, !rp ? 'RA-parse-fail' : 'DEC-parse-fail']); continue; }
  got[id] = 1;
}
console.log('parsed:', Object.keys(got).length);
console.log('failed:', fail.length);
for (const [id, why] of fail) console.log(' ', id, why);
