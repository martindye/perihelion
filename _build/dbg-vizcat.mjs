import https from 'node:https';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (contact: local)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d, h: r.headers }));
  }).on('error', rej);
});

/* Try VizieR catalog-discovery endpoints for "NGC" */
const tries = [
  'https://vizier.cds.unistra.fr/viz-bin/cats?NGC',
  'https://cds.u-strasbg.fr/cgi-bin/catsd?NGC',
  'https://vizier.cds.unistra.fr/viz-bin/votable?-source=VI/42&-out.form=ascii',
  'https://cdsarc.u-strasbg.fr/cgi-bin/makefile?VI/42',
];
for (const u of tries) {
  try {
    const r = await get(u);
    const t = r.d.replace(/\s+/g, ' ').slice(0, 200);
    console.log('==', u);
    console.log('   ', r.s, r.d.length, 'B ::', t);
  } catch (e) { console.log('==', u, 'ERR', e.message); }
}
