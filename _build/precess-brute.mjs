import fs from 'node:fs';
const d = fs.readFileSync(new URL('./corwin-vii239a.xml', import.meta.url), 'utf8');
const tables = d.match(/<TABLE[\s\S]*?<\/TABLE>/g) || [];
const parseTable = tb => {
  const fields = [...tb.matchAll(/<FIELD name="([^"]+)"/g)].map(x => x[1]);
  const idx = {}; fields.forEach((f, i) => { if (!(f in idx)) idx[f] = i; });
  const rows = (tb.match(/<TR>[\s\S]*?<\/TR>/g) || []).map(tr => {
    const cells = []; const re = /<TD([^>]*?)(\/>|>)/g; let m;
    while ((m = re.exec(tr))) { if (m[2] === '/') { /*self close not expected*/ } const start = m.index + m[0].length; const close = tr.indexOf('</TD>', start); cells.push(tr.slice(start, close).replace(/<[^>]+>/g, '').trim()); }
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
// build sample
const sample = [];
for (const [k, [raB, deB]] of b1950) { const j = j2000.get(k); if (!j) continue;
  const a = [RAdeg(raB), DECdeg(deB), RAdeg(j[0]), DECdeg(j[1])];
  if (a.some(Number.isNaN)) continue; sample.push(a); if (sample.length >= 4000) break; }
console.log('sample pairs:', sample.length);

const DEG = Math.PI / 180;
const eq2u = (ra, d) => { const a = ra * DEG, dc = d * DEG; return [Math.cos(dc) * Math.cos(a), Math.cos(dc) * Math.sin(a), Math.sin(dc)]; };
const Rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const Rx = a => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
function mm(A, B) { const C = []; for (let i = 0; i < 3; i++) { C[i] = []; for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += A[i][k] * B[k][j]; C[i][j] = s; } } return C; }
const rot = (M, v) => [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2], M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2], M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
const T = 0.5, A2 = s => s / 3600 * DEG;
const zA = A2(2306.2137 * T - 0.301883 * T * T - 0.017998 * T ** 3);
const th = A2(2004.3109 * T + 0.452290 * T * T - 0.018273 * T ** 3);
const ze = A2(2306.2137 * T + 0.301883 * T * T + 0.017998 * T ** 3);
const cands = {};
for (const [sZ, sT, sE, tag] of [[1,1,1,'+'],[-1,-1,-1,'-']]) {
  cands[`A Rz(zA)Rx(th)Rz(ze) ${tag}`] = mm(mm(Rz(sZ*zA), Rx(sT*th)), Rz(sE*ze));
  cands[`B Rz(ze)Rx(th)Rz(zA) ${tag}`] = mm(mm(Rz(sE*ze), Rx(sT*th)), Rz(sZ*zA));
  cands[`C Rz(zA)Rx(-th)Rz(ze) ${tag}`] = mm(mm(Rz(sZ*zA), Rx(-sT*th)), Rz(sE*ze));
  cands[`D Rz(ze)Rx(-th)Rz(zA) ${tag}`] = mm(mm(Rz(sE*ze), Rx(-sT*th)), Rz(sZ*zA));
}
/* published B1950->J2000 matrix and its transpose */
const P = [[0.99991898556,0.01289285955,-0.00631233964],[-0.01289294686,0.99991367254,-0.00689111039],[0.00631127220,-0.00689134159,0.99996498387]];
cands['P published'] = P;
cands['P^T'] = [0,1,2].map(i => [0,1,2].map(j => P[j][i]));
// evaluate
const score = M => { let s = 0; for (const [raB,deB,raT,deT] of sample) { const v = rot(M, eq2u(raB,deB)); let ra2 = Math.atan2(v[1],v[0])/DEG; if(ra2<0)ra2+=360; const de2=Math.asin(Math.max(-1,Math.min(1,v[2])))/DEG; let dra=(ra2-raT)*3600*Math.cos(de2*DEG); while(dra>10800)dra-=21600; while(dra<-10800)dra+=21600; s+=Math.abs(dra)+Math.abs((de2-deT)*3600); } return s / sample.length; };
const results = Object.entries(cands).map(([n, M]) => [n, score(M)]).sort((a, b) => a[1] - b[1]);
for (const [n, s] of results) console.log(s.toFixed(2).padStart(10), '  ', n);
