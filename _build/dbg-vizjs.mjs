import https from 'node:https';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});
const home = await get('https://vizier.cds.unistra.fr/');
const scripts = [...new Set([...home.d.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]))];
console.log('scripts:', scripts.join(' | '));
let found = null;
for (const s of scripts) {
  const u = s.startsWith('http') ? s : 'https://vizier.cds.unistra.fr' + (s.startsWith('/') ? s : '/' + s);
  try {
    const r = await get(u);
    const idx = r.d.indexOf('keywordSearchName');
    if (idx > 0) {
      found = { u, ctx: r.d.slice(Math.max(0, idx - 600), idx + 1200) };
      break;
    }
  } catch { /* next */ }
}
if (found) {
  console.log('\nFOUND in', found.u);
  console.log(found.ctx.replace(/\s+/g, ' '));
} else {
  console.log('\nkeywordSearchName not in any top-level script');
  /* maybe inline JS on the page */
  const inl = home.d.indexOf('keywordSearchName');
  if (inl > 0) console.log('INLINE ctx:', home.d.slice(Math.max(0, inl - 800), inl + 800).replace(/\s+/g, ' '));
}
