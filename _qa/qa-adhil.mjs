import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.click('#tg-catalog');
await page.fill('#cat-search', 'andromeda');
await page.waitForTimeout(400);
const r = await page.evaluate(() =>
  [...document.querySelectorAll('.cat-row')].slice(0, 10).map(el => el.textContent));
console.log(JSON.stringify(r, null, 1));
await browser.close();
