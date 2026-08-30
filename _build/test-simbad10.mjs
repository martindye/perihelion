for (const qid of ['M+8', 'NGC+6169']) {
  const r = await fetch('https://simbad.u-strasbg.fr/simbad/sim-id?Ident=' + qid);
  const t = await r.text();
  console.log('=== ' + qid + ' len=' + t.length);
  const i = t.indexOf('(ep=J2000)');
  console.log('has J2000 block:', i >= 0);
  const plain = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const j = plain.search(/M 8|NGC 6169|M8\b/);
  console.log(plain.slice(0, 400));
  console.log('---');
  await new Promise(s => setTimeout(s, 1500));
}
