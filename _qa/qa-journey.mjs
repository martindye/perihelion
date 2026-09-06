/* QA — journeys (J): "Google Maps of the solar neighbourhood"
 *   1) mission maths via quote(): Hail Mary London→τ Ceti ≈ 12–13 yr,
 *      Apollo-class ≈ 3×10⁵ yr
 *   2) full interstellar flight: phase order brief→approach→launch→
 *      cruise→arrive; planets keep moving; arrival = __dest orbit
 *   3) in-system flight London→Pluto: arrival hands off follow=Pluto
 *   4) abort: camera + far plane restored
 * Run from _qa:  node qa-journey.mjs */
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const LONDON = { type: 'city', name: 'London', country: 'GB', lat: 51.5085, lon: -0.1257 };
const TAU = { type: 'star', name: 'Tau Ceti', ra: 26.0214, dec: -15.9396, bv: 1.35, distPc: 3.6502 };
const yrOf = s => parseFloat(String(s).replace(/[^0-9.]/g, ''));

/* ------------------------------------------------- 1) mission maths (quote) */
let q = await page.evaluate(([l, s]) => P.app.journey.quote(l, s, 'hmary'), [LONDON, TAU]);
ok(q.ok, 'quote London→Tau Ceti (Hail Mary) ok: ' + (q.error || q.summary.time));
if (q.ok) {
  const ty = yrOf(q.summary.time);
  ok(ty > 11 && ty < 14, 'Hail Mary ship time ≈ 12 yr (got ' + q.summary.time + ')');
  ok(/0\.99/.test(q.summary.cruise) || /2\.97/.test(q.summary.cruise) || q.summary.cruise.includes('c'),
    'cruise speed shown: ' + q.summary.cruise);
}
q = await page.evaluate(([l, s]) => P.app.journey.quote(l, s, 'apollo'), [LONDON, TAU]);
ok(q.ok, 'quote London→Tau Ceti (Apollo) ok');
if (q.ok) {
  const ty = yrOf(q.summary.time);
  ok(ty > 250000 && ty < 400000, 'Apollo ship time ≈ 3.2e5 yr (got ' + q.summary.time + ')');
}

/* ------------------------------------------- 2) interstellar flight, full run */
const earthBefore = await page.evaluate(() =>
  P.app._dbg.solar.meshes['Earth'].position.toArray());
let camBefore = await page.evaluate(() => P.app._dbg.camera.position.toArray());
let r = await page.evaluate(([f, t]) => P.app.journey.launch(f, t, 'hmary'), [LONDON, TAU]);
ok(r.ok, 'launch London→Tau Ceti: ' + (r.error || (r.summary && r.summary.time)));

const seen = [];
let shotCruise = false, shotArrive = false, shotApproach = false;
const t0 = Date.now();
while (Date.now() - t0 < 50000) {
  const active = await page.evaluate(() => P.app.journey.active());
  const ph = await page.evaluate(() => P.app.journey.phase());
  if (ph && seen[seen.length - 1] !== ph) {
    seen.push(ph);
    if (ph === 'launch' && !shotApproach) {
      /* at the approach→launch transition the camera sits exactly over the
         departure city, staring at the planet — the perfect departure shot */
      shotApproach = true;
      await page.waitForTimeout(150);
      if (await page.evaluate(() => P.app.journey.active()))
        await page.screenshot({ path: 'qa-journey-approach.png' });
    }
    if (ph === 'cruise' && !shotCruise) {
      shotCruise = true;
      await page.waitForTimeout(2500);   /* settle mid-cruise: destination ahead */
      if ((await page.evaluate(() => P.app.journey.phase())) === 'cruise')
        await page.screenshot({ path: 'qa-journey-cruise.png' });
      await page.evaluate(() => P.app.journey.setWarp(4));   /* warp slider mid-flight */
      const w = await page.evaluate(() => P.app.journey.warp());
      ok(w === 4, 'mid-flight time-warp slider set to ×4 (got ' + w + ')');
    }
    if (ph === 'arrive' && !shotArrive) {
      shotArrive = true;
      await page.waitForTimeout(3000);   /* near the end: the star is huge now */
      await page.screenshot({ path: 'qa-journey-arrival.png' });
    }
  }
  if (!active) break;
  await page.waitForTimeout(600);
}
ok(seen.join(',') === 'brief,approach,launch,cruise,arrive',
  'phase order: ' + seen.join(','));
const st = await page.evaluate(() => ({
  follow: P.app.state.follow,
  arrived: !!P.journey.arrived(),
  active: P.app.journey.active()
}));
ok(!st.active, 'journey finished');
ok(st.follow === '__dest', 'camera left orbiting the arrival star (follow=' + st.follow + ')');
ok(st.arrived, 'arrived() has the destination star');
const earthAfter = await page.evaluate(() =>
  P.app._dbg.solar.meshes['Earth'].position.toArray());
const moved = Math.hypot(...earthAfter.map((v, i) => v - earthBefore[i])) > 1e-6;
ok(moved, 'planets kept moving during the flight (Earth moved)');
await page.waitForTimeout(2200);   /* far-plane restore tick */
const far = await page.evaluate(() => P.app._dbg.camera.far);
ok(Math.abs(far - 6000) < 1, 'far plane restored to 6000 (got ' + far + ')');

/* ------------------------------------------------ 3) in-system: London→Pluto */
camBefore = await page.evaluate(() => P.app._dbg.camera.position.toArray());
r = await page.evaluate(([f, t]) => P.app.journey.launch(f, t, 'hmary'),
  [LONDON, { type: 'body', name: 'Pluto' }]);
ok(r.ok, 'launch London→Pluto: ' + (r.error || (r.summary && r.summary.time)));
const seen2 = [];
const t1 = Date.now();
while (Date.now() - t1 < 40000) {
  const active = await page.evaluate(() => P.app.journey.active());
  const ph = await page.evaluate(() => P.app.journey.phase());
  if (ph && seen2[seen2.length - 1] !== ph) seen2.push(ph);
  if (!active) break;
  await page.waitForTimeout(600);
}
const st2 = await page.evaluate(() => ({
  follow: P.app.state.follow,
  active: P.app.journey.active(),
  mode: P.app.state.mode
}));
ok(!st2.active, 'Pluto flight finished');
ok(st2.follow === 'Pluto', 'hand-off: follow=Pluto (got ' + st2.follow + ')');
ok(seen2.includes('cruise'), 'in-system flight had a cruise phase: ' + seen2.join(','));

/* --------------------------------------------------------- 4) abort + warp */
camBefore = await page.evaluate(() => P.app._dbg.camera.position.toArray());
r = await page.evaluate(([f, t]) => P.app.journey.launch(f, t, 'photon'), [LONDON, TAU]);
ok(r.ok, 'launch London→Tau Ceti (photon) for abort test');
await page.waitForTimeout(7000);   /* mid-flight */
const midActive = await page.evaluate(() => P.app.journey.active());
ok(midActive, 'still in flight at 7 s');
await page.evaluate(() => P.app.journey.abort());
await page.waitForTimeout(1600);  /* ease-back 0.8 s */
const st4 = await page.evaluate(() => ({
  active: P.app.journey.active(),
  far: P.app._dbg.camera.far,
  pos: P.app._dbg.camera.position.toArray()
}));
ok(!st4.active, 'abort clears the journey');
ok(Math.abs(st4.far - 6000) < 1, 'abort restores far plane (got ' + st4.far + ')');
const dBefore = Math.hypot(...camBefore.map(v => v)), dAfter = Math.hypot(...st4.pos.map(v => v));
ok(Math.abs(dBefore - dAfter) / Math.max(1, dBefore) < 0.25 ||
   camBefore.every((v, i) => Math.abs(v - st4.pos[i]) < 50),
  'camera eased back near its pre-launch pose (Δ ' +
  Math.round(Math.hypot(...camBefore.map((v, i) => v - st4.pos[i]))) + ' u)');

/* ---------------------------------------------------------------- hygiene */
ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | '));
await browser.close();
console.log(fail.length ? '\n' + fail.length + ' FAILURE(S)' : '\nALL PASS');
process.exit(fail.length ? 1 : 0);
