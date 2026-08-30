const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-coo?Coordinate=73.5%2021.6&radius=1.5&CoordUnits=deg&formathtml=1');
const t = await r.text();
console.log('LEN', t.length);
// print all table-ish lines
const lines = t.split('\n').map(s => s.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').replace(/&nbsp;/g, ' ').trim()).filter(s => s.length > 15);
for (const l of lines.slice(0, 60)) console.log(l.slice(0, 180));
