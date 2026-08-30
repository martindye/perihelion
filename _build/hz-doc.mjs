const r = await fetch('https://ssd-api.jpl.nasa.gov/doc/horizons.html');
const t = await r.text();
/* strip tags, keep it readable */
const txt = t.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
/* print the region around parameter names */
for (const kw of ['EPHEM_TYPE', 'VECTORS', 'COLUMNS', 'LTYPE', 'MAKE_EPHEM', 'calc_type', 'CALC_TYPE', 'state vector', 'vector']) {
  const i = txt.indexOf(kw);
  if (i >= 0) console.log(`\n### ${kw}:\n${txt.slice(Math.max(0, i - 120), i + 260)}`);
}
