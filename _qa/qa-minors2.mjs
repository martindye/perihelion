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

/* pause time so the system is static for the shot */
await page.evaluate(() => { P.app.togglePause(); });
await page.evaluate(() => P.app.setMode('solar'));
await page.waitForTimeout(400);
await page.evaluate(() => {
  P.app._dbg.state.follow = 'Jupiter';
});
/* zoom in until the camera is ~5-7 units from Jupiter */
await page.mouse.move(800, 450);
for (let i = 0; i < 14; i++) {
  const dcam = await page.evaluate(() => {
    const d = P.app._dbg;
    return d.camera.position.distanceTo(d.solar.meshes.Jupiter.position);
  });
  if (dcam < 6) break;
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(150);
}
await page.waitForTimeout(700);
const probe = await page.evaluate(() => {
  const d = P.app._dbg;
  const j = d.solar.meshes.Jupiter.position;
  return {
    follow: d.state.follow,
    target: [+d.camera.position.distanceTo(j).toFixed(3), 'dist-cam-to-jup'],
    camDist: d.camera.fov,
    jup: [ +j.x.toFixed(2), +j.y.toFixed(2), +j.z.toFixed(2) ],
    io: d.solar.meshes.Io.position.toArray().map(v => +v.toFixed(2)),
    gan: d.solar.meshes.Ganymede.position.toArray().map(v => +v.toFixed(2)),
    labels: [...document.querySelectorAll('.label')].map(e => e.textContent).slice(0, 40)
  };
});
console.log('PROBE:', JSON.stringify(probe, null, 1));
await page.screenshot({ path: R + '\\qa-jupiter2.png' });

/* full-system shot: follow Sun, zoom out wide */
await page.evaluate(() => { P.app._dbg.state.follow = 'Sun'; });
for (let i = 0; i < 8; i++) {
  const dcam = await page.evaluate(() => P.app._dbg.camera.position.length());
  if (dcam > 220) break;
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(400);
await page.screenshot({ path: R + '\\qa-solar-full2.png' });
console.log('LOGS:', JSON.stringify(logs));
await browser.close();
