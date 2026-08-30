for (const t of ['Theta_Tauri', 'Merga_(star)']) {
  try {
    const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/html/' + t);
    const txt = await r.text();
    const i = txt.search(/Right ascension/i);
    const j = txt.indexOf('Declination');
    console.log(t, 'status', r.status, 'len', txt.length, 'RA@', i, 'Dec@', j);
    if (i > 0) {
      const seg = txt.slice(i, i + 2200);
      const ra = seg.match(/(\d{1,2})h\s*(\d{2})m\s*([\d.]+)s/);
      const dk = txt.indexOf('Declination');
      const seg2 = txt.slice(dk, dk + 700);
      const dc = seg2.match(/([+-]?)\s*(\d{1,2})\s*&#176;|([+-]?)\s*(\d{1,2})°/);
      const mag = seg.match(/Apparent magnitude[\s\S]{0,200}?(\d\.\d+)/);
      console.log('  RA:', ra && ra[0], 'DEC-raw:', dc && dc[0], 'V:', mag && mag[1]);
    }
  } catch (e) { console.log(t, 'ERR', e.message); }
}
