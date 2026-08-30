const fs = require('fs');
const x = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/corwin-vii239a.xml', 'utf8');
const i = x.indexOf('<FIELD', x.indexOf('DEJ2000'));
console.log(x.slice(i, i + 1900).replace(/\n\s*\n/g, '\n'));
console.log('=== tables:');
[...x.matchAll(/<TABLE ID="([^"]+)"/g)].forEach(m => console.log(m[1]));
console.log('=== NGC 1976 row:');
let j = x.indexOf('<TD>N</TD><TD>1976</TD>');
if (j < 0) {
  // try other name encodings
  for (const pat of ['NGC 1976', '>1976<', 'N</TD><TD> 1976']) {
    const k = x.indexOf(pat);
    console.log('alt', pat, '->', k);
    if (k >= 0) { console.log(x.slice(k - 60, k + 260).replace(/>\s*</g, '><')); break; }
  }
} else {
  console.log(x.slice(j - 10, j + 260).replace(/>\s*</g, '><'));
}
