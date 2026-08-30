import https from 'node:https';
import fs from 'node:fs';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});
const d = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=NGC&-meta=ap');
fs.writeFileSync(new URL('./ngc-search.xml', import.meta.url), d);
/* each RESOURCE: ID + name + first DESCRIPTION */
const parts = d.split('<RESOURCE').slice(1);
for (const p of parts) {
  const id = (p.match(/ID="([^"]+)"/) || [])[1] || '?';
  const name = (p.match(/name="([^"]*)"/) || [])[1] || '?';
  const desc = (p.match(/<DESCRIPTION>([\s\S]*?)<\/DESCRIPTION>/) || [])[1] || '';
  const rows = (p.match(/Number of rows of the table[\s\S]*?<INFO name="value" value="([^"]*)"/) || [])[1] || '?';
  console.log('==', name);
  console.log('   ID:', id, '| rows:', rows);
  console.log('   desc:', desc.replace(/\s+/g, ' ').slice(0, 130));
}
