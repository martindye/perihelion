/* QA — Phase 5 (planet close-ups with photo textures + chase camera) and
 * Phase 6 (catalog vs detail-pane overlap). Run: node _qa/qa-planetzoom.mjs */
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

/* ---- Phase 5: solar close-up with photo texture -------------------------- */
await page.evaluate(() => P.app.setMode('solar'));
await page.waitForTimeout(400);
/* follow Earth, close-up */
await page.evaluate(() => {
  const app = P.app, d = P.app._dbg;
  app.state.follow = 'Earth';
  const pl = P.planets.find(p => p.name === 'Earth');
  d.cam.dist = Math.max(4, pl.size * 5);
});
await page.waitForTimeout(400);
/* give the lazy <img> textures a moment to decode + upload */
await page.waitForTimeout(1500);

const tex = await page.evaluate(() => {
  const m = P.app._dbg.solar.meshes['Earth'].material;
  return {
    isPhong: m.type === 'MeshPhongMaterial',
    hasMap: !!(m.map && m.map.image),
    imgW: m.map && m.map.image ? (m.map.image.width || 0) : 0
  };
});
ok(tex.isPhong && tex.hasMap, `Earth has a photo map applied (phong=${tex.isPhong}, map=${tex.hasMap})`);
ok(tex.imgW >= 2048, `Earth texture is 2K-wide (got ${tex.imgW}px)`);

/* camera is tracking Earth (chase) at close range */
const chase = await page.evaluate(() => {
  const d = P.app._dbg;
  const p = d.solar.meshes['Earth'].position, c = d.cam.target;
  return { off: Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y), Math.abs(p.z - c.z)), dist: d.cam.dist };
});
ok(chase.off < 0.5, `chase camera tracks Earth (offset ${chase.off.toFixed(3)})`);
ok(chase.dist < 8, `close-up distance is a few radii (dist ${chase.dist.toFixed(1)})`);
await page.screenshot({ path: R + '\\qa-planet-earth-closeup.png' });

/* texture applied to the other bodies too (Moon lives on moonMesh) */
const others = await page.evaluate(() => {
  const s = P.app._dbg.solar, o = {};
  for (const n of ['Jupiter', 'Saturn', 'Mars', 'Venus'])
    o[n] = !!(s.meshes[n] && s.meshes[n].material.map);
  o.Moon = !!(s.moonMesh.material && s.moonMesh.material.map);
  return o;
});
ok(others.Jupiter && others.Saturn && others.Mars && others.Venus && others.Moon,
  `Jupiter/Saturn/Mars/Venus/Moon textured (${JSON.stringify(others)})`);

/* the radial scale must be ORDER-CORRECT: scene radius strictly increases
   with heliocentric AU (the old /wl bug flipped it: Mercury outside Neptune) */
const order = await page.evaluate(() => {
  const s = P.app._dbg.solar;
  const rows = P.planets
    .map(pl => [pl.au, s.meshes[pl.name].position.length()])
    .sort((a, b) => a[0] - b[0]);
  let ok = true;
  for (let i = 1; i < rows.length; i++) if (!(rows[i][1] > rows[i - 1][1])) ok = false;
  return { ok, rows: rows.map(r => [r[0], Math.round(r[1])]) };
});
ok(order.ok, `orbit radii strictly increase with AU (Mercury…Neptune: ${order.rows.map(r => r[1]).join(' < ')})`);
const gaps = await page.evaluate(() => {
  const s = P.app._dbg.solar;
  const rad = n => s.meshes[n].position.length();
  return { su: rad('Uranus') - rad('Saturn'), un: rad('Neptune') - rad('Uranus') };
});
ok(gaps.su > 30 && gaps.un > 30, `Saturn/Uranus/Neptune well separated (gaps ${Math.round(gaps.su)}/${Math.round(gaps.un)} scene units)`);

/* star dome = infinite sky in solar mode: 50x radius (5000, inside the 6000
   far plane) AND riding the camera, so even fully zoomed out the far side of
   the dome is 5000 from the eye (not 4000+5000=9000 > far plane) — no
   clipped "hole" in the stars. Sky mode: unit scale at the origin. */
await page.evaluate(() => { P.app._dbg.cam.dist = 4000; });   // fully zoomed out
await page.waitForTimeout(200);
const domeSolar = await page.evaluate(() => {
  const d = P.app._dbg;
  return {
    scale: d.sky.dome.scale.x,
    chase: d.sky.dome.position.distanceTo(d.camera.position),
    far: d.camera.far
  };
});
ok(Math.abs(domeSolar.scale - 50) < 1e-6, `solar: star dome at 50x (infinity) — got ${domeSolar.scale}`);
ok(domeSolar.chase < 0.01, `solar: dome rides the camera (gap ${domeSolar.chase.toFixed(4)}) — stars can't clip`);
ok(domeSolar.scale * 100 < domeSolar.far - 100, `stars always inside far plane (5000 < ${domeSolar.far})`);
await page.evaluate(() => { P.app._dbg.cam.dist = 200; P.app.setMode('sky'); });
await page.waitForTimeout(300);
const domeSky = await page.evaluate(() => {
  const d = P.app._dbg;
  return { scale: d.sky.dome.scale.x, atOrigin: Math.hypot(d.camera.position.x, d.camera.position.y, d.camera.position.z) };
});
ok(Math.abs(domeSky.scale - 1) < 1e-6, `sky: star dome back to 1x — got ${domeSky.scale}`);
ok(domeSky.atOrigin < 0.01, 'sky: camera at origin (dome unchanged)');
await page.evaluate(() => P.app.setMode('solar'));
await page.waitForTimeout(300);

/* JWST (L2, hugging Earth's orbit) must sit clearly outside the Earth mesh:
   >2.0 scene units from Earth's centre and smaller than the planet */
const jwst = await page.evaluate(() => {
  const s = P.app._dbg.solar;
  const e = s.meshes['Earth'].position, j = s.meshes['JWST'].position;
  const d = Math.hypot(j.x - e.x, j.y - e.y, j.z - e.z);
  const sz = P.probes.probes.find(p => p.name === 'JWST').size;
  return { dist: Math.round(d * 100) / 100, earthD: 2 * 0.9, jwstW: 2 * 1.15 * sz * 2.5 };
});
ok(jwst.dist > 1.9, `JWST clearly outside Earth (centre distance ${jwst.dist} > 1.9, Earth radius 0.9)`);
ok(jwst.jwstW < jwst.earthD, `JWST smaller than Earth (w ${jwst.jwstW.toFixed(2)} < ${jwst.earthD})`);

/* ---- Phase 6: catalog vs detail pane never overlap ------------------------ */
await page.click('#tg-catalog'); await page.waitForTimeout(250);
/* open a selection so the detail pane is visible */
await page.fill('#cat-search', 'jupiter'); await page.waitForTimeout(250);
await page.click('.cat-row'); await page.waitForTimeout(300);
const overlap = await page.evaluate(() => {
  const a = document.getElementById('catalog').getBoundingClientRect();
  const b = document.getElementById('infopanel').getBoundingClientRect();
  const inter = !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  return {
    overlap: inter,
    infoVisible: document.getElementById('infopanel').style.display !== 'none',
    a: [a.left, a.top, a.right, a.bottom].map(Math.round),
    b: [b.left, b.top, b.right, b.bottom].map(Math.round)
  };
});
ok(overlap.infoVisible, 'detail pane is open after selecting a result');
ok(!overlap.overlap, `catalog & detail pane do NOT overlap (catalog=${JSON.stringify(overlap.a)} info=${JSON.stringify(overlap.b)})`);
await page.screenshot({ path: R + '\\qa-planetzoom-layout.png' });

/* second viewport (1920x1080) */
await page.setViewportSize({ width: 1920, height: 1080 });
await page.waitForTimeout(200);
const ov2 = await page.evaluate(() => {
  const a = document.getElementById('catalog').getBoundingClientRect();
  const b = document.getElementById('infopanel').getBoundingClientRect();
  return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
});
ok(!ov2, 'no overlap at 1920x1080 either');

console.log('errors:', JSON.stringify(errs.slice(0, 5)));
console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
