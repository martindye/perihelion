import https from 'node:https';
const get = (u, body) => new Promise((res, rej) => {
  const u2 = new URL(u);
  const opt = { hostname: u2.hostname, path: u2.pathname + u2.search, method: body ? 'POST' : 'GET',
    headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)', ...(body ? { 'Content-Type': 'application/sparql-query' } : {}) } };
  const r = https.request(opt, resp => {
    let d = ''; resp.on('data', c => d += c); resp.on('end', () => res({ s: resp.statusCode, d }));
  });
  r.on('error', rej); if (body) r.write(body); r.end();
});

/* --- A) VizieR home page: what does its search form do? --- */
const home = await get('https://vizier.cds.unistra.fr/');
const forms = [...home.d.matchAll(/<form[^>]*>/g)].map(m => m[0]);
const inputs = [...home.d.matchAll(/<input[^>]*>/g)].map(m => m[0].replace(/\s+/g, ' ').slice(0, 160));
console.log('VIZIER HOME forms:');
forms.forEach(f => console.log('  ', f.slice(0, 200)));
console.log('inputs:');
inputs.slice(0, 12).forEach(i => console.log('  ', i));

/* --- B) Wikidata: find the NGC-number property via M31 (Q1758) claims --- */
const c = JSON.parse((await get('https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=Q1758&format=json')).d);
const found = [];
for (const [p, claims] of Object.entries(c.claims || {})) {
  const v = claims[0] && claims[0].mainsnak && claims[0].mainsnak.datavalue && claims[0].mainsnak.datavalue.value;
  const s = JSON.stringify(v);
  if (/224/.test(s) || /NGC/i.test(s)) found.push([p, s.slice(0, 100)]);
}
console.log('\nQ1758 (Andromeda) claims matching "224"/"NGC":');
found.forEach(f => console.log('  ', f[0], '=>', f[1]));
