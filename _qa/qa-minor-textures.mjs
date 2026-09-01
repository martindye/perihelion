/* QA — minor-planet/moon textures + closer zoom (items 4+5 of the batch).
 *   1. all 20 bodies get a surface map of the right size
 *   2. wheel dolly can reach a surface close-up (dist floor = 1.15 x radius)
 *   3. catalog fly-to uses the 5x-size close-up for dwarfs & moons
 * Run from the _qa dir:  node _qa/qa-minor-textures.mjs */
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };

const BODIES = ['Pluto', 'Ceres', 'Vesta', 'Pallas', 'Hygiea', 'Ixion', 'Eris', 'Haumea', 'Makemake',
  'Io', 'Europa', 'Ganymede', 'Callisto', 'Titan', 'Triton', 'Iapetus', 'Rhea',
  'Phobos', 'Deimos', 'Charon'];

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(2000);

await page.evaluate(() => { P.app.setMode('solar'); });
await page.waitForTimeout(4000);   /* 20 lazy <img> decodes + uploads */

/* 1) every body has its map at the right resolution */
const tex = await page.evaluate((bodies) => {
  const out = {};
  for (const b of bodies) {
    const m = P.app._dbg.solar.meshes[b];
    const mat = m && m.material;
    out[b] = mat && mat.map && mat.map.image
      ? mat.map.image.width + 'x' + mat.map.image.height : null;
  }
  return out;
}, BODIES);
let badTex = 0;
for (const b of BODIES) {
  const want = b === 'Pluto' ? '2048x1024' : '1024x512';
  if (tex[b] !== want) { badTex++; console.log('   ', b, ':', tex[b], 'want', want); }
}
ok(badTex === 0, 'all 20 maps applied at expected resolution (' + (20 - badTex) + '/20)');

/* 2) zoom floor: follow Pluto, dolly hard in, must stop at 1.15x radius */
await page.evaluate(() => {
  const d = P.app._dbg;
  d.cam.target.set(0, 0, 0);
  P.app.state.follow = 'Pluto';
  d.cam.dist = 5;
});
for (let i = 0; i < 40; i++) {
  await page.mouse.move(800, 450);
  await page.mouse.wheel(0, -120);   /* negative delta = dolly in */
  await page.waitForTimeout(10);
}
await page.waitForTimeout(150);
const zoom = await page.evaluate(() => {
  const d = P.app._dbg;
  const r = d.solar.meshes['Pluto'].geometry.parameters.radius;
  return { dist: d.cam.dist, r: r, floor: r * 1.15 };
});
ok(zoom.dist < zoom.floor * 1.02, `dolly reaches the surface (dist ${zoom.dist.toFixed(3)}, floor ${zoom.floor.toFixed(3)})`);
ok(zoom.dist >= zoom.floor - 1e-6, 'dolly does not go inside the body');
ok(zoom.dist < 1.5, 'close-up is genuinely close (< 1.5 scene units)');

/* 3) catalog fly-to (real UI path): dwarfs & moons get the 5x-size close-up */
async function flyTo(name, wantDist) {
  await page.evaluate(() => { P.app.state.minors = true; P.app.toggleCatalog(true); });
  await page.fill('#cat-search', name);
  await page.waitForTimeout(150);
  await page.evaluate((n) => {
    const row = [...document.querySelectorAll('.cat-row')]
      .find(r => r.querySelector('b') && r.querySelector('b').textContent.trim() === n);
    if (!row) throw new Error('catalog row not found: ' + n);
    row.click();
  }, name);
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => ({ f: P.app.state.follow, d: P.app._dbg.cam.dist }));
  ok(s.f === name && Math.abs(s.d - wantDist) < 0.01,
    `fly-to ${name}: follow=${s.f} dist ${s.d.toFixed(2)} (want ${wantDist.toFixed(2)})`);
}
await flyTo('Pluto', Math.max(1.2, 0.5 * 5));   /* dwarf: 0.5*5 = 2.5 */
await flyTo('Io', Math.max(1.2, 0.1 * 5));      /* moon: 0.1*5 = 0.5 -> floor 1.2 */
await flyTo('Ceres', Math.max(1.2, 0.42 * 5));  /* dwarf: 0.42*5 = 2.1 */

/* screenshots: Pluto close-up + Io close-up (vision reference) */
await page.evaluate(() => {
  const d = P.app._dbg;
  d.cam.dist = 2.5; P.app.state.follow = 'Pluto';
  d.cam.yaw = -0.6; d.cam.pitch = 0.15;
});
await page.waitForTimeout(400);
await page.screenshot({ path: R + '\\qa-pluto-closeup.png' });

await page.evaluate(() => {
  const d = P.app._dbg;
  d.cam.dist = 0.6; P.app.state.follow = 'Io';
  d.cam.yaw = -0.4; d.cam.pitch = 0.1;
});
await page.waitForTimeout(400);
await page.screenshot({ path: R + '\\qa-io-closeup.png' });

console.log('errors:', JSON.stringify(errs.slice(0, 5)));
console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
