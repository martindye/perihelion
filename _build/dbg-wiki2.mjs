import https from 'node:https';
import fs from 'node:fs';
const get = url => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});
const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&titles=NGC%20253&prop=revisions&rvprop=content';
const d = await get(url);
const j = JSON.parse(d);
const p = j.query.pages[0];
console.log('title:', p.title, '| redirect:', !!p.redirect);
const w = p.revisions[0].content;
fs.writeFileSync(new URL('./ngc253-resolved.wiki', import.meta.url), w);
/* print only the infobox-ish lines */
const keep = w.split('\n').filter(l => /right|asc|declin|decl|magnitude|mag|size|diameter|type|distance|redshift|sma|smb|pa|pos/i.test(l)).slice(0, 40);
console.log(keep.join('\n'));
