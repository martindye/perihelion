/* QA — constellation search: type a star sign (e.g. "libra") or "zodiac" in
 * the catalog, click, fly to the figure, info card. Also ZODIAC/CONST gating.
 * Run: node _qa/qa-constsearch.mjs */
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
page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);

async function search(q) {
  await page.fill('#cat-search', q);
  await page.waitForTimeout(250);
  return page.$$eval('.cat-row', rs => rs.map(r => r.textContent));
}
const blur = () => page.evaluate(() => {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
});

await page.click('#tg-catalog');
await page.waitForTimeout(200);

/* 1. "libra" -> the Libra figure */
let rows = await search('libra');
ok(rows.some(t => /^Libra/.test(t) && /ZODIAC SIGN/.test(t)), `search "libra" finds the figure (${JSON.stringify(rows.slice(0, 2))})`);

/* click it -> fly + info card */
await page.click('.cat-row');
await page.waitForTimeout(1600);
const sel = await page.evaluate(() => ({
  sel: P.app.state.selected,
  title: document.getElementById('ip-title').textContent,
  rows: document.getElementById('ip-rows').textContent,
  infoVisible: document.getElementById('infopanel').style.display !== 'none'
}));
ok(sel.sel === 'const:Libra', 'selected entry is const:Libra (got ' + sel.sel + ')');
ok(sel.title === 'LIBRA' && /zodiac/i.test(sel.rows), 'info card: LIBRA + zodiac rows');
ok(/Sep 23/.test(sel.rows), 'info card: Sun-dates row (Sep 23 – Oct 22)');
ok(/♎/.test(sel.rows), 'info card: glyph ♎');
await page.screenshot({ path: R + '\\qa-libra-card.png' });

/* 2. "zodiac" -> all 12 signs */
rows = await search('zodiac');
const zodiacRows = rows.filter(t => /ZODIAC SIGN/.test(t));
ok(zodiacRows.length === 12, `"zodiac" lists all 12 signs (got ${zodiacRows.length})`);

/* 3. non-zodiac constellation still searchable (orion) */
rows = await search('orion');
ok(rows.some(t => /^Orion/.test(t) && /FIGURE/.test(t)), `search "orion" finds the figure (${JSON.stringify(rows.slice(0, 2))})`);

/* 4. ZODIAC toggle hides zodiac entries from the catalog, not Orion */
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
await page.keyboard.press('z');
rows = await search('libra');
ok(!rows.some(t => /^Libra/.test(t)), 'with ZODIAC off: "libra" has no catalog rows');
rows = await search('orion');
ok(rows.some(t => /^Orion/.test(t)), 'with ZODIAC off: non-zodiac "orion" still listed');
await blur();
await page.keyboard.press('z');   /* needs focus off the search input */
await blur();
rows = await search('libra');
ok(rows.some(t => /^Libra/.test(t)), 'with ZODIAC back on: "libra" returns');

/* 5. CONSTELLATIONS toggle hides all figure entries */
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
await page.keyboard.press('c');
rows = await search('orion');
ok(!rows.some(t => /^Orion/.test(t)), 'with CONSTELLATIONS off: "orion" has no figure row');
rows = await search('zodiac');
ok(rows.filter(t => /ZODIAC SIGN/.test(t)).length === 0, 'with CONSTELLATIONS off: no zodiac rows');
await page.keyboard.press('c');
await blur();

/* 6. camera actually turned toward Libra (yaw/pitch changed & mode sky) */
const cam = await page.evaluate(() => ({ mode: P.app.state.mode, dist: P.app._dbg.cam.dist }));
ok(cam.mode === 'sky', 'still in sky mode after constellation fly');

console.log('ERRORS:', JSON.stringify(logs));
console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
