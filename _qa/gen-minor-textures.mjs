/* Deterministic procedural surface maps (1024x512, equirectangular) for the
 * minor planets & major moons where no global imagery exists at this scale.
 *
 * Each body gets a body-specific recipe: seeded mottle (soft radial blobs,
 * wrap-aware) + characteristic features (Io's sulfur volcanoes, Europa's
 * lineae, Iapetus' two-tone face, Phobos' cratering, ...). Same seed +
 * recipe => byte-stable output, so the committed data-URLs are reproducible.
 *
 * Output: _qa/_minor_<body>.jpg  (1024x512, JPEG q0.82)
 * Run from the _qa dir:  node _qa/gen-minor-textures.mjs [body|all]
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const EXE = 'C:\\Users\\press\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const ROOT = 'C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/';
const W = 1024, H = 512;

/* ---------- seeded rng -------------------------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- canvas recipe helpers --------------------------------------- */
/* Every recipe receives (g, rnd) — a 2d context and a seeded RNG — and
 * draws onto the pre-cleared 1024x512 canvas. Blobs are drawn with a
 * wrap-duplicate at x±W so the equirect seam stays clean. */
function blob(g, rnd, x, y, r, color, alpha) {
  for (const dx of [-W, 0, W]) {
    const grad = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
    grad.addColorStop(0, colorWithA(color, alpha));
    grad.addColorStop(1, colorWithA(color, 0));
    g.fillStyle = grad;
    g.beginPath(); g.arc(x + dx, y, r, 0, 7); g.fill();
  }
}
function colorWithA(hexc, a) {
  const n = parseInt(hexc.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function mottle(g, rnd, n, rMin, rMax, colors, aMin, aMax) {
  for (let i = 0; i < n; i++) {
    blob(g, rnd, rnd() * W, rnd() * H, rMin + rnd() * (rMax - rMin),
      colors[Math.floor(rnd() * colors.length)], aMin + rnd() * (aMax - aMin));
  }
}
function craters(g, rnd, n, rMin, rMax, dark, light) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = H * 0.08 + rnd() * H * 0.84, r = rMin + rnd() * (rMax - rMin);
    for (const dx of [-W, 0, W]) {
      g.fillStyle = colorWithA(dark, 0.10 + rnd() * 0.18);
      g.beginPath(); g.arc(x + dx, y, r, 0, 7); g.fill();
      if (rnd() < 0.3) {   /* fresh crater: bright rim speck */
        g.fillStyle = colorWithA(light, 0.25 + rnd() * 0.3);
        g.beginPath(); g.arc(x + dx + r * 0.4, y - r * 0.3, r * 0.5, 0, 7); g.fill();
      }
    }
  }
}
/* one wandering line (Europa lineae style) */
function streak(g, rnd, color, width, alpha) {
  let x = rnd() * W, y = rnd() * H;
  const steps = 20 + Math.floor(rnd() * 30);
  g.strokeStyle = colorWithA(color, alpha); g.lineWidth = width; g.lineCap = 'round';
  for (const dx of [-W, 0, W]) {
    g.beginPath();
    let px = x + dx, py = y;
    g.moveTo(px, py);
    for (let i = 0; i < steps; i++) {
      px += (rnd() - 0.5) * 34; py += (rnd() - 0.5) * 34;
      py = Math.max(4, Math.min(H - 4, py));
      g.lineTo(px, py);
    }
    g.stroke();
  }
}

/* ---------- per-body recipes -------------------------------------------- */
const RECIPES = {
  io(g, rnd) {
    g.fillStyle = '#d8c25a'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 14, 60, 140, ['#e8d068', '#b06828'], 0.2, 0.38);  /* sulfur plains */
    mottle(g, rnd, 90, 20, 90, ['#c8963c', '#e8d878', '#b87830'], 0.12, 0.3);
    /* volcanic hot spots: red-brown pits with darker crowns */
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W, y = rnd() * H;
      blob(g, rnd, x, y, 14 + rnd() * 26, '#8a3a20', 0.5);
      blob(g, rnd, x, y, 4 + rnd() * 8, '#5a2412', 0.8);
    }
  },
  europa(g, rnd) {
    g.fillStyle = '#cfd6da'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 40, 40, 120, ['#dfe4e8', '#b8c0c8'], 0.10, 0.25);
    g.strokeStyle = 'rgba(120,84,60,1)';
    for (let i = 0; i < 46; i++) streak(g, rnd, '#7a5440', 1 + rnd() * 1.6, 0.25 + rnd() * 0.3);
    mottle(g, rnd, 14, 10, 30, ['#e8e4dc', '#9a8478'], 0.2, 0.4);
  },
  ganymede(g, rnd) {
    g.fillStyle = '#a8988a'; g.fillRect(0, 0, W, H);
    /* bright "young" terrae vs old dark highlands — high albedo contrast */
    mottle(g, rnd, 16, 90, 240, ['#cbb9a2'], 0.28, 0.45);
    mottle(g, rnd, 14, 90, 240, ['#6e6154'], 0.25, 0.45);
    craters(g, rnd, 700, 1.5, 5, '#4a413a', '#cfc0ac', 0.2, 0.45);
  },
  callisto(g, rnd) {
    g.fillStyle = '#7a7168'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 40, 50, 160, ['#8a8078', '#4e4840'], 0.2, 0.4);
    craters(g, rnd, 1500, 1.5, 5, '#3e3a34', '#c8beb2', 0.2, 0.5);
    mottle(g, rnd, 10, 30, 80, '#9a9088', 0.15, 0.3);  /* fresh ejecta */
  },
  titan(g, rnd) {
    g.fillStyle = '#c89858'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 30, 60, 160, ['#d8a868', '#b08040'], 0.06, 0.14);  /* hazy: low contrast */
    for (let i = 0; i < 6; i++) blob(g, rnd, rnd() * W, rnd() * H, 30 + rnd() * 60, '#8a5a30', 0.15);
  },
  triton(g, rnd) {
    g.fillStyle = '#c8d0d8'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 16, 60, 140, ['#e0e6ec', '#98a2ac'], 0.2, 0.34);
    mottle(g, rnd, 30, 40, 120, ['#d8dde2', '#a8b0b8'], 0.10, 0.22);
    blob(g, rnd, W * 0.3, H * 0.45, 150, '#e8f0f4', 0.35);   /* polar cap / bright spot */
    for (let i = 0; i < 8; i++) streak(g, rnd, '#8a94a0', 1.5, 0.18);
  },
  iapetus(g, rnd) {
    g.fillStyle = '#c8b8a8'; g.fillRect(0, 0, W, H);   /* leading (bright) hemisphere */
    mottle(g, rnd, 14, 60, 150, ['#dcccb8', '#96846e'], 0.2, 0.35);
    mottle(g, rnd, 40, 30, 90, ['#d8c8b8', '#a89888'], 0.10, 0.22);
    /* the dark leading-side band: soft-edged fade across one side */
    const grad = g.createLinearGradient(W * 0.55, 0, W, 0);
    grad.addColorStop(0, 'rgba(48,36,26,0)');
    grad.addColorStop(0.55, 'rgba(48,36,26,0.85)');
    grad.addColorStop(1, 'rgba(48,36,26,0.9)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(48,36,26,0.9)'; g.fillRect(0, 0, W * 0.12, H); /* wrap side of the dark band */
  },
  rhea(g, rnd) {
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 22, 60, 160, ['#e2e2e2', '#9c9c9c'], 0.2, 0.4);
    craters(g, rnd, 400, 1.5, 4.5, '#8a8a8a', '#f0f0f0', 0.18, 0.4);
  },
  phobos(g, rnd) {
    g.fillStyle = '#6a5f54'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 24, 50, 130, ['#7d7164', '#4e443c'], 0.2, 0.4);
    craters(g, rnd, 550, 1.5, 6, '#332c24', '#8a7e70', 0.2, 0.5);
    blob(g, rnd, W * 0.4, H * 0.55, 70, '#3f362c', 0.5);  /* Stickney */
  },
  deimos(g, rnd) {
    g.fillStyle = '#5f564c'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 24, 40, 110, ['#6e6354', '#484036'], 0.18, 0.35);
    craters(g, rnd, 300, 1.5, 5, '#2f2a22', '#8a8074', 0.18, 0.42);
  },
  charon(g, rnd) {
    g.fillStyle = '#a09890'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 24, 60, 150, ['#b8b0a6', '#766f66'], 0.2, 0.4);
    blob(g, rnd, W * 0.35, H * 0.5, 120, '#e2ddd6', 0.4);   /* Cthulhu Macula */
    blob(g, rnd, W * 0.7, H * 0.16, 80, '#8a4a34', 0.3);     /* northern tholin tint */
    craters(g, rnd, 260, 1.5, 4.5, '#5a544c', '#c8c2ba', 0.18, 0.4);
  },
  vesta(g, rnd) {
    g.fillStyle = '#8a7f72'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 22, 60, 170, ['#a29484', '#5e564c'], 0.22, 0.42);
    craters(g, rnd, 900, 1.5, 5.5, '#453e36', '#b0a89c', 0.2, 0.48);
    blob(g, rnd, W * 0.55, H * 0.86, 150, '#4a4238', 0.5);  /* Ray basin, south */
    mottle(g, rnd, 6, 40, 90, '#5a5248', 0.25, 0.4);        /* other basins */
  },
  pallas(g, rnd) {
    g.fillStyle = '#7d8a7a'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 22, 50, 150, ['#93a290', '#5c685c'], 0.22, 0.42);
    craters(g, rnd, 450, 1.5, 5, '#414b41', '#a8b0a4', 0.2, 0.45);
  },
  hygiea(g, rnd) {
    g.fillStyle = '#8f8a80'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 24, 50, 140, ['#a09a90', '#6e6960'], 0.2, 0.38);
    craters(g, rnd, 350, 1.5, 4.5, '#514c44', '#b0aca2', 0.18, 0.42);
  },
  ixion(g, rnd) {
    g.fillStyle = '#8a7050'; g.fillRect(0, 0, W, H);
    mottle(g, rnd, 24, 40, 120, ['#9c815c', '#62503a'], 0.22, 0.4);
    craters(g, rnd, 260, 1.5, 4.5, '#3e3222', '#a8906c', 0.18, 0.4);
  },
};

const BODIES = Object.keys(RECIPES);
const target = process.argv[2] === 'all' || !process.argv[2] ? BODIES : [process.argv[2]];
if (target.some(b => !RECIPES[b])) { console.error('unknown body: ' + target.filter(b => !RECIPES[b])); process.exit(1); }

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto('about:blank');

for (const name of target) {
  /* draw inside the page so canvas gradients work; run the recipe verbatim */
  const recipeSrc = RECIPES[name].toString();
  const shot = await page.evaluate(async (a) => {
    const recipeSrc = a.src, seed = a.seed;
    const W = 1024, H = 512;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const mulberry32 = (a => () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    })(seed);
    const rnd = mulberry32;
    const colorWithA = (hexc, a) => { const n = parseInt(hexc.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
    function blob(x, y, r, color, alpha) {
      for (const dx of [-W, 0, W]) {
        const grad = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        grad.addColorStop(0, colorWithA(color, alpha));
        grad.addColorStop(1, colorWithA(color, 0));
        g.fillStyle = grad;
        g.beginPath(); g.arc(x + dx, y, r, 0, 7); g.fill();
      }
    }
    const mottle = (n, rMin, rMax, colors, aMin, aMax) => {
      for (let i = 0; i < n; i++) blob(rnd() * W, rnd() * H, rMin + rnd() * (rMax - rMin), colors[Math.floor(rnd() * colors.length)], aMin + rnd() * (aMax - aMin));
    };
    const craters = (n, rMin, rMax, dark, light, aMin = 0.10, aMax = 0.28) => {
      for (let i = 0; i < n; i++) {
        const x = rnd() * W, y = H * 0.08 + rnd() * H * 0.84, r = rMin + rnd() * (rMax - rMin);
        for (const dx of [-W, 0, W]) {
          g.fillStyle = colorWithA(dark, aMin + rnd() * (aMax - aMin));
          g.beginPath(); g.arc(x + dx, y, r, 0, 7); g.fill();
          if (rnd() < 0.3) { g.fillStyle = colorWithA(light, 0.25 + rnd() * 0.3); g.beginPath(); g.arc(x + dx + r * 0.4, y - r * 0.3, r * 0.5, 0, 7); g.fill(); }
        }
      }
    };
    const streak = (color, width, alpha) => {
      let x = rnd() * W, y = rnd() * H;
      const steps = 20 + Math.floor(rnd() * 30);
      g.strokeStyle = colorWithA(color, alpha); g.lineWidth = width; g.lineCap = 'round';
      for (const dx of [-W, 0, W]) {
        g.beginPath();
        let px = x + dx, py = y;
        g.moveTo(px, py);
        for (let i = 0; i < steps; i++) { px += (rnd() - 0.5) * 34; py = Math.max(4, Math.min(H - 4, py + (rnd() - 0.5) * 34)); g.lineTo(px, py); }
        g.stroke();
      }
    };
    /* recipe is a function declaration (e.g. "io(g, rnd) { ... }") — append the call */
    /* "io(g, rnd) { ... }" is method shorthand (object-literal syntax only) —
       rewrite as a proper function expression before parsing */
    const fnSrc = recipeSrc.replace(/^(\w+)\s*\(([^)]*)\)\s*\{/, 'function $1($2) {');
    const make = new Function('g', 'rnd', 'W', 'H', 'blob', 'mottle', 'craters', 'streak',
      'return (' + fnSrc + ');');
    /* recipes call helpers as (g, rnd, ...); drop g/rnd before forwarding */
    const recipeFn = make(g, rnd, W, H,
       (g2, r2, x, y, r, c, a) => blob(x, y, r, c, a),
       (g2, r2, n, r0, r1, cs, a0, a1) => mottle(n, r0, r1, cs, a0, a1),
       (g2, r2, n, r0, r1, d, l, a0, a1) => craters(n, r0, r1, d, l, a0, a1),
       (g2, r2, c, w, a) => streak(c, w, a));
    recipeFn(g, rnd);
    return cv.toDataURL('image/jpeg', 0.82);
  }, { src: recipeSrc, seed: hash(name) });

  fs.writeFileSync(ROOT + '_qa/_minor_' + name + '.jpg', Buffer.from(shot.split(',')[1], 'base64'));
  console.log(name.padEnd(10), (fs.statSync(ROOT + '_qa/_minor_' + name + '.jpg').size / 1024).toFixed(0) + ' KB');
}
await browser.close();
console.log('done');
