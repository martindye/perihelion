import https from 'node:https';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});
const d = await get('https://cseligman.com/text/atlas/ngc0a.htm');
const plain = d.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const i = plain.indexOf('NGC 55');
/* find the entry section: look for "55" anchor content */
const m = plain.match(/NGC 55\s+NGC 55([\s\S]{0,900})/);
console.log((m ? m[1] : plain.slice(plain.indexOf('NGC 55'), plain.indexOf('NGC 55') + 1200)).slice(0, 900));
