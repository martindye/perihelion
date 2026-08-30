import { chromium } from 'playwright-core';
// Decode the app's HIP catalog and find best-match stars near expected (ra, dec) with expected V
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3500);

const result = await page.evaluate(() => {
  const raw = atob(P.starsHip.b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const f = new Float32Array(bytes.buffer, 0, bytes.length / 4);
  const N = P.starsHip.count;
  const d2r = Math.PI / 180;
  const angDist = (ra1, de1, ra2, de2) => {
    const d1 = de1 * d2r, d2 = de2 * d2r;
    const dD = (de2 - de1) * d2r;
    const dL = (ra2 - ra1) * d2r;
    const h = Math.sin(dD / 2) ** 2 + Math.cos(d1 * d2r) * Math.cos(d2 * d2r) * Math.sin(dL / 2) ** 2;
    return 2 * Math.asin(Math.min(1, Math.sqrt(h))) / d2r;
  };
  // candidates: [label, approxRa, approxDec, approxV, searchRadiusDeg]
  const cands = [
    ['Merak d-UMa', 165.46, 56.38, 2.37, 3],
    ['Kochab b-UMi', 222.67, 74.16, 2.08, 3],
    ['Pherkad g-UMi', 230.18, 71.83, 3.05, 3],
    ['Yildun d-UMi', 229.37, 77.79, 4.35, 3],
    ['eps-UMi', 232.69, 75.76, 4.29, 3],
    ['zeta-UMi', 230.88, 77.23, 4.29, 3],
    ['eta-UMi', 219.93, 64.57, 4.73, 3],
    ['Alnasl g-Sgr', 268.57, -29.30, 2.99, 3],
    ['Aspidiske d-Sgr', 272.75, -29.93, 2.70, 3],
    ['KausBorealis l-Sgr', 277.21, -29.80, 2.81, 3],
    ['KausMedia s-Sgr', 283.80, -26.30, 2.05, 3],   // sigma Sgr if Nunki!=sigma
    ['Nunki s-Sgr-alt', 283.80, -26.30, 2.05, 4],
    ['p-Sgr Albaldah', 271.58, -29.88, 3.09, 3],
    ['Kornephoros e-Her', 253.39, 31.59, 3.49, 3],
    ['Sarin z-Her', 250.25, 30.92, 3.74, 3],
    ['Chertan d-Her', 250.92, 26.37, 3.54, 3],
    ['eta-Her', 251.09, 26.95, 3.46, 3],
    ['theta1-Her', 251.55, 29.96, 4.09, 3],
    ['b-CrB', 279.90, 32.44, 2.94, 3],
    ['g-CrB Nehala', 276.68, 31.65, 2.47, 3],
    ['d-CrB', 274.49, 31.88, 3.27, 3],
    ['e-CrB', 273.17, 30.22, 2.72, 3],
    ['h-CrB', 268.04, 32.68, 2.73, 3],
    ['i-CrB', 275.15, 27.49, 3.22, 3],
    /* check what is actually at the two suspect existing rows */
    ['at-old-Nunki-261.71', 261.71, -26.33, 2.05, 1.0],
    ['at-old-Aspidiske', 228.94, -60.23, 2.07, 1.5]
  ];
  const out = [];
  for (const [label, ra, dec, v, rad] of cands) {
    let best = null;
    for (let i = 0; i < N; i++) {
      const sra = f[i * 4], sde = f[i * 4 + 1], sv = f[i * 4 + 2];
      if (sv > 6.5) continue;
      const d = angDist(ra, dec, sra, sde);
      if (d > rad) continue;
      const score = d + Math.abs(sv - v) * 0.3;
      if (!best || score < best.score) best = { score, ra: +sra.toFixed(5), dec: +sde.toFixed(5), v: sv, d: +d.toFixed(3), bv: +f[i * 4 + 3].toFixed(2) };
    }
    out.push({ label, best });
  }
  return out;
});
for (const r of result) console.log(r.label, '=>', JSON.stringify(r.best));
await browser.close();
