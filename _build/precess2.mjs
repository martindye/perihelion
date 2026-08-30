// Derive B1950->J2000 precession from IAU 1976 angles and pick the correct rotation ordering.
const DEG = Math.PI / 180;
// IAU 1976 precession for interval t centuries (here t = +0.5, 1950->2000)
const t = 0.5;
const arc2rad = s => s / 3600 * DEG;
const zeta = arc2rad(2306.2137 * t + 0.301883 * t * t + 0.017998 * t ** 3);
const zA   = arc2rad(2306.2137 * t - 0.301883 * t * t - 0.017998 * t ** 3);
const theta= arc2rad(2004.3109 * t + 0.452290 * t * t - 0.018273 * t ** 3);
console.log('angles(deg):', (zeta/DEG).toFixed(6), (zA/DEG).toFixed(6), (theta/DEG).toFixed(6));

const Rz = a => [[Math.cos(a), -Math.sin(a), 0],[Math.sin(a), Math.cos(a), 0],[0,0,1]];
const Rx = a => [[1,0,0],[0, Math.cos(a), -Math.sin(a)],[0, Math.sin(a), Math.cos(a)]];
const mul = (A,B)=>A.map((r,i)=>B[0].map((_,j)=>A[0].reduce((s,_,k)=>s+A[k][0]*B[k===j?0:0][j]*0 + (function(){let s2=0;for(let k=0;k<3;k++)s2+=A[k][i]*B[k][j];return s2;})(),0)));
// (correct matmul)
function mm(A,B){const C=[];for(let i=0;i<3;i++){C[i]=[];for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i][k]*B[k][j];C[i][j]=s;}}return C;}
const rot = (M,v)=>[M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2], M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2], M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
const eq2u=(ra,d)=>{const a=ra*DEG,dc=d*DEG;return[Math.cos(dc)*Math.cos(a),Math.cos(dc)*Math.sin(a),Math.sin(dc)];};
const u2eq=v=>[Math.atan2(v[1],v[0])/DEG, Math.asin(Math.max(-1,Math.min(1,v[2])))/DEG];
let u2ra=x=>{let r=x[0]/DEG;if(r<0)r+=360;return r;};

const cands = {
  'Rz(zA) Rx(th) Rz(ze)': mm(mm(Rz(zA),Rx(theta)),Rz(zeta)),
  'Rz(ze) Rx(th) Rz(zA)': mm(mm(Rz(zeta),Rx(theta)),Rz(zA)),
  'Rz(-zA) Rx(-th) Rz(-ze)': mm(mm(Rz(-zA),Rx(-theta)),Rz(-zeta)),
  'Rz(-ze) Rx(-th) Rz(-zA)': mm(mm(Rz(-zeta),Rx(-theta)),Rz(-zA)),
  'Rz(ze) Rx(th) Rz(zA)': mm(mm(Rz(zeta),Rx(theta)),Rz(zA)),
  'Rz(-zA) Rx(th) Rz(ze)': mm(mm(Rz(-zA),Rx(theta)),Rz(zeta)),
};
const HMS=(h,m,s)=>(h+m/60+s/3600)*15;
const HMSd=s=>(s[0]<0?-1:1)*(Math.abs(s[1])+s[2]/60+(s[3]||0)/3600);
const tests=[['M31',[HMS(0,42,38.9),HMSd([1,41,16,20])],[HMS(0,42,44.3),HMSd([1,41,16,9])]],
 ['M42',[HMS(5,34,55.9),HMSd([0,0,50,42])],[HMS(5,35,17.3),HMSd([0,5,23,28])]],
 ['M33',[HMS(1,33,14.2),HMSd([1,30,39,22])],[HMS(1,33,50.9),HMSd([1,30,39,37])]],
 ['NGC253',[HMS(0,47,33.0),HMSd([0,25,17,27])],[HMS(0,48,23.0),HMSd([0,25,6,56])]]];
for (const [name,M] of Object.entries(cands)) {
  let tot=0;
  for (const [n,[rb,db],[rt,dt]] of tests){let [ra2,de2]=u2eq(rot(M,eq2u(rb,db)));ra2=u2ra(ra2);
    let dra=(ra2-rt)*3600*Math.cos(de2*DEG); if(dra>10800)dra-=21600; if(dra<-10800)dra+=21600;
    const dde=(de2-dt)*3600; tot+=Math.abs(dra)+Math.abs(dde);}
  console.log(name.padEnd(26), 'sum|resid| =', tot.toFixed(3), 'arcsec');
}
