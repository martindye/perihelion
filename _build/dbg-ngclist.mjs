import https from 'node:https';
import fs from 'node:fs';
const get = url => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});
const d = await get('https://en.wikipedia.org/wiki/List_of_NGC_objects_0%E2%80%93999');
fs.writeFileSync(new URL('./ngc-0-999.html', import.meta.url), d);
console.log('len', d.length);
const t = d.indexOf('<table');
console.log('table at', t);
const t1 = d.indexOf('</table>', t);
const block = d.slice(t, t1);
const rows = block.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
console.log('rows:', rows.length);
const strip = h => h.replace(/data-mw='[^']*'/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
for (const r of rows.slice(0, 6)) {
  const re = /<(td|th)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1>)/g;
  let m; const cc = [];
  while ((m = re.exec(r))) cc.push(strip(m[2]));
  console.log(JSON.stringify(cc.map(x => x.slice(0, 40))));
}
