import https from 'node:https';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});
const q = "select distinct table_name from TAP.SCHEMA where table_name like 'votable%' and (lower(table_name) like '%ngc%' or lower(table_name) like '%galax%')";
const r = await get('https://vizier.cds.unistra.fr/viz-tap/?query=' + encodeURIComponent(q));
console.log('status', r.s, 'len', r.d.length);
console.log(r.d.slice(0, 3000));
