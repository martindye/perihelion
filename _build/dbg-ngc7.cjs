const fs = require('fs');
const src = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/dso2-select.cjs', 'utf8');
const line = src.split('\n').find(l => l.includes('nt1.matchAll'));
const nonAscii = [];
for (let i = 0; i < line.length; i++) {
  const c = line.charCodeAt(i);
  if (c > 127 || (c < 32 && c !== 9)) nonAscii.push([i, 'U+' + c.toString(16).padStart(4, '0'), line.slice(Math.max(0, i - 10), i + 10)]);
}
console.log('non-ascii/control chars in matchAll line:', nonAscii.length);
for (const [i, u, ctx] of nonAscii) console.log(' at', i, u, JSON.stringify(ctx));
// now test the EXACT literal extracted from the line:
const m = line.match(/matchAll\((\/.+?\/)g\)/);
console.log('literal found:', m ? 'yes' : 'no');
if (m) {
  const body = m[1].slice(1, -1); // strip slashes
  const nx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/ngc-vii118.xml', 'utf8');
  const i0 = nx.indexOf('<TR><TD>3116</TD>');
  const row = nx.slice(i0, nx.indexOf('</TR>', i0) + 5);
  const re = new RegExp(body);
  console.log('match on M42 row:', re.test(row) ? 'YES' : 'NO');
}
