import https from 'node:https';
import fs from 'node:fs';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});
const r = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=VII/239A');
fs.writeFileSync(new URL('./corwin-vii239a.xml', import.meta.url), r.d);
console.log('status', r.s, 'bytes', r.d.length);
const f = [...r.d.matchAll(/<FIELD name="([^"]+)"/g)].map(x => x[1]);
console.log('fields:', f.join(', '));
const tr = r.d.match(/<TR>([\s\S]*?)<\/TR>/g) || [];
console.log('rows:', tr.length);
for (const i of [0, 224, 5127]) {
  const t = tr[i];
  if (t) console.log('row', i, ':', t.replace(/<\/?TD>/g, ' | ').replace(/<\/?TR>/g, '').replace(/\| *\|/g, '|').slice(0, 240));
}
