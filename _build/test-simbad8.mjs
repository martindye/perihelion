const ids = ['M+33', 'M+1', 'NGC+2424', 'M+102'];
for (const qid of ids) {
  const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + qid);
  const t = await r.text();
  let val = null;
  const i = t.indexOf('(ep=J2000)');
  if (i >= 0) {
    const seg = t.slice(i, i + 1600);
    const m = seg.match(/(\d{1,2})\s+(\d{2})\s+([\d.]+)\s+([+-])\s*(\d{2})\s+(\d{2})\s+([\d.]+)/);
    if (m) {
      const ra = (+m[1]) * 15 + (+m[2]) / 4 + (+m[3]) / 240;
      const dec = (m[4] === '-' ? -1 : 1) * (+m[5] + (+m[6]) / 60 + (+m[7]) / 3600);
      const qm = seg.match(/quality flag \(A->E\)">\s*([A-G])\s*</);
      const bm = seg.match(/class="bibcode">\s*<A [^>]*>([^<]+)</);
      val = { ra: +ra.toFixed(6), dec: +dec.toFixed(6), q: qm ? qm[1] : null, bib: bm ? bm[1].trim() : null };
    }
  }
  console.log(qid, JSON.stringify(val));
  await new Promise(s => setTimeout(s, 1200));
}
