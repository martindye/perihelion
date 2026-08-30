async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
const RANGE = { START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' };
let t = await hz({ COMMAND: 'Ceres', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '10', ...RANGE });
console.log('=== Ceres by name (first 1200 chars) ===');
console.log(t.slice(0, 1200));
t = await hz({ COMMAND: '599.1', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '599', ...RANGE });
console.log('\n=== Io 599.1 (first 1200 chars) ===');
console.log(t.slice(0, 1200));
