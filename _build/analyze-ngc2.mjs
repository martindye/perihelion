import fs from 'node:fs';
const d = fs.readFileSync(new URL('./ngc-vii118.xml', import.meta.url), 'utf8');
const rows = d.match(/<TR>([\s\S]*?)<\/TR>/g) || [];
const R = rows.map(tr => (tr.replace(/<\/?TR>/g, '').match(/<TD>([\s\S]*?)<\/TD>/g) || []).map(td => td.replace(/<\/?TD>/g, '').trim()));

const isGal = t => /^G[xb]$/i.test(t || '');
const A = { ngcGal: 0, ngcOther: 0, restGalI: 0, restGalOther: 0, restNamed: [] };
const messierSeen = new Set();
for (let i = 0; i < R.length; i++) {
  const r = R[i];
  if (!r || r.length < 7) continue;
  const recno = parseInt(r[0], 10);
  const name = (r[1] || '').replace(/\s+/g, '');
  const type = r[2];
  const isNGC = recno <= 7840;
  if (isNGC) {
    if (isGal(type)) A.ngcGal++; else A.ngcOther++;
    if (/^M\d{1,3}$/.test(name)) messierSeen.add(name);
  } else {
    if (/^I\d{1,5}$/.test(name)) {
      if (isGal(type)) A.restGalI++;
    } else if (isGal(type)) A.restGalOther++;
  }
}
console.log(A);
console.log('messier cross-refs seen in NGC range:', messierSeen.size, [...messierSeen].slice(0, 15).join(' '));
/* how do the 'rest' galaxies' names look? */
const samples = [];
for (let i = 7840; i < R.length && samples.length < 12; i++) {
  const r = R[i];
  if (r && isGal(r[2]) && !/^I\d{1,5}$/.test((r[1] || '').replace(/\s+/g, ''))) samples.push([r[0], r[1], r[2], r[3], r[4]]);
}
console.log('rest-galaxy name samples (recno, name, type, ra, dec):');
samples.forEach(s => console.log('  ', s.join(' | ')));
