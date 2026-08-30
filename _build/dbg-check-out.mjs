import fs from 'node:fs';
const D = new URL('./', import.meta.url);
const b = JSON.parse(fs.readFileSync(new URL('./galaxies-bright.json', D), 'utf8'));
const f = JSON.parse(fs.readFileSync(new URL('./galaxies-faint.json', D), 'utf8'));
console.log('bright:', b.length, 'faint:', f.data.length, 'faintIds:', f.ids.length);
const find = (id, list) => list.find(r => (r[0] || '').startsWith(id));
for (const id of ['M31', 'M33', 'M51', 'M82', 'M83', 'M104', 'NGC 253', 'NGC 5128', 'NGC 300', 'NGC 55', 'NGC 1300', 'NGC 1316', 'NGC 1365', 'NGC 4622', 'NGC 4945']) {
  const r = find(id, b);
  if (r) console.log('BRIGHT', r[0].padEnd(22), 'ra', r[1].toFixed(4), 'dec', r[2].toFixed(4), 'mag', r[3], 'type', r[4], 'bv', r[9]);
  else console.log('BRIGHT', id, '-> (not bright)');
}
/* faint id stats */
const pref = { NGC: 0, IC: 0, UGC: 0, null: 0 };
for (const id of f.ids) {
  if (!id) { pref.null++; continue; }
  const p = id.split(' ')[0];
  pref[p] = (pref[p] || 0) + 1;
}
console.log('faint id prefixes:', pref);
/* mag coverage */
let nomag = 0, foromg = 0;
for (const r of f.data) { if (r[2] == null) nomag++; else if (r[2] < 10) foromg++; }
console.log('faint without mag:', nomag, '  faint mag<10:', foromg);
/* sample faint */
console.log('faint sample:', JSON.stringify(f.data.slice(0, 3)));
/* check no dup ids between bright curated xrefs */
const xrefs = b.map(r => (r[0].match(/ · (NGC|IC) \d+/) || [])[0]);
console.log('bright rows with xref:', xrefs.filter(Boolean).length, 'of', b.length);
