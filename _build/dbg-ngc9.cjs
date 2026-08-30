const fs = require('fs');
const nx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/ngc-vii118.xml', 'utf8');
const i0 = nx.indexOf('<TR><TD>3116</TD>');
const row = nx.slice(i0, nx.indexOf('</TR>', i0) + 5);

// dbg-ngc5 style (all built as strings, matched in loop)
let p = /<TR><TD>\d+<\/TD>/;
for (let k = 1; k <= 11; k++) p = new RegExp(p.source + '<TD>([^<]*?)<\\/TD>');
const A = p.source;

// file body, all-lazy
const src = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/dso2-select.cjs', 'utf8');
const line = src.split('\n').find(l => l.includes('nt1.matchAll'));
let v = line.match(/matchAll\((\/.+?\/)g\)/)[1].slice(1, -1);
for (let k = 0; k < 9; k++) v = v.replace('<TD>([^<]*)<\\/TD>', '<TD>([^<]*?)<\\/TD>');
const B = v;

console.log('A len', A.length, 'B len', B.length);
console.log('equal:', A === B);
if (A !== B) {
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] !== B[i]) { console.log('first diff at', i, JSON.stringify(A.slice(i - 12, i + 12)), '||', JSON.stringify(B.slice(i - 12, i + 12))); break; }
  }
}
console.log('A test:', new RegExp(A).test(row));
console.log('B test:', new RegExp(B).test(row));
