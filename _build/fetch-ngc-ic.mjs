import https from 'node:https';
import fs from 'node:fs';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});

/* 1) IC catalog search (mirror of the NGC one) */
const ic = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=IC&-meta=ap');
fs.writeFileSync(new URL('./ic-search.xml', import.meta.url), ic.d);
for (const p of ic.d.split('<RESOURCE').slice(1)) {
  const name = (p.match(/name="([^"]*)"/) || [])[1] || '?';
  const id = (p.match(/ID="([^"]+)"/) || [])[1] || '?';
  const desc = (p.match(/<DESCRIPTION>([\s\S]*?)<\/DESCRIPTION>/) || [])[1] || '';
  console.log('IC search:', name, '=>', id, '|', desc.replace(/\s+/g, ' ').slice(0, 90));
}

/* 2) full VII/118 (NGC 2000.0) */
const ng = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=VII/118');
fs.writeFileSync(new URL('./ngc-vii118.xml', import.meta.url), ng.d);
console.log('\nNGC VII/118 fetched:', ng.s, ng.d.length, 'bytes');
const f = [...ng.d.matchAll(/<FIELD name="([^"]+)"[^>]*(?:UCD="([^"]*)")?/g)].map(x => x[1]);
console.log('fields:', f.join(', '));
const tr = ng.d.match(/<TR>([\s\S]*?)<\/TR>/g) || [];
console.log('rows:', tr.length);
console.log('row0:', (tr[0] || '').replace(/<\/?TD>/g, ' | ').replace(/<TR>|<\/TR>/g, '').slice(0, 300));
console.log('row1:', (tr[1] || '').replace(/<\/?TD>/g, ' | ').slice(0, 300));
