const fs = require('fs');
const nx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/ngc-vii118.xml', 'utf8');
const nt1s = nx.indexOf('<TABLEDATA>'), nt1e = nx.indexOf('</TABLEDATA>', nt1s);
const nt1 = nx.slice(nt1s, nt1e);
const re = /<TR><TD>\d+<\/TD><TD>([^<]*?)<\/TD><TD>([^<]*?)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><TD>([^<]*)<\/TD><\/TR>/g;
let c = 0, m, first = null;
while ((m = re.exec(nt1)) !== null) { c++; if (!first) first = m.slice(1, 3); }
console.log('exact file regex, matches:', c, first ? 'first=' + first.join('|') : '');
// also: how many <TR><TD> rows start with a non-digit recno?
const all = (nt1.match(/<TR><TD>/g) || []).length;
const withNum = (nt1.match(/<TR><TD>\d+<\/TD>/g) || []).length;
console.log('TR<TD total:', all, ' with numeric recno:', withNum);
