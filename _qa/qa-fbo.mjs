import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const URL = 'file:///C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/index.html?dbg=1';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3500);
const r = await page.evaluate(() => {
  const d = window.__dbg;
  let gm = null;
  d.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.isInstancedBufferGeometry) gm = o; });
  const tex = gm.material.uniforms.uAtlas.value;
  const renderer = d.renderer;
  const gl = renderer.getContext();
  const canvas = tex.image;
  const W = canvas.width, H = canvas.height;

  /* the REAL GL texture three.js uploaded */
  const props = renderer.properties.get(tex);
  const realTex = props && props.__webglTexture;
  if (!realTex) return { error: 'no __webglTexture; props keys=' + Object.keys(props || {}).join(',') };

  const fbo = gl.createFramebuffer();
  const fbTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, fbTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTex, 0);
  /* copy real texture -> fbo via a 1x1 fullscreen copy is overkill; instead readPixels
     directly is not allowed on textures — so bind the texture and use blit? WebGL1:
     use gl.readPixels only on the default framebuffer. Instead: bind real tex, make
     a copy by drawing it with a simple shader into the FBO. */
  const vs = 'attribute vec2 p; varying vec2 v; void main(){ v = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }';
  const fs = 'precision mediump float; varying vec2 v; uniform sampler2D t; void main(){ gl_FragColor = texture2D(t, v); }';
  const prog = gl.createProgram();
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); gl.attachShader(prog, sh); return sh; };
  mk(gl.VERTEX_SHADER, vs); mk(gl.FRAGMENT_SHADER, fs);
  gl.linkProgram(prog); gl.useProgram(prog);
  const qbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(gl.getUniformLocation(prog, 't'), 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, realTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, W, H);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const buf = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const gpu = (x, y) => { const i = (y * W + x) * 4; return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]; };
  const cv = (x, y) => { const p = canvas.getContext('2d').getImageData(x, y, 1, 1).data; return [p[0], p[1], p[2], p[3]]; };
  return {
    flipY: tex.flipY,
    /* canvas (x, y) -> gpu readback at same (x, y), and where the canvas pixel at that
       location actually lives in the uploaded texture (search by color match is overkill;
       just compare directly to test flip/shift) */
    c_canvas128_128: cv(128, 128), gpu_128_128: gpu(128, 128),
    c_canvas180_128: cv(180, 128), gpu_180_128: gpu(180, 128),
    c_canvas128_74: cv(128, 74), gpu_128_74: gpu(128, 74),
    /* check vertical flip: canvas top-left vs gpu top-left */
    c_canvas0_0: cv(1, 1), gpu_1_1: gpu(1, 1),
    c_canvas510_510: cv(510, 510), gpu_510_510: gpu(510, 510)
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
