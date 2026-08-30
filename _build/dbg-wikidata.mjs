import https from 'node:https';
const get = (u, body) => new Promise((res, rej) => {
  const u2 = new URL(u);
  const opt = { hostname: u2.hostname, path: u2.pathname + u2.search, method: body ? 'POST' : 'GET',
    headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)', 'Content-Type': 'application/sparql-query' } };
  const r = https.request(opt, resp => {
    let d = ''; resp.on('data', c => d += c); resp.on('end', () => res({ s: resp.statusCode, d }));
  });
  r.on('error', rej);
  if (body) r.write(body);
  r.end();
});

/* probe: which property is "NGC number"? try P2504 and P2505 */
for (const p of ['P2504', 'P2505']) {
  const q = `SELECT ?item ?v ?ra ?dec WHERE { ?item wdt:${p} ?v . ?item wdt:P348 ?ra . ?item wdt:P349 ?dec . } LIMIT 3`;
  const r = await get('https://query.wikidata.org/bigdata/namespace/wdq/sparql', q);
  console.log('==', p, 'status', r.s, 'len', r.d.length);
  const rows = [...r.d.matchAll(/<http:\/\/www\.wikidata\.org\/entity\/(Q\d+)>/g)].slice(0, 3).map(m => m[1]);
  const vals = [...r.d.matchAll(/<http:\/\/query\.wikidata\.org\/ontology#l\d+>|"((?:[a-zA-Z]+ )?\d[^<"]*)"/g)].slice(0, 8).map(m => m[1]);
  console.log('  items:', rows.join(','), ' sample values:', vals.join(' | '));
}
