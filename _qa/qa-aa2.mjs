import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);

const result = await page.evaluate(() => {
  const T = THREE;
  const out = {};
  const test = (tag, opts) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const r = new T.WebGLRenderer({ canvas: c, ...opts });
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(50, 1, 0.1, 100);
    scene.add(cam);
    const plane = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), new T.MeshBasicMaterial({ color: 0xff0000, side: T.DoubleSide }));
    plane.position.z = -1;
    scene.add(plane);
    r.render(scene, cam);
    const gl = r.getContext();
    const px = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const pxAt = (x, y) => { const i = ((256 - 1 - y) * 256 + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    // plane occupies ~center 70x70; sample exact center + 4 points in plane + 4 corners
    return {
      center: pxAt(128, 128),
      inPlane: [pxAt(100, 128), pxAt(156, 128), pxAt(128, 100), pxAt(128, 156)],
      corner: pxAt(10, 10),
      samples: {
        c: pxAt(128, 128), a: pxAt(100, 128), b: pxAt(156, 128), t: pxAt(128, 100), b2: pxAt(128, 156),
        c10: pxAt(10, 10), c240: pxAt(240, 240)
      }
    };
  };
  out.aa0_p0 = test('a', { antialias: false, preserveDrawingBuffer: false });
  out.aa0_p1 = test('b', { antialias: false, preserveDrawingBuffer: true });
  out.aa1_p0 = test('c', { antialias: true, preserveDrawingBuffer: false });
  out.aa1_p1 = test('d', { antialias: true, preserveDrawingBuffer: true });
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
