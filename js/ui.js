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
    tog('ecliptic', 'ECLIPTIC', true);
    tog('catalog', 'CATALOG', false);
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
    catSearch.placeholder = 'search stars & bodies…';
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
      '<tr><td>click</td><td>select a star, planet or the Sun</td></tr>' +
      '<tr><td>space</td><td>pause / resume time</td></tr>' +
      '<tr><td>[  /  ]</td><td>warp time slower / faster</td></tr>' +
      '<tr><td>1D 1W 1M 1Y</td><td>one-tap time warp (days…years per second)</td></tr>' +
      '<tr><td>N</td><td>jump back to the present</td></tr>' +
      '<tr><td>M</td><td>toggle sky / solar-system mode</td></tr>' +
      '<tr><td>L / O / C / E</td><td>labels / orbits / constellations / ecliptic</td></tr>' +
      '<tr><td>T</td><td>hover names on / off</td></tr>' +
      '<tr><td>K</td><td>catalog — search &amp; fly to any star or body</td></tr>' +
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
      l = { el: d, key };
      labels.set(key, l);
    }
    return l;
  }
  function placeLabel(key, txt, x, y, on, selected) {
    const l = makeLabel(key);
    if (!on) { l.el.style.display = 'none'; return; }
    l.el.style.display = '';
    if (l.el.textContent !== txt) l.el.textContent = txt;
    l.el.style.transform = 'translate(' + (x + 8).toFixed(1) + 'px,' + (y - 14).toFixed(1) + 'px)';
    l.el.classList.toggle('selected', !!selected);
  }
  function clearLabels() {
    for (const l of labels.values()) l.el.style.display = 'none';
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
      vs.textContent = v;
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
    $('#tg-ecliptic').onclick = () => app.toggleState('ecliptic');
    $('#btn-help').onclick = () => app.toggleHelp();
    $('#help-close').onclick = () => app.toggleHelp(false);
    $('#ip-close').onclick = () => { app.select(null); };
    app.onUIMode = m => {
      $('#btn-sky').classList.toggle('on', m === 'sky');
      $('#btn-solar').classList.toggle('on', m === 'solar');
    };
    app.onUIMode(app.state.mode);
  }

  function syncPlay() {
    $('#btn-play').textContent = P.app ? (P.app.state.playing ? '❚❚' : '►') : '❚❚';
  }

  const put = (sel, t) => { const n = $(sel); if (n) n.textContent = t; };
  return {
    wire,
    makeLabel, placeLabel, clearLabels,
    showInfo, hideInfo,
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
