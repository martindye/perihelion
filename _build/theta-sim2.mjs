const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-coo?Coordinate=73.5+21.6&radius=2.0&CoordUnits=deg&formathtml=1');
const t = await r.text();
console.log('LEN', t.length);
const i = t.indexOf('Merga');
console.log('merga-idx', i);
if (i > 0) console.log(t.slice(i - 400, i + 200).replace(/<[^>]+>/g, '|').replace(/\|+/g, ' | '));
const j = t.indexOf('04h 5');
console.log('04h5-idx', j);
if (j > 0) console.log(t.slice(j - 500, j + 100).replace(/<[^>]+>/g, '|').replace(/\|+/g, ' | '));
