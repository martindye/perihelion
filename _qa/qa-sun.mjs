/* QA — Sun: photo surface map + rotation (25.38 d spin).
 * Run from the _qa dir:  node _qa/qa-sun.mjs */
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(2500);

/* solar mode, follow the Sun close in */
await page.evaluate(() => {
  P.app.setMode('solar');
  P.app.state.follow = 'Sun';
  P.app._dbg.cam.dist = 9;
});
await page.waitForTimeout(500);
await page.waitForTimeout(1500);   /* lazy <img> decode + upload */

/* 1) the photo map is applied to the sun */
const tex = await page.evaluate(() => {
  const m = P.app._dbg.solar.sun.material;
  return {
    hasMap: !!(m.map && m.map.image),
    imgW: m.map && m.map.image ? m.map.image.width : 0,
    imgH: m.map && m.map.image ? m.map.image.height : 0,
    basic: m.type === 'MeshBasicMaterial'
  };
});
ok(tex.hasMap && tex.imgW === 2048 && tex.imgH === 1024, `sun has 2048x1024 photo map (got ${tex.imgW}x${tex.imgH}, basic=${tex.basic})`);

/* 2) it rotates: PAUSE the sim, advance by exactly 1/4 of a 25.38 d
     rotation, expect the mesh spin to advance by exactly TAU/4. The planets
     (same 1 d jump) must move by their own 2π/0.997. */
await page.evaluate(() => { P.app.state.playing = false; });
await page.waitForTimeout(150);
const s0 = await page.evaluate(() => ({
  sun: P.app._dbg.solar.sun.rotation.y,
  earth: P.app._dbg.solar.meshes['Earth'].rotation.y
}));
await page.evaluate(() => { P.app.state.simTimeMs += (25.38 / 4) * 86400000; });
await page.waitForTimeout(200);
const s1 = await page.evaluate(() => ({
  sun: P.app._dbg.solar.sun.rotation.y,
  earth: P.app._dbg.solar.meshes['Earth'].rotation.y
}));
const wrap = a => { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; };
const dR = wrap(s1.sun - s0.sun);
const dE = wrap(s1.earth - s0.earth);
ok(Math.abs(dR - Math.PI / 2) < 0.02, `sun spins 90° in 6.345 d (Δ ${(dR * 180 / Math.PI).toFixed(2)}°)`);
const eWant = wrap((6.345 / 0.997) * Math.PI * 2);
ok(Math.abs(dE - eWant) < 0.05, `Earth spins with the same jump (Δ ${(dE * 180 / Math.PI).toFixed(1)}°, want ${(eWant * 180 / Math.PI).toFixed(1)}°)`);
await page.evaluate(() => { P.app.state.playing = true; });

await page.evaluate(() => { P.app._dbg.cam.dist = 12; P.app.state.follow = 'Sun'; });
await page.waitForTimeout(300);
await page.screenshot({ path: R + '\\qa-sun.png' });

console.log('errors:', JSON.stringify(errs.slice(0, 5)));
console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
