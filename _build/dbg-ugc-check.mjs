import fs from 'node:fs';
import { PRECESSION_B1950_TO_J2000 as PR } from './precession.mjs';
const d = fs.readFileSync(new URL('./ugc-vii26d.xml', import.meta.url), 'utf8');
const rows = d.match(/<TR>[\s\S]*?<\/TR>/g) || [];
const cells = tr => { const c = []; const re = /<TD([^>]*?)(\/>|>)/g; let m; while ((m = re.exec(tr))) { const s = m.index + m[0].length; const e = tr.indexOf('</TD>', s); c.push(tr.slice(s, e).replace(/<[^>]+>/g, '').trim()); } return c; };
const DEG = Math.PI / 180;
const rot = (M, v) => [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2], M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2], M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
const eq2u = (ra, d) => { const a = ra * DEG, dc = d * DEG; return [Math.cos(dc) * Math.cos(a), Math.cos(dc) * Math.sin(a), Math.sin(dc)]; };
const u2eq = v => { let ra = Math.atan2(v[1], v[0]) / DEG; if (ra < 0) ra += 360; return [ra, Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG]; };
const toJ2000 = (raB, dB) => u2eq(rot(PR, eq2u(raB, dB)));
const parseRA = s => { const t = s.split(/\s+/).map(Number); return t.length === 2 ? (t[0] + t[1] / 60) * 15 : (t[0] + t[1] / 60 + t[2] / 3600) * 15; };
const parseDEC = s => { const neg = s.startsWith('-'); const t = s.replace(/^[+-]/, '').split(/\s+/).map(Number); return (neg ? -1 : 1) * ((t[0] || 0) + (t[1] || 0) / 60 + (t[2] || 0) / 3600); };
const hms = deg => { let h = Math.floor(deg / 15), m = Math.floor((deg * 4) % 60), s = ((deg * 240) % 60).toFixed(1); return `${h}h ${m}m ${s}s`; };
const dm = deg => { const d = Math.floor(Math.abs(deg)), m = (Math.abs(deg) - d) * 60; return `${deg < 0 ? '-' : '+'}${d}d ${m.toFixed(1)}'`; };

for (const ugcNum of ['4549', '270', '1176', '925']) {
  for (const tr of rows) {
    const r = cells(tr);
    if ((r[1] || '').trim() === ugcNum) {
      const raB = parseRA(r[3]), dB = parseDEC(r[4]);
      const [ra2, d2] = toJ2000(raB, dB);
      console.log(`UGC ${ugcNum}: B1950 (${hms(raB)}, ${dm(dB)}) -> J2000 (${hms(ra2)}, ${dm(d2)})  hubble=${r[8] || ''} pmag=${r[9] || ''} size=${r[6] || ''}`);
      break;
    }
  }
}
console.log('\nexpected J2000: UGC 4549 (M44 Beehive): 06h41m37s +16d43\'13" | UGC 270 (M31): 00h42m44s +41d16\'09" | UGC 1176 (M33): 01h33m51s +30d39\'37"');
