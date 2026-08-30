async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return (await r.json()).result || '';
}
const fs = await import('node:fs');
for (const n of ['Pallas', 'Pluto', 'Eris']) {
  const t = await hz({ COMMAND: n, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' });
  fs.writeFileSync('debug-raw-' + n + '.txt', t);
  console.log('=== ' + n + ' (' + t.length + ' chars) ===');
  const i = t.indexOf('JDTDB');
  console.log(t.slice(Math.max(0, i - 300), i + 600).replace(/\n/g, ' ⏎ '));
  console.log();
}
