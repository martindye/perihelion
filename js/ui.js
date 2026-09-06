/* ============================================================================
 * PERIHELION — UI
 * HUD (top bar, time controls, mode/toggle stack), info panel, help overlay,
 * and the HTML label layer used to caption stars & planets.
 * ==========================================================================*/
'use strict';
P.ui = (function () {
  const root = document.getElementById('ui-root');
  const labelLayer = document.getElementById('labels');
  const $ = sel => document.querySelector(sel);

  /* created in buildUI(), exposed lazily so this module can load before them */
  let catalogUI = null;
  let journeyUI = null, journeyNodes = null;
  let tipEl = null, tipNameEl = null, tipSubEl = null;

  /* ------------------------------------------------------------- DOM build */
  function el(tag, cls, html, parent) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    (parent || root).appendChild(n);
    return n;
  }

  function buildUI(app) {
    /* top bar */
    const top = el('div', 'hud');
    top.id = 'topbar';
    el('div', 'badge', '<span id="hud-title">PERIHELION</span>&nbsp;<span class="sub">// interactive planetarium</span>', top);
    el('div', 'badge', 'GPU&nbsp;<b id="gpu-name">…</b>', top);
    el('div', 'badge', '<span id="fps">--</span> fps', top);

    /* right column: mode + toggles */
    const rc = el('div', 'hud');
    rc.id = 'rightcol';
    const seg = el('div', 'seg', '', rc);
    el('button', 'btn mode on', 'NIGHT SKY', seg).id = 'btn-sky';
    el('button', 'btn mode', 'SOLAR SYSTEM', seg).id = 'btn-solar';
    const tog = (id, label, on) => {
      const b = el('button', 'btn tog' + (on ? ' on' : ''), label, rc);
      b.id = 'tg-' + id;
      return b;
    };
    tog('labels', 'LABELS', true);
    tog('orbits', 'ORBITS', true);
    tog('const', 'CONSTELLATIONS', true);
    tog('zodiac', 'ZODIAC', true);
    tog('minors', 'MINORS', true);
    tog('ecliptic', 'ECLIPTIC', true);
    tog('wash', 'MILKY WAY', true);
    tog('asterisms', 'ASTERISMS', true);
    tog('catalog', 'CATALOG', false);
    el('button', 'btn tog', 'JOURNEY', rc).id = 'btn-journey';
    tog('hover', 'HOVER NAMES', true);
    const chk = el('label', 'chk', '', rc);
    const chkInput = document.createElement('input');
    chkInput.type = 'checkbox';
    chkInput.checked = true;
    chkInput.id = 'chk-marker';
    chk.appendChild(chkInput);
    chk.appendChild(document.createTextNode(' HIGHLIGHT SELECTION'));
    el('button', 'btn tog', 'HELP (?)', rc).id = 'btn-help';

    /* bottom time bar */
    const bb = el('div', 'hud');
    bb.id = 'bottombar';
    const tb = el('div', 'timebar', '', bb);
    el('button', 'btn icon', '❚❚', tb).id = 'btn-play';
    const sl = el('input', 'slider', '', tb);
    sl.type = 'range'; sl.id = 'speed'; sl.min = '0'; sl.max = '1000'; sl.value = '430';
    el('div', 'speedwrap',
      '<div id="speed-label">1 day / s</div><div id="speed-sub">time warp</div>', tb);
    const pr = el('div', 'presets', '', tb);
    for (const [label, v] of [['1D/S', 86400], ['1W/S', 604800], ['1M/S', 2629800], ['1Y/S', 31557600]]) {
      const b = el('button', 'btn preset', label, pr);
      b.dataset.speed = String(v);
      b.title = label.replace('/', ' per second ');
      b.onclick = () => app.setSpeedValue(+b.dataset.speed);
    }
    el('button', 'btn', 'NOW', tb).id = 'btn-now';
    el('div', 'datebox',
      '<div id="date-main">----</div><div id="date-off"></div>', tb);

    /* info panel */
    const ip = el('div', 'infopanel');
    ip.id = 'infopanel';
    ip.style.display = 'none';
    el('button', 'ip-close', '×', ip).id = 'ip-close';
    el('h2', 'ip-title', '', ip).id = 'ip-title';
    el('div', 'ip-rows', '', ip).id = 'ip-rows';
    el('div', 'ip-fun', '', ip).id = 'ip-fun';

    /* hover tooltip */
    const tip = el('div', 'tooltip');
    tip.id = 'tooltip';
    tip.style.display = 'none';
    tipEl = tip;
    tipNameEl = document.createElement('b');
    tipSubEl = document.createElement('span');
    tipEl.appendChild(tipNameEl);
    tip.appendChild(tipSubEl);

    /* catalog drawer */
    const cat = el('div', 'catalog');
    cat.id = 'catalog';
    cat.style.display = 'none';
    const catHead = el('div', 'cat-head', '', cat);
    el('h3', null, 'CATALOG', catHead);
    const catSearch = el('input', null, null, catHead);
    catSearch.id = 'cat-search';
    catSearch.type = 'text';
    catSearch.placeholder = 'search stars, galaxies & bodies…';
    catSearch.autocomplete = 'off';
    catSearch.spellcheck = false;
    el('div', 'cat-count', '', cat).id = 'cat-count';
    const catList = el('div', 'cat-list', '', cat);
    catList.id = 'cat-list';
    catalogUI = {
      panel: cat, search: catSearch, list: catList,
      count: document.getElementById('cat-count'),
      open(v) {
        cat.style.display = v ? 'flex' : 'none';
        if (v) setTimeout(() => catSearch.focus(), 0);
      }
    };

    /* journey drawer (J key) — "Google Maps of the solar neighbourhood" */
    const jr = el('div', 'journey');
    jr.id = 'journey';
    jr.style.display = 'none';
    const jrHead = el('div', 'cat-head', '', jr);
    el('h3', null, 'JOURNEY', jrHead);
    const jrClose = el('button', 'jr-close', '×', jrHead);
    const jrPlan = el('div', 'jr-plan', '', jr);
    const jrField = (id, label, ph) => {
      const f = el('div', 'jr-field', '', jrPlan);
      el('label', 'jr-lab', label, f);
      const inp = document.createElement('input');
      inp.type = 'text'; inp.id = id; inp.placeholder = ph;
      inp.autocomplete = 'off'; inp.spellcheck = false;
      f.appendChild(inp);
      const list = el('div', 'jr-cands', '', f);
      return { inp, list };
    };
    const fromF = jrField('jr-from', 'FROM', 'city, planet, moon, star…');
    const toF = jrField('jr-to', 'TO', 'city, planet, moon, star…');
    const dField = el('div', 'jr-field', '', jrPlan);
    el('label', 'jr-lab', 'DRIVE', dField);
    const drive = el('select', null, '', dField);
    drive.id = 'jr-drive';
    el('div', 'jr-summary', '', jrPlan).id = 'jr-summary';
    const launchB = el('button', 'btn jr-launchbtn', 'LAUNCH', jrPlan);
    launchB.id = 'jr-launch';
    const jrErr = el('div', 'jr-error', '', jrPlan);
    jrErr.style.display = 'none';
    /* in-flight view */
    const jrFlight = el('div', 'jr-flight', '', jr);
    jrFlight.style.display = 'none';
    const jrRoute = el('div', 'jr-route', '', jrFlight);
    const jrPhase = el('div', 'jr-phase', '', jrFlight);
    const jrM = el('div', 'jr-metrics', '', jrFlight);
    const jrMCell = (label) => {
      const c = el('div', 'jr-mcell', '', jrM);
      const b = el('b', null, '—', c);
      el('span', null, label, c);
      return b;
    };
    const jrSpeed = jrMCell('speed');
    const jrElapsed = jrMCell('elapsed');
    const jrRemain = jrMCell('remaining');
    const jrBar = el('div', 'jr-bar', '', jrFlight);
    const jrFill = el('i', null, '', jrBar);
    const jrWarp = el('div', 'jr-warp', '', jrFlight);
    el('label', null, 'TIME WARP', jrWarp);
    const warpInp = document.createElement('input');
    warpInp.type = 'range'; warpInp.min = '0.25'; warpInp.max = '16';
    warpInp.step = '0.25'; warpInp.value = '1';
    jrWarp.appendChild(warpInp);
    const warpVal = el('span', 'jr-warpval', '×1', jrWarp);
    const jrBtns = el('div', 'jr-btns', '', jrFlight);
    const skipB = el('button', 'btn', 'SKIP', jrBtns);
    skipB.id = 'jr-skip';
    const abortB = el('button', 'btn', 'ABORT', jrBtns);
    abortB.id = 'jr-abort';
    journeyNodes = {
      jr, jrPlan, jrFlight, jrClose, fromF, toF, drive,
      launchB, jrErr, jrRoute, jrPhase, jrSpeed, jrElapsed, jrRemain,
      jrFill, warpInp, warpVal, skipB, abortB
    };

    /* help overlay */
    const help = el('div', 'help');
    help.id = 'help';
    help.style.display = 'none';
    help.innerHTML =
      '<div class="help-card">' +
      '<h2>PERIHELION <span>controls</span></h2>' +
      '<table>' +
      '<tr><td>drag</td><td>look around / orbit the camera</td></tr>' +
      '<tr><td>scroll</td><td>zoom — field of view (sky) or distance (solar)</td></tr>' +
      '<tr><td>click</td><td>select a star, galaxy, planet or the Sun</td></tr>' +
      '<tr><td>space</td><td>pause / resume time</td></tr>' +
      '<tr><td>[  /  ]</td><td>warp time slower / faster</td></tr>' +
      '<tr><td>1D 1W 1M 1Y</td><td>one-tap time warp (days…years per second)</td></tr>' +
      '<tr><td>N</td><td>jump back to the present</td></tr>' +
      '<tr><td>M</td><td>toggle sky / solar-system mode</td></tr>' +
      '<tr><td>L / O / C / E</td><td>labels / orbits / constellations / ecliptic</td></tr>' +
       '<tr><td>Z</td><td>zodiac figures on / off</td></tr>' +
       '<tr><td>P</td><td>minor planets &amp; moons on / off</td></tr>' +
      '<tr><td>T</td><td>hover names on / off</td></tr>' +
      '<tr><td>W</td><td>milky way wash on / off</td></tr>' +
      '<tr><td>A</td><td>asterisms on / off</td></tr>' +
      '<tr><td>K</td><td>catalog — search &amp; fly to any star or body</td></tr>' +
      '<tr><td>J</td><td>journey — travel between any two addresses (city, planet, star)</td></tr>' +
      '<tr><td>X</td><td>selection marker on / off</td></tr>' +
      '<tr><td>H</td><td>this help</td></tr>' +
      '</table>' +
      '<p class="dim">rendered locally on your GPU via WebGL · ephemeris computed in-page</p>' +
      '<button class="btn" id="help-close">close</button>' +
      '</div>';
    root.appendChild(help);
  }

  /* ------------------------------------------------------------- label pool */
  const labels = new Map(); // key -> {el, key}
  function makeLabel(key, cls) {
    let l = labels.get(key);
    if (!l) {
      const d = el('div', 'lbl' + (cls ? ' ' + cls : ''), labelLayer);
      l = { el: d, key, on: false, tx: null, ty: null, sel: null };
      labels.set(key, l);
    }
    return l;
  }
  /* Idempotent: touches the DOM only when a value actually changed, so a
     paused/stationary scene costs zero label work per frame. */
  function placeLabel(key, txt, x, y, on, selected) {
    const l = makeLabel(key);
    if (!on) {
      if (l.on) { l.el.style.display = 'none'; l.on = false; }
      return;
    }
    if (!l.on) { l.el.style.display = ''; l.on = true; }
    if (l.el.textContent !== txt) l.el.textContent = txt;
    const tx = (x + 8).toFixed(1), ty = (y - 14).toFixed(1);
    if (tx !== l.tx || ty !== l.ty) {
      l.el.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
      l.tx = tx; l.ty = ty;
    }
    if (l.sel !== !!selected) {
      l.el.classList.toggle('selected', !!selected);
      l.sel = !!selected;
    }
  }
  function clearLabels() {
    for (const l of labels.values()) if (l.on) { l.el.style.display = 'none'; l.on = false; }
  }

  /* ------------------------------------------------------------- info panel */
  function showInfo(title, rows, fun) {
    const panel = $('#infopanel');
    $('#ip-title').textContent = title ? String(title).toUpperCase() : '';
    const rw = $('#ip-rows');
    rw.innerHTML = '';
    for (const [k, v] of rows) {
      const tr = document.createElement('div');
      tr.className = 'ip-row';
      const ks = document.createElement('span');
      ks.textContent = k;
      const vs = document.createElement('b');
      if (v && typeof v === 'object' && v.sw) {
        /* colour swatch + text (B−V colour rows) */
        const dot = document.createElement('i');
        dot.className = 'ip-sw';
        dot.style.background = v.sw;
        vs.appendChild(dot);
        vs.appendChild(document.createTextNode(v.text));
      } else {
        vs.textContent = v;
      }
      tr.appendChild(ks); tr.appendChild(vs);
      rw.appendChild(tr);
    }
    const f = $('#ip-fun');
    f.textContent = fun || '';
    f.style.display = fun ? '' : 'none';
    panel.style.display = '';
  }
  function hideInfo() { $('#infopanel').style.display = 'none'; }

  /* ------------------------------------------------------------- bindings */
  function wire(app) {
    buildUI(app);
    $('#tg-catalog').onclick = () => app.toggleCatalog();
    $('#tg-hover').onclick = () => app.toggleState('hoverNames');
    document.getElementById('chk-marker').addEventListener('change', e => app.setHighlight(e.target.checked));
    $('#btn-sky').onclick = () => app.setMode('sky');
    $('#btn-solar').onclick = () => app.setMode('solar');
    $('#btn-play').onclick = () => { app.togglePause(); syncPlay(); };
    $('#btn-now').onclick = () => app.goNow();
    $('#speed').oninput = e => app.setSpeedFromSlider(+e.target.value);
    $('#tg-labels').onclick = () => app.toggleState('labels');
    $('#tg-orbits').onclick = () => app.toggleState('orbits');
    $('#tg-const').onclick = () => app.toggleState('constellations');
    $('#tg-zodiac').onclick = () => app.toggleState('zodiac');
    $('#tg-minors').onclick = () => app.toggleState('minors');
    $('#tg-ecliptic').onclick = () => app.toggleState('ecliptic');
    $('#tg-wash').onclick = () => app.toggleState('galaxyWash');
    $('#tg-asterisms').onclick = () => app.toggleState('asterisms');
    $('#btn-help').onclick = () => app.toggleHelp();
    $('#help-close').onclick = () => app.toggleHelp(false);
    const jb = document.getElementById('btn-journey');
    if (jb) jb.onclick = () => app.toggleJourneyPanel();
    $('#ip-close').onclick = () => { app.select(null); };
    app.onUIMode = m => {
      $('#btn-sky').classList.toggle('on', m === 'sky');
      $('#btn-solar').classList.toggle('on', m === 'solar');
    };
    app.onUIMode(app.state.mode);

    /* ------------------------------------------------------- journey wire */
    const jn = app.journey;
    if (jn && journeyNodes) {
      const N = journeyNodes;
      for (const k of Object.keys(jn.PRESETS)) {
        const o = document.createElement('option');
        o.value = k;
        o.textContent = jn.PRESETS[k].label;
        N.drive.appendChild(o);
      }
      const S = { from: { a: null, f: N.fromF }, to: { a: null, f: N.toF } };
      const sEl = document.getElementById('jr-summary');
      const esc = t => String(t).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
      const updateReady = () => { N.launchB.disabled = !(S.from.a && S.to.a); };
      const refreshSummary = () => {
        if (!S.from.a || !S.to.a) { sEl.style.display = 'none'; sEl.innerHTML = ''; return; }
        const q = jn.quote(S.from.a, S.to.a, N.drive.value);
        if (!q || !q.ok) { sEl.style.display = 'none'; return; }
        sEl.style.display = '';
        sEl.innerHTML = '<b>' + esc(S.from.a.name || S.from.a) + '</b> → <b>' + esc(S.to.a.name) + '</b><br>' +
          q.summary.distance + ' · ship time ' + q.summary.time + '<br>' + q.summary.cruise;
      };
      const wireField = slot => {
        let timer = null;
        slot.f.inp.addEventListener('input', () => {
          slot.a = null;
          updateReady(); refreshSummary();
          clearTimeout(timer);
          timer = setTimeout(() => {
            const q = slot.f.inp.value.trim();
            if (q.length < 2) { slot.f.list.innerHTML = ''; return; }
            slot.f.list.innerHTML = '';
            for (const it of jn.candidates(q)) {
              const row = document.createElement('div');
              row.className = 'jr-cand';
              const b = document.createElement('b'); b.textContent = it.label;
              const s = document.createElement('span'); s.textContent = it.sub || '';
              row.appendChild(b); row.appendChild(s);
              row.onclick = () => {
                slot.a = it.addr;
                slot.f.inp.value = it.label;
                slot.f.list.innerHTML = '';
                updateReady(); refreshSummary();
              };
              slot.f.list.appendChild(row);
            }
          }, 120);
        });
        slot.f.inp.addEventListener('keydown', e => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            const first = slot.f.list.querySelector('.jr-cand');
            if (first) first.click();
          }
        });
      };
      wireField(S.from);
      wireField(S.to);
      N.drive.addEventListener('change', refreshSummary);
      N.launchB.onclick = () => {
        if (!S.from.a || !S.to.a) return;
        const r = jn.launch(S.from.a, S.to.a, N.drive.value);
        N.jrErr.style.display = r.ok ? 'none' : '';
        N.jrErr.textContent = r.ok ? '' : r.error;
      };
      N.jrClose.onclick = () => { journeyUI.open(false); };
      N.skipB.onclick = () => jn.skip();
      N.abortB.onclick = () => jn.abort();
      N.warpInp.addEventListener('input', () => {
        const v = parseFloat(N.warpInp.value);
        jn.setWarp(v);
        N.warpVal.textContent = '×' + v;
      });
      let wasFlight = false;
      setInterval(() => {
        if (N.jr.style.display === 'none') return;
        const a = jn.active();
        if (a !== wasFlight) {
          wasFlight = a;
          N.jrPlan.style.display = a ? 'none' : '';
          N.jrFlight.style.display = a ? '' : 'none';
          if (!a) { N.jrErr.style.display = 'none'; N.warpVal.textContent = '×' + N.warpInp.value; }
        }
        if (a) {
          const h = jn.hud();
          if (h) {
            N.jrRoute.textContent = h.route;
            N.jrPhase.textContent = h.phaseLabel + ' — ' + h.note;
            N.jrSpeed.textContent = h.speed;
            N.jrElapsed.textContent = h.elapsed;
            N.jrRemain.textContent = h.remain;
            N.jrFill.style.width = (Math.min(1, h.progress) * 100).toFixed(1) + '%';
          }
        }
      }, 180);
      journeyUI = {
        open(v) {
          const show = v == null ? N.jr.style.display === 'none' : !!v;
          N.jr.style.display = show ? 'flex' : 'none';
          if (show) setTimeout(() => N.fromF.inp.focus(), 0);
        }
      };
    }
  }

  function syncPlay() {
    $('#btn-play').textContent = P.app ? (P.app.state.playing ? '❚❚' : '►') : '❚❚';
  }

  const put = (sel, t) => { const n = $(sel); if (n) n.textContent = t; };
  return {
    wire,
    makeLabel, placeLabel, clearLabels,
    showInfo, hideInfo,
    journey: {
      open(v) { if (journeyUI) journeyUI.open(v); }
    },
    catalog: {
      get panel() { return catalogUI.panel; },
      get search() { return catalogUI.search; },
      get list() { return catalogUI.list; },
      get count() { return catalogUI.count; },
      open(v) { catalogUI.open(v); }
    },
    tip(x, y, txt, sub) {
      if (!tipEl) return;
      tipEl.style.display = '';
      tipNameEl.textContent = txt;
      tipSubEl.textContent = sub;
      let tx = x + 16, ty = y + 16;
      if (tx + 250 > innerWidth) tx = x - 252;
      if (ty + 64 > innerHeight) ty = y - 66;
      tipEl.style.left = tx + 'px';
      tipEl.style.top = ty + 'px';
    },
    hideTip() { if (tipEl) tipEl.style.display = 'none'; },
    set: {
      gpu: t => put('#gpu-name', t),
      fps: t => put('#fps', t),
      play: () => put('#btn-play', P.app && P.app.state ? (P.app.state.playing ? '❚❚' : '►') : '❚❚'),
      date: (s, off) => { put('#date-main', s); put('#date-off', off); },
      speed: (s, sub) => { put('#speed-label', s); put('#speed-sub', sub); }
    },
    syncPlay,
    speedSlider: () => document.getElementById('speed'),
    splashDone: () => {
      const s = document.getElementById('splash');
      if (s) { s.style.opacity = 0; setTimeout(() => s.remove(), 450); }
    },
    splashFail: msg => {
      const s = document.getElementById('splash');
      if (s) s.innerHTML = '<div class="splash-card"><h1>PERIHELION</h1><p class="err">' + msg + '</p></div>';
    }
  };
})();
