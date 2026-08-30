import https from 'node:https';
import fs from 'node:fs';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (contact: local)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});
const r = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=VI/42&-out.form=ascii&-out.c=1-20');
fs.writeFileSync(new URL('./vi42.txt', import.meta.url), r.d);
console.log('status', r.s, 'len', r.d.length);
console.log(r.d.slice(0, 2500));
