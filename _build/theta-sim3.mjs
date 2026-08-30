const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-coo?Coordinate=73.5+21.6&radius=2.0&CoordUnits=deg&formathtml=1');
const t = await r.text();
console.log(t.slice(0, 3000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
