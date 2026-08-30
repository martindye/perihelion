import fs from 'node:fs';
const t = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/debug-raw-Pallas.txt', 'utf8');
const i = t.indexOf('IAU76');
console.log(t.slice(Math.max(0, i - 200), i + 900));
