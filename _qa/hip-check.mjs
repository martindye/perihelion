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
  const n = bytes.length;
  const f = new Float32Array(bytes.buffer, 0, Math.floor(n / 4));
  const N = P.starsHip.count;
  const out = { b64len: P.starsHip.b64.length, bytesLen: n, bytesMod4: n % 4, floats: f.length, declaredN: N };
  // RA histogram over the whole (valid) array
  const hist = new Array(24).fill(0);
  let valid = 0, bad = 0;
  const step = Math.max(1, Math.floor(f.length / 4 / 1000));
  for (let i = 0; i < f.length; i += 4 * step) {
    const ra = f[i], dec = f[i + 1], v = f[i + 2];
    if (!isFinite(ra) || !isFinite(dec) || !isFinite(v) || ra < 0 || ra > 360 || dec < -90 || dec > 90 || v < -1 || v > 12) { bad++; continue; }
    valid++;
    hist[Math.min(23, Math.floor(ra / 15))]++;
  }
  out.hist = hist;
  out.validSampled = valid; out.badSampled = bad;
  // last 6 valid records
  const tail = [];
  for (let i = f.length - 4; i >= 0 && tail.length < 6; i -= 4) {
    const ra = f[i], dec = f[i + 1], v = f[i + 2];
    if (isFinite(ra) && isFinite(dec) && isFinite(v) && ra >= 0 && ra <= 360 && dec >= -90 && dec <= 90 && v > 0) tail.push({ ra: +ra.toFixed(2), dec: +dec.toFixed(2), v: +v.toFixed(2) });
  }
  out.tail = tail;
  // search Yildun specifically: ra 228-231, dec 77-79, v<6.5
  const y = [];
  for (let i = 0; i < f.length; i += 4) {
    const ra = f[i], dec = f[i + 1], v = f[i + 2];
    if (ra >= 227 && ra <= 232 && dec >= 76 && dec <= 80 && isFinite(v) && v < 6.5) y.push({ ra: +ra.toFixed(4), dec: +dec.toFixed(4), v: +v.toFixed(2) });
  }
  out.yildunRegion = y;
  return out;
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
