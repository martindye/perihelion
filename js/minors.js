/* ============================================================================
 * PERIHELION — minor planets & major moons (js/minors.js)
 *
 * Osculating Keplerian elements at
 *     T0 = 2026-08-30T12:00TDB  (JD 2461283.0 = 9738.0 days after J2000.0)
 * Source: JPL Horizons web service, DE440-class ephemerides, fetched
 * 2026-08-30 (planets via cmd <name>/999, moons via <parent><sat> commands);
 * each element set round-trips its fetch-time position to < 3e-4 AU.
 *
 * Osculating elements are exact at T0 and drift on timescales of months to
 * years — plenty for a display ephemeris, exactly like the J2000 mean
 * elements used for the eight planets.
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
        fun: 'One of the few colored dwarf planets, tinted deep red by ancient frozen tholins.' } }
  ],

  /* Major moons of the (new) planet set — solar-system mode only.
   * aKm/aAu: parent-centric orbit; display positions use the true
   * direction with an exaggerated distance (see solar.js). */
  moons: [
    { name: 'Io', parent: 'Jupiter',
      e: 0.004024, i: 2.2252, Omega: 338.4313, w: 76.0208, M0: 99.202,
      n: 203.219427192, varpi: 54.4521, aKm: 422046, aAu: 0.0028212,
      color: 0xd8c25a, size: 0.10, dist: 3.2,
      facts: { diameter: '3,643 km', period: '1.77 days',
        fun: 'The most volcanically active body in the Solar System — its eruptions are fed by Jupiter\u2019s tides.' } },
    { name: 'Europa', parent: 'Jupiter',
      e: 0.009544, i: 2.0867, Omega: 326.1574, w: 261.0802, M0: 52.443,
      n: 101.317601329, varpi: 227.2376, aKm: 671246, aAu: 0.004487,
      color: 0xc8d4dc, size: 0.09, dist: 3.8,
      facts: { diameter: '3,122 km', period: '3.55 days',
        fun: 'A global ocean of liquid water is believed to lie beneath its cracked ice shell.' } },
    { name: 'Ganymede', parent: 'Jupiter',
      e: 0.002366, i: 2.343, Omega: 339.0867, w: 1.2376, M0: 272.56,
      n: 50.282758317, varpi: 340.3243, aKm: 1070837, aAu: 0.0071581,
      color: 0xb0a898, size: 0.13, dist: 4.4,
      facts: { diameter: '5,268 km', period: '7.15 days',
        fun: 'The largest moon in the Solar System — bigger than the planet Mercury.' } },
    { name: 'Callisto', parent: 'Jupiter',
      e: 0.007004, i: 1.9525, Omega: 336.7371, w: 30.7857, M0: 250.746,
      n: 21.551391917, varpi: 7.5228, aKm: 1883721, aAu: 0.0125919,
      color: 0x8f867d, size: 0.12, dist: 5.0,
      facts: { diameter: '4,821 km', period: '16.7 days',
        fun: 'Heavily cratered — one of the oldest surfaces known in the Solar System.' } },
    { name: 'Phobos', parent: 'Mars',
      e: 0.015496, i: 25.738, Omega: 81.8032, w: 263.7085, M0: 2.738,
      n: 1127.804627617, varpi: 345.5117, aKm: 9380, aAu: 0.0000627,
      color: 0x8a7f72, size: 0.07, dist: 0.85,
      facts: { diameter: '22.5 km', period: '7.7 hours',
        fun: 'Spirals slowly toward Mars; tides will shred it into a ring in ~50 million years.' } },
    { name: 'Deimos', parent: 'Mars',
      e: 0.000335, i: 24.1275, Omega: 81.4613, w: 47.2445, M0: 38.297,
      n: 285.1427184, varpi: 128.7058, aKm: 23457, aAu: 0.0001568,
      color: 0x7d7468, size: 0.06, dist: 1.1,
      facts: { diameter: '12.4 km', period: '30.3 hours',
        fun: 'So small and dim that from the surface of Mars it would look like a bright star.' } },
    { name: 'Titan', parent: 'Saturn',
      e: 0.028971, i: 27.7061, Omega: 169.0803, w: 178.8018, M0: 43.786,
      n: 22.562168231, varpi: 347.8822, aKm: 1222274, aAu: 0.0081704,
      color: 0xd8a86a, size: 0.12, dist: 6.0,
      facts: { diameter: '5,150 km', period: '15.9 days',
        fun: 'The only moon with a dense atmosphere — rain, rivers and seas of liquid methane.' } },
    { name: 'Rhea', parent: 'Saturn',
      e: 0.001321, i: 28.2698, Omega: 169.9784, w: 187.2808, M0: 46.196,
      n: 79.629458775, varpi: 357.2592, aKm: 527273, aAu: 0.0035246,
      color: 0xc8c8c8, size: 0.08, dist: 5.2,
      facts: { diameter: '1,527 km', period: '4.52 days',
        fun: 'Almost entirely water ice, wrapped in its own faint, dusty ring.' } },
    { name: 'Iapetus', parent: 'Saturn',
      e: 0.029015, i: 16.9743, Omega: 138.8737, w: 232.5682, M0: 116.464,
      n: 4.536942333, varpi: 11.4419, aKm: 3561073, aAu: 0.0238043,
      color: 0xa8988a, size: 0.1, dist: 6.9,
      facts: { diameter: '1,471 km', period: '79.3 days',
        fun: 'Half brilliant white, half almost black — NASA nicknamed it the \u201cYin-Yang moon\u201d.' } },
    { name: 'Triton', parent: 'Neptune',
      e: 0.000345, i: 129.13, Omega: 222.8363, w: 92.9264, M0: 350.486,
      n: 61.229602535, varpi: 315.7627, aKm: 354846, aAu: 0.002372,
      color: 0xc8d0d8, size: 0.11, dist: 1.9,
      facts: { diameter: '2,707 km', period: '5.88 days (retrograde)',
        fun: 'Orbits Neptune backwards — almost certainly a Kuiper-belt object captured billions of years ago.' } },
    { name: 'Charon', parent: 'Pluto',
      e: 0.000205, i: 112.8878, Omega: 227.3931, w: 174.2028, M0: 5.371,
      n: 56.357506477, varpi: 41.5959, aKm: 19597, aAu: 0.000131,
      color: 0xa09890, size: 0.16, dist: 0.9,
      facts: { diameter: '1,212 km', period: '6.39 days',
        fun: 'So large compared to Pluto that the two bodies orbit a point in empty space between them.' } }
  ]
};
