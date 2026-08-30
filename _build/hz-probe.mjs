/* Probe Horizons COMMAND encodings to find which returns a valid state vector */
async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  const j = await r.json();
  return j;
}
const RANGE = { START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' };
const tries = [
  ['Ceres-byname', { COMMAND: 'Ceres' }],
  ['Ceres-1', { COMMAND: '1' }],
  ['Ceres-2000001', { COMMAND: '2000001' }],
  ['Ceres-20000001', { COMMAND: '20000001' }],
  ['Io-599.1', { COMMAND: '599.1', CENTER: '599' }],
  ['Io-Io', { COMMAND: 'Io', CENTER: '599' }],
];
for (const [label, extra] of tries) {
  try {
    const j = await hz({ MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '10', OBJ_DATA: 'NO', ...RANGE, ...extra });
    const txt = j.result || '';
    const hasEV = /AU\/d/.test(txt) && /-?\d+\.\d+/.test(txt);
    const err = j.error || '';
    console.log(label, '| status ok | err=', JSON.stringify(err).slice(0, 90), '| hasEV=', hasEV, '| head=', (txt.slice(0, 70).replace(/\n/g, ' ')));
  } catch (e) {
    console.log(label, 'FETCH-ERR', e.message);
  }
  await new Promise(r => setTimeout(r, 300));
}
