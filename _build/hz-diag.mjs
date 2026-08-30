async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
let t = await hz({ COMMAND: 'Jupiter', OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' });
console.log('=== Jupiter physical data (raw, 900 chars) ===');
console.log(t.slice(0, 900));
t = await hz({ COMMAND: '501', OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' });
console.log('\n=== Io full physical data (raw) ===');
console.log(t);
t = await hz({ COMMAND: 'Pluto', OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' });
console.log('\n=== Pluto (raw 600) ===');
console.log(t.slice(0, 600).replace(/\n/g, ' | '));
t = await hz({ COMMAND: 'Ceres', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' });
const i = t.indexOf('JDTDB');
console.log('\n=== Ceres state region (raw) ===');
console.log(JSON.stringify(t.slice(i - 200, i + 420)));
