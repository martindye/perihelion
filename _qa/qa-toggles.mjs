/* QA — ZODIAC (Z) + MINORS (P) toggles, 12 zodiac figures, 9th dwarf planet.
 * Run: node _qa/qa-toggles.mjs  (from anywhere; paths are absolute) */
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const R = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa';
const fail = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fail.push(msg); };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' || /self-test|PERIHELION/i.test(t)) logs.push(m.type() + ': ' + t); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4500);

/* ---------- 1. data integrity ---------- */
const data = await page.evaluate(() => ({
  zodiac: (P.zodiac || []).length,
  constellations: P.constellations.length,
  planets: P.minors.planets.length,
  moons: P.minors.moons.length,
  ixion: P.minors.planets.find(p => p.name === 'Ixion') || null,
  selftest: /minors self-test OK/.test(document.body ? 'x' : 'x') // from logs instead
}));
ok(data.zodiac === 12, `P.zodiac has 12 names (got ${data.zodiac})`);
ok(data.constellations === 24, `P.constellations has 24 figures (got ${data.constellations})`);
ok(data.planets === 9, `P.minors.planets has 9 bodies (got ${data.planets})`);
ok(data.moons === 11, `P.minors.moons has 11 moons (got ${data.moons})`);
ok(data.ixion && Math.abs(data.ixion.a - 39.35) < 0.01 && Math.abs(data.ixion.M0 - 295.32) < 0.5,
   'Ixion present with T0 elements (a≈39.35, M0≈295.32)');
ok(logs.some(l => /ephemeris self-test OK/.test(l)), 'ephemeris self-test OK in console');
ok(logs.some(l => /minors self-test OK/.test(l) && /9 planets, 11 moons/.test(l)),
   'minors self-test OK (9 planets, 11 moons)');

/* ---------- 2. ZODIAC toggle ---------- */
const z0 = await page.evaluate(() => ({
  state: P.app.state.zodiac,
  lineVis: P.app._dbg.sky.constellationsZodiac.visible,
  linePts: P.app._dbg.sky.constellationsZodiac.geometry.attributes.position.count,
  btnOn: document.getElementById('tg-zodiac').classList.contains('on')
}));
ok(z0.state === true, 'state.zodiac defaults true');
ok(z0.lineVis === true, 'zodiac LineSegments visible initially');
ok(z0.linePts > 30, `zodiac lines have geometry (${z0.linePts} points)`);
ok(z0.btnOn, 'ZODIAC button starts on');

await page.keyboard.press('z');
const z1 = await page.evaluate(() => ({
  state: P.app.state.zodiac,
  lineVis: P.app._dbg.sky.constellationsZodiac.visible,
  btnOn: document.getElementById('tg-zodiac').classList.contains('on')
}));
ok(z1.state === false && z1.lineVis === false && !z1.btnOn, 'key Z turns zodiac off (state + lines + button)');

/* zodiac OFF: centroid labels of the 12 must not be in the label layer */
const labelsOff = await page.evaluate(() =>
  [...document.querySelectorAll('#labels .lbl')].map(e => e.textContent));
const ZODIAC_WORDS = ['ARIES','TAURUS','GEMINI','CANCER','LEO','VIRGO','LIBRA','SCORPIUS','SAGITTARIUS','CAPRICORNUS','AQUARIUS','PISCES'];
const zodiacLabelsVisibleOff = labelsOff.filter(t => ZODIAC_WORDS.includes(t.trim()));
ok(zodiacLabelsVisibleOff.length === 0,
   `no zodiac centroid labels while zodiac off (found ${zodiacLabelsVisibleOff.length})`);

/* back ON via the button */
await page.click('#tg-zodiac');
const z2 = await page.evaluate(() => P.app.state.zodiac && P.app._dbg.sky.constellationsZodiac.visible);
ok(z2 === true, 'ZODIAC button turns zodiac back on');
await page.screenshot({ path: R + '\\qa-zodiac-on.png' });

/* ---------- 3. MINORS toggle ---------- */
await page.evaluate(() => P.app.setMode('solar'));
await page.waitForTimeout(400);

/* solar group: all 9 dwarf-planet + 11 moon meshes sit in one toggleable group */
const sol0 = await page.evaluate(() => {
  const d = P.app._dbg;
  const probes = ['Ceres','Eris','Ixion','Io','Triton','Charon','Jupiter'];
  return probes.map(n => {
    const m = d.solar.meshes[n];
    return { n, found: !!m, parentVis: m ? m.parent.visible : null };
  });
});
ok(sol0.every(p => p.found), 'all probe meshes exist in solar mode');
ok(sol0.slice(0, 6).every(p => p.parentVis === true), 'minor/moon meshes start visible');

await page.keyboard.press('p');
const sol1 = await page.evaluate(() => {
  const d = P.app._dbg;
  const probes = ['Ceres','Eris','Ixion','Io','Triton','Charon','Jupiter'];
  return {
    state: P.app.state.minors,
    btnOn: document.getElementById('tg-minors').classList.contains('on'),
    probes: probes.map(n => ({ n, parentVis: d.solar.meshes[n] ? d.solar.meshes[n].parent.visible : null }))
  };
});
ok(sol1.state === false && !sol1.btnOn, 'key P turns minors off (state + button)');
ok(sol1.probes.slice(0, 6).every(p => p.parentVis === false), 'dwarf planets + moons hidden when minors off');
ok(sol1.probes.find(p => p.n === 'Jupiter').parentVis === true, 'major planets stay visible when minors off');
await page.screenshot({ path: R + '\\qa-solar-minors-off.png' });

/* sky-mode dome discs follow the same toggle */
const skyMinors = await page.evaluate(() => {
  P.app.setMode('sky');
  return {
    ceresHolderVis: P.app._dbg.sky.bodyRecords['Ceres'].holder.visible,
    ixionHolderVis: P.app._dbg.sky.bodyRecords['Ixion'] ? P.app._dbg.sky.bodyRecords['Ixion'].holder.visible : null
  };
});
ok(skyMinors.ceresHolderVis === false && skyMinors.ixionHolderVis === false,
   'sky-mode dome discs follow MINORS off');

/* catalog: Ceres/Eris/Ixion gone, Jupiter + stars still there */
await page.evaluate(() => { P.app.setMode('solar'); });
await page.click('#tg-catalog');
await page.waitForTimeout(200);
for (const q of ['Ceres', 'Ixion', 'Jupiter']) {
  await page.fill('#cat-search', q);
  await page.waitForTimeout(250);
  const rows = await page.$$eval('.cat-row', rs => rs.map(r => r.textContent));
  if (q === 'Ceres' || q === 'Ixion') {
    ok(rows.every(t => !new RegExp(q, 'i').test(t)), `catalog: no "${q}" rows with MINORS off`);
  } else {
    ok(rows.some(t => /Jupiter/.test(t)), 'catalog: Jupiter still searchable with MINORS off');
  }
}

/* back on: everything returns (blur the search input first — key handler
   correctly ignores keys while typing) */
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await page.keyboard.press('p');
await page.waitForTimeout(200);
const sol2 = await page.evaluate(() => {
  const d = P.app._dbg;
  return {
    state: d.state.minors,
    ceres: d.solar.meshes.Ceres.parent.visible,
    io: d.solar.meshes.Io.parent.visible,
    ceresHolder: P.app._dbg.sky.bodyRecords['Ceres'].holder.visible
  };
});
ok(sol2.state === true && sol2.ceres && sol2.io && sol2.ceresHolder,
   'MINORS back on: meshes + dome discs restored');
await page.screenshot({ path: R + '\\qa-solar-minors-on.png' });

console.log('CONSOLE LOGS:', JSON.stringify(logs, null, 1));
console.log(fail.length ? '\n=== ' + fail.length + ' FAILURES ===' : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
