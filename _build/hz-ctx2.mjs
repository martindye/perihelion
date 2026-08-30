import fs from 'node:fs';
const t = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_build/debug-raw-Pallas.txt', 'utf8');
const i = t.indexOf('1.9817425288453614');
console.log(t.slice(i - 250, i + 700));
