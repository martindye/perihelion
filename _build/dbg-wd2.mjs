import https from 'node:https';
const get = (u, body) => new Promise((res, rej) => {
  const u2 = new URL(u);
  const opt = { hostname: u2.hostname, path: u2.pathname + u2.search, method: body ? 'POST' : 'GET',
    headers: { 'User-Agent': 'perihelion-dev/1.0', 'Content-Type': 'application/sparql-query' } };
  const r = https.request(opt, resp => {
    let d = ''; resp.on('data', c => d += c); resp.on('end', () => res({ s: resp.statusCode, d }));
  });
  r.on('error', rej); if (body) r.write(body); r.end();
});

/* 1) what do P2504/P2505 actually label? */
const lbl = await get('https://query.wikidata.org/bigdata/namespace/wdq/sparql',
  'SELECT ?p (SAMPLE(?l) AS ?label) WHERE { ?p wdt:P31 ?x . BIND(IIF(?p=wdt:P2504,"P2504",IIF(?p=wdt:P2505,"P2505","?")) AS ?n) . FILTER(?p IN (wdt:P2504, wdt:P2505)) . SERVICE wikibase:label { ?l rdfs:label ?lbl . FILTER(LANG(?lbl)="en") . ?p rdfs:label ?lbl . FILTER(LANG(?lbl)="en") } } GROUP BY ?p');
console.log('labels status', lbl.s, 'len', lbl.d.length);
console.log(lbl.d.slice(0, 1500));
