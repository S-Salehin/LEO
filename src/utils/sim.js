const Re = 6378.0;
const mu = 398600.4418;

export function deg2rad(d){ return (d*Math.PI)/180; }
export function rad2deg(r){ return (r*180)/Math.PI; }

export function visRadiusForAlt(alt_km){
  const clamped = Math.max(350, Math.min(alt_km, 1200));
  return 1.02 + (clamped - 350) / (1200 - 350) * 0.25;
}

export function eciFromElems(alt_km, inc_deg, raan_deg, anomaly_deg){
  const rUnit = visRadiusForAlt(alt_km);
  const i = deg2rad(inc_deg), O = deg2rad(raan_deg), nu = deg2rad(anomaly_deg);
  const rpf = [ Math.cos(nu)*rUnit, Math.sin(nu)*rUnit, 0 ];
  const r1 = [ rpf[0], rpf[1]*Math.cos(i), rpf[1]*Math.sin(i) ];
  const r = [
    r1[0]*Math.cos(O) - r1[1]*Math.sin(O),
    r1[0]*Math.sin(O) + r1[1]*Math.cos(O),
    r1[2]
  ];
  return r;
}

function vCirc(alt_km){ const r = Re + alt_km; return Math.sqrt(mu / r); }

function hohmannDV(a1, a2){
  const r1 = Re + a1, r2 = Re + a2;
  const v1 = Math.sqrt(mu/r1), v2 = Math.sqrt(mu/r2);
  const a = 0.5*(r1+r2);
  const vp = Math.sqrt(mu*(2/r1 - 1/a));
  const va = Math.sqrt(mu*(2/r2 - 1/a));
  return (Math.abs(vp - v1) + Math.abs(v2 - va)) * 1000;
}

function planeChangeDV(alt_km, di_deg){
  const v = vCirc(alt_km) * 1000;
  const di = Math.abs(di_deg) * Math.PI/180;
  return 2 * v * Math.sin(di/2);
}

export function dvBetween(a, b){
  const dAlt = hohmannDV(a.alt_km, b.alt_km);
  const dInc = Math.abs(a.inc_deg - b.inc_deg);
  const dRAAN = Math.abs(a.raan_deg - b.raan_deg);
  const eqAlt = (a.alt_km + b.alt_km)/2;
  const plane = planeChangeDV(eqAlt, dInc + 0.2*dRAAN);
  return dAlt + plane;
}

export function dvForRoute(order, targets){
  if (!order || order.length < 1) return 0;
  let total = 0;
  for (let i=1; i<order.length; i++){
    const A = targets.find(t=>t.id===order[i-1]);
    const B = targets.find(t=>t.id===order[i]);
    if (A && B) total += dvBetween(A,B);
  }
  return Math.round(total);
}
