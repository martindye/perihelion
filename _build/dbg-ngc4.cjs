const fs = require('fs');
const src = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/dso2-select.cjs', 'utf8');
const m = src.match(/for \(const m of nt1\.matchAll\((\/[\s\S]*?\/g)\)/);
console.log('regex in file:', m ? m[1] : 'NOT FOUND');
const nx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/ngc-vii118.xml', 'utf8');
const i = nx.indexOf('<TR><TD>3116</TD>');
const row = nx.slice(i, nx.indexOf('</TR>', i) + 5);
console.log('row len:', row.length);
if (m) {
  const re = new RegExp(m[1].replace(/\/g$/, ''), '');
  console.log('match on M42 row:', row.match(re) ? 'YES' : 'NO');
  if (!row.match(re)) {
    // find where it fails: drop TDs from the end
    let p = m[1].replace(/\/g$/, '');
    while (p.includes('<TD>([^<]*)<\\/TD>') || p.includes('<TD>([^<]*?)<\\/TD>')) {
      const i1 = p.lastIndexOf('<TD>([^<]*?)<\\/TD>');
      const i2 = p.lastIndexOf('<TD>([^<]*)<\\/TD>');
      const at = Math.max(i1, i2);
      p = p.slice(0, at) + p.slice(p.indexOf(')', at) + 1);
      const test = new RegExp(p + '<\\/TR>$');
      console.log('tail-trimmed test:', test.test(row) ? 'OK ' : 'xx ', p.length);
      if (test.test(row)) break;
    }
  }
}
