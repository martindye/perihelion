const fs = require('fs');
const html = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/messier.html', 'utf8');
// which M-ids appear as row headers?
const ids = [...html.matchAll(/<th[^>]*>.*?<a[^>]*>(M\d+)<\/a>/gs)].map(m => m[1]);
console.log('M-row headers found:', ids.length, ids.join(','));
// find missing
const all = [];
for (let n = 1; n <= 110; n++) all.push('M' + n);
const missing = all.filter(id => !ids.includes(id));
console.log('missing:', missing.join(','));
// dump M12 block
const i = html.indexOf('>M12</a>');
console.log('--- M12 block ---');
const blk = html.slice(i - 200, i + 3000);
const ri = blk.indexOf('"wt":"RA"');
const di = blk.indexOf('"wt":"DEC"');
console.log('RA idx in blk:', ri, ' DEC idx:', di);
console.log(JSON.stringify(blk.slice(ri - 100, ri + 400)));
