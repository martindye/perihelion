/* QA — space probes (phases 2–4): ephemeris, catalog, info cards, solar
 * meshes, sky markers. Run: node _qa/qa-probes.mjs */
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
page.on('console', m => { if (m.type() === 'error' || /self-test/.test(m.text())) errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);

/* 1. data present */
const cnt = await page.evaluate(() => P.probes ? P.probes.probes.length : 0);
ok(cnt === 13, `P.probes has 13 probes (got ${cnt})`);

/* 2. ephemeris: all 13 have sane T0 distances */
const eph = await page.evaluate(() => {
  const d = P.app._dbg.eph, o = {};
  for (const p of P.probes.probes) o[p.name] = { d: d[p.name].distAU, h: d[p.name].helioAU, ra: d[p.name].ra, dec: d[p.name].dec };
  return o;
});
ok(!!eph['JWST'] && Math.abs(eph['JWST'].h - 1.02) < 0.05, `JWST ~1.02 AU from Sun (got ${eph['JWST'] && eph['JWST'].h})`);
ok(!!eph['JWST'] && eph['JWST'].d < 0.03, `JWST at L2: ~0.01 AU from Earth (got ${eph['JWST'] && eph['JWST'].d})`);
ok(!!eph['Voyager 1'] && eph['Voyager 1'].h > 160 && eph['Voyager 1'].h < 185, `Voyager 1 ~171 AU (got ${eph['Voyager 1'] && eph['Voyager 1'].h})`);
const allFinite = Object.values(eph).every(r => isFinite(r.d) && isFinite(r.ra) && isFinite(r.dec) && r.d > 0);
ok(allFinite, 'all 13 probe ephemerides finite at T0');

/* 3. probes self-test reported OK at load */
ok(errs.some(t => /probes self-test OK/.test(t)), 'console: probes self-test OK');
const pageErrs = errs.filter(t => t.startsWith('PAGEERROR'));
ok(pageErrs.length === 0, 'no page errors on load ' + JSON.stringify(pageErrs.slice(0, 3)));

/* 4. solar mode: probe meshes exist & sit at compressed true positions */
await page.evaluate(() => P.app.setMode('solar'));
await page.waitForTimeout(300);
const solar = await page.evaluate(() => {
  const s = P.app._dbg.solar, o = {};
  for (const p of P.probes.probes) o[p.name] = s.meshes[p.name] ? Math.round(s.meshes[p.name].position.length() * 10) / 10 : null;
  return o;
});
/* Tier-2 (interplanetary) probes compress to ~3.7 in this scene (inside the
   sun's glow), so they are pushed to the scene rim (TIER2_RIM=44). */
ok(solar['Voyager 1'] > 40 && solar['Voyager 1'] < 48, `solar: Voyager 1 on the rim (~44, got ${solar['Voyager 1']})`);
ok(solar['JWST'] != null && solar['JWST'] > 20 && solar['JWST'] < 40, `solar: JWST near Earth's orbit (${solar['JWST']})`);
ok(Object.values(solar).every(v => v != null), 'all 13 probes have solar meshes');

/* 5. catalog search */
await page.click('#tg-catalog'); await page.waitForTimeout(200);
const search = async q => { await page.fill('#cat-search', q); await page.waitForTimeout(250); return page.$$eval('.cat-row', r => r.map(x => x.textContent)); };
let rows = await search('voyager');
ok(rows.filter(t => /Voyager/.test(t) && /PROBE/.test(t)).length === 2, `"voyager" → both Voyagers as PROBE (${JSON.stringify(rows.slice(0, 3))})`);
rows = await search('jwst');
ok(rows.some(t => /JWST/.test(t) && /PROBE/.test(t)), '"jwst" finds the probe');
rows = await search('webb');
ok(rows.some(t => /JWST/.test(t)), '"webb" finds JWST');

/* 6. pick a probe → info card */
await page.fill('#cat-search', 'jwst'); await page.waitForTimeout(250);
await page.click('.cat-row');
await page.waitForTimeout(800);
const info = await page.evaluate(() => ({
  sel: P.app.state.selected,
  title: document.getElementById('ip-title').textContent,
  body: document.getElementById('ip-rows').textContent
}));
ok(info.sel === 'probe:JWST', 'selected probe:JWST (got ' + info.sel + ')');
ok(/space probe/i.test(info.title), 'info card titled "… space probe"');
ok(/Launched/.test(info.body) && /Light time/.test(info.body), 'info card has Launched + Light time rows');
ok(/2021-12-25/.test(info.body), 'info card shows launch date 2021-12-25');
await page.screenshot({ path: R + '\\qa-jwst-card.png' });

/* 7. sky mode shows probe discs (markers on the dome) */
await page.evaluate(() => P.app.setMode('sky'));
await page.waitForTimeout(300);
const skyOK = await page.evaluate(() => {
  const d = P.app._dbg.eph;
  return P.probes.probes.every(p => d[p.name] && isFinite(d[p.name].ra) && isFinite(d[p.name].dec));
});
ok(skyOK, 'sky mode: all 13 probes have finite ra/dec');

/* 8. time travel: scrub +10y (2036) — V1 must move outward & stay finite,
 *    JWST (sample ends 2031) must use the Kepler fallback and stay finite */
const future = await page.evaluate(() => {
  const d = P.app._dbg.state;
  const T0 = new Date('2026-08-30T12:00:00Z').getTime();
  d.simTimeMs = T0 + 10 * 365.25 * 86400000;   // 2036
  return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res(null))));
});
await page.waitForTimeout(200);
const t36 = await page.evaluate(() => {
  const d = P.app._dbg.eph;
  return { v1: d['Voyager 1'].helioAU, jwst: d.JWST.helioAU, nh: d['New Horizons'].helioAU };
});
ok(t36.v1 > 175 && isFinite(t36.v1), `2036: Voyager 1 outbound & finite (${t36.v1.toFixed(1)} AU)`);
ok(isFinite(t36.jwst) && t36.jwst > 0.9 && t36.jwst < 1.1, `2036: JWST finite via Kepler fallback (${t36.jwst?.toFixed(3)})`);
ok(isFinite(t36.nh) && t36.nh > 60, `2036: New Horizons finite (${t36.nh?.toFixed(1)} AU)`);
/* reset to T0 */
await page.evaluate(() => { P.app._dbg.state.simTimeMs = new Date('2026-08-30T12:00:00Z').getTime(); });

/* 9. chase camera: follow JWST in solar mode -> camera target tracks it */
await page.evaluate(() => { P.app.setMode('solar'); P.app._dbg.state.follow = 'JWST'; });
await page.waitForTimeout(300);
const chase = await page.evaluate(() => {
  const d = P.app._dbg;
  const jp = d.solar.meshes['JWST'].position;
  const cp = d.cam.target;
  return { dx: Math.abs(jp.x - cp.x), dy: Math.abs(jp.y - cp.y), dz: Math.abs(jp.z - cp.z) };
});
ok(chase.dx + chase.dy + chase.dz < 0.5, `solar: camera target tracks JWST (off by ${Math.max(chase.dx, chase.dy, chase.dz).toFixed(3)})`);

console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
console.log('console notes:', JSON.stringify(errs.filter(t => !t.startsWith('PAGEERROR')).slice(0, 6)));
await browser.close();
process.exit(fail.length ? 1 : 0);
