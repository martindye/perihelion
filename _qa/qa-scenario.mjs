/* QA — scenarios: "Hail Mary: Homecoming" (journeys as data, multi-leg,
 * convoy of two ships, movie re-enactment)
 *   1) P.scenarios has the bundled default (3 legs) and it validates
 *   2) 40 Eridani A is in the catalog (autocomplete + distance)
 *   3) full run: legs chain 1→2→3, leg 3 flies with TWO ships (convoy),
 *      arrival at 40 Eridani A, sim clock advanced ~16-18 yr, no errors
 * Run from _qa:  node qa-scenario.mjs */
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };
const SHOTS = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa/';

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(2500);

/* ------------------------------------------- 1) bundled scenario data */
const sc = await page.evaluate(() => P.scenarios && P.scenarios[0]);
ok(!!sc, 'P.scenarios has a bundled scenario');
ok(!!sc && sc.legs && sc.legs.length === 3, 'scenario has 3 legs (got ' + (sc && sc.legs && sc.legs.length) + ')');
ok(!!sc && sc.legs[2].ships.join(',') === 'hmary,blipa', 'leg 3 flies the convoy (hmary,blipa)');
let v = await page.evaluate(() => P.journey.validateScenario(P.scenarios[0]));
ok(v === null, 'scenario validates: ' + v);

/* --------------------------------- 2) 40 Eridani A in the catalog
 * NOTE: the catalog carries the star under its IAU name "Keid" (HIP 19849);
 * "40 Eri" / "40 Eridani" are in its refs, so the search must find it there.
 * (An earlier bad build mislabelled a faint Pyx star as "40 Eridani A" —
 *  guard against regressions in both directions.) */
await page.keyboard.press('j');
await page.waitForTimeout(300);
await page.fill('#jr-to', '40 ERID');
await page.waitForTimeout(450);
let cands = await page.$$eval('.jr-cand', els => els.map(e => e.textContent.trim()));
ok(cands.some(t => /keid/i.test(t) && /pc/.test(t)),
  'autocomplete finds 40 Eridani A via Keid: ' + JSON.stringify(cands.slice(0, 3)));
await page.fill('#jr-to', '40 ERIDANI A');
await page.waitForTimeout(450);
cands = await page.$$eval('.jr-cand', els => els.map(e => e.textContent.trim()));
ok(!cands.some(t => /40 Eridani A/i.test(t)),
  'no bogus "40 Eridani A" label on a wrong star: ' + JSON.stringify(cands.slice(0, 3)));
await page.keyboard.press('j');   /* close drawer */
await page.waitForTimeout(200);

/* ------------------------------------------------- 3) run the whole film */
const simBefore = await page.evaluate(() => P.app._dbg.state.simTimeMs);
let r = await page.evaluate(() => P.app.journey.launchScenario(P.scenarios[0]));
ok(r.ok, 'launchScenario: ' + (r.ok ? 'ok' : r.error));
await page.evaluate(() => P.app.journey.setWarp(4));

const legsSeen = [];
let lastLeg = 0, lastPhase = '';
let shotLeg1 = false, shotLeg3Launch = false, shotLeg3Cruise = false;
let convoy = null;
const t0 = Date.now();
let stuck = 0;
while (Date.now() - t0 < 90000) {
  const st = await page.evaluate(() => {
    const h = P.app.journey.hud();
    const act = P.app.journey.active();
    return { active: act,
             leg: h && h.leg ? h.leg : null, phase: h ? h.phase : null };
  });
  if (st.leg) {
    const L = st.leg.idx;
    if (!legsSeen.includes(L)) legsSeen.push(L);
    if (L !== lastLeg) {
      lastLeg = L;
      console.log('   … leg ' + L + '/' + (st.leg.total) + ' — ' + st.leg.label);
    }
    /* screenshots at the good moments (warp 4: animation-s /4 in real time) */
    if (L === 1 && st.phase === 'cruise' && !shotLeg1) {
      shotLeg1 = true;
      await page.waitForTimeout(1100);   /* let the pull-back settle */
      await page.screenshot({ path: SHOTS + 'shot-leg1-cruise.png' });
    }
    if (L === 3 && st.phase === 'launch' && !shotLeg3Launch) {
      shotLeg3Launch = true;
      await page.waitForTimeout(320);   /* the hero hold beat */
      await page.screenshot({ path: SHOTS + 'shot-leg3-launch.png' });
    }
    if (L === 3 && st.phase === 'cruise' && !shotLeg3Cruise) {
      shotLeg3Cruise = true;
      await page.waitForTimeout(1200);
      convoy = await page.evaluate(() => {
        const out = [];
        P.app._dbg.scene.traverse(o => {
          if (o.userData && o.userData.jship) out.push({
            key: o.userData.jship, pos: o.position.toArray(), scale: o.scale.x
          });
        });
        return out;
      });
      await page.screenshot({ path: SHOTS + 'shot-leg3-cruise.png' });
    }
  }
  const doneNow = await page.evaluate(() => !P.app.journey.active() && !!P.journey.arrived());
  if (doneNow) break;
  if (st.phase === lastPhase) { if (++stuck > 240) break; } else { stuck = 0; lastPhase = st.phase; }
  await page.waitForTimeout(500);
}
ok(legsSeen.length >= 3, 'legs chained 1→2→3 (saw ' + legsSeen.join(',') + ')');

/* leg-3 convoy: exactly two ships flying, wingman offset from the line
   (captured mid-flight — the ships are disposed when the scenario ends) */
const ships = convoy || [];
ok(ships.length === 2, 'convoy in flight: 2 ships (got ' + ships.length + ')');
if (ships.length === 2) {
  const keys = ships.map(s => s.key).sort().join(',');
  ok(keys === 'blipa,hmary', 'the convoy is hmary + blipa (' + keys + ')');
  const dx = Math.abs(ships[0].pos[0] - ships[1].pos[0]) + Math.abs(ships[0].pos[1] - ships[1].pos[1]) + Math.abs(ships[0].pos[2] - ships[1].pos[2]);
  ok(dx > 1, 'wingman flies off the route line (Δ ' + dx.toFixed(1) + 'u)');
  const blipa = ships.find(s => s.key === 'blipa');
  ok(blipa && blipa.scale > 0, 'blipa scaled in (scale ' + (blipa && blipa.scale) + ')');
}

/* arrival + clock */
const fin = await page.evaluate(() => {
  const a = P.journey.arrived();
  return {
    arrived: !!a,
    follow: P.app._dbg.state.follow,
    dest: a ? a.dest.toArray() : null,
    sim: P.app._dbg.state.simTimeMs
  };
});
ok(fin.arrived, 'arrived state set after the final leg');
ok(fin.follow === '__dest', 'camera follows the arrival star (follow=' + fin.follow + ')');
if (fin.dest) {
  const L = Math.hypot(...fin.dest);
  ok(L > 4000 && L < 5000, 'arrival star on the dome (r=' + L.toFixed(0) + ')');
}
const years = (await page.evaluate(() => P.app._dbg.state.simTimeMs) - simBefore) / 31557600000;
ok(years > 14 && years < 20, 'mission clock advanced ' + years.toFixed(1) + ' yr (want ~16.8)');

/* the ARRIVED card */
await page.waitForTimeout(600);
await page.screenshot({ path: SHOTS + 'shot-arrival.png' });
const info = await page.evaluate(() => {
  const el = document.getElementById('infopanel');
  return el && el.style.display !== 'none' ? el.textContent.replace(/\s+/g, ' ').slice(0, 140) : null;
});
ok(/ARRIVED/.test(info || '') && /ERID/.test((info || '').toUpperCase()),
  'ARRIVED card shown: ' + (info || '(none)'));

ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail.length ? 'FAILED: ' + fail.length : 'ALL CHECKS PASSED');
await browser.close();
process.exit(fail.length ? 1 : 0);
