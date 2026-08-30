import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(6000);
const state = await page.evaluate(() => ({
  title: document.title,
  bodyChildren: document.body ? document.body.children.length : -1,
  canvases: document.querySelectorAll('canvas').length,
  sceneCanvas: !!document.querySelector('.scene-canvas'),
  splash: !!document.getElementById('splash'),
  hasP: typeof window.P,
  pDso: window.P && P.dso ? P.dso.length : null
}));
console.log(JSON.stringify(state, null, 1));
console.log('ERRORS:');
errors.slice(0, 8).forEach(e => console.log(e));
await page.screenshot({ path: 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/_qa/dbg-state.png' });
await browser.close();
