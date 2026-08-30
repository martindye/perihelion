/* Inspect JPL satellite elements (Io) + test Horizons API for verification */
const r1 = await fetch('https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=Io');
const j1 = r1.ok ? await r1.json() : null;
if (!j1) console.log('Io HTTP', r1.status);
else {
  console.log('== Io object ==', JSON.stringify(j1.object));
  console.log('== Io orbit meta ==', JSON.stringify({
    equinox: j1.orbit.equinox, epoch: j1.orbit.epoch, source: j1.orbit.source,
    comment: j1.orbit.comment, tp: j1.orbit.two_body
  }));
  console.log('== Io elements ==');
  for (const el of j1.orbit.elements || []) console.log('  ', el.name, '=', el.value, el.units || '');
}
/* Horizons: geocentric ecliptic for Ceres at J2000 (epoch day 0) */
const h = await fetch('https://ssd-api.jpl.nasa.gov/horizons?' + new URLSearchParams({
  CMD: '1', MAKE_EPHEM: 'Y', OBJ_DATA: 'N', CENTER: '500@10',
  START_TIME: '2000-01-01', STOP_TIME: '2000-01-01 12:00', STEP_SIZE: '0d',
  COLUMNS: '1,3,4,5,6,7', LTYPE: 'APPARENT', QUANTITIES: '1,3,4'
}));
console.log('\n== Horizons status =', h.status);
if (h.ok) {
  const t = await h.text();
  console.log(t.slice(0, 900));
}
