import fs from 'node:fs';
const src = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/js/dso.js', 'utf8');
globalThis.P = {};
globalThis.eval(src);
const rows = globalThis.P.dso;
console.log('total bright:', rows.length);
const want = ['M31', 'M33', 'M51', 'M63', 'M64', 'M74', 'M81', 'M82', 'M83', 'M87', 'M101', 'M104',
  'NGC 0253', 'NGC 253', 'NGC 1300', 'NGC 4565', 'NGC 4631', 'M86', 'M84', 'M85', 'M110', 'M32', 'M66'];
for (const r of rows) {
  if (want.includes(r[0])) console.log('row id:', JSON.stringify(r[0]), 'xref:', JSON.stringify(r[11]), 'mag:', r[3]);
}
const ids = rows.map(r => r[0]);
console.log('has NGC 0253:', ids.includes('NGC 0253'), '| has NGC 253:', ids.includes('NGC 253'));
