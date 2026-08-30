const url = 'https://simbad.u-strasbg.fr/simbad/sim-id?Ident=M+33';
const r = await fetch(url);
const t = await r.text();
const i = t.indexOf('ep=J2000');
console.log('raw around ep=J2000:');
console.log(t.slice(i - 300, i + 1400));
