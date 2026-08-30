import https from 'node:https';
import fs from 'node:fs';
const get = url => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});
const d = await get('https://en.wikipedia.org/w/api.php?action=parse&page=NGC%20253&prop=wikitext&format=json&formatversion=2');
const j = JSON.parse(d);
const w = j.parse.wikitext;
fs.writeFileSync(new URL('./ngc253.wiki', import.meta.url), w);
const lines = w.split('\n').slice(0, 40);
console.log(lines.join('\n'));
