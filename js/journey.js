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
  let _fwd = null;   // lazy unit +Z (ship nose axis)
  let _side = null;  // lazy right vector (convoy formation axis)
  let snapshot = null;
  let startSnapshot = null; /* the pose before the whole scenario (abort home) */
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
    if (addr.type === 'waypoint') {
      /* a fixed point in the scene (scenario legs meet in deep space) */
      return v3(addr.x || 0, addr.y || 0, addr.z || 0);
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
  function quote(from, to, presetKey, opts) {
    opts = opts || {};
    const preset = PRESETS[presetKey] || PRESETS.hmary;
    const fromPos = addrPos(from);
    const toPos0 = addrPos(to);
    if (!fromPos || !toPos0) return { ok: false, error: 'could not locate that address' };

    const interstellar = to.type === 'star';
    const dest = toPos0.clone();
    let dKm, dLabel;
    if (opts.ly != null) {
      /* story distance (light-years) — for legs that cross the scene in a
         straight line but cover "real" light-years in the tale */
      dKm = opts.ly * 9.4607e12;
      dLabel = opts.ly.toFixed(1) + ' light-years';
    } else if (interstellar) {
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
  /* A scenario is DATA (see js/scenarios.js — loadable/saveable JSON): a
     named list of legs, each leg a normal journey (from/to/preset) plus a
     label, a story distance (ly) and the ships that fly it. Legs chain:
     leg n+1 departs where leg n arrived, and the camera "cuts" to each new
     scene the way a film would. */
  function validateScenario(sc) {
    if (!sc || !Array.isArray(sc.legs) || !sc.legs.length) return 'scenario has no legs';
    for (let i = 0; i < sc.legs.length; i++) {
      const L = sc.legs[i];
      if (!L || !L.from || !L.to || !L.preset || !PRESETS[L.preset])
        return 'leg ' + (i + 1) + ' needs from, to and a valid preset';
      if (i > 0 && (L.from.name || '') !== (sc.legs[i - 1].to.name || ''))
        return 'leg ' + (i + 1) + ' does not continue where leg ' + i + ' ends';
    }
    return null;
  }
  function launchScenario(sc) {
    if (j) return { ok: false, error: 'a journey is already in flight' };
    const err = validateScenario(sc);
    if (err) return { ok: false, error: err };
    return beginScenario(sc, 0);
  }
  function launch(from, to, presetKey) {
    if (j) return { ok: false, error: 'a journey is already in flight' };
    return beginScenario(null, 0, from, to, presetKey);
  }
  function beginScenario(sc, idx, from, to, presetKey) {
    /* the legs carry their own from/to; a bare journey passes them in */
    if (!from) {
      const leg = sc.legs[idx];
      from = leg.from; to = leg.to; presetKey = leg.preset;
    }
    clearArrived();                    /* a new voyage replaces the old view */
    const leg = sc ? sc.legs[idx] : null;
    const q = quote(from, to, presetKey, leg ? { ly: leg.ly } : undefined);
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

    /* the ship lifts off from the surface, not from the path's anchor —
       offset the whole flight so s=0 sits just above the departure point.
       Deep-space legs (waypoints/stars) depart in place: no pad. */
    let padOffset;
    if (from.type === 'city') {
      padOffset = cityDir.clone()
        .multiplyScalar(Math.max(0.9, ctx.bodyRadius('Earth') || 1) * 1.5);
    } else if (from.type === 'body') {
      padOffset = dir.clone()
        .multiplyScalar((ctx.bodyRadius(from.name) || 1) * 1.4 + 0.6);
    } else {
      padOffset = v3(0, 0, 0);
    }

    snapshot = {
      pos: ctx.camera.position.clone(),
      quat: ctx.camera.quaternion.clone(),
      fov: ctx.camera.fov
    };
    startSnapshot = {
      pos: snapshot.pos.clone(), quat: snapshot.quat.clone(), fov: snapshot.fov
    };

    j = {
      id: ++seq,
      from, to, preset, m, dKm, dLabel,
      interstellar, dir: dir.clone(), dest, cityDir,
      fromPos: fromPos.clone(),
      destSprite, pin,
      padOffset, shipPos: new ctx.THREE.Vector3(), shipRoll: 0,
      phase: 'brief', t: 0, warp: 1,
      lag: 0, lagOn: 0, shipS: 0, simRate: 0, done: false, frames: 0,
      scenario: sc || null, legIdx: idx,
      leg: sc ? sc.legs[idx] : null,
      shipModels: {}, ships: [],
      /* filled in lazily as the flight unfolds */
      diagFrom: null, diagPos: null, diagQuat: null, diagM: null,
      arriveFrom: null, arriveP1: null, arriveP2: null
    };
    setupShips(leg || { ships: [presetKey] });
    j.scenery = makeScenery(fromPos.clone(), dest.clone(), j.ships);
    /* phase plan (animation seconds at warp 1) */
    j.plan = planFor(years);
    j.total = j.plan.brief + j.plan.approach + j.plan.launch + j.plan.cruise + j.plan.arrive;

    ctx.camera.far = 12000;                 /* dome (5000) + camera travel */
    ctx.camera.updateProjectionMatrix();
    ctx.onJourneyChange && ctx.onJourneyChange(true, j);
    return { ok: true, summary: q.summary };
  }

  /* --------------------------------------------------------------- phases -- */
  function planFor(years) {
    return {
      brief: 2.4,
      approach: 3.2,
      launch: 4.5,
      cruise: Math.max(7, Math.min(26, 8 + years * 0.3)),   // the boring bit
      arrive: 5.0
    };
  }
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

    /* --- sim clock: the journey IS the time-lapse (v2).
         brief/approach/launch: almost real time (1 day/s) — the departure
         scene holds still and the planets barely creep; the warp kicks in
         with the cruise (we have left the solar system by then), when the
         planets lap their orbits while the ship crosses the diagram;
         arrival hands the clock back to the user's own time. */
    const cruiseRate = 0.98 * j.m.T / j.plan.cruise;            /* sim-s per real-s @ warp 1 (constant) */
    let rate;
    if (ph.k === 'brief' || ph.k === 'approach' || ph.k === 'launch') rate = CALM_RATE;
    else if (ph.k === 'cruise') rate = cruiseRate;
    else {                                               /* arrive: user's time */
      const userRate = ctx.userRate ? ctx.userRate() : CALM_RATE;
      rate = lerp(cruiseRate, userRate, Math.min(1, ph.u / 0.3));
    }
    /* sim-s per real-s, warp included: the app advances simTimeMs by dtms·this */
    j.simRate = rate * j.warp;

    /* --- mission progress along the path. Cruise covers 98% of the
         distance; at arrival the ship is left parked at the destination
         while the camera makes the final approach on its own. */
    let s = 0;
    if (ph.k === 'cruise') {
      const tC = j.t - (j.plan.brief + j.plan.approach + j.plan.launch);
      const mNow = Math.min(j.m.T * 0.98, tC / j.plan.cruise * j.m.T * 0.98);
      s = profileDist(mNow, j.m, j.dKm) / j.dKm;
    } else if (ph.k === 'arrive') {
      s = 0.98;                                          /* ship stays put */
    } else if (ph.k === 'launch') {
      s = easeIO(ph.u) * 0.002;
    }
    j.shipS = s;
    /* the ship flies the pad-offset path (it lifts off the surface, not the
       path's anchor at the departure body's centre) — computed before the
       camera block because the launch hero pose is posed on it */
    j.shipPos.copy(shipPoint(s)).add(j.padOffset);

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
      /* three beats: (1) push in from the departure overview to a 3/4 rear
         hero view of the ship on its pad (Earth behind it), (2) hold the
         beauty shot while the engines light, (3) swing around the route and
         off toward the cruise pull-back. */
      const C0 = departureCamPos();
      const rig = cruiseCam(0.002);
      /* hero pose: behind and above the ship, looking along its spine */
      const side = new ctx.THREE.Vector3().crossVectors(j.dir, v3(0, 1, 0));
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0); else side.normalize();
      const upv = new ctx.THREE.Vector3().crossVectors(side, j.dir).normalize();
      const heroPos = j.shipPos.clone()
        .addScaledVector(j.dir, -4.8)
        .addScaledVector(side, 2.0)
        .addScaledVector(upv, 1.5);
      const heroLook = j.shipPos.clone().addScaledVector(j.dir, 0.4);
      const fwd = new ctx.THREE.Vector3(0, 0, -1);
      const qHome = new ctx.THREE.Quaternion().setFromUnitVectors(
        fwd, j.fromPos.clone().sub(C0).normalize());
      const qHero = new ctx.THREE.Quaternion().setFromUnitVectors(
        fwd, heroLook.clone().sub(heroPos).normalize());
      const qFwd = new ctx.THREE.Quaternion().setFromUnitVectors(
        fwd, j.fromPos.clone().addScaledVector(j.dir, 400).sub(heroPos).normalize());
      const e1 = easeIO(Math.min(1, ph.u / 0.25));
      const e3 = easeIO(Math.min(1, (ph.u - 0.5) / 0.5));
      if (ph.u < 0.25) {
        cam.position.lerpVectors(C0, heroPos, e1);
        cam.quaternion.slerpQuaternions(qHome, qHero, e1);
      } else if (ph.u < 0.5) {
        cam.position.copy(heroPos);
        cam.quaternion.copy(qHero);
      } else {
        cam.position.lerpVectors(heroPos, rig.pos, e3);
        cam.quaternion.slerpQuaternions(qHero, qFwd, e3);
      }
      cam.fov = lerp(46, 60, ph.u);
    } else if (ph.k === 'cruise') {
      /* diagrammatic cruise: pull back until the WHOLE route fits in
         frame — home system, the line to the destination, the ship
         crossing it — then hold while the mission clock laps the
         planets. The pull-back takes the first 2.5 s of the phase. */
      if (!j.diagPos) {
        const A = j.fromPos, B = j.dest;
        const L = A.distanceTo(B);
        const U = B.clone().sub(A).normalize();
        const side = new ctx.THREE.Vector3().crossVectors(U, v3(0, 1, 0));
        if (side.lengthSq() < 1e-8) side.set(1, 0, 0); else side.normalize();
        const viewDir = U.clone().multiplyScalar(-0.8)
          .addScaledVector(side, 0.55).add(v3(0, 0.28, 0)).normalize();
        const D = Math.max(80, 0.75 * L / Math.tan(27.5 * Math.PI / 180) * 0.85);
        j.diagM = A.clone().lerp(B, 0.5);
        j.diagPos = j.diagM.clone().addScaledVector(viewDir, D);
        j.diagFrom = { pos: cam.position.clone(), quat: cam.quaternion.clone() };
        /* the diagram wants to stay clean — no label jumble at home */
        ctx.hideLabels && ctx.hideLabels(true);
        const m4 = new ctx.THREE.Matrix4().lookAt(j.diagPos, j.diagM, v3(0, 1, 0));
        j.diagQuat = new ctx.THREE.Quaternion().setFromRotationMatrix(m4);
      }
      {
        const tC = j.t - (j.plan.brief + j.plan.approach + j.plan.launch);
        const e = easeIO(Math.min(1, tC / 2.5));
        cam.position.lerpVectors(j.diagFrom.pos, j.diagPos, e);
        cam.quaternion.slerpQuaternions(j.diagFrom.quat, j.diagQuat, e);
        cam.fov = lerp(60, 55, Math.min(1, tC / 2.5));
      }
      j.lagOn = 1;
    } else { /* arrive: leave the ship behind — a fast, real-time fly-in */
      const B = j.interstellar ? j.dest : (ctx.bodyPos(toNameOf(j.to)) || j.dest);
      if (!j.arriveFrom) {
        j.arriveFrom = cam.position.clone();
        ctx.hideLabels && ctx.hideLabels(false);   /* labels come back for the arrival */
      }
      const L = j.fromPos.distanceTo(B);
      const U = B.clone().sub(j.fromPos).normalize();
      const side = new ctx.THREE.Vector3().crossVectors(U, v3(0, 1, 0));
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0); else side.normalize();
      const r = j.interstellar
        ? 35
        : Math.max(40, Math.min(300, (ctx.bodyRadius(toNameOf(j.to)) || 1) * 12));
      const P1 = B.clone().addScaledVector(U, 0.15 * L).add(v3(0, 0.1 * L, 0));
      const P2 = B.clone().addScaledVector(side, 0.5 * r).add(v3(0, 0.35 * r, 0));
      const e = easeIO(ph.u);
      const i1 = 1 - e;
      cam.position.set(
        i1 * i1 * j.arriveFrom.x + 2 * i1 * e * P1.x + e * e * P2.x,
        i1 * i1 * j.arriveFrom.y + 2 * i1 * e * P1.y + e * e * P2.y,
        i1 * i1 * j.arriveFrom.z + 2 * i1 * e * P1.z + e * e * P2.z
      );
      /* gaze: keep blending from the route centre to the destination */
      cam.lookAt(j.diagM.clone().lerp(B, Math.min(1, ph.u / 0.2)));
      cam.fov = lerp(55, 50, e);
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
    /* --- route scenery: the diagram line, the travelled trail, the ship --- */
    if (j.scenery) {
      const sc = j.scenery;
      sc.a.copy(j.fromPos);
      sc.b.copy(j.dest);
      const pa = sc.dim.geometry.attributes.position;
      pa.setXYZ(0, sc.a.x, sc.a.y, sc.a.z);
      pa.setXYZ(1, sc.b.x, sc.b.y, sc.b.z);
      pa.needsUpdate = true;
      const pt = sc.trail.geometry.attributes.position;
      pt.setXYZ(0, sc.a.x, sc.a.y, sc.a.z);
      pt.setXYZ(1, j.shipPos.x, j.shipPos.y, j.shipPos.z);
      pt.needsUpdate = true;
      const inFlight = (ph.k === 'launch' || ph.k === 'cruise' || ph.k === 'arrive');
      sc.dim.visible = sc.trail.visible = inFlight;
      sc.trail.material.opacity = (ph.k === 'arrive')
        ? 0.85 * (1 - 0.5 * easeIO(ph.u)) : 0.85;

      /* --- the convoy: a constant slice of the view, engines lit.
             ship[0] leads on the route line; wingmen hold formation a
             body-width off the line (offset scales with the ships). */
      if (j.ships && j.ships.length) {
      const cam = ctx.camera;
      const tC = j.t - (j.plan.brief + j.plan.approach + j.plan.launch);
      let frac = ph.k === 'launch' ? 0.30
        : ph.k === 'cruise'
          ? lerp(0.30, 0.035, easeIO(Math.min(1, tC / 2.5)))
          : lerp(0.035, 0.05, Math.min(1, ph.u / 0.25));
      if (j.ships.length > 1) frac *= 0.7;              /* room for the convoy */
      const dist = cam.position.distanceTo(j.shipPos);
      const frameH = 2 * dist * Math.tan((cam.fov * Math.PI) / 360);
      const sMain = Math.max(1e-4, frameH * frac / j.ships[0].unitLen);
      /* plumes: stern drive while driving, nose brakes when arriving */
      let sternK, noseK;
      if (ph.k === 'launch') { sternK = easeIO(Math.min(1, ph.u / 0.4)); noseK = 0; }
      else if (ph.k === 'cruise') { sternK = 1; noseK = 0; }
      else {
        const k = Math.min(1, ph.u / 0.3);
        sternK = 1 - k;
        noseK = k * (1 - 0.75 * Math.min(1, ph.u));
      }
      const flick = 0.85 + 0.15 * Math.sin(j.frames * 0.9);
      for (const k in j.shipModels) {                   /* ships out of this leg */
        const m = j.shipModels[k];
        if (j.ships.indexOf(m) === -1) m.model.group.visible = false;
      }
      if (inFlight) j.shipRoll += dtReal * 0.25;        /* slow cinematic roll */
      if (!_fwd) _fwd = new ctx.THREE.Vector3(0, 0, 1);
      if (!_side) _side = new ctx.THREE.Vector3();
      _side.crossVectors(j.dir, v3(0, 1, 0));
      if (_side.lengthSq() < 1e-8) _side.set(1, 0, 0); else _side.normalize();
      for (const m of j.ships) {
        const g = m.model.group;
        g.visible = inFlight;
        if (!inFlight) continue;
        g.position.copy(j.shipPos);
        if (m.offUnits > 0) g.position.addScaledVector(_side, m.offUnits * sMain);
        g.quaternion.setFromUnitVectors(_fwd, j.dir);
        g.rotateZ(j.shipRoll);
        g.scale.setScalar(sMain);
        m.model.sternPlume.visible = sternK > 0.004;
        m.model.sternPlume.scale.setScalar(Math.max(1e-4, sternK * flick));
        m.model.nosePlume.visible = noseK > 0.004;
        m.model.nosePlume.scale.setScalar(Math.max(1e-4, noseK * flick));
      }
      }
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
    /* scenario legs chain: this leg's "arrival" is the next leg's departure */
    if (j.scenario && j.legIdx < j.scenario.legs.length - 1) {
      startNextLeg();
      return;
    }
    const pin = j.pin, dest = j.destSprite;
    if (j.interstellar) {
      /* stay: keep the star sprite as an arrival marker and let the user
         orbit it (the app points the solar camera at it) — ease it from
         "wall of light" down to a proper star close-up */
      if (dest) dest.scale.setScalar(30);
      arrived = { dest: j.dest.clone(), sprite: dest, to: j.to };
    } else if (j.to && (j.to.type === 'body' || j.to.type === 'city')) {
      /* keepPose: the fly-in already ended in a good framing of the body —
         adopt it instead of jumping to the default close-up */
      ctx.arriveBody(toNameOf(j.to), true);
      if (dest && dest.parent) dest.parent.remove(dest);
    } else if (dest && dest.parent) {
      dest.parent.remove(dest);
    }
    removeScenery(j.scenery);
    disposeShips();
    ctx.hideLabels && ctx.hideLabels(false);
    ctx.onJourneyChange && ctx.onJourneyChange(false, j);
    setTimeout(() => { if (pin && pin.parent) pin.parent.remove(pin); }, 1500);
    j = null;
    startSnapshot = null;
    /* the 12000 far plane was a journey convenience — give it back
       (unless a new journey has already taken off) */
    setTimeout(() => { if (!j) ctx.restoreCamera(6000); }, 1600);
  }
  /* the next leg of a scenario: the ship (and its crew) stays on, the camera
     "cuts" — the new scene grows out of exactly where we just arrived */
  function startNextLeg() {
    const sc = j.scenario;
    j.legIdx++;
    const leg = sc.legs[j.legIdx];
    if (j.destSprite && j.destSprite.parent) j.destSprite.parent.remove(j.destSprite);
    removeScenery(j.scenery);
    const q = quote(leg.from, leg.to, leg.preset, { ly: leg.ly });
    if (!q.ok) { teardownJourney(); return; }
    const { preset, fromPos, dest, interstellar, m, dKm, dLabel, years } = q;
    const dir = dest.clone().sub(fromPos).normalize();
    let destSprite = null;
    if (interstellar) {
      destSprite = makeStarSprite(leg.to.bv != null ? ctx.bvColor(leg.to.bv) : 0xffe0b0);
      destSprite.position.copy(dest);
      destSprite.visible = false;
      ctx.scene.add(destSprite);
    }
    let padOffset = v3(0, 0, 0);
    if (leg.from.type === 'city') {
      padOffset = cityLatLonVec3(leg.from.lat, leg.from.lon)
        .multiplyScalar(Math.max(0.9, ctx.bodyRadius('Earth') || 1) * 1.5);
    } else if (leg.from.type === 'body') {
      padOffset = dir.clone()
        .multiplyScalar((ctx.bodyRadius(leg.from.name) || 1) * 1.4 + 0.6);
    }
    /* the "cut": the overview grows out of the current camera pose */
    snapshot = {
      pos: ctx.camera.position.clone(),
      quat: ctx.camera.quaternion.clone(),
      fov: ctx.camera.fov
    };
    ctx.hideLabels && ctx.hideLabels(true);
    j.from = leg.from; j.to = leg.to; j.preset = preset;
    j.m = m; j.dKm = dKm; j.dLabel = dLabel;
    j.interstellar = interstellar; j.dir = dir;
    j.dest = dest; j.fromPos = fromPos;
    j.destSprite = destSprite; j.pin = null;
    j.padOffset = padOffset;
    j.leg = leg;
    j.t = 0; j.phase = 'brief'; j.shipS = 0; j.frames = 0;
    j.lag = 0; j.lagOn = 0;
    j.diagFrom = null; j.diagPos = null; j.diagQuat = null; j.diagM = null;
    j.arriveFrom = null;
    j.plan = planFor(years);
    j.total = j.plan.brief + j.plan.approach + j.plan.launch + j.plan.cruise + j.plan.arrive;
    setupShips(leg);
    j.scenery = makeScenery(fromPos.clone(), dest.clone(), j.ships);
    j.done = false;
  }
  /* mid-scenario failure: end the whole thing, no arrival card */
  function teardownJourney() {
    if (!j) return;
    const dest = j.destSprite;
    if (dest && dest.parent) dest.parent.remove(dest);
    removeScenery(j.scenery);
    disposeShips();
    ctx.hideLabels && ctx.hideLabels(false);
    ctx.onJourneyChange && ctx.onJourneyChange(false, j, true);
    j = null;
    setTimeout(() => { if (!j) ctx.restoreCamera(6000); }, 1600);
  }
  function disposeShips() {
    if (!j) return;
    for (const k in j.shipModels) {
      const m = j.shipModels[k];
      if (m.model.group.parent) m.model.group.parent.remove(m.model.group);
      disposeGroup(m.model.group);
    }
    j.shipModels = {};
    j.ships = [];
  }
  let abortFrame = 0, holding = false;   /* abort ease-back owns the camera */
  function abort() {
    if (!j) return;
    const pin = j.pin, dest = j.destSprite;
    /* scenarios abort to the pose of the WHOLE voyage, not the last leg */
    const snap = startSnapshot || snapshot;
    if (arrived && arrived.sprite !== dest) clearArrived();
    if (pin && pin.parent) pin.parent.remove(pin);
    if (dest && dest.parent) dest.parent.remove(dest);
    removeScenery(j.scenery);
    disposeShips();
    ctx.hideLabels && ctx.hideLabels(false);
    ctx.onJourneyChange && ctx.onJourneyChange(false, j, true);
    j = null;
    startSnapshot = null;
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
      /* scenario legs: the film's caption for this scene */
      leg: j.leg ? {
        label: j.leg.label || '',
        idx: j.legIdx + 1,
        total: (j.scenario && j.scenario.legs.length) || 1
      } : null,
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
  /* route scenery for the diagrammatic cruise: dim full route, bright
     travelled trail. The ships themselves belong to the journey (they
     survive leg-to-leg in a scenario), not to the scenery. */
  function makeScenery(a, b, ships) {
    const mkLine = (color, opacity) => {
      const g = new ctx.THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
      const ln = new ctx.THREE.Line(g, new ctx.THREE.LineBasicMaterial({
        color, transparent: true, opacity,
        blending: ctx.THREE.AdditiveBlending, depthWrite: false
      }));
      ln.visible = false;
      ctx.scene.add(ln);
      return ln;
    };
    const dim = mkLine(0x6f8fc8, 0.30);
    const trail = mkLine(0xcfe0ff, 0.85);
    return { dim, trail, ships, a: a.clone(), b: b.clone() };
  }
  function disposeGroup(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
  }
  function removeScenery(sc) {
    if (!sc) return;
    for (const o of [sc.dim, sc.trail]) {
      if (o.parent) o.parent.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    }
    /* ships are the journey's, not the scenery's — they survive leg cuts */
  }
  /* -------------------------------------------------------------- ships --
     Procedural hulls, built in a per-ship unit frame (nose +Z, stern -Z):
     4 units for the crewed ships, 12 for the Blip-A (it is 3× the Hail
     Mary in the film). Each frame the group is rescaled to a constant
     slice of the view height, so a ship reads as a ship at every range:
     a hero close-up at ignition, lit models gliding along the route line
     in cruise. The first ship of a leg flies the route; later ships hold
     formation off the line (setupShips). */
  function setupShips(leg) {
    const keys = (leg && Array.isArray(leg.ships) && leg.ships.length)
      ? leg.ships : ['hmary'];
    const ships = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      let m = j.shipModels[key];
      if (!m) {
        const built = makeShip(key);
        m = { key: key, model: built, unitLen: built.unitLen, offUnits: 0 };
        j.shipModels[key] = m;
      }
      m.offUnits = i === 0 ? 0
        : ships[0].unitLen / 2 + m.unitLen / 2 + 1.0;   /* bow-to-stern gap */
      ships.push(m);
    }
    j.ships = ships;
  }
  function makeShip(presetKey) {
    const T = ctx.THREE;
    const g = new T.Group();
    g.userData.jship = presetKey;
    const R = Math.PI / 2;
    const mat = (color, glow) => new T.MeshLambertMaterial({
      color, emissive: color, emissiveIntensity: glow == null ? 0.28 : glow
    });
    const add = (mesh, x, y, z, rx) => {
      mesh.position.set(x || 0, y || 0, z || 0);
      if (rx) mesh.rotation.x = rx;
      g.add(mesh);
      return mesh;
    };
    const cyl = (rt, rb, h, seg, m) => new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 10), m);
    const box = (w, h, d, m) => new T.Mesh(new T.BoxGeometry(w, h, d), m);
    const sph = (r, m, ws, hs) => new T.Mesh(new T.SphereGeometry(r, ws || 14, hs || 10), m);

    if (presetKey === 'hmary') {
      /* The Hail Mary (movie): three parallel white fuel modules converging
         into a dark nose hub, a silver service bus between them, one big
         diagonal solar array, and four beetle probes at the tip. */
      const white = mat(0xe8eaee, 0.30);
      const silver = mat(0xb6bcc6, 0.26);
      const dark = mat(0x49515b, 0.14);
      const gold = mat(0xd8a92e, 0.55);
      add(cyl(0.30, 0.30, 2.6, 14, white), 0, 0.42, -0.42, R);    /* upper module */
      add(sph(0.30, white, 14, 10), 0, 0.42, -1.72);              /* round cap */
      add(cyl(0.22, 0.22, 2.7, 14, silver), 0, 0, -0.435, R);     /* service bus */
      const band1 = new T.Mesh(new T.TorusGeometry(0.235, 0.028, 6, 20), gold);
      add(band1, 0, 0, -0.42);                                    /* gold bands */
      add(new T.Mesh(band1.geometry, gold), 0, 0, -0.10);
      add(cyl(0.30, 0.30, 2.6, 14, white), 0, -0.42, -0.42, R);   /* lower module */
      add(cyl(0.30, 0.30, 0.06, 14, dark), 0, -0.42, -1.75, R);   /* flat cap */
      add(cyl(0.06, 0.62, 1.05, 16, dark), 0, 0, 1.425, R);       /* nose hub */
      const hub1 = new T.Mesh(new T.TorusGeometry(0.60, 0.035, 6, 24), silver);
      add(hub1, 0, 0, 0.95);                                      /* coupling rings */
      add(new T.Mesh(hub1.geometry, silver), 0, 0, 0.78);
      for (let i = 0; i < 4; i++) {                               /* beetle probes */
        const a = Math.PI / 4 + i * Math.PI / 2;
        add(sph(0.06, silver, 8, 6), Math.cos(a) * 0.16, Math.sin(a) * 0.16, 1.88);
      }
      const panel = new T.Group();                                /* solar array */
      const frameM = mat(0x8f98a3, 0.18);
      const cellsM = mat(0x131b26, 0.10);
      panel.add(new T.Mesh(new T.BoxGeometry(1.62, 0.05, 0.98), frameM));
      const cells = new T.Mesh(new T.BoxGeometry(1.52, 0.06, 0.88), cellsM);
      cells.position.z = 0.02;
      panel.add(cells);
      panel.position.set(0, 0.58, 0.30);
      panel.rotation.x = 0.55;
      g.add(panel);
    } else if (presetKey === 'blipa') {
      /* Blip-A — the Eridian ship: a slender lattice of parallel xenonite
         strands, ring loops and diagonal bracing, blunt at both ends,
         three times the Hail Mary's length. Built in a 12-unit frame. */
      const strand = mat(0x6e5c40, 0.12);
      const core = mat(0x55483a, 0.10);
      const ringM = mat(0x7d6b4d, 0.20);
      add(cyl(0.20, 0.20, 11.5, 10, core), 0, 0, 0, R);           /* core strand */
      for (let i = 0; i < 6; i++) {                               /* outer strands */
        const a = i * Math.PI / 3;
        const c = new T.Mesh(new T.CylinderGeometry(0.10, 0.10, 11.6, 8), strand);
        c.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0);
        c.rotation.x = R;
        g.add(c);
      }
      const ringGeo = new T.TorusGeometry(0.72, 0.05, 6, 22);     /* ring loops */
      for (const z of [-4.6, -1.5, 0, 1.5, 4.6]) add(new T.Mesh(ringGeo, ringM), 0, 0, z);
      const yv = new T.Vector3(0, 1, 0);                          /* bracing */
      const braceGeo = new T.CylinderGeometry(0.02, 0.02, 0.75, 5);
      for (let i = 0; i < 6; i++) {
        const a0 = i * Math.PI / 3, a1 = (i + 1) * Math.PI / 3;
        const p0 = new T.Vector3(Math.cos(a0) * 0.55, Math.sin(a0) * 0.55, 0);
        const p1 = new T.Vector3(Math.cos(a1) * 0.55, Math.sin(a1) * 0.55, 0);
        for (const zc of [-3.4, 3.4]) {
          const b = new T.Mesh(braceGeo, strand);
          b.position.copy(p0).lerp(p1, 0.5);
          b.position.z = zc;
          b.quaternion.setFromUnitVectors(yv, p1.clone().sub(p0).normalize());
          g.add(b);
        }
      }
      add(cyl(0.75, 0.75, 0.12, 16, core), 0, 0, 5.85, R);        /* blunt ends */
      add(cyl(0.75, 0.75, 0.12, 16, core), 0, 0, -5.85, R);
    } else if (presetKey === 'apollo') {
      /* Apollo-class — a capsule on a chemical stack, four fins. */
      const white = mat(0xe8e6df, 0.30);
      const gray = mat(0x9aa0a8, 0.22);
      const dark = mat(0x6d7480, 0.18);
      add(cyl(0, 0.18, 0.45, 10, white), 0, 0, 1.9, R);
      add(cyl(0.24, 0.26, 0.7, 10, white), 0, 0, 1.35, R);
      add(cyl(0.30, 0.30, 1.3, 10, gray), 0, 0, 0.15, R);
      add(cyl(0.34, 0.28, 0.6, 10, dark), 0, 0, -1.1, R);
      for (let i = 0; i < 4; i++) {                              // fins
        const a = i * Math.PI / 2 + Math.PI / 4;
        const fin = box(0.03, 0.55, 0.5, dark);
        fin.position.set(Math.cos(a) * 0.34, Math.sin(a) * 0.34, -1.0);
        fin.rotation.z = a;
        g.add(fin);
      }
    } else if (presetKey === 'photon') {
      /* Light chaser — a needle on a photon drive. */
      const hull = mat(0x2a3140, 0.22);
      const bright = mat(0x9fd8ff, 0.9);
      add(cyl(0.03, 0.16, 3.2, 8, hull), 0, 0, 0.1, R);
      add(sph(0.06, bright, 8, 6), 0, 0, 1.72);
      const b1 = new T.Mesh(new T.TorusGeometry(0.14, 0.025, 6, 16), bright);
      add(b1, 0, 0, 0.9);
      add(new T.Mesh(b1.geometry, bright), 0, 0, 0.3);
    } else {
      /* Fusion drive — a silver spindle with a glowing reactor ring. */
      const silver = mat(0xc9ced8, 0.30);
      const core = mat(0x35e0ff, 1.0);
      const dark = mat(0x2a3140, 0.16);
      add(cyl(0, 0.42, 1.1, 12, silver), 0, 0, 1.0, R);
      add(cyl(0.42, 0, 1.5, 12, silver), 0, 0, -0.85, R);
      add(new T.Mesh(new T.TorusGeometry(0.48, 0.06, 8, 28), core), 0, 0, 0.1);
      add(sph(0.2, core, 12, 8), 0, 0, 0.1);
      add(cyl(0.30, 0.40, 0.5, 10, dark), 0, 0, -1.5, R);
    }

    /* plumes — stern drive (cruise) and nose brakes (arrival) */
    const plumeCol = { hmary: 0x8fc8ff, apollo: 0xffc06a, photon: 0xbfe8ff, fusion: 0x35e0ff, blipa: 0x9fd8ff }[presetKey] || 0x7fd0ff;
    const plumeSize = { hmary: 1.3, apollo: 0.85, photon: 2.3, fusion: 1.2, blipa: 1.8 }[presetKey] || 1.2;
    const mkPlume = nose => {
      const p = new T.Group();
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g2 = c.getContext('2d');
      const col = '#' + ('00000' + plumeCol.toString(16)).slice(-6);
      const gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, col + 'cc');
      gr.addColorStop(1, col + '00');
      g2.fillStyle = gr;
      g2.fillRect(0, 0, 128, 128);
      const spr = new T.Sprite(new T.SpriteMaterial({
        map: new T.CanvasTexture(c), transparent: true, depthWrite: false,
        blending: T.AdditiveBlending
      }));
      spr.scale.setScalar(plumeSize);
      spr.position.z = nose ? 0.4 : -0.4;
      p.add(spr);
      const hh = 0.75 * plumeSize;
      const cone = new T.Mesh(
        new T.ConeGeometry(0.34 * plumeSize, 2 * hh, 10, 1, true),
        new T.MeshBasicMaterial({
          color: plumeCol, transparent: true, opacity: 0.38,
          blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
        })
      );
      cone.rotation.x = nose ? -R : R;        // flare away from the hull
      cone.position.z = nose ? hh : -hh;
      p.add(cone);
      p.visible = false;
      return p;
    };
    const unitLen = presetKey === 'blipa' ? 12 : 4;
    const half = unitLen / 2 - 0.2;
    const sternPlume = mkPlume(false);
    sternPlume.position.z = -half;
    const nosePlume = mkPlume(true);
    nosePlume.position.z = half;
    g.add(sternPlume, nosePlume);
    g.visible = false;
    ctx.scene.add(g);
    return { group: g, sternPlume, nosePlume, unitLen };
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
    launchScenario,
    validateScenario,
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
