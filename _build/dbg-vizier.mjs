import https from 'node:https';
const get = (url, opts = {}) => new Promise((res, rej) => {
  const u = new URL(url);
  https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: opts.method || 'GET', headers: { 'User-Agent': 'perihelion-dev/1.0', ...(opts.headers || {}) } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d, h: r.headers }));
  }).on('error', rej).end();
});
/* VizieR TAP discovery: find catalog tables whose name mentions NGC/IC/NGC */
const q = encodeURIComponent("select distinct table_name from TAP.SCHEMA where table_name like 'votable%' and (lower(table_name) like '%ngc%' or lower(table_name) like '%ic%' or lower(table_name) like '%galax%')");
const r = await get('https://vizier.u-strasbg.fr/viz-tap/?query=' + q);
console.log('TAP status', r.s, 'len', r.d.length);
console.log(r.d.slice(0, 1500));
