// Standalone atlas test: replicate sky.js galaxyAtlas drawing code, then report
// per-tile pixel statistics. Run headless with playwright-core.
import { chromium } from 'playwright-core';

const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

const result = await page.evaluate(() => {
  const S = 256, W = S * 2, H = S * 4;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const glow = (x, y, r, a) => {
    if (r <= 0 || a <= 0) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,' + a + ')');
    gr.addColorStop(0.55, 'rgba(255,255,255,' + (a * 0.45) + ')');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const star = (x, y, r, a) => { g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.fillRect(x - r / 2, y - r / 2, r, r); };
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const TAU = Math.PI * 2;
  for (let t = 0; t < 8; t++) {
    g.save();
    g.translate((t % 2) * S, Math.floor(t / 2) * S);
    const cx = S / 2, cy = S / 2;
    if (t === 0) {
      glow(cx, cy, S * 0.49, 0.28); glow(cx, cy, S * 0.36, 0.26); glow(cx, cy, S * 0.20, 0.32);
      g.filter = 'blur(8px)'; g.lineCap = 'round';
      for (let arm = 0; arm < 4; arm++) {
        const major = arm < 2; const off = (arm % 2) * Math.PI;
        g.beginPath();
        for (let s2 = 0; s2 <= 44; s2++) {
          const u = s2 / 44, r = 8 + u * (S * 0.47 - 10);
          const a2 = (major ? off : off + 0.55) + u * 3.1;
          const x = cx + Math.cos(a2) * r, y = cy + Math.sin(a2) * r;
          s2 === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.strokeStyle = major ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.34)';
        g.lineWidth = major ? 24 : 14;
        g.stroke();
      }
      g.filter = 'blur(2px)';
      for (let i = 0; i < 320; i++) {
        const r = Math.sqrt(rnd()) * S * 0.46, a2 = rnd() * TAU;
        g.fillStyle = 'rgba(255,255,255,' + (0.10 + rnd() * 0.30) + ')';
        g.fillRect(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, 1.4, 1.4);
      }
      g.filter = 'none';
      glow(cx, cy, 40, 0.95); glow(cx, cy, 16, 1.0);
    } else if (t === 1) {
      glow(cx, cy, S * 0.47, 0.30);
      g.filter = 'blur(6px)';
      g.save(); g.translate(cx, cy); g.scale(1, 0.38); glow(0, 0, 88, 0.85); g.restore();
      g.lineCap = 'round';
      for (const s3 of [-1, 1]) {
        g.beginPath(); g.moveTo(cx + 46 * s3, cy);
        g.quadraticCurveTo(cx + 84 * s3, cy + 30 * s3, cx + 100 * s3, cy + 66 * s3);
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 16; g.stroke();
        g.beginPath(); g.moveTo(cx + 46 * s3, cy);
        g.quadraticCurveTo(cx + 80 * s3, cy - 24 * s3, cx + 92 * s3, cy - 48 * s3);
        g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 10; g.stroke();
      }
      g.filter = 'none'; glow(cx, cy, 26, 1.0);
    } else if (t === 2) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.49);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.72)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.34)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.12)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    } else if (t === 3) {
      glow(cx - 10, cy + 8, S * 0.34, 0.6); glow(cx + 22, cy - 16, S * 0.26, 0.55);
      glow(cx - 30, cy - 12, S * 0.20, 0.5); glow(cx, cy, 34, 0.95);
      for (let i = 0; i < 30; i++) {
        const a2 = rnd() * TAU, r = rnd() * S * 0.4;
        glow(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, 3 + rnd() * 5, 0.5 + rnd() * 0.5);
      }
    } else if (t === 4) {
      for (let i = 0; i < 150; i++) {
        const r = Math.sqrt(rnd()) * S * 0.44, a2 = rnd() * TAU;
        const x = cx + Math.cos(a2) * r * 1.12, y = cy + Math.sin(a2) * r;
        star(x, y, rnd() < 0.12 ? 2.6 : 1.4, 0.25 + rnd() * 0.6);
      }
      for (let i = 0; i < 7; i++) {
        const r = Math.sqrt(rnd()) * S * 0.30, a2 = rnd() * TAU;
        const x = cx + Math.cos(a2) * r, y = cy + Math.sin(a2) * r;
        glow(x, y, 7 + rnd() * 6, 0.55); star(x, y, 2.4, 1.0);
      }
    } else if (t === 5) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.49);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.42)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 220; i++) {
        const r = Math.pow(rnd(), 1.8) * S * 0.48, a2 = rnd() * TAU;
        star(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, rnd() < 0.1 ? 2.2 : 1.2, 0.25 + rnd() * 0.6);
      }
      glow(cx, cy, 14, 0.9);
    } else if (t === 6) {
      glow(cx - S * 0.10, cy + S * 0.04, S * 0.40, 0.50);
      glow(cx + S * 0.14, cy - S * 0.10, S * 0.34, 0.42);
      glow(cx + S * 0.02, cy + S * 0.02, S * 0.26, 0.55);
      glow(cx + S * 0.06, cy - S * 0.02, S * 0.10, 0.95);
      for (let i = 0; i < 18; i++) {
        const r = Math.sqrt(rnd()) * S * 0.34, a2 = rnd() * TAU;
        star(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, 1.4, 0.2 + rnd() * 0.4);
      }
    } else {
      const gr = g.createRadialGradient(cx, cy, S * 0.10, cx, cy, S * 0.46);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.16)');
      gr.addColorStop(0.78, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.92, 'rgba(255,255,255,0.25)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      star(cx, cy, 2.0, 0.9);
    }
    g.restore();
  }
  /* per-tile stats */
  const out = [];
  const data = g.getImageData(0, 0, W, H).data;
  for (let t = 0; t < 8; t++) {
    const x0 = (t % 2) * S, y0 = Math.floor(t / 2) * S;
    let sum = 0, max = 0, nz = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = (y0 + y) * W + (x0 + x);
      const v = data[p * 4];
      sum += v; if (v > max) max = v; if (v > 8) nz++;
    }
    out.push({ tile: t, mean: +(sum / (S * S)).toFixed(2), max, nonzero: nz });
  }
  return { canvasSize: [W, H], tiles: out };
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
