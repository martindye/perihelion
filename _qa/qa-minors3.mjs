import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.evaluate(() => { P.app.togglePause(); P.app.setMode('solar'); });
await page.waitForTimeout(300);
await page.evaluate(() => {
  const d = P.app._dbg;
  d.state.follow = 'Jupiter';
  // put the camera on the sun-side of Jupiter: dir from Jupiter toward the Sun
  const j = d.solar.meshes.Jupiter.position;
  const l = Math.hypot(j.x, j.y, j.z);
  const dx = -j.x / l, dy = -j.y / l, dz = -j.z / l;
  d.cam.yaw = Math.atan2(dz, dx);
  d.cam.pitch = Math.asin(dy);
  d.cam.dist = 6.5;
  d.cam.viewAnim = null;
});
await page.waitForTimeout(800);
await page.screenshot({ path: R + '\\qa-jupiter3.png' });
console.log('LOGS:', JSON.stringify(logs));
await browser.close();
