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
const BASE = 'https://query.wikidata.org/bigdata/namespace/wdq/sparql';

/* 1) find properties whose English label mentions NGC / IC / Messier */
const q1 = 'SELECT ?prop ?lab WHERE { ?prop rdfs:label ?lab . FILTER(LANG(?lab)="en") . FILTER(CONTAINS(LCASE(?lab),"ngc")||CONTAINS(LC ?lab,"ic number")||CONTAINS(LC(?lab),"messier")) } LIMIT 40';
const r1 = await get(BASE, 'SELECT ?prop ?lab WHERE { ?prop rdfs:label ?lab . FILTER(LANG(?lab)="en") . FILTER(CONTAINS(LCASE(?lab),"ngc") || CONTAINS(LCASE(?lab),"ic number")) } LIMIT 40');
console.log('== property search status', r1.s);
console.log(r1.d.replace(/<http[^>]*>/g, x => x.replace('http://www.wikidata.org/prop/property/', 'P')).slice(0, 2000));
