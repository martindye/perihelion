/* ============================================================================
 * PERIHELION — solar system mode
 * A 3D model of the inner & outer planets on compressed (but consistent)
 * radial scales, lit by the Sun, with Saturn's rings and the Moon.
 * ==========================================================================*/
'use strict';
P.solar = (function () {
  const TAU = Math.PI * 2;
  const DIST_K = 26, DIST_P = 0.62;          // compressed radial scale
  const SUN_R = 3.2;
  const MOON_DIST = 2.2;
  const TIER2_RIM = 300;                      // rim radius for interstellar probes
                                              // (outside Neptune ~215 / Ixion ~242)

  function distScale(rAu) { return DIST_K * Math.pow(Math.max(rAu, 1e-6), DIST_P); }

  /* World position of a planet from its heliocentric ecliptic vector.
   * Scene radius = distScale(r) = 26·r^0.62 — compressed but ORDER-CORRECT:
   * Mercury 14.4, Earth 26, Jupiter 72, Saturn 105, Uranus 162, Neptune 215.
   * (An earlier version divided by the radius as well, which flipped the
   *  system — Mercury outside Neptune — and piled Saturn/Uranus/Neptune
   *  into the Sun's glow.) */
  function posFromEcl(eclV, out) {
    const r = eclV.length();
    // ecliptic -> equatorial
    const X = eclV.x, Y = eclV.y * Math.cos(EPSJ) - eclV.z * Math.sin(EPSJ),
          Z = eclV.y * Math.sin(EPSJ) + eclV.z * Math.cos(EPSJ);
    const wx = X, wy = Z, wz = -Y;            // equatorial -> world
    const wl = Math.hypot(wx, wy, wz) || 1;
    const s = distScale(r);
    return out.set(wx / wl * s, wy / wl * s, wz / wl * s);
  }
  // (obliquity constant, duplicated here to keep this module self-contained)
  const EPSJ = 23.4392811 * Math.PI / 180;

  function build(scene) {
    const group = new THREE.Group();
    scene.add(group);

    /* Sun */
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(SUN_R, 48, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe08a })
    );
    group.add(sun);
    const glowC = document.createElement('canvas');
    glowC.width = glowC.height = 256;
    {
      const g = glowC.getContext('2d');
      const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,236,190,0.95)');
      gr.addColorStop(0.25, 'rgba(255,205,120,0.55)');
      gr.addColorStop(0.6, 'rgba(255,160,60,0.12)');
      gr.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowC), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sunGlow.scale.set(16, 16, 1);
    group.add(sunGlow);

    const light = new THREE.PointLight(0xfff2d8, 1.55, 0, 0);
    group.add(light);
    group.add(new THREE.AmbientLight(0x2a3550, 0.55));

    /* planets — a flat colour is the placeholder; photo maps (textures/*.jpg,
       equirectangular 2048×1024) are lazy-loaded via <img> on first use and
       swap in a Phong material when they arrive (see loadTextures). */
    /* render-on-demand hook (app.js): texture maps swap in asynchronously
       after the frame that requested them — poke the scene dirty each time */
    const pokeTex = () => { if (P.solar.onTexture) P.solar.onTexture(); };

    const meshes = {};
    const ringMeshes = {};
    const eclTmp = new THREE.Vector3();
    /* orbit paths — one merged LineSegments per class (planets / minors)
       instead of one draw call per body: 17 loops used to cost 17 calls */
    const planetOrbitSegs = [];
    const minorOrbitSegs = [];
    for (const pl of P.planets) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(pl.size, 48, 28),
        new THREE.MeshLambertMaterial({ color: pl.color })
      );
      group.add(mesh);
      meshes[pl.name] = mesh;

      if (pl.rings) {
        /* Real radial strip texture (SST 2k_saturn_ring_alpha, 2048 px span
           1.25–2.33 Saturn radii — C-ring inner edge → F ring, verified
           column-by-column against the real ring radii). Mapped with radial
           UVs; until the map arrives the flat tint below is the fallback. */
        const RING_IN = 1.25, RING_OUT = 2.33;      // annulus span, planet radii
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(pl.size * RING_IN, pl.size * RING_OUT, 128),
          new THREE.MeshBasicMaterial({
            color: 0xcbb98f, side: THREE.DoubleSide, transparent: true, opacity: 0.55
          })
        );
        /* Radial UV remap: three's RingGeometry carries planar UVs, but the
           strip is 1-D radial — u = normalised radius (0 at RING_IN, 1 at
           RING_OUT), v = middle of the strip. */
        {
          const p = ring.geometry.attributes.position, uv = ring.geometry.attributes.uv;
          for (let i = 0; i < p.count; i++) {
            const r = Math.hypot(p.getX(i), p.getY(i));
            uv.setXY(i, (r - pl.size * RING_IN) / (pl.size * (RING_OUT - RING_IN)), 0.5);
          }
          uv.needsUpdate = true;
        }
        ring.rotation.x = -Math.PI / 2 + 0.35;
        ring.rotation.y = 0.12;
        ring.userData.ringTexKey = 'saturnRings';
        mesh.add(ring);
        ringMeshes[pl.name] = ring;
      }

      /* orbit path — 720 samples of the true ellipse through the same
       * radial compression, so planets always sit on their line. Closed
       * loop → 720 segments, appended to the shared merged buffer. */
      const pts = new Float32Array(721 * 3);
      const out = new THREE.Vector3();
      for (let i = 0; i <= 720; i++) {
        const nu = i / 720 * TAU;
        P.astro.helioEclByTrueAnomaly(pl, nu, eclTmp);
        posFromEcl(eclTmp, out);
        pts[i * 3] = out.x; pts[i * 3 + 1] = out.y; pts[i * 3 + 2] = out.z;
      }
      for (let i = 0; i < 720; i++) {
        planetOrbitSegs.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2],
          pts[(i + 1) * 3], pts[(i + 1) * 3 + 1], pts[(i + 1) * 3 + 2]);
      }
    }
    {
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', new THREE.BufferAttribute(new Float32Array(planetOrbitSegs), 3));
      const line = new THREE.LineSegments(og, new THREE.LineBasicMaterial({
        color: 0x3d5a80, transparent: true, opacity: 0.45, depthWrite: false
      }));
      line.userData.planet = 'planets';
      group.add(line);
    }

    /* Minor planets, dwarf planets & their major moons (js/minors.js) —
     * osculating Kepler elements at T0 2026-08-30T12:00TDB (JPL Horizons,
     * DE440-class; moons derived from J2000 state vectors). All of their
     * meshes and orbit lines live in one group so the MINORS toggle
     * (key P) can hide the whole set at once. */
    const minorsGroup = new THREE.Group();
    group.add(minorsGroup);
    const minorOrbitLines = [];
    const elOf = m => ({ a: m.a, e: m.e, i: m.i, Omega: m.Omega, varpi: m.varpi,
                         M0: m.M0, n: m.n, t0: P.minors.t0 });
    const mEl = {};
    if (P.minors) for (const m of P.minors.planets) {
      mEl[m.name] = elOf(m);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(m.size, 40, 24),
        new THREE.MeshLambertMaterial({ color: m.color })
      );
      minorsGroup.add(mesh);
      meshes[m.name] = mesh;

      const pts = new Float32Array(721 * 3);
      const o2 = new THREE.Vector3();
      for (let i = 0; i <= 720; i++) {
        P.astro.oscEclByTrueAnomaly(mEl[m.name], i / 720 * TAU, eclTmp);
        posFromEcl(eclTmp, o2);
        pts[i * 3] = o2.x; pts[i * 3 + 1] = o2.y; pts[i * 3 + 2] = o2.z;
      }
      for (let i = 0; i < 720; i++) {
        minorOrbitSegs.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2],
          pts[(i + 1) * 3], pts[(i + 1) * 3 + 1], pts[(i + 1) * 3 + 2]);
      }
    }
    if (P.minors && minorOrbitSegs.length) {
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', new THREE.BufferAttribute(new Float32Array(minorOrbitSegs), 3));
      const line = new THREE.LineSegments(og, new THREE.LineBasicMaterial({
        color: 0x3d5a80, transparent: true, opacity: 0.4, depthWrite: false
      }));
      minorsGroup.add(line);
      minorOrbitLines.push(line);
    }

    /* Major moons (solar mode only; true direction, exaggerated distance). */
    const moonMinor = [];
    if (P.minors) for (const m of P.minors.moons) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(m.size, 20, 12),
        new THREE.MeshLambertMaterial({ color: m.color })
      );
      minorsGroup.add(mesh);
      meshes[m.name] = mesh;
      moonMinor.push({ el: elOf({ a: m.aAu, e: m.e, i: m.i, Omega: m.Omega, varpi: m.varpi, M0: m.M0, n: m.n }),
                       parent: m.parent, dist: m.dist, mesh });
    }

    /* ---- space probes (js/probes.js) ----------------------------------
     * Tier 1: small procedural spacecraft at their true (compressed)
     * heliocentric position. Tier 2 (Voyager 1/2, New Horizons) ride the
     * same true position hundreds of units out — their "rim icon" — so the
     * model is enlarged to stay visible from an overview camera. */
    /* Detailed procedural spacecraft (plan §10.3). Tier-1 built at 2.5×
       body size so the detail reads up close; tier-2 (interstellar) icons
       stay large for the rim. */
    function probeModel(p) {
      const g = new THREE.Group();
      const s = p.tier === 2 ? p.size * 8 : p.size * 2.5;
      const body = new THREE.MeshLambertMaterial({ color: 0x9aa2b1, emissive: 0x0a0d14 });
      const gold = new THREE.MeshLambertMaterial({ color: 0xd9b34a, emissive: 0x2a1d05 });
      const gold2 = new THREE.MeshLambertMaterial({ color: 0xc8a23c, emissive: 0x1f1503 });
      const panel = new THREE.MeshLambertMaterial({ color: 0x27406e, emissive: 0x0a1420 });
      const add = (m) => { g.add(m); return m; };

      if (p.model === 'jwst') {
        /* five-layer gold sunshield: wider than the mirror (like the real
           ~21 m kite), tapered, visibly staggered stack. Kept modest so the
           whole spacecraft stays visibly smaller than the Earth it orbits. */
        for (let i = 0; i < 5; i++) {
          const layer = add(new THREE.Mesh(
            new THREE.CylinderGeometry((1.15 - i * 0.08) * s, (1.15 - i * 0.08) * s, 0.04 * s, 6),
            i % 2 ? gold2 : gold));
          layer.position.y = -0.16 * s - i * 0.12 * s;
        }
        /* bus between shield and mirror */
        const bus = add(new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.24 * s, 0.4 * s), body));
        bus.position.y = 0.02 * s;
        /* primary mirror — the real JWST layout: 18 hexagons in a side-2
           honeycomb (6 inner + 12 outer, centre empty). A dark backing panel
           + generous grout make the individual tiles read from a distance. */
        const h = 0.19 * s;                        /* segment circumradius   */
        const gap = 1.18;                          /* >1 => visible grout    */
        const yMirror = 0.5 * s;
        const dark = new THREE.MeshLambertMaterial({ color: 0x14161c });
        const back = add(new THREE.Mesh(new THREE.CylinderGeometry(5.3 * h, 5.3 * h, 0.03 * s, 6), dark));
        back.position.y = yMirror - 0.06 * s;
        const segGeo = new THREE.CylinderGeometry(h, h, 0.12 * s, 6);
        const cells = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
                       [2, -2], [2, -1], [2, 0], [1, 1], [0, 2], [-1, 2],
                       [-2, 2], [-2, 1], [-2, 0], [-1, -1], [0, -2], [1, -2]];
        for (const [cx, cy] of cells) {
          const m = add(new THREE.Mesh(segGeo, (cx + cy) % 2 ? gold : gold2));
          m.position.set(Math.sqrt(3) * h * gap * (cx + cy / 2), yMirror, 1.5 * h * gap * cy);
        }
      } else if (p.model === 'parker') {
        const shield = add(new THREE.Mesh(new THREE.CylinderGeometry(0.75 * s, 0.75 * s, 0.07 * s, 8), gold));
        shield.rotation.z = Math.PI / 2;                 /* octagon faces the Sun (−x) */
        const bus = add(new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.4 * s, 0.4 * s), body));
        bus.position.x = 0.55 * s;
        const rad = add(new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.05 * s, 0.3 * s), body));
        rad.position.set(0.5 * s, 0.3 * s, 0);          /* radiator panel */
      } else if (p.model === 'juno') {
        const bus = add(new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.5 * s, 0.5 * s), body));
        for (let k = 0; k < 3; k++) {
          const wing = add(new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.04 * s, 0.34 * s), panel));
          const a = k * (Math.PI * 2 / 3);
          wing.position.set(Math.cos(a) * 1.0 * s, 0, Math.sin(a) * 1.0 * s);
          wing.rotation.y = -a;
        }
        const dish = add(new THREE.Mesh(new THREE.ConeGeometry(0.28 * s, 0.14 * s, 12, 1, true), gold));
        dish.position.y = 0.36 * s;
        dish.rotation.x = Math.PI;
      } else if (p.model === 'voyager' || p.model === 'nh') {
        const bus = add(new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.34 * s, 0.5 * s, 8), body));
        const dish = add(new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 0.22 * s, 12, 1, true), gold));
        dish.position.y = 0.42 * s;
        dish.rotation.x = Math.PI;
        const tray = add(new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.1 * s, 12), body));
        tray.position.y = 0.2 * s;                       /* instrument tray under the dish */
        if (p.model === 'nh') {
          /* New Horizons: twin solar arrays */
          for (const side of [-1, 1]) {
            const wing = add(new THREE.Mesh(new THREE.BoxGeometry(1.1 * s, 0.04 * s, 0.34 * s), panel));
            wing.position.x = side * 0.95 * s;
          }
        } else {
          /* Voyager: RTG boom (3 RTGs) + long magnetometer boom */
          const boom = add(new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 0.04 * s, 0.04 * s), body));
          boom.position.set(0.6 * s, -0.15 * s, 0);
          for (let k = 0; k < 3; k++) {
            const r = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 0.18 * s, 8), gold2));
            r.position.set(0.25 * s + k * 0.4 * s, -0.22 * s, 0);
          }
          const mb = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 1.1 * s, 6), body));
          mb.rotation.z = Math.PI / 2;
          mb.position.set(-0.9 * s, 0.1 * s, 0.2 * s);
        }
      } else { /* generic bus + panels + dish */
        const bus = add(new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 0.45 * s, 0.45 * s), body));
        for (const side of [-1, 1]) {
          const wing = add(new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.04 * s, 0.3 * s), panel));
          wing.position.x = side * 0.7 * s;
        }
        const dish = add(new THREE.Mesh(new THREE.ConeGeometry(0.24 * s, 0.12 * s, 10, 1, true), gold));
        dish.position.y = 0.32 * s;
        dish.rotation.x = Math.PI;
      }
      /* furthest reach of any part (for the de-embedding nudge in update) */
      switch (p.model) {
        case 'jwst': g.userData.half = 1.15 * s; break;
        case 'parker': g.userData.half = 0.85 * s; break;
        case 'juno': g.userData.half = 1.75 * s; break;
        case 'voyager': g.userData.half = 1.2 * s; break;
        case 'nh': g.userData.half = 1.5 * s; break;
        default: g.userData.half = 1.15 * s;
      }
      return g;
    }
    const probeKeys = [];
    if (P.probes) for (const p of P.probes.probes) {
      const mesh = probeModel(p);
      mesh.position.set(1e9, 0, 0);
      group.add(mesh);
      meshes[p.name] = mesh;
      probeKeys.push(p.name);
    }

    /* Moon (geocentric) */
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 24, 12),
      new THREE.MeshLambertMaterial({ color: 0xb9bcc4 })
    );
    group.add(moonMesh);

    const SPIN = { Mercury: 58.6, Venus: -243, Earth: 0.997, Mars: 1.026,
                   Jupiter: 0.41, Saturn: 0.44, Uranus: -0.72, Neptune: 0.67 };

    const EARTH = P.planets.find(p => p.name === 'Earth');
    function update(d) {
      /* Sun: steady Carrington-ish spin (25.4 d, equatorial). The map is a
         static SDO-style composite, so this reads as the photosphere turning
         rather than the true differential rotation. */
      sun.rotation.y = (d / 25.38) * TAU % TAU;
      for (const pl of P.planets) {
        const mesh = meshes[pl.name];
        P.astro.helioEcl(pl, d, eclTmp);
        posFromEcl(eclTmp, _v1);
        mesh.position.copy(_v1);
        mesh.rotation.y = (d / SPIN[pl.name]) * TAU % TAU;
        if (pl.name === 'Earth') _earth.copy(_v1);
      }
      /* Moon: real geocentric direction, compressed distance */
      P.astro.moonEcl(d, eclTmp);
      P.astro.ecl2equ(eclTmp, _v2);
      const wx = _v2.x, wy = _v2.z, wz = -_v2.y;
      const wl = Math.hypot(wx, wy, wz) || 1;
      moonMesh.position.set(
        _earth.x + wx / wl * MOON_DIST,
        _earth.y + wy / wl * MOON_DIST,
        _earth.z + wz / wl * MOON_DIST
      );
      /* minor planets — osculating elements at T0 (JPL Horizons) */
      for (const name in mEl) {
        P.astro.oscEcl(mEl[name], d, eclTmp);
        posFromEcl(eclTmp, _v1);
        meshes[name].position.copy(_v1);
        meshes[name].rotation.y = (d * 0.4) % TAU;
      }
      /* major moons — true parent-relative direction, exaggerated distance */
      for (const mm of moonMinor) {
        P.astro.oscEcl(mm.el, d, eclTmp);
        P.astro.ecl2equ(eclTmp, _v2);
        const mwx = _v2.x, mwy = _v2.z, mwz = -_v2.y;
        const mwl = Math.hypot(mwx, mwy, mwz) || 1;
        const p = meshes[mm.parent].position;
        mm.mesh.position.set(p.x + mwx / mwl * mm.dist, p.y + mwy / mwl * mm.dist, p.z + mwz / mwl * mm.dist);
      }
      /* probes — true (compressed) heliocentric position from Horizons data.
          Tier-2 (interstellar) probes sit at compressed radii of 347-631,
          far beyond the overview view, so they are shown at their true
          positions there (the r=300 rim guard is a no-op for them today). */
      if (P.probes) for (const p of P.probes.probes) {
        P.astro.probeHeliocEcl(p.pb, d, eclTmp);
        posFromEcl(eclTmp, _v1);
        if (p.tier === 2) {
          const L = _v1.length();
          if (L > 1e-6 && L < TIER2_RIM) _v1.multiplyScalar(TIER2_RIM / L);
        }
        /* de-embed: on this compressed scale a probe can physically sit
           inside a body's mesh (JWST at L2 is 0.26 scene-units from Earth,
           inside the 0.9-unit Earth sphere; Juno is always inside Jupiter).
           Nudge it just clear of whatever sphere it is buried in. */
        const half = meshes[p.name].userData.half;
        for (const pl of P.planets) {
          const pp = meshes[pl.name].position;
          const dx = _v1.x - pp.x, dy = _v1.y - pp.y, dz = _v1.z - pp.z;
          const L2 = Math.hypot(dx, dy, dz);
          /* park the probe clearly outside the planet's disc — ~1.5 radii
             from centre for L2-type company — not just non-intersecting */
          const minR = pl.size * 1.5 + half * 1.1;
          if (L2 > 1e-9 && L2 < minR) {
            const k = minR / L2;
            _v1.x = pp.x + dx * k;
            _v1.y = pp.y + dy * k;
            _v1.z = pp.z + dz * k;
          }
        }
        const lsun = _v1.length();
        const smin = SUN_R + half * 1.05;
        if (lsun > 1e-9 && lsun < smin) _v1.multiplyScalar(smin / lsun);
        meshes[p.name].position.copy(_v1);
        meshes[p.name].rotation.y = (d * 0.2) % TAU;  /* slow turntable for the detail */
      }
    }

    const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _earth = new THREE.Vector3(1e9, 0, 0);

    /* photo surface maps — embedded data-URLs in js/planets-textures.js
       (public-domain mosaics, 2048x1024). Embedded rather than fetched: a
       file:// page cannot upload a loose <img file> to WebGL (opaque-origin
       SecurityError), while data-URL images are same-origin and clean.
       Applied lazily on first solar-mode entry; the flat colour stays as
       the fallback if a map is missing. */
    const TEXNAME = { Mercury: 'mercury', Venus: 'venus', Earth: 'earth',
                      Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn',
                      Uranus: 'uranus', Neptune: 'neptune', Moon: 'moon',
                      /* dwarf planets & major moons (minors.js bodies) */
                      Pluto: 'pluto', Ceres: 'ceres', Vesta: 'vesta',
                      Pallas: 'pallas', Hygiea: 'hygiea', Ixion: 'ixion',
                      Eris: 'eris', Haumea: 'haumea', Makemake: 'makemake',
                      Io: 'io', Europa: 'europa', Ganymede: 'ganymede',
                      Callisto: 'callisto', Titan: 'titan', Triton: 'triton',
                      Iapetus: 'iapetus', Rhea: 'rhea', Phobos: 'phobos',
                      Deimos: 'deimos', Charon: 'charon' };
    let texStarted = false;
    function loadTextures() {
      if (texStarted) return;
      texStarted = true;
      const pool = (P.planetTex) || {};
      const apply = (mesh, key) => {
        const src = pool[key];
        if (!src) return;
        const img = new Image();
        img.onload = () => {
          const tex = new THREE.Texture(img);
          tex.needsUpdate = true;
          const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 6, specular: 0x1a1a1a });
          mesh.material.dispose();
          mesh.material = mat;
          pokeTex();
        };
        img.onerror = () => { /* keep the procedural colour */ };
        img.src = src;
      };
      const applyRing = (ring) => {
        const src = pool[ring.userData.ringTexKey];
        if (!src) return;
        const img = new Image();
        img.onload = () => {
          const tex = new THREE.Texture(img);
          tex.needsUpdate = true;
          /* strip is 2048x125 (non-POT height): clamp + linear, no mips */
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          ring.material.dispose();
          ring.material = new THREE.MeshBasicMaterial({
            map: tex, side: THREE.DoubleSide,
            transparent: true, depthWrite: false
          });
          pokeTex();
        };
        img.onerror = () => { /* keep the flat-tint fallback */ };
        img.src = src;
      };
      for (const name of Object.keys(TEXNAME)) {
        const m = name === 'Moon' ? moonMesh : meshes[name];
        if (m) apply(m, TEXNAME[name]);
      }
      for (const name in ringMeshes) applyRing(ringMeshes[name]);
      /* Sun: Basic (self-lit) with the photo map; flat colour until it lands */
      const sunSrc = pool.sun;
      if (sunSrc) {
        const img = new Image();
        img.onload = () => {
          const tex = new THREE.Texture(img);
          tex.needsUpdate = true;
          sun.material.dispose();
          sun.material = new THREE.MeshBasicMaterial({ map: tex });
          pokeTex();
        };
        img.onerror = () => { /* keep the flat colour */ };
        img.src = sunSrc;
      }
    }

    return {
      group, sun, moonMesh,
      meshes, ringMeshes,
      loadTextures,
      setOrbitsVisible(v) {
        for (const child of group.children) if (child.isLine) child.visible = v;
        for (const l of minorOrbitLines) l.visible = v;   /* nested in minorsGroup */
      },
      /* MINORS toggle (key P): dwarf planets + their major moons */
      setMinorsVisible(v) { minorsGroup.visible = v; },
      setVisible(v) { group.visible = v; },
      update
    };
  }

  return { build, distScale };
})();
