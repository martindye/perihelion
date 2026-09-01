/* Normalise the 20 minor-body maps to their final embedded sizes:
 *   pluto  -> 2048x1024 (the star of the show)
 *   others -> 1024x512   (moons & minor planets)
 * then build one numbered contact sheet for the vision check.
 * Run from the _qa dir:  node _qa/normalize-minors.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const ROOT = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/';
const BODIES = ['pluto', 'ceres', 'vesta', 'pallas', 'hygiea', 'ixion', 'eris', 'haumea', 'makemake',
  'io', 'europa', 'ganymede', 'callisto', 'titan', 'triton', 'iapetus', 'rhea',
  'phobos', 'deimos', 'charon'];

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const page = await browser.newPage();
/* a real file:// page can load its sibling file:// images (opaque origin can't) */
fs.writeFileSync(ROOT + '_qa/_norm-base.html', '<html><body></body></html>');
await page.goto('file:///' + (ROOT + '_qa/_norm-base.html').replace(/\\/g, '/'), { waitUntil: 'load' });

for (const b of BODIES) {
  const src = ROOT + '_qa/_minor_' + (b === 'pluto' ? 'pluto_full' : b) + '.jpg';
  const [W, H] = b === 'pluto' ? [2048, 1024] : [1024, 512];
  const shot = await page.evaluate(async (args) => {
    const [src, W, H, Q] = args;
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('load fail ' + src));
      im.src = 'file:///' + src.replace(/\\/g, '/');
    });
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    /* centre-crop to 2:1 if needed, then draw */
    const sa = img.width / img.height, ta = W / H;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (sa > ta) { sw = img.height * ta; sx = (img.width - sw) / 2; }
    else if (sa < ta) { sh = img.width / ta; sy = (img.height - sh) / 2; }
    g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return cv.toDataURL('image/jpeg', Q);
  }, [src, W, H, b === 'pluto' ? 0.8 : 0.82]);
  fs.writeFileSync(ROOT + '_qa/_minor_' + b + '_final.jpg', Buffer.from(shot.split(',')[1], 'base64'));
  const kb = fs.statSync(ROOT + '_qa/_minor_' + b + '_final.jpg').size / 1024;
  console.log(b.padEnd(10), W + 'x' + H, kb.toFixed(0) + ' KB');
}

/* contact sheet: 5 cols x 4 rows, 256x128 cells, numbered in BODIES order */
const N = 5, CW = 256, CH = 128, CELL = 8, LABEL = 20;
let html = '<html><body style="margin:0;background:#111;font:16px monospace">'
  + '<div style="display:grid;grid-template-columns:repeat(' + N + ',' + CW + 'px);gap:' + CELL + 'px;padding:' + CELL + 'px">';
for (let i = 0; i < BODIES.length; i++) {
  html += '<div style="width:' + CW + 'px"><div style="width:' + CW + 'px;height:' + CH + 'px;background:#000">'
    + '<img src="_minor_' + BODIES[i] + '_final.jpg" style="width:' + CW + 'px;height:' + CH + 'px;object-fit:cover"></div>'
    + '<span style="color:#fff">' + i + ': ' + BODIES[i] + '</span></div>';
}
html += '</div></body></html>';
fs.writeFileSync(ROOT + '_qa/_contact-minors.html', html);
await page.setViewportSize({ width: N * (CW + CELL) + 40, height: 4 * (CH + LABEL + CELL) + 40 });
await page.goto('file:///' + (ROOT + '_qa/_contact-minors.html').replace(/\\/g, '/'), { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.screenshot({ path: ROOT + '_qa/qa-minor-textures-contact.png', fullPage: true });
await browser.close();
console.log('contact sheet -> _qa/qa-minor-textures-contact.png');
