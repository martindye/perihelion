async function hz(params) {
  const u = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams(params);
  const r = await fetch(u);
  return { status: r.status, j: await r.json() };
}

const base = {
  MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', REF_PLANE: 'ECLIPTIC',
  START_TIME: '2000-01-01T12:00', STOP_TIME: '2000-01-01T12:00', STEP_SIZE: '0d'
};

let { status, j } = await hz({ ...base, COMMAND: '1', CENTER: '10' });
console.log('Ceres minimal:', status, j && j.evs ? JSON.stringify(j.evs[0]) : JSON.stringify(j).slice(0, 300));

if (!j || !j.evs) {
  ({ status, j } = await hz({ ...base, COMMAND: '1', CENTER: '10', OBJ_DATA: 'YES' }));
  console.log('Ceres +OBJ_DATA:', status, j && j.evs ? JSON.stringify(j.evs[0]) : JSON.stringify(j).slice(0, 300));
}
if (j && !j.evs) {
  ({ status, j } = await hz({ ...base, COMMAND: '1', CENTER: '500@10' }));
  console.log('Ceres center 500@10:', status, j && j.evs ? JSON.stringify(j.evs[0]) : JSON.stringify(j).slice(0, 300));
}
