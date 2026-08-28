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

    /* ---- constellation lines --------------------------------------------- */
    const byName = new Map(named.map(s => [s.name, s]));
    const linePos = [];
    for (const [, pairs] of P.constellations) {
      for (const [na, nb] of pairs) {
        const A = byName.get(na), B = byName.get(nb);
        if (!A || !B) continue;
        linePos.push(A.world.x, A.world.y, A.world.z, B.world.x, B.world.y, B.world.z);
      }
    }
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePos), 3));
    const constellations = new THREE.LineSegments(cGeo,
      new THREE.LineBasicMaterial({ color: 0x3f6f9f, transparent: true, opacity: 0.4, depthWrite: false }));
    constellations.frustumCulled = false;
    dome.add(constellations);

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

    return {
      dome, bodies, mat, named, bodyRecords, R,
      constellations, ecliptic,
      hipBuf: hip,                    // Float32Array [ra,dec,v,bv] x N (null if absent)
      hipN: hip ? hip.length / 4 : 0,
      ids,                            // {hip: Int32Array, hd: Int32Array} | null
      namedByBuf,                     // Map<bufferIndex, {name, refs}>
      curatedRefs: P.starNamed83 || [], // refs strings aligned with P.stars
      /* place every body sprite from {ra, dec} ephemeris records */
      setBodies(getEph) {
        const w = _w;
        for (const key of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) {
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
      setSoft(s) { mat.uniforms.uSoft.value = s; }
    };
  }
  const _w = new THREE.Vector3();

  return { build, raDecToVec3, bvToColor };
})();
