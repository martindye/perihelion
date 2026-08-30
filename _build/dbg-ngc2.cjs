const fs = require('fs');
const nx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/ngc-vii118.xml', 'utf8');
const nt1s = nx.indexOf('<TABLEDATA>'), nt1e = nx.indexOf('</TABLEDATA>', nt1s);
const nt1 = nx.slice(nt1s, nt1e);
console.log('slice len:', nt1.length, ' TRs in slice:', (nt1.match(/<TR>/g) || []).length);
const re = /<TR><TD>\d+<\/TD><TD>([^<]*?)<\/TD><TD>([^<]*?)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><\/TR>/g;
let c = 0, m;
while ((m = re.exec(nt1)) !== null) c++;
console.log('regex matches:', c);
// bisect: test shorter patterns
const t1 = /<TR><TD>\d+<\/TD><TD>[^<]*?<\/TD><TD>[^<]*?<\/TD>/.exec(nt1);
console.log('3-TD prefix test:', t1 ? t1[0].slice(0, 80) : 'FAIL');
const t2 = /<TR><TD>3116<\/TD><TD> 1976<\/TD><TD> Nb<\/TD>/.exec(nt1);
console.log('M42 exact prefix:', t2 ? 'OK' : 'FAIL');
const t3 = /<TR><TD>3116<\/TD>[\s\S]{0,400}?<\/TR>/.exec(nt1);
console.log('M42 full row via lazy:', t3 ? t3[0].length + ' chars' : 'FAIL');
