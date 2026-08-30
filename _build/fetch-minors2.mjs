/* ============================================================================
 * PERIHELION — JPL orbital elements, definitive fetch (v2)
 *
 * Minor planets: heliocentric J2000.0 state vector (Horizons VECTORS, CENTER
 *   = Sun) -> osculating Keplerian elements.
 * Moons:       parent body ID resolved from Horizons disambiguation table;
 *   planetocentric J2000.0 state vector (CENTER = @<parentID>) -> full
 *   osculating orbit; plus JPL physical-data orbit block (a, e, i, P, radius)
 *   as cross-check.
 *
 * Provenance is recorded per body in minors-fetched.json.
 * ==========================================================================*/
const fs = await import('node:fs');
const K2 = 2.9591220828559115e-4;      /* GM_sun in AU^3/day^2 (k^2) */
const AU_KM = 1.495978707e8;
const OUT = { meta: { fetchedAt: new Date().toISOString(), epoch: 'J2000.0 TDB (JD 2451545.0)', source: 'JPL Horizons API (DE440/DE441 ephemerides)' }, minorPlanets: {}, moons: {} };

const hz = async params => {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).result || '';
};
const sleep = ms => new Promise(s => setTimeout(s, ms));

/* ---------- elements from (r,v) state vector, AU & days ------------------- */
function elementsFromRV(r, v, mu) {
  const D = Math.PI / 180;
  const rp = Math.hypot(...r);
  const v2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
  const rv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  const a = -mu / (2 * (v2 / 2 - mu / rp));
  const h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const hmag = Math.hypot(...h);
  const ev = [(v2 - mu / rp) * r[0] / mu - (rv / mu) * v[0],
              (v2 - mu / rp) * r[1] / mu - (rv / mu) * v[1],
              (v2 - mu / rp) * r[2] / mu - (rv / mu) * v[2]];
  const e = Math.hypot(...ev);
  const i = Math.acos(Math.min(1, Math.max(-1, h[2] / hmag))) / D;
  let Omega = Math.atan2(-h[1], h[0]) / D; if (Omega < 0) Omega += 360;
  const nx = -h[1] / hmag, ny = h[0] / hmag;
  let w = Math.acos(Math.min(1, Math.max(-1, (ev[0] * nx + ev[1] * ny) / e))) / D;
  if (ev[2] < 0) w = 360 - w;
  let nu = Math.acos(Math.min(1, Math.max(-1, (ev[0] * r[0] + ev[1] * r[1] + ev[2] * r[2]) / (e * rp)))) / D;
  if (rv < 0) nu = 360 - nu;
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu * D / 2), Math.sqrt(1 + e) * Math.cos(nu * D / 2)) / D;
  let M = (E - e * Math.sin(E * D)) / D % 360; if (M < 0) M += 360;
  const P = 2 * Math.PI * Math.sqrt(a ** 3 / mu);
  return {
    a_au: +a.toFixed(7), e: +e.toFixed(6), i_deg: +i.toFixed(4),
    Omega_deg: +Omega.toFixed(4), w_deg: +w.toFixed(4), M0_deg: +M.toFixed(3),
    varpi_deg: +((Omega + w) % 360).toFixed(4), L0_deg: +((Omega + w + M) % 360).toFixed(4),
    period_days: +P.toFixed(5), n_deg_day: +(360 / P).toFixed(9)
  };
}
function parseSV(text) {
  const m = text.match(/X\s*=\s*([-+0-9.E]+)\s+Y\s*=\s*([-+0-9.E]+)\s+Z\s*=\s*([-+0-9.E]+)\s*\n\s*VX\s*=\s*([-+0-9.E]+)\s+VY\s*=\s*([-+0-9.E]+)\s+VZ\s*=\s*([-+0-9.E]+)/);
  if (m) return { x: +m[1] / AU_KM, y: +m[2] / AU_KM, z: +m[3] / AU_KM, vx: +m[4] / (AU_KM / 86400), vy: +m[5] / (AU_KM / 86400), vz: +m[6] / (AU_KM / 86400) };
  return null;
}

/* ---------- parent body: resolve ID + GM from Horizons -------------------- */
async function parentInfo(name) {
  const t = await hz({ COMMAND: name, OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' });
  /* disambiguation table? -> take the planet row (skip 'X Barycenter' rows) */
  const line = t.split('\n').find(l => new RegExp('^\\s*\\d+\\s+' + name + '(\\s[^B]|$)').test(l) && !l.includes('Barycenter'));
  let id = null, gm = null;
  if (line) {
    id = +line.trim().split(/\s+/)[0];
    /* query the ID directly for physical data (GM) */
    const t2 = await hz({ COMMAND: String(id), OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' });
    gm = (t2.match(/GM \([^)]*\)\s*=\s*([\d.eE+]+)/) || [])[1] ? parseFloat((t2.match(/GM \([^)]*\)\s*=\s*([\d.eE+]+)/) || [])[1]) : null;
    if (!gm) fs.writeFileSync('debug-gm-' + name + '.txt', t2.slice(0, 1500));
  } else {
    /* unique-name physical block: id is the last token of the header line */
    const m2 = t.match(/Revised[^\n]*\n\s*\S[^\n]*?(\d+)\s*$/m);
    id = m2 ? +m2[1] : null;
    gm = (t.match(/GM \([^)]*\)\s*=\s*([\d.eE+]+)/) || [])[1] ? parseFloat((t.match(/GM \([^)]*\)\s*=\s*([\d.eE+]+)/) || [])[1]) : null;
    if (name === 'Pluto' && !gm) fs.writeFileSync('debug-pluto-phys.txt', t.slice(0, 1500));
  }
  if (!id) throw new Error('no ID for ' + name);
  return { id, gm_km3s2: gm };
}

/* ================= parent bodies ================= */
const PARENTS = {};
for (const p of ['Mars', 'Jupiter', 'Saturn', 'Neptune', 'Pluto']) {
  try {
    const pi = await parentInfo(p);
    PARENTS[p] = pi;
    console.log(p, 'id=' + pi.id, 'GM=' + pi.gm_km3s2, 'km^3/s^2');
  } catch (e) { console.log('!! parent ' + p, e.message.slice(0, 100)); }
  await sleep(300);
}
const MU = {};
for (const p of Object.keys(PARENTS)) {
  MU[p] = PARENTS[p].gm_km3s2 ? PARENTS[p].gm_km3s2 / AU_KM ** 3 * 86400 ** 2 : null;
}

/* ================= minor planets (heliocentric) ================= */
let firstMinor = true;
for (const name of ['Ceres', 'Vesta', 'Pallas', 'Hygiea', 'Pluto', 'Eris', 'Haumea', 'Makemake']) {
  try {
    const t = await hz({ COMMAND: name, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' });
    if (!new RegExp('\\b' + name + '\\b').test(t.slice(0, 400))) throw new Error('identity mismatch: ' + t.slice(0, 150).replace(/\n/g, ' | '));
    const sv = parseSV(t);
    if (!sv) {
      if (firstMinor) { fs.writeFileSync('debug-ceres-raw.txt', t); console.log('dumped debug-ceres-raw.txt'); }
      firstMinor = false;
      throw new Error('no state vector in output');
    }
    const el = elementsFromRV([sv.x, sv.y, sv.z], [sv.vx, sv.vy, sv.vz], K2);
    OUT.minorPlanets[name] = {
      stateJ2000_km: { x: sv.x * AU_KM, y: sv.y * AU_KM, z: sv.z * AU_KM, vx_kms: sv.vx * AU_KM / 86400, vy_kms: sv.vy * AU_KM / 86400, vz_kms: sv.vz * AU_KM / 86400 },
      elements: el
    };
    console.log(name.padEnd(9), JSON.stringify(el));
  } catch (e) {
    console.log('!! ' + name, e.message.slice(0, 150));
  }
  await sleep(400);
}

/* ================= moons (planetocentric) ================= */
const MOONS = [
  ['Io', '501', 'Jupiter'], ['Europa', '502', 'Jupiter'], ['Ganymede', 'Ganymede', 'Jupiter'], ['Callisto', 'Callisto', 'Jupiter'],
  ['Phobos', 'Phobos', 'Mars'], ['Deimos', 'Deimos', 'Mars'],
  ['Titan', '606', 'Saturn'], ['Rhea', 'Rhea', 'Saturn'], ['Iapetus', 'Iapetus', 'Saturn'],
  ['Triton', 'Triton', 'Neptune'], ['Charon', 'Charon', 'Pluto']
];
for (const [name, cmd, parent] of MOONS) {
  try {
    const pid = PARENTS[parent] && PARENTS[parent].id;
    if (!pid) throw new Error('no parent id for ' + parent);
    const pd = await hz({ COMMAND: cmd, OBJ_DATA: 'YES', MAKE_EPHEM: 'NO' });
    if (!new RegExp('\\b' + name + '\\b').test(pd.slice(0, 400))) throw new Error('identity mismatch: ' + pd.slice(0, 150).replace(/\n/g, ' | '));
    const orbitBlock = pd.slice(Math.max(0, pd.indexOf('ORBIT') - 10), pd.indexOf('ORBIT') + 420);
    let aKm = parseFloat((orbitBlock.match(/Semi-major axis[^\n]*?([\d][\d,\.]*)/) || [])[1]?.replace(/,/g, ''));
    const aScale = orbitBlock.match(/\(10\^(-?\d+)\)/);
    if (aScale && isFinite(aKm)) aKm *= Math.pow(10, parseInt(aScale[1], 10));
    const eSat = parseFloat((orbitBlock.match(/Eccentricity[^\n]*?([\d.]+)/) || [])[1]);
    const iSat = parseFloat((orbitBlock.match(/Inclination[^\n]*?([\d.]+)/) || [])[1]);
    const pSat = parseFloat((pd.match(/Orbital period[^\n]*?([\d.]+)\s*d/) || [])[1]);
    const radKm = parseFloat((pd.match(/Mean radius[^\n]*?([\d][\d.,]*)/) || [])[1]);
    const pv = await hz({ COMMAND: cmd, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@' + pid, START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' });
    const sv = parseSV(pv);
    const rec = { parent, cmd: String(cmd), parentCmd: '@' + pid, orbitJ2000: { a_km: aKm, e: eSat, i_deg: iSat, period_days: pSat }, radius_km: radKm };
    if (sv && MU[parent]) {
      const el = elementsFromRV([sv.x, sv.y, sv.z], [sv.vx, sv.vy, sv.vz], MU[parent]);
      rec.stateJ2000 = sv;
      rec.elements = el;
      /* cross-check a & period from state vs physical-data block */
      rec.check = { a_diff_frac: +(el.a_au * AU_KM / aKm - 1).toFixed(5), P_diff_frac: +(el.period_days / pSat - 1).toFixed(5) };
    }
    OUT.moons[name] = rec;
    console.log(name.padEnd(9), 'a=' + aKm + 'km P=' + pSat + 'd r=' + radKm + 'km', sv ? ('state ok: P=' + rec.elements.period_days + 'd i=' + rec.elements.i_deg + 'deg chk=' + JSON.stringify(rec.check)) : 'STATE MISSING');
  } catch (e) {
    console.log('!! ' + name, e.message.slice(0, 150));
  }
  await sleep(400);
}

fs.writeFileSync(new URL('./minors-fetched.json', import.meta.url), JSON.stringify(OUT, null, 1));
console.log('\nwrote minors-fetched.json — minors:', Object.keys(OUT.minorPlanets).length, '/ 8, moons:', Object.keys(OUT.moons).length, '/ 11');
