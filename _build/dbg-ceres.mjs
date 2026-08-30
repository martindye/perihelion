/* Debug: full Ceres T0 state -> elements -> round-trip, with intermediates */
const AU_KM = 1.495978707e8;
const K2 = 2.9591220828559115e-4;
const hz = async p => {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(p);
  const r = await fetch(u);
  return (await r.json()).result || '';
};
const t = await hz({ COMMAND: 'Ceres', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC', CENTER: '@10', START_TIME: '2026-08-30T12:00', STOP_TIME: '2026-08-31T12:00', STEP_SIZE: '1d' });
const m = t.match(/= A\.D\..*?TDB[ \t]*\r?\n\s*X\s*=\s*([-+0-9.E]+)\s+Y\s*=\s*([-+0-9.E]+)\s+Z\s*=\s*([-+0-9.E]+)\s*\r?\n\s*VX\s*=\s*([-+0-9.E]+)\s+VY\s*=\s*([-+0-9.E]+)\s+VZ\s*=\s*([-+0-9.E]+)/);
if (!m) { console.log('NO PARSE'); process.exit(1); }
const r = [+m[1] / AU_KM, +m[2] / AU_KM, +m[3] / AU_KM];
const v = [+m[4] / (AU_KM / 86400), +m[5] / (AU_KM / 86400), +m[6] / (AU_KM / 86400)];
const mu = K2, D = Math.PI / 180;
console.log('r(AU) =', r, ' |r| =', Math.hypot(...r));
console.log('v     =', v);
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
const ecos = (ev[0] * r[0] + ev[1] * r[1] + ev[2] * r[2]) / (e * rp);
let nu = Math.acos(Math.min(1, Math.max(-1, ecos))) / D;
if (rv < 0) nu = 360 - nu;
const Edeg = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu * D / 2), Math.sqrt(1 + e) * Math.cos(nu * D / 2)) / D;
const M_from_nu = (Edeg - e * Math.sin(Edeg * D)) / D;
const M_alt = (Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu * D), Math.cos(nu * D - 0)) / D); // placeholder
const M_alt2 = (Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu * D), Math.cos(nu * D) - e) / D + 360) % 360;
console.log({ e, i, Omega, w, 'ecos_raw': ecos, nu, Edeg, 'M(nu->M)=': M_from_nu, 'M(atan2 form)=': M_alt2 });
/* where is the state vector actually pointing? */
console.log('state: lam =', Math.atan2(r[1], r[0]) / D, ' beta =', Math.asin(r[2] / rp) / D);
console.log('varpi  =', Omega + w, ' nu+varpi =', nu + (Omega + w) % 360);
/* round-trip with the stored (rounded) values */
const el = { a: +a.toFixed(7), e: +e.toFixed(6), i_deg: +i.toFixed(4), Omega_deg: +Omega.toFixed(4), w_deg: +w.toFixed(4), M0_at_T0: +M_from_nu.toFixed(3) };
const M = el.M0_at_T0 * D;
let E = M + el.e * Math.sin(M);
for (let k = 0; k < 12; k++) E -= (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
const nu2 = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2)) / D;
const rp2 = el.a * (1 - el.e * Math.cos(E));
const cw = Math.cos(el.w_deg * D), sw = Math.sin(el.w_deg * D), ci = Math.cos(el.i_deg * D), si = Math.sin(el.i_deg * D), cO = Math.cos(el.Omega_deg * D), sO = Math.sin(el.Omega_deg * D);
const px = rp2 * Math.cos(nu2 * D), py = rp2 * Math.sin(nu2 * D);
const x1 = px * cw - py * sw, y1 = px * sw + py * cw;
const pos = [x1 * cO - y1 * ci * sO, x1 * sO + y1 * ci * cO, y1 * si];
console.log('nu2 =', nu2, ' rp2 =', rp2);
console.log('roundtrip pos =', pos, ' dpos =', Math.hypot(pos[0] - r[0], pos[1] - r[1], pos[2] - r[2]));
