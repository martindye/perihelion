/* ============================================================================
 * PERIHELION — journey scenarios (DATA)
 * A scenario is a named list of legs; a leg is a normal journey (from/to/
 * preset) plus a label, a story distance in light-years (ly — used for the
 * mission clock when the scene path is just a straight line) and the ships
 * that fly it. The engine (P.journey.launchScenario) plays the legs back-to-
 * back; the camera "cuts" between them the way a film would.
 *
 * Scenarios are data, not logic: this file only feeds them to the app.
 * More can be loaded at runtime as JSON (JOURNEY drawer → SCENARIOS → LOAD),
 * and any of them can be saved back out again (⬇ button).
 * ==========================================================================*/
'use strict';
window.P = window.P || {};
P.scenarios = [
  {
    id: 'hail-mary-homecoming',
    name: 'Hail Mary: Homecoming',
    blurb: 'Movie re-enactment — homebound from Tau Ceti, the Hail Mary turns back to save Rocky, and the two ships fly on to Erid, home of the Eridians (40 Eridani).',
    legs: [
      {
        label: 'HOMEBOUND — course for Earth',
        preset: 'hmary',
        from: { type: 'star', name: 'Tau Ceti', ra: 26.0214, dec: -15.9396, distPc: 3.6502, bv: 1.35 },
        to: { type: 'waypoint', name: 'Turnaround point', x: 2333, y: -741.5, z: -1139 },
        ly: 4.8,
        ships: ['hmary']
      },
      {
        label: 'THE TURNAROUND — Rocky\u2019s ship is dying',
        preset: 'hmary',
        from: { type: 'waypoint', name: 'Turnaround point', x: 2333, y: -741.5, z: -1139 },
        to: { type: 'waypoint', name: 'Rendezvous with Blip-A', x: 3785.6, y: -872.4, z: -2159.9 },
        ly: 3.5,
        ships: ['hmary']
      },
      {
        label: 'ERID — home of the Eridians',
        preset: 'hmary',
        from: { type: 'waypoint', name: 'Rendezvous with Blip-A', x: 3785.6, y: -872.4, z: -2159.9 },
        to: { type: 'star', name: '40 Eridani A', ra: 38.0, dec: -0.311, distPc: 4.86, bv: 0.90 },
        ly: 7.0,
        ships: ['hmary', 'blipa']
      }
    ]
  }
];
