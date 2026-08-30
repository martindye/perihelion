import { chromium } from 'playwright-core';
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
  const ang = (a1, b1, a2, b2) => {
    const h = Math.sin((b2 - b1) * d2r / 2) ** 2 + Math.cos(b1 * d2r) * Math.cos(b2 * d2r) * Math.sin((a2 - a1) * d2r / 2) ** 2;
    return 2 * Math.asin(Math.min(1, Math.sqrt(h))) / d2r;
  };
  /* [label, approxRa, approxDec, approxV, radiusDeg] */
  const cands = [
    /* Taurus */
    ['Merga t-Tau', 73.48, 21.58, 2.99, 3.0],
    ['Tianguan z-Tau', 82.35, 21.65, 3.52, 3.0],
    ['Alcyone eta-Tau', 84.05, 24.11, 2.87, 1.5],
    /* Leo */
    ['Adhafera m-Leo', 153.56, 23.42, 3.46, 2.5],
    ['RasElasus z-Leo', 156.69, 23.77, 3.88, 2.5],
    ['Zosma d-Leo', 177.26, 15.43, 2.53, 2.5],
    ['Chertan e-Leo', 193.51, 19.84, 3.33, 2.5],
    ['Algenubi th-Leo', 155.78, 20.55, 3.91, 2.5],
    /* Scorpius */
    ['Dschubba b-Sco', 237.89, -22.62, 2.32, 2.5],
    ['Fang d-Sco', 241.36, -19.81, 2.56, 2.5],
    ['Larawag e-Sco', 247.55, -28.22, 2.89, 2.5],
    ['Sargas g-Sco', 264.33, -43.00, 1.86, 1.5],
    ['Shaula l-Sco', 263.40, -37.10, 1.62, 1.5],
    ['Lesath e-Sco', 264.33, -37.30, 2.29, 1.5],
    /* Aries */
    ['Hamal a-Ari', 32.57, 23.46, 2.00, 2.5],
    ['Sheratan b-Ari', 43.20, 20.82, 2.64, 2.5],
    ['Mesarthim g-Ari', 59.85, 19.29, 2.69, 2.5],
    /* Gemini */
    ['Castor a-Gem', 113.65, 31.888, 1.58, 2.5],
    ['Mebsuta a-Gem', 111.02, 25.13, 2.98, 2.5],
    ['Wasat u-Gem', 103.19, 21.98, 3.53, 2.5],
    /* Virgo */
    ['Heze g-Vir', 200.98, 3.61, 2.98, 2.5],
    ['Alcor e-Vir', 209.57, 10.95, 3.38, 2.5],
    ['Vindemiatrix b-Vir', 191.23, 10.96, 2.83, 2.5],
    ['Auva m-Vir', 217.60, -0.64, 3.38, 2.5]
  ];
  const out = [];
  for (const [label, ra, dec, v, rad] of cands) {
    let best = null;
    for (let i = 0; i < N; i++) {
      const sra = f[i * 4], sde = f[i * 4 + 1], sv = f[i * 4 + 2];
      if (sv > 6.5) continue;
      const d = ang(ra, dec, sra, sde);
      if (d > rad) continue;
      const score = d + Math.abs(sv - v) * 0.3;
      if (!best || score < best.score) best = { score: +score.toFixed(3), ra: +sra.toFixed(4), dec: +sde.toFixed(4), v: +sv.toFixed(2), d: +d.toFixed(3), bv: +f[i * 4 + 3].toFixed(2) };
    }
    out.push({ label, best });
  }
  return out;
});
for (const r of result) console.log(r.label, '=>', JSON.stringify(r.best));
await browser.close();
