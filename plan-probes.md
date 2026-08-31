# PERIHELION — Plan: space probes, JWST models, planet close-ups, layout fix

Status: **COMPLETE — all 7 phases done (2026-08-31), plus post-plan fixes for the
radial-scale inversion, orbit crowding, and detailed probe models (see progress log
tail).**

## 12. Progress log

**Phase 1 — data (2026-08-31, commit 9b47731).** 13 probes fetched from JPL Horizons
(**PUNCH is not in the Horizons DB yet** — added when coverage lands; roster is then
11 tier-1 + 3 tier-2). Samples: weekly 2022→prediction-end (inner) / monthly
2001/2006→2049-2051 (outer), heliocentric ecliptic km+km/s; osculating elements at
T0 (hyperbolic a<0/e>1 for V1/V2/NH, kept **unwrapped** M0). `js/probes.js`
(0.26 MB, b64 int32 epochs + float32 states, 6,595 states). `probesSelfTest`:
sample vs Kepler at T0 max 0.019 AU (PSP, high-e) — OK. T0 distances verified:
JWST 1.018, PSP 0.182, Juno 5.29, V1 171.5, V2 143.7, NH 65.3 AU.
Numeric Horizons IDs resolved empirically (Juno −61, Solar Orbiter −144, Psyche −255,
Lucy −49, V1 −31, V2 −32). Fetches abort if the range leaves the trajectory file —
per-probe START/STOP now bracket each file (notes in `_build/fetch-probes.mjs`).

**Phases 2–4 — sky markers, models, solar scene (2026-08-31).**
- `astro.probeHeliocEcl`: sample interpolation (binary search, linear) +
  hyperbolic-aware Kepler fallback (unwrapped M, sinh-true-anomaly); velocity for
  telemetry. `probesSelfTest` runs at load.
- Sky mode: all 13 as dome discs (sky.js `bodyRecords`), labels + picking in both
  modes, catalog entries (search by name/alias/agency — "webb" → JWST), info card
  (agency, launch, status, live Sun/Earth distance, velocity, light time, fun fact).
- Solar mode: procedural models (JWST gold mirror + sunshield; Parker octagon
  shield; Juno 3-wing; Voyager/NH dish+bus+RTG; generic bus+panels) at true
  compressed positions; tier-2 pushed to the scene rim (r=44) as icons since the
  compressed scale parks them in the Sun's glow.
- Chase camera: catalog click / select sets `state.follow` → camera rides the probe
  (QA: target offset 0.000).
- QA: `_qa/qa-probes.mjs` — 22 checks green (incl. 2036 time travel: V1 → 207 AU,
  JWST via Kepler fallback 1.04 AU; chase-camera tracking).
- three r128 note: `Vector3.array` does not exist in this build — engine writes via
  `.set()` only.

**Phase 5 — planet photo close-ups (2026-08-31).** 2048×1024 equirectangular
mosaics for all 8 planets + Moon (Solar System Scope set — mosaics of
NASA/JPL/USGS public-domain imagery; `_build/fetch-textures.mjs` records the
source URLs). Key gotcha: a `file://` page **cannot** upload a loose
`<img>` file to WebGL (opaque origin → `texImage2D` SecurityError), so the
maps are re-encoded at q0.72 and **embedded as data-URLs in
`js/planets-textures.js`** (2.15 MB; `_qa/embed-textures.mjs` regenerates).
`loadTextures()` (lazy, first solar entry) swaps each planet/moon to
`MeshPhongMaterial{map}`; flat colour stays as fallback. Close-up: catalog
select dollies to ~5× radius (wheel dollies back out); chase camera
unchanged. QA `qa-planetzoom.mjs`: texture applied (phong + 2048-px map),
chase offset 0.000, no WebGL SecurityErrors.

**Phase 6 — layout (2026-08-31).** Detail pane moved to its own top-right
corner (`top:64 right:16`, `max-height: calc(100vh-184px)` + scroll,
z-index 16); catalog keeps the bottom-left column. Diagonally separated →
they can never paint over each other; verified at 1280×800-class and
1920×1080 (rects disjoint in QA). The optional "collapse results to a bar"
idea from the plan was dropped in favour of the corner separation (keeps
results browsable while the card is open).

**Phase 7 — final regression (2026-08-31).** Full maintained suite green:
qa-toggles, qa-constsearch, qa-minors/2/3, qa-asterisms, qa-dso2,
qa-constfigs, verify-named-exclusion, verify-probes, qa-probes (22 checks),
qa-planetzoom (9 checks). All console self-tests OK (ephemeris, minors,
probes). Plan complete.

---

## 0. In progress / queued before the probe phase (added 2026-08-31)

1. **All 12 zodiac signs as figures, switchable. — DONE (2026-08-31).**
   - Already present: Aries, Taurus, Gemini, Leo, Virgo, Scorpius, Sagittarius.
   - Added: **Cancer, Libra, Capricornus, Aquarius, Pisces** (new named stars,
     coordinates verified against the in-app Hipparcos buffer + external tables).
   - **ZODIAC** toggle (key `Z`, top-bar button): shows/hides the 12 zodiac
     figures (lines + centroid name labels) independently of the general
     constellation toggle.
2. **Minor-bodies toggle. — DONE (2026-08-31).**
   - **MINORS** toggle (key `P`, top-bar button): shows/hides the 9 dwarf
     planets (5 IAU + Vesta, Pallas, Hygiea, **Ixion**) + their 11 major moons —
     solar-mode meshes & orbit lines, sky-mode dome discs, labels and catalog
     entries, all together.
3. **Ixion** — added as a **dwarf-planet candidate** (28978 Ixion, 2001 KX76,
   plutino 2:3 with Neptune; NOT the Saturn moon of the same name) — the 9th
   entry in `P.minors.planets`, real T0 Horizons elements (a ≈ 39.35 AU,
   i = 19.66°, Ω = 71.08°).
4. **Star-buffer regeneration. — DONE (2026-08-31).** The 13 named stars added
   in the v2 build were never regenerated out of the Hipparcos b64
   (double-rendering); reran `_build/convert.js` + `convert-named.js` so all 122
   named stars are excluded from `js/stars-hip.js` exactly once (116,508 buffer
   stars).
5. **Moon & minor-planet element correction (2026-08-31).** The v2 fetch
   pipeline left 10 moons' phases/elements in a barycentric frame with a buggy
   mean-anomaly formula. Re-derived all 10 moons from J2000 state vectors
   (barycentre→planet-centre corrected) and all 9 dwarf planets from fresh T0
   heliocentric states; every set round-trips its source state to ~1e-15
   (see `_build/derive-final.mjs`, `_build/minors-final.json`).
6. Probe/planet-zoom work below (phases 1–7) follows, unchanged.

---

## 1. Objectives (from the request)

1. Correct positions for space probes **still transmitting signals** (as of the app's T0 = 2026-08-30), incl. JWST.
2. A **good 3D model of JWST**; recognizable models for the other active probes.
3. Probes added to the **searchable catalog list**.
4. **Zoom into probes** to see detail (model + live-ish telemetry).
5. **Fix**: search-results list sometimes overlaps the detail pane.
6. **Planet close-ups in solar mode**: detailed photo surface maps, camera locked to the planet while zoomed.

---

## 2. Probe roster (active, still transmitting — verify at build time against the
   [active-probes list](https://en.wikipedia.org/wiki/List_of_active_Solar_System_probes))

**Tier 1 — inside ~40 AU, rendered in the SOLAR scene as real 3D models at true positions:**

| Probe | ~Position at T0 | Notes |
|---|---|---|
| JWST | Sun–Earth L2 halo (≈1.01 AU) | the star of the show; 6-mo halo orbit |
| Parker Solar Probe | 0.05–0.9 AU | extreme eccentric solar orbits |
| Juno | Jupiter orbit | |
| Solar Orbiter | inner heliosphere | |
| BepiColombo | Mercury (orbit insertion ~2025) | |
| Psyche | heliocentric cruise → 4 Psyche (2029) | |
| Lucy | main-belt → outer asteroids (2024–2033 flybys) | |
| JUICE | cruise → Jupiter 2031 | |
| Gaia | Sun–Earth L2 | |
| Euclid | Sun–Earth L2 | |
| PUNCH | Sun–Earth L1 | (launched 2025) — **not in Horizons yet** (tested P739 / PUNCH(2025-023A): no matches, 2026-08-31); add when coverage lands |

**Tier 2 — too far for scene scale (hundreds of AU): SKY-mode markers + detail view**
(they live on the celestial sphere like stars, but with probe styling):

| Probe | ~Distance at T0 |
|---|---|
| Voyager 1 | ~175+ AU |
| Voyager 2 | ~150+ AU |
| New Horizons | ~55–60 AU |

Tier 2 also gets a distant marker in the solar scene (tiny icon at the scene rim) so they
exist in both views. Optional extras if cheap: IMAP (launch timing to verify), IXPE.
Excluded: Cassini/TGO (mission ended), Dawn (ended 2024), MESSENGER, Rosetta, Ulysses.

---

## 3. Data pipeline (reuses the proven minor-planet pipeline)

1. **`_build/fetch-probes.mjs`** — JPL Horizons (`ssd.jpl.nasa.gov/api/horizons.api`, the same
   API already used for the minor planets; IDs resolved via the API's `make search`, e.g.
   "Voyager 1", "JWST", "PSP" — no hard-coded ID guesses).
   - Per probe: state vectors (ecliptic, km + km/s) sampled: **daily for ±12 y** for
     L1/L2/craft (JWST, PUNCH, Solar Orbiter, Parker, BepiColombo, Psyche, Lucy, JUICE,
     Gaia, Euclid, Juno), **weekly for ±25 y** for the outer three; plus **osculating
     elements at T0** for long-time extrapolation (same pattern as `js/minors.js`).
   - Output `_build/probes-final.json` (provenance header: T0, ephemeris class).
2. **`_build/convert-probes.mjs`** → **`js/probes.js`** (`P.probes = [...]`):
   `{ name, id, tier, color, model: 'jwst'|'voyager'|'newhorizons'|'sat'|…, size,
     el:{a,e,i,Omega,varpi,M0,n,t0},  // osculating at T0 (long-range)
     samples: {t0, dt, dtOuter, b64 states}  // dense near-T0 (b64 float32, stars-hip pattern)
     facts: { launch, agency, rocket, mission, status, lastContact, fun } }`
   - Positions at sim time: interpolate the dense samples while |t−T0| ≤ 10 y (cubic
     Hermite on the state vector), else osculating Kepler via the existing `astro.oscEcl`.
   - Display values (distance from Sun/Earth, speed, one-way light time) computed live
     from the interpolated state — numbers stay honest as the sim clock runs.
3. **`js/astro.js`** — no changes needed (oscEcl + interpolation helpers are there);
   add `probesSelfTest()` mirroring `minorsSelfTest()` (n·P≈360°, sample continuity
   < 0.01 AU across the join point).

## 4. 3D models

- **JWST — the good one**: fetch the official NASA model from the
  [NASA 3D resources](https://science.nasa.gov/3d-resources/) / nasa3d archive
  (the JWST model is the same source as the Sketchfab "JWST" model; also on Sketchfab as
  a fallback). Convert to a small GLB (< ~4 MB, Draco if available).
  - Loader: three r128 has no bundled GLTFLoader → add
    `js/three/GlTFLoader.js` (the matching r128 example, standalone file, ~30 KB) and
    instantiate from the embedded GLB (base64 `js/models/jwst.glb.b64.js`, same pattern as
    `stars-hip.js`; `file://` can't fetch loose binary files reliably).
  - **Guaranteed baseline**: a hand-built procedural JWST (18 gold hex mirror segments on
    a backplane, 5-layer sunshield, bus) in case the NASA GLB fails its license/parse —
    built from `CircleGeometry`/`BoxGeometry`, ~150 lines. Whichever loads wins; the
    procedural one doubles as the "detail render" fallback.
- **Others — procedural** (cheap, recognizable, no binary bloat):
  - Voyager: parabolic dish + RTG boom + high-gain antenna (LatheGeometry + cylinders).
  - New Horizons: triangular 3-sided dish + box bus.
  - Parker: gold octagonal heat shield (cone) + two solar wings.
  - Juno: 3-box body + 3 long solar wings.
  - Generic L1/L2 sats (Gaia, Euclid, PUNCH, Solar Orbiter, BepiColombo, Psyche, Lucy,
    JUICE): box bus + 2 solar panels + dish, one shared model class, per-probe scale/tint.
- All models: low-poly (< 2 k tris each), flat-lit + one rim-light-friendly material so
  they read at any camera angle; spin slowly when in the info-card preview.

## 5. Catalog + selection (searchable list)

- `app.js` `catalogList()`: add probe entries — `PROBE · <name> · <tier-note>`,
  `visible: () => true` (probes are visible in both modes; in sky mode they're sky
  markers, in solar mode tier-1 are meshes). Selection → `select(entry)` as today.
- **Sky mode**: probes render as small distinctive sprites (diamond/dish glyph, unique
  color, slight pulse) with labels — not confused with stars; always visible regardless
  of star density (they're `bodyRecords`-style entries, not part of the HIP field).
  Click/enter flies the dome to their direction (same as stars) and opens the card.
- **Detail card** (`probeInfo()` next to `bodyInfo()`): name, agency, launch (date +
  rocket), mission status + last contact, current heliocentric distance (AU), Earth
  distance (AU), speed (km/s), one-way light time, one fun fact (Voyager Golden Record,
  "Pale Blue Dot", etc.), **and a rendered 3D image of the model** (rendered once to a
  512-px offscreen canvas when first opened — no second live WebGL context needed).

## 6. Zoom-to-probe / zoom-to-planet ("detail" camera)

One shared **chase-camera** mechanism, used for planets, moons (already partly exists)
and tier-1 probes:

- Trigger: double-click the body's mesh/sprite, or an **"Approach"** button in the
  detail card.
- Transition (~1.2 s ease): orbit target → body's live world position; dolly to the
  body's detail radius (planets: 3–10 R per body; probes: 4–8 model radii).
- While locked: camera orbits the body (drag) and wheels between `[1.05 R, 40 R]`;
  the body's own spin (planets already rotate) makes the surface track under the view;
  background stays live (stars/sun/other bodies keep moving — the camera rides the body).
- Exit: `Esc`, the **"← System view"** button (added near the play/pause cluster), or
  selecting another body. Sunlight in the solar scene gives the day/night terminator on
  the planet for free.
- Tier-2 probes (Voyagers, New Horizons): not in the solar scene — their "zoom" is the
  detail card with a live-rotating model (a small dedicated renderer or the offscreen
  render loop) + live distance/light-time. (Option: an "interstellar" fly-through later;
  out of scope here.)

## 7. Planet close-ups with real photos (solar mode only)

- **Textures** (all public-domain NASA, equirectangular 2048×1024 JPGs, in a new
  `textures/` folder; loaded lazily via `new Image()` on first zoom — `<img>`-based
  textures avoid file:// fetch/CORS issues entirely):
  - Earth: Blue Marble composite · Mercury: MESSENGER mosaic · Venus: Magellan-derived
  enhanced · Mars: MGS enhanced color ("Mars global color") · Jupiter: Juno/Huygens
  global mosaic · Saturn: Voyager/JPL color + **ring texture** (1-D radial, 1024-px strip,
  Cassini division visible) on a transparent `RingGeometry` · Uranus & Neptune: Voyager 2
  mosaics · Moon: LRO/NEAR composite.
  - Fallback: current procedural color if a file is missing.
- Planets get `MeshPhongMaterial({ map })` (bump: optional second pass, skip v1).
- Saturn ring + faint Jupiter cloud-band animation: out of scope (static cloud maps).
- Moons keep their current simple materials (they're tiny in planet-view anyway).

## 8. Layout fix — search list vs detail pane overlap

- Reproduce first (catalog open → type a query → click a result at small/mid viewport)
  and screenshot; then fix in `ui.js`/`index.html` CSS:
  - Put the catalog panel and the detail pane in **separate fixed columns** (catalog:
    left edge, own scroll, max-height; detail pane: its own corner with higher z-index)
    so they can never paint over each other;
  - `max-height` + internal `overflow-y` on the result list (already partially present —
    tighten it), and collapse the list to a "results: n — click to expand" bar when a
    selection is active (configurable, default ON).
- Verify with a vision pass at 1280×800 and 1920×1080.

## 9. Files touched

| File | Change |
|---|---|
| `js/probes.js` | **new** — probe data (elements, samples b64, facts, model keys) |
| `js/models.js` | **new** — procedural models + GLB bootstrap (jwst) + model registry |
| `js/astro.js` | probe state interpolation (Hermite over samples) + `probesSelfTest()` |
| `js/sky.js` | tier-2 probe sky markers + labels (probe glyph sprite) |
| `js/solar.js` | tier-1 probe meshes + orbit trails + planet texture loading + ring mesh |
| `js/app.js` | catalog entries, `probeInfo()`, chase-camera controller, approach/exit, self-test call |
| `js/ui.js` / `index.html` | "Approach"/"System view" buttons, pane CSS fix, help lines, `?dbg=1` unaffected |
| `textures/*.jpg` | **new** — planet maps (lazy-loaded) |
| `js/three/GlTFLoader.js` | **new** — r128 example loader (standalone) |
| `js/models/jwst.glb.b64.js` | **new** — embedded JWST model (if NASA GLB usable) |
| `_build/fetch-probes.mjs`, `convert-probes.mjs` | **new** build scripts |
| `_qa/qa-probes.mjs`, `_qa/qa-planetzoom.mjs` | **new** QA; `qa-final.mjs` extended |

## 10. Phases & QA gates

1. **Data** — fetch + convert probes; console table sanity (distances vs known values:
   Voyager 1 ≈ 175 AU at T0, JWST ≈ 1.01 AU, Parker < 0.2 AU in Aug 2026? — spot-check
   against Horizons output and one external source). Gate: `probesSelfTest` OK.
2. **Sky mode** — tier-2 markers + catalog entries + detail cards; QA: search each probe,
   fly, card values sane; vision pass.
3. **Models** — procedural set + JWST (GLB or procedural); QA: offscreen renders of each
   model (vision pass on the JWST one specifically).
4. **Solar mode** — tier-1 meshes + trails + chase-cam for probes; QA: approach each
   probe, orbit, exit.
5. **Planet zoom** — textures + chase-cam for all 8 planets + Moon + Saturn ring; QA:
   texture-per-pixel check (vision: "can you see craters/clouds/terminator?").
6. **Layout** — overlap fix; QA: 2 viewport sizes, search → select, screenshot + vision.
7. **Final** — full `qa-final` regression (counts now include probes), self-tests green,
   fresh renderer no-crash in both phases, console clean.

## 11. Risks & fallbacks

| Risk | Mitigation |
|---|---|
| NASA GLB licensing/size surprise | Procedural JWST is the guaranteed path; GLB is a bonus |
| `file://` texture/model loading | everything embedded as b64 or `<img>`-based; no fetch() of local files |
| JWST halo orbit drifts at extreme sim speeds | documented as "approximate beyond ±10 y"; dense samples cover realistic use |
| Scene scale for Voyager (175 AU) | tier-2 = sky markers only; no scene re-scaling |
| Performance (14 more objects + textures) | textures lazy; models tiny; trails reuse the minor-planet line trick |
| Horizons rate limits | 1.2 s spacing, resumable cache (existing pattern) |
