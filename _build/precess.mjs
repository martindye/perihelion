// B1950 -> J2000 precession (IAU 1976, t = -0.5 centuries from J2000)
// Standard published rotation matrix (rows), well-known in astronomical software.
const P1950_2000 = [
  [ 0.99991898556,  0.01289285955, -0.00631233964 ],
  [ -0.01289294686, 0.99991367254, -0.00689111039 ],
  [ 0.00631127220, -0.00689134159,  0.99996498387 ]
];
const DEG = Math.PI / 180;
function equatorialToUnit(raDeg, decDeg) {
  const a = raDeg * DEG, d = decDeg * DEG;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}
function unitToEquatorial(v) {
  const dec = Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG;
  let ra = Math.atan2(v[1], v[0]) / DEG; if (ra < 0) ra += 360;
  return [ra, dec];
}
function rot(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]
  ];
}
function b1950toJ2000(raB, decB) {
  return unitToEquatorial(rot(P1950_2000, equatorialToUnit(raB, decB)));
}

/* verify against well-known B1950 -> J2000 pairs (h,m,s / d,m,s) */
function HMS(h, m, s) { return (h + m / 60 + s / 3600) * 15; }
function HMSd(s) { return (s[0] < 0 ? -1 : 1) * (Math.abs(s[1]) + s[2] / 60 + (s[3] || 0) / 3600); }
const tests = [
  ['NGC 224 (M31)', [HMS(0, 42, 38.9), HMSd([1, 41, 16, 20])], [HMS(0, 42, 44.3), HMSd([1, 41, 16, 9])]],
  ['NGC 1976 (M42)', [HMS(5, 34, 55.9), HMSd([0, 0, 50, 42])], [HMS(5, 35, 17.3), HMSd([0, 5, 23, 28])]],
  ['NGC 598 (M33)', [HMS(1, 33, 14.2), HMSd([1, 30, 39, 22])], [HMS(1, 33, 50.9), HMSd([1, 30, 39, 37])]],
  ['NGC 253', [HMS(0, 47, 33.0), HMSd([0, 25, 17, 27])], [HMS(0, 48, 23.0), HMSd([0, 25, 6, 56])]]
];
console.log('obj                pred(J2000)            ref(J2000)           dRA(\"\") dDec(\")');
let maxErr = 0;
for (const [name, [raB, decB], [raT, decT]] of tests) {
  const [ra2, dec2] = b1950toJ2000(raB, decB);
  let dra = (ra2 - raT) * 3600 * Math.cos(dec2 * DEG); if (dra > 180 * 60) dra -= 360 * 60; if (dra < -180 * 60) dra += 360 * 60;
  const ddec = (dec2 - decT) * 3600;
  maxErr = Math.max(maxErr, Math.abs(dra), Math.abs(ddec));
  const f = v => { const s = v < 0 ? ' ' : ''; v = Math.abs(v); const hh = Math.floor(v / 15), mm = Math.floor((v * 4) % 60), ss = ((v * 4 % 1) * 15).toFixed(1); return `${s}${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}:${String(ss).padStart(5, '0')}`; };
  const g = (d, v) => (d < 0 ? '-' : '+') + String(Math.abs(v)).padStart(2).split('').join('') + '°' + String(Math.floor(Math.abs(v) * 60)).padStart(2, '0') + '′';
  console.log(name.padEnd(18), f(ra2).padEnd(15), f(raT).padEnd(15), dra.toFixed(2), ddec.toFixed(2));
}
console.log('\nmax residual:', maxErr.toFixed(2), 'arcsec', maxErr < 30 ? '  -> MATRIX OK' : '  -> MATRIX WRONG');
