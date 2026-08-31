/* Verify js/probes.js integrity + T0 position reconstruction. */
import { readFileSync } from 'fs';
global.window = global; global.P = {};
(0, eval)(readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/js/probes.js', 'utf8')
  .replace(/window\.P = window\.P \|\| \{\};?/g, ''));
const P = global.P;
const AU = 1.495978707e8;
console.log('probes:', P.probes.probes.length, ' t0:', P.probes.t0);
let bad = 0;
for (const p of P.probes.probes) {
  const ep = Buffer.from(p.ep, 'base64'), st = Buffer.from(p.st, 'base64');
  const epN = ep.length / 4, stN = st.length / 24;
  const okLen = epN === stN && stN === p.n;
  if (!okLen) bad++;
  // state nearest T0 (epoch 0): binary search ep (Int32 seconds from T0)
  const E = new Int32Array(ep.buffer, ep.byteOffset, epN), S = new Float32Array(st.buffer, st.byteOffset, stN * 6);
  let best = 0;
  for (let k = 0; k < epN; k++) if (Math.abs(E[k]) < Math.abs(E[best])) best = k;
  const r = Math.hypot(S[best * 6], S[best * 6 + 1], S[best * 6 + 2]) / AU;
  console.log(p.name.padEnd(18), 'n=' + p.n, okLen ? 'OK ' : 'BAD', ' r(T0±dt)=' + r.toFixed(3) + ' AU  e=' + p.el.e.toPrecision(4) + (p.el.hyper ? ' (hyper)' : ''));
}
console.log(bad ? bad + ' MISMATCHES' : '=== all b64 blocks consistent ===');
