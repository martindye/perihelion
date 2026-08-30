const fs = require('fs');
const nx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/ngc-vii118.xml', 'utf8');
const i = nx.indexOf('<TR><TD>3116</TD>');
const row = nx.slice(i, nx.indexOf('</TR>', i) + 5);
let p = /<TR><TD>\d+<\/TD>/;
for (let k = 1; k <= 11; k++) {
  p = new RegExp(p.source + '<TD>([^<]*?)<\\/TD>');
  const ok = p.test(row);
  console.log('prefix through TD' + (k + 1), ok ? 'OK' : 'FAILS');
  if (!ok) { console.log('pattern:', p.source); break; }
}
// inspect characters around each TD boundary for hidden chars
for (let b = 0; b < row.length; b++) {
  const c = row.charCodeAt(b);
  if (c > 127 || c < 9) console.log('odd char at', b, 'U+' + c.toString(16).padStart(4, '0'), JSON.stringify(row.slice(b - 8, b + 8)));
}
