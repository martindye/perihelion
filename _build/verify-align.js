'use strict';
/* Verify stars-named.js ID arrays align byte-for-byte with js/stars-hip.js */
const fs = require('fs');
const path = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/';

global.window = global;
require(path + 'js/stars-hip.js');
require(path + 'js/stars-named.js');

const hip = P.starsHip;
const ids = P.starIds;
console.log('stars-hip count:', hip.count, ' ids count:', ids.count, ' match:', hip.count === ids.count);

const buf = Buffer.from(hip.b64, 'base64');
const hipA = Buffer.from(ids.hip, 'base64');
const hdA = Buffer.from(ids.hd, 'base64');
console.log('b64 bytes:', buf.length, ' ids bytes:', hipA.length, hdA.length, ' expect', hip.count * 4);

/* rebuild the float buffer from convert-named's logic and compare to stars-hip.js */
const csv = fs.readFileSync(path + '_build/hip_main.csv', 'utf8').split('\n');
const header = csv[0].split(',');
const col = n => header.indexOf(n);
const I_RA = col('RA_Deg'), I_DEC = col('Dec_Deg'), I_V = col('Vmag'),
      I_BV = col('BV_Color'), I_VM2 = col('Hip_Mag');
const rows = [];
for (let i = 1; i < csv.length; i++) {
  const line = csv[i];
  if (!line || line.charCodeAt(0) === 13) continue;
  const c = line.split(',');
  const ra = parseFloat(c[I_RA]), dec = parseFloat(c[I_DEC]);
  let v = parseFloat(c[I_V]);
  if (!isFinite(v)) v = parseFloat(c[I_VM2]);
  if (!isFinite(ra) || !isFinite(dec) || !isFinite(v) || v > 11.5) continue;
  let bv = parseFloat(c[I_BV]);
  if (!isFinite(bv)) bv = 0.9;
  rows.push({ ra, dec, v, bv });
}
console.log('rows (pre-exclusion):', rows.length);

/* curated exclusions: recompute nearest with full-scan (like convert.js) */
const dataJs = fs.readFileSync(path + 'js/data.js', 'utf8');
const namedRe = /\[\s*'([^']+)',\s*([\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*([\d.]+|null)\s*\]/g;
const curated = [];
let m;
while ((m = namedRe.exec(dataJs)) !== null) curated.push({ name: m[1], ra: +m[2], dec: +m[3] });
const D2R = Math.PI / 180;
const excluded = new Set();
for (const n of curated) {
  const qa = n.ra * D2R, qd = n.dec * D2R;
  const qx = Math.cos(qd) * Math.cos(qa), qy = Math.sin(qd), qz = -Math.cos(qd) * Math.sin(qa);
  let best = -1, bestDot = -2;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const a = r.ra * D2R, d = r.dec * D2R, cd = Math.cos(d);
    const dot = qx * cd * Math.cos(a) + qy * Math.sin(d) + qz * (-cd * Math.sin(a));
    if (dot > bestDot) { bestDot = dot; best = i; }
  }
  if (Math.acos(Math.min(1, bestDot)) / D2R < 1.0) excluded.add(best);
}
const out = rows.filter((_, i) => !excluded.has(i));
console.log('excluded:', excluded.size, ' out:', out.length, '(expect 116547)');

const bufB = Buffer.alloc(out.length * 16);
out.forEach((s, i) => {
  bufB.writeFloatLE(s.ra, i * 16);
  bufB.writeFloatLE(s.dec, i * 16 + 4);
  bufB.writeFloatLE(s.v, i * 16 + 8);
  bufB.writeFloatLE(s.bv, i * 16 + 12);
});
console.log('float buffer identical to stars-hip.js:', bufB.equals(buf));

/* ID spot checks */
const f32 = new Float32Array(buf.buffer, 0, buf.length / 4);
const hi32 = new Int32Array(hipA.buffer, 0, hipA.length / 4);
const hd32 = new Int32Array(hdA.buffer, 0, hdA.length / 4);
console.log('named entries:', P.starNamed.count, ' curated83 refs:', P.starNamed83.length);
console.log('sample named:');
for (const [i, name, refs] of P.starNamed.data.slice(0, 4))
  console.log('  ', name, '@buf', i, 'HIP', hi32[i], ' V', f32[i * 4 + 2].toFixed(2), '—', refs.slice(0, 60));
const byName = n => P.starNamed.data.find(e => e[1] === n || e[2].includes(n));
const sir = P.starNamed83.findIndex(r => r && r.startsWith('HIP 32349'));
console.log('Sirius curated idx (HIP 32349):', sir, P.starNamed83[sir]);
const veg = P.starNamed83.findIndex(r => r && r.startsWith('HIP 91262'));
console.log('Vega   curated idx (HIP 91262):', veg, P.starNamed83[veg]);
/* HIP array monotonic? */
let mono = true;
for (let i = 1; i < hi32.length; i++) if (hi32[i] <= hi32[i - 1]) { mono = false; break; }
console.log('HIP array strictly increasing (binary-searchable):', mono);
const hdCount = hd32.reduce((a, x) => a + (x > 0 ? 1 : 0), 0);
console.log('HD ids present:', hdCount);
