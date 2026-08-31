/* FINAL derivation of P.minors elements (app convention, verified = textbook PQW->ecliptic).
 * Reads: raw/*.txt (fresh Horizons states), minors-fetched.json (stored barycentric moon states J2000),
 *        js/minors.js (stored values for cross-check), Ixion T0 state (fetched earlier, hardcoded).
 * Writes: minors-final.json + prints a full report with old-vs-new comparison.
 *
 * Bug-inversion cross-checks (from the known pipeline bugs):
 *   old Omega_bug = 90 - Omega_true        -> Omega_true = 90 - stored Omega (mod 360)
 *   old M_old = M_true + 56.2958*E(M_true)  (M_old = (E_deg - e*sin E_rad)/D)
 *     -> invert numerically per body (1-to-1 for given e) and compare with fresh derivation.
 */
import fs from 'node:fs';
const D = Math.PI / 180, TAU = Math.PI * 2, K2 = 2.9591220828559115e-4;
const AU = 1.495978707e8;
const T0D = 9738.0;
const GM = { /* parent GM, AU^3/day^2 (km^3/s^2 * 2.22966e-15) */
  Mars: 4.282837e4 * 2.22966e-15, Jupiter: 1.2668653e8 * 2.22966e-15,
  Saturn: 3.79312e7 * 2.22966e-15, Neptune: 6.836529e6 * 2.22966e-15
};

function keplerSolve(Mrad, e) {
  let M = Mrad % TAU; if (M < 0) M += TAU;
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 80; k++) { const f = E - e * Math.sin(E) - M; const d = f / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-14) break; }
  return E;
}
function elementsFromRV(r, v, mu) {
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
  const Omega = (Math.atan2(h[0], -h[1]) / D + 360) % 360;
  const nn = Math.hypot(h[1], h[0]);
  const n = [-h[1] / nn, h[0] / nn, 0];
  const q = [(h[1] / hmag) * n[2] - (h[2] / hmag) * n[1],
             (h[2] / hmag) * n[0] - (h[0] / hmag) * n[2],
             (h[0] / hmag) * n[1] - (h[1] / hmag) * n[0]];
  const qn = Math.hypot(...q);
  const w = ((Math.atan2((evec[0] * q[0] + evec[1] * q[1] + evec[2] * q[2]) / qn,
                         evec[0] * n[0] + evec[1] * n[1] + evec[2] * n[2]) / D) + 360) % 360;
  /* u = argument of latitude (angle from node, direction of motion); nu = u - w */
  const u = Math.atan2(r[0] * q[0] + r[1] * q[1] + r[2] * q[2],
                       r[0] * n[0] + r[1] * n[1] + r[2] * n[2]) / D;
  const nu = ((u - w) % 360 + 360) % 360;
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu * D / 2), Math.sqrt(1 + e) * Math.cos(nu * D / 2)) / D;
  let M = (E * D - e * Math.sin(E * D)) / D; M = ((M % 360) + 360) % 360;
  const P = TAU * Math.sqrt(a ** 3 / mu);          /* days (a in AU, mu in AU^3/day^2) */
  const consist = (hmag * hmag) / (mu * a * (1 - e * e));
  return { a, e, i, Omega, w, M0: M, n: 360 / P, consist, P };
}
/* App-convention forward (perifocalToEcliptic as implemented in js/astro.js):
 *   elements (a, e, i, varpi, Omega) + M -> (r, v).  Used ONLY for verification. */
function forwardState(el, Mdeg) {
  let E = keplerSolve(Mdeg * D, el.e);
  const cE = Math.cos(E), sE = Math.sin(E);
  const xp = el.a * (cE - el.e), yp = el.a * Math.sqrt(1 - el.e * el.e) * sE;
  const varpi = el.varpi, Omega = el.Omega;
  const wD = ((varpi - Omega) % 360) * D, iD = el.i * D, OD = Omega * D;
  const cw = Math.cos(wD), sw = Math.sin(wD), ci = Math.cos(iD), si = Math.sin(iD), cO = Math.cos(OD), sO = Math.sin(OD);
  const r = [
    (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    sw * si * xp + cw * si * yp
  ];
  const dEdt = (el.n * D) / (1 - el.e * cE);          /* rad/day */
  const vPQ = [-el.a * sE * dEdt, el.a * Math.sqrt(1 - el.e * el.e) * cE * dEdt, 0];
  const v = [
    (cO * cw - sO * sw * ci) * vPQ[0] + (-cO * sw - sO * cw * ci) * vPQ[1],
    (sO * cw + cO * sw * ci) * vPQ[0] + (-sO * sw + cO * cw * ci) * vPQ[1],
    sw * si * vPQ[0] + cw * si * vPQ[1]
  ];
  return { r, v };
}
function roundTripErr(inR, inV, el, Mdeg) {
  const { r, v } = forwardState(el, Mdeg);
  const dr = Math.hypot(r[0] - inR[0], r[1] - inR[1], r[2] - inR[2]);
  const dv = Math.hypot(v[0] - inV[0], v[1] - inV[1], v[2] - inV[2]);
  return { dr: dr / Math.hypot(...inR), dv: dv / Math.hypot(...inV) };
}
/* Invert the old M0 bug:  M_old = M_true + 56.2958 * E(M_true, e)  (mod 360). */
function invertMold(Mold, e) {
  const f = (Mt) => {
    const E = keplerSolve(Mt * D, e) / D;
    return (Mt + 56.2958 * E) % 360;
  };
  /* f is monotone-ish increasing (df/dM = 1 + 56.2958*dE/dM > 0); sweep for the root */
  let best = null;
  for (let M0 = 0; M0 < 360; M0 += 0.5) {
    const d = Math.abs(((f(M0) - Mold + 540) % 360) - 180) - 180;
    if (best === null || Math.abs(d) < Math.abs(best.d)) best = { M0, d };
  }
  for (let pass = 0; pass < 40; pass++) { /* local refine */
    const s = 0.05 / (pass + 1) ** 0.5;
    for (const off of [-s, 0, s]) {
      const M0 = ((best.M0 + off) % 360 + 360) % 360;
      const d = Math.abs(((f(M0) - Mold + 540) % 360) - 180) - 180;
      if (Math.abs(d) < Math.abs(best.d)) best = { M0, d };
    }
    if (Math.abs(best.d) < 1e-9) break;
  }
  return best.M0;
}

/* ---------- parse raw state files ---------- */
function parseState(file, jdStr) {
  const f = file.endsWith('.txt') ? file : file + '.txt';
  const t = fs.readFileSync(new URL('./raw/' + f, import.meta.url), 'utf8');
  const head = t.split('\n').find(l => /Revised:/.test(l)) || '';
  const L = t.split('\n');
  for (let i = 0; i < L.length; i++) {
    if (L[i].includes(jdStr + '.000000000 = A.D.')) {
      const F = '(-?[\\d.]+(?:[eE][-+]?\\d+)?)';
      const px = L[i + 1].match(new RegExp('X\\s*=\\s*' + F + '\\s+Y\\s*=\\s*' + F + '\\s+Z\\s*=\\s*' + F));
      const pv = L[i + 2].match(new RegExp('VX\\s*=\\s*' + F + '\\s+VY\\s*=\\s*' + F + '\\s+VZ\\s*=\\s*' + F));
      if (!px || !pv) throw new Error(file + ': bad state block');
      const sv = [px[1], px[2], px[3], pv[1], pv[2], pv[3]].map(Number);
      return { sv, head: head.trim().replace(/\s+/g, ' ').slice(0, 90) };
    }
  }
  throw new Error(file + ': no ' + jdStr + ' line');
}
const km2au = s => [s[0] / AU, s[1] / AU, s[2] / AU, s[3] * 86400 / AU, s[4] * 86400 / AU, s[5] * 86400 / AU];

/* ---------- stored values from js/minors.js ---------- */
const src = fs.readFileSync(new URL('../js/minors.js', import.meta.url), 'utf8');
function storedEntry(list, name) {
  const re = new RegExp("\\{\\s*name: '" + name + "',([\\s\\S]*?)\\}", 'm');
  const m = src.match(re);
  if (!m) throw new Error('no entry for ' + name);
  const blk = m[1];
  const g = k => { const mm = blk.match(new RegExp(k + ':\\s*([0-9.]+)')); return mm ? +mm[1] : null; };
  return { a: g('a'), e: g('e'), i: g('i'), Omega: g('Omega'), w: g('w'), M0: g('M0'), n: g('n'), varpi: g('varpi'), aKm: g('aKm') };
}
const S = {};
for (const name of ['Ceres','Vesta','Pallas','Hygiea','Pluto','Eris','Haumea','Makemake','Io','Europa','Ganymede','Callisto','Phobos','Deimos','Titan','Rhea','Iapetus','Triton','Charon']) S[name] = storedEntry(null, name);
console.log('parsed stored entries: ' + Object.keys(S).length);

const OUT = { planets: {}, moons: {}, ixion: {}, charon: {}, checks: [] };
const say = (s) => console.log(s);
const chk = (msg) => OUT.checks.push(msg);

/* ============ PLANETS (T0 states) ============ */
const PLANETS = [['Ceres', 'ceres_t0'], ['Vesta', 'vesta_t0'], ['Pallas', 'pallas_t0'], ['Hygiea', 'hygiea_t0'],
                ['Pluto', 'pluto_t0'], ['Eris', 'eris_t0'], ['Haumea', 'haumea_t0'], ['Makemake', 'makemake_t0']];
for (const [name, file] of PLANETS) {
  const { sv, head } = parseState(file, '2461283');
  const s = km2au(sv);
  const el = elementsFromRV(s.slice(0, 3), s.slice(3), K2);
  OUT.planets[name] = { a: +el.a.toFixed(7), e: +el.e.toFixed(6), i: +el.i.toFixed(4),
    Omega: +el.Omega.toFixed(4), w: +el.w.toFixed(4), varpi: +((((el.Omega + el.w) % 360) + 360) % 360).toFixed(4),
    M0: +el.M0.toFixed(3), n: +el.n.toFixed(9), consist: +el.consist.toFixed(6) };
  const st = S[name];
  const Mrec = invertMold(st.M0, st.e);
  const dM = (Mrec - el.M0 + 540) % 360 - 180;
  const dO = ((90 - st.Omega) % 360 + 360) % 360;
  const dO2 = (dO - el.Omega + 540) % 360 - 180;
  const rtP = roundTripErr(s.slice(0, 3), s.slice(3),
    { a: el.a, e: el.e, i: el.i, varpi: (((el.Omega + el.w) % 360) + 360) % 360, Omega: el.Omega, n: el.n }, el.M0);
  say(`P ${name.padEnd(9)} a ${st.a} -> ${el.a.toFixed(6)}  e ${st.e} -> ${el.e.toFixed(5)}  i ${st.i} -> ${el.i.toFixed(3)}`);
  say(`   w ${st.w} -> ${el.w.toFixed(3)}   Omega stored ${st.Omega} (90-inv ${dO.toFixed(3)}) -> derived ${el.Omega.toFixed(3)}  (d=${dO2.toFixed(3)})`);
  say(`   M0 stored ${st.M0} | inverted-old ${Mrec.toFixed(2)} -> derived ${el.M0.toFixed(3)}  (dM=${dM.toFixed(2)})  n ${st.n} -> ${el.n.toFixed(7)}`);
  say(`   RT roundtrip dr/d=${rtP.dr.toExponential(2)} dv/d=${rtP.dv.toExponential(2)}`);
  chk(`planet ${name}: a ${st.a}->${el.a.toFixed(6)} (Δ${(el.a-st.a).toExponential(1)}), e ${st.e}->${el.e.toFixed(5)}, i ${st.i}->${el.i.toFixed(3)}, w ${st.w}->${el.w.toFixed(3)}, Omega ${st.Omega}->${el.Omega.toFixed(3)} [90-inv ${dO.toFixed(2)}], M0 ${st.M0}->${el.M0.toFixed(2)} [inverted ${Mrec.toFixed(2)}], n ${st.n}->${el.n.toFixed(7)}, consist=${el.consist.toFixed(6)}, obj="${head.slice(38, 60).trim()}"`);
}

/* ============ MOONS (stored barycentric J2000 states) ============ */
const saved = JSON.parse(fs.readFileSync(new URL('./minors-fetched.json', import.meta.url), 'utf8'));
const PARENTS = { Jupiter: ['jupbary_j2000', 'jupplanet_j2000'], Saturn: ['satbary_j2000', 'satplanet_j2000'],
                  Mars: ['marsbary_j2000', 'marsplanet_j2000'], Neptune: ['nepbary_j2000', 'nepplanet_j2000'] };
const parentSv = {};
for (const [p, [bf, pf]] of Object.entries(PARENTS)) {
  parentSv[p] = { bary: km2au(parseState(bf, '2451545').sv), planet: km2au(parseState(pf, '2451545').sv) };
}
const MOONS = [['Io', 'Jupiter'], ['Europa', 'Jupiter'], ['Ganymede', 'Jupiter'], ['Callisto', 'Jupiter'],
               ['Phobos', 'Mars'], ['Deimos', 'Mars'], ['Titan', 'Saturn'], ['Rhea', 'Saturn'],
               ['Iapetus', 'Saturn'], ['Triton', 'Neptune']];
for (const [name, parent] of MOONS) {
  const sv0 = saved.moons[name].stateJ2000;
  if (!sv0) throw new Error('no stored state for ' + name);
  const sb = [sv0.x, sv0.y, sv0.z, sv0.vx, sv0.vy, sv0.vz];
  const { bary, planet } = parentSv[parent];
  const raw = elementsFromRV(sb.slice(0, 3), sb.slice(3), GM[parent === 'Pluto' ? 'Mars' : parent]);
  const rc = [sb[0] + bary[0] - planet[0], sb[1] + bary[1] - planet[1], sb[2] + bary[2] - planet[2]];
  const vc = [sb[3] + bary[3] - planet[3], sb[4] + bary[4] - planet[4], sb[5] + bary[5] - planet[5]];
  const cor = elementsFromRV(rc, vc, GM[parent]);
  const pick = Math.abs(1 - cor.consist) < Math.abs(1 - raw.consist) ? cor : raw;
  const usedState = (pick === cor) ? { r: rc, v: vc } : { r: sb.slice(0, 3), v: sb.slice(3) };
  const rtM = roundTripErr(usedState.r, usedState.v,
    { a: pick.a, e: pick.e, i: pick.i,
      varpi: ((((pick.Omega + pick.w) % 360) + 360) % 360), Omega: pick.Omega, n: pick.n }, pick.M0);
  const M0_T0 = (pick.M0 + pick.n * T0D) % 360;
  OUT.moons[name] = { a: +pick.a.toFixed(9), e: +pick.e.toFixed(6), i: +pick.i.toFixed(4),
    Omega: +pick.Omega.toFixed(4), w: +pick.w.toFixed(4), varpi: +(((pick.Omega + pick.w) % 360 + 360) % 360).toFixed(4),
    M0_T0: +M0_T0.toFixed(3), M0_J2000: +pick.M0.toFixed(3), n: +pick.n.toFixed(9),
    aKm: Math.round(pick.a * AU), consist: +pick.consist.toFixed(6) };
  const st = S[name];
  say(`M ${name.padEnd(8)} aKm ${st.aKm} -> ${Math.round(pick.a * AU)} (raw ${raw.consist.toFixed(5)} / corr ${cor.consist.toFixed(6)})`);
  say(`   e ${st.e} -> ${pick.e.toFixed(5)}  i ${st.i} -> ${pick.i.toFixed(3)}  Omega ${st.Omega} -> ${pick.Omega.toFixed(3)}  w ${st.w} -> ${pick.w.toFixed(3)}`);
  say(`   M0_T0 -> ${M0_T0.toFixed(2)}  n ${st.n} -> ${pick.n.toFixed(6)}   RT dr/d=${rtM.dr.toExponential(2)} dv/d=${rtM.dv.toExponential(2)}`);
  chk(`moon ${name}: aKm ${st.aKm}->${Math.round(pick.a * AU)}, e ${st.e}->${pick.e.toFixed(5)}, i ${st.i}->${pick.i.toFixed(3)}, Omega ${st.Omega}->${pick.Omega.toFixed(3)}, w ${st.w}->${pick.w.toFixed(3)}, M0_T0 ${st.M0}->${M0_T0.toFixed(2)}, n ${st.n}->${pick.n.toFixed(6)}, consist=${pick.consist.toFixed(6)}`);
}

/* ============ CHARON (no state: keep a/e/i/n; un-bug Omega; M0 phase retained) ============ */
{
  const st = S.Charon;
  const OmegaC = ((90 - st.Omega) % 360 + 360) % 360;
  OUT.charon = { aKm: st.aKm, e: st.e, i: st.i, Omega: +OmegaC.toFixed(4),
    w: st.w, varpi: +((((OmegaC + st.w) % 360) + 360) % 360).toFixed(4),
    M0_T0: st.M0, n: st.n, note: 'no state vector available; a/e/i/n from fact sheet; Omega = 90 - stored (bug inversion); M0 phase retained from original fetch (unverifiable)' };
  say('C Charon: Omega ' + st.Omega + ' -> ' + OUT.charon.Omega + ' (90-inv); w/M0 retained');
}

/* ============ Ixion (T0 heliocentric km state fetched earlier via CENTER=@10) ============ */
{
  const sv = [7.468042235984757e8, -5.475789157697614e9, -8.868148515266395e8,
              4.387275911288848, 2.017228733273921, -1.248898256132012];
  const s = km2au(sv);
  const el = elementsFromRV(s.slice(0, 3), s.slice(3), K2);
  OUT.ixion = { a: +el.a.toFixed(7), e: +el.e.toFixed(6), i: +el.i.toFixed(4),
    Omega: +el.Omega.toFixed(4), w: +el.w.toFixed(4), varpi: +(((el.Omega + el.w) % 360 + 360) % 360).toFixed(4),
    M0: +el.M0.toFixed(3), n: +el.n.toFixed(9), consist: +el.consist.toFixed(6) };
  say('Ixion: a=' + el.a.toFixed(5) + ' e=' + el.e.toFixed(5) + ' i=' + el.i.toFixed(3) + ' Ω=' + el.Omega.toFixed(3) + ' w=' + el.w.toFixed(3) + ' M0=' + el.M0.toFixed(3) + ' n=' + el.n.toFixed(8) + ' consist=' + el.consist.toFixed(5));
}

fs.writeFileSync(new URL('./minors-final.json', import.meta.url), JSON.stringify(OUT, null, 1));
console.log('\nwrote minors-final.json');
