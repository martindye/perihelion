/* PERIHELION — demo recorder driver
 *
 * Loaded only when the URL hash contains "demo":
 *   index.html#demo        → full 2-minute take (operator records the window
 *                            with ffmpeg gdigrab; see video/README.md)
 *   index.html#demo=short  → ~19 s pipeline test
 *
 * The driver drives the app exactly like a user (synthetic pointer/keyboard
 * events) and paints title cards / lower-thirds as DOM overlays, which the
 * window recording picks up. No production code is modified.
 */
(function () {
  if (location.hash.indexOf('demo') < 0) return;
  var SHORT = /demo=short/.test(location.hash);

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var $ = function (s) { return document.querySelector(s); };
  var cv = document.querySelector('#app canvas') || document.querySelector('canvas');

  /* synthetic pointer ids cannot be captured — stub it */
  cv.setPointerCapture = function () {};
  cv.releasePointerCapture = function () {};

  function ptr(type, x, y, buttons) {
    cv.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: 'mouse', isPrimary: true,
      button: 0, buttons: buttons || 0,
      clientX: x, clientY: y, bubbles: true, cancelable: true
    }));
  }

  /* camera pan: total pixel offsets applied over ms (app maps 0.0042 rad/px).
     Time-accurate via rAF: position is a function of elapsed time, not of a
     fixed event cadence — the app's demo-mode spring turns this into a
     perfectly continuous pan in the recorded video. */
  async function drag(dx, dy, ms) {
    var x0 = innerWidth / 2, y0 = innerHeight / 2;
    ptr('pointerdown', x0, y0, 1);
    var t0 = performance.now();
    await new Promise(function (res) {
      function step() {
        var t = (performance.now() - t0) / ms;
        if (t >= 1) { ptr('pointermove', x0 + dx, y0 + dy, 1); res(); return; }
        if (t > 0) ptr('pointermove', x0 + dx * t, y0 + dy * t, 1);
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
    ptr('pointerup', x0 + dx, y0 + dy, 0);
  }
  function hover(x, y) { ptr('pointermove', x, y, 0); }

  /* a quick, small drag — used for fine camera corrections */
  async function nudge(dx, dy, ms) {
    const x0 = innerWidth / 2, y0 = innerHeight / 2;
    ptr('pointerdown', x0, y0, 1);
    const N = 5;
    for (let i = 1; i <= N; i++) {
      await sleep((ms || 110) / N);
      ptr('pointermove', x0 + dx * i / N, y0 + dy * i / N, 1);
    }
    ptr('pointerup', x0 + dx, y0 + dy, 0);
  }

  function labelPos(text) {
    /* note: the app's makeLabel() bug appends .lbl to <body>, not #labels */
    const els = document.querySelectorAll('.lbl');
    for (let i = 0; i < els.length; i++) {
      if (els[i].textContent !== text) continue;
      const m = /translate\(([-\d.]+)px,\s*([-.\d]+)px\)/.exec(els[i].style.transform);
      if (m) return { x: parseFloat(m[1]) - innerWidth / 2, y: parseFloat(m[2]) - innerHeight / 2 };
    }
    return null;
  }

  /*
   * Tracking shot: hold the labelled body near frame centre for `until`
   * (timeline seconds) by nudging the camera as the body drifts.
   * GAIN = drag-px applied per screen-px of offset.
   */
  const GAIN = 0.30; /* drag-px per screen-px of offset (see nudge math in recorder notes) */
  async function trackLabel(text, until) {
    console.log('[demo] tracking "' + text + '" until t=' + until);
    const t0 = performance.now();
    let lastLog = 0;
    while (performance.now() - t0 < (until * 1000)) {
      const off = labelPos(text);
      if (off) {
        if (performance.now() - lastLog > 1500) {
          console.log('[track] ' + text + ' off=(' + off.x.toFixed(0) + ',' + off.y.toFixed(0) + ')');
          lastLog = performance.now();
        }
        if (Math.abs(off.x) > 30 || Math.abs(off.y) > 30) {
          /* direct manipulation: drag the sky TOWARD centre, past the body */
          await nudge(-GAIN * off.x, -GAIN * off.y, 190);
          await sleep(20);
        } else {
          await sleep(200);
        }
      } else {
        if (performance.now() - lastLog > 1500) {
          console.log('[track] ' + text + ' label not found (' + document.querySelectorAll('.lbl').length + ' labels on page)');
          lastLog = performance.now();
        }
        await sleep(100);
      }
    }
  }
  function pressKey(k) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  }
  /* wheel zoom: app maps deltaY*0.02 to fov (120 units = 2.4 deg) */
  function wheel(deltaY) {
    cv.dispatchEvent(new WheelEvent('wheel', {
      deltaY: deltaY, clientX: innerWidth / 2, clientY: innerHeight / 2,
      bubbles: true, cancelable: true
    }));
  }
  async function zoomIn(steps, ms) {
    for (var i = 0; i < steps; i++) { wheel(-120); await sleep(ms / steps); }
  }
  async function zoomOut(steps, ms) {
    for (var i = 0; i < steps; i++) { wheel(120); await sleep(ms / steps); }
  }
  function clickName(name) {
    var rows = document.querySelectorAll('.cat-row');
    for (var i = 0; i < rows.length; i++) {
      var b = rows[i].querySelector('b');
      if (b && b.textContent === name) { rows[i].click(); return true; }
    }
    return false;
  }
  async function typeSearch(q) {
    var inp = $('#cat-search');
    inp.focus();
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(250);
    for (var i = 0; i < q.length; i++) {
      inp.value += q[i];
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(110);
    }
  }
  async function clearSearch() {
    var inp = $('#cat-search');
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(400);
  }
  function clickPreset(speed) {
    var b = document.querySelector('.presets .btn[data-speed="' + speed + '"]');
    if (b) b.click();
  }

  /* ---------------------------------------------------- overlays ---------- */
  /* The 4K master at 150% UI zoom: the HUD lays out in a box the size of
     the window divided by 1.5 and is rendered at 1.5× (true browser-zoom
     semantics, vector-crisp text); the canvas keeps 100% FOV at native
     resolution. S scales every final-pixel value: 1.0 for the 1920×1080
     build, 2.0 for a native 3840×2160 window. Labels & tooltip live in
     canvas coordinate space, so they get font-only scaling. */
  var S = innerWidth / 1920;
  var zoom = document.createElement('style');
  zoom.textContent =
    '#ui-root{inset:0 auto auto 0 !important;width:' + (innerWidth / 1.5 | 0) + 'px !important;height:' + (innerHeight / 1.5 | 0) + 'px !important;zoom:1.5;}' +
    '.lbl{font-size:' + (16.5 * S) + 'px !important;}' +
    '#tooltip{zoom:' + (1.5 * S) + ';}';
  document.head.appendChild(zoom);

  var style = document.createElement('style');
  style.textContent =
    '#dcard{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;z-index:60;pointer-events:none;opacity:0;transition:opacity .5s;}' +
    '#dcard h1{font:700 ' + (96 * S) + 'px "Segoe UI";letter-spacing:.35em;color:#eaf2ff;margin:0;' +
    'text-shadow:0 0 ' + (34 * S) + 'px rgba(111,214,255,.55);}' +
    '#dcard p{font:400 ' + (31 * S) + 'px "Segoe UI";letter-spacing:.16em;color:#9fb4d8;margin-top:' + (24 * S) + 'px;}' +
    '#dlt{position:fixed;left:' + (69 * S) + 'px;bottom:' + (198 * S) + 'px;z-index:60;pointer-events:none;' +
    'font:600 ' + (30 * S) + 'px "Segoe UI";letter-spacing:.04em;color:#dbe7ff;' +
    'background:rgba(8,13,26,.72);border-left:' + (4.5 * S) + 'px solid #ffd27a;padding:' + (16 * S) + 'px ' + (33 * S) + 'px;' +
    'opacity:0;transition:opacity .45s;}' +
    '#dcard.on,#dlt.on{opacity:1;}';
  document.head.appendChild(style);

  var dcard = document.createElement('div'); dcard.id = 'dcard';
  var cTitle = document.createElement('h1');
  var cSub = document.createElement('p');
  dcard.appendChild(cTitle); dcard.appendChild(cSub);
  var lthird = document.createElement('div'); lthird.id = 'dlt';
  var fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#000;z-index:70;pointer-events:none;' +
    'opacity:1;transition:none;';
  document.body.appendChild(dcard);
  document.body.appendChild(lthird);
  document.body.appendChild(fade);

  var T = 0; /* timeline origin (performance.now) */
  function at(s) {
    var t0 = performance.now();
    return new Promise(function (res) {
      setTimeout(function () {
        if (performance.now() - t0 > s * 1000 + 400) console.log('[demo] WARN at(' + s + ') took ' + Math.round(performance.now() - t0) + 'ms');
        res();
      }, Math.max(0, s * 1000 - (performance.now() - T)));
    });
  }
  function card(title, sub, t0, t1) {
    setTimeout(function () {
      cTitle.textContent = title;
      cSub.textContent = sub || '';
      dcard.classList.add('on');
      setTimeout(function () { dcard.classList.remove('on'); }, (t1 - t0) * 1000);
    }, t0 * 1000);
  }
  function lowerThird(text, t0, t1) {
    setTimeout(function () {
      lthird.textContent = text;
      lthird.classList.add('on');
      setTimeout(function () { lthird.classList.remove('on'); }, (t1 - t0) * 1000);
    }, t0 * 1000);
  }
  async function dip(fn) {
    fade.style.transition = 'opacity .22s';
    fade.style.opacity = '1';
    await sleep(270);
    fn();
    await sleep(270);
    fade.style.opacity = '0';
  }
  function fire(p) { p.catch && p.catch(function () {}); }

  /* -------------------------------------------------- instrumentation ----- */
  window.addEventListener('error', function (e) {
    console.log('[pageerror] ' + e.message + ' @ ' + (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    console.log('[unhandledrejection] ' + ((e.reason && (e.reason.message || String(e.reason))) || 'unknown'));
  });
  var rafFrames = 0, rafT0 = performance.now();
  (function hb() {
    rafFrames++;
    if (performance.now() - rafT0 >= 5000) {
      console.log('[hb] rAF ' + rafFrames + ' frames/5s hidden=' + document.hidden + ' vis=' + document.visibilityState);
      rafFrames = 0; rafT0 = performance.now();
    }
    requestAnimationFrame(hb);
  })();
  function probe(tag) {
    try {
      var s = P.app.state;
      console.log('[probe:' + tag + '] cat=' + s.catalogOpen + ' sel=' + s.selected + ' speed=' + Math.round(s.speed) + ' mode=' + s.mode + ' playing=' + s.playing);
    } catch (err) { console.log('[probe:' + tag + '] error ' + err.message); }
  }
  setInterval(function () {
    console.log('[vis] hidden=' + document.hidden + ' vis=' + document.visibilityState + ' focus=' + document.hasFocus() + ' t=' + (T ? ((performance.now() - T) / 1000).toFixed(1) : '?'));
  }, 3000);

  /* ---------------------------------------------------- the take ---------- */
  async function run() {
    /* wait for the app to boot (title flips to PERIHELION READY) */
    while (document.title.indexOf('READY') < 0) await sleep(200);
    /* move the tooltip to <body>: it is positioned in canvas (1920) space,
       which the 1280×720 zoomed #ui-root box would rescale */
    var tip = document.getElementById('tooltip');
    if (tip) document.body.appendChild(tip);
    /* .lbl sky labels are created inside #ui-root (makeLabel quirk) and are
       positioned in canvas space — the zoom would 1.5× their coordinates.
       Continuously re-home any of them to <body> (1920 space, unzoomed). */
    new MutationObserver(function () {
      var bad = document.querySelectorAll('#ui-root .lbl');
      for (var i = 0; i < bad.length; i++) document.body.appendChild(bad[i]);
    }).observe(document.getElementById('ui-root'), { childList: true, subtree: true });
    document.body.style.cursor = 'none';
    document.title = 'PERIHELION DEMO';
    await sleep(SHORT ? 1500 : 3000); /* static lead-in so the recorder is rolling */
    T = performance.now();
    console.log('[demo] timeline start, short=' + SHORT + ' perf=' + Math.round(T) + ' wall=' + Date.now());

    /* black → fade in */
    fade.style.transition = 'none';
    fade.style.opacity = '1';
    await at(0.3);
    fade.style.transition = 'opacity .8s';
    fade.style.opacity = '0';

    if (/demo=planet/.test(location.hash)) {
      at(0.3).then(function () { pressKey('m'); });          /* solar mode */
      at(1.5).then(function () { pressKey('k'); });          /* catalog */
      at(2.5).then(function () { clickName('Saturn'); });    /* fly */
      at(6).then(function () { clickPreset(31557600); });    /* 1 year / s */
      at(12).then(function () {
        fade.style.transition = 'opacity .4s';
        fade.style.opacity = '1';
      });
      await at(14);
      document.title = 'PERIHELION DONE';
      return;
    }

    if (/demo=moon/.test(location.hash)) {
      at(0.5).then(function () { pressKey('k'); });
      at(1.2).then(function () { P.app.setSpeedValue(3600); });   /* 1 h/s: gentle drift, exact fly */
      at(1.6).then(function () { clickName('Moon'); });
      at(3.2).then(function () { return trackLabel('Moon', 19); });
      at(19).then(function () {
        fade.style.transition = 'opacity .4s';
        fade.style.opacity = '1';
      });
      await at(21);
      document.title = 'PERIHELION DONE';
      return;
    }

    if (/demo=galaxies/.test(location.hash)) {
      /* ---- 100 s galaxy take ------------------------------------------ */
      card('PERIHELION', 'a real-sky planetarium', 0.4, 4.5);
      fire(at(1.5).then(function () { return drag(166, 0, 12500); }));   /* slow 40° pan */
      lowerThird('116,547 real stars · 18,928 real galaxies', 5, 11);

      /* the search: "andromeda" finds M31 by its common name */
      at(14).then(function () { pressKey('k'); });
      at(15).then(function () { return typeSearch('andromeda'); });
      lowerThird('Search by name — “andromeda” finds the Andromeda Galaxy', 16.5, 22.5);
      at(19).then(function () { clickName('M31'); });
      /* close the catalog once M31 is locked — a clean stage for the hero */
      at(23).then(function () { pressKey('k'); });
      lowerThird('M31 — the Andromeda Galaxy · 2.5 million light-years away', 23.5, 29.5);

      /* hero shot: deep zoom to 8° */
      fire(at(30).then(function () { return zoomIn(20, 16000); }));
      lowerThird('Colour from its real B−V index · 4,873 K · peaks at 595 nm', 47, 53);

      /* second galaxy: the Whirlpool */
      at(54).then(function () { pressKey('k'); });   /* reopen catalog */
      at(54.5).then(async function () {
        await clearSearch();
        at(55.5).then(function () { return typeSearch('whirlpool'); });
      });
      at(57.5).then(function () { clickName('M51'); });
      lowerThird('M51 — the Whirlpool Galaxy · 23 million light-years', 60, 65.5);
      fire(at(67).then(function () { return zoomOut(12, 8000); }));

      /* the wide field: every faint smudge is a real galaxy */
      at(78).then(function () { pressKey('k'); P.app.select(null); });
      fire(at(80).then(function () { return drag(-190, 0, 12000); }));
      lowerThird('Every faint smudge is real — NGC 2000.0 + UGC 1973', 82, 89);
      card('PERIHELION', '18,928 galaxies · 116,547 stars · runs offline', 90, 99);
      at(99.5).then(function () {
        fade.style.transition = 'opacity .6s';
        fade.style.opacity = '1';
      });
      await at(101.5);
      document.title = 'PERIHELION DONE';
      return;
    }

    if (SHORT) {
      card('PERIHELION', 'a real-sky planetarium', 0.4, 3.4);
      fire(at(0.8).then(function () { return drag(120, 0, 8000); }));
      lowerThird('116,547 real stars — the complete Hipparcos catalog', 1, 5);
      at(5.5).then(function () { pressKey('k'); });
      at(6.5).then(function () { return typeSearch('sirius'); });
      at(9.5).then(function () { clickName('Sirius'); });
      at(13.5).then(function () { pressKey('k'); });
      at(16.5).then(function () {
        fade.style.transition = 'opacity .6s';
        fade.style.opacity = '1';
      });
      await at(18.5);
      console.log('[demo] short take done perf=' + Math.round(performance.now() - T) + ' wall=' + Date.now());
      document.title = 'PERIHELION DONE';
      return;
    }

    /* ---- ACT 1 — the sky (0:00–0:16) ---- */
    card('PERIHELION', 'a real-sky planetarium · 116,547 stars', 0.5, 4.5);
    fire(at(1.5).then(function () { return drag(166, 0, 12500); }));      /* 40° pan */
    lowerThird('116,547 real stars — the complete Hipparcos catalog', 6, 12);

    /* ---- ACT 2 — the catalog (0:16–0:46) ---- */
    at(16.5).then(function () { pressKey('k'); });
    lowerThird('Search 116,547 stars by name, Bayer, HIP or HD', 17.5, 23);
    at(18).then(function () { return typeSearch('sirius'); });
    at(21).then(function () { clickName('Sirius'); });
    at(24.5).then(function () {
      hover(innerWidth / 2 + 26 * S, innerHeight / 2 - 14 * S);   /* tooltip on Sirius */
    });
    at(28).then(function () { hover(150 * S, 150 * S); });
    at(28.5).then(async function () {
      await clearSearch();
      at(29.5).then(function () { return typeSearch('acamar'); });
    });
    at(33.5).then(function () { clickName('Acamar'); });
    lowerThird('Click a row — the camera flies, the reticle locks', 34.5, 40);
    at(41).then(async function () {
      await clearSearch();
      at(42.5).then(function () { clickName('Moon'); });
    });

    /* ---- ACT 3 — the Moon & time (0:46–0:56) ---- */
    at(42).then(function () { P.app.setSpeedValue(3600); });   /* 1 h/s: exact fly, gentle drift */
    fire(at(44).then(function () { return trackLabel('Moon', 10.5); })); /* 44 -> 54.5 */
    lowerThird('Live ephemeris — the reticle tracks the Moon', 47, 53.5);
    at(54.5).then(function () { pressKey('k'); });                       /* close catalog */
    at(55.5).then(function () { return dip(function () { pressKey('m'); P.app.select(null); }); });

    /* ---- ACT 4 — the solar system (0:56–1:30) ---- */
    lowerThird('Or zoom out — the full system, real orbits', 58, 63.5);
    fire(at(58).then(function () { return drag(90, 0, 6000); }));
    at(63).then(function () { pressKey('k'); });
    at(64.5).then(function () {
      return dip(function () { clickName('Saturn'); });
    });
    lowerThird('Follow any planet — real Keplerian orbits', 66.5, 72);
    fire(at(67).then(function () { return drag(-110, 0, 7000); }));
    at(75.5).then(function () {
      return dip(function () { clickName('Sun'); });
    });
    at(76.5).then(function () { pressKey('k'); });
    at(77.5).then(function () { clickPreset(31557600); });              /* 1 year / s */
    lowerThird('Time-warp up to a year per second', 79, 85);

    /* ---- ACT 5 — home (1:30–2:00) ---- */
    at(89.5).then(function () { return dip(function () { pressKey('m'); P.app.select(null); }); });
    fire(at(91).then(function () { return drag(-120, 0, 19000); }));
    lowerThird('Runs offline — no CDN, no network, one folder', 96, 102.5);
    card('PERIHELION', 'github.com/martindye/perihelion', 104, 116.5);
    at(117.3).then(function () {
      fade.style.transition = 'opacity .6s';
      fade.style.opacity = '1';
    });
    await at(120.5);
    console.log('[demo] timeline done perf=' + Math.round(performance.now() - T) + ' wall=' + Date.now());
    document.title = 'PERIHELION DONE';
  }

  run().catch(function (e) {
    document.title = 'PERIHELION DEMO ERROR: ' + (e && e.message);
  });
})();
