// _build/extract-hyg.mjs — distill HYG 4.2 (astronexus, CC BY-SA 4.0) to the
// Bayer + Flamsteed designations we need, keyed by HIP.
// Input : _build/hygdata_v42.csv   (120k rows, ~34 MB, gitignored)
// Output: _build/hyg-bayer-flam.csv (committed, ~200 KB)
// Run: node _build/extract-hyg.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const src = readFileSync(dir + 'hygdata_v42.csv', 'utf8');
const lines = src.split(/\r?\n/).filter(Boolean);
const header = lines[0].split(',').map(s => s.replace(/^"|"$/g, ''));
const c = n => header.indexOf(n);

let out = 'hip,hd,bayer,flam,con\n', n = 0, noHip = 0;
for (let i = 1; i < lines.length; i++) {
  const f = lines[i].split(',').map(s => s.replace(/^"|"$/g, ''));
  const bayer = f[c('bayer')] || '', flam = f[c('flam')] || '';
  if (!bayer && !flam) continue;
  const hip = f[c('hip')] || '';
  if (!/^\d+$/.test(hip) || +hip === 0) { noHip++; continue; }
  out += [hip, f[c('hd')] || '', bayer, flam, f[c('con')] || ''].join(',') + '\n';
  n++;
}
writeFileSync(dir + 'hyg-bayer-flam.csv', out);
console.log(`wrote ${n} designation rows (skipped ${noHip} without HIP) -> _build/hyg-bayer-flam.csv`);
