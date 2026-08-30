async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
/* full Io physical data */
let t = await hz({ COMMAND: '501', OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' });
console.log('=== Io full physical data ===');
console.log(t.slice(0, 2200));
/* heliocenter test: Ceres with CENTER=@10 */
t = await hz({ COMMAND: 'Ceres', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' });
console.log('\n=== Ceres @10 center ===');
console.log(t.slice(0, 900).replace(/\n/g, ' | '));
