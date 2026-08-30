import fs from 'node:fs';
const t = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/debug-raw-Pallas.txt', 'utf8');
const i = t.indexOf('1.9817425288453614');
console.log('--- context around the spurious X/Y/Z block ---');
console.log(t.slice(Math.max(0, i - 700), i + 300));
