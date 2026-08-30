const url = 'https://simbad.u-strasbg.fr/simbad/sim-coo?object=M+33&coordframe=J2000&coordunits=sexagesimal';
const r = await fetch(url);
const t = await r.text();
const plain = t.replace(/<[^>]+>/g, '|').replace(/\|+/g, ' | ').replace(/\s+/g, ' ');
// find lines mentioning RA / J2000
for (const kw of ['J2000', 'equatorial', '00 43', '0h 43', '43 m', 'RA', 'Declination']) {
  const i = plain.indexOf(kw);
  if (i >= 0) console.log('KW[' + kw + '] @' + i + ':\n' + plain.slice(i - 120, i + 300) + '\n---');
}
