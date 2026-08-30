const url = 'https://simbad.u-strasbg.fr/simbad/sim-id?Ident=M+33';
const r = await fetch(url);
const t = await r.text();
const plain = t.replace(/<[^>]+>/g, '|').replace(/\|+/g, ' | ').replace(/\s+/g, ' ');
const i = plain.indexOf('J2000');
console.log('len', t.length, ' J2000 @', i);
if (i >= 0) console.log(plain.slice(Math.max(0, i - 400), i + 600));
else console.log(plain.slice(0, 2000));
