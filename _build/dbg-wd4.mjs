import https from 'node:https';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});

/* 1) find the item for NGC 253 */
const s = JSON.parse((await get('https://www.wikidata.org/w/api.php?action=wbsearchentities&search=' +
  encodeURIComponent('NGC 253 galaxy') + '&language=en&format=json&limit=5')).d);
console.log('search:');
for (const it of s.search || []) console.log('  ', it.id, it.label, '-', it.description);
const qid = (s.search || [])[0] && (s.search[0].id || '');
if (!qid) process.exit(0);

/* 2) dump its claims, note every property present */
const c = JSON.parse((await get(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&format=json`)).d);
const props = Object.keys(c.claims || {});
console.log('props on', qid, ':', props.join(', '));
/* show the ra/dec/mag/size values if present */
for (const p of ['P348', 'P349', 'P2048', 'P2049', 'P2050']) {
  const cl = c.claims[p];
  if (cl) console.log(' ', p, '=>', JSON.stringify(cl[0].mainsnak.datavalue.value).slice(0, 120));
}
