import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3000);
const r = await page.evaluate(async () => {
  const before = P.app.state.fovSky;
  const cv = document.querySelector('#app canvas') || document.querySelector('canvas');
  const fire = () => cv.dispatchEvent(new WheelEvent('wheel', {
    deltaY: -120, clientX: innerWidth / 2, clientY: innerHeight / 2,
    bubbles: true, cancelable: true
  }));
  fire(); fire(); fire();
  await new Promise(r2 => setTimeout(r2, 300));
  return { before, after: P.app.state.fovSky };
});
console.log(JSON.stringify(r));
console.log('expect: before=55, after=52.6 (3 x -2.4)');
await browser.close();
