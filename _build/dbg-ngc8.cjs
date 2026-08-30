const fs = require('fs');
const src = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/dso2-select.cjs', 'utf8');
const line = src.split('\n').find(l => l.includes('nt1.matchAll'));
const body = line.match(/matchAll\((\/.+?\/)g\)/)[1].slice(1, -1);
const nx = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/ngc-vii118.xml', 'utf8');
const i0 = nx.indexOf('<TR><TD>3116</TD>');
const row = nx.slice(i0, nx.indexOf('</TR>', i0) + 5);
console.log('full file body test:', new RegExp(body).test(row) ? 'YES' : 'NO');

// experiment 1: make all groups lazy
let v = body;
for (let k = 0; k < 9; k++) v = v.replace('<TD>([^<]*)<\\/TD>', '<TD>([^<]*?)<\\/TD>');
console.log('all-lazy version test:', new RegExp(v).test(row) ? 'YES' : 'NO');

// experiment 2: flip laziness one at a time on the all-lazy base
const lazy = v;
for (let k = 0; k < 9; k++) {
  let t = lazy;
  // replace the k-th occurrence of the lazy group with greedy
  const parts = t.split('<TD>([^<]*?)<\\/TD>');
  const rebuilt = [];
  let count = 0;
  for (const seg of parts) {
    if (count === k) { rebuilt.push('<TD>([^<]*)<\\/TD>'); }
    else if (count < k) { rebuilt.push('<TD>([^<]*?)<\\/TD>'); }
    count++;
    rebuilt.push(seg);
  }
  const t2 = rebuilt.join('');
  const ok = new RegExp(t2).test(row);
  if (!ok) console.log('flipping TD group', k + 3, 'to GREEDY breaks it');
}
