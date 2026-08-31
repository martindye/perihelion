/* Phase 1 step 0c — confirm each probe command returns the RIGHT object with a
 * real heliocentric state vector. Records the Target-body-name line (catches
 * name ambiguities like Psyche) and the T0 heliocentric distance.
 * Run: node _build/probe-ids.mjs */
const CANDIDATES = [
  ['JWST', 'JWST'], ['Juno', 'Juno'], ['Juno (spacecraft)', 'Juno?'],
  ['Parker Solar Probe', 'PSP?'], ['PSP', 'Parker?'],
  ['Solar Orbiter', 'Solar Orbiter'], ['BepiColombo', 'BepiColombo'],
  ['Psyche', 'Psyche?'], ['16 Psyche', 'ast. 16'], ['Lucy', 'Lucy?'],
  ['JUICE', 'JUICE'], ['Gaia', 'Gaia'], ['Euclid', 'Euclid'], ['PUNCH', 'PUNCH'],
  ['-31', 'Voyager 1?'], ['-32', 'Voyager 2?'], ['New Horizons', 'NH?']
];
const RANGE = { START_TIME: '2026-08-30T12:00', STOP_TIME: '2026-08-30T12:01', STEP_SIZE: '1m' };
async function hz(params) {
  const r = await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).result;
}
const AU_KM = 1.495978707e8;
for (const [cmd, note] of CANDIDATES) {
  let out;
  try {
    const t = await hz({ COMMAND: cmd, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS',
      REF_PLANE: 'ECLIPTIC', CENTER: '@10', ...RANGE });
    const target = (t.match(/Target body name: (.*)/) || [])[1] || '??';
    const xm = t.match(/X = ([-\d.E+]+)/), ym = t.match(/Y = ?(-?[-\d.E+]+)/), zm = t.match(/Z = ?(-?[-\d.E+]+)/);
    let au = null;
    if (xm && ym && zm) {
      const x = +xm[1], y = +ym[1], z = +zm[1];
      au = Math.hypot(x, y, z) / AU_KM;
    }
    out = { cmd, note, target: target.trim(), au: au != null ? +au.toFixed(4) : null };
  } catch (e) { out = { cmd, note, err: e.message }; }
  console.log(JSON.stringify(out));
  await new Promise(s => setTimeout(s, 600));
}
