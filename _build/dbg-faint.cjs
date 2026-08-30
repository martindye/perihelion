const fs = require('fs');
const src = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/js/dso.js', 'utf8');
const m = src.match(/b64: "([^"]+)"/);
const bin = Buffer.from(m[1], 'base64');
const f32 = new Float32Array(bin.buffer, bin.byteOffset, bin.length / 4);
console.log('total floats:', f32.length, ' rows:', f32.length / 6);
// size = index 3 within each 6-float row; collect stats
let mn = 1e9, mx = 0, sum = 0; const sample = [];
for (let i = 0; i < f32.length / 6; i++) {
  const s = f32[i * 6 + 3];
  if (s < mn) mn = s; if (s > mx) mx = s; sum += s;
  if (i < 8 || (i % 20000 === 0)) sample.push(s);
}
console.log('size min/max/mean:', mn, mx, (sum / (f32.length / 6)).toFixed(2));
console.log('samples:', sample);
// also magnitudes
let vmn = 1e9, vmx = -1e9;
for (let i = 0; i < f32.length / 6; i++) { const v = f32[i * 6 + 2]; if (v < vmn) vmn = v; if (v > vmx) vmx = v; }
console.log('mag range:', vmn, vmx);
