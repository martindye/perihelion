/* ============================================================================
 * PERIHELION — final JPL element fetch, anchored at build epoch T0.
 *
 * For each body: state vector at T0 (TDB) -> osculating Keplerian elements.
 * The shipped element sets carry L0/M0 referenced to J2000.0 (the app's clock)
 * so positions are exact at T0 and propagate with the real mean motion.
 *
 * Minor planets: CENTER=@10 (Sun).  Moons: CENTER=@<parentID> (planetocentric).
 * ==========================================================================*/
const fs = await import('node:fs');
const AU_KM = 1.495978707e8;
const K2 = 2.9591220828559115e-4;              /* GM_sun, AU^3/day^2 */
const T0_JD = Date.UTC(2026, 7, 30, 12, 0, 0) / 86400000 + 2440587.5;
const D_T0 = T0_JD - 2451545.0;                 /* days since J2000.0 */
const OUT = {
  meta: {
    fetchedAt: new Date().toISOString(),
    epochT0: { jd: T0_JD, date: '2026-08-30T12:00TDB', d_since_J2000: D_T0 },
    source: 'JPL Horizons API (DE440-class ephemerides), osculating elements at T0'
  },
  minorPlanets: {}, moons: {}
};

const hz = async p => {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(p);
  const r = await fetch(u);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()).result || '';
};
const sleep = ms => new Promise(s => setTimeout(s, ms));

function parseSV(t) {
  const m = t.match(/= A\.D\..*?TDB[ \t]*\r?\n\s*X\s*=\s*([-+0-9.E]+)\s+Y\s*=\s*([-+0-9.E]+)\s+Z\s*=\s*([-+0-9.E]+)\s*\r?\n\s*VX\s*=\s*([-+0-9.E]+)\s+VY\s*=\s*([-+0-9.E]+)\s+VZ\s*=\s*([-+0-9.E]+)/);
  if (m) return { x: +m[1] / AU_KM, y: +m[2] / AU_KM, z: +m[3] / AU_KM, vx: +m[4] / (AU_KM / 86400), vy: +m[5] / (AU_KM / 86400), vz: +m[6] / (AU_KM / 86400) };
  return null;
}
/* derive osculating Keplerian elements from a state vector (ecliptic J2000).
 * Conventions (verified against the physical construction):
 *   h = r x v;  ascending node n̂ = (−h_y, h_x, 0)/|h_xy|  (so (ĥ×n̂)_z > 0);
 *   Omega = atan2(n̂_y, n̂_x);  w = angle n̂ -> e-vector about ĥ;
 *   nu = angle e-vector -> r, signed by r·v;  M from nu via E. */
function elementsFromRV(r, v, mu) {
  const D = Math.PI / 180;
  const rp = Math.hypot(...r), v2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2, rv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  const a = -mu / (2 * (v2 / 2 - mu / rp));
  const h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const hmag = Math.hypot(...h);
  const ev = [(v2 - mu / rp) * r[0] / mu - (rv / mu) * v[0], (v2 - mu / rp) * r[1] / mu - (rv / mu) * v[1], (v2 - mu / rp) * r[2] / mu - (rv / mu) * v[2]];
  const e = Math.hypot(...ev);
  const i = Math.acos(Math.min(1, Math.max(-1, h[2] / hmag))) / D;
  const hxy = Math.hypot(h[0], h[1]);
  const n = [-h[1] / hxy, h[0] / hxy, 0];                       /* ascending node */
  let Omega = Math.atan2(n[1], n[0]) / D; if (Omega < 0) Omega += 360;
  const H = [h[0] / hmag, h[1] / hmag, h[2] / hmag];            /* ĥ */
  const fh = [H[1] * n[2] - H[2] * n[1], H[2] * n[0] - H[0] * n[2], H[0] * n[1] - H[1] * n[0]]; /* ĥ×n̂ */
  let w = Math.atan2(ev[0] * fh[0] + ev[1] * fh[1] + ev[2] * fh[2], ev[0] * n[0] + ev[1] * n[1] + ev[2] * n[2]) / D;
  if (w < 0) w += 360;
  let nu = Math.acos(Math.min(1, Math.max(-1, (ev[0] * r[0] + ev[1] * r[1] + ev[2] * r[2]) / (e * rp)))) / D;
  if (rv < 0) nu = 360 - nu;
  const Edeg = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu * D / 2), Math.sqrt(1 + e) * Math.cos(nu * D / 2)) / D;
  const Erad = Edeg * D;
  let M = (Erad - e * Math.sin(Erad)) / D % 360; if (M < 0) M += 360;
  const P = 2 * Math.PI * Math.sqrt(a ** 3 / mu);
  return { a: +a.toFixed(7), e: +e.toFixed(6), i_deg: +i.toFixed(4), Omega_deg: +Omega.toFixed(4), w_deg: +w.toFixed(4), M0_at_T0: +M.toFixed(3), varpi_deg: +((Omega + w) % 360).toFixed(4), period_days: +P.toFixed(5), n_deg_day: +(360 / P).toFixed(9) };
}
/* forward model, exact inverse of the derivation:
 * phi = nu + w (angle from ascending node in the orbital plane)
 * x = r(cosO cosφ − ci sO sinφ), y = r(sO cosφ + ci cO sinφ), z = r si sinφ */
function posFromElementsAtT0(el) {
  const D = Math.PI / 180;
  const M = el.M0_at_T0 * D;
  let E = M + el.e * Math.sin(M);
  for (let k = 0; k < 12; k++) E -= (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  const rp = el.a * (1 - el.e * Math.cos(E));
  const phi = nu + el.w_deg * D;
  const cO = Math.cos(el.Omega_deg * D), sO = Math.sin(el.Omega_deg * D);
  const ci = Math.cos(el.i_deg * D), si = Math.sin(el.i_deg * D);
  const cf = Math.cos(phi), sf = Math.sin(phi);
  return [rp * (cO * cf - ci * sO * sf), rp * (sO * cf + ci * cO * sf), rp * si * sf];
}
function resolveId(text, name) {
  if (!/Multiple major-bodies|Use ID#/.test(text)) return null;
  for (const l of text.split('\n')) {
    const m = l.match(/^\s*(\d+)\s+(\S.*?)\s*$/);
    if (!m) continue;
    if (m[2].split(/\s+/)[0] === name && !/barycenter/i.test(m[2])) return m[1];
  }
  return null;
}
async function svAt(name, center, opts = {}) {
  let cmd = name, t;
  for (let i = 0; i < 2; i++) {
    t = await hz({ COMMAND: cmd, MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: center, START_TIME: '2026-08-30T12:00', STOP_TIME: '2026-08-31T12:00', STEP_SIZE: '1d' });
    const sv = parseSV(t);
    if (sv) return { sv, t, cmd };
    const id = resolveId(t, name);
    if (!id) break;
    cmd = id;
    console.log('   ' + name + ' ambiguous -> ' + id);
    await sleep(300);
  }
  if (!parseSV(t)) {
    fs.writeFileSync('debug-fail-' + name + '.txt', t);
    throw new Error('no state vector for ' + name);
  }
  return { sv: parseSV(t), t, cmd };
}

/* ================= minor planets ================= */
for (const name of ['Ceres', 'Vesta', 'Pallas', 'Hygiea', 'Pluto', 'Eris', 'Haumea', 'Makemake']) {
  try {
    const { sv, cmd } = await svAt(name, '@10');
    const el = elementsFromRV([sv.x, sv.y, sv.z], [sv.vx, sv.vy, sv.vz], K2);
    /* round-trip check: elements -> position must reproduce the state vector */
    const pos = posFromElementsAtT0(el);
    const dpos = Math.hypot(pos[0] - sv.x, pos[1] - sv.y, pos[2] - sv.z);
    /* L0 referenced to J2000 so that L = L0 + n*d matches the T0 osculation */
    const L0 = +(((el.varpi_deg + el.M0_at_T0 - el.n_deg_day * D_T0) % 360 + 720) % 360).toFixed(4);
    el.L0_J2000ref = L0;
    el.roundtrip_err_AU = +dpos.toExponential(2);
    if (dpos > 5e-4) throw new Error('round-trip failed: ' + dpos);
    OUT.minorPlanets[name] = { cmd, elements: el };
    console.log(name.padEnd(9), 'a=' + el.a, 'e=' + el.e, 'i=' + el.i_deg + '°  P=' + el.period_days + 'd  L0=' + L0 + '  rt=' + dpos.toExponential(1));
  } catch (e) { console.log('!! ' + name, e.message.slice(0, 100)); }
  await sleep(400);
}

/* ================= moons ================= */
const PARENTS = { Mars: 499, Jupiter: 599, Saturn: 699, Neptune: 899, Pluto: 999 };
const MU_PARENT = { Mars: 42828.375662, Jupiter: 126686531.9, Saturn: 37931206.234, Neptune: 6835099.97, Pluto: 869.326 * 1.122 };
const MOONS = [
  ['Io', '501', 'Jupiter'], ['Europa', '502', 'Jupiter'], ['Ganymede', 'Ganymede', 'Jupiter'], ['Callisto', 'Callisto', 'Jupiter'],
  ['Phobos', 'Phobos', 'Mars'], ['Deimos', 'Deimos', 'Mars'],
  ['Titan', '606', 'Saturn'], ['Rhea', 'Rhea', 'Saturn'], ['Iapetus', 'Iapetus', 'Saturn'],
  ['Triton', 'Triton', 'Neptune'], ['Charon', '901', 'Pluto']
];
for (const [name, cmd, parent] of MOONS) {
  try {
    const { sv } = await svAt(String(cmd), '@' + PARENTS[parent]);
    const mu = MU_PARENT[parent] / AU_KM ** 3 * 86400 ** 2;   /* AU^3/day^2 */
    const el = elementsFromRV([sv.x, sv.y, sv.z], [sv.vx, sv.vy, sv.vz], mu);
    /* round-trip check: elements -> position must reproduce the state vector */
    const pos = posFromElementsAtT0(el);
    const dpos = Math.hypot(pos[0] - sv.x, pos[1] - sv.y, pos[2] - sv.z);
    if (dpos > 5e-6) throw new Error('round-trip failed: ' + dpos);
    /* keep a in km for display scaling */
    el.a_km = +(el.a * AU_KM).toFixed(0);
    el.a_au = el.a; delete el.a;
    el.roundtrip_err_AU = +dpos.toExponential(2);
    el.parent = parent;
    el.parentGM_km3s2 = MU_PARENT[parent];
    OUT.moons[name] = { cmd: String(cmd), cmdUsed: cmd, elements: el };
    console.log(name.padEnd(9), 'a=' + el.a_km + 'km  e=' + el.e + '  i=' + el.i_deg + '°  P=' + el.period_days + 'd  M0=' + el.M0_at_T0 + '°');
  } catch (e) { console.log('!! ' + name, e.message.slice(0, 120)); }
  await sleep(400);
}

fs.writeFileSync(new URL('./minors-final.json', import.meta.url), JSON.stringify(OUT, null, 1));
console.log('\nwrote minors-final.json — minors:', Object.keys(OUT.minorPlanets).length + '/8, moons:', Object.keys(OUT.moons).length + '/11');
