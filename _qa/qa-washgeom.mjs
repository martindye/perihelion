import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);

const result = await page.evaluate(() => {
  const T = THREE;
  const dbg = P.app._dbg;
  const gw = dbg.sky.galaxyWash;
  if (!gw) return { err: 'no galaxyWash' };
  const pos = gw.geometry.getAttribute('position');
  const uv = gw.geometry.getAttribute('uv');
  const out = { count: pos.count, verts: [] };
  // world -> equatorial: world=(e0*R, e2*R, -e1*R) => e=(wx, -wz, wy)/R
  const toEq = (i) => {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, y, z);
    const ex = x / r, ey = -z / r, ez = y / r;
    const ra = (Math.atan2(ey, ex) * 180 / Math.PI + 360) % 360;
    const dec = Math.asin(Math.max(-1, Math.min(1, ez))) * 180 / Math.PI;
    return { ra: +ra.toFixed(2), dec: +dec.toFixed(2), r: +r.toFixed(1) };
  };
  // rows: vertex index = i * 5 + j (NW+1 columns × 5 rows)
  const ROWS = [7, 3.5, 0, -3.5, -7];
  for (const i of [0, 1, 8, 48, 96, 97]) {
    for (let j = 0; j < 5; j++) {
      const k = i * 5 + j;
      const e = toEq(k);
      out.verts.push({ i, j, rowB: ROWS[j], ra: e.ra, dec: e.dec, r: e.r });
    }
  }
  /* galactic check: dec of (l=0) vertex row b=0 must be ≈ -28.9 */
  return out;
});
console.log(JSON.stringify(result, null, 1));
console.log('ERRORS:', JSON.stringify(errors.slice(0, 6)));
await browser.close();
