const fs = require('fs');
const cx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/corwin-vii239a.xml', 'utf8');
const t1s = cx.indexOf('<TABLEDATA>'), t1e = cx.indexOf('</TABLEDATA>', t1s);
const t1 = cx.slice(t1s, t1e);
for (const [cat, num] of [['N', '6402'], ['N', '6121'], ['N', '6205'], ['N', '6475'], ['N', '2505']]) {
  const i = t1.indexOf(`<TD>${cat}</TD><TD>${num}</TD>`);
  if (i < 0) { console.log(cat + ' ' + num, 'NOT FOUND'); continue; }
  console.log(cat + ' ' + num + ':', JSON.stringify(t1.slice(i - 12, i + 200)));
}
