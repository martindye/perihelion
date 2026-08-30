async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
for (const n of ['Io', 'Titan']) {
  const t = await hz({ COMMAND: n, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:00', STEP_SIZE: '0d' });
  console.log('=== ' + n + ' ===');
  console.log(t.slice(0, 1500).replace(/\n/g, ' | '));
  console.log();
}
