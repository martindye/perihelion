import https from 'node:https';
const get = u => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d }));
  }).on('error', rej);
});
const name = (xml) => {
  const out = [];
  for (const m of xml.matchAll(/<INFO name="([^"]*)"[^>]*>([\s\S]*?)<\/INFO>/g)) out.push(m[1] + ': ' + m[2].replace(/\s+/g, ' ').trim().slice(0, 160));
  const f = [...xml.matchAll(/<FIELD name="([^"]+)"/g)].map(x => x[1]);
  return { info: out.slice(0, 6), fields: f.slice(0, 25) };
};
const rows = (xml) => (xml.match(/<TR>([\s\S]*?)<\/TR>/g) || []).slice(0, 2).map(r =>
  (r.match(/<TD>([\s\S]*?)<\/TD>/g) || []).map(c => c.replace(/<\/?TD>/g, '')).join('  '));
for (const src of ['VI/42', 'VII/225', 'VII/149', 'II/121']) {
  try {
    const r = await get('https://vizier.cds.unistra.fr/viz-bin/votable?-source=' + src + '&-out.takefirst=2');
    if (r.s !== 200 || !r.d.startsWith('<?xml')) { console.log(src, '->', r.s, r.d.slice(0, 80)); continue; }
    const n = name(r.d);
    console.log('\n==== ' + src, '(len', r.d.length + ')');
    console.log('INFO:', n.info.join(' | '));
    console.log('FIELDS:', n.fields.join(', '));
    const tr = rows(r.d);
    if (tr.length) console.log('ROW0:', tr[0].slice(0, 200));
  } catch (e) { console.log(src, 'ERR', e.message); }
}
