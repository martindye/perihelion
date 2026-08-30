import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';

const VARIANTS = {
  v1_full: `
    window.__captured = [];
    const origGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      const gl = origGet.call(this, type, ...a);
      if (gl && (type === 'webgl' || type === 'webgl2') && !gl.__hooked) {
        gl.__hooked = true;
        const origTex = gl.texImage2D.bind(gl);
        gl.texImage2D = function (target, level, ifmt, fmt, type, src) {
          const isCanvas = src && src.tagName === 'CANVAS';
          const r = origTex(target, level, ifmt, fmt, type, src);
          if (arguments.length <= 6 && isCanvas) {
            const tex = gl.getParameter(gl.TEXTURE_BINDING_2D);
            window.__captured.push({ tex, w: src.width, h: src.height });
          }
          return r;
        };
      }
      return gl;
    };
  `,
  v2_no_flag: `
    const origGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      const gl = origGet.call(this, type, ...a);
      if (gl && (type === 'webgl' || type === 'webgl2') && !gl.__hooked) {
        try { gl.__hooked = true; } catch (e) { window.__hookErr = 'flag: ' + e; }
        const origTex = gl.texImage2D.bind(gl);
        try { gl.texImage2D = function () { return origTex.apply(null, arguments); }; } catch (e) { window.__hookErr = 'assign: ' + e; }
      }
      return gl;
    };
  `,
  v3_passthrough: `
    const origGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      return origGet.call(this, type, ...a);
    };
  `
};

const variant = process.argv[2] || 'v1_full';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.addInitScript(VARIANTS[variant]);
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(6000);
const state = await page.evaluate(() => ({
  canvas: !!document.querySelector('canvas'),
  pDso: window.P && P.dso ? P.dso.length : null,
  splash: document.body.innerText.slice(0, 200)
}));
console.log('VARIANT', variant);
console.log(JSON.stringify(state, null, 1));
console.log('ERRORS:', JSON.stringify(errors.slice(0, 6)));
await browser.close();
