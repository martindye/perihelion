/* Fetch all needed Horizons state vectors as raw text files (one-time, cacheable).
 * Then derive-minors.mjs parses + derives. All CENTER=@10 (heliocentric). */
import fs from 'node:fs';
const DIR = new URL('./raw/', import.meta.url);
fs.mkdirSync(DIR, { recursive: true });
async function hz(params) {
  const r = await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).result;
}
const R_T0 = { START_TIME: '2026-08-30T12:00', STOP_TIME: '2026-08-30T12:01', STEP_SIZE: '1m' };
const R_J2000 = { START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:01', STEP_SIZE: '1m' };
const JOBS = [
  // [file, command, range]
  ['ceres_t0', 'Ceres', R_T0], ['vesta_t0', 'Vesta', R_T0], ['pallas_t0', 'Pallas', R_T0],
  ['hygiea_t0', 'Hygiea', R_T0], ['pluto_t0', 'Pluto', R_T0],
  ['eris_t0', 'Eris', R_T0], ['haumea_t0', 'Haumea', R_T0], ['makemake_t0', 'Makemake', R_T0],
  ['jupbary_j2000', '5', R_J2000], ['jupplanet_j2000', '599', R_J2000],
  ['satbary_j2000', '6', R_J2000], ['satplanet_j2000', '699', R_J2000],
  ['marsbary_j2000', '4', R_J2000], ['marsplanet_j2000', '499', R_J2000],
  ['nepbary_j2000', '8', R_J2000], ['nepplanet_j2000', '899', R_J2000],
];
for (const [file, cmd, range] of JOBS) {
  const f = new URL(file + '.txt', DIR);
  if (fs.existsSync(f)) { console.log('cache', file); continue; }
  for (let t = 0; t < 3; t++) {
    try {
      const text = await hz({ COMMAND: cmd, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@10', ...range });
      fs.writeFileSync(f, text);
      console.log('ok', file, '(' + text.length + ' chars)');
      break;
    } catch (e) {
      console.log('retry', file, t, e.message);
      if (t === 2) console.log('FAILED', file);
      await new Promise(s => setTimeout(s, 1500));
    }
  }
  await new Promise(s => setTimeout(s, 400));
}
console.log('done');
