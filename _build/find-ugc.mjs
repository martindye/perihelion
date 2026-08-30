import https from 'node:https';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});
for (const q of ['Uppsala General Catalogue', 'Principal Galaxies', 'UGC', 'PGC', 'Uppsala'] ) {
  const r = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=' + encodeURIComponent(q) + '&-meta=ap');
  const hits = [];
  for (const p of r.d.split('<RESOURCE').slice(1)) {
    const name = (p.match(/name="([^"]*)"/) || [])[1] || '?';
    const desc = (p.match(/<DESCRIPTION>([\s\S]*?)<\/DESCRIPTION>/) || [])[1] || '';
    hits.push(name + '  ||  ' + desc.replace(/\s+/g, ' ').slice(0, 100));
  }
  console.log('==', q, '->', hits.length, 'hits');
  hits.slice(0, 8).forEach(h => console.log('   ', h));
}
