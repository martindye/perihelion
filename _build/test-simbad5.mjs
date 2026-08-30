const url = 'https://simbad.u-strasbg.fr/simbad/sim-coo?object=M+33&coordframe=J2000&coordunits=sexagesimal';
const r = await fetch(url);
const t = await r.text();
const plain = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log('plain len:', plain.length);
console.log(plain.slice(0, 2500));
