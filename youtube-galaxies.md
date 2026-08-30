# PERIHELION — 18,928 real galaxies, one offline planetarium

Every galaxy in this video is a real galaxy. 18,928 of them — 624 bright
enough to pick, label and fly to, plus 18,304 faint ones from the survey
catalogs — rendered live in WebGL on a GeForce RTX 5090. No sky videos, no
textures, no random blobs: real positions, real magnitudes, real sizes,
real position angles, real B−V colours.

Type "andromeda" into the catalog and the app finds M31 by its common
name. Type "needle" and you get the Needle Galaxy. The colour of every
galaxy — and of every star — is computed from its measured B−V index:
temperature first, then the peak wavelength of its light by Wien's law.
M31 comes out at 4,873 K, peaking at 595 nm — exactly where Andromeda
should be.

TIMESTAMPS
0:00  Intro — a real-sky planetarium
0:05  116,547 real stars · 18,928 real galaxies
0:15  The catalog: search "andromeda" — M31 by its common name
0:23  M31, the Andromeda Galaxy — 2.5 million light-years away
0:30  Deep zoom: 55° → 8°, the resolved disc
0:47  Colour from its real B−V index — 4,873 K, peak at 595 nm
0:55  Search "whirlpool" — M51, the Whirlpool Galaxy
1:00  M51 — 23 million light-years away
1:22  Every faint smudge is a real galaxy
1:30  End card

HOW THE GALAXY DATA WAS BUILT
• NGC 2000.0 (Sinnott 1988) via VizieR catalog VII/118 — J2000 positions,
  magnitudes, sizes, position angles, Hubble types.
• UGC (Nilson 1973) via VizieR catalog VII/26D — B1950 positions precessed
  to J2000 with a matrix fitted against 11,879 Corwin 2004 pairs
  (mean residual 3.6 arcsec).
• UGC → NGC/IC cross-match enriches 3,304 objects with Hubble types.
• 58 curated deep-sky objects cross-checked object by object.
• Provenance is written into the header of the generated data file
  (js/dso.js). No fabricated objects, no fabricated positions.

HOW IT WAS MADE
• Three.js r128 (MIT), vendored — the galaxy layer is one instanced draw
  of 624 textured quads (real size/angle per galaxy) plus one Points draw
  for the 18,304 faint galaxies.
• The 4K master was captured with the in-repo CDP screencast pipeline
  (headless Edge → Page.screencast → 24 fps locked writer → h264_nvenc).
• Verified frame-by-frame with a local Qwen-27B vision model.

RUNS OFFLINE
No CDNs, no fetch(), no network. Copy the folder, double-click index.html.
Built for and tested on an NVIDIA GeForce RTX 5090 at 3840×2160.

#planetarium #astronomy #threejs #webgl #galaxies #m31 #andromeda #offline #rtx5090
