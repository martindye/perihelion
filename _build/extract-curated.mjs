// Extract the curated bright set (source of truth) from the current js/dso.js
// into _build/curated-58.json so the big-catalog build has a stable input that
// is NOT overwritten by its own output.
import fs from 'node:fs';
const D = new URL('./', import.meta.url);
const dsoSrc = fs.readFileSync(new URL('../js/dso.js', D), 'utf8');
const arrText = dsoSrc.slice(dsoSrc.indexOf('['), dsoSrc.lastIndexOf(']') + 1);
const arr = new Function('return (' + arrText + ');')();
console.log('curated rows:', arr.length);
// sanity: M82 must now be at the corrected J2000 position
const m82 = arr.find(r => r[0] === 'M82');
console.log('M82 ->', m82 && m82[1].toFixed(4), m82 && m82[2].toFixed(4));
fs.writeFileSync(new URL('./curated-58.json', D), JSON.stringify(arr));
console.log('wrote curated-58.json');
