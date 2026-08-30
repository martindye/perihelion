/* ============================================================================
 * PERIHELION — minor-planet elements (final, robust)
 * Heliocentric J2000.0 state vector -> osculating Keplerian elements.
 * Handles Horizons name ambiguity by resolving the correct ID (primary body,
 * not the barycenter) and re-querying.
 * ==========================================================================*/
const fs = await import('node:fs');
const K2 = 2.9591220828559115e-4;      /* GM_sun, AU^3/day^2 */
const AU_KM = 1.495978707e8;
const OUT = { meta: { fetchedAt: new Date().toISOString(), epoch: 'J2000.0 TDB (JD 2451545.0)', source: 'JPL Horizons API (DE440/DE441)' }, minorPlanets: {} };
const hz = async params => {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).result || '';
};
const sleep = ms => new Promise(s => setTimeout(s, ms));

function parseSV(text) {
  /* Anchor on the TDB ephemeris date line, then require X,Y,Z / VX,VY,VZ. */
  const m = text.match(/= A\.D\..*?TDB[ \t]*\r?\n\s*X\s*=\s*([-+0-9.E]+)\s+Y\s*=\s*([-+0-9.E]+)\s+Z\s*=\s*([-+0-9.E]+)\s*\r?\n\s*VX\s*=\s*([-+0-9.E]+)\s+VY\s*=\s*([-+0-9.E]+)\s+VZ\s*=\s*([-+0-9.E]+)/);
  if (m) return { x: +m[1] / AU_KM, y: +m[2] / AU_KM, z: +m[3] / AU_KM, vx: +m[4] / (AU_KM / 86400), vy: +m[5] / (AU_KM / 86400), vz: +m[6] / (AU_KM / 86400) };
  return null;
}
function elementsFromRV(r, v, mu) {
  const D = Math.PI / 180;
  const rp = Math.hypot(...r), v2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2, rv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  const a = -mu / (2 * (v2 / 2 - mu / rp));
  const h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const hmag = Math.hypot(...h);
  const ev = [(v2 - mu / rp) * r[0] / mu - (rv / mu) * v[0], (v2 - mu / rp) * r[1] / mu - (rv / mu) * v[1], (v2 - mu / rp) * r[2] / mu - (rv / mu) * v[2]];
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
  return { a_au: +a.toFixed(7), e: +e.toFixed(6), i_deg: +i.toFixed(4), Omega_deg: +Omega.toFixed(4), w_deg: +w.toFixed(4), M0_deg: +M.toFixed(3), varpi_deg: +((Omega + w) % 360).toFixed(4), L0_deg: +((Omega + w + M) % 360).toFixed(4), period_days: +P.toFixed(5), n_deg_day: +(360 / P).toFixed(9) };
}
/* pick a unique ID from a disambiguation table: exact name, not a barycenter */
function resolveId(text, name) {
  if (!/Multiple major-bodies|Use ID#/.test(text)) return null;
  const lines = text.split('\n');
  for (const l of lines) {
    const m = l.match(/^\s*(\d+)\s+(\S.*?)\s*$/);
    if (!m) continue;
    const id = m[1], rest = m[2];
    const nameTok = rest.split(/\s+/)[0];
    if (nameTok === name && !/Barycenter/i.test(rest)) return id;
  }
  /* fallback: exact name anywhere but not barycenter */
  for (const l of lines) {
    const m = l.match(/^\s*(\d+)\s+(\S.*?)\s*$/);
    if (m && m[2].trim() === name && !/Barycenter/i.test(l)) return m[1];
  }
  return null;
}
async function stateFor(name) {
  let t = await hz({ COMMAND: name, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' });
  let sv = parseSV(t);
  if (!sv) {
    const id = resolveId(t, name);
    if (id) {
      console.log('   ' + name + ' ambiguous -> using ID ' + id);
      await sleep(300);
      t = await hz({ COMMAND: id, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@10', START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' });
      sv = parseSV(t);
    }
  }
  return { t, sv, id: null };
}
for (const name of ['Ceres', 'Vesta', 'Pallas', 'Hygiea', 'Pluto', 'Eris', 'Haumea', 'Makemake']) {
  try {
    const { t, sv } = await stateFor(name);
    if (!new RegExp('\\b' + name + '\\b').test(t.slice(0, 500)) && !/Multiple major-bodies/.test(t)) throw new Error('identity mismatch');
    if (!sv) throw new Error('no state vector');
    const el = elementsFromRV([sv.x, sv.y, sv.z], [sv.vx, sv.vy, sv.vz], K2);
    OUT.minorPlanets[name] = { stateJ2000_km: { x: sv.x * AU_KM, y: sv.y * AU_KM, z: sv.z * AU_KM, vx_kms: sv.vx * AU_KM / 86400, vy_kms: sv.vy * AU_KM / 86400, vz_kms: sv.vz * AU_KM / 86400 }, elements: el };
    console.log(name.padEnd(9), JSON.stringify(el));
  } catch (e) { console.log('!! ' + name, e.message.slice(0, 120)); }
  await sleep(400);
}
fs.writeFileSync(new URL('./minors-final.json', import.meta.url), JSON.stringify(OUT, null, 1));
console.log('\nwrote minors-final.json — ' + Object.keys(OUT.minorPlanets).length + ' / 8');
