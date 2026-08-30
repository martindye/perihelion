import https from 'node:https';
import fs from 'node:fs';
const get = url => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});
const ng = await get('https://en.wikipedia.org/wiki/List_of_nearest_galaxies_to_Earth');
fs.writeFileSync(new URL('./ngc.html', import.meta.url), ng);
const t2 = ng.indexOf('<table');
console.log('table at', t2, 'len', ng.length);
const block = ng.slice(t2, ng.indexOf('</table>', t2));
const rows = block.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
console.log('rows:', rows.length);
const stripTags = h => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
for (const r of rows.slice(0, 8)) {
  const re = /<(td|th)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1>)/g;
  let m; const cc = [];
  while ((m = re.exec(r))) cc.push(stripTags(m[2]));
  console.log(JSON.stringify(cc.map(x => x.slice(0, 30))));
}
