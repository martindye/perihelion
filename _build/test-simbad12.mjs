const qid = 'M+8';
const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + qid);
const t = await r.text();
console.log('len:', t.length);
function parseSimbad(t) {
  const i = t.indexOf('(ep=J2000)');
  if (i < 0) return 'NO-I';
  const segRaw = t.slice(i, i + 2500);
  const seg = segRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const m = seg.match(/(\d{1,2})\s+(\d{2})\s+([\d.]+)\s+([+-])\s*(\d{2})\s+(\d{2})\s+([\d.]+)/);
  if (!m) return 'NO-MATCH: ' + JSON.stringify(seg.slice(0, 220));
  return ['MATCH', m.slice(1), seg.slice(0, 160)];
}
console.log(JSON.stringify(parseSimbad(t)));
