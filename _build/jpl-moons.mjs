/* Probe SPKIDs for major moons */
const ids = ['501', '502', '503', '504', '606', '602', '608', '401', '402', '951', '799', '7999', '801'];
for (const id of ids) {
  const r = await fetch(`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${id}`);
  if (!r.ok) { console.log(id, 'HTTP', r.status); continue; }
  const j = await r.json();
  if (!j.orbit) { console.log(id, 'ERR', (j.message || '').slice(0, 60)); continue; }
  const el = Object.fromEntries((j.orbit.elements || []).map(e => [e.name, e.value + (e.units ? ' ' + e.units : '')]));
  console.log(`${id}\t${j.object && j.object.fullname}\tequinox=${j.orbit.equinox}\t${JSON.stringify({ a: el.a, e: el.e, i: el.i, om: el.om, w: el.w, tp: el.tp, per: el.per, n: el.n })}`);
}
