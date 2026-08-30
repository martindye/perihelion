import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3500);
const r = await page.evaluate(() => {
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
  const targets = [
    ['Merga', 67.165, 15.871], ['Tianguan', 84.411, 21.143], ['Adhafera', 154.173, 23.417],
    ['Zosma', 168.527, 20.524], ['Denebola', 177.266, 14.572], ['Larawag', 252.541, -34.293],
    ['Lesath', 262.691, -37.296], ['Hamal', 31.793, 23.462], ['Sheratan', 28.660, 20.808],
    ['Mesarthim', 28.383, 19.294], ['Wasat', 110.031, 21.982], ['Heze', 203.673, -0.596],
    ['Vindemiatrix', 195.544, 10.959], ['Auva', 194.0, 3.4], ['Acrab', 241.359, -19.805]
  ];
  const out = [];
  for (const [name, ra, dec] of targets) {
    let best = null;
    for (let i = 0; i < N; i++) {
      const sra = f[i * 4], sde = f[i * 4 + 1], sv = f[i * 4 + 2], bv = f[i * 4 + 3];
      const d = ang(ra, dec, sra, sde);
      if (d > 0.35) continue;
      if (sv > 6.5) continue;
      if (!best || d < best.d) best = { d: +d.toFixed(3), ra: +sra.toFixed(4), dec: +sde.toFixed(4), v: +sv.toFixed(2), bv: +bv.toFixed(2) };
    }
    out.push({ name, best });
  }
  return out;
});
for (const x of r) console.log(x.name.padEnd(14), JSON.stringify(x.best));
await browser.close();
