/* ============================================================================
 * PERIHELION — application core
 * Renderer, camera, ephemeris clock, picking, labels and the main loop.
 * ==========================================================================*/
'use strict';
P.app = (function () {
  /* ------------------------------------------------------------ state ---- */
  const state = {
    mode: 'sky',
    playing: true,
    speed: 86400,              // simulated seconds per real second (1 day/s)
    fovSky: 55,
    fovSolar: 55,
    simTimeMs: Date.now(),
    labels: true,
    orbits: true,
    constellations: true,
    zodiac: true,             // the 12 zodiac figures (independent of 'constellations')
    minors: true,             // dwarf planets + their major moons (solar mode & dome)
    ecliptic: true,
    galaxyWash: true,
    asterisms: true,
    selected: null,            // label key
    hover: null,
    follow: 'Sun',             // solar-mode camera target
    hoverNames: true,          // tooltip on hover
    catalogOpen: false,
    highlightSel: true,        // reticle on the selected object
    selectedEntry: null        // the select() entry object (for the marker)
  };
  /* initial gaze: center of Orion (RA ~85deg, Dec 0) — the belt, Betelgeuse
   * and Rigel all fit in the default 55-degree field of view */
  const cam = { target: new THREE.Vector3(), dist: 120, yaw: -1.481, pitch: 0.02 };

  /* ---------------------------------------------------------- renderer --- */
  let renderer;
  /* Video demos (#demo): stars are drawn with a soft, wide profile
     (sky.setSoft below) so their perceived position stays smooth while the
     sky pans — see sky.setSoft for the details. */
  const CAPTURE_MODE = /demo/.test(location.hash);
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    P.ui.splashFail('WebGL could not be initialised: ' + e.message);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.getElementById('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);
  const camera = new THREE.PerspectiveCamera(state.fovSky, innerWidth / innerHeight, 0.05, 6000);

  /* ------------------------------------------------------------- scene --- */
  const sky = P.sky.build(scene);
  if (CAPTURE_MODE) {
    sky.setSoft(2.2);
    /* native 4K capture window: double the point size in device px so the
       stars keep the same angular size as in the 1080p captures */
    if (innerWidth >= 3000) sky.setPixelRatio(2);
  }
  const solar = P.solar.build(scene);
  P.astro.selfTest(P.planets, THREE.Vector3);
  P.astro.minorsSelfTest();

  /* selection marker — a gentle reticle pinned to the selected object */
  const marker = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255, 214, 122, 0.95)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(64, 64, 42, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30);
      g.lineTo(64 + Math.cos(a) * 22, 64 + Math.sin(a) * 22);
      g.stroke();
    }
    g.fillStyle = 'rgba(255, 226, 160, 1)';
    g.beginPath(); g.arc(64, 64, 3.5, 0, Math.PI * 2); g.fill();
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending
    }));
    sp.visible = false;
    sp.renderOrder = 30;
    scene.add(sp);
    return sp;
  })();

  /* --------------------------------------- star IDs (HIP / HD / IAU names) */
  const DEG = Math.PI / 180;
  const hipBuf = sky.hipBuf;                // Float32Array [ra,dec,v,bv] x N
  const N_BUF = sky.hipN;
  const hip32 = sky.ids ? sky.ids.hip : null;
  const hd32 = sky.ids ? sky.ids.hd : null;
  const namedBuf = sky.namedByBuf;          // Map<bufIdx, {name, refs}>
  const curatedRefs = sky.curatedRefs;

  /* angular grid over every catalog star, for fast hover picking */
  const starGrid = [];
  for (let i = 0; i < 36 * 18; i++) starGrid.push([]);
  for (let i = 0; i < N_BUF; i++) {
    const ra = hipBuf[i * 4], dec = hipBuf[i * 4 + 1];
    const ir = ((Math.floor(ra / 10) % 36) + 36) % 36;
    const ic = Math.max(0, Math.min(17, Math.floor((dec + 90) / 10)));
    starGrid[ir * 18 + ic].push(i);
  }
  /* ID lookup tables (binary search) */
  const hipIndex = [], hdIndex = [];
  for (let i = 0; i < N_BUF; i++) {
    if (hip32) hipIndex.push([hip32[i], i]);
    if (hd32 && hd32[i] > 0) hdIndex.push([hd32[i], i]);
  }
  hipIndex.sort((a, b) => a[0] - b[0]);
  hdIndex.sort((a, b) => a[0] - b[0]);
  function findIn(sorted, n) {
    let lo = 0, hi = sorted.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, h = sorted[mid][0];
      if (h < n) lo = mid + 1; else if (h > n) hi = mid - 1; else return sorted[mid][1];
    }
    return -1;
  }
  const findHip = n => findIn(hipIndex, n);
  const findHd = n => findIn(hdIndex, n);
  /* curated (data.js) stars are searchable by their IDs too */
  const curById = new Map();
  sky.named.forEach((s, k) => {
    const ref = curatedRefs[k] || '';
    const hm = /HIP (\d+)/.exec(ref), dm = /HD (\d+)/.exec(ref);
    if (hm) curById.set('h' + hm[1], s);
    if (dm) curById.set('d' + dm[1], s);
  });

  /* -------------------------------------------------------- ephemeris ---- */
  const EARTH = P.planets.find(p => p.name === 'Earth');
  function rec() {
    return { ec: new THREE.Vector3(), eq: new THREE.Vector3(), anchor: new THREE.Vector3() };
  }
  const eph = {};
  const minorNames = P.minors ? P.minors.planets.map(m => m.name) : [];
  for (const key of ['Sun', 'Moon', ...P.planets.map(p => p.name), ...minorNames]) eph[key] = rec();
  eph.Sun.distAU = 1; eph.Sun.ra = 0; eph.Sun.dec = 0;
  for (const pl of P.planets) { eph[pl.name].distAU = 1; eph[pl.name].helioAU = pl.au; eph[pl.name].ra = 0; eph[pl.name].dec = 0; }
  eph.Moon.distAU = 0;
  for (const name of minorNames) { eph[name].distAU = 1; eph[name].helioAU = 0; eph[name].ra = 0; eph[name].dec = 0; }
  /* space probes (js/probes.js): decode the base64 state vectors once,
     register an ephemeris record per probe, and keep a decoded handle
     (pb) for P.astro.probeHeliocEcl. */
  const probeList = P.probes ? P.probes.probes : [];
  const probeNames = new Set(probeList.map(p => p.name));
  const probeBy = new Map(probeList.map(p => [p.name, p]));
  for (const p of probeList) {
    const u8 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const eu = u8(p.ep), su = u8(p.st);
    p._ep = new Int32Array(eu.buffer, eu.byteOffset, p.n);
    p._st = new Float32Array(su.buffer, su.byteOffset, p.n * 6);
    p._n = p.n;
    p.pb = { ep: p._ep, st: p._st, n: p.n, el: p.el };
    eph[p.name] = rec();
    eph[p.name].vel = new THREE.Vector3();
    eph[p.name].distAU = 1; eph[p.name].helioAU = 1;
  }
  if (probeList.length) P.astro.probesSelfTest(THREE.Vector3);
  /* osculating elements (T0-anchored) for the minor planets */
  const mEls = P.minors
    ? new Map(P.minors.planets.map(m => [m.name, { a: m.a, e: m.e, i: m.i, Omega: m.Omega,
        varpi: m.varpi, M0: m.M0, n: m.n, t0: P.minors.t0 }]))
    : null;

  const T = new THREE.Vector3();
  function computeBodies(d) {
    P.astro.helioEcl(EARTH, d, eph.Earth.ec);
    const s = eph.Sun;
    s.ec.copy(eph.Earth.ec).negate();
    P.astro.ecl2equ(s.ec, s.eq);
    s.distAU = s.ec.length();
    s.ra = P.astro.raDeg(s.eq); s.dec = P.astro.decDeg(s.eq);
    s.anchor.set(s.eq.x, s.eq.z, -s.eq.y).normalize().multiplyScalar(sky.R - 0.5);

    for (const pl of P.planets) {
      const r = eph[pl.name];
      P.astro.helioEcl(pl, d, r.ec);
      r.helioAU = r.ec.length();
      T.copy(r.ec).sub(eph.Earth.ec);
      r.distAU = T.length();
      P.astro.ecl2equ(T, r.eq);
      r.ra = P.astro.raDeg(r.eq); r.dec = P.astro.decDeg(r.eq);
      r.anchor.set(r.eq.x, r.eq.z, -r.eq.y).normalize().multiplyScalar(sky.R - 0.5);
    }
    if (mEls) for (const [name, el] of mEls) {
      const r = eph[name];
      P.astro.oscEcl(el, d, r.ec);
      r.helioAU = r.ec.length();
      T.copy(r.ec).sub(eph.Earth.ec);
      r.distAU = T.length();
      P.astro.ecl2equ(T, r.eq);
      r.ra = P.astro.raDeg(r.eq); r.dec = P.astro.decDeg(r.eq);
      r.anchor.set(r.eq.x, r.eq.z, -r.eq.y).normalize().multiplyScalar(sky.R - 0.5);
    }
    for (const p of probeList) {
      const r = eph[p.name];
      P.astro.probeHeliocEcl(p.pb, d, r.ec, r.vel);
      r.helioAU = r.ec.length();
      T.copy(r.ec).sub(eph.Earth.ec);
      r.distAU = T.length();
      P.astro.ecl2equ(T, r.eq);
      r.ra = P.astro.raDeg(r.eq); r.dec = P.astro.decDeg(r.eq);
      r.anchor.set(r.eq.x, r.eq.z, -r.eq.y).normalize().multiplyScalar(sky.R - 0.5);
    }
    P.astro.moonEcl(d, eph.Moon.ec);
    P.astro.ecl2equ(eph.Moon.ec, eph.Moon.eq);
    eph.Moon.ra = P.astro.raDeg(eph.Moon.eq);
    eph.Moon.dec = P.astro.decDeg(eph.Moon.eq);
    eph.Moon.anchor.set(eph.Moon.eq.x, eph.Moon.eq.z, -eph.Moon.eq.y).normalize().multiplyScalar(sky.R - 0.5);
  }

  /* ------------------------------------------------------------- camera -- */
  function applyCamera() {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const dx = cp * Math.cos(cam.yaw), dy = sp, dz = cp * Math.sin(cam.yaw);
    if (state.mode === 'sky') {
      camera.position.set(0, 0, 0);
      camera.lookAt(dx, dy, dz);
      camera.fov = state.fovSky;
    } else {
      camera.position.set(
        cam.target.x + dx * cam.dist,
        cam.target.y + dy * cam.dist,
        cam.target.z + dz * cam.dist
      );
      camera.lookAt(cam.target);
      camera.fov = state.fovSolar;
    }
    camera.updateProjectionMatrix();
  }

  /* ----------------------------------------------------- input: pointer -- */
  const cv = renderer.domElement;
  cv.classList.add('scene-canvas');
  cv.style.cursor = 'grab';
  let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
  cv.style.touchAction = 'none';

  cv.addEventListener('pointerdown', e => {
    dragging = true;
    cam.viewAnim = null;          // user takes over the camera
    P.ui.hideTip();
    lastX = downX = e.clientX;
    lastY = downY = e.clientY;
    cv.setPointerCapture(e.pointerId);
  });
  /* Video demos (#demo): drag panning goes through a critically-damped
     target instead of moving the camera directly. Pointer events arrive in
     discrete bursts (the page event loop), so a direct update makes the
     camera step 2-5 px per video frame and the small stars look like they
     jitter. The spring re-samples the motion at frame rate — the pan in
     recorded video becomes continuous. Interactive mode is untouched. */
  const DEMO_SMOOTH = /demo/.test(location.hash);
  let yawT = null, pitchT = null;
  cv.addEventListener('pointermove', e => {
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (DEMO_SMOOTH) {
        if (yawT === null) { yawT = cam.yaw; pitchT = cam.pitch; }
        yawT -= dx * 0.0042;
        pitchT = Math.max(-1.55, Math.min(1.55, pitchT + dy * 0.0042));
      } else {
        cam.yaw -= dx * 0.0042;
        cam.pitch = Math.max(-1.55, Math.min(1.55, cam.pitch + dy * 0.0042));
      }
    } else {
      const hit = pick(e.clientX, e.clientY);
      state.hover = hit ? hit.key : null;
      cv.style.cursor = hit ? 'pointer' : 'grab';
      if (hit && state.hoverNames) showTip(e.clientX, e.clientY, hit);
      else P.ui.hideTip();
    }
  });
  cv.addEventListener('pointerleave', () => P.ui.hideTip());
  cv.addEventListener('pointerup', e => {
    dragging = false;
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved < 6) {
      const hit = pick(e.clientX, e.clientY);
      select(hit ? hit : null);
    }
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (state.mode === 'sky') {
      state.fovSky = Math.max(8, Math.min(110, state.fovSky + e.deltaY * 0.02));
      updateGalaxyScale();
    } else {
      cam.dist = Math.max(4, Math.min(4000, cam.dist * Math.exp(e.deltaY * 0.0011)));
    }
  }, { passive: false });

  /* ---------------------------------------------------- labels & picking - */
  const BODY_NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
                      ...(P.minors ? P.minors.planets.map(m => m.name) : [])];
  /* name sets for the MINORS toggle (dwarf planets + their major moons) and
     the ZODIAC toggle (the 12 zodiac figures) */
  const MINOR_NAMES = new Set(P.minors ? P.minors.planets.map(m => m.name) : []);
  const MOON_NAMES = new Set(P.minors ? P.minors.moons.map(m => m.name) : []);
  const ZODIAC_NAMES = new Set(P.zodiac || []);
  const isMinor = name => MINOR_NAMES.has(name) || MOON_NAMES.has(name);
  const entries = [];

  for (let k = 0; k < sky.named.length; k++) {
    const s = sky.named[k];
    if (s.mag < 2.2) {
      entries.push({
        key: 'star:' + s.name, text: s.name, kind: 'star', star: s,
        ref: curatedRefs[k] || null,
        anchor: s.world, visible: () => state.mode === 'sky'
      });
    }
  }
  for (const name of BODY_NAMES) {
    entries.push({
      key: 'body:' + name, text: name, kind: 'body', body: name,
      anchor: new THREE.Vector3(),
      /* dwarf planets follow the MINORS toggle; the major planets always label */
      visible: () => MINOR_NAMES.has(name) ? state.minors : true
    });
  }
  /* major moons — solar-system mode only (labels + picking), MINORS-gated */
  if (P.minors) for (const m of P.minors.moons) {
    entries.push({
      key: 'body:' + m.name, text: m.name, kind: 'body', body: m.name,
      anchor: new THREE.Vector3(), visible: () => state.mode === 'solar' && state.minors
    });
  }
  /* space probes — labels + picking in both modes (sky: dome anchor,
     solar: the mesh position via anchorOf) */
  for (const p of probeList) {
    entries.push({
      key: 'probe:' + p.name, text: p.name, kind: 'probe', body: p.name,
      anchor: new THREE.Vector3(), visible: () => true
    });
  }
  const starByKey = new Map(sky.named.map(s => ['star:' + s.name, s]));

  /* deep-sky objects (js/dso.js): real galaxies — pickable + labelable */
  function dsoEntry(i) {
    const r = P.dso[i];
    return {
      key: 'dso:' + i, text: r[0], kind: 'dso', dso: i,
      ra: r[1], dec: r[2], v: r[3],
      anchor: starAnchor(r[1], r[2]),
      visible: () => state.mode === 'sky',
      label: r[3] < 8.7 || r[10] != null    // bright, or a curated object with a story
    };
  }
  if (P.dso) for (let i = 0; i < P.dso.length; i++) entries.push(dsoEntry(i));

  /* constellation figures — a name label at the figure's centroid */
  const constAnchors = new Map(); // name -> centroid world vector (catalog fly-to)
  {
    const byName = new Map(sky.named.map(s => [s.name, s]));
    for (const [cname, lines] of P.constellations) {
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of lines) for (const nm of [a, b]) {
        const s = byName.get(nm);
        if (!s) continue;
        sx += s.world.x; sy += s.world.y; sz += s.world.z; n++;
      }
      if (n < 2) continue;
      const isZodiac = ZODIAC_NAMES.has(cname);
      const anchor = new THREE.Vector3(sx / n, sy / n, sz / n);
      constAnchors.set(cname, anchor);
      entries.push({
        key: 'const:' + cname, text: cname.toUpperCase(), kind: 'const', constName: cname,
        anchor,
        /* zodiac figures additionally follow the ZODIAC toggle (key Z) */
        visible: () => state.mode === 'sky' && state.constellations &&
          (!isZodiac || state.zodiac)
      });
    }
  }
  function constCentroid(name) { return constAnchors.get(name) || null; }

  const _pv = new THREE.Vector3();
  function anchorOf(e) {
    if (e.kind === 'star' || e.kind === 'bufstar' || e.kind === 'dso' || e.kind === 'const') return e.anchor || null;
    const name = e.body;
    if (state.mode === 'sky') return eph[name].anchor;
    if (name === 'Sun') return _sunAnchor.set(0, 0, 0);
    if (name === 'Moon') return solar.moonMesh.position;
    const m = solar.meshes[name];
    return m ? m.position : null;
  }
  const _sunAnchor = new THREE.Vector3();

  function updateLabels() {
    P.ui.clearLabels();
    const W = innerWidth, H = innerHeight;
    for (const e of entries) {
      if (!e.visible()) continue;
      const a = anchorOf(e);
      if (!a) { e.scr = null; continue; }
      _pv.copy(a).applyMatrix4(camera.matrixWorldInverse);
      if (_pv.z > -0.35) { e.scr = null; continue; }
      _pv.copy(a).project(camera);
      const x = (_pv.x * 0.5 + 0.5) * W;
      const y = (-_pv.y * 0.5 + 0.5) * H;
      if (x < -60 || x > W + 60 || y < -60 || y > H + 60) { e.scr = null; continue; }
      e.scr = { x, y };
      if (state.labels && e.label !== false) P.ui.placeLabel(e.key, e.text, x, y, true, state.selected === e.key);
    }
  }

  function pick(mx, my) {
    let best = null, bestD = 30;
    for (const e of entries) {
      if (!e.scr) continue;
      const d = Math.hypot(e.scr.x - mx, e.scr.y - my);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best && state.mode === 'sky' && N_BUF) best = pickBufStar(mx, my);
    return best;
  }

  /* hover any catalog star: angular search around the cursor (≈30 px) */
  function pickBufStar(mx, my) {
    const W = innerWidth, H = innerHeight;
    const cp = Math.cos(cam.pitch);
    const fwd = [cp * Math.cos(cam.yaw), Math.sin(cam.pitch), cp * Math.sin(cam.yaw)];
    /* camera basis (up = +Y): right = fwd × up, then up' = right × fwd */
    let rx = -fwd[2], ry = 0, rz = fwd[0];
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    const ux = ry * fwd[2] - rz * fwd[1];
    const uy = rz * fwd[0] - rx * fwd[2];
    const uz = rx * fwd[1] - ry * fwd[0];
    const tanF = Math.tan(state.fovSky * DEG / 2), aspect = W / H;
    const ox = (mx / W) * 2 - 1, oy = -((my / H) * 2 - 1);
    const sx = ox * tanF * aspect, sy = oy * tanF;
    let dx = fwd[0] + rx * sx + ux * sy;
    let dy = fwd[1] + uy * sy;
    let dz = fwd[2] + rz * sx + uz * sy;
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;

    const pickDeg = 30 * state.fovSky / H;
    const qd = Math.asin(Math.max(-1, Math.min(1, dy))) / DEG;
    let qa = Math.atan2(-dz, dx) / DEG;
    if (qa < 0) qa += 360;
    const ir0 = Math.floor(qa / 10) % 36;
    const id0 = Math.max(0, Math.min(17, Math.floor((qd + 90) / 10)));
    let bi = -1, ba = pickDeg;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dd = -1; dd <= 1; dd++) {
        const ic = id0 + dd;
        if (ic < 0 || ic > 17) continue;
        for (const i of starGrid[((ir0 + dr + 36) % 36) * 18 + ic]) {
          const dec = hipBuf[i * 4 + 1] * DEG, ra = hipBuf[i * 4] * DEG;
          const cd = Math.cos(dec);
          const dot = cd * Math.cos(ra) * dx + Math.sin(dec) * dy - cd * Math.sin(ra) * dz;
          const ang = Math.acos(Math.min(1, Math.max(-1, dot))) / DEG;
          if (ang < ba) { ba = ang; bi = i; }
        }
      }
    }
    return bi >= 0 ? bufStarEntry(bi) : null;
  }

  function starAnchor(ra, dec) {
    return P.sky.raDecToVec3(ra, dec, new THREE.Vector3(), sky.R);
  }
  function bufStarEntry(i) {
    const hip = hip32[i], hd = hd32 ? hd32[i] : 0;
    const n = namedBuf.get(i);
    const name = n ? n.name : 'HIP ' + hip;
    const ra = hipBuf[i * 4], dec = hipBuf[i * 4 + 1];
    return {
      key: 'hip:' + hip, kind: 'star', star: null, buf: i,
      name, text: name, hip, hd, ra, dec,
      v: hipBuf[i * 4 + 2], bv: hipBuf[i * 4 + 3],
      anchor: starAnchor(ra, dec),
      refs: n ? n.refs : 'HIP ' + hip + (hd ? ' · HD ' + hd : '')
    };
  }

  /* ------------------------------------------------------------- info ---- */
  /* B−V -> approximate effective temperature (K), main-sequence anchor points
     (B0 … M6); then Wien's law for the peak wavelength. Shown as the Colour
     row for stars and galaxies alike. */
  const BV_T = [[-0.35, 33000], [-0.26, 26000], [-0.14, 19500], [-0.05, 15300],
    [0.00, 9900], [0.20, 7800], [0.30, 7400], [0.44, 6450], [0.55, 5900],
    [0.65, 5770], [0.78, 5450], [0.85, 5200], [1.00, 4850], [1.25, 4400],
    [1.60, 3850], [1.85, 3650], [2.00, 3500], [2.30, 3150], [2.50, 2950]];
  function bvTeff(bv) {
    if (bv <= BV_T[0][0]) return BV_T[0][1];
    for (let i = 0; i < BV_T.length - 1; i++) {
      const a = BV_T[i], b = BV_T[i + 1];
      if (bv <= b[0]) return a[1] + (b[1] - a[1]) * (bv - a[0]) / (b[0] - a[0]);
    }
    return BV_T[BV_T.length - 1][1];
  }
  function bvSwatch(bv) {
    const c = P.sky.bvToColor(bv == null ? 0.8 : bv);
    return 'rgb(' + ((c[0] * 255) | 0) + ',' + ((c[1] * 255) | 0) + ',' + ((c[2] * 255) | 0) + ')';
  }
  function bvColourRow(bv) {
    if (bv == null) return null;
    const T = bvTeff(bv);
    const lam = 2.898e6 / T;                    /* Wien displacement, nm */
    const band = lam < 380 ? 'peak in the ultraviolet'
      : lam > 750 ? 'peak in the infrared'
      : 'peak at ' + Math.round(lam) + ' nm';
    return {
      sw: bvSwatch(bv),
      text: bv.toFixed(2) + ' · ' + Math.round(T).toLocaleString('en-US') + ' K · ' + band
    };
  }
  function starInfo(entry) {
    const s = entry.star;
    const rows = [
      ['Magnitude', s.mag.toFixed(2)],
      ['Distance', s.dist ? s.dist + ' ly' : '—']
    ];
    const bv = bvColourRow(s.bv);
    if (bv) rows.push(['Colour', bv]);
    if (entry.ref) rows.push(['ID', entry.ref.split(' · ').slice(0, 2).join(' · ')]);
    return { title: s.name, rows, fun: s.dist
      ? 'Light from this star is ' + s.dist + ' years old by the time it reaches your eyes.'
      : 'One of the bright stars of the night sky.' };
  }
  function bufStarInfo(e) {
    const rows = [
      ['Magnitude (V)', e.v.toFixed(2)],
      ['HIP', String(e.hip)]
    ];
    const bv = bvColourRow(e.bv);
    if (bv) rows.push(['Colour', bv]);
    if (e.hd) rows.push(['HD', String(e.hd)]);
    rows.push(['Position', P.astro.formatRA(e.ra) + '  ' + P.astro.formatDec(e.dec)]);
    const named = e.buf != null && namedBuf.get(e.buf);
    return {
      title: e.name, rows,
      fun: named
        ? 'Also known as ' + e.refs + '. Named by the IAU Working Group on Star Names.'
        : 'A star from the 116,547-star Hipparcos catalog. No common name — but every star has an address.'
    };
  }
  function dsoInfo(e) {
    const r = P.dso[e.dso];
    const rows = [['Type', r[4] || 'Galaxy']];
    rows.push(['Position', P.astro.formatRA(r[1]) + '  ' + P.astro.formatDec(r[2])]);
    if (r[3] != null) rows.push(['Magnitude (V)', r[3].toFixed(2)]);
    if (r[5] != null) {
      const fm = x => (x >= 10 ? Math.round(x) : +x.toFixed(1)) + '′';
      rows.push(['Size', fm(r[5]) + (r[6] != null ? ' × ' + fm(r[6]) : '')]);
    }
    if (r[7] != null) rows.push(['Distance', (+r[7]).toFixed(1) + ' million ly']);
    const bv = bvColourRow(r[9]);
    if (bv && /galax/i.test(r[4] || '')) rows.push(['Colour', bv]);
    else if (r[9] != null) {
      const word = { '0.45': 'blue-white', '0.7': 'white', '1.05': 'yellow', '1.5': 'orange-red' }[String(r[9])];
      if (word) rows.push(['Colour', word]);
    }
    if (r[11] && r[11] !== r[0]) rows.push(['Catalog', r[11]]);
    const common = dsoCommon(r[0]);
    const t = String(r[4] || '').toLowerCase();
    const funFallback = /galax/.test(t)
      ? 'A galaxy outside the Milky Way — its light left it millions of years before you were born.'
      : /globular/.test(t)
        ? 'A globular cluster — hundreds of thousands of ancient stars bound together by gravity, most of them older than the Milky Way itself.'
        : /open cluster/.test(t)
          ? 'An open cluster — stars born from the same cloud, still drifting together through the galaxy.'
          : /planetary nebula/.test(t)
            ? 'A planetary nebula — the glowing shed envelope of a dying sun-like star, laced with the light of its hot white-dwarf heart.'
            : 'A nebula — interstellar gas and dust, the raw material of the next generation of stars.';
    return {
      title: r[0] + (common ? ' · ' + common : (r[11] && r[11] !== r[0] ? ' · ' + r[11] : '')),
      rows,
      fun: r[10] || funFallback
    };
  }
  function lightTime(au) {
    const s = au * 499.004783836;             /* s per AU */
    if (s < 60) return s.toFixed(1) + ' s';
    if (s < 3600) return Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s';
    if (s < 86400) return (s / 3600).toFixed(1) + ' h';
    return (s / 86400).toFixed(1) + ' d';
  }
  function probeInfo(name) {
    const p = probeBy.get(name);
    const e = eph[name];
    if (!p || !e) return { title: name, rows: [], fun: '' };
    const kmS = e.vel ? e.vel.length() * 1731.456 : 0;   /* AU/day -> km/s */
    return {
      title: p.name + '  ·  space probe',
      rows: [
        ['Agency', p.facts.agency],
        ['Launched', p.facts.launch],
        ['Status', p.facts.status],
        ['Distance from Sun', e.helioAU.toFixed(2) + ' AU'],
        ['Distance from Earth', e.distAU.toFixed(2) + ' AU'],
        ['Velocity', kmS.toFixed(1) + ' km/s'],
        ['Light time (Earth)', lightTime(e.distAU)]
      ],
      fun: p.facts.fun
    };
  }
  function bodyInfo(name) {
    const e = eph[name];
    if (name === 'Sun') {
      return {
        title: 'Sun',
        rows: [
          ['Distance', e.distAU.toFixed(3) + ' AU'],
          ['Type', 'G2V main sequence'],
          ['Colour', bvColourRow(0.65) || 'yellow-white'],
          ['Surface', '5,505 °C']
        ],
        fun: 'The star at the heart of everything you are looking at.'
      };
    }
    if (name === 'Moon') {
      return {
        title: 'Moon',
        rows: [
          ['Distance from Earth', '384,400 km'],
          ['Orbit', '27.3 days'],
          ['Tilt', '5.1° to the ecliptic']
        ],
        fun: 'Tidally locked — the same face has watched Earth for four billion years.'
      };
    }
    if (P.minors) {
      const mn = P.minors.planets.find(p => p.name === name);
      if (mn) {
        return {
          title: name,
          rows: [
            ['Distance from Sun', e.helioAU.toFixed(2) + ' AU'],
            ['Distance from Earth', e.distAU.toFixed(2) + ' AU'],
            ['Orbital period', mn.facts.period],
            ['Diameter', mn.facts.diameter],
            ['Moons', mn.facts.moons]
          ],
          fun: mn.facts.fun
        };
      }
      const mm = P.minors.moons.find(m => m.name === name);
      if (mm) {
        return {
          title: name,
          rows: [
            ['Moon of', mm.parent],
            ['Mean distance from ' + mm.parent, (mm.aKm / 1000).toLocaleString('en-US') + ' km'],
            ['Orbital period', mm.facts.period],
            ['Diameter', mm.facts.diameter]
          ],
          fun: mm.facts.fun
        };
      }
    }
    const pl = P.planets.find(p => p.name === name);
    if (!pl) return { title: name, rows: [], fun: '' };
    return {
      title: name,
      rows: [
        ['Distance from Sun', e.helioAU.toFixed(2) + ' AU'],
        ['Distance from Earth', e.distAU.toFixed(2) + ' AU'],
        ['Orbital period', pl.period],
        ['Diameter', pl.facts.diameter],
        ['Day', pl.facts.rotation],
        ['Moons', pl.facts.moons]
      ],
      fun: pl.facts.fun
    };
  }

  /* zodiac signs — Sun dates (tropical), glyph, and the figure's anchor star */
  const ZODIAC_INFO = {
    Aries:       ['Mar 21 – Apr 19', '♈', 'Hamal (α Ari)'],
    Taurus:      ['Apr 20 – May 20', '♉', 'Aldebaran (α Tau)'],
    Gemini:      ['May 21 – Jun 20', '♊', 'Pollux (β Gem)'],
    Cancer:      ['Jun 21 – Jul 22', '♋', 'Acubens (α Cnc)'],
    Leo:         ['Jul 23 – Aug 22', '♌', 'Regulus (α Leo)'],
    Virgo:       ['Aug 23 – Sep 22', '♍', 'Spica (α Vir)'],
    Libra:       ['Sep 23 – Oct 22', '♎', 'Zubenelgenubi (α Lib)'],
    Scorpius:    ['Oct 23 – Nov 21', '♏', 'Antares (α Sco)'],
    Sagittarius: ['Nov 22 – Dec 21', '♐', 'Kaus Australis (σ Sgr)'],
    Capricornus: ['Dec 22 – Jan 19', '♑', 'Deneb Algedi (α Cap)'],
    Aquarius:    ['Jan 20 – Feb 18', '♒', 'Sadalmelik (β Aqr)'],
    Pisces:      ['Feb 19 – Mar 20', '♓', 'Alrescha (α Psc)']
  };
  function select(entry) {
    state.selected = entry ? entry.key : null;
    state.selectedEntry = entry || null;
    if (!entry) { P.ui.hideInfo(); if (state.catalogOpen) renderCatalog(); return; }
    const info = entry.kind === 'body'
      ? bodyInfo(entry.body)
      : entry.kind === 'probe'
        ? probeInfo(entry.body)
        : entry.kind === 'dso'
        ? dsoInfo(entry)
        : entry.kind === 'const'
          ? (ZODIAC_INFO[entry.constName]
              ? { title: entry.constName,
                  rows: [['Type', 'zodiac constellation (sign)'],
                         ['Sun in this sign', ZODIAC_INFO[entry.constName][0]],
                         ['Symbol', ZODIAC_INFO[entry.constName][1]],
                         ['Anchor star', ZODIAC_INFO[entry.constName][2]]],
                  fun: 'One of the 12 zodiac signs — the constellations the Sun passes through in a year. Toggle the 12 zodiac figures with the ZODIAC switch.' }
              : { title: entry.constName, rows: [['Type', 'constellation figure']],
                  fun: 'Drawn here with its classic stick figure among the ' + P.constellations.length + ' figures of the sky.' })
          : (entry.star ? starInfo(entry) : bufStarInfo(entry));
    P.ui.showInfo(info.title, info.rows, info.fun);
    if ((entry.kind === 'body' || entry.kind === 'probe') && state.mode === 'solar') state.follow = entry.body;
    if (state.catalogOpen) renderCatalog();
  }

  /* ------------------------------------------------- catalog & search ---- */
  const catalogList = [];
  for (const name of BODY_NAMES) catalogList.push({ kind: 'body', body: name, name, key: 'body:' + name });
  if (P.minors) for (const m of P.minors.moons) {
    catalogList.push({ kind: 'body', body: m.name, name: m.name, key: 'body:' + m.name, moon: m });
  }
  /* constellation figures — searchable by name (e.g. "libra", "orion");
     typing "zodiac" matches all 12 signs via the common field */
  for (const [cname] of P.constellations) {
    const z = ZODIAC_NAMES.has(cname);
    catalogList.push({ kind: 'const', constName: cname, name: cname,
      key: 'const:' + cname, isZodiac: z, common: z ? 'ZODIAC SIGN' : null });
  }
  /* space probes — searchable by name, alias ("webb") and agency */
  for (const p of probeList) {
    catalogList.push({ kind: 'probe', body: p.name, name: p.name,
      key: 'probe:' + p.name,
      refs: p.facts.agency + (p.aliases ? ' · ' + p.aliases.join(' · ') : '') });
  }
  sky.named.slice().sort((a, b) => a.mag - b.mag)
    .forEach(s => catalogList.push({ kind: 'star', star: s, name: s.name, key: 'star:' + s.name }));
  /* galaxies: searchable by Messier/NGC/IC/UGC id, by common name, and by
     cross-reference. Common names use established astronomical usage
     ("Andromeda Galaxy" = M31, "Needle Galaxy" = NGC 4565, …), keyed by the
     id exactly as stored in js/dso.js. */
  const GALAXY_COMMON = {
    'M31': 'Andromeda Galaxy',
    'M33': 'Triangulum Galaxy',
    'M51': 'Whirlpool Galaxy',
    'M63': 'Sunflower Galaxy',
    'M64': 'Black Eye Galaxy',
    'M74': 'Photon Ring Galaxy',
    'M81': 'Cigar Galaxy',
    'M82': 'Cigar Galaxy',
    'M83': 'Southern Pinwheel Galaxy',
    'M87': 'Virgo A',
    'M101': 'Pinwheel Galaxy',
    'M104': 'Sombrero Galaxy',
    'NGC 253': 'Sculptor Galaxy',
    'NGC 1300': 'Grand Design Galaxy',
    'NGC 4565': 'Needle Galaxy',
    'NGC 4631': 'Face-on Andromeda'
  };
  const DSO2_COMMON = P.dso2Common || {};
  const dsoCommon = id => GALAXY_COMMON[id] || DSO2_COMMON[id] || null;
  const dsoKind = r => {
    const c = dsoCommon(r[0]);
    if (c) return c.toUpperCase();
    return /galax/i.test(r[4] || '') ? 'GALAXY' : (r[4] || 'DEEP-SKY OBJECT').toUpperCase();
  };
  if (P.dso) {
    for (let i = 0; i < P.dso.length; i++) {
      const r = P.dso[i];
      catalogList.push({ kind: 'dso', dso: i, name: r[0], common: dsoCommon(r[0]) || '', refs: r[11] || '', v: r[3], key: 'dso:' + i });
    }
  }
  /* IAU-named catalog stars (WGSN) */
  if (P.starNamed && N_BUF) {
    const w = P.starNamed.data.map(([i, name, refs]) => ({
      kind: 'bufstar', buf: i, name, refs, key: 'hip:' + hip32[i],
      v: hipBuf[i * 4 + 2], ra: hipBuf[i * 4], dec: hipBuf[i * 4 + 1],
      hd: hd32 ? hd32[i] : 0, hip: hip32[i]
    }));
    w.sort((a, b) => a.v - b.v);
    for (const c of w) catalogList.push(c);
  }

  function starCatEntry(i) {
    const hip = hip32[i], hd = hd32 ? hd32[i] : 0;
    const n = namedBuf.get(i);
    const ra = hipBuf[i * 4], dec = hipBuf[i * 4 + 1];
    return {
      kind: 'bufstar', buf: i, key: 'hip:' + hip, hip,
      name: n ? n.name : 'HIP ' + hip,
      refs: n ? n.refs : 'HIP ' + hip + (hd ? ' · HD ' + hd : ''),
      v: hipBuf[i * 4 + 2], ra, dec,
      hd, bv: hipBuf[i * 4 + 3],
      anchor: starAnchor(ra, dec)
    };
  }

  function catalogSearch(qRaw) {
    const nq = String(qRaw || '').trim().toLowerCase().replace(/\s+/g, '');
    /* toggles: MINORS hides dwarf planets & moons; the constellation toggles
       hide their figures (zodiac figures additionally follow the ZODIAC key) */
    const src = catalogList.filter(c => {
      if (c.kind === 'body' && isMinor(c.body) && !state.minors) return false;
      if (c.kind === 'const' && (!state.constellations || (c.isZodiac && !state.zodiac))) return false;
      return true;
    });
    if (!nq) return src;
    const res = [];
    const seen = new Set();
    const push = (sc, c) => { if (!seen.has(c.key)) { seen.add(c.key); res.push([sc, c]); } };
    for (const c of src) {
      const n = c.name.toLowerCase().replace(/\s+/g, '');
      const refs = (c.refs || '').toLowerCase().replace(/\s+/g, '');
      let sc = n === nq ? 0 : n.indexOf(nq) === 0 ? 1 : n.indexOf(nq) >= 0 ? 2 : -1;
      /* common names ("Andromeda Galaxy") rank like the catalog id */
      if (sc < 0 && c.common) {
        const cn = c.common.toLowerCase().replace(/\s+/g, '');
        sc = cn === nq ? 0 : cn.indexOf(nq) === 0 ? 1 : cn.indexOf(nq) >= 0 ? 2 : -1;
      }
      if (sc < 0 && refs.indexOf(nq) >= 0) sc = 3;
      if (sc >= 0) push(sc, c);
    }
    /* numeric: HIP and HD lookups (curated stars included) */
    const digits = nq.replace(/\D/g, '');
    if (digits) {
      const n = +digits;
      const bi = findHip(n);
      if (bi >= 0) push(3, starCatEntry(bi));
      const hi = findHd(n);
      if (hi >= 0 && hi !== bi) push(3, starCatEntry(hi));
      const cs = curById.get('h' + n) || curById.get('d' + n);
      if (cs) push(3, { kind: 'star', star: cs, name: cs.name, key: 'star:' + cs.name });
    }
    res.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
    return res.slice(0, 150).map(r => r[1]);
  }

  function catalogSub(c) {
    if (c.kind === 'probe') {
      return 'PROBE · ' + (eph[c.body] ? eph[c.body].distAU.toFixed(2) + ' AU FROM EARTH' : 'SPACECRAFT');
    }
    if (c.kind === 'const') {
      return c.isZodiac ? 'ZODIAC SIGN · FIGURE' : 'CONSTELLATION · FIGURE';
    }
    if (c.kind === 'dso') {
      const r = P.dso[c.dso];
      let s = dsoKind(r)
        + ' · MAG ' + (c.v != null ? c.v.toFixed(1) : '?');
      if (r[5] != null) s += ' · ' + (r[5] >= 10 ? Math.round(r[5]) : r[5].toFixed(1)) + '′';
      if (r[7] != null) s += ' · ' + r[7] + ' MLY';
      return s;
    }
    if (c.kind === 'bufstar') {
      return 'V ' + c.v.toFixed(2) + ' · HIP ' + (c.hip != null ? c.hip : hip32[c.buf])
        + (c.hd ? ' · HD ' + c.hd : '');
    }
    if (c.kind === 'star') {
      const s = c.star;
      return 'STAR · MAG ' + s.mag.toFixed(2) + (s.dist ? ' · ' + s.dist + ' LY' : '');
    }
    const n = c.body;
    if (n === 'Sun') return 'STAR · G2V · 1.00 AU';
    if (n === 'Moon') return 'MOON OF EARTH · 384,400 KM';
    if (n === 'Earth') return 'HOME · YOU ARE HERE';
    if (P.minors) {
      const mm = P.minors.moons.find(m => m.name === n);
      if (mm) return 'MOON OF ' + mm.parent.toUpperCase() + ' · ' + (mm.aKm / 1000).toLocaleString('en-US') + ' KM';
      const mp = P.minors.planets.find(m => m.name === n);
      if (mp) return 'MINOR PLANET · ' + eph[n].distAU.toFixed(2) + ' AU FROM EARTH';
    }
    return 'PLANET · ' + eph[n].distAU.toFixed(2) + ' AU FROM EARTH';
  }

  let catalogSearchEl; // bound after ui.wire() builds the DOM
  function renderCatalog() {
    if (!state.catalogOpen) return;
    const q = catalogSearchEl.value || '';
    const list = catalogSearch(q);
    const frag = document.createDocumentFragment();
    for (const c of list) {
      const row = document.createElement('div');
      row.className = 'cat-row' + (state.selected === c.key ? ' sel' : '');
      const b = document.createElement('b');
      b.textContent = c.name;
      const s = document.createElement('span');
      s.textContent = catalogSub(c);
      row.appendChild(b);
      row.appendChild(s);
      row.onclick = () => pickCatalog(c);
      frag.appendChild(row);
    }
    const listEl = P.ui.catalog.list;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    listEl.appendChild(frag);
    if (state.selected) {
      const selRow = [...listEl.children].find(r => r.className.includes('sel'));
      if (selRow) selRow.scrollIntoView({ block: 'nearest' });
    }
    P.ui.catalog.count.textContent = q
      ? list.length + ' MATCHES'
      : (P.stars.length + (P.starNamed ? P.starNamed.count : 0)) + ' NAMED · '
        + N_BUF.toLocaleString('en-US') + ' IN CATALOG'
        + (P.dso ? ' · ' + P.dso.length + ' DEEP-SKY OBJECTS' : '');
  }

  function toggleCatalog(force) {
    state.catalogOpen = force != null ? !!force : !state.catalogOpen;
    P.ui.catalog.open(state.catalogOpen);
    if (state.catalogOpen) renderCatalog();
    else catalogSearchEl.value = '';
  }

  function pickCatalog(c) {
    let entry;
    if (c.kind === 'body') entry = { key: 'body:' + c.name, text: c.name, kind: 'body', body: c.name };
    else if (c.kind === 'probe') entry = { key: 'probe:' + c.name, text: c.name, kind: 'probe', body: c.name };
    else if (c.kind === 'dso') entry = dsoEntry(c.dso);
    else if (c.kind === 'const') {
      entry = { key: 'const:' + c.constName, text: c.constName.toUpperCase(),
                kind: 'const', constName: c.constName, anchor: constCentroid(c.constName) };
    }
    else if (c.kind === 'star') {
      const k = sky.named.indexOf(c.star);
      entry = { key: 'star:' + c.name, text: c.name, kind: 'star', star: c.star,
                anchor: c.star.world, ref: curatedRefs[k] || null };
    } else entry = starCatEntry(c.buf);
    select(entry);
    pointAt(c);
  }

  /* smoothly rotate the sky view until `v` (a world direction) is centered */
  function rotateToVec(v) {
    const n = v.length() || 1;
    const ty = Math.atan2(v.z, v.x);
    const tp = Math.asin(Math.max(-1, Math.min(1, v.y / n)));
    let dy = ty - cam.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));      // shortest way around
    cam.viewAnim = { y0: cam.yaw, dy, p0: cam.pitch, dp: tp - cam.pitch, t: 0 };
  }

  function pointAt(c) {
    if (c.kind === 'const') {
      if (state.mode !== 'sky') setMode('sky');
      const a = constCentroid(c.constName);
      if (a) rotateToVec(a);
      return;
    }
    if (c.kind === 'star') {
      if (state.mode !== 'sky') setMode('sky');
      rotateToVec(c.star.world);
      return;
    }
    if (c.kind === 'bufstar') {
      if (state.mode !== 'sky') setMode('sky');
      rotateToVec(P.sky.raDecToVec3(c.ra, c.dec, new THREE.Vector3()));
      return;
    }
    if (c.kind === 'dso') {
      if (state.mode !== 'sky') setMode('sky');
      const r = P.dso[c.dso];
      rotateToVec(P.sky.raDecToVec3(r[1], r[2], new THREE.Vector3()));
      return;
    }
    if (c.kind === 'probe') {
      if (state.mode === 'solar') { state.follow = c.body; cam.dist = 8; }
      else rotateToVec(eph[c.body].anchor);
      return;
    }
    const name = c.body;
    if (P.minors && P.minors.moons.some(m => m.name === name) && state.mode !== 'solar') {
      setMode('solar');
      state.follow = name;
      cam.dist = 14;
      return;
    }
    if (state.mode === 'solar') {
      if (name === 'Sun') { state.follow = 'Sun'; cam.dist = 90; }
      else if (name === 'Moon') { state.follow = 'Earth'; cam.dist = 9; }
      else if (name === 'Earth') { state.follow = 'Earth'; cam.dist = 9; }
      else {
        state.follow = name;
        const pl = P.planets.find(p => p.name === name);
        /* close-up that fills the frame with the (photo) surface; the
           wheel dollies between a few radii and back out to system view */
        cam.dist = Math.max(4, (pl ? pl.size : 1) * 5);
      }
    } else if (eph[name]) {
      rotateToVec(eph[name].anchor);
    }
  }

  function showTip(x, y, hit) {
    let sub;
    if (hit.kind === 'star') {
      if (hit.star) {
        const s = hit.star;
        sub = 'STAR · MAG ' + s.mag.toFixed(2) + (s.dist ? ' · ' + s.dist + ' LY' : '')
          + (hit.ref ? ' · ' + hit.ref.split(' · ')[0] : '');
      } else {
        const named = hit.buf != null && namedBuf.get(hit.buf);
        sub = 'STAR · V ' + hit.v.toFixed(2) + (hit.hd ? ' · HD ' + hit.hd : '')
          + (named ? ' · ' + hit.refs.split(' · ').slice(2, 3).join('') : '');
      }
    } else if (hit.kind === 'dso') {
      const r = P.dso[hit.dso];
      sub = dsoKind(r)
        + ' · MAG ' + (r[3] != null ? r[3].toFixed(1) : '?')
        + (r[11] ? ' · ' + r[11] : '');
    } else if (hit.kind === 'const') {
      sub = 'CONSTELLATION · FIGURE';
    } else if (hit.kind === 'probe') {
      sub = 'PROBE · ' + (eph[hit.body] ? eph[hit.body].distAU.toFixed(2) + ' AU FROM EARTH' : 'SPACECRAFT');
    } else {
      const n = hit.body;
      const _mm = P.minors && P.minors.moons.find(m => m.name === n);
      const _mp = P.minors && P.minors.planets.find(m => m.name === n);
      sub = n === 'Sun' ? 'STAR · G2V'
        : n === 'Moon' ? 'MOON OF EARTH'
        : _mm ? 'MOON OF ' + _mm.parent.toUpperCase()
        : _mp ? 'MINOR PLANET · ' + eph[n].distAU.toFixed(2) + ' AU FROM EARTH'
        : 'PLANET · ' + eph[n].distAU.toFixed(2) + ' AU FROM EARTH';
    }
    P.ui.tip(x, y, hit.text, sub);
  }

  /* ------------------------------------------------------- time & speed -- */
  const SPD_MIN = 0.25, SPD_MAX = 3.156e7;
  const L0 = Math.log10(SPD_MIN), L1 = Math.log10(SPD_MAX);
  function speedFromSlider(v) {
    state.speed = Math.pow(10, L0 + (L1 - L0) * (v / 1000));
    syncSpeedUI();
  }
  function speedToSlider() {
    const v = (Math.log10(state.speed) - L0) / (L1 - L0) * 1000;
    const el = document.getElementById('speed');
    if (el) el.value = String(Math.round(v));
  }
  function speedLabel(s) {
    if (s < 1) return s.toFixed(2) + '× real time';
    if (s < 90) return Math.round(s) + ' s/s';
    if (s < 5400) return (s / 60).toFixed(1) + ' min/s';
    if (s < 86400) return (s / 3600).toFixed(1) + ' h/s';
    if (s < 2629800) return (s / 86400).toFixed(2) + ' days/s';
    if (s < 31557600) return (s / 2629800).toFixed(2) + ' months/s';
    return (s / 31557600).toFixed(2) + ' yr/s';
  }
  function syncSpeedUI() {
    speedToSlider();
    P.ui.set.speed(speedLabel(state.speed), 'time warp');
  }
  function nudgeSpeed(factor) {
    state.speed = Math.max(SPD_MIN, Math.min(SPD_MAX, state.speed * factor));
    syncSpeedUI();
  }
  function goNow() { state.simTimeMs = Date.now(); }

  function dateParts() {
    const iso = new Date(state.simTimeMs).toISOString();
    const main = iso.slice(0, 10) + '  ' + iso.slice(11, 16) + ' UTC';
    const delta = state.simTimeMs - Date.now();
    let off = '';
    if (Math.abs(delta) > 90e3) {
      const ad = Math.abs(delta);
      const dd = ad / 86400000;
      const txt = dd >= 1
        ? dd.toFixed(dd >= 10 ? 0 : 1) + ' days'
        : (dd * 24).toFixed(1) + ' hours';
      off = (delta > 0 ? 'Δ +' : 'Δ −') + txt + (delta > 0 ? ' ahead' : ' back');
    }
    return [main, off];
  }

  /* ------------------------------------------------------------- modes --- */
  function applyVisibility() {
    sky.dome.visible = true;
    sky.bodies.visible = state.mode === 'sky';
    solar.group.visible = state.mode === 'solar';
    sky.constellations.visible = state.constellations;
    /* the 12 zodiac figures — independent of the general constellation toggle */
    if (sky.constellationsZodiac) sky.constellationsZodiac.visible = state.zodiac;
    /* the ecliptic is a line on the celestial dome - only meaningful in sky mode */
    sky.ecliptic.visible = state.ecliptic && state.mode === 'sky';
    if (sky.galaxyWash) sky.galaxyWash.visible = state.galaxyWash && state.mode === 'sky';
    if (sky.asterisms) sky.asterisms.visible = state.asterisms;
    solar.setOrbitsVisible(state.orbits);
    /* MINORS toggle: dwarf planets + major moons (solar meshes/orbits + dome discs) */
    solar.setMinorsVisible(state.minors);
    if (sky.setMinorsVisible) sky.setMinorsVisible(state.minors);
  }
  function setMode(m) {
    if (state.mode === m) return;
    state.mode = m;
    if (m === 'solar') {
      cam.dist = 200; cam.pitch = 0.85;   /* frames inner system + Jupiter */
      state.follow = 'Sun';
      solar.loadTextures();           /* lazy: photo maps on first entry */
      /* whole system visibly in motion: Moon ~1 s/orbit, Earth 12 s,
       * Mars 23 s, Jupiter 2.4 min, outer giants drift steadily */
      state.speed = 2629800;           // 1 month / s
    } else {
      state.fovSky = Math.max(state.fovSky, 30);
      state.speed = 86400;            // 1 day / s
    }
    syncSpeedUI();
    applyVisibility();
    P.app.onUIMode(state.mode);
  }
  function toggleState(key) {
    state[key] = !state[key];
    applyVisibility();
    const map = { labels: 'labels', orbits: 'orbits', constellations: 'const', ecliptic: 'ecliptic', hoverNames: 'hover', galaxyWash: 'wash', asterisms: 'asterisms', zodiac: 'zodiac', minors: 'minors' };
    const btn = document.getElementById('tg-' + map[key]);
    if (btn) btn.classList.toggle('on', state[key]);
  }

  /* -------------------------------------------------------------- keys --- */
  window.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    switch (e.key) {
      case ' ': e.preventDefault(); togglePause(); break;
      case 'n': case 'N': goNow(); break;
      case 'm': case 'M': setMode(state.mode === 'sky' ? 'solar' : 'sky'); break;
      case 'l': case 'L': toggleState('labels'); break;
      case 'o': case 'O': toggleState('orbits'); break;
      case 'c': case 'C': toggleState('constellations'); break;
      case 'z': case 'Z': toggleState('zodiac'); break;
      case 'p': case 'P': toggleState('minors'); break;
      case 'e': case 'E': toggleState('ecliptic'); break;
      case 'w': case 'W': toggleState('galaxyWash'); break;
      case 'a': case 'A': toggleState('asterisms'); break;
      case 't': case 'T': toggleState('hoverNames'); break;
      case 'k': case 'K': toggleCatalog(); break;
      case 'x': case 'X': {
        state.highlightSel = !state.highlightSel;
        const c = document.getElementById('chk-marker');
        if (c) c.checked = state.highlightSel;
        break;
      }
      case '[': nudgeSpeed(0.5); break;
      case ']': nudgeSpeed(2); break;
      case 'h': case 'H': case '?': toggleHelp(); break;
      case 'Escape':
        if (state.catalogOpen) toggleCatalog(false);
        else select(null);
        break;
    }
  });
  function togglePause() {
    state.playing = !state.playing;
    P.ui.syncPlay();
  }
  function toggleHelp(force) {
    const h = document.getElementById('help');
    const show = force != null ? force : h.style.display === 'none';
    h.style.display = show ? '' : 'none';
  }

  /* ------------------------------------------------------------- resize -- */
  /* device pixels per arcminute of sky — keeps the 18k faint-galaxy points
     the same apparent size when the window or the field of view changes */
  function updateGalaxyScale() {
    if (sky.setGalaxyScale) {
      sky.setGalaxyScale((innerHeight * renderer.getPixelRatio()) / (state.fovSky * 60));
    }
  }
  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    sky.setPixelRatio(CAPTURE_MODE && innerWidth >= 3000 ? 2 : renderer.getPixelRatio());
    updateGalaxyScale();
  }
  window.addEventListener('resize', onResize);
  onResize();

  /* ------------------------------------------------------------ ui wire -- */
  P.app = {
    state,
    toggleCatalog,
    setHighlight: on => { state.highlightSel = !!on; },
    onUIMode: m => {
      document.getElementById('btn-sky').classList.toggle('on', m === 'sky');
      document.getElementById('btn-solar').classList.toggle('on', m === 'solar');
    },
    setMode, toggleState, toggleHelp, select,
    setSpeedFromSlider: speedFromSlider,
    setSpeedValue: s => {
      state.speed = Math.max(SPD_MIN, Math.min(SPD_MAX, s));
      syncSpeedUI();
    },
    nudgeSpeed,
    goNow,
    togglePause
  };
  /* Debug handle — exposed only when the page is loaded with ?dbg=1
     (used by the _qa/ regression scripts; hidden in normal use). */
  if (/[?&]dbg=1\b/.test(location.search)) {
    P.app._dbg = {
      get sky() { return sky; }, get scene() { return scene; }, get camera() { return camera; },
      get renderer() { return renderer; }, get solar() { return solar; },
      get state() { return state; }, get cam() { return cam; }, get eph() { return eph; }
    };
  }
  P.ui.wire(P.app);
  syncSpeedUI();
  P.ui.syncPlay();

  /* catalog search wiring (DOM now exists) */
  catalogSearchEl = document.getElementById('cat-search');
  catalogSearchEl.addEventListener('input', () => renderCatalog());
  catalogSearchEl.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') toggleCatalog(false);
  });
  /* #q=… (or ?q=) opens the catalog pre-filtered — e.g. index.html#q=32349 */
  {
    let q0 = null;
    const hm = /#q=([^#]*)/.exec(location.hash || '');
    if (hm) q0 = decodeURIComponent(hm[1]);
    else {
      const qp = new URLSearchParams(location.search);
      q0 = qp.get('q');
    }
    if (q0 != null) {
      toggleCatalog(true);
      catalogSearchEl.value = q0;
      renderCatalog();
    }
  }

  /* GPU badge (this is the card actually doing the rendering) */
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    let gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
                  : gl.getParameter(gl.RENDERER);
    const m = String(gpu).match(/\(([^)]*)\)/);
    if (m) {
      /* ANGLE (VENDOR, DEVICE ENGINE, API-VERSION) -> take the device field */
      const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) gpu = parts[1];
      else if (parts.length === 1) gpu = parts[0];
    }
    gpu = String(gpu).replace(/^ANGLE\s*/i, '')
      .replace(/\s+(Direct3D1[12]|Direct3D|D3D1[12]|OpenGL ES \S+|OpenGL|Metal|SwiftShader|Google).*$/i, '')
      .replace(/\s*\(\s*0x[0-9A-Fa-f]+\)?\s*$/, '')   // drop D3D device handles (balanced or not)
      .trim();
    P.ui.set.gpu(gpu || 'WebGL device');
  } catch (e) { P.ui.set.gpu('WebGL'); }

  /* ---------------------------------------------------------- main loop -- */
  let lastNow = performance.now();
  let fpsFrames = 0, lastHud = 0, booted = false;

  function frame(now) {
    requestAnimationFrame(frame);
    /* clamp: never negative (timestamp quirks), never huge (tab was hidden) */
    const dtms = Math.max(0, Math.min(100, now - lastNow));
    lastNow = now;
    if (state.playing) state.simTimeMs += dtms * state.speed;
    const d = (state.simTimeMs - P.J2000_MS) / 86400000;

    computeBodies(d);

    if (state.mode === 'solar') {
      solar.update(d);
      if (state.follow !== 'Sun') cam.target.copy(solar.meshes[state.follow] ? solar.meshes[state.follow].position : solar.sun.position);
      else cam.target.set(0, 0, 0);
    }

    /* fly-to camera tween (catalog "point at") */
    if (cam.viewAnim) {
      const a = cam.viewAnim;
      a.t = Math.min(1, a.t + (dtms / 1000) / 0.8);
      const e = a.t * a.t * (3 - 2 * a.t);
      cam.yaw = a.y0 + a.dy * e;
      cam.pitch = a.p0 + a.dp * e;
      if (a.t >= 1) cam.viewAnim = null;
    }

    if (DEMO_SMOOTH) {
      /* while a fly-to owns the camera, keep the spring targets synced to it
         so the next drag starts from the animated position */
      if (cam.viewAnim || yawT === null) { yawT = cam.yaw; pitchT = cam.pitch; }
      const k = 1 - Math.exp(-(dtms / 1000) * 30);   /* τ ≈ 33 ms */
      cam.yaw += (yawT - cam.yaw) * k;
      cam.pitch += (pitchT - cam.pitch) * k;
    }

    applyCamera();

    /* selection marker — follows the selected object (Moon, planets, …) */
    {
      let on = false;
      if (state.highlightSel && state.selectedEntry) {
        const p = anchorOf(state.selectedEntry);
        if (p && isFinite(p.x) && isFinite(p.y) && isFinite(p.z)) {
          marker.position.copy(p);
          const dist = Math.max(0.05, camera.position.distanceTo(marker.position));
          const s = dist * 2 * Math.tan(camera.fov * DEG / 2) * 0.05
            * (1 + 0.07 * Math.sin(performance.now() * 0.0035));
          marker.scale.set(s, s, 1);
          on = true;
        }
      }
      marker.visible = on;
    }
    updateLabels();
    sky.setBodies(key => eph[key] || null);
    sky.mat.uniforms.uTime.value = now / 1000;

    renderer.render(scene, camera);

    /* HUD (throttled; the first frame always updates so fields populate at once) */
    fpsFrames++;
    if (now - lastHud >= 500 || fpsFrames === 1) {
      const fps = lastHud ? Math.round(fpsFrames * 1000 / (now - lastHud)) : 0;
      P.ui.set.fps(fps ? String(fps) : '--');
      fpsFrames = 0; lastHud = now;
      const [dm, off] = dateParts();
      P.ui.set.date(dm, off);
      syncSpeedUI();
    }

    if (!booted) {
      booted = true;
      document.title = 'PERIHELION READY';
      P.ui.splashDone();
    }
  }

  /* watchdog: if no frame ever renders, say so on the splash screen */
  setTimeout(() => {
    if (!booted) {
      document.title = 'PERIHELION ERROR';
      P.ui.splashFail('Rendering did not start within 12 s. ' +
        'Your GPU may be unavailable to WebGL — try enabling hardware acceleration in your browser.');
    }
  }, 12000);

  /* first frame */
  if (location.hash.indexOf('solar') >= 0) setMode('solar');
  if (location.hash.indexOf('catalog') >= 0) toggleCatalog(true);
  applyVisibility();
  P.app.onUIMode(state.mode);
  frame(performance.now());

  return P.app;
})();
