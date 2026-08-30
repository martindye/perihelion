const fs = require('fs');
const nx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/ngc-vii118.xml', 'utf8');
const i = nx.indexOf('<TR><TD>3116</TD>');
const row = nx.slice(i, i + 200);
console.log('ROW:', JSON.stringify(row.slice(0, 200)));
// build the pattern piece by piece
const tds = row.match(/<TD>[\s\S]*?<\/TD>/g) || [];
console.log('TDs in row:', tds.length);
// full 12-TD pattern test on this exact row:
let re = /<TR><TD>\d+<\/TD>/;
for (let k = 0; k < 11; k++) re = new RegExp(re.source + '<TD>[^<]*<\\/TD>');
re = re; // no flags
const m1 = row.match(new RegExp('^' + re.source + '<\\/TR>$'));
console.log('full-row match:', m1 ? 'YES' : 'NO');
// now find which TD breaks: try matching TD-by-TD sequentially
let pos = row.indexOf('</TD>', 0) + 4;
console.log('first TD ends at', pos);
// check each TD's raw content for surprises
tds.forEach((t, k) => console.log(k + 1, JSON.stringify(t)));
