/* Embed textures/*.jpg as re-encoded data URLs in js/planets-textures.js.
 * Why: a file:// page using <img src="textures/x.jpg"> for a WebGL texture
 * trips Chrome's cross-origin rule (opaque origin) -> texImage2D throws
 * SecurityError. Data-URL images are same-origin: clean upload.
 *
 * Re-encodes at 2048x1024 / JPEG q0.72 via a headless canvas to keep the
 * payload small (~3 MB b64 total for all nine maps).
 *
 * Exception: the Saturn ring strip (textures/saturn-rings.png, 2048x125
 * radial profile WITH alpha, SST 2k_saturn_ring_alpha) is embedded VERBATIM
 * as a PNG data URL — re-encoding to JPEG would destroy the alpha that
 * carries the ring gaps (Cassini division etc). 12 KB -> ~16 KB b64.
 *
 * Run from the _qa dir (needs playwright-core):  node _qa/embed-textures.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const names = ['sun', 'earth', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();

const map = {};
let total = 0;
for (const n of names) {
  const f = ROOT + 'textures/' + n + '.jpg';
  const b64 = fs.readFileSync(f).toString('base64');
  const out = await page.evaluate(async (src) => {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('img load failed'));
      i.src = src;
    });
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 2048, 1024);
    return c.toDataURL('image/jpeg', 0.72);
  }, 'data:image/jpeg;base64,' + b64);
  const kb = Math.round((out.length - 23) * 0.75 / 1024);
  total += out.length;
  map[n] = out;
  console.log(n.padEnd(8), kb + ' KB (b64 ' + Math.round(out.length / 1024) + ' KB)');
}
await browser.close();

let js = '/* ============================================================================\n' +
  ' * PERIHELION — planet photo maps (js/planets-textures.js)\n * \n';
js += ' * Equirectangular 2048x1024 JPEG data-URLs (q0.72). Imagery: Solar System\n';
js += ' * Scope texture set (mosaics of NASA/JPL/USGS public-domain data), fetched\n';
js += ' * via _build/fetch-textures.mjs, re-encoded + embedded by _qa/embed-textures.mjs.\n';
js += ' * saturnRings: the SST 2k_saturn_ring_alpha strip (2048x125, CC-BY-4.0 SST,\n';
js += ' * NASA/JPL-derived) embedded VERBATIM as PNG — its alpha carries the ring\n';
js += ' * structure (Cassini division etc), so it must not be re-encoded to JPEG.\n';
js += ' * Embedded (not fetched) because file:// pages cannot upload loose-file\n';
js += ' * images to WebGL (opaque-origin SecurityError).\n';
js += ' * ==========================================================================*/\n';
js += "'use strict';\nwindow.P = window.P || {};\n\nP.planetTex = {\n";
for (const n of names) js += '  ' + n + ': ' + JSON.stringify(map[n]) + ',\n';
/* Saturn ring strip: verbatim PNG (alpha carries the ring structure). */
const ringB64 = fs.readFileSync(ROOT + 'textures/saturn-rings.png').toString('base64');
js += '  saturnRings: "data:image/png;base64,' + ringB64 + '",\n';
js += '};\n';
fs.writeFileSync(ROOT + 'js/planets-textures.js', js);
console.log('wrote js/planets-textures.js (' + (total / 1048576).toFixed(2) + ' MB b64 total)');
