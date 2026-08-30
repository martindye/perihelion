import fs from 'node:fs';
const d = fs.readFileSync(new URL('./corwin-vii239a.xml', import.meta.url), 'utf8');
const tables = d.match(/<TABLE[\s\S]*?<\/TABLE>/g) || [];
const parseTable = tb => {
  const fields = [...tb.matchAll(/<FIELD name="([^"]+)"/g)].map(x => x[1]);
  const idx = {}; fields.forEach((f, i) => { if (!(f in idx)) idx[f] = i; });
  const rows = (tb.match(/<TR>[\s\S]*?<\/TR>/g) || []).map(tr => {
    const cells = []; const re = /<TD([^>]*?)(\/>|>)/g; let m;
    while ((m = re.exec(tr))) { const start = m.index + m[0].length; const close = tr.indexOf('</TD>', start); cells.push(tr.slice(start, close).replace(/<[^>]+>/g, '').trim()); }
    return cells;
  });
  return { idx, rows };
};
const T2000 = parseTable(tables[0]), T1950 = parseTable(tables[1]);
const get = (T, r, n) => { const i = T.idx[n]; return i == null ? '' : (r[i] ?? ''); };
const j2000 = new Map(), b1950 = new Map();
for (const r of T2000.rows) { if (r.length > 6) { const k = get(T2000, r, 'Cat') + '|' + get(T2000, r, 'NGC/IC'); if (!j2000.has(k)) j2000.set(k, [get(T2000, r, 'RAJ2000'), get(T2000, r, 'DEJ2000')]); } }
for (const r of T1950.rows) { if (r.length > 6) { const k = get(T1950, r, 'Cat') + '|' + get(T1950, r, 'NGC/IC'); if (!b1950.has(k)) b1950.set(k, [get(T1950, r, 'RAB1950'), get(T1950, r, 'DEB1950')]); } }
const RAdeg = s => { const m = String(s).trim().match(/^(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/); return m ? (+m[1] + +m[2] / 60 + +m[3] / 3600) * 15 : NaN; };
const DECdeg = s => { const m = String(s).trim().match(/^([+-])?(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] + +m[3] / 60 + (+m[4] || 0) / 3600) : NaN; };
const DEG = Math.PI / 180;
const eq2u = (ra, d) => { const a = ra * DEG, dc = d * DEG; return [Math.cos(dc) * Math.cos(a), Math.cos(dc) * Math.sin(a), Math.sin(dc)]; };

/* collect unit-vector pairs */
const V = [];
for (const [k, [raB, deB]] of b1950) {
  const j = j2000.get(k); if (!j) continue;
  const a = [RAdeg(raB), DECdeg(deB), RAdeg(j[0]), DECdeg(j[1])];
  if (a.some(Number.isNaN)) continue;
  V.push([eq2u(a[0], a[1]), eq2u(a[2], a[3])]);
}
console.log('pairs:', V.length);
/* M = mean( v2000 v1950^T ) */
let M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
for (const [v1, v2] of V) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] += v2[i] * v1[j];
const N = V.length;
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] /= N;
/* polar decomposition via Newton: R <- (R + R^-T)/2 */
const inv3 = A => {
  const [a, b, c] = A[0], [d, e, f] = A[1], [g, h, i] = A[2];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [[(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
          [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
          [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det]];
};
const transp = A => [[A[0][0], A[1][0], A[2][0]], [A[0][1], A[1][1], A[2][1]], [A[0][2], A[1][2], A[2][2]]];
const mmul = (A, B) => A.map((row, i) => [0, 1, 2].map(j => row.reduce((s, x, k) => s + x * B[k][j], 0)));
let R = M.map(r => r.slice());
for (let it = 0; it < 60; it++) {
  const RtInv = transp(inv3(R));
  const next = R.map((row, i) => row.map((x, j) => 0.5 * (R[i][j] + RtInv[i][j])));
  let dr = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) dr += Math.abs(next[i][j] - R[i][j]);
  R = next;
  if (dr < 1e-16) break;
}
const RtR = mmul(transp(R), R);
const det = R[0][0] * (R[1][1] * R[2][2] - R[2][1] * R[1][2]) - R[0][1] * (R[1][0] * R[2][2] - R[2][0] * R[1][2]) + R[0][2] * (R[1][0] * R[2][1] - R[2][0] * R[1][1]);
console.log('R^T R =', RtR.map(r => r.map(x => x.toFixed(9))).flat().join(' '));
console.log('det(R) =', det.toFixed(10));
/* residuals */
const rot = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
let sRA = 0, sDE = 0, mxRA = 0, mxDE = 0;
for (const [v1, v2] of V) {
  const p = rot(R, v1);
  const ra2 = Math.atan2(p[1], p[0]) / DEG, de2 = Math.asin(Math.max(-1, Math.min(1, p[2]))) / DEG;
  const raT = Math.atan2(v2[1], v2[0]) / DEG, deT = Math.asin(v2[2]) / DEG;
  let dra = (ra2 - raT) * 3600 * Math.cos(de2 * DEG); while (dra > 10800) dra -= 21600; while (dra < -10800) dra += 21600;
  const dde = (de2 - deT) * 3600;
  sRA += Math.abs(dra); sDE += Math.abs(dde); mxRA = Math.max(mxRA, Math.abs(dra)); mxDE = Math.max(mxDE, Math.abs(dde));
}
console.log(`residuals: mean|dRA|=${(sRA / N).toFixed(3)}″ mean|dDE|=${(sDE / N).toFixed(3)}″ max|dRA|=${mxRA.toFixed(2)}″ max|dDE|=${mxDE.toFixed(2)}″`);
console.log('R = [');
console.log(' [' + R[0].map(x => x.toFixed(14)).join(', ') + ']');
console.log(' [' + R[1].map(x => x.toFixed(14)).join(', ') + ']');
console.log(' [' + R[2].map(x => x.toFixed(14)).join(', ') + ']');
console.log(']');
