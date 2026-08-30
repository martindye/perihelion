const url = 'https://simbad.u-strasbg.fr/simbad/sim-coo?object=M+33&coordframe=J2000&coordunits=sexagesimal';
const r = await fetch(url);
const t = await r.text();
const i = t.indexOf('RA(J2000)');
console.log('RA(J2000) idx:', i);
if (i >= 0) {
  const plain = t.slice(i - 2000, i + 2000).replace(/<[^>]+>/g, '|').replace(/\|+/g, ' | ').replace(/\s+/g, ' ');
  console.log(plain.slice(0, 1500));
}
