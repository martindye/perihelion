/* ============================================================================
 * PERIHELION — astronomy engine
 * Keplerian ephemeris for the planets (J2000 mean elements), a low-precision
 * lunar theory, spacecraft state interpolation (js/probes.js), and coordinate
 * transforms between ecliptic / equatorial / three.js world space.
 * ==========================================================================*/
'use strict';
window.P = window.P || {};
P.astro = (function () {
  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;
  const EPS = 23.4392811 * DEG; // mean obliquity of the ecliptic (J2000)
  const cE = Math.cos(EPS), sE = Math.sin(EPS);

  /* Solve Kepler's equation M = E - e sin E. Returns E in radians. */
  function keplerSolve(M, e) {
    M = M % TAU;
    if (M < 0) M += TAU;
    if (M > Math.PI) M -= TAU;
    let E = e < 0.8 ? M : Math.PI;
    for (let k = 0; k < 14; k++) {
      const f = E - e * Math.sin(E) - M;
      const fp = 1 - e * Math.cos(E);
      const dE = f / fp;
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }
    return E;
  }

  /* Rotate a perifocal vector (x', y') into the ecliptic frame using
   * omega = varpi - Omega, i and Omega. Shared by ephemeris + orbit paths.
   * If outV is given, (vx, vy) is the perifocal velocity, rotated the same
   * way (same units as the position arguments). */
  function perifocalToEcliptic(pl, xp, yp, out, vx, vy, outV) {
    const w = (pl.varpi - pl.Omega) * DEG;
    const i = pl.i * DEG, O = pl.Omega * DEG;
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(i), si = Math.sin(i);
    const cO = Math.cos(O), sO = Math.sin(O);
    const m11 = cO * cw - sO * sw * ci, m12 = -cO * sw - sO * cw * ci;
    const m21 = sO * cw + cO * sw * ci, m22 = -sO * sw + cO * cw * ci;
    const m31 = sw * si,           m32 = cw * si;
    out.set(m11 * xp + m12 * yp, m21 * xp + m22 * yp, m31 * xp + m32 * yp);
    if (outV) outV.set(m11 * vx + m12 * vy, m21 * vx + m22 * vy, m31 * vx + m32 * vy);
    return out;
  }

  /* Heliocentric ecliptic position [AU] of a planet d days after J2000.0. */
  function helioEcl(pl, d, out) {
    const L = pl.L0 + pl.n * d;
    const M = (L - pl.varpi) * DEG;
    const E = keplerSolve(M, pl.e);
    const a = pl.a, e = pl.e;
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    return perifocalToEcliptic(pl, xp, yp, out);
  }

  /* Heliocentric ecliptic position for a given true anomaly nu (orbit lines). */
  function helioEclByTrueAnomaly(pl, nu, out) {
    const r = pl.a * (1 - pl.e * pl.e) / (1 + pl.e * Math.cos(nu));
    return perifocalToEcliptic(pl, r * Math.cos(nu), r * Math.sin(nu), out);
  }

  /* Osculating Keplerian elements referenced to a custom epoch.
   * el = {a, e, i, Omega, varpi, M0, n, t0} — M0 = mean anomaly at t0
   * (t0 in days after J2000.0). Heliocentric ecliptic position [AU]. */
  function oscEcl(el, d, out) {
    const M = (el.M0 + el.n * (d - el.t0)) * DEG;
    const E = keplerSolve(M, el.e);
    const xp = el.a * (Math.cos(E) - el.e);
    const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
    return perifocalToEcliptic({ varpi: el.varpi, Omega: el.Omega, i: el.i }, xp, yp, out);
  }

  /* Orbit-line sampling for osculating elements (same convention as
   * helioEclByTrueAnomaly). */
  function oscEclByTrueAnomaly(el, nu, out) {
    const r = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu));
    return perifocalToEcliptic({ varpi: el.varpi, Omega: el.Omega, i: el.i },
      r * Math.cos(nu), r * Math.sin(nu), out);
  }

  /* ------------------------------------------------------------- probes ---
   * Spacecraft states from js/probes.js: Horizons heliocentric ecliptic
   * samples (km, km/s; int32 epochs in seconds from T0) with an
   * osculating-Kepler fallback outside the sampled window (hyperbolic-aware
   * for Voyager 1/2 and New Horizons). */
  const AU_KM = 1.495978707e8;
  const MU = 2.959122082855911e-4;      /* AU^3/day^2 (GM_sun) */
  function probeHeliocEcl(pb, d, out, outV) {
    const secs = (d - P.probes.t0) * 86400;
    const ep = pb.ep, st = pb.st, n = pb.n;
    if (n > 0 && secs >= ep[0] - 43200 && secs <= ep[n - 1] + 43200) {
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ep[mid] < secs) lo = mid; else hi = mid; }
      const t0 = ep[lo], t1 = ep[hi] || (t0 + 86400);
      const f = Math.max(0, Math.min(1, (secs - t0) / (t1 - t0 || 1)));
      out.set(
        (st[lo * 6] * (1 - f) + st[hi * 6] * f) / AU_KM,
        (st[lo * 6 + 1] * (1 - f) + st[hi * 6 + 1] * f) / AU_KM,
        (st[lo * 6 + 2] * (1 - f) + st[hi * 6 + 2] * f) / AU_KM);
      if (outV) outV.set(
        (st[lo * 6 + 3] * (1 - f) + st[hi * 6 + 3] * f) / AU_KM * 86400,
        (st[lo * 6 + 4] * (1 - f) + st[hi * 6 + 4] * f) / AU_KM * 86400,
        (st[lo * 6 + 5] * (1 - f) + st[hi * 6 + 5] * f) / AU_KM * 86400);
      return true;
    }
    return probeKeplerFwd(pb.el, d, out, outV);
  }
  /* Kepler forward for a probe element set (elliptic OR hyperbolic),
   * heliocentric ecliptic [AU]; velocity (AU/day) when outV is given. */
  function probeKeplerFwd(el, d, out, outV) {
    /* M stays UNWRAPPED for hyperbolic elements (it is unbounded); the
     * ellipse keeps the usual modulo-2pi treatment. */
    let M = (el.M0 + el.n * (d - el.t0)) * DEG;
    const e = el.e, a = el.a;
    if (e < 1) M = M % TAU;
    let H;
    if (e >= 1) {                                  /* M = e sinh H - H */
      const am = Math.abs(M);
      H = Math.sign(M) * (am < 6 ? Math.asinh(Math.sinh(am) / e) : Math.log(Math.max(1e-9, 2 * am / e)));
      for (let k = 0; k < 60; k++) {
        const f = e * Math.sinh(H) - H - M;
        const dH = f / (e * Math.cosh(H) - 1);
        H -= dH;
        if (Math.abs(dH) < 1e-12) break;
      }
    } else H = keplerSolve(M, e);
    const nu = e >= 1
      ? 2 * Math.atan2(Math.sqrt(e + 1) * Math.sinh(H / 2), Math.sqrt(e - 1) * Math.cosh(H / 2))
      : 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(H / 2), Math.sqrt(1 - e) * Math.cos(H / 2));
    const r = a * (1 - e * (e >= 1 ? Math.cosh(H) : Math.cos(H)));
    const p = a * (1 - e * e);                     /* > 0 for ellipses AND hyperbolas */
    const h = Math.sqrt(MU * p);
    const c = MU / h, vr = c * e * Math.sin(nu), vt = c * (1 + e * Math.cos(nu));
    const cx = Math.cos(nu), sx = Math.sin(nu);
    return perifocalToEcliptic({ varpi: el.varpi, Omega: el.Omega, i: el.i },
      r * cx, r * sx, out, vr * cx - vt * sx, vr * sx + vt * cx, outV);
  }
  /* Element-set sanity: for each probe the osculating Kepler orbit must
   * reproduce the interpolated T0 state (elements were derived from it). */
  function probesSelfTest(V3) {
    const pr = (window.P && P.probes) ? P.probes : null;
    if (!pr) return false;
    const a = new V3(), b = new V3();
    let ok = true, worst = 0, worstName = '';
    for (const p of pr.probes) {
      probeHeliocEcl({ ep: p._ep, st: p._st, n: p._n }, pr.t0 + 0, a);      /* samples at T0 */
      probeKeplerFwd(p.el, pr.t0, b);
      const d = a.distanceTo(b);
      if (d > worst) { worst = d; worstName = p.name; }
      if (d > 0.02) { ok = false; console.warn('[PERIHELION] probes self-test: ' + p.name + ' mismatch ' + d + ' AU'); }
    }
    if (ok) console.info('[PERIHELION] probes self-test OK (' + pr.probes.length
      + ' probes, max |sample − Kepler| at T0 ' + worst.toExponential(2) + ' AU [' + worstName + '])');
    return ok;
  }

  /* Sanity-check the minor-planet / moon element sets at their reference
   * epoch (n·period consistency, km↔AU consistency, sanity ranges). */
  function minorsSelfTest() {
    const m = (window.P && P.minors) ? P.minors : null;
    if (!m) return false;
    let ok = true, bad = [];
    const all = m.planets.map(p => ({ n: p.name, e: p.e, n: p.n, per: 360 / p.n, a: p.a }))
      .concat(m.moons.map(p => ({ n: p.name, e: p.e, n: p.n, per: 360 / p.n, a: p.aKm / 1.495978707e8, km: p.aKm, au: p.aAu })));
    for (const b of all) {
      if (b.e < 0 || b.e >= 1) { ok = false; bad.push(b.n + ':e'); }
      if (Math.abs(360 - b.n * b.per) > 0.002) { ok = false; bad.push(b.n + ':n·P'); }
      if (b.km != null && Math.abs(b.km / 1.495978707e8 - b.au) / b.au > 0.005) { ok = false; bad.push(b.n + ':au'); }
      if (!(b.a > 0 && b.a < 1e4)) { ok = false; bad.push(b.n + ':a'); }
    }
    if (ok) {
      console.info('[PERIHELION] minors self-test OK (' + m.planets.length + ' planets, '
        + m.moons.length + ' moons; osculating at ' + m.t0Date + ')');
    } else {
      console.warn('[PERIHELION] minors self-test FAILED: ' + bad.join(', '));
    }
    return ok;
  }

  /* Ecliptic (x,y,z) -> equatorial J2000 (X,Y,Z). */
  function ecl2equ(v, out) {
    out.set(v.x, cE * v.y - sE * v.z, sE * v.y + cE * v.z);
    return out;
  }

  /* Low-precision lunar theory (Meeus, leading terms).
   * T is Julian centuries from J2000 — the rates below are per century.
   * Returns the geocentric ecliptic direction of the Moon (unit vector). */
  function moonEcl(d, out) {
    const T = d / 36525;
    const L = 218.316 + 481267.8813 * T;
    const M = 134.963 + 477198.8676 * T;
    const F = 93.272 + 483202.0175 * T;
    const lam = (L + 6.289 * Math.sin(M * DEG)) * DEG;
    const bet = 5.128 * Math.sin(F * DEG) * DEG;
    const cb = Math.cos(bet);
    out.set(cb * Math.cos(lam), cb * Math.sin(lam), Math.sin(bet));
    return out;
  }

  /* Spherical coordinates of an equatorial vector (X,Y,Z). */
  function raDeg(v) { let r = Math.atan2(v.y, v.x); if (r < 0) r += TAU; return r / DEG; }
  function decDeg(v) { const l = Math.hypot(v.x, v.y, v.z) || 1; return Math.asin(Math.max(-1, Math.min(1, v.z / l))) / DEG; }

  function formatRA(deg) {
    const h = deg / 15;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    return String(hh).padStart(2, '0') + 'h ' + String(mm).padStart(2, '0') + 'm';
  }
  function formatDec(deg) {
    const s = deg < 0 ? '-' : '+';
    const a = Math.abs(deg);
    const dd = Math.floor(a);
    const mm = Math.floor((a - dd) * 60);
    return s + String(dd).padStart(2, '0') + 'deg ' + String(mm).padStart(2, '0') + "'";
  }

  /* Sanity checks:
   *  - at J2000.0 the mean Sun sits near RA 280.5 / Dec -23.0
   *  - the Moon returns to (nearly) its ecliptic longitude after one
   *    sidereal month, and moves ~10-16 deg/day (this is what caught a
   *    units bug: per-century lunar rates applied to days) */
  function selfTest(planets, V3) {
    const earth = planets.find(p => p.name === 'Earth');
    const e = new V3(); helioEcl(earth, 0, e);
    const sunGeo = new V3(-e.x, -e.y, -e.z);               // geocentric Sun
    const sun = ecl2equ(sunGeo, new V3());
    const ra = raDeg(sun), dec = decDeg(sun);
    const okSun = Math.abs(ra - 280.5) < 2.0 && Math.abs(dec + 23.0) < 2.0;

    const lamOf = v => Math.atan2(v.y, v.x) / DEG;
    const m0 = moonEcl(0, new V3());
    let dLamMonth = lamOf(moonEcl(27.321661, new V3())) - lamOf(m0);   // should be ~0 (mod 360)
    if (dLamMonth > 180) dLamMonth -= 360;
    if (dLamMonth < -180) dLamMonth += 360;
    const dLamDay = lamOf(moonEcl(1, new V3())) - lamOf(m0);            // should be 10..16 deg
    const okMoon = Math.abs(dLamMonth) < 2.0 && dLamDay > 10 && dLamDay < 16;

    if (okSun && okMoon) {
      console.info('[PERIHELION] ephemeris self-test OK  (Sun RA ' + ra.toFixed(2)
        + ', Dec ' + dec.toFixed(2) + '; Moon dλ/27.32d = ' + dLamMonth.toFixed(3)
        + '°, dλ/day = ' + dLamDay.toFixed(2) + '°)');
    } else {
      console.warn('[PERIHELION] ephemeris self-test FAILED (Sun RA ' + ra.toFixed(2)
        + ', Dec ' + dec.toFixed(2) + '; Moon dλ/27.32d = ' + dLamMonth.toFixed(2)
        + '°, dλ/day = ' + dLamDay.toFixed(2) + '°)');
    }
    return okSun && okMoon;
  }

  return { DEG, TAU, keplerSolve, helioEcl, helioEclByTrueAnomaly, oscEcl, oscEclByTrueAnomaly,
           ecl2equ, moonEcl, raDeg, decDeg, formatRA, formatDec, selfTest, minorsSelfTest,
           probeHeliocEcl, probeKeplerFwd, probesSelfTest };
})();
