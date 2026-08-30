const fs = require('fs');
const B = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/';
const cx = fs.readFileSync(B + 'corwin-vii239a.xml', 'utf8');
const t1 = cx.slice(cx.indexOf('<TABLEDATA>'), cx.indexOf('</TABLEDATA>'));
for (const [cat, num] of [['N', '7089'], ['N', '2632'], ['N', '6405'], ['I', '4725'], ['N', '6618'], ['N', '2068']]) {
  console.log('=== ' + cat + ' ' + num);
  const re = new RegExp('<TR><TD>[^<]*</TD><TD>' + cat + '</TD><TD>' + num + '</TD>.*?</TR>', 'g');
  for (const m of t1.matchAll(re)) console.log('  ' + m[0].replace(/>\s*</g, '><'));
}
