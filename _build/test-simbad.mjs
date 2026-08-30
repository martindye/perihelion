import fs from 'node:fs';
// test SIMBAD reachability + coordinate query format
try {
  const url = 'https://simbad.u-strasbg.fr/simbad/sim-coo?object=M+31&coordframe=J2000&coordunits=sexagesimal';
  const r = await fetch(url);
  const t = await r.text();
  console.log('status', r.status, 'len', t.length);
  console.log(t.slice(0, 1500));
} catch (e) {
  console.log('FETCH FAIL:', e.message);
}
