import https from 'node:https';
const get = url => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});
const t = process.argv[2] || 'NGC 253';
const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&titles=' +
  encodeURIComponent(t) + '&prop=revisions&rvprop=content';
const d = await get(url);
const p = JSON.parse(d).query.pages[0];
const w = p.revisions[0].content;
for (const key of ['ra', 'dec', 'type', 'appmag', 'size', 'dist', 'redshift', 'constellation', 'magnitude']) {
  const m = w.match(new RegExp('^\\s*\\|\\s*' + key + '[^\\n]*', 'mi'));
  console.log(m ? ('[' + key + '] ' + m[0].trim().slice(0, 90)) : '');
}
