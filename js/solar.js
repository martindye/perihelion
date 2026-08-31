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
  const TIER2_RIM = 44;                       // rim radius for interplanetary probes

  function distScale(rAu) { return DIST_K * Math.pow(Math.max(rAu, 1e-6), DIST_P); }

  /* World position of a planet from its heliocentric ecliptic vector. */
  function posFromEcl(eclV, out) {
    const r = eclV.length();
    // ecliptic -> equatorial
    const X = eclV.x, Y = eclV.y * Math.cos(EPSJ) - eclV.z * Math.sin(EPSJ),
          Z = eclV.y * Math.sin(EPSJ) + eclV.z * Math.cos(EPSJ);
    const wx = X, wy = Z, wz = -Y;            // equatorial -> world
    const wl = Math.hypot(wx, wy, wz) || 1;
    const s = distScale(r) / wl;
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
    sunGlow.scale.set(24, 24, 1);
    group.add(sunGlow);

    const light = new THREE.PointLight(0xfff2d8, 1.55, 0, 0);
    group.add(light);
    group.add(new THREE.AmbientLight(0x2a3550, 0.55));

    /* planets — a flat colour is the placeholder; photo maps (textures/*.jpg,
       equirectangular 2048×1024) are lazy-loaded via <img> on first use and
       swap in a Phong material when they arrive (see loadTextures). */
    const meshes = {};
    const eclTmp = new THREE.Vector3();
    for (const pl of P.planets) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(pl.size, 48, 28),
        new THREE.MeshLambertMaterial({ color: pl.color })
      );
      group.add(mesh);
      meshes[pl.name] = mesh;

      if (pl.rings) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(pl.size * 1.35, pl.size * 2.3, 96),
          new THREE.MeshBasicMaterial({
            color: 0xcbb98f, side: THREE.DoubleSide, transparent: true, opacity: 0.55
          })
        );
        ring.rotation.x = -Math.PI / 2 + 0.35;
        ring.rotation.y = 0.12;
        mesh.add(ring);
      }

      /* orbit path — 720 samples of the true ellipse through the same
       * radial compression, so planets always sit on their line */
      const pts = new Float32Array(721 * 3);
      const out = new THREE.Vector3();
      for (let i = 0; i <= 720; i++) {
        const nu = i / 720 * TAU;
        P.astro.helioEclByTrueAnomaly(pl, nu, eclTmp);
        posFromEcl(eclTmp, out);
        pts[i * 3] = out.x; pts[i * 3 + 1] = out.y; pts[i * 3 + 2] = out.z;
      }
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const line = new THREE.LineLoop(og, new THREE.LineBasicMaterial({
        color: 0x3d5a80, transparent: true, opacity: 0.45, depthWrite: false
      }));
      line.userData.planet = pl.name;
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
      const og = new THREE.BufferGeometry();
      og.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const line = new THREE.LineLoop(og, new THREE.LineBasicMaterial({
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
    function probeModel(p) {
      const g = new THREE.Group();
      const s = p.tier === 2 ? p.size * 8 : p.size;
      const body = new THREE.MeshLambertMaterial({ color: 0x9aa2b1 });
      const gold = new THREE.MeshLambertMaterial({ color: 0xd9b34a, emissive: 0x2a1d05 });
      const panel = new THREE.MeshLambertMaterial({ color: 0x27406e, emissive: 0x0a1420 });
      const add = (m) => { g.add(m); return m; };
      if (p.model === 'jwst') {
        const shield = add(new THREE.Mesh(new THREE.CylinderGeometry(0.95 * s, 1.15 * s, 0.05, 6), panel));
        shield.rotation.z = 0.18;
        const mirror = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.12, 6), gold));
        mirror.position.y = 0.5 * s;
        mirror.rotation.x = Math.PI / 2;
      } else if (p.model === 'parker') {
        const shield = add(new THREE.Mesh(new THREE.CylinderGeometry(0.75 * s, 0.75 * s, 0.07, 8), gold));
        shield.rotation.z = Math.PI / 2;
        const bus = add(new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.4 * s, 0.4 * s), body));
        bus.position.x = 0.55 * s;
      } else if (p.model === 'juno') {
        const bus = add(new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.5 * s, 0.5 * s), body));
        for (let k = 0; k < 3; k++) {
          const wing = add(new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.04 * s, 0.34 * s), panel));
          const a = k * (Math.PI * 2 / 3);
          wing.position.set(Math.cos(a) * 1.0 * s, 0, Math.sin(a) * 1.0 * s);
          wing.rotation.y = -a;
        }
      } else if (p.model === 'voyager' || p.model === 'nh') {
        const bus = add(new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.34 * s, 0.5 * s, 8), body));
        const dish = add(new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 0.22 * s, 12, 1, true), body));
        dish.position.y = 0.4 * s;
        dish.rotation.x = Math.PI;
        dish.material = gold;
        const rtg = add(new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.06 * s, 0.9 * s), gold));
        rtg.position.set(0.6 * s, -0.1 * s, 0);
      } else { /* generic bus + panels */
        const bus = add(new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 0.45 * s, 0.45 * s), body));
        for (const side of [-1, 1]) {
          const wing = add(new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.04 * s, 0.3 * s), panel));
          wing.position.x = side * 0.7 * s;
        }
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
         Tier-2 (interplanetary) probes compress to the Sun's glow at this
         scene's scale, so they are pushed to the scene rim along their
         true direction — a visible "rim icon" instead of a lost speck. */
      if (P.probes) for (const p of P.probes.probes) {
        P.astro.probeHeliocEcl(p.pb, d, eclTmp);
        posFromEcl(eclTmp, _v1);
        if (p.tier === 2) {
          const L = _v1.length();
          if (L > 1e-6 && L < TIER2_RIM) _v1.multiplyScalar(TIER2_RIM / L);
        }
        meshes[p.name].position.copy(_v1);
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
                      Uranus: 'uranus', Neptune: 'neptune', Moon: 'moon' };
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
        };
        img.onerror = () => { /* keep the procedural colour */ };
        img.src = src;
      };
      for (const name of Object.keys(TEXNAME)) {
        const m = name === 'Moon' ? moonMesh : meshes[name];
        if (m) apply(m, TEXNAME[name]);
      }
    }

    return {
      group, sun, moonMesh,
      meshes,
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
