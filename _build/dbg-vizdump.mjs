import https from 'node:https';
import fs from 'node:fs';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});
for (const src of ['II/121', 'VII/225']) {
  const r = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=' + src);
  fs.writeFileSync(new URL('./vot-' + src.replace('/', '-') + '.xml', import.meta.url), r.d);
  const d = r.d;
  console.log('====', src, r.s, d.length, 'bytes');
  const res = d.match(/<INFO name="name"[^>]*>([\s\S]*?)<\/INFO>/g) || [];
  console.log('INFOs:', res.slice(0, 8).map(x => x.replace(/<[^>]+>/g, '').trim()).join(' | '));
  const t = d.match(/<TABLE[^>]*>/);
  console.log('TABLE:', t ? t[0] : '(none)');
  const f = [...d.matchAll(/<FIELD name="([^"]+)"[^>]*(?:unit="([^"]*)")?/g)].map(x => x[1]);
  console.log('FIELDS:', f.join(', '));
  const tr = (d.match(/<TR>([\s\S]*?)<\/TR>/g) || []).slice(0, 2);
  for (const r2 of tr) console.log('ROW:', r2.replace(/<\/?TD>/g, ' | ').slice(0, 260));
}
