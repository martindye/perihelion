import https from 'node:https';
import fs from 'node:fs';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (contact: local)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 1) try catalog-index endpoints */
for (const u of [
  'https://cdsarc.cds.unistra.fr/viz-bin/cats',
  'https://cdsarc.cds.unistra.fr/viz-bin/cats?NGC',
  'https://cdsarc.cds.unistra.fr/cgi-bin/catsd',
]) {
  try { const r = await get(u); console.log('INDEX', u, '->', r.s, r.d.length, r.d.replace(/\s+/g, ' ').slice(0, 120)); }
  catch (e) { console.log('INDEX', u, 'ERR', e.message); }
}

/* 2) probe a range of VOTABLE sources, print DESCRIPTION (catalog title) */
const candidates = [];
for (let i = 200; i <= 240; i++) candidates.push('VII/' + i);
for (let i = 40; i <= 60; i++) candidates.push('VI/' + i);
const hits = [];
for (const src of candidates) {
  try {
    const r = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=' + src);
    if (r.s !== 200) continue;
    const m = r.d.match(/<DESCRIPTION>([\s\S]*?)<\/DESCRIPTION>/);
    const desc = m ? m[1].replace(/\s+/g, ' ').trim() : '?';
    const t = r.d.match(/<TABLE[^>]*name="([^"]+)"/);
    if (/NGC|General Catalogue|Island|Nebula/i.test(desc + (t ? t[1] : ''))) {
      hits.push(src + ' :: ' + desc.slice(0, 120));
      console.log('HIT:', src, '=>', desc.slice(0, 150));
    }
    await sleep(150);
  } catch { /* skip */ }
}
console.log('hits:', hits.length);
