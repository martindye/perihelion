/* ============================================================================
 * PERIHELION — fetch real orbital elements from JPL (Horizons + SBDB)
 *
 * For each new body:
 *   1. resolve SPKID via SBDB (name -> object.spkid)
 *   2. state vector at J2000.0 (TDB) from Horizons VECTORS (DE440 ephemeris)
 *   3. osculating Keplerian elements derived from (r, v)
 *   4. minor planets cross-checked against SBDB mean elements
 *
 * Output: minors-fetched.json  (full provenance for the shipped data block)
 * ==========================================================================*/
const fs = await import('node:fs');
const OUT = { minorPlanets: {}, moons: {} };

const K2 = 2.9591220828559115e-4;   /* G*M_sun in AU^3/day^2  (k^2) */
const sleep = ms => new Promise(s => setTimeout(s, ms));

async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  if (!r.ok) throw new Error('horizons HTTP ' + r.status);
  return (await r.json()).result;
}
async function sbd(name) {
  const r = await fetch('https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=' + encodeURIComponent(name));
  const j = await r.json();
  if (!j.orbit) throw new Error('SBDB: ' + name);
  return j;
}

/* ---------- elements from a state vector (J2000 ecliptic, AU, days) ------ */
function elementsFromRV(r, v, mu) {
  const D = Math.PI / 180, PI2 = Math.PI * 2;
  const rp = Math.hypot(...r);
  const v2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
  const rv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  const energy = v2 / 2 - mu / rp;
  const a = -mu / (2 * energy);
  const h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const hmag = Math.hypot(...h);
  const evec = [(v2 - mu / rp) * r[0] / mu - rv * v[0] / mu,
                (v2 - mu / rp) * r[1] / mu - rv * v[1] / mu,
                (v2 - mu / rp) * r[2] / mu - rv * v[2] / mu];
  const e = Math.hypot(...evec);
  const i = Math.acos(Math.min(1, Math.max(-1, h[2] / hmag))) / D;
  let Omega = Math.atan2(-h[1], h[0]) / D; if (Omega < 0) Omega += 360;
  const nx = -h[1] / hmag, ny = h[0] / hmag;              /* node unit vector */
  let w = Math.acos(Math.min(1, Math.max(-1, (evec[0] * nx + evec[1] * ny) / e))) / D;
  if (evec[2] < 0) w = 360 - w;
  /* true anomaly via e·r */
  let nu = Math.acos(Math.min(1, Math.max(-1, (evec[0] * r[0] + evec[1] * r[1] + evec[2] * r[2]) / (e * rp)))) / D;
  if (rv < 0) nu = 360 - nu;
  /* mean anomaly: E from nu, then M = E - e sinE */
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu * D / 2), Math.sqrt(1 + e) * Math.cos(nu * D / 2)) / D;
  let M = (E - e * Math.sin(E * D)) / D % 360; if (M < 0) M += 360;
  return {
    a: +a.toFixed(7), e: +e.toFixed(6), i: +i.toFixed(4),
    Omega: +Omega.toFixed(4), w: +w.toFixed(4), M0: +M.toFixed(3),
    varpi: +((Omega + w) % 360).toFixed(4),
    L0: +((Omega + w + M) % 360).toFixed(4),
    period_days: +((2 * Math.PI) * Math.sqrt(a ** 3 / mu)).toFixed(5),
    n_degday: +(360 / ((2 * Math.PI) * Math.sqrt(a ** 3 / mu))).toFixed(9)
  };
}

/* parse first state vector line from a Horizons VECTORS text block */
function parseEV(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const L = lines[i], H = lines[i + 1];
    if (/\(AU\)/.test(H) && /\(AU\/d\)/.test(H) && /\d{4}-/.test(L)) {
      const nums = L.trim().split(/\s+/).slice(-6).map(Number);
      if (nums.length === 6 && nums.every(n => isFinite(n))) return nums;
    }
  }
  return null;
}

const RANGE = { START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-02T12:00', STEP_SIZE: '1d' };
async function stateAtJ2000(cmd, center) {
  const text = await hz({ COMMAND: String(cmd), MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS',
    REF_PLANE: 'ECLIPTIC', CENTER: String(center), ...RANGE });
  const sv = parseEV(text);
  if (!sv) throw new Error('no state for ' + cmd + ': ' + text.replace(/\n/g, ' | ').slice(0, 300));
  return sv;
}

/* ================= 1. minor planets ================= */
for (const name of ['Ceres', 'Vesta', 'Pallas', 'Hygiea', 'Pluto', 'Eris', 'Haumea', 'Makemake']) {
  try {
    const s = await sbd(name);
    const spkid = s.object.spkid;
    const sv = await stateAtJ2000(spkid, 10);
    const el = elementsFromRV(sv.slice(0, 3), sv.slice(3), K2);
    const g = {}; for (const e of s.orbit.elements) g[e.name] = parseFloat(e.value);
    OUT.minorPlanets[name] = {
      name, spkid, stateJ2000: sv, elements: el,
      sbd: { a: g.a, e: g.e, i: g.i, Omega: g.om, w: g.w, per_days: g.per, epoch: s.orbit.epoch,
             soln: s.orbit.soln_date, source: s.orbit.source, pe: s.orbit.pe_used, sb_used: s.orbit.sb_used,
             delta: { a: +(g.a - el.a).toFixed(4), e: +(g.e - el.e).toFixed(5), i: +(g.i - el.i).toFixed(3) } }
    };
    console.log(name.padEnd(9), 'a=' + el.a, 'e=' + el.e, 'i=' + el.i, 'P=' + el.period_days + 'd',
      '| SBΔ a/e/i =', OUT.minorPlanets[name].sbd.delta.a, OUT.minorPlanets[name].sbd.delta.e, OUT.minorPlanets[name].sbd.delta.i);
  } catch (e) {
    console.log('!! ' + name, e.message);
  }
  await sleep(400);
}

/* ================= 2. moons ================= */
/* mu of parent primaries (solar-mass ratios) */
const M_PARENT = { 499: 3.22717e-4, 599: 9.5458e-4, 699: 2.8588e-4, 899: 5.428e-5, 951: 1.4586e-5 };
const PLAN = [
  ['Io', 599, [599.1]], ['Europa', 599, [599.2]], ['Ganymede', 599, [599.3]], ['Callisto', 599, [599.4]],
  ['Phobos', 499, [499.1]], ['Deimos', 499, [499.2]],
  ['Titan', 699, [699.1, 699.2, 699.3, 699.4, 699.5, 699.6, 699.7, 699.8, 699.9]],
  ['Rhea', 699, [699.1, 699.2, 699.3, 699.4, 699.5, 699.6, 699.7, 699.8, 699.9]],
  ['Iapetus', 699, [699.1, 699.2, 699.3, 699.4, 699.5, 699.6, 699.7, 699.8, 699.9]],
  ['Triton', 899, [899.1]], ['Charon', 951, [951.1]]
];
for (const [name, parent, cands] of PLAN) {
  if (OUT.moons[name]) continue;
  let ok = false;
  for (const c of cands) {
    try {
      const text = await hz({ COMMAND: String(c), OBJ_DATA: 'YES', MAKE_EPHEM: 'YES',
        EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: String(parent), ...RANGE });
      if (!new RegExp('\\b' + name + '\\b').test(text.slice(0, 1500)))
        throw new Error('identity mismatch (got: ' + (text.match(/Revised[^\n]*/) || ['?'])[0].slice(0, 60) + ')');
      const sv = parseEV(text);
      if (!sv) throw new Error('no state vector');
      const mu = K2 * M_PARENT[parent];
      const el = elementsFromRV(sv.slice(0, 3), sv.slice(3), mu);
      el.period_days = +((2 * Math.PI) * Math.sqrt(el.a ** 3 / mu)).toFixed(5);
      el.n_degday = +(360 / el.period_days).toFixed(5);
      OUT.moons[name] = { name, parent, cmd: c, stateJ2000: sv, mu_parent_solar: M_PARENT[parent], elements: el };
      console.log(name.padEnd(9), 'parent=' + parent, 'cmd=' + c, 'a=' + el.a, 'P=' + el.period_days + 'd', 'i=' + el.i);
      ok = true;
      break;
    } catch (e) {
      console.log(name.padEnd(9), 'try ' + c, '->', e.message.slice(0, 70));
    }
    await sleep(300);
  }
  if (!ok) console.log('!! ' + name + ' NOT RESOLVED');
}

fs.writeFileSync(new URL('./minors-fetched.json', import.meta.url), JSON.stringify(OUT, null, 1));
console.log('\nwrote minors-fetched.json — moons ok:', Object.keys(OUT.moons).length, '/ 11');
