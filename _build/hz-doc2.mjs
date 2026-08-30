const r = await fetch('https://ssd-api.jpl.nasa.gov/doc/horizons.html');
const t = await r.text();
const txt = t.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
/* VECTORS section: show a wider window around key terms */
const show = (kw, before, after) => { const i = txt.indexOf(kw); if (i >= 0) console.log(`\n### ${kw}:\n${txt.slice(Math.max(0, i - before), i + after)}`); };
show('VECTORS', 0, 400);
show('REF_PLANE', 100, 300);
show('x,y,z', 100, 300);
show('AU/day', 100, 200);
/* Also print the table of vectors quantities if present */
show('1,2,3,4,5,6', 50, 400);
