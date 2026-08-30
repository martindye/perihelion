const fs = require('fs');
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const cx = fs.readFileSync(B + 'corwin-vii239a.xml', 'utf8');
const t1 = cx.slice(cx.indexOf('<TABLEDATA>'), cx.indexOf('</TABLEDATA>'));
console.log('--- Corwin N 2422 / N 2423 / I rows nearby');
for (const [cat, num] of [['N', '2422'], ['N', '2423'], ['N', '1432'], ['N', '2505'], ['N', '2478']]) {
  const re = new RegExp('<TR><TD>[^<]*</TD><TD>' + cat + '</TD><TD>' + num + '</TD>.*?</TR>', 'g');
  for (const m of t1.matchAll(re)) console.log(cat + ' ' + num + ': ' + m[0].replace(/>\s*</g, '><'));
}
const nx = fs.readFileSync(B + 'ngc-vii118.xml', 'utf8');
const nt1 = nx.slice(nx.indexOf('<TABLEDATA>'), nx.indexOf('</TABLEDATA>'));
console.log('--- VII/118 rows 2422, 2423, 1432, 2505, 2478 + search "= M45" / "Pleiades"');
for (const num of ['2422', '2423', '1432', '2505', '2478']) {
  const re = new RegExp('<TR><TD>\\d+</TD><TD> *' + num + '</TD>.*?</TR>', '');
  const m = nt1.match(re);
  console.log('V7 ' + num + ': ' + (m ? m[0].replace(/>\s*</g, '><') : 'NOT FOUND'));
}
const i45 = nt1.indexOf('= M45');
console.log('VII/118 "= M45" at', i45, i45 >= 0 ? nt1.slice(i45 - 260, i45 + 10).replace(/\n/g, ' ') : '');
const ip = nt1.search(/Pleiades/i);
console.log('VII/118 "Pleiades" at', ip, ip >= 0 ? nt1.slice(ip - 200, ip + 20).replace(/\n/g, ' ') : '');
