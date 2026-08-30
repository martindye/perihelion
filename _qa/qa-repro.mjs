import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);

const result = await page.evaluate(() => {
  const out = {};
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 600;
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true, antialias: false });
  out.glVersion = renderer.getContext().getParameter(renderer.getContext().VERSION);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.05, 6000);
  scene.add(camera);
  const R = 100, DEG = Math.PI / 180;

  /* 8 colored tiles: tile i is solid color (i+1)/8 in R channel, G/B encode the row/col */
  const S = 256;
  const ac = document.createElement('canvas');
  ac.width = S * 2; ac.height = S * 4;
  const g = ac.getContext('2d');
  for (let t = 0; t < 8; t++) {
    g.fillStyle = 'rgb(' + Math.round((t % 2 + 1) * 128) + ',' + Math.round(((t >> 1) % 3 + 1) * 60) + ',16)';
    g.fillRect((t % 2) * S, Math.floor(t / 2) * S, S, S);
  }
  const tex = new THREE.CanvasTexture(ac);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const NB = 8;
  const iOff = new Float32Array(NB * 3), iXh = new Float32Array(NB * 3), iYh = new Float32Array(NB * 3);
  const iSize = new Float32Array(NB * 2), iUV = new Float32Array(NB * 4), iCol = new Float32Array(NB * 3), iAlpha = new Float32Array(NB);
  const v = new THREE.Vector3();
  for (let i = 0; i < NB; i++) {
    const ra = 64 + i * 7, dec = 0;   /* spread across the 60deg view, all in front (view axis = RA 90) */
    const a = ra * DEG, d = 0;
    v.set(Math.cos(d) * Math.cos(a), Math.sin(d), -Math.cos(d) * Math.sin(a)).multiplyScalar(R);
    iOff[i * 3] = v.x; iOff[i * 3 + 1] = v.y; iOff[i * 3 + 2] = v.z;
    iXh[i * 3] = 0; iXh[i * 3 + 1] = 1; iXh[i * 3 + 2] = 0;
    iYh[i * 3] = -Math.sin(a); iYh[i * 3 + 1] = 0; iYh[i * 3 + 2] = Math.cos(a);
    iSize[i * 2] = 8; iSize[i * 2 + 1] = 8;
    iUV[i * 4] = (i % 2) * 0.5;
    iUV[i * 4 + 1] = (3 - (i >> 1)) * 0.25;
    iUV[i * 4 + 2] = 0.5; iUV[i * 4 + 3] = 0.25;
    iCol[i * 3] = 1; iCol[i * 3 + 1] = 1; iCol[i * 3 + 2] = 1;
    iAlpha[i] = 1;
  }
  const plane = new THREE.PlaneGeometry(1, 1);
  const ggeo = new THREE.InstancedBufferGeometry();
  ggeo.index = plane.index;
  ggeo.setAttribute('position', plane.attributes.position);
  ggeo.setAttribute('uv', plane.attributes.uv);
  ggeo.instanceCount = NB;
  ggeo.setAttribute('iOff', new THREE.InstancedBufferAttribute(iOff, 3));
  ggeo.setAttribute('iXh', new THREE.InstancedBufferAttribute(iXh, 3));
  ggeo.setAttribute('iYh', new THREE.InstancedBufferAttribute(iYh, 3));
  ggeo.setAttribute('iSize', new THREE.InstancedBufferAttribute(iSize, 2));
  ggeo.setAttribute('iUV', new THREE.InstancedBufferAttribute(iUV, 4));
  ggeo.setAttribute('iCol', new THREE.InstancedBufferAttribute(iCol, 3));
  ggeo.setAttribute('iAlpha', new THREE.InstancedBufferAttribute(iAlpha, 1));
  const GAL_VERT = `
    attribute vec3 iOff;
    attribute vec3 iXh;
    attribute vec3 iYh;
    attribute vec2 iSize;
    attribute vec4 iUV;
    attribute vec3 iCol;
    attribute float iAlpha;
    varying vec2 vUv;
    varying vec3 vCol;
    varying float vA;
    void main() {
      vec3 wp = iOff + iXh * (position.x * iSize.x) + iYh * (position.y * iSize.y);
      vUv = iUV.xy + uv * iUV.zw;
      vCol = iCol;
      vA = iAlpha;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
    }`;
  const GAL_FRAG = `
    uniform sampler2D uAtlas;
    varying vec2 vUv;
    varying vec3 vCol;
    varying float vA;
    void main() {
      vec4 t = texture2D(uAtlas, vUv);
      float a = t.a * vA;
      if (a < 0.006) discard;
      gl_FragColor = vec4(vCol * t.rgb * a, a);
    }`;
  const gmat = new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: tex } },
    vertexShader: GAL_VERT, fragmentShader: GAL_FRAG,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    side: THREE.DoubleSide
  });
  const gm = new THREE.Mesh(ggeo, gmat);
  gm.frustumCulled = false;
  scene.add(gm);

  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const px = new Uint8Array(800 * 600 * 4);
  gl.readPixels(0, 0, 800, 600, gl.RGBA, gl.UNSIGNED_BYTE, px);

  /* For each of the 8 objects, find its screen position by projecting and sample a 9x9 box */
  const found = [];
  const M = new THREE.Matrix4();
  for (let i = 0; i < NB; i++) {
    const wp = new THREE.Vector3(iOff[i * 3], iOff[i * 3 + 1], iOff[i * 3 + 2]);
    const pr = wp.clone().project(camera);
    const sx = (pr.x * 0.5 + 0.5) * 800, sy = (0.5 - pr.y * 0.5) * 600;
    let best = 0, br = 0, bg = 0, bs = 0;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const X = Math.round(sx + x), Y = Math.round(sy + y);
      if (X < 0 || Y < 0 || X >= 800 || Y >= 600) continue;
      const idx = ((600 - 1 - Y) * 800 + X) * 4;
      const r = px[idx], gg = px[idx + 1], b = px[idx + 2];
      if (r + gg + b > br + bg + bs) { br = r; bg = gg; bs = b; best = r + gg + b; }
    }
    found.push({ i, sx: Math.round(sx), sy: Math.round(sy), maxPix: [br, bg, bs], bright: best });
  }
  out.found = found;
  return out;
});
console.log(JSON.stringify(result, null, 1));
console.log('ERRORS:', JSON.stringify(errors.slice(0, 10)));
await browser.close();
