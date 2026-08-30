const id = 'NGC 1261';
const qid = encodeURIComponent(id.replace(/^M (\d+)$/, 'M+$1').replace(/ /g, '+'));
console.log('qid:', qid);
const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + qid);
const t = await r.text();
console.log('len:', t.length);
const i = t.indexOf('(ep=J2000)');
console.log('ep=J2000 idx:', i);
if (i >= 0) {
  const seg = t.slice(i, i + 1600);
  const m = seg.match(/(\d{1,2})\s+(\d{2})\s+([\d.]+)\s+([+-])\s*(\d{2})\s+(\d{2})\s+([\d.]+)/);
  console.log('coord match:', m ? m.slice(1, 8).join(' ') : 'NO');
  console.log('seg head:', JSON.stringify(seg.slice(0, 300)));
} else {
  console.log(t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500));
}
