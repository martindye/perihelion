import fs from 'node:fs';
const s = fs.readFileSync(new URL('../js/planets-textures.js', import.meta.url), 'utf8');
const m = s.match(/saturnRings: "data:image\/png;base64,([A-Za-z0-9+/=]*)/);
console.log('key present:', !!m, m ? '(b64 len ' + m[1].length + ')' : '');
const embedded = m ? Buffer.from(m[1], 'base64') : null;
const file = fs.readFileSync(new URL('../textures/saturn-rings.png', import.meta.url));
console.log('roundtrip identical to textures/saturn-rings.png:', !!embedded && embedded.equals(file));
console.log('file size KB:', (fs.statSync(new URL('../js/planets-textures.js', import.meta.url)).size / 1024).toFixed(0));
