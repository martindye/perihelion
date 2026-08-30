import https from 'node:https';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d, h: r.headers }));
  }).on('error', rej);
});

/* Candidate catalog-index / search endpoints on the current CDS hosts */
const tries = [
  'https://cdsarc.cds.unistra.fr/viz-bin/cats',
  'https://cdsarc.cds.unistra.fr/viz-bin/cats?NGC',
  'https://cdsarc.cds.unistra.fr/cgi-bin/catindex',
  'https://cdsarc.cds.unistra.fr/catalogs',
  'https://cdsportal.u-strasbg.fr/catalogue',
  'https://cdsportal.u-strasbg.fr/catalogs',
  'https://cdsportal.u-strasbg.fr/viz-bin/cats?NGC',
  'https://vizier.cds.unistra.fr/viz-bin/cats?NGC',
];
for (const u of tries) {
  try {
    const r = await get(u);
    const plain = r.d.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const hasNGC = /NGC|General Catalogue/i.test(plain);
    console.log('==', u, '->', r.s, r.d.length + 'B', hasNGC ? '<< mentions NGC' : '');
  } catch (e) { console.log('==', u, 'ERR', e.message); }
}

/* CDS portal: find the catalog-search form action */
const p = await get('https://cdsportal.u-strasbg.fr/');
const forms = [...p.d.matchAll(/<form[^>]*action="([^"]*)"[^>]*>/g)].map(m => m[1]);
console.log('\nportal forms:', forms.join(' | '));
const inputs = [...p.d.matchAll(/<input[^>]*name="([^"]*)"[^>]*>/g)].map(m => m[1]);
console.log('portal inputs:', [...new Set(inputs)].join(', '));
console.log('links with cat/search:', [...new Set((p.d.match(/href="[^"]*(cat|search|catalog)[^"]*"/gi) || []))].slice(0, 20).join('\n  '));
