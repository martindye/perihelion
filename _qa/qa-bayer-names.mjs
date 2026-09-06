/* QA — Bayer/Flamsteed name search (system-wide star naming):
 *   "tau ceti"   -> exact name hit, flies to the right sky position
 *   "52 cet"     -> Flamsteed alias of the same star
 *   "8102"       -> numeric search still works
 *   "alpha centauri" -> finds the curated star via merged refs
 *   regression: plain star names + catalog UI intact
 * Run from _qa:  node qa-bayer-names.mjs */
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(2500);

async function catalogSearch(q) {
  await page.evaluate(() => P.app.toggleCatalog(true));
  await page.waitForTimeout(200);
  await page.fill('#cat-search', q);
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('.cat-row')].slice(0, 4)
      .map(r => ({ name: r.querySelector('b') ? r.querySelector('b').textContent : r.textContent.slice(0, 40), key: r.textContent.slice(0, 80) }));
    return rows;
  });
}
async function pickFirst() {
  await page.evaluate(() => {
    const r = document.querySelector('.cat-row');
    if (r) r.click();
  });
  await page.waitForTimeout(2600);   /* fly-to tween 0.8 s + settle */
}

/* 1) "tau ceti" — exact name match, correct position */
let rows = await catalogSearch('tau ceti');
ok(rows.length > 0, 'search "tau ceti" has rows: ' + JSON.stringify(rows[0]));
ok(/Tau Ceti/i.test(rows[0].name + rows[0].key), 'top hit is Tau Ceti: ' + rows[0].name);
await pickFirst();
let sel = await page.evaluate(() => {
  const s = P.app.state;
  const e = s.selectedEntry;
  return { selected: s.selected, name: e ? e.name : null, ra: e && e.ra != null ? +e.ra.toFixed(3) : null, dec: e && e.dec != null ? +e.dec.toFixed(3) : null, hip: e && e.hip };
});
ok(sel.hip === 8102 || (sel.ra > 25.9 && sel.ra < 26.15 && sel.dec > -16.1 && sel.dec < -15.8),
  `Tau Ceti selected at correct position (hip=${sel.hip} ra=${sel.ra} dec=${sel.dec})`);

/* 2) "52 cet" — Flamsteed alias (note: "52" is also a live HD number, so
   the alias may share the top slots with HD 52 / HIP 52 — assert presence) */
rows = await catalogSearch('52 cet');
ok(rows.some(r => /8102/.test(r.key)), 'search "52 cet" lists 52 Ceti (HIP 8102) in top hits');

/* 3) numeric search still works */
rows = await catalogSearch('8102');
ok(rows.length > 0 && /8102/.test(rows[0].key), 'search "8102" finds HIP 8102');

/* 4) "alpha centauri" -> curated Rigil Kentaurus via merged refs */
rows = await catalogSearch('alpha centauri');
ok(rows.length > 0, 'search "alpha centauri" has a hit: ' + (rows[0] ? rows[0].name : ''));

/* 5) conventional names: beta Canis Minoris / 61 Cygni style */
rows = await catalogSearch('61 cyg');
ok(rows.length > 0, 'search "61 cyg" (61 Cygni, Flamsteed) hits: ' + (rows[0] ? rows[0].name : ''));

/* 6) regression: a classic IAU name still resolves */
rows = await catalogSearch('sirius');
ok(rows.length > 0 && /Sirius/i.test(rows[0].name + rows[0].key), 'search "sirius" still works');

const namedCount = await page.evaluate(() => P.starNamed ? P.starNamed.count : -1);
console.log('named-star entries:', namedCount);
ok(namedCount > 3000, 'named-star table grew (was 458, now ' + namedCount + ')');

console.log('errors:', JSON.stringify(errs.slice(0, 4)));
console.log(fail.length ? `\n=== ${fail.length} FAILURES ===` : '\n=== ALL CHECKS PASSED ===');
await browser.close();
process.exit(fail.length ? 1 : 0);
