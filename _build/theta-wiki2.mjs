const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/html/Theta_Tauri');
const txt = await r.text();
const i = txt.search(/Right ascension/i);
const seg = txt.slice(i, i + 3000);
const plain = seg.replace(/<[^>]+>/g, ' ').replace(/&#160;|&nbsp;/g, ' ').replace(/\s+/g, ' ');
console.log(plain.slice(0, 700));
