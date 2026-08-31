/* Read the Saturn ring strip's radial (alpha + brightness) profile numerically.
 * Reports the exact inner/outer opaque columns so the 3D annulus can be mapped
 * to the strip precisely. Run from the _qa dir (needs playwright-core):
 *   node _qa/ring-strip-probe.mjs */
import { chromium } from 'playwright-core';

const ROOT = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const FILE = ROOT + 'textures/saturn-rings.png';

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const b64 = (await import('node:fs')).readFileSync(FILE).toString('base64');

const profile = await page.evaluate(async (src) => {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('img load failed'));
    i.src = src;
  });
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  // Per-column: average alpha and average brightness across the height.
  const col = new Array(W);
  for (let x = 0; x < W; x++) {
    let a = 0, lum = 0;
    for (let y = 0; y < H; y++) {
      const o = (y * W + x) * 4;
      a += d[o + 3];
      lum += (d[o] + d[o + 1] + d[o + 2]) / 3;
    }
    col[x] = { a: a / H, l: lum / H };
  }
  return { W, H, col };
}, 'data:image/png;base64,' + b64);

await browser.close();
const { W, H, col } = profile;
console.log('strip', W + 'x' + H);

const THRESH = 8; // alpha considered "material present"
let first = -1, last = -1;
for (let x = 0; x < W; x++) { if (col[x].a > THRESH) { if (first < 0) first = x; last = x; } }
console.log('first material col :', first, '(' + (100 * first / W).toFixed(2) + '%)');
console.log('last   material col:', last, '(' + (100 * last / W).toFixed(2) + '%)');

// Where is the brightest sustained band (the B ring)? scan for the global max region.
let maxL = -1, maxX = 0;
for (let x = first; x <= last; x++) if (col[x].a > THRESH && col[x].l > maxL) { maxL = col[x].l; maxX = x; }
console.log('brightest col      :', maxX, '(' + (100 * maxX / W).toFixed(2) + '%) lum=' + maxL.toFixed(0));

// Detect the Cassini division: within the material span, the local alpha minimum
// that is a deep, wide trough (alpha drops sharply vs neighbours).
let cassX = -1, cassA = 1e9;
for (let x = first + 20; x < last - 20; x++) {
  const a = col[x].a;
  if (a < cassA) { cassA = a; cassX = x; }
}
console.log('deepest interior gap:', cassX, '(' + (100 * cassX / W).toFixed(2) + '%) alpha=' + cassA.toFixed(1));

// Downsampled profile (64 samples across the material span) for a sanity eyeball.
const N = 64, lo = first, hi = last;
console.log('--- downsampled profile (alpha / lum), ' + N + ' steps across material ---');
for (let i = 0; i < N; i++) {
  const x = Math.round(lo + (hi - lo) * i / (N - 1));
  const c = col[x];
  const a = c.a, l = c.l;
  const bar = '#'.repeat(Math.max(0, Math.round(a / 8)));
  console.log(
    String(Math.round(100 * x / W)).padStart(5) + '%  a=' +
    String(a.toFixed(0)).padStart(4) + ' l=' + String(l.toFixed(0)).padStart(4) + '  ' + bar
  );
}
