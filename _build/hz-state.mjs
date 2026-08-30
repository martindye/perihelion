async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  const j = await r.json();
  return j;
}

/* Ceres (1) heliocentric state vector at J2000.0 (2000-01-01T12:00 TDB) */
let j = await hz({
  COMMAND: '1', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC',
  CENTER: '10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:00',
  STEP_SIZE: '0d', QUANTITIES: '2', TIME_SCALE: 'TDB'
});
console.log('=== Ceres heliocentric state @J2000 ===');
console.log('desc:', j.dsc, '| center:', j.center, '| plane:', j.refplane);
if (j.evs && j.evs[0]) console.log('EV[0]:', JSON.stringify(j.evs[0]));
if (j.evs) console.log('n rows:', j.evs.length);
if (!j.evs) console.log('raw:', JSON.stringify(j).slice(0, 400));

/* Io (699.1) planetocentric (relative to Jupiter 699) at J2000.0 */
j = await hz({
  COMMAND: '699.1', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC',
  CENTER: '699', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:00',
  STEP_SIZE: '0d', QUANTITIES: '2', TIME_SCALE: 'TDB'
});
console.log('\n=== Io planetocentric state @J2000 ===');
console.log('desc:', j.dsc, '| center:', j.center);
if (j.evs) console.log('EV[0]:', JSON.stringify(j.evs[0]));
else console.log('raw:', JSON.stringify(j).slice(0, 300));
