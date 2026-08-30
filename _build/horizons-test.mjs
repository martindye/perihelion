/* Test Horizons API: state vectors at J2000 for verification + moon ephemerides */
async function horizons(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  if (!r.ok) return { status: r.status, body: (await r.text()).slice(0, 300) };
  return { status: r.status, body: await r.text() };
}

/* 1) Ceres heliocentric state at J2000 — to verify element derivation */
let res = await horizons({
  CMD: '1', MAKE_EPHEM: 'Y', OBJ_DATA: 'Y', CENTER: '10',
  START_TIME: '2000-01-01', STOP_TIME: '2000-01-02', STEP_SIZE: '0d',
  COLUMNS: '1,3,4,5,6,7,10,11,12,13,14,15', LTYPE: 'TRUE'
});
console.log('=== Ceres (CMD=1) heliocentric at J2000 ===');
console.log(res.status ? res.body.slice(0, 1400) : JSON.stringify(res).slice(0, 300));
