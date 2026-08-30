# PERIHELION — data sources, provenance & downloads

Everything the app ships with is **offline** — no runtime network access is needed.
This file lists where every piece of data came from, and the small number of files
you may need to **download yourself** (only if you regenerate data or build the
planned probe/planet-zoom phase; see `plan-probes.md`).

---

## 1. Sources of the data that ships in the app

### Star field — 116,547 real stars
| What | Source |
|---|---|
| Positions, V magnitude, B−V for every star | **Hipparcos main catalog**, ESA SP-1200, public domain, J2000. Raw file `hip_main.csv` (~37 MB) is **not committed**; the generated `js/stars-hip.js` is. Download location: [Lokilife/hipparcos-data GitHub mirror](https://github.com/Lokilife/hipparcos-data) (official archive: [NASA HEASARC](https://heasarc.gsfc.nasa.gov/) / CDS VizieR). |
| HIP / HD identifiers, 497 IAU star names | **IAU Working Group on Star Names** (WGSN) official list — <https://www.iau.org/public/themes/star_names/> (local copy `_build/wgsn.csv`); generated into `js/stars-named.js`. |
| 105 hand-curated bright stars (`P.stars` in `js/data.js`), constellation figures, asterisms | Curated positions **cross-checked against SIMBAD** (CDS Strasbourg, <https://simbad.u-strasbg.fr/>, `sim-id` J2000 queries), the SFDSO "200 brightest stars" table (<http://www.sfdso.org/stars.htm>), the Atlas-of-the-Universe Hipparcos-based star table (<http://www.atlasoftheuniverse.com/stars.html>), and Wikipedia star infoboxes — verification pass August 2026 (this caught and fixed two pre-existing coordinate errors: Denebola and Acrab). |

### Planets & Moon
- The 8 planets: J2000 mean elements — **JPL approximate planetary elements**
  (Standish), computed in-page; startup self-test verifies the Sun at J2000.0.
- Moon: low-precision lunar theory (leading terms, ~0.1°).

### Minor planets & major moons (`js/minors.js`)
- **JPL Horizons** web service (<https://ssd.jpl.nasa.gov/api/horizons.api>),
  **DE440-class** ephemerides, fetched 2026-08-30. Osculating Keplerian elements
  at **T0 = 2026-08-30T12:00TDB** (JD 2461283.0). 8 dwarf planets / bright
  asteroids (Ceres…Makemake) + 11 major moons. Each element set round-trips its
  fetch-time position to < 3e-4 AU. Build scripts: `_build/fetch-minors*.mjs`,
  `hz-*.mjs`, `fetch-final.mjs`.

### Deep-sky objects — 945 pickable + 18,442 faint render-only
- **Galaxies (624 bright, `js/dso.js`)**:
  - 58 hand-curated bright galaxies (Messier + famous NGC), hand-audited J2000.
  - **NGC 2000.0** (Sinnott, Sky Publishing 1988) via CDS VizieR **VII/118** —
    J2000 positions, V magnitudes, angular sizes.
  - **UGC** (Uppsala General Catalogue of Galaxies, Nilson 1973) via VizieR
    **VII/26D** — B1950 positions precessed to J2000 (matrix fitted to 11,879
    B1950→J2000 pairs from Corwin 2004, mean residual 3.6″), Hubble types, sizes.
  - **Corwin 2004** "Accurate Positions for the NGC/IC Objects", VizieR **VII/239A**.
- **Clusters & nebulae (321 bright, `js/dso2.js`)**:
  - Positions: **SIMBAD** (CDS Strasbourg) primary ICRS/J2000 coordinate, fetched
    2026-08-30 (quality mix A/D/E; bibcodes in the file header), 0 fallbacks.
  - Messier names/types/sizes/distances: Wikipedia "List of Messier objects"
    (J2000 table, retrieved 2026-08).
  - Selection/classes/magnitudes: NGC 2000.0 (as above).
- **Faint background**: 18,304 galaxies + 138 faint clusters/nebulae, same sources,
  render-only point sprites.
- VizieR = CDS Strasbourg: <https://vizier.cds.unistra.fr/viz-bin/VizieR>

### Everything else
- **Milky Way soft wash**: procedural (galactic-plane geometry in `js/sky.js`),
  no external files; toggle `W`.
- **Asterisms** (`js/asterisms.js`): 6 classic figures; unnamed vertices (Keystone,
  Crown) are Hipparcos catalog points; the rest cross-checked vs SIMBAD/Wikipedia
  J2000 (Aug 2026).
- **Three.js r128** (`js/three.min.js`): MIT license, <https://threejs.org/>.
- **Star colors**: B−V → RGB ramp (in `js/sky.js`), standard Johnson system.

---

## 2. Files YOU may need to download

**To simply run the app: nothing.** Double-click `index.html`.

### a) Regenerating the star data (optional)
| File | Where | Put it in |
|---|---|---|
| `hip_main.csv` (~37 MB, Hipparcos main catalog) | [github.com/Lokilife/hipparcos-data](https://github.com/Lokilife/hipparcos-data) or NASA HEASARC | `_build/` (then `node _build/convert.js` etc. — see README "Regenerating star data") |

### b) Planned phase — probes & planet close-ups (`plan-probes.md`)
These will be embedded/generated at build time; if you prefer to fetch them
yourself, here are the exact locations:

| File to download | Where | Save as |
|---|---|---|
| JWST official 3D model (GLB) | [NASA 3D resources — "James Webb Space Telescope"](https://science.nasa.gov/3d-resources/) (also listed at [nasa.gov/3d-resources](https://www.nasa.gov/3d-resources/); mirror: the [Sketchfab "JWST" model](https://sketchfab.com/3d-models/jwst-james-webb-space-telescope-6c92c08a672640afb58ee44d248fd0fe) sourced from NASA's archive) | `js/models/jwst.glb` (embedded as b64 at build time) |
| Earth texture (Blue Marble composite, 2K equirect) | [NASA Visible Earth](https://visibleearth.nasa.gov/) / Earth Observatory | `textures/earth.jpg` |
| Moon (LRO/NEAR composite) | NASA PDS / [LRO](https://lro.nasa.gov/) | `textures/moon.jpg` |
| Mars (enhanced color global) | NASA PDS / MGS "Mars Color Mosaic" | `textures/mars.jpg` |
| Jupiter (global color mosaic) | Juno/JPL mosaic via NASA PDS | `textures/jupiter.jpg` |
| Saturn (color) + ring strip | JPL / Cassini archives | `textures/saturn.jpg`, `textures/saturn-rings.jpg` |
| Mercury (MESSENGER mosaic) | NASA PDS / MESSENGER | `textures/mercury.jpg` |
| Venus (Magellan-derived enhanced) | NASA PDS | `textures/venus.jpg` |
| Uranus, Neptune (Voyager 2 mosaics) | NASA PDS / Voyager archive | `textures/uranus.jpg`, `textures/neptune.jpg` |

All NASA material is public domain (US Government work); license the model files
with their source where indicated.

---

## 3. Other sources consulted during development (context)

- **SIMBAD** (CDS, Strasbourg) — star identifier cross-checks: <https://simbad.u-strasbg.fr/simbad/sim-id?Ident=…>
- **JPL Horizons** — probe/planet/moon ephemerides: <https://ssd.jpl.nasa.gov/api/horizons.api>
- **CDS VizieR** (VII/118, VII/26D, VII/239A) — NGC/UGC/Corwin catalogs
- **Wikipedia** — star infoboxes (J2000), "List of Messier objects", "List of active Solar System probes"
- SFDSO brightest-star table, Atlas of the Universe star table, TheSkyLive,
  Universe Guide, Star-Facts — star coordinate cross-checks (Aug 2026)
- **NASA 3D resources** (<https://science.nasa.gov/3d-resources/>) and
  [Wikipedia active-probes list](https://en.wikipedia.org/wiki/List_of_active_Solar_System_probes)
  — for the planned probe phase
- Raw working files kept in `_build/` (`simbad-j2000.json`, `const-stars.json`,
  `sfdso200.html`, `atlas200.html`, `corwin-vii239a.xml`, …) — kept for
  reproducibility; safe to delete at ~6 MB.
