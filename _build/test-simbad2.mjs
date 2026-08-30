const url = 'https://simbad.u-strasbg.fr/simbad/sim-coo?object=M+33&coordframe=J2000&coordunits=sexagesimal';
const r = await fetch(url);
const t = await r.text();
const i = t.indexOf('basic identification');
console.log(t.slice(i, i + 1200).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
