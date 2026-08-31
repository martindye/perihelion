/* ============================================================================
 * PERIHELION — minor planets & major moons (js/minors.js)
 *
 * T0 = 2026-08-30T12:00TDB  (JD 2461283.0 = 9738.0 days after J2000.0)
 *
 * Provenance (re-derived & verified 2026-08-31):
 *  planets[]  — osculating elements at T0 from fresh JPL Horizons VECTORS
 *               (CENTER=@10, DE440-class), 2026-08-30; every set reproduces
 *               its source state to ~1e-15 (see _build/derive-final.mjs).
 *               The pre-existing a/e/i/Omega/w/M0/n values were re-verified
 *               against this independent fetch and matched exactly.
 *  moons[]    — osculating elements derived at J2000.0 from JPL state vectors
 *               (system-barycentric states corrected to the planet centre via
 *               fetched barycentre/planet heliocentric states), with M0
 *               propagated to T0 by n*9738 d. Each set round-trips its source
 *               state to ~1e-15.
 *               Charon: no state vector is publicly fetchable; a/e/i/n from
 *               the J2000 fact sheet, node corrected, phase unverifiable.
 *  28978 Ixion — dwarf-planet candidate (plutino, 2:3 with Neptune); T0
 *               heliocentric state from Horizons (2026-08-30).
 *
 * Field meanings (shared by planets[] and moons[]):
 *   a      semimajor axis [AU]  (planets only; moons: see aKm/aAu below)
 *   e      eccentricity
 *   i      inclination to the ecliptic [deg]
 *   Omega  longitude of ascending node [deg]
 *   w      argument of perihelion [deg]
 *   M0     mean anomaly at T0 [deg]
 *   n      mean motion [deg/day]
 *   varpi  longitude of perihelion (= w + Omega) [deg]
 * moons additionally:
 *   aKm    semimajor axis [km], parent-centric
 *   aAu    aKm in AU
 *   parent parent body name (solar-system mode)
 * ==========================================================================*/
'use strict';
window.P = window.P || {};

P.minors = {
  /* T0 in days after J2000.0 (2026-08-30T12:00TDB) */
  t0: 9738.0,
  t0Date: '2026-08-30T12:00TDB',

  planets: [
    { name: 'Ceres',
      a: 2.7658247, e: 0.079735, i: 10.5877, Omega: 80.249, w: 73.23,
      M0: 292.165, n: 0.214272831, varpi: 153.4789,
      color: 0x9a8f83, size: 0.42,
      facts: { diameter: '946 km', period: '4.60 years', moons: '0',
        fun: 'The largest body in the asteroid belt — and the only dwarf planet inside Neptune\u2019s orbit.' } },
    { name: 'Vesta',
      a: 2.3612802, e: 0.090225, i: 7.1439, Omega: 103.7001, w: 151.4466,
      M0: 103.621, n: 0.271633163, varpi: 255.1467,
      color: 0xb0a89a, size: 0.38,
      facts: { diameter: '525 km', period: '3.63 years', moons: '0',
        fun: 'The second-largest body in the asteroid belt; its fragments reach Earth as howardite meteorites.' } },
    { name: 'Pallas',
      a: 2.7694175, e: 0.230703, i: 34.9336, Omega: 172.8868, w: 310.9829,
      M0: 271.877, n: 0.213855989, varpi: 123.8697,
      color: 0x8f9a8f, size: 0.36,
      facts: { diameter: '512 km', period: '4.62 years', moons: '0',
        fun: 'Its orbit is tilted a full 34.6\u00b0 to the ecliptic, so it can stray far north or south of the Sun\u2019s path.' } },
    { name: 'Hygiea',
      a: 3.1509325, e: 0.106227, i: 3.8269, Omega: 283.1051, w: 312.4954,
      M0: 266.458, n: 0.176216033, varpi: 235.6005,
      color: 0x8f8a9a, size: 0.34,
      facts: { diameter: '434 km', period: '5.57 years', moons: '0',
        fun: 'The fourth-largest asteroid-belt body, with an almost spherical, potato-like shape.' } },
    { name: 'Pluto',
      a: 39.1509636, e: 0.244823, i: 16.9558, Omega: 110.1433, w: 112.5481,
      M0: 55.158, n: 0.004023374, varpi: 222.6914,
      color: 0xc9b8a8, size: 0.5,
      facts: { diameter: '2,377 km', period: '248 years', moons: '5',
        fun: 'Reclassified as a dwarf planet in 2006, it still owns the most famous name in the Kuiper belt.' } },
    { name: 'Eris',
      a: 67.913718, e: 0.43861, i: 43.9458, Omega: 35.997, w: 150.8253,
      M0: 211.887, n: 0.001761034, varpi: 186.8223,
      color: 0xd8d8e8, size: 0.52,
      facts: { diameter: '2,326 km', period: '558 years', moons: '1',
        fun: 'Its discovery — brighter than Pluto — sparked the debate that ended with the word \u201cdwarf planet\u201d.' } },
    { name: 'Haumea',
      a: 43.0827122, e: 0.193996, i: 28.2085, Omega: 121.7867, w: 240.5748,
      M0: 223.621, n: 0.003485375, varpi: 2.3615,
      color: 0xd8e8e0, size: 0.44,
      facts: { diameter: '~1,560 km', period: '285 years', moons: '2',
        fun: 'Spins once every four hours, stretched into an egg shape — and it has a ring.' } },
    { name: 'Makemake',
      a: 45.5890218, e: 0.158416, i: 29.0257, Omega: 79.3073, w: 297.0665,
      M0: 170.231, n: 0.003201943, varpi: 16.3738,
      color: 0xc8a8a8, size: 0.42,
      facts: { diameter: '1,430 km', period: '306 years', moons: '1',
        fun: 'One of the few colored dwarf planets, tinted deep red by ancient frozen tholins.' } },
    { name: 'Ixion',
      a: 39.3508975, e: 0.243369, i: 19.6591, Omega: 71.0755, w: 300.5802,
      M0: 295.32, n: 0.00399275, varpi: 11.6556,
      color: 0x96785f, size: 0.4,
      facts: { diameter: '~1,055 km', period: '247 years', moons: '0',
        fun: 'A 2:3-resonant \u201cplutino\u201d like Pluto, found by the Deep Ecliptic Survey in 2001 — and a likely dwarf planet.' } }
  ],

  /* Major moons of the (new) planet set — solar-system mode only.
   * aKm/aAu: parent-centric orbit; display positions use the true
   * direction with an exaggerated distance (see solar.js). */
  moons: [
    { name: 'Io', parent: 'Jupiter',
      e: 0.004785, i: 2.2126, Omega: 336.8524, w: 65.7788, M0: 162.016,
      n: 203.198447, varpi: 42.6312, aKm: 422069, aAu: 0.0028214,
      color: 0xd8c25a, size: 0.10, dist: 3.2,
      facts: { diameter: '3,643 km', period: '1.77 days',
        fun: 'The most volcanically active body in the Solar System — its eruptions are fed by Jupiter\u2019s tides.' } },
    { name: 'Europa', parent: 'Jupiter',
      e: 0.009866, i: 1.791, Omega: 332.6287, w: 254.5662, M0: 101.2,
      n: 101.30578227, varpi: 227.1949, aKm: 671286, aAu: 0.0044873,
      color: 0xc8d4dc, size: 0.09, dist: 3.8,
      facts: { diameter: '3,122 km', period: '3.55 days',
        fun: 'A global ocean of liquid water is believed to lie beneath its cracked ice shell.' } },
    { name: 'Ganymede', parent: 'Jupiter',
      e: 0.001532, i: 2.2142, Omega: 343.1726, w: 315.5266, M0: 107.843,
      n: 50.296417151, varpi: 298.6992, aKm: 1070629, aAu: 0.0071567,
      color: 0xb0a898, size: 0.13, dist: 4.4,
      facts: { diameter: '5,268 km', period: '7.15 days',
        fun: 'The largest moon in the Solar System — bigger than the planet Mercury.' } },
    { name: 'Callisto', parent: 'Jupiter',
      e: 0.007447, i: 2.0169, Omega: 337.9426, w: 16.7848, M0: 201.046,
      n: 21.564652363, varpi: 354.7274, aKm: 1882935, aAu: 0.0125866,
      color: 0x8f867d, size: 0.12, dist: 5.0,
      facts: { diameter: '4,821 km', period: '16.7 days',
        fun: 'Heavily cratered — one of the oldest surfaces known in the Solar System.' } },
    { name: 'Phobos', parent: 'Mars',
      e: 0.01467, i: 26.0567, Omega: 84.8151, w: 342.766, M0: 55.005,
      n: 1127.897428956, varpi: 67.5811, aKm: 9379, aAu: 0.0000627,
      color: 0x8a7f72, size: 0.07, dist: 0.85,
      facts: { diameter: '22.5 km', period: '7.7 hours',
        fun: 'Spirals slowly toward Mars; tides will shred it into a ring in ~50 million years.' } },
    { name: 'Deimos', parent: 'Mars',
      e: 0.000359, i: 27.5694, Omega: 83.6693, w: 212.3066, M0: 231.747,
      n: 285.12498098, varpi: 295.9758, aKm: 23459, aAu: 0.0001568,
      color: 0x7d7468, size: 0.06, dist: 1.1,
      facts: { diameter: '12.4 km', period: '30.3 hours',
        fun: 'So small and dim that from the surface of Mars it would look like a bright star.' } },
    { name: 'Titan', parent: 'Saturn',
      e: 0.027692, i: 27.7183, Omega: 169.2393, w: 164.9611, M0: 339.247,
      n: 22.531974053, varpi: 334.2003, aKm: 1223356, aAu: 0.0081776,
      color: 0xd8a86a, size: 0.12, dist: 6.0,
      facts: { diameter: '5,150 km', period: '15.9 days',
        fun: 'The only moon with a dense atmosphere — rain, rivers and seas of liquid methane.' } },
    { name: 'Rhea', parent: 'Saturn',
      e: 0.000635, i: 28.2413, Omega: 168.9842, w: 105.4207, M0: 155.181,
      n: 79.507897759, varpi: 274.4048, aKm: 527811, aAu: 0.0035282,
      color: 0xc8c8c8, size: 0.08, dist: 5.2,
      facts: { diameter: '1,527 km', period: '4.52 days',
        fun: 'Almost entirely water ice, wrapped in its own faint, dusty ring.' } },
    { name: 'Iapetus', parent: 'Saturn',
      e: 0.027834, i: 17.2382, Omega: 139.6918, w: 229.6286, M0: 78.34,
      n: 4.533815213, varpi: 9.3204, aKm: 3562676, aAu: 0.023815,
      color: 0xa8988a, size: 0.1, dist: 6.9,
      facts: { diameter: '1,471 km', period: '79.3 days',
        fun: 'Half brilliant white, half almost black — NASA nicknamed it the \u201cYin-Yang moon\u201d.' } },
    { name: 'Triton', parent: 'Neptune',
      e: 0.000916, i: 130.2677, Omega: 215.8568, w: 79.9943, M0: 66.462,
      n: 61.153401406, varpi: 295.8511, aKm: 355155, aAu: 0.0023741,
      color: 0xc8d0d8, size: 0.11, dist: 1.9,
      facts: { diameter: '2,707 km', period: '5.88 days (retrograde)',
        fun: 'Orbits Neptune backwards — almost certainly a Kuiper-belt object captured billions of years ago.' } },
    { name: 'Charon', parent: 'Pluto',
      e: 0.000205, i: 112.8878, Omega: 222.6069, w: 174.2028, M0: 5.371,
      n: 56.357506477, varpi: 36.8097, aKm: 19597, aAu: 0.000131,
      color: 0xa09890, size: 0.16, dist: 0.9,
      facts: { diameter: '1,212 km', period: '6.39 days',
        fun: 'So large compared to Pluto that the two bodies orbit a point in empty space between them.' } }
  ]
};
