/* ============================================================================
 * PERIHELION — sky mode (the celestial dome)
 * A 360-degree celestial sphere: a shader-driven starfield (field stars, the
 * Milky Way, named stars), constellation figures, the ecliptic, and glowing
 * sprites for the Sun, Moon and planets.
 * ==========================================================================*/
'use strict';
P.sky = (function () {
  const R = 100;          // celestial sphere radius
  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;

  /* deterministic RNG so the sky is identical every launch */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* B-V color index -> approximate RGB */
  const BV_STOPS = [
    [-0.35, [0.62, 0.69, 1.00]], [0.0, [0.68, 0.77, 1.00]], [0.3, [0.81, 0.87, 1.00]],
    [0.6, [0.92, 0.94, 1.00]], [0.9, [1.00, 0.96, 0.90]], [1.2, [1.00, 0.87, 0.69]],
    [1.5, [1.00, 0.75, 0.53]], [1.8, [1.00, 0.62, 0.42]], [2.3, [1.00, 0.50, 0.36]]
  ];
  function bvToColor(bv) {
    if (bv <= BV_STOPS[0][0]) return BV_STOPS[0][1].slice();
    for (let i = 0; i < BV_STOPS.length - 1; i++) {
      const a = BV_STOPS[i], b = BV_STOPS[i + 1];
      if (bv <= b[0]) {
        const t = (bv - a[0]) / (b[0] - a[0]);
        return [0, 1, 2].map(k => a[1][k] + (b[1][k] - a[1][k]) * t);
      }
    }
    return BV_STOPS[BV_STOPS.length - 1][1].slice();
  }

  /* RA/Dec (deg) -> world unit vector: (cos d cos a, sin d, -cos d sin a) */
  function raDecToVec3(ra, dec, out, radius) {
    const r = ra * DEG, d = dec * DEG;
    const cd = Math.cos(d);
    out.set(cd * Math.cos(r), Math.sin(d), -cd * Math.sin(r));
    if (radius) out.multiplyScalar(radius);
    return out;
  }

  function radialTexture(stops) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    for (const [t, col] of stops) grd.addColorStop(t, col);
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  function planetDiscTexture(hex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const col = '#' + hex.toString(16).padStart(6, '0');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0.0, col);
    grd.addColorStop(0.72, col);
    grd.addColorStop(0.88, 'rgba(255,255,255,0.30)');
    grd.addColorStop(1.0, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function ringTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.save();
    g.translate(128, 128);
    const bands = [
      [0.30, 0.40, 70], [0.44, 0.56, 100], [0.60, 0.70, 60], [0.78, 0.90, 95], [0.92, 0.99, 55]
    ];
    for (const [a, b, alpha] of bands) {
      g.beginPath();
      g.arc(0, 0, 128 * (a + b) / 2, 0, TAU);
      g.strokeStyle = 'rgba(216,196,158,' + (alpha / 100) + ')';
      g.lineWidth = 128 * (b - a);
      g.stroke();
    }
    g.restore();
    return new THREE.CanvasTexture(c);
  }

  const SUN_TEX = radialTexture([
    [0.0, 'rgba(255,255,248,1)'], [0.14, 'rgba(255,241,204,0.98)'], [0.30, 'rgba(255,200,110,0.55)'],
    [0.62, 'rgba(255,150,60,0.14)'], [1.0, 'rgba(255,120,30,0)']
  ]);
  const MOON_TEX = radialTexture([
    [0.0, 'rgba(226,229,235,1)'], [0.8, 'rgba(206,210,220,1)'], [0.92, 'rgba(190,195,205,0.5)'], [1, 'rgba(190,195,205,0)']
  ]);
  const GLOW_TEX = radialTexture([
    [0, 'rgba(255,255,255,0.9)'], [0.25, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']
  ]);

  const STAR_VERT = `
    attribute float aMag;
    attribute vec3 aColor;
    attribute float aPhase;
    attribute float aFaint;
    uniform float uTime;
    uniform float uPx;
    uniform float uTw;
    uniform float uSoft;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vColor = aColor;
      float size = (0.9 + max(0.0, 6.9 - aMag) * 0.45) * uSoft;
      float tw = 1.0;
      if (aMag < 4.6) {
        float base = 0.82 + 0.18 * sin(uTime * (0.7 + aPhase * 2.3) + aPhase * 40.0);
        tw = 1.0 + (base - 1.0) * uTw;   /* uTw=0 (video demos) → constant brightness */
      }
      /* energy-conserving: the wider soft profile spreads the same light */
      vAlpha = aFaint * tw / (uSoft * uSoft);
      gl_PointSize = size * uPx;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  /* --------------------------------------------------------------- galaxies
   * Real extragalactic objects (js/dso.js): instanced textured planes on the
   * celestial dome. Each instance carries its own world-space basis vectors
   * (major/minor axis, oriented by the object's position angle) so the disk
   * geometry is exact for every galaxy — no per-frame matrix work.
   * The atlas (4 procedural tiles: spiral / barred / elliptical / irregular)
   * is generated once at startup; everything stays offline. */
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
  /* soft round sprite for the 18k faint background galaxies (1-3 px each) */
  const GALP_VERT = `
    attribute float aMag;
    attribute float aSize;
    attribute vec3 aCol;
    uniform float uPxPerArc;
    varying vec3 vCol;
    varying float vA;
    void main() {
      vCol = aCol;
      float sz = clamp(aSize * uPxPerArc, 1.2, 28.0);
      gl_PointSize = sz;
      float a = aMag < 0.0 ? 0.30 : (aMag <= 10.0 ? 0.5 : max(0.0, 0.5 * (1.0 - (aMag - 10.0) / 8.5)));
      vA = a * clamp(sz / 7.0, 0.45, 1.15) * 0.9;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const GALP_FRAG = `
    varying vec3 vCol;
    varying float vA;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c) * 2.0;
      float a = (pow(max(0.0, 1.0 - d), 2.0) * 0.9 + smoothstep(1.0, 0.15, d) * 0.25) * vA;
      if (a < 0.006) discard;
      gl_FragColor = vec4(vCol * a, a);
    }`;
  /* galaxy / DSO type string -> atlas tile
     (0 spiral, 1 barred, 2 elliptical, 3 irregular,
       4 open cluster, 5 globular cluster, 6 nebula, 7 planetary nebula) */
  function dsoTile(type) {
    const t = String(type || '').toUpperCase().trim();
    if (!t) return 0;
    if (/OPEN CLUSTER|DOUBLE CLUSTER|OPEN STAR CLUSTER/.test(t)) return 4;
    if (/GLOBULAR/.test(t)) return 5;
    if (/PLANETARY NEBULA/.test(t)) return 7;
    if (/NEBULA|SUPERNOVA REMNANT|REMNANT/.test(t)) return 6;
    if (/ELLIP|LENTIC/.test(t)) return 2;
    if (/^E\d/.test(t)) return 2;
    if (/IRREG|DWARF/.test(t)) return 3;
    if (/^[A-Z0-9()' ]+$/.test(t)) {          /* hubble-type code: S0, SB0, SAB(S)BC, (R')SAB(S)0, … */
      if (/S0|SB0|\)0/.test(t)) return 2;
      if (/SB|BARRED/.test(t)) return 1;
      return 0;
    }
    if (/BARRED/.test(t)) return 1;
    return 0;
  }

  function galaxyAtlas() {
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
    const star = (x, y, r, a) => {
      g.fillStyle = 'rgba(255,255,255,' + a + ')';
      g.fillRect(x - r / 2, y - r / 2, r, r);
    };
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    /* gaussian-ish scatter (sum of two uniforms) */
    const gauss = () => (rnd() + rnd() - 1);
    for (let t = 0; t < 8; t++) {
      g.save();
      g.translate((t % 2) * S, Math.floor(t / 2) * S);
      const cx = S / 2, cy = S / 2;
      if (t === 0) {
        /* face-on spiral — bright cored disc with two dense arms */
        glow(cx, cy, S * 0.49, 0.28);           /* outer diffuse halo */
        glow(cx, cy, S * 0.36, 0.26);           /* disc body (kept soft so arms show) */
        glow(cx, cy, S * 0.20, 0.32);           /* inner disc */
        g.filter = 'blur(8px)';
        g.lineCap = 'round';
        for (let arm = 0; arm < 4; arm++) {
          const major = arm < 2;
          const off = (arm % 2) * Math.PI;     /* 2-armed pattern, 2 passes */
          g.beginPath();
          for (let s2 = 0; s2 <= 44; s2++) {
            const u = s2 / 44;
            const r = 8 + u * (S * 0.47 - 10);
            const a2 = (major ? off : off + 0.55) + u * 3.1;
            const x = cx + Math.cos(a2) * r, y = cy + Math.sin(a2) * r;
            s2 === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
          }
          g.strokeStyle = major ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.34)';
          g.lineWidth = major ? 24 : 14;
          g.stroke();
        }
        g.filter = 'blur(2px)';
        for (let i = 0; i < 320; i++) {        /* star grains in the disc */
          const r = Math.sqrt(rnd()) * S * 0.46, a2 = rnd() * TAU;
          g.fillStyle = 'rgba(255,255,255,' + (0.10 + rnd() * 0.30) + ')';
          g.fillRect(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, 1.4, 1.4);
        }
        g.filter = 'none';
        glow(cx, cy, 40, 0.95); glow(cx, cy, 16, 1.0);
      } else if (t === 1) {
        /* barred spiral — glowing bar + two arms */
        glow(cx, cy, S * 0.47, 0.30);
        g.filter = 'blur(6px)';
        g.save(); g.translate(cx, cy); g.scale(1, 0.38);
        glow(0, 0, 88, 0.85);
        g.restore();
        g.lineCap = 'round';
        for (const s3 of [-1, 1]) {
          g.beginPath();
          g.moveTo(cx + 46 * s3, cy);
          g.quadraticCurveTo(cx + 84 * s3, cy + 30 * s3, cx + 100 * s3, cy + 66 * s3);
          g.strokeStyle = 'rgba(255,255,255,0.5)';
          g.lineWidth = 16;
          g.stroke();
          g.beginPath();
          g.moveTo(cx + 46 * s3, cy);
          g.quadraticCurveTo(cx + 80 * s3, cy - 24 * s3, cx + 92 * s3, cy - 48 * s3);
          g.strokeStyle = 'rgba(255,255,255,0.28)';
          g.lineWidth = 10;
          g.stroke();
        }
        g.filter = 'none';
        glow(cx, cy, 26, 1.0);
      } else if (t === 2) {
        /* elliptical — smooth, cored, no structure */
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.49);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.3, 'rgba(255,255,255,0.72)');
        gr.addColorStop(0.6, 'rgba(255,255,255,0.34)');
        gr.addColorStop(0.85, 'rgba(255,255,255,0.12)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
      } else if (t === 3) {
        /* irregular / starburst — lumpy */
        glow(cx - 10, cy + 8, S * 0.34, 0.6);
        glow(cx + 22, cy - 16, S * 0.26, 0.55);
        glow(cx - 30, cy - 12, S * 0.20, 0.5);
        glow(cx, cy, 34, 0.95);
        for (let i = 0; i < 30; i++) {
          const a2 = rnd() * TAU, r = rnd() * S * 0.4;
          glow(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, 3 + rnd() * 5, 0.5 + rnd() * 0.5);
        }
      } else if (t === 4) {
        /* open cluster — a loose, asymmetric swarm of distinct stars */
        for (let i = 0; i < 150; i++) {
          const r = Math.sqrt(rnd()) * S * 0.44, a2 = rnd() * TAU;
          const x = cx + Math.cos(a2) * r * 1.12, y = cy + Math.sin(a2) * r;
          const bright = 0.25 + rnd() * 0.6;
          star(x, y, rnd() < 0.12 ? 2.6 : 1.4, bright);
        }
        for (let i = 0; i < 7; i++) {          /* a few bright members with halos */
          const r = Math.sqrt(rnd()) * S * 0.30, a2 = rnd() * TAU;
          const x = cx + Math.cos(a2) * r, y = cy + Math.sin(a2) * r;
          glow(x, y, 7 + rnd() * 6, 0.55);
          star(x, y, 2.4, 1.0);
        }
      } else if (t === 5) {
        /* globular cluster — dense smooth core, stars fading to the rim */
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.49);
        gr.addColorStop(0, 'rgba(255,255,255,0.85)');
        gr.addColorStop(0.25, 'rgba(255,255,255,0.42)');
        gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 220; i++) {
          const r = Math.pow(rnd(), 1.8) * S * 0.48, a2 = rnd() * TAU;
          star(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, rnd() < 0.1 ? 2.2 : 1.2, 0.25 + rnd() * 0.6);
        }
        glow(cx, cy, 14, 0.9);
      } else if (t === 6) {
        /* diffuse nebula — soft irregular glow with a bright knot */
        glow(cx - S * 0.10, cy + S * 0.04, S * 0.40, 0.50);
        glow(cx + S * 0.14, cy - S * 0.10, S * 0.34, 0.42);
        glow(cx + S * 0.02, cy + S * 0.02, S * 0.26, 0.55);
        glow(cx + S * 0.06, cy - S * 0.02, S * 0.10, 0.95);   /* bright core knot */
        for (let i = 0; i < 18; i++) {
          const r = Math.sqrt(rnd()) * S * 0.34, a2 = rnd() * TAU;
          star(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, 1.4, 0.2 + rnd() * 0.4);
        }
      } else {
        /* planetary nebula — bright hollow ring around a tiny core */
        const gr = g.createRadialGradient(cx, cy, S * 0.10, cx, cy, S * 0.46);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(0.55, 'rgba(255,255,255,0.16)');
        gr.addColorStop(0.78, 'rgba(255,255,255,0.9)');
        gr.addColorStop(0.92, 'rgba(255,255,255,0.25)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
        star(cx, cy, 2.0, 0.9);
      }
      g.restore();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }
  const STAR_FRAG = `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c) * 2.0;
      float core = smoothstep(1.0, 0.0, d);
      core = pow(core, 1.9);
      float halo = smoothstep(1.0, 0.15, d) * 0.35;
      float a = (core + halo) * vAlpha;
      if (a < 0.008) discard;
      gl_FragColor = vec4(vColor * (0.75 + 0.55 * core), a);
    }`;

  /* ---------------------------------------------------------------- build */
  function build(scene) {
    const dome = new THREE.Group();      // stars, constellations, ecliptic
    const bodies = new THREE.Group();    // Sun / Moon / planet sprites
    scene.add(dome);
    scene.add(bodies);
    const rand = mulberry32(0x5eed2024);

    /* ---- star catalog buffers ---------------------------------------------
     * Every point below is a real Hipparcos catalog star (js/stars-hip.js).
     * The galactic plane / Milky Way emerges naturally from the real data. */
    function hipStars() {
      if (P.starsHip) {
        const bin = atob(P.starsHip.b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Float32Array(bytes.buffer);
      }
      return null;
    }
    const hip = hipStars();

    /* ID + name references for the catalog stars (js/stars-named.js) */
    function idArrays() {
      if (!P.starIds) return null;
      const d32 = b64 => {
        const s = atob(b64);
        const u = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        return new Int32Array(u.buffer);
      };
      return { hip: d32(P.starIds.hip), hd: d32(P.starIds.hd) };
    }
    const ids = hip ? idArrays() : null;
    const namedByBuf = new Map();   // buffer index -> {name, refs}
    if (P.starNamed) for (const [i, name, refs] of P.starNamed.data) namedByBuf.set(i, { name, refs });

    const N = (hip ? hip.length / 4 : 0) + P.stars.length;
    const pos = new Float32Array(N * 3);
    const mag = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const pha = new Float32Array(N);
    const fnt = new Float32Array(N);

    let k = 0;
    function putStar(x, y, z, m, bv, faint) {
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      mag[k] = m; fnt[k] = faint; pha[k] = rand();
      const c = bvToColor(bv);
      col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
      k++;
    }
    const v = new THREE.Vector3();

    /* real catalog stars (magnitude-faded past the naked-eye limit) */
    if (hip) {
      for (let i = 0; i < hip.length / 4; i++) {
        const ra = hip[i * 4], dec = hip[i * 4 + 1], m = hip[i * 4 + 2], bv = hip[i * 4 + 3];
        raDecToVec3(ra, dec, v, R);
        const faint = m < 7 ? 1.0 : Math.max(0, 1 - (m - 7) / 4.5);
        putStar(v.x, v.y, v.z, m, bv, faint);
      }
    }

    /* named catalog stars */
    const named = [];
    for (const [name, ra, dec, m, bv, dist] of P.stars) {
      const p = raDecToVec3(ra, dec, new THREE.Vector3(), R);
      putStar(p.x, p.y, p.z, m, bv, 1.0);
      named.push({ name, ra, dec, mag: m, bv, dist, world: p });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
    geo.setAttribute('aFaint', new THREE.BufferAttribute(fnt, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uTw: { value: 1 }, uSoft: { value: 1 } },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    dome.add(points);

    /* video demos (#demo*): freeze the twinkle. The ±18 % brightness pulse on
       sub-2-px stars is what made the small stars look like they flickered and
       jumped when the sky was moving — interactive mode keeps the twinkle. */
    if (/demo/.test(location.hash)) mat.uniforms.uTw.value = 0;

    /* soft glow halos for the brightest named stars */
    for (const s of named) {
      if (s.mag < 1.1) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: GLOW_TEX, transparent: true, opacity: 0.8,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        const sc = 0.28 + Math.max(0, 1.3 - s.mag) * 0.2;
        sp.scale.set(sc, sc, 1);
        sp.position.copy(s.world);
        dome.add(sp);
      }
    }

    /* ---- galaxies (js/dso.js) -------------------------------------------
     * Two real extragalactic layers, both on the celestial dome:
     *  1. bright — P.dso (624 galaxies, V < 11.5): instanced textured quads,
     *     oriented by each object's position angle, shaded from the 4-tile
     *     procedural atlas (spiral / barred / elliptical / irregular).
     *  2. faint  — P.dsoFaint (18,304 background galaxies): one soft-point
     *     draw call. All positions are real J2000 catalog data (NGC 2000.0
     *     + UGC 1973), sizes in arcminutes, colours from B−V. */
    const dsoList = [];
    let galaxyFaintMat = null;
    
    if (P.dso || P.dsoFaint) {
      const atlasTex = galaxyAtlas();

      /* ---- bright: instanced quads ------------------------------------ */
      if (P.dso && P.dso.length) {
        const NB = P.dso.length;
        const iOff = new Float32Array(NB * 3);
        const iXh = new Float32Array(NB * 3);
        const iYh = new Float32Array(NB * 3);
        const iSize = new Float32Array(NB * 2);
        const iUV = new Float32Array(NB * 4);
        const iCol = new Float32Array(NB * 3);
        const iAlpha = new Float32Array(NB);
        const g = new THREE.Vector3();
        for (let i = 0; i < NB; i++) {
          const r = P.dso[i];
          raDecToVec3(r[1], r[2], g, R);
          iOff[i * 3] = g.x; iOff[i * 3 + 1] = g.y; iOff[i * 3 + 2] = g.z;
          /* tangent-plane basis: N = increasing dec, E = increasing RA */
          const a = r[1] * DEG, dd = r[2] * DEG;
          const cd = Math.cos(dd), sd = Math.sin(dd);
          const Nx = -sd * Math.cos(a), Ny = cd, Nz = -sd * Math.sin(a);
          const Ex = -cd * Math.sin(a), Ey = 0, Ez = -cd * Math.cos(a);
          const pa = (r[8] || 0) * DEG;
          const cp = Math.cos(pa), sp = Math.sin(pa);
          /* major axis at position angle (from North toward East) */
          iXh[i * 3] = cp * Nx + sp * Ex;
          iXh[i * 3 + 1] = cp * Ny + sp * Ey;
          iXh[i * 3 + 2] = cp * Nz + sp * Ez;
          iYh[i * 3] = -sp * Nx + cp * Ex;
          iYh[i * 3 + 1] = -sp * Ny + cp * Ey;
          iYh[i * 3 + 2] = -sp * Nz + cp * Ez;
          const tile = dsoTile(r[4]);
          const maj = r[5] != null ? r[5] : 3;
          let mino = r[6];
          if (mino == null || mino <= 0) mino = maj * (tile === 2 ? 0.5 : 0.62);
          iSize[i * 2] = R * maj * DEG / 60;
          iSize[i * 2 + 1] = R * mino * DEG / 60;
          iUV[i * 4] = (tile & 1) * 0.5;
          iUV[i * 4 + 1] = (3 - (tile >> 1)) * 0.25;
          iUV[i * 4 + 2] = 0.5; iUV[i * 4 + 3] = 0.25;
          const c = bvToColor(r[9] == null ? 0.8 : r[9]);
          iCol[i * 3] = c[0]; iCol[i * 3 + 1] = c[1]; iCol[i * 3 + 2] = c[2];
          const m = r[3];
          iAlpha[i] = m == null ? 0.45 : Math.max(0.10, m < 9 ? 0.95 : 0.95 - (m - 9) * 0.13);
          dsoList.push({ row: r, world: g.clone() });
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
        const gmat = new THREE.ShaderMaterial({
          uniforms: { uAtlas: { value: atlasTex } },
          vertexShader: GAL_VERT,
          fragmentShader: GAL_FRAG,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          /* additive via ONE/ONE: the fragment already multiplies by its own
             alpha — default AdditiveBlending would apply the alpha twice (a²),
             crushing the faint outer discs */
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
          side: THREE.DoubleSide
        });
        const gm = new THREE.Mesh(ggeo, gmat);
        gm.frustumCulled = false;
        gm.renderOrder = 2;
        dome.add(gm);
      }

      /* ---- faint: one soft-point draw call ------------------------------
       * P.dsoFaint (18k galaxies) + P.dsoFaint2 (faint clusters/nebulae) are
       * merged into one draw call; row = [ra, dec, v, sizeArcmin, bV, tile]. */
      if (P.dsoFaint || P.dsoFaint2) {
        const srcs = [P.dsoFaint, P.dsoFaint2].filter(Boolean);
        const NF = srcs.reduce((a, d) => a + d.n, 0);
        const f32 = new Float32Array(NF * 6);
        {
          let o = 0;
          for (const d of srcs) {
            const bin = atob(d.b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            f32.set(new Float32Array(bytes.buffer, 0, Math.min(d.n * 6, (bytes.length / 4) | 0)), o);
            o += d.n * 6;
          }
        }
        const fpos = new Float32Array(NF * 3);
        const fmag = new Float32Array(NF);
        const fsize = new Float32Array(NF);
        const fcol = new Float32Array(NF * 3);
        const fv = new THREE.Vector3();
        for (let i = 0; i < NF; i++) {
          const ra = f32[i * 6], dec = f32[i * 6 + 1], v = f32[i * 6 + 2];
          raDecToVec3(ra, dec, fv, R);
          fpos[i * 3] = fv.x; fpos[i * 3 + 1] = fv.y; fpos[i * 3 + 2] = fv.z;
          fmag[i] = v; fsize[i] = f32[i * 6 + 3];
          const c = bvToColor(f32[i * 6 + 4]);
          fcol[i * 3] = c[0]; fcol[i * 3 + 1] = c[1]; fcol[i * 3 + 2] = c[2];
        }
        const fgeo = new THREE.BufferGeometry();
        fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
        fgeo.setAttribute('aMag', new THREE.BufferAttribute(fmag, 1));
        fgeo.setAttribute('aSize', new THREE.BufferAttribute(fsize, 1));
        fgeo.setAttribute('aCol', new THREE.BufferAttribute(fcol, 3));
        galaxyFaintMat = new THREE.ShaderMaterial({
          uniforms: { uPxPerArc: { value: 0 } },
          vertexShader: GALP_VERT,
          fragmentShader: GALP_FRAG,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          /* ONE/ONE: fragment is already premultiplied (see GALP_FRAG) */
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor
        });
        const fm = new THREE.Points(fgeo, galaxyFaintMat);
        fm.frustumCulled = false;
        fm.renderOrder = 1;
        dome.add(fm);
      }
    }

    /* ---- Milky Way wash: soft band along the real galactic plane ----------
     * A triangle-strip ring (96 longitude steps × 5 latitude rows, b ± 7°)
     * follows the true galactic plane, anchored by two exact references:
     *   NGP  RA 192.85948°, +27.12825°   (galactic north pole, IAU/standard)
     *   GC   RA 266.4051°,  −28.9362°    (galactic centre, l = 0 b = 0)
     * The band texture is procedural (width envelope + arm knots + bulge),
     * additive at very low alpha so the real stars stay dominant.
     * Toggle: HUD "MILKY WAY" button / key W (state.galaxyWash). */
    let galaxyWash = null;
    {
      /* galactic (l°, b°) -> equatorial cartesian unit vector.
         X = l=0 axis (galactic centre), Z = NGP, Y = Z×X (right-handed) */
      const galEq = (function () {
        const d2r = Math.PI / 180;
        const eq = (ra, dec) => {
          const d = dec * d2r, a = ra * d2r, cd = Math.cos(d);
          return [cd * Math.cos(a), cd * Math.sin(a), Math.sin(d)];
        };
        const X = eq(266.4051, -28.9362);
        const Z = eq(192.85948, 27.12825);
        let Y = [Z[1] * X[2] - Z[2] * X[1], Z[2] * X[0] - Z[0] * X[2], Z[0] * X[1] - Z[1] * X[0]];
        const L = Math.hypot(Y[0], Y[1], Y[2]);
        Y = [Y[0] / L, Y[1] / L, Y[2] / L];
        return (lDeg, bDeg) => {
          const l = lDeg * d2r, b = bDeg * d2r;
          const cb = Math.cos(b), cl = Math.cos(l), sl = Math.sin(l), sb = Math.sin(b);
          const g0 = cb * cl, g1 = cb * sl, g2 = sb;
          return [X[0] * g0 + Y[0] * g1 + Z[0] * g2,
                  X[1] * g0 + Y[1] * g1 + Z[1] * g2,
                  X[2] * g0 + Y[2] * g1 + Z[2] * g2];
        };
      })();
      { /* self-check: l=0 must land on the galactic centre (Dec −28.94°) */
        const gc = galEq(0, 0);
        if (Math.asin(Math.max(-1, Math.min(1, gc[2]))) * 180 / Math.PI > -25) {
          console.warn('MILKY WAY: galactic frame self-check failed');
        }
      }

      /* procedural band texture: 512 (longitude) × 128 (latitude) */
      const atlas = (() => {
        const W = 512, H = 128;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d');
        const img = g.createImageData(W, H);
        const d = img.data;
        let seed = 20260830;
        const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
        const knots = [];
        for (let k = 0; k < 30; k++) {
          knots.push({ l: rnd() * 360, b: (rnd() * 2 - 1) * 5.5, w: 3 + rnd() * 11, h: 1.2 + rnd() * 2.6, a: 0.16 + rnd() * 0.34, dust: rnd() < 0.35 });
        }
        knots.push({ l: 0, b: -1, w: 16, h: 9, a: 0.50 });    /* bulge, l ≈ 0   */
        knots.push({ l: 60, b: -4, w: 14, h: 5, a: 0.42 });  /* Sgr–Scutum arm */
        knots.push({ l: 150, b: 3, w: 16, h: 5, a: 0.34 });  /* Perseus arm    */
        const ang = (a, b) => { const x = Math.abs(a - b) % 360; return x > 180 ? 360 - x : x; };
        for (let y = 0; y < H; y++) {
          const b = 7 - (y / (H - 1)) * 14;           /* canvas row 0 = b +7° */
          for (let x = 0; x < W; x++) {
            const l = (x / W) * 360;
            let a = 0.5 * Math.exp(-Math.pow(b / 3.6, 2));
            let warm = 0;
            for (const k of knots) {
              const dd = Math.pow(ang(l, k.l) / k.w, 2) + Math.pow((b - k.b) / k.h, 2);
              const wgt = Math.exp(-dd);
              if (k.dust) a -= k.a * 0.5 * wgt;
              else { a += k.a * wgt; if (k.b < 0) warm += wgt; }
            }
            a = Math.max(0, Math.min(1, a));
            const i4 = (y * W + x) * 4;
            d[i4] = 255;
            d[i4 + 1] = Math.round(246 - 20 * warm);
            d[i4 + 2] = Math.round(228 - 46 * warm);
            d[i4 + 3] = Math.round(a * 255);
          }
        }
        g.putImageData(img, 0, 0);
        const t = new THREE.CanvasTexture(c);
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        return t;
      })();

      const NW = 96;
      const ROWS = [7, 3.5, 0, -3.5, -7];
      const wpos = new Float32Array((NW + 1) * ROWS.length * 3);
      const wuv = new Float32Array((NW + 1) * ROWS.length * 2);
      const RW = R - 1.5;   /* just inside the star dome */
      for (let i = 0; i <= NW; i++) {
        const l = (i / NW) * 360;
        for (let j = 0; j < ROWS.length; j++) {
          const e = galEq(l, ROWS[j]);
          const k = (i * ROWS.length + j) * 3;
          wpos[k] = e[0] * RW; wpos[k + 1] = e[2] * RW; wpos[k + 2] = -e[1] * RW;
          wuv[i * ROWS.length * 2 + j * 2] = i / NW;
          wuv[i * ROWS.length * 2 + j * 2 + 1] = (ROWS[j] + 7) / 14;
        }
      }
      const widx = [];
      for (let i = 0; i < NW; i++) {
        for (let j = 0; j < ROWS.length - 1; j++) {
          const a = i * ROWS.length + j, b = a + 1, c = a + ROWS.length, e = c + 1;
          widx.push(a, b, c, b, e, c);
        }
      }
      const wgeo = new THREE.BufferGeometry();
      wgeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
      wgeo.setAttribute('uv', new THREE.BufferAttribute(wuv, 2));
      wgeo.setIndex(widx);
      const wmat = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: atlas }, uWash: { value: 0.09 } },
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform sampler2D uTex;
          uniform float uWash;
          varying vec2 vUv;
          void main() {
            vec4 t = texture2D(uTex, vUv);
            float a = t.a * uWash;
            if (a < 0.004) discard;
            gl_FragColor = vec4(t.rgb * a, a);
          }`,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        /* ONE/ONE: fragment is already premultiplied by alpha */
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        side: THREE.DoubleSide
      });
      galaxyWash = new THREE.Mesh(wgeo, wmat);
      galaxyWash.frustumCulled = false;
      galaxyWash.renderOrder = 1;
      dome.add(galaxyWash);
    }

    /* ---- constellation lines --------------------------------------------- */
    /* split into the 12 zodiac figures (P.zodiac) and the rest so the two
       groups can be toggled independently (ZODIAC toggle, key Z) */
    const byName = new Map(named.map(s => [s.name, s]));
    const linePos = [], zPos = [];
    const zodiacSet = new Set(P.zodiac || []);
    for (const [cname, pairs] of P.constellations) {
      const arr = zodiacSet.has(cname) ? zPos : linePos;
      for (const [na, nb] of pairs) {
        const A = byName.get(na), B = byName.get(nb);
        if (!A || !B) continue;
        arr.push(A.world.x, A.world.y, A.world.z, B.world.x, B.world.y, B.world.z);
      }
    }
    const figMat = new THREE.LineBasicMaterial({ color: 0x3f6f9f, transparent: true, opacity: 0.4, depthWrite: false });
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePos), 3));
    const constellations = new THREE.LineSegments(cGeo, figMat);
    constellations.frustumCulled = false;
    dome.add(constellations);
    const zGeo = new THREE.BufferGeometry();
    zGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(zPos), 3));
    const constellationsZodiac = new THREE.LineSegments(zGeo, figMat);
    constellationsZodiac.frustumCulled = false;
    dome.add(constellationsZodiac);

    /* ---- asterisms (classic cross-constellation figures) ---------------- */
    const aPos = [];
    const _av = new THREE.Vector3();
    const starByName = new Map(named.map(s => [s.name, s.world]));
    const aPoint = (v) => {
      if (typeof v === 'string') {
        const s = starByName.get(v);
        if (s) return s;
        return null;
      }
      raDecToVec3(v[0], v[1], _av, R);
      return _av;
    };
    for (const a of (P.asterisms || [])) {
      for (const [na, nb] of a.lines) {
        const A = aPoint(na), B = aPoint(nb);
        if (!A || !B) continue;
        aPos.push(A.x, A.y, A.z, B.x, B.y, B.z);
      }
    }
    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(aPos), 3));
    const asterisms = new THREE.LineSegments(aGeo,
      new THREE.LineBasicMaterial({ color: 0x9f8f5f, transparent: true, opacity: 0.32, depthWrite: false }));
    asterisms.frustumCulled = false;
    dome.add(asterisms);

    /* ---- ecliptic (the Sun's annual path) --------------------------------- */
    const eclPts = [];
    {
      const earthEl = P.planets.find(p => p.name === 'Earth');
      const eE = new THREE.Vector3(), eQ = new THREE.Vector3();
      for (let i = 0; i <= 360; i++) {
        const d = (i / 360) * 365.25;
        P.astro.helioEcl(earthEl, d, eE);
        eE.negate();                                  // geocentric direction of the Sun
        P.astro.ecl2equ(eE, eQ);
        eclPts.push(eQ.x * R, eQ.z * R, -eQ.y * R);   // equatorial -> world
      }
    }
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(eclPts), 3));
    const ecliptic = new THREE.Line(eGeo,
      new THREE.LineBasicMaterial({ color: 0x5a7fa8, transparent: true, opacity: 0.35, depthWrite: false }));
    ecliptic.frustumCulled = false;
    dome.add(ecliptic);

    /* ---- Sun / Moon / planet sprites -------------------------------------- */
    function sprite(tex, s, opacity, blending) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: opacity == null ? 1 : opacity,
        blending: blending || THREE.AdditiveBlending, depthWrite: false
      }));
      sp.scale.set(s, s, 1);
      return sp;
    }
    const bodyRecords = {};
    const sun = sprite(SUN_TEX, 1.0, 1, THREE.NormalBlending);
    const sunGlow = sprite(SUN_TEX, 7.0, 0.85);
    bodies.add(sun, sunGlow);
    bodyRecords.Sun = { sprite: sun, glow: sunGlow };

    const moonSp = sprite(MOON_TEX, 0.55, 1, THREE.NormalBlending);
    bodies.add(moonSp);
    bodyRecords.Moon = { sprite: moonSp };

    const planetSpriteScale = { Mercury: 0.16, Venus: 0.28, Mars: 0.22, Jupiter: 0.45, Saturn: 0.42, Uranus: 0.3, Neptune: 0.3 };
    for (const pl of P.planets) {
      if (pl.name === 'Earth') continue;
      const s = planetSpriteScale[pl.name] || 0.25;
      const holder = new THREE.Group();
      const sp = sprite(planetDiscTexture(pl.color), s, 1, THREE.NormalBlending);
      holder.add(sp);
      if (pl.name === 'Saturn') {
        const ring = sprite(ringTexture(), 1.6, 0.9);
        holder.add(ring);
      }
      bodies.add(holder);
      bodyRecords[pl.name] = { holder };
    }
    /* minor planets & dwarf planets — small discs on the dome (js/minors.js) */
    const minorHolders = {};
    if (P.minors) for (const m of P.minors.planets) {
      const holder = new THREE.Group();
      holder.add(sprite(planetDiscTexture(m.color), 0.22, 1, THREE.NormalBlending));
      bodies.add(holder);
      bodyRecords[m.name] = { holder };
      minorHolders[m.name] = holder;
    }

    return {
      dome, bodies, mat, named, bodyRecords, R,
      constellations, constellationsZodiac, ecliptic, galaxyWash, asterisms,
      /* MINORS toggle: hide/show the dwarf-planet discs on the dome */
      setMinorsVisible(v) {
        for (const h of Object.values(minorHolders)) h.visible = v;
      },
      hipBuf: hip,                    // Float32Array [ra,dec,v,bv] x N (null if absent)
      hipN: hip ? hip.length / 4 : 0,
      ids,                            // {hip: Int32Array, hd: Int32Array} | null
      namedByBuf,                     // Map<bufferIndex, {name, refs}>
      curatedRefs: P.starNamed83 || [], // refs strings aligned with P.stars
      /* place every body sprite from {ra, dec} ephemeris records */
      setBodies(getEph) {
        const w = _w;
        for (const key of Object.keys(bodyRecords)) {
          const e = getEph(key);
          if (!e) continue;
          const p = raDecToVec3(e.ra, e.dec, w);
          const wv = p.multiplyScalar(R - 0.5);
          const rec = bodyRecords[key];
          if (key === 'Sun') { rec.sprite.position.copy(wv); rec.glow.position.copy(wv); }
          else rec.holder ? rec.holder.position.copy(wv) : rec.sprite.position.copy(wv);
        }
      },
      setPixelRatio(px) { mat.uniforms.uPx.value = px; },
      /* uSoft > 1: wider, softer star sprites (energy-conserving). Used by
         the video demos: a 1-px star is a sub-Nyquist feature that snaps
         between pixel centres while the sky moves; a smooth ~3 px profile
         makes the perceived (centroid) position continuous instead. */
      setSoft(s) { mat.uniforms.uSoft.value = s; },
      /* faint-galaxy point size: device px per arcminute of sky
         (h_dev_px / (fovDeg * 60)) — keep in sync on resize / zoom */
      setGalaxyScale(pxPerArc) { if (galaxyFaintMat) galaxyFaintMat.uniforms.uPxPerArc.value = pxPerArc; },
      dso: dsoList
    };
  }
  const _w = new THREE.Vector3();

  return { build, raDecToVec3, bvToColor };
})();
