import https from 'node:https';
const get = (u, o = {}) => new Promise((res, rej) => {
  https.get(u, { headers: { 'User-Agent': 'perihelion-dev/1.0 (contact: local)', 'Accept': o.json ? 'application/vnd.github+json' : '*/*' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d, h: r.headers }));
  }).on('error', rej);
});

/* A) Celestia data repo: list every .dat/.ssc/.tab catalog file */
const repo = 'CelestiaProject/CelestiaContent';
const tr = await get(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`, { json: true });
const j = JSON.parse(tr.d);
const files = (j.tree || []).filter(t => /\.(dat|ssc|tab|txt)$/i.test(t.path)).map(t => t.path + '  (' + (t.size || '?') + 'B)');
console.log('== ' + repo + ' catalog-like files:');
console.log(files.join('\n') || '  (none)');
