/* Debug: identify the buffer stars that sit on top of named stars (HIP compare) */
import { readFileSync } from 'fs';
const base = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/';
global.window = global;
global.P = {};
for (const f of ['js/data.js', 'js/stars-hip.js', 'js/stars-named.js'])
  (0, eval)('var P = global.P;\n' + readFileSync(base + f, 'utf8').replace(/window\.P = window\.P \|\| \{\};?/g, ''));
const P = global.P;
const buf = new Uint8Array(Buffer.from(P.starsHip.b64, 'base64'));
const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const N = f.length / 4;
const hipB = new Uint8Array(Buffer.from(P.starIds.hip, 'base64'));
const hip = new Int32Array(hipB.buffer, hipB.byteOffset, hipB.byteLength / 4);
console.log('N', N, 'hip len', hip.length);
const D = Math.PI / 180;
for (let si = 0; si < P.stars.length; si++) {
  const [name, ra, dec] = P.stars[si];
  let best = 1e9, bi = -1;
  for (let i = 0; i < N; i++) {
    let dra = Math.abs(f[i * 4] - ra); if (dra > 180) dra = 360 - dra;
    const d = Math.hypot(dra, f[i * 4 + 1] - dec);
    if (d < best) { best = d; bi = i; }
  }
  if (best < 0.02) {
    const refs = P.starNamed83[si] || '';
    const m = refs.match(/HIP (\d+)/);
    console.log(
      name.padEnd(16), 'idx', String(bi).padStart(6), 'dist', best.toFixed(4) + 'deg',
      '| bufferHIP', String(hip[bi]).padStart(7), '| namedHIP', m ? m[1] : 'none',
      '| same:', !!(m && +m[1] === hip[bi])
    );
  }
}
