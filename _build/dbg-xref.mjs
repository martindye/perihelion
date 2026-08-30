import fs from 'node:fs';
const P = { dso: [] };
const src = fs.readFileSync('C:/Users/press/OneDrive/Projects/DSH_TESTS/planetarium/js/dso2.js', 'utf8');
new Function('P', src)(P);
for (const id of ['M10', 'M44', 'M11', 'M4', 'M7', 'M15', 'M16', 'M17', 'M22', 'M27', 'M2', 'M9', 'M12', 'M13']) {
  const r = P.dso2.find(x => x[0] === id);
  console.log(r ? [id, r[1].toFixed(4), r[2].toFixed(4), r[11]].join('  ') : id + '  (not in dso2)');
}
