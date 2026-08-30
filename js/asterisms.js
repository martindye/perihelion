/* ============================================================================
 * PERIHELION — asterisms (js/asterisms.js)
 * Classic multi-constellation star figures, drawn as a distinct overlay.
 * Vertex = a name in P.stars, or an explicit [ra, dec] pair for unnamed
 * catalog points. Provenance: star positions as in data.js; the unnamed
 * Keystone/CrB vertices are Hipparcos catalog points (ESA SP-1200); the
 * Sagittarius (Teapot) and Ursa Minor vertices were cross-checked against
 * published J2000 coordinates (SIMBAD/Wikipedia) in August 2026.
 * ==========================================================================*/
'use strict';
window.P = window.P || {};

P.asterisms = [
  {
    name: 'Summer Triangle',
    lines: [['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega']]
  },
  {
    name: 'Big Dipper',
    lines: [
      ['Merak', 'Dubhe'], ['Dubhe', 'Megrez'], ['Megrez', 'Phecda'], ['Phecda', 'Merak'],
      ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid']
    ]
  },
  {
    name: 'Little Dipper',
    lines: [['Pherkad', 'Kochab'], ['Kochab', 'Yildun'], ['Yildun', 'Polaris']]
  },
  {
    name: 'Teapot of Sagittarius',
    lines: [
      ['Alnasl', 'Aspidiske'], ['Aspidiske', 'Kaus Australis'],
      ['Kaus Australis', 'Kaus Borealis'], ['Kaus Borealis', 'Nunki'],
      ['Nunki', 'Ascella']
    ]
  },
  {
    name: 'Keystone of Hercules',
    lines: [
      ['Kornephoros', [250.323, 31.602]],
      [[250.323, 31.602], [255.073, 30.926]],
      [[255.073, 30.926], 'Sarin'],
      ['Sarin', 'Kornephoros']
    ]
  },
  {
    name: 'Northern Crown',
    lines: [
      ['Alphecca', [269.441, 29.248]],
      [[269.441, 29.248], [271.886, 28.762]],
      [[271.886, 28.762], [282.520, 33.363]]
    ]
  }
];
