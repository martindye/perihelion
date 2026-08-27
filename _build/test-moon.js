'use strict';
global.window = global;
global.THREE = { Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } } };
require('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/js/data.js');
require('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/js/astro.js');
const A = P.astro;
const V3 = global.THREE.Vector3;

// 1. Moon must RETURN to ~same ecliptic longitude after one sidereal month
const m0 = A.moonEcl(0, new V3());
const m1 = A.moonEcl(27.321661, new V3());
const lam0 = Math.atan2(m0.y, m0.x) * 180 / Math.PI;
let dLam = Math.atan2(m1.y, m1.x) * 180 / Math.PI - lam0;
if (dLam > 180) dLam -= 360;
if (dLam < -180) dLam += 360;
console.log('lambda(0)      =', lam0.toFixed(3), 'deg');
console.log('delta over 27.321661 d =', dLam.toFixed(4), 'deg (expect ~0, within 2)');

// 2. daily motion should be 10..16 deg/day (mean 13.18, varies with anomaly)
const a = A.moonEcl(0, new V3());
const b = A.moonEcl(1, new V3());
let dl = Math.atan2(b.y, b.x) * 180 / Math.PI - Math.atan2(a.y, a.x) * 180 / Math.PI;
if (dl < 0) dl += 360;
if (dl > 180) dl -= 360;
console.log('delta over 1 day =', dl.toFixed(4), 'deg (expect 10..16)');

// 3. Sun self-test values
const ok = A.selfTest(P.planets, V3);
console.log('selfTest:', ok ? 'PASS' : 'FAIL');
