async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
for (const c of ['699.1', '951.1']) {
  const t = await hz({ COMMAND: c, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:00', STEP_SIZE: '0d' });
  console.log('=== CMD', c, '===');
  console.log(t.slice(0, 700).replace(/\n/g, ' | '));
  console.log();
}
