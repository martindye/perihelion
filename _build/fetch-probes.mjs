/* ============================================================================
 * PERIHELION — Phase 1: probe ephemeris fetch (JPL Horizons, 2026-08-30/31)
 *
 * One raw-text cache per probe and datum:
 *   probes-raw/<key>__elems.txt   — osculating elements at T0 (heliocentric)
 *   probes-raw/<key>__samples.txt — heliocentric ecliptic state vectors
 *
 * Sampling (per plan §3):
 *   - "inner" probes: weekly, 2016-08-30 … 2036-08-30 (covers ±10 y of T0)
 *   - "outer" probes: monthly, 2001-08-30 … 2051-08-30 (covers ±25 y of T0)
 *
 * Commands were resolved empirically 2026-08-31 (probe-ids.mjs) — numeric
 * Horizons IDs where names are ambiguous (Juno -61, Solar Orbiter -144,
 * Psyche -255 [NOT asteroid 16 Psyche], Lucy -49, Voyager 1 -31 / -32).
 * PUNCH (launched 2025) is NOT yet in the Horizons database — skipped.
 *
 * Run: node _build/fetch-probes.mjs   (cached; safe to re-run)
 * ==========================================================================*/
import fs from 'node:fs';
const DIR = new URL('./probes-raw/', import.meta.url);
fs.mkdirSync(DIR, { recursive: true });

const T0 = '2026-08-30T12:00';
const AU = 1.495978707e8;

/* Per-probe sample ranges. START must be after the probe's first data epoch
 * and STOP before the prediction file ends — Horizons aborts the WHOLE
 * ephemeris if either bound falls outside the trajectory file. End dates
 * below read from each probe's "No ephemeris after ..." note (2026-08-31). */
const RANGES = {
  jwst:          { START_TIME: '2022-01-01T12:00', STOP_TIME: '2031-08-22T12:00', STEP_SIZE: '7d' },
  psp:           { START_TIME: '2019-01-01T12:00', STOP_TIME: '2029-12-30T12:00', STEP_SIZE: '7d' },
  juno:          { START_TIME: '2016-08-30T12:00', STOP_TIME: '2028-09-30T12:00', STEP_SIZE: '7d' },
  sol_orbiter:   { START_TIME: '2020-06-01T12:00', STOP_TIME: '2030-11-18T12:00', STEP_SIZE: '7d' },
  bepicolombo:   { START_TIME: '2019-01-01T12:00', STOP_TIME: '2027-04-09T12:00', STEP_SIZE: '7d' },
  psyche:        { START_TIME: '2024-01-01T12:00', STOP_TIME: '2029-02-09T12:00', STEP_SIZE: '7d' },
  lucy:          { START_TIME: '2022-01-01T12:00', STOP_TIME: '2033-04-01T12:00', STEP_SIZE: '7d' },
  juice:         { START_TIME: '2023-07-01T12:00', STOP_TIME: '2031-07-19T12:00', STEP_SIZE: '7d' },
  gaia:          { START_TIME: '2016-08-30T12:00', STOP_TIME: '2036-08-30T12:00', STEP_SIZE: '7d' },
  euclid:        { START_TIME: '2023-10-01T12:00', STOP_TIME: '2031-10-03T12:00', STEP_SIZE: '7d' },
  voyager1:      { START_TIME: '2001-08-30T12:00', STOP_TIME: '2051-08-30T12:00', STEP_SIZE: '30d' },
  voyager2:      { START_TIME: '2001-08-30T12:00', STOP_TIME: '2051-08-30T12:00', STEP_SIZE: '30d' },
  new_horizons:  { START_TIME: '2006-06-01T12:00', STOP_TIME: '2049-12-30T12:00', STEP_SIZE: '30d' }
};

const PROBES = [
  // key, command (resolved 2026-08-31, see probe-ids.mjs)
  ['jwst',          'JWST'],
  ['psp',           'PSP'],
  ['juno',          '-61'],
  ['sol_orbiter',   '-144'],
  ['bepicolombo',   'BepiColombo'],
  ['psyche',        '-255'],
  ['lucy',          '-49'],
  ['juice',         'JUICE'],
  ['gaia',          'Gaia'],
  ['euclid',        'Euclid'],
  ['voyager1',      '-31'],
  ['voyager2',      '-32'],
  ['new_horizons',  'New Horizons']
];

async function hz(params) {
  const r = await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).result;
}

let fails = 0;
for (const [key, cmd, cls] of PROBES) {
  /* --- osculating elements at T0 --- */
  const fE = new URL(key + '__elems.txt', DIR);
  if (!fs.existsSync(fE)) {
    for (let t = 0; t < 3; t++) {
      try {
        const text = await hz({ COMMAND: cmd, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'ELEMENTS',
          REF_PLANE: 'ECLIPTIC', CENTER: '@10',
          START_TIME: '2026-08-30T12:00', STOP_TIME: '2026-08-30T12:01', STEP_SIZE: '1m' });
        fs.writeFileSync(fE, text);
        console.log('elems  ', key, '(' + text.length + ' chars)');
        break;
      } catch (e) {
        console.log('elems retry', key, t, e.message);
        if (t === 2) { fails++; console.log('FAILED elems', key); }
        await new Promise(s => setTimeout(s, 1500));
      }
    }
  } else console.log('cache    elems  ', key);
  await new Promise(s => setTimeout(s, 1200));

  /* --- state-vector time series --- */
  const fS = new URL(key + '__samples.txt', DIR);
  if (!fs.existsSync(fS)) {
    for (let t = 0; t < 3; t++) {
      try {
        const text = await hz({ COMMAND: cmd, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS',
          REF_PLANE: 'ECLIPTIC', CENTER: '@10', ...RANGES[key] });
        const n = (text.match(/^\d{7}\.\d+ = A\.D\./gm) || []).length;
        const note = (text.match(/No ephemeris[^\n]*/i) || [])[0] || '';
        fs.writeFileSync(fS, text);
        console.log('samples', key, '(' + n + ' states' + (note ? ' — ' + note.slice(0, 70) : '') + ')');
        break;
      } catch (e) {
        console.log('samples retry', key, t, e.message);
        if (t === 2) { fails++; console.log('FAILED samples', key); }
        await new Promise(s => setTimeout(s, 1500));
      }
    }
  } else console.log('cache    samples', key);
  await new Promise(s => setTimeout(s, 1200));
}
console.log(fails ? fails + ' FAILURES' : 'all probes fetched');
