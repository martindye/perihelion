# PERIHELION — a full-3D planetarium, built by an AI agent with real star data

Every single point of light in this video is a REAL star. All 116,547 of the
Hipparcos catalog, rendered live in WebGL on a GeForce RTX 5090 — no videos,
no textures of the sky, no fake random stars. Built in one sitting by an AI
coding agent, verified frame-by-frame by a local vision model, running
completely offline from a single double-clickable folder.

TIMESTAMPS
0:00  Intro — 116,547 real stars
0:00  The night sky (Milky Way emerges from real galactic-plane data)
0:00  Constellations, ecliptic, 83+497 named stars
0:00  The catalogue: search "sirius", "60718", "18622" — fly to anything
0:00  Solar system mode — real Keplerian ephemerides, follow any planet
0:00  The Moon bug (36,525× too fast — and how the vision model caught it)

HOW IT WAS MADE
• Coding agent: Qwen 3.8 27B (Q6 quant, "qwen3.8-27B-Q6") — wrote 100% of the
  code, the data pipelines, and the test/verification harness.
• Vision model: Qwen 3.8 27B vision ("qwen3.8-27b-vision"), served locally
  with llama.cpp — inspected every screenshot (star alignment, label
  crowding, the Moon-orbit bug) so the agent could see what users would see.
• Verification loop: headless browser (Edge, SwiftShader + virtual time) for
  DOM/console assertions, real-GPU screenshots for visual review.

WEB RESEARCH (how the agent looked things up)
1. A built-in web-search tool: the agent sends plain queries and receives
   ranked source URLs + snippets (used to locate the IAU named-star database).
2. Plain HTTP downloads of the raw data files via PowerShell
   (Invoke-WebRequest → raw.githubusercontent.com). No API keys, no cloud.

DATA & CODE SOURCES
• Star positions: the official Hipparcos Main Catalog (ESA, public domain) —
  118,218 stars, taken as hip_main.csv from
  https://github.com/Lokilife/hipparcos-data
  (official archive: NASA HEASARC, heasarc.gsfc.nasa.gov).
• Star names: the official IAU Working Group on Star Names (WGSN) list —
  586 entries, via the community mirror
  https://github.com/cyschneck/iau-star-names (stars_with_data.csv).
• Planet orbits: J2000 mean Keplerian elements (standard approximate
  elements, JPL/Standish lineage) — computed live in the browser.
• Moon: leading terms of the low-precision lunar theory from
  E. Meeus, "Astronomical Algorithms".
• Rendering: Three.js r128 (MIT license, © 2010–2021 Three.js authors) —
  vendored locally, https://github.com/mrdoob/three.js
• Everything else (star shader, constellation figures, catalogue, search,
  ephemeris math, HUD) was written for this project. No other libraries.

RUNS OFFLINE
No CDNs, no fetch(), no network at runtime. Copy the folder anywhere,
double-click index.html. (Built for and tested on an NVIDIA GeForce RTX 5090.)

#planetarium #astronomy #threejs #webgl #ai #rtx5090 #hipparcos #stargazing
