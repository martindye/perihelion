const DEG = Math.PI / 180;
const arc2rad = s => s / 3600 * DEG;
const t = 0.5;
const zeta = arc2rad(2306.2137 * t + 0.301883 * t * t + 0.017998 * t ** 3);
const zA = arc2rad(2306.2137 * t - 0.301883 * t * t - 0.017998 * t ** 3);
const theta = arc2rad(2004.3109 * t + 0.452290 * t * t - 0.018273 * t ** 3);
console.log('zeta', zeta, 'zA', zA, 'theta', theta);
const Rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const Rx = a => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
function mm(A, B) { const C = []; for (let i = 0; i < 3; i++) { C[i] = []; for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += A[i][k] * B[k][j]; C[i][j] = s; } } return C; }
const M = mm(mm(Rz(zA), Rx(theta)), Rz(zeta));
console.log('M =', JSON.stringify(M));
const rot = (M, v) => [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2], M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2], M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
const eq2u = (ra, d) => { const a = ra*DEG, dc = d*DEG; return [Math.cos(dc)*Math.cos(a), Math.cos(dc)*Math.sin(a), Math.sin(dc)]; };
const raB = (0 + 42/60 + 38.9/3600) * 15;   // M31 B1950
const decB = 41 + 16/60 + 20/3600;
const u = eq2u(raB, decB);
console.log('unit B1950:', u);
const v = rot(M, u);
console.log('rotated:', v);
const ra2 = Math.atan2(v[1], v[0]) / DEG;
const dec2 = Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG;
console.log('pred J2000: ra', ra2, 'dec', dec2);
console.log('ref  J2000: ra', (0 + 42/60 + 44.3/3600) * 15, 'dec', 41 + 16/60 + 9/3600);
