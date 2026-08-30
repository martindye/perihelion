import https from 'node:https';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d, loc: r.headers.location }));
  }).on('error', rej);
});
const probes = [
  'https://vizier.cds.unistra.fr/viz-tap',
  'https://vizier.cds.unistra.fr/tap',
  'https://vizier.cds.unistra.fr/viz-tap/',
  'https://vizier.cds.unistra.fr/viz-bin/votable?-source=VI/42',
  'https://vizier.cds.unistra.fr/viz-bin/Cat?VI/42',
  'https://cdsarc.u-strasbg.fr/viz-bin/votable?-source=VI/42'
];
for (const u of probes) {
  try {
    const r = await get(u);
    console.log('==', u, '->', r.s, (r.loc || '').slice(0, 100));
    console.log('   ', r.d.replace(/\n/g, ' | ').slice(0, 220));
  } catch (e) { console.log('==', u, 'ERR', e.message); }
}
