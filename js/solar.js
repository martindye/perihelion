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

    /* planets */
    const meshes = {};
    const eclTmp = new THREE.Vector3();
    for (const pl of P.planets) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(pl.size, 40, 24),
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
    }

    const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _earth = new THREE.Vector3(1e9, 0, 0);

    return {
      group, sun, moonMesh,
      meshes,
      setOrbitsVisible(v) {
        for (const child of group.children) if (child.isLine) child.visible = v;
      },
      setVisible(v) { group.visible = v; },
      update
    };
  }

  return { build, distScale };
})();
