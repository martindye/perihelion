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
  const box = (ra0, ra1, dec0, dec1, vmax) => {
    const out = [];
    for (let i = 0; i < N; i++) {
      const ra = f[i * 4], dec = f[i * 4 + 1], v = f[i * 4 + 2];
      if (v > vmax) continue;
      let d = ra;
      if (d < ra0) d += 360;
      if (d >= ra0 && d < ra1 && dec >= dec0 && dec < dec1) out.push({ ra: +ra.toFixed(3), dec: +dec.toFixed(3), v: +v.toFixed(2), bv: +f[i * 4 + 3].toFixed(2) });
    }
    out.sort((a, b) => a.v - b.v);
    return out;
  };
  return {
    sgr: box(266, 292, -40, -20, 3.6),
    umi: box(214, 236, 58, 88, 4.9),
    crb: box(264, 284, 24, 36, 4.0),
    her: box(246, 256, 24, 34, 4.2)
  };
});
console.log('SAGITTARIUS (teapot region, V<3.6):');
for (const s of result.sgr) console.log(' ', JSON.stringify(s));
console.log('\nURSA MINOR (V<4.9):');
for (const s of result.umi) console.log(' ', JSON.stringify(s));
console.log('\nCORONA BOREALIS (V<4.0):');
for (const s of result.crb) console.log(' ', JSON.stringify(s));
console.log('\nHERCULES keystone region (V<4.2):');
for (const s of result.her) console.log(' ', JSON.stringify(s));
await browser.close();
