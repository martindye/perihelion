/* ============================================================================
 * PERIHELION — journeys
 * A "Google Maps for the solar neighbourhood": give it a start and an end
 * (a city, a planet, or a star) and it flies you there the cinematic way —
 * overview, departure, launch, warp cruise, arrival — while the solar
 * system keeps moving on its own clock the whole way.
 *
 * The scene geometry is the app's existing one: the (compressed-scale) solar
 * system at the origin, the celestial dome ~5000 units out. An interstellar
 * destination is a star sprite at 4500·dir on the dome; the camera simply
 * travels that path. The starfield drifts behind (dome lag) to sell the
 * warp, and the sim clock runs at the mission's time-compression rate so
 * the planets visibly lap their orbits while you watch.
 * ==========================================================================*/
'use strict';
P.journey = (function () {
  const TAU = Math.PI * 2;
  const C_KMS = 299792.458;          // speed of light, km/s
  const SEC_PER_YR = 31557600;

  /* drive presets — (cruise speed, sustained acceleration) */
  const PRESETS = {
    apollo:  { label: 'Apollo-class (chemical)',     vKms: 11,          aG: 1 },
    fusion:  { label: 'Fusion drive (0.1 c)',        vKms: 0.1 * C_KMS, aG: 1 },
    hmary:   { label: 'Project Hail Mary (0.99 c)',  vKms: 0.99 * C_KMS, aG: 2 },
    photon:  { label: 'Light chaser (0.999 c)',      vKms: 0.999 * C_KMS, aG: 10 }
  };

  /* state */
  let ctx = null;    // context handed over by app.js (see P.journey.init)
  let j = null;      // active journey state (null when idle)
  let snapshot = null;
  let arrived = null;  /* {dest: V3, sprite, to} — the lingering arrival view */

  const v3 = (x, y, z) => new ctx.THREE.Vector3(x, y, z);
  const easeIO = u => u * u * (3 - 2 * u);
  const lerp = (a, b, u) => a + (b - a) * u;

  /* ------------------------------------------------------- address/scene -- */
  function starScenePos(ra, dec, radius) {
    return ctx.raDecToVec3(ra, dec, new ctx.THREE.Vector3(), radius);
  }
  function addrPos(addr) {
    if (addr.type === 'city') {
      const p = ctx.bodyPos('Earth');
      return p ? p.clone() : null;
    }
    if (addr.type === 'body') {
      const p = ctx.bodyPos(addr.name);
      return p ? p.clone() : null;
    }
    if (addr.type === 'star') {
      if (addr.dir) return addr.dir.clone().normalize().multiplyScalar(4500);
      return starScenePos(addr.ra, addr.dec, 4500);
    }
    return null;
  }
  function cityLatLonVec3(lat, lon) {
    /* lat/lon -> local unit vector on the Earth sphere (equirectangular map
       convention: lon 0 at map centre, +lon east, +lat north). */
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    return v3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
  }

  /* ------------------------------------------------------- mission maths -- */
  /* constant accel a up to vMax, cruise, symmetric decel. d in km. */
  function mission(dKm, vMax, aG) {
    const a = aG * 9.81 / 1000;                 // km/s²
    const accT = vMax / a;                      // s to reach vMax
    const dAcc = 0.5 * a * accT * accT;         // km covered while accelerating
    if (2 * dAcc >= dKm) {
      const vPeak = Math.sqrt(a * dKm);
      const t = vPeak / a;
      return { T: 2 * t, vPeak, accT: t };
    }
    return { T: 2 * accT + (dKm - 2 * dAcc) / vMax, vPeak: vMax, accT };
  }
  /* distance (km) at mission time t */
  function profileDist(t, m, dTotal) {
    const a = m.vPeak / m.accT;
    const dAcc = 0.5 * a * m.accT * m.accT;
    if (2 * m.accT >= m.T - 1e-9) {             /* accel/decel only */
      if (t <= m.T / 2) return 0.5 * a * t * t;
      const tt = m.T - t;
      return dTotal - 0.5 * a * tt * tt;
    }
    if (t <= m.accT) return 0.5 * a * t * t;
    if (t >= m.T - m.accT) {
      const tt = m.T - t;
      return dTotal - 0.5 * a * tt * tt;
    }
    return dAcc + m.vPeak * (t - m.accT);
  }
  function speedAt(t, m) {
    if (t <= 0 || t >= m.T) return 0;
    if (t <= m.accT) return (m.vPeak / m.accT) * t;
    if (t >= m.T - m.accT) return (m.vPeak / m.accT) * (m.T - t);
    return m.vPeak;
  }

  /* ------------------------------------------------------- plan a trip ---- */
  /* pure: mission numbers for a from/to/preset triple, no scene changes */
  function quote(from, to, presetKey) {
    const preset = PRESETS[presetKey] || PRESETS.hmary;
    const fromPos = addrPos(from);
    const toPos0 = addrPos(to);
    if (!fromPos || !toPos0) return { ok: false, error: 'could not locate that address' };

    const interstellar = to.type === 'star';
    const dest = toPos0.clone();
    let dKm, dLabel;
    if (interstellar) {
      const ly = (to.distPc || 0) * 3.26156;    /* pc -> ly */
      dKm = ly * 9.4607e12;
      dLabel = to.distPc
        ? to.distPc.toFixed(2) + ' pc · ' + ly.toFixed(1) + ' light-years'
        : 'distance unknown';
    } else {
      const a1 = ctx.auRadius(from) || 1;
      const a2 = ctx.auRadius(to) || 0;
      dKm = Math.abs(a2 - a1) * 1.496e8;
      dLabel = Math.abs(a2 - a1).toFixed(2) + ' AU';
    }
    if (!isFinite(dKm) || dKm <= 0) {
      return { ok: false, error: (from.type === 'city' && to.type === 'city')
        ? 'that is walking distance — take a taxi' : 'no route between those two addresses' };
    }
    const m = mission(dKm, preset.vKms, preset.aG);
    return {
      ok: true, preset, fromPos, dest, interstellar, m, dKm, dLabel,
      years: m.T / SEC_PER_YR,
      summary: {
        from: labelOf(from), to: labelOf(to),
        preset: preset.label,
        distance: dLabel,
        cruise: fmtSpeed(preset.vKms) + ' · accel ' + preset.aG + ' g',
        time: fmtYears(m.T / SEC_PER_YR),
        note: interstellar
          ? 'time compression ×' + fmtBig(m.T / Math.max(7, Math.min(26, 8 + (m.T / SEC_PER_YR) * 0.3)))
          : 'the planets keep moving while you watch'
      }
    };
  }

  /* ------------------------------------------------------------- launch -- */
  let seq = 0;
  function clearArrived() {
    if (!arrived) return;
    if (arrived.sprite && arrived.sprite.parent) arrived.sprite.parent.remove(arrived.sprite);
    arrived = null;
  }
  function launch(from, to, presetKey) {
    if (j) return { ok: false, error: 'a journey is already in flight' };
    clearArrived();                    /* a new voyage replaces the old view */
    const q = quote(from, to, presetKey);
    if (!q.ok) return q;
    const { preset, fromPos, dest, interstellar, m, dKm, dLabel, years } = q;
    const dir = dest.clone().sub(fromPos).normalize();

    let cityDir = null;
    if (from.type === 'city') cityDir = cityLatLonVec3(from.lat, from.lon);

    /* destination star sprite (interstellar only) */
    let destSprite = null;
    if (interstellar) {
      destSprite = makeStarSprite(to.bv != null ? ctx.bvColor(to.bv) : 0xffe0b0);
      destSprite.position.copy(dest);
      destSprite.visible = false;
      ctx.scene.add(destSprite);
    }
    /* departure city pin on the Earth */
    let pin = null;
    if (from.type === 'city') {
      pin = makeCityPin();
      const earth = ctx.earthMesh();
      if (earth) {
        const r = ctx.bodyRadius('Earth');
        pin.position.copy(cityLatLonVec3(from.lat, from.lon).multiplyScalar(r * 1.03));
        earth.add(pin);
      }
    }

    snapshot = {
      pos: ctx.camera.position.clone(),
      quat: ctx.camera.quaternion.clone(),
      fov: ctx.camera.fov
    };

    j = {
      id: ++seq,
      from, to, preset, m, dKm, dLabel,
      interstellar, dir: dir.clone(), dest, cityDir,
      fromPos: fromPos.clone(),
      destSprite, pin,
      phase: 'brief', t: 0, warp: 1,
      lag: 0, lagOn: 0, shipS: 0, simRate: 0, done: false, frames: 0
    };
    /* phase plan (animation seconds at warp 1) */
    j.plan = {
      brief: 2.4,
      approach: 3.2,
      launch: 4.5,
      cruise: Math.max(7, Math.min(26, 8 + years * 0.3)),   // the boring bit
      arrive: 5.0
    };
    j.total = j.plan.brief + j.plan.approach + j.plan.launch + j.plan.cruise + j.plan.arrive;

    ctx.camera.far = 12000;                 /* dome (5000) + camera travel */
    ctx.camera.updateProjectionMatrix();
    ctx.onJourneyChange && ctx.onJourneyChange(true, j);
    return { ok: true, summary: q.summary };
  }

  /* --------------------------------------------------------------- phases -- */
  function phaseOf(t) {
    let a = t;
    for (const k of ['brief', 'approach', 'launch', 'cruise', 'arrive']) {
      if (a < j.plan[k]) return { k, u: a / j.plan[k] };
      a -= j.plan[k];
    }
    return { k: 'arrive', u: 1 };
  }
  function departureRadius() { return Math.max(0.9, ctx.bodyRadius('Earth') || 1); }
  function departureCamPos() {
    const out = (j.cityDir || j.fromPos.clone().normalize()).normalize();
    return j.fromPos.clone().add(out.multiplyScalar(departureRadius() * 4.2));
  }
  function shipPoint(s) { return j.fromPos.clone().lerp(j.dest, s); }
  function cruiseCam(s) {
    const p = shipPoint(s);
    return {
      pos: p.clone().addScaledVector(j.dir, -10),
      look: p.clone().addScaledVector(j.dir, 240)
    };
  }

  const CALM_RATE = 86400;   /* sim-s per real-s: 1 day/s — the departure
                                 scene ticks almost at real time */

  function update(dtReal) {
    if (!j || j.done) return;
    j.frames++;
    dtReal = Math.min(dtReal, 0.25);
    j.t += dtReal * j.warp;
    const ph = phaseOf(Math.min(j.t, j.total));
    j.phase = ph.k;

    /* --- live positions:
         brief/approach — chase the departure body (it still orbits slowly,
         the camera must keep finding it);
         launch onwards — the departure point is FROZEN (we flew off from
         where we were); an in-system destination keeps moving, so the path
         keeps re-aiming at it. */
    if (ph.k === 'brief' || ph.k === 'approach') {
      const liveF = ctx.bodyPos(j.from.type === 'city' ? 'Earth' : j.from.name);
      if (liveF) j.fromPos.copy(liveF);
    }
    if (!j.interstellar) {
      const liveD = ctx.bodyPos(toNameOf(j.to));
      if (liveD) {
        j.dest.copy(liveD);
        j.dir.copy(j.dest).sub(j.fromPos).normalize();
      }
    }

    /* --- sim clock: the journey IS the time-lapse.
         brief/approach: almost real time (1 day/s) so the departure scene
         holds still; launch ramps the warp up; cruise runs at the mission
         rate (the planets lap their orbits while you watch); arrival eases
         back down. */
    const cruiseRate = j.m.T / j.plan.cruise;            /* sim-s per real-s @ warp 1 */
    let rate;
    if (ph.k === 'brief' || ph.k === 'approach') rate = CALM_RATE;
    else if (ph.k === 'launch') rate = lerp(CALM_RATE, cruiseRate * 0.5, easeIO(ph.u));
    else if (ph.k === 'cruise') {
      const tC = j.t - (j.plan.brief + j.plan.approach + j.plan.launch);
      rate = cruiseRate * lerp(0.5, 1, Math.min(1, tC / 2.5));
    } else rate = lerp(cruiseRate, CALM_RATE, ph.u);     /* arrive: ease down */
    /* sim-s per real-s, warp included: the app advances simTimeMs by dtms·this */
    j.simRate = rate * j.warp;

    /* --- mission progress along the path. Cruise covers 98% of the
         distance; the arrival phase is the long deceleration through the
         final 2% — the destination grows while you close. */
    let s = 0;
    if (ph.k === 'cruise') {
      const tC = j.t - (j.plan.brief + j.plan.approach + j.plan.launch);
      const mNow = Math.min(j.m.T * 0.98, tC / j.plan.cruise * j.m.T * 0.98);
      s = profileDist(mNow, j.m, j.dKm) / j.dKm;
    } else if (ph.k === 'arrive') {
      s = lerp(0.98, 1, easeIO(ph.u));
    } else if (ph.k === 'launch') {
      s = easeIO(ph.u) * 0.002;
    }
    j.shipS = s;

    /* --- camera --- */
    const cam = ctx.camera;
    if (ph.k === 'brief') {
      const C = j.dest.clone().normalize().multiplyScalar(-1300).add(v3(0, 260, 0));
      cam.position.lerpVectors(snapshot.pos, C, easeIO(ph.u));
      cam.lookAt(j.dest.clone().normalize().multiplyScalar(1000));
      cam.fov = lerp(snapshot.fov, 52, ph.u);
    } else if (ph.k === 'approach') {
      /* fly in while staring at the departure body — it grows from a dot
         to a planet that fills the frame (city pin and all) */
      const C0 = j.dest.clone().normalize().multiplyScalar(-1300).add(v3(0, 260, 0));
      cam.position.lerpVectors(C0, departureCamPos(), easeIO(ph.u));
      cam.lookAt(j.fromPos);
      cam.fov = lerp(52, 46, ph.u);
    } else if (ph.k === 'launch') {
      /* pull away while the gaze swings — smoothly — from the home world
         (which fills the frame at first) to the stars ahead */
      const C0 = departureCamPos();
      const rig = cruiseCam(0.002);
      const e = easeIO(ph.u);
      cam.position.lerpVectors(C0, rig.pos, e);
      const fwd = new ctx.THREE.Vector3(0, 0, -1);
      const dHome = j.fromPos.clone().sub(cam.position).normalize();
      const dFwd = j.fromPos.clone().add(j.dir.clone().multiplyScalar(400)).sub(cam.position).normalize();
      const q0 = new ctx.THREE.Quaternion().setFromUnitVectors(fwd, dHome);
      const q1 = new ctx.THREE.Quaternion().setFromUnitVectors(fwd, dFwd);
      cam.quaternion.slerpQuaternions(q0, q1, e);
      cam.fov = lerp(46, 60, ph.u);
    } else if (ph.k === 'cruise') {
      const rig = cruiseCam(s);
      cam.position.copy(rig.pos);
      /* one over-the-shoulder glance at home in the first quarter —
         zero at both ends, so it matches the launch/arrive gaze exactly */
      const w = s < 0.25 ? Math.sin(Math.PI * s / 0.25) * 0.7 : 0;
      cam.lookAt(rig.look.clone().lerp(j.fromPos, w));
      cam.fov = 60;
      j.lagOn = 1;
    } else { /* arrive */
      const rig = cruiseCam(Math.min(1, s));
      cam.position.copy(rig.pos);
      const target = j.interstellar ? j.dest : (ctx.bodyPos(toNameOf(j.to)) || j.dest);
      cam.lookAt(target);
      cam.fov = lerp(60, 50, ph.u);
      j.lagOn = 0;
    }
    cam.updateProjectionMatrix();

    /* --- destination star sprite: grows as we close --- */
    if (j.destSprite) {
      const L = cam.position.distanceTo(j.dest);
      const sc = Math.max(1.6, Math.min(70, 34 * Math.pow(500 / L, 1.4)));
      j.destSprite.scale.setScalar(sc);
      j.destSprite.visible = j.t > j.plan.brief + j.plan.approach * 0.5;
    }
    /* --- dome drift (warp streaks) --- */
    const lagTarget = (ph.k === 'cruise') ? 1 : 0;
    j.lagOn += (lagTarget - j.lagOn) * Math.min(1, dtReal * 2);
    if (j.lagOn > 0.01) j.lag += dtReal * 120 * j.lagOn * j.warp;
    else j.lag = Math.max(0, j.lag - dtReal * 240);

    if (ph.k === 'arrive' && ph.u >= 1) { finish(); return; }
  }

  /* -------------------------------------------------------------- finish -- */
  function finish() {
    if (!j || j.done) return;
    j.done = true;
    const pin = j.pin, dest = j.destSprite;
    if (j.interstellar) {
      /* stay: keep the star sprite as an arrival marker and let the user
         orbit it (the app points the solar camera at it) — ease it from
         "wall of light" down to a proper star close-up */
      if (dest) dest.scale.setScalar(30);
      arrived = { dest: j.dest.clone(), sprite: dest, to: j.to };
    } else {
      ctx.arriveBody(toNameOf(j.to));
      if (dest && dest.parent) dest.parent.remove(dest);
    }
    ctx.onJourneyChange && ctx.onJourneyChange(false, j);
    setTimeout(() => { if (pin && pin.parent) pin.parent.remove(pin); }, 1500);
    j = null;
    /* the 12000 far plane was a journey convenience — give it back
       (unless a new journey has already taken off) */
    setTimeout(() => { if (!j) ctx.restoreCamera(6000); }, 1600);
  }
  let abortFrame = 0, holding = false;   /* abort ease-back owns the camera */
  function abort() {
    if (!j) return;
    const pin = j.pin, dest = j.destSprite, snap = snapshot;
    if (arrived && arrived.sprite !== dest) clearArrived();
    if (pin && pin.parent) pin.parent.remove(pin);
    if (dest && dest.parent) dest.parent.remove(dest);
    ctx.onJourneyChange && ctx.onJourneyChange(false, j, true);
    j = null;
    /* ease the camera home — the main loop must not fight this, so the
       journey keeps "holding" the camera until the ease completes */
    const fpos = ctx.camera.position.clone(), fquat = ctx.camera.quaternion.clone(),
          ffov = ctx.camera.fov;
    const t0 = performance.now();
    holding = true;
    (function back() {
      abortFrame++;
      const u = Math.min(1, (performance.now() - t0) / 800);
      const e = u * u * (3 - 2 * u);
      ctx.camera.position.lerpVectors(fpos, snap.pos, e);
      ctx.camera.quaternion.slerpQuaternions(fquat, snap.quat, e);
      ctx.camera.fov = lerp(ffov, snap.fov, e);
      ctx.camera.updateProjectionMatrix();
      if (u < 1) {
        requestAnimationFrame(back);
      } else {
        holding = false;
        if (!j) ctx.restoreCamera(6000);
      }
    })();
  }

  /* ------------------------------------------------------------- hud ----- */
  function missionNow() {
    /* must mirror the ship's path progress (cruise = 98%, arrival = last 2%) */
    if (!j) return 0;
    const ph = phaseOf(j.t);
    const tC = Math.max(0, j.t - (j.plan.brief + j.plan.approach + j.plan.launch));
    if (ph.k === 'cruise') return Math.min(j.m.T * 0.98, tC / j.plan.cruise * j.m.T * 0.98);
    if (ph.k === 'arrive') return lerp(j.m.T * 0.98, j.m.T, easeIO(ph.u));
    return 0;
  }
  function hud() {
    if (!j) return null;
    const ph = phaseOf(j.t);
    const mNow = missionNow();
    return {
      phase: ph.k,
      phaseLabel: { brief: 'PRE-FLIGHT', approach: 'DEPARTURE', launch: 'LAUNCH', cruise: 'CRUISE', arrive: 'ARRIVAL' }[ph.k],
      route: labelOf(j.from) + '  →  ' + labelOf(j.to),
      progress: j.shipS,
      speed: fmtSpeed(speedAt(Math.min(mNow, j.m.T), j.m)),
      elapsed: fmtYears(mNow / SEC_PER_YR),
      remain: fmtYears(Math.max(0, (j.m.T - mNow)) / SEC_PER_YR),
      note: j.preset.label + ' · ' + j.dLabel
    };
  }

  function fmtSpeed(v) {
    if (v <= 0) return '—';
    if (v < 1e4) return Math.round(v).toLocaleString() + ' km/s';
    return (v / C_KMS).toFixed(3) + ' c';
  }
  function fmtYears(y) {
    if (!isFinite(y) || y < 0) y = 0;
    if (y * SEC_PER_YR < 3600) return Math.max(1, Math.round(y * SEC_PER_YR)) + ' s';
    if (y < 1 / 365) return Math.round(y * SEC_PER_YR / 3600) + ' h';
    if (y < 1) return (y * 365.25).toFixed(1) + ' days';
    if (y < 1000) return y.toFixed(1) + ' yr';
    return Math.round(y).toLocaleString() + ' yr';
  }
  function fmtBig(x) {
    if (x < 1e4) return Math.round(x).toLocaleString();
    return x.toExponential(1).replace('e+', 'e');
  }
  function labelOf(a) {
    if (a.type === 'city') return a.name + (a.country ? ' · ' + a.country : '');
    return a.name;
  }
  function toNameOf(a) { return a.type === 'city' ? 'Earth' : a.name; }

  /* ------------------------------------------------------- scene pieces -- */
  function makeStarSprite(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const col = '#' + ('00000' + color.toString(16)).slice(-6);
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.16, col + 'f2');
    gr.addColorStop(0.45, col + '42');
    gr.addColorStop(1, col + '00');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return new ctx.THREE.Sprite(new ctx.THREE.SpriteMaterial({
      map: new ctx.THREE.CanvasTexture(c),
      transparent: true, depthWrite: false, blending: ctx.THREE.AdditiveBlending
    }));
  }
  function makeCityPin() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,214,122,0.95)';
    g.lineWidth = 4;
    g.beginPath(); g.arc(32, 32, 14, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,226,160,1)';
    g.beginPath(); g.arc(32, 32, 5, 0, TAU); g.fill();
    const spr = new ctx.THREE.Sprite(new ctx.THREE.SpriteMaterial({
      map: new ctx.THREE.CanvasTexture(c),
      transparent: true, depthWrite: false
    }));
    spr.scale.setScalar(0.7);
    return spr;
  }

  /* ------------------------------------------------------------ public --- */
  return {
    PRESETS,
    init(c) { ctx = c; },
    quote,
    launch,
    abort,
    skip() {
      if (!j || j.done) return;
      j.t = j.plan.brief + j.plan.approach + j.plan.launch + j.plan.cruise * 0.985;
    },
    setWarp(x) { if (j) j.warp = Math.max(0.2, Math.min(16, x || 1)); },
    warp() { return j ? j.warp : 1; },
    arrived() { return arrived; },
    clearArrived,
    /** sim seconds of world time per second of real time (warp included);
        0 = use the user's normal time rate (brief/approach phases) */
    simRate() { return j ? j.simRate : 0; },
    active() { return !!(j && !j.done); },
    phase() { return j ? j.phase : null; },
    progress() { return j ? (j.shipS || 0) : 0; },
    tick() { return j ? (j.frames || 0) : abortFrame; },  /* render-gate salt */
    holdsCamera() { return holding; },                     /* abort ease-back */
    hud,
    update,
    /** call after the dome is glued to the camera each frame */
    domeLag() {
      if (!j || j.lag < 0.5) return;
      ctx.dome.position.addScaledVector(j.dir, -j.lag);
    }
  };
})();
