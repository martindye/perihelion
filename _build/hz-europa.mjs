async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
/* 1) Europa ambiguity list */
let t = await hz({ COMMAND: 'Europa', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:00', STEP_SIZE: '0d' });
console.log('=== Europa disambiguation ===');
console.log(t.slice(0, 900).replace(/\n/g, ' | '));
/* 2) Io (501) planetocentric w.r.t. Jupiter via @Jupiter */
t = await hz({ COMMAND: '501', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@Jupiter', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' });
console.log('\n=== Io 501 rel Jupiter (@Jupiter center) ===');
console.log(t.slice(0, 1400).replace(/\n/g, ' | '));
