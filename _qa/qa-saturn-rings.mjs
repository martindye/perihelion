/* QA — Saturn ring texture (radial strip, alpha bands, Cassini division).
 * Run from the _qa dir:  node _qa/qa-saturn-rings.mjs */
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

/* enter solar mode, follow Saturn at close range */
await page.evaluate(() => P.app.setMode('solar'));
await page.waitForTimeout(400);
await page.evaluate(() => {
  const app = P.app, d = P.app._dbg;
  app.state.follow = 'Saturn';
  const pl = P.planets.find(p => p.name === 'Saturn');
  d.cam.dist = Math.max(6, pl.size * 4.2);
});
await page.waitForTimeout(500);
await page.waitForTimeout(2000);   /* lazy <img> decode + upload */

/* --- geometry: annulus span + radial UVs ------------------------------- */
const geo = await page.evaluate(() => {
  const d = P.app._dbg;
  const size = P.planets.find(p => p.name === 'Saturn').size;
  const ring = d.solar.ringMeshes['Saturn'];
  if (!ring) return null;
  const p = ring.geometry.attributes.position, uv = ring.geometry.attributes.uv;
  let rmin = 1e9, rmax = -1e9, uMin = 1e9, uMax = -1e9, vSet = null;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    rmin = Math.min(rmin, r); rmax = Math.max(rmax, r);
    uMin = Math.min(uMin, uv.getX(i)); uMax = Math.max(uMax, uv.getX(i));
    if (vSet === null) vSet = uv.getY(i); else if (Math.abs(vSet - uv.getY(i)) > 1e-6) vSet = 'mixed';
  }
  /* u must correlate with radius: sample an inner vertex and an outer one */
  let innerU = null, outerU = null, innerR = 1e9, outerR = -1e9;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    if (r < innerR) { innerR = r; innerU = uv.getX(i); }
    if (r > outerR) { outerR = r; outerU = uv.getX(i); }
  }
  return { size, rmin, rmax, uMin, uMax, vSet, innerR, innerU, outerR, outerU };
});
ok(geo, 'ring mesh exists for Saturn');
if (geo) {
  const IN = 1.25 * geo.size, OUT = 2.33 * geo.size;
  ok(Math.abs(geo.rmin - IN) < 1e-3, `annulus inner = 1.25 R (got ${geo.rmin.toFixed(3)}, want ${IN.toFixed(3)})`);
  ok(Math.abs(geo.rmax - OUT) < 1e-3, `annulus outer = 2.33 R (got ${geo.rmax.toFixed(3)}, want ${OUT.toFixed(3)})`);
  ok(geo.innerU < 0.05 && geo.outerU > 0.95, `u tracks radius (inner u=${geo.innerU.toFixed(3)} @r=${geo.innerR.toFixed(2)}, outer u=${geo.outerU.toFixed(3)} @r=${geo.outerR.toFixed(2)})`);
}

/* --- texture applied? --------------------------------------------------- */
const tex = await page.evaluate(() => {
  const d = P.app._dbg;
  const ring = d.solar.ringMeshes['Saturn'];
  const m = ring.material;
  return {
    hasMap: !!(m.map && m.map.image),
    imgW: m.map && m.map.image ? (m.map.image.width || 0) : 0,
    imgH: m.map && m.map.image ? (m.map.image.height || 0) : 0,
    minFilter: m.map ? m.map.minFilter : null
  };
});
ok(tex.hasMap, `ring has photo map (phong/basic map present)`);
ok(tex.imgW === 2048 && tex.imgH === 125, `ring map is the 2048x125 strip (got ${tex.imgW}x${tex.imgH})`);
ok(tex.minFilter === 1006, `minFilter is LinearFilter (NPOT-safe, got ${tex.minFilter})`);
/* planet itself still has its map too */
const saturnTex = await page.evaluate(() => {
  const m = P.app._dbg.solar.meshes['Saturn'].material;
  return !!(m.map && m.map.image);
});
ok(saturnTex, 'Saturn body still has its photo map');

await page.screenshot({ path: R + '\\qa-saturn-rings.png' });

console.log('errors:', JSON.stringify(errs.slice(0, 5)));
console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
