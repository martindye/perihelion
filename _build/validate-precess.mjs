import fs from 'node:fs';
const d = fs.readFileSync(new URL('./corwin-vii239a.xml', import.meta.url), 'utf8');
const tables = d.match(/<TABLE[\s\S]*?<\/TABLE>/g) || [];
const parseTable = tb => {
  const fields = [...tb.matchAll(/<FIELD name="([^"]+)"/g)].map(x => x[1]);
  const idx = {}; fields.forEach((f, i) => { if (!(f in idx)) idx[f] = i; });
  const rows = (tb.match(/<TR>[\s\S]*?<\/TR>/g) || []).map(tr => {
    const cells = []; const re = /<TD([^>]*?)(\/>|>)/g; let m;
    while ((m = re.exec(tr))) {
      if (m[2] === '/>') { cells.push(''); continue; }
      const close = tr.indexOf('</TD>', m.index + m[0].length);
      cells.push(tr.slice(m.index + m[0].length, close).replace(/<[^>]+>/g, '').trim());
    }
    return cells;
  });
  return { fields, idx, rows };
};
const T2000 = parseTable(tables[0]);
const T1950 = parseTable(tables[1]);
console.log('T2000 fields:', T2000.fields.join(', '));
console.log('T1950 fields:', T1950.fields.join(', '));
const get = (T, r, name) => { const i = T.idx[name]; return i == null ? '' : (r[i] ?? ''); };
const keyOf = (T, r) => (get(T, r, 'Cat') || '?') + '|' + get(T, r, 'NGC/IC');

const j2000 = new Map();
for (const r of T2000.rows) { const k = keyOf(T2000, r); if (r.length >= 6 && !j2000.has(k)) j2000.set(k, [get(T2000, r, 'RAJ2000'), get(T2000, r, 'DEJ2000')]); }
const b1950 = new Map();
for (const r of T1950.rows) { const k = keyOf(T1950, r); if (r.length >= 6 && !b1950.has(k)) b1950.set(k, [get(T1950, r, 'RAB1950'), get(T1950, r, 'DEB1950')]); }
console.log('joined-able: J2000', j2000.size, 'B1950', b1950.size);

const RAdeg = s => { const m = String(s).trim().match(/^(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/); return m ? (+m[1] + +m[2] / 60 + +m[3] / 3600) * 15 : NaN; };
const DECdeg = s => { const m = String(s).trim().match(/^([+-])?(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] + +m[3] / 60 + (+m[4] || 0) / 3600) : NaN; };

const DEG = Math.PI / 180, arc2rad = s => s / 3600 * DEG, t = 0.5;
const zeta = arc2rad(2306.2137 * t + 0.301883 * t * t + 0.017998 * t ** 3);
const zA = arc2rad(2306.2137 * t - 0.301883 * t * t - 0.017998 * t ** 3);
const th = arc2rad(2004.3109 * t + 0.452290 * t * t - 0.018273 * t ** 3);
const Rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const Rx = a => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
function mm(A, B) { const C = []; for (let i = 0; i < 3; i++) { C[i] = []; for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += A[i][k] * B[k][j]; C[i][j] = s; } } return C; }
const M = mm(mm(Rz(zA), Rx(th)), Rz(zeta));
const rot = (M, v) => [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2], M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2], M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
const eq2u = (ra, d) => { const a = ra * DEG, dc = d * DEG; return [Math.cos(dc) * Math.cos(a), Math.cos(dc) * Math.sin(a), Math.sin(dc)]; };

let n = 0, sumRA = 0, sumDE = 0, maxRA = 0, maxDE = 0, bad = 0; const worst = [];
for (const [k, [raB, deB]] of b1950) {
  const j = j2000.get(k); if (!j) continue;
  const raBd = RAdeg(raB), deBd = DECdeg(deB), raT = RAdeg(j[0]), deT = DECdeg(j[1]);
  if ([raBd, deBd, raT, deT].some(Number.isNaN)) { bad++; continue; }
  const v = rot(M, eq2u(raBd, deBd));
  let ra2 = Math.atan2(v[1], v[0]) / DEG; if (ra2 < 0) ra2 += 360;
  const de2 = Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG;
  let dra = (ra2 - raT) * 3600 * Math.cos(de2 * DEG); while (dra > 10800) dra -= 21600; while (dra < -10800) dra += 21600;
  const dde = (de2 - deT) * 3600;
  n++; sumRA += Math.abs(dra); sumDE += Math.abs(dde);
  maxRA = Math.max(maxRA, Math.abs(dra)); maxDE = Math.max(maxDE, Math.abs(dde));
  if (Math.abs(dra) > 20 || Math.abs(dde) > 20) worst.push([k, raB, deB, 'dRA=' + dra.toFixed(1), 'dDE=' + dde.toFixed(1)]);
}
console.log(`validated: ${n} (bad-parse ${bad})`);
console.log(`mean|dRA|=${(sumRA / Math.max(1, n)).toFixed(3)}″ mean|dDE|=${(sumDE / Math.max(1, n)).toFixed(3)}″  max|dRA|=${maxRA.toFixed(1)}″ max|dDE|=${maxDE.toFixed(1)}″`);
console.log('worst:', worst.slice(0, 10));
