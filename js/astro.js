/* ============================================================================
 * PERIHELION — astronomy engine
 * Keplerian ephemeris for the planets (J2000 mean elements), a low-precision
 * lunar theory, and coordinate transforms between ecliptic / equatorial /
 * three.js world space.
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

  /* Rotate a perifocal vector (x', y', 0) into the ecliptic frame using
   * omega = varpi - Omega, i and Omega. Shared by ephemeris + orbit paths. */
  function perifocalToEcliptic(pl, xp, yp, out) {
    const w = (pl.varpi - pl.Omega) * DEG;
    const i = pl.i * DEG, O = pl.Omega * DEG;
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(i), si = Math.sin(i);
    const cO = Math.cos(O), sO = Math.sin(O);
    out.set(
      (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
      (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
      sw * si * xp + cw * si * yp
    );
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
        + ', Dec ' + dec.toFixed(2) + '; Moon dλ/27.32d = ' + dLamMonth.toFixed(2)
        + '°, dλ/day = ' + dLamDay.toFixed(2) + '°)');
    } else {
      console.warn('[PERIHELION] ephemeris self-test FAILED (Sun RA ' + ra.toFixed(2)
        + ', Dec ' + dec.toFixed(2) + '; Moon dλ/27.32d = ' + dLamMonth.toFixed(2)
        + '°, dλ/day = ' + dLamDay.toFixed(2) + '°)');
    }
    return okSun && okMoon;
  }

  return { DEG, TAU, keplerSolve, helioEcl, helioEclByTrueAnomaly, ecl2equ, moonEcl,
           raDeg, decDeg, formatRA, formatDec, selfTest };
})();
