/* ============================================================================
 * PERIHELION — Phase 1 converter: _build/probes-raw/* -> js/probes.js
 *
 * Parses the cached Horizons files (fetched 2026-08-31):
 *   <key>__samples.txt  — heliocentric ecliptic J2000 states (km, km/s)
 *   <key>__elems.txt    — osculating elements at T0 = 2026-08-30T12:00TDB
 *                         (first $$SOE block; A in km, N in deg/sec, PR s)
 * and emits js/probes.js:
 *   P.probes = { t0, probes: [{ key,name,tier,color,size,model,
 *     el:{a,e,i,Omega,w,M0,n,varpi,hyper,t0},
 *     ep: b64 int32 (seconds from T0), st: b64 float32 (x,y,z,vx,vy,vz),
 *     n, facts:{...} }] }
 *
 * Run: node _build/convert-probes.mjs
 * ==========================================================================*/
import fs from 'node:fs';
const RAW = new URL('./probes-raw/', import.meta.url);
const OUT = new URL('../js/probes.js', import.meta.url);

const AU_KM = 1.495978707e8;
const T0_JD = 2461283.0;          // 2026-08-30T12:00TDB
const T0_D  = 9738.0;             // days after J2000.0

const b64 = (buf) => Buffer.from(buf).toString('base64');

/* ------------------------------------------------------------- metadata -- */
const PROBES = [
  { key: 'jwst', name: 'JWST', tier: 1, model: 'jwst', color: 0xd8b84a, size: 0.34,
    aliases: ['James Webb', 'Webb'],
    facts: { launch: '2021-12-25 · Ariane 5 ECA', agency: 'NASA / ESA / CSA', status: 'operational — halo orbit at Sun–Earth L2',
      fun: 'Sixteen metres of gold-plated mirror, kept colder than outer space by a tennis-court-sized sunshield.' } },
  { key: 'psp', name: 'Parker Solar Probe', tier: 1, model: 'parker', color: 0xe0a030, size: 0.3,
    facts: { launch: '2018-08-12 · Delta IV Heavy', agency: 'NASA / APL', status: 'operational — solar-orbiter, Venus gravity assists',
      fun: 'The fastest human-made object ever: it skims 6.2 million km above the solar surface at up to 192 km/s.' } },
  { key: 'juno', name: 'Juno', tier: 1, model: 'juno', color: 0xc8c8c8, size: 0.32,
    facts: { launch: '2011-08-05 · Atlas V 551', agency: 'NASA / JPL', status: 'operational — polar orbit of Jupiter (ends 2028)',
      fun: 'Dives over Jupiter\u2019s poles every 53 days, x-raying the planet\u2019s gravity field and magnetosphere.' } },
  { key: 'sol_orbiter', name: 'Solar Orbiter', tier: 1, model: 'sat', color: 0xd8a86a, size: 0.3,
    facts: { launch: '2020-02-10 · Atlas V 41', agency: 'ESA / NASA', status: 'operational — 90°-inclined solar orbit',
      fun: 'First spacecraft to image the Sun\u2019s poles — a view impossible from the ecliptic.' } },
  { key: 'bepicolombo', name: 'BepiColombo', tier: 1, model: 'sat', color: 0xb8b0a8, size: 0.3,
    facts: { launch: '2018-10-20 · Ariane 5 ECA', agency: 'ESA / JAXA', status: 'in Mercury orbit since Dec 2025',
      fun: 'Carries two orbiters (MPO + MILA); its 6-year cruise took 23 flybys of Mercury and Venus.' } },
  { key: 'psyche', name: 'Psyche', tier: 1, model: 'sat', color: 0xc0a868, size: 0.3,
    facts: { launch: '2023-10-13 · Falcon Heavy', agency: 'NASA (DARPA/Maxar)', status: 'cruise — arrives 16 Psyche in 2029',
      fun: 'Heading to a metal asteroid the size of a city — a possible exposed planetary core 2.7 AU out.' } },
  { key: 'lucy', name: 'Lucy', tier: 1, model: 'sat', color: 0xc8b8a8, size: 0.3,
    facts: { launch: '2021-10-16 · Atlas V 41', agency: 'NASA / SwRI', status: 'cruise — Centaur encounters 2027–2033',
      fun: 'The first mission to the Jupiter-Trojan Centaurs — a fossil record of the early Solar System.' } },
  { key: 'juice', name: 'JUICE', tier: 1, model: 'sat', color: 0xb8c8d8, size: 0.3,
    facts: { launch: '2023-04-14 · Ariane 5 ECA', agency: 'ESA', status: 'cruise — Jupiter arrival 2031',
      fun: 'Will orbit Ganymede — the only moon in the Solar System with its own magnetic field.' } },
  { key: 'gaia', name: 'Gaia', tier: 1, model: 'sat', color: 0xa8b8c8, size: 0.3,
    facts: { launch: '2013-12-19 · Soyuz-STB / Fregat', agency: 'ESA', status: 'operational — L2 astrometry mission',
      fun: 'Has pinned the positions and motions of about 1.8 billion stars to micro-arcsecond precision.' } },
  { key: 'euclid', name: 'Euclid', tier: 1, model: 'sat', color: 0xb0b8d0, size: 0.3,
    facts: { launch: '2023-07-01 · Ariane 5 ECA', agency: 'ESA', status: 'operational — L2 wide-field survey',
      fun: 'Mapping a third of the sky to weigh dark matter and chart the growth of cosmic structure.' } },
  { key: 'voyager1', name: 'Voyager 1', tier: 2, model: 'voyager', color: 0xd8c8a8, size: 0.34,
    facts: { launch: '1977-09-05 · Titan IIIE-Centaur', agency: 'NASA / JPL', status: 'interstellar since 2012',
      fun: 'Farthest human-made object; its golden record carries sounds and greetings meant for aliens.' } },
  { key: 'voyager2', name: 'Voyager 2', tier: 2, model: 'voyager', color: 0xd8c8a8, size: 0.34,
    facts: { launch: '1977-08-20 · Titan IIIE-Centaur', agency: 'NASA / JPL', status: 'interstellar since 2018',
      fun: 'The only spacecraft to have visited all four giant planets — and the last to do so for now.' } },
  { key: 'new_horizons', name: 'New Horizons', tier: 2, model: 'nh', color: 0xc8b890, size: 0.32,
    facts: { launch: '2006-01-19 · Delta II', agency: 'NASA / APPL', status: 'Kuiper-belt cruise',
      fun: 'Flies by Pluto (2015) and the snowman Arrokoth (2019) — now a resident of the Kuiper belt.' } }
];

/* ------------------------------------------------------------- parsing --- */
function parseSamples(t) {
  const lines = t.split('\n');
  const out = [];
  for (let i = 0; i < lines.length - 3; i++) {
    const m = lines[i].match(/^\s*(\d{7}\.\d+) = A\.D\./);
    if (!m) continue;
    const jd = parseFloat(m[1]);
    const grab = (re) => {
      for (let k = i + 1; k <= i + 3 && k < lines.length; k++) {
        const r = lines[k].match(re);
        if (r) return parseFloat(r[1]);
      }
      return NaN;
    };
    const st = {
      jd,
      x: grab(/X =\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/),
      y: grab(/Y =\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/),
      z: grab(/Z =\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/),
      vx: grab(/VX=\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/),
      vy: grab(/VY=\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/),
      vz: grab(/VZ=\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/)
    };
    if ([st.x, st.y, st.z, st.vx, st.vy, st.vz].every(Number.isFinite)) out.push(st);
  }
  return out;
}

function parseElems(t) {
  /* the LAST $$SOE: long news sections can quote the marker in prose */
  const i = t.lastIndexOf('$$SOE');
  if (i < 0) throw new Error('no $$SOE in elems text (len ' + t.length + ', head ' + JSON.stringify(t.slice(0, 120)) + ')');
  const block = t.slice(i, i + 1200);
  const g = (re) => { const m = block.match(re); if (!m) throw new Error('missing ' + re); return parseFloat(m[1]); };
  const A = g(/A =\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/);          // km (negative if hyperbolic)
  const e = g(/EC=\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/);
  const IN = g(/IN=\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/);
  const OM = g(/OM=\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/);
  const W = g(/W =\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/);
  const N = g(/N =\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/);          // deg/sec
  const MA = g(/MA=\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/);
  const PR = g(/PR=\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/);         // s
  /* M0 is kept UNWRAPPED: for hyperbolic elements (Voyager 1/2, NH) the mean
   * anomaly is an unbounded quantity (e.g. 2914 deg for V1), and wrapping it
   * to 360 makes the Kepler fallback jump to the wrong branch of M = e sinh H - H. */
  return {
    a: A / AU_KM, e, i: IN, Omega: OM, w: W,
    M0: MA,
    n: N * 86400,                       // deg/day
    varpi: (((OM + W) % 360) + 360) % 360,
    Pdays: PR / 86400,
    hyper: e >= 1
  };
}

/* ------------------------------------------------------------- build ----- */
const rows = [];
const console_rows = [];
/* OneDrive files-on-demand can serve a transient/stale read; validate the
 * content and re-read (with a brief settle) until it looks complete. */
const settle = (ms) => { const e = Date.now() + ms; while (Date.now() < e); };
function loadStable(rel, validator, what) {
  const f = new URL(rel, RAW);
  for (let k = 0; k < 8; k++) {
    const t = fs.readFileSync(f, 'utf8');
    if (validator(t)) return t;
    console.log('  re-reading ' + rel + ' (' + what + ' incomplete, attempt ' + (k + 1) + ')');
    settle(400);
  }
  throw new Error('could not read a complete ' + what + ' for ' + rel);
}
for (const meta of PROBES) {
  const sTxt = loadStable(meta.key + '__samples.txt',
    t => (t.match(/^\d{7}\.\d+ = A\.D\./gm) || []).length >= 10, 'samples');
  const eTxt = loadStable(meta.key + '__elems.txt',
    t => { const i = t.lastIndexOf('$$SOE'); return i >= 0 && /A =\s*-?[\d.]/.test(t.slice(i, i + 1200)); }, 'elems');
  const states = parseSamples(sTxt);
  const el = parseElems(eTxt);

  /* epoch seconds from T0 (int32) + float32 states */
  const ep = new Int32Array(states.length);
  const st = new Float32Array(states.length * 6);
  for (let k = 0; k < states.length; k++) {
    const s = states[k];
    ep[k] = Math.round((s.jd - T0_JD) * 86400);
    st[k * 6] = s.x; st[k * 6 + 1] = s.y; st[k * 6 + 2] = s.z;
    st[k * 6 + 3] = s.vx; st[k * 6 + 4] = s.vy; st[k * 6 + 5] = s.vz;
  }
  rows.push({ ...meta, el, epB64: b64(ep.buffer), stB64: b64(st.buffer), n: states.length });

  /* T0 state (nearest sample) for the sanity table */
  let best = 0, bd = Infinity;
  for (let k = 0; k < states.length; k++) {
    const d = Math.abs(states[k].jd - T0_JD);
    if (d < bd) { bd = d; best = k; }
  }
  const s0 = states[best];
  const r = Math.hypot(s0.x, s0.y, s0.z) / AU_KM;
  console_rows.push({ name: meta.name.padEnd(16), au: r.toFixed(3), v: Math.hypot(s0.vx, s0.vy, s0.vz).toFixed(2),
    n: states.length, el: meta.key + ': a=' + el.a.toPrecision(6) + ' e=' + el.e.toPrecision(4) +
      (el.hyper ? ' (hyperbolic)' : '') });
}

/* ------------------------------------------------------------- emit ------ */
let js = '/* ============================================================================\n' +
  ' * PERIHELION — space probes (js/probes.js)\n * \n';
js += ' * T0 = 2026-08-30T12:00TDB (JD 2461283.0, 9738.0 d after J2000.0)\n * \n';
js += ' * Data: JPL Horizons (2026-08-31 fetch, DE441-class ephemerides),\n';
js += ' * heliocentric ecliptic J2000 state vectors in km / km/s.\n';
js += ' *   ep: int32 epoch, seconds from T0   st: float32 [x y z vx vy vz]\n';
js += ' * el: osculating elements at T0 (AU / deg / deg-per-day); hyper = 1\n';
js += ' *     when the heliocentric 2-body fit is hyperbolic (Voyagers, NH).\n';
js += ' * PUNCH (launched 2025) is not yet in the Horizons database.\n';
js += ' * ==========================================================================*/\n';
js += "'use strict';\nwindow.P = window.P || {};\n\nP.probes = {\n  t0: " + T0_D + ',\n  t0Date: \'2026-08-30T12:00TDB\',\n  probes: [\n';
for (const r of rows) {
  const el = r.el;
  js += '    { key: \'' + r.key + '\', name: \'' + r.name + '\', tier: ' + r.tier + ',\n';
  js += '      color: 0x' + r.color.toString(16).padStart(6, '0') + ', size: ' + r.size + ', model: \'' + r.model + '\',\n';
  js += '      el: { a: ' + el.a.toPrecision(8) + ', e: ' + el.e.toPrecision(8) +
        ', i: ' + el.i.toFixed(4) + ', Omega: ' + el.Omega.toFixed(4) +
        ', w: ' + el.w.toFixed(4) + ', M0: ' + el.M0.toFixed(6) +
        ', n: ' + el.n.toFixed(9) + ', varpi: ' + el.varpi.toFixed(4) +
        (el.hyper ? ', hyper: 1' : '') + ', t0: ' + T0_D + ' },\n';
  if (r.aliases) js += '      aliases: ' + JSON.stringify(r.aliases) + ',\n';
  js += '      ep: "' + r.epB64 + '",\n      st: "' + r.stB64 + '",\n      n: ' + r.n + ',\n';
  js += '      facts: { launch: \'' + r.facts.launch + '\', agency: \'' + r.facts.agency + '\',\n' +
        '        status: \'' + r.facts.status + '\', fun: \'' + r.facts.fun + '\' } },\n';
}
js += '  ]\n};\n';
fs.writeFileSync(OUT, js);

console.log('\n=== T0 sanity table (heliocentric) ===');
for (const c of console_rows) console.log(`${c.name}  ${c.au} AU  ${c.v} km/s  ${c.n} samples  ${c.el}`);
console.log('\nwrote js/probes.js (' + (js.length / 1048576).toFixed(2) + ' MB)');
