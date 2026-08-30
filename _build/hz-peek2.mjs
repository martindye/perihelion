async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
const RANGE = { START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' };
const t = await hz({ COMMAND: 'Ceres', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '10', ...RANGE });
console.log('total length:', t.length);
console.log(t.slice(1200, 2600));
