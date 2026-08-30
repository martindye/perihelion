import https from 'node:https';
import fs from 'node:fs';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (one-off data fetch)' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});

/* 1) find the IC catalog */
for (const q of ['Index Catalogue', 'IC 2000']) {
  const r = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=' + encodeURIComponent(q) + '&-meta=ap');
  for (const p of r.d.split('<RESOURCE').slice(1)) {
    const name = (p.match(/name="([^"]*)"/) || [])[1] || '?';
    const desc = (p.match(/<DESCRIPTION>([\s\S]*?)<\/DESCRIPTION>/) || [])[1] || '';
    console.log('SEARCH', q, '=>', name, '|', desc.replace(/\s+/g, ' ').slice(0, 90));
  }
}

/* 2) analyze the NGC file already on disk */
const d = fs.readFileSync(new URL('./ngc-vii118.xml', import.meta.url), 'utf8');
const rows = d.match(/<TR>([\s\S]*?)<\/TR>/g) || [];
const parse = tr => (tr.replace(/<\/?TR>/g, '').match(/<TD>([\s\S]*?)<\/TD>/g) || []).map(td => td.replace(/<\/?TD>/g, '').trim());
const R = rows.map(parse);
console.log('\nrows:', R.length);
/* type distribution */
const types = {};
for (const r of R) types[r[2]] = (types[r[2]] || 0) + 1;
console.log('type distribution:');
Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([t, n]) => console.log('  ', JSON.stringify(t), n));
/* structure around row 7830 */
console.log('\nrows near 7830:');
for (const i of [7828, 7829, 7830, 7835, 7840, 7900, 8000, 13450]) {
  const r = R[i];
  if (r) console.log(' ', i + 1, '|', r.slice(0, 8).join(' | ').slice(0, 120));
}
/* sample galaxy rows */
const gal = R.filter(r => /^G/i.test(r[2] || ''));
console.log('\ngalaxy rows:', gal.length);
for (const i of [0, 224, 1000, 3000, 5000, 7838]) {
  const r = gal[i];
  if (r) console.log('  ', r.slice(0, 11).join(' | '));
}
