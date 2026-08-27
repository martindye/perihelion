'use strict';
global.window = global;
require('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/js/data.js');
const P = global.P;
const catalogList = P.planets.map(p => ({ kind: 'body', body: p.name, name: p.name }))
  .concat(P.stars.map(s => ({ kind: 'star', star: { mag: s[3], dist: s[5] }, name: s[0] })));
function catalogSearch(qRaw) {
  const nq = String(qRaw || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!nq) return catalogList;
  const res = [];
  for (const c of catalogList) {
    const n = c.name.toLowerCase().replace(/\s+/g, '');
    const sc = n === nq ? 0 : n.indexOf(nq) === 0 ? 1 : n.indexOf(nq) >= 0 ? 2 : -1;
    if (sc >= 0) res.push([sc, c]);
  }
  res.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
  return res.slice(0, 150).map(r => r[1]);
}
const show = r => r.map(c => c.name).join(', ');
console.log('total entries:', catalogList.length);
console.log('sir   ->', show(catalogSearch('sir')));
console.log('rigil ->', show(catalogSearch('rigil')));
console.log('mars  ->', show(catalogSearch('mars')));
console.log('vega  ->', show(catalogSearch('vega')));
console.log('bete  ->', show(catalogSearch('bete')));
console.log('zenith->', show(catalogSearch('zenith')));
console.log('x     ->', catalogSearch('x').length, 'entries');
console.log('zzz   ->', catalogSearch('zzz').length, 'entries');
console.log('empty ->', catalogSearch('').length, 'entries');
