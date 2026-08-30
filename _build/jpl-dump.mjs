const r = await fetch('https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=Ceres');
const j = await r.json();
console.log('top keys:', Object.keys(j));
console.log('orbit keys:', Object.keys(j.orbit));
console.log(JSON.stringify(j.orbit, null, 1).slice(0, 1500));
