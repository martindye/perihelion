import https from 'node:https';
import fs from 'node:fs';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; perihelion-dev/1.0)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d, h: r.headers }));
  }).on('error', rej);
});
for (const u of [
  'https://cdsportal.u-strasbg.fr/',
  'https://cdsportal.u-strasbg.fr/cats',
  'https://cdsarc.cds.unistra.fr/cats',
  'https://cdsarc.cds.unistra.fr/viz-bin/cat/VI/42',
]) {
  try {
    const r = await get(u);
    console.log('==', u, '->', r.s, r.d.length, 'B');
    if (r.s === 200 && r.d.length > 500) {
      const t = r.d.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      console.log('   ', t.slice(0, 400));
    }
  } catch (e) { console.log('==', u, 'ERR', e.message); }
}
