/* Test JPL SBDB API for small-body orbital elements */
const targets = process.argv.slice(2);
for (const t of targets) {
  try {
    const r = await fetch(`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(t)}`);
    if (!r.ok) { console.log(t, 'HTTP', r.status); continue; }
    const j = await r.json();
    if (!j.orbit) { console.log(t, 'ERR', JSON.stringify(j).slice(0, 200)); continue; }
    const o = j.orbit || {};
    console.log(`${t}\t${j.name || ''}\t${j.designation}`);
    console.log(`  a=${o.a} e=${o.e} i=${o.i} L=${o.L} lp=${o.lp} N=${o.N} n=${o.n} tp=${o.tp} tp_year=${o.tp_year}`);
  } catch (e) {
    console.log(t, 'FETCH-ERR', e.message);
  }
}
