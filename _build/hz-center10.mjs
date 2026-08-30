async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
const t = await hz({ COMMAND: 'Ceres', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' });
console.log('len', t.length);
const i = t.indexOf('Center body name');
console.log('center line:', t.slice(i, i + 60));
const j = t.indexOf('J2000');
console.log('table region:', t.slice(j - 50, j + 500).replace(/\n/g, ' | '));
