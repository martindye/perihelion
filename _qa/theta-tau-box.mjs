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
  const box = (ra0, ra1, dec0, dec1, vmax) => {
    const out = [];
    for (let i = 0; i < N; i++) {
      const ra = f[i * 4], dec = f[i * 4 + 1], v = f[i * 4 + 2];
      if (v > vmax) continue;
      if (ra >= ra0 && ra < ra1 && dec >= dec0 && dec < dec1) out.push({ ra: +ra.toFixed(4), dec: +dec.toFixed(4), v: +v.toFixed(2) });
    }
    out.sort((a, b) => a.v - b.v);
    return out;
  };
  return {
    nearAldebaran: box(60, 78, 12, 20, 4.2),      // theta Tauri candidate zone A (wiki coords)
    myMemoryZone: box(70, 78, 18, 25, 4.2),        // theta Tauri candidate zone B (my memory)
    around84: box(80, 90, 18, 26, 4.2)             // zeta Tau / Pleiades region
  };
});
console.log('near (60-78, 12-20):'); for (const s of r.nearAldebaran) console.log('  ', JSON.stringify(s));
console.log('zone (70-78, 18-25):'); for (const s of r.myMemoryZone) console.log('  ', JSON.stringify(s));
console.log('zone (80-90, 18-26):'); for (const s of r.around84) console.log('  ', JSON.stringify(s));
await browser.close();
