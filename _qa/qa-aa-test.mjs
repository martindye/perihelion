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
  const mk = (tag, opts) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const r = new T.WebGLRenderer({ canvas: c, ...opts });
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(50, 1, 0.1, 100);
    scene.add(cam);
    // red plane + a point, centered
    const plane = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), new T.MeshBasicMaterial({ color: 0xff0000, side: T.DoubleSide }));
    plane.position.z = -1;
    scene.add(plane);
    const pts = new T.BufferGeometry();
    pts.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0, -1, 0.2, 0.2, -1, -0.2, 0.2, -1]), 3));
    const pm = new T.PointsMaterial({ color: 0x00ff00, size: 3 });
    scene.add(new T.Points(pts, pm));
    r.render(scene, cam);
    const gl = r.getContext();
    const px = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // sample center 16x16 and a 10x10 at (100,120)
    const region = (x0, y0, w, h) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const i = ((256 - 1 - y) * 256 + x) * 4;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
      return [+(r / n).toFixed(1), +(g / n).toFixed(1), +(b / n).toFixed(1)];
    };
    return {
      ctx: gl.getParameter(gl.VERSION),
      sampleCenter: region(120, 120, 16, 16),
      samplePlane: region(124, 120, 8, 8)
    };
  };
  out.aa_false = mk('aafalse', { antialias: false, preserveDrawingBuffer: true });
  out.aa_true = mk('aatrue', { antialias: true, preserveDrawingBuffer: true });
  out.aa_true_preserve_off = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const r = new T.WebGLRenderer({ canvas: c, antialias: true });
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
    let s = 0;
    for (let y = 120; y < 136; y++) for (let x = 120; x < 136; x++) { const i = ((256 - 1 - y) * 256 + x) * 4; s += px[i]; }
    return { centerR: +(s / 256).toFixed(1), ctx: gl.getParameter(gl.VERSION) };
  })();
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
