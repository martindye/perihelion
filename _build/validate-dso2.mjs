import fs from 'node:fs';
const P = { dso: [] };
const src = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/js/dso2.js', 'utf8');
// strip the 'use strict' + run in a context with P
const fn = new Function('P', src.replace(/^'use strict';/m, ''));
fn(P);
const rows = P.dso2;
console.log('bright rows:', rows.length);
let bad = 0;
const types = {};
for (const r of rows) {
  if (r.length !== 12) { console.log('BAD LEN', r[0], r.length); bad++; continue; }
  if (!isFinite(r[1]) || r[1] < 0 || r[1] >= 360) { console.log('BAD RA', r[0], r[1]); bad++; }
  if (!isFinite(r[2]) || r[2] < -90 || r[2] > 90) { console.log('BAD DEC', r[0], r[2]); bad++; }
  if (r[3] != null && (r[3] < 0 || r[3] > 16)) { console.log('BAD MAG', r[0], r[3]); bad++; }
  if (typeof r[4] !== 'string' || !r[4]) { console.log('BAD TYPE', r[0]); bad++; }
  if (!(r[5] > 0) || !(r[6] > 0)) { console.log('BAD SIZE', r[0], r[5], r[6]); bad++; }
  types[r[4]] = (types[r[4]] || 0) + 1;
}
console.log('bad rows:', bad);
console.log('types:', JSON.stringify(types, null, 1));
const m = rows.filter(r => /^M\d+$/.test(r[0]));
console.log('messier rows:', m.length);

/* spot-check coordinates — expected values cross-verified against
   Corwin 2004 (VizieR VII/239A) and the previously-verified reference set;
   M32/M63/M87 are galaxies (live in js/dso.js, not dso2). */
const EXPECT = {
  'M2': [323.36, -0.82], 'M4': [245.897, -26.526], 'M7': [268.447, -34.841],
  'M8': [270.904, -24.387], 'M9': [259.799, -18.516], 'M10': [254.288, -4.10],
  'M11': [282.766, -6.272], 'M12': [251.809, -1.949], 'M15': [322.493, 12.167],
  'M16': [274.688, -13.792], 'M17': [275.196, -16.172], 'M20': [270.63, -23.03],
  'M22': [279.100, -23.905], 'M27': [299.902, 22.721], 'M44': [130.054, 19.621]
};
for (const [id, [era, edec]] of Object.entries(EXPECT)) {
  const r = rows.find(x => x[0] === id);
  if (!r) { console.log('MISSING', id); continue; }
  const dra = Math.abs(r[1] - era), ddec = Math.abs(r[2] - edec);
  const ok = dra < 0.15 && ddec < 0.15;
  console.log(id, 'ra', r[1].toFixed(3), 'dec', r[2].toFixed(3), ok ? 'ok' : '*** CHECK ***');
}

/* faint layer */
const bin = Buffer.from(P.dsoFaint2.b64, 'base64');
const f = new Float32Array(bin.buffer, bin.byteOffset, bin.length / 4);
console.log('faint points:', f.length / 6, '(declared n=' + P.dsoFaint2.n + ')');
let fbad = 0;
for (let i = 0; i < f.length / 6; i++) {
  const ra = f[i * 6], dec = f[i * 6 + 1];
  if (ra < 0 || ra >= 360 || dec < -90 || dec > 90) { fbad++; if (fbad < 4) console.log('FAINT BAD', i, ra, dec); }
}
console.log('faint bad:', fbad);
console.log('common names:', Object.keys(P.dso2Common).length, ' sample:', JSON.stringify(Object.entries(P.dso2Common).slice(0, 5)));
