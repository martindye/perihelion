import https from 'node:https';
import fs from 'node:fs';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});
for (const q of ['Sinnott', 'Index Catalog', '2000.0', 'IC 2000.0']) {
  const r = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=' + encodeURIComponent(q) + '&-meta=ap');
  fs.writeFileSync(new URL('./search-' + q.replace(/[^A-Za-z0-9]/g, '') + '.xml', import.meta.url), r.d);
  console.log('==', q, '->', r.d.length, 'B');
  for (const p of r.d.split('<RESOURCE').slice(1)) {
    const name = (p.match(/name="([^"]*)"/) || [])[1] || '?';
    const desc = (p.match(/<DESCRIPTION>([\s\S]*?)<\/DESCRIPTION>/) || [])[1] || '';
    if (/IC|Index|Sinnott|2000/i.test(name + desc)) console.log('   ', name, '||', desc.replace(/\s+/g, ' ').slice(0, 110));
  }
}
