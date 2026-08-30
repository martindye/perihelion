// Probe: can headless SwiftShader WebGL upload a 2D canvas as a texture and sample it?
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setContent('<html><body style="margin:0"></body></html>');

const result = await page.evaluate(() => new Promise(res => {
  // 1) draw a 2D canvas
  const src = document.createElement('canvas');
  src.width = 512; src.height = 1024;
  const g = src.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 1024);
  g.fillStyle = '#fff';
  for (let t = 0; t < 8; t++) {
    g.beginPath();
    g.arc((t % 2) * 256 + 128, Math.floor(t / 2) * 256 + 128, 60, 0, 7);
    g.fill();
  }
  const data = g.getImageData(0, 0, 512, 1024).data;
  let nz = 0; for (let i = 0; i < data.length; i += 4) if (data[i] > 8) nz++;
  const r = { twoD: { nz } };

  // 2) WebGL: render the canvas as a full-screen textured quad, read back
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
  r.webglVersion = gl ? gl.getParameter(gl.VERSION) : 'NO WEBGL';
  if (!gl) { res(JSON.stringify(r)); return; }
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 p; attribute vec2 uv; varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(p,0.,1.); }');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, 'precision mediump float; uniform sampler2D uT; varying vec2 vUv; void main(){ vec4 t=texture2D(uT,vUv); gl_FragColor=vec4(t.rgb,1.); }');
  gl.compileShader(fs);
  r.fragCompile = gl.getShaderParameter(fs, gl.COMPILE_STATUS);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  r.link = gl.getProgramParameter(prog, gl.LINK_STATUS);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, 1, 1, 1, 1, -1, 1, 0, 1]), gl.STATIC_DRAW);
  const locP = gl.getAttribLocation(prog, 'p'), locUV = gl.getAttribLocation(prog, 'uv');
  gl.enableVertexAttribArray(locP); gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 8, 0);
  gl.enableVertexAttribArray(locUV); gl.vertexAttribPointer(locUV, 2, gl.FLOAT, false, 8, 4);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);          // match three.js CanvasTexture default
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.viewport(0, 0, 256, 256);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const px = new Uint8Array(256 * 256 * 4);
  gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0, max = 0;
  for (let i = 0; i < px.length; i += 4) { sum += px[i]; if (px[i] > max) max = px[i]; }
  r.webgl = { mean: +(sum / (256 * 256)).toFixed(2), max };
  res(JSON.stringify(r, null, 1));
}));
console.log(result);
await browser.close();
