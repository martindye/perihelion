const sleep = ms => new Promise(s => setTimeout(s, ms));
function parse(t) {
  const i = t.indexOf('(ep=J2000)');
  if (i < 0) return null;
  const seg = t.slice(i, i + 1600);
  const m = seg.match(/(\d{1,2})\s+(\d{2})\s+([\d.]+)\s+([+-])\s*(\d{2})\s+(\d{2})\s+([\d.]+)/);
  if (!m) return null;
  return { ra: +( (+m[1])*15 + (+m[2])/4 + (+m[3])/240 ).toFixed(5), dec: +((m[4]==='-'?-1:1)*(+m[5]+(+m[6])/60+(+m[7])/3600)).toFixed(5) };
}
for (const q of ['TH+Tauri', 'H Tauri']) {
  let val = null;
  for (let a = 0; a < 2 && !val; a++) {
    try { const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + q); const t = await r.text(); if (t.length >= 20000) val = parse(t); } catch (e) {}
    if (!val) await sleep(1200);
  }
  console.log(q, '=>', JSON.stringify(val));
  await sleep(1100);
}
