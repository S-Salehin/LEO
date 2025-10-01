// Risk score in [0,1]; higher = riskier.
// Factors: altitude band (denser lanes ~ 700–900 km), inclination crowding,
// debris bonus, and simple "drag" (Kp proxy passed in).
export function riskScore(item, opts = {}) {
  const { kp = 3, dragScale = 1 } = opts;

  const alt = item.alt_km ?? 700;
  // Altitude density: peak around 750–850 km
  let fAlt = 0;
  if (alt < 500) fAlt = 0.25;
  else if (alt < 650) fAlt = 0.55;
  else if (alt < 900) fAlt = 0.95;      // crowded shell
  else fAlt = 0.5;

  const inc = (item.inc_deg ?? 0) % 180;
  // Crowded inclinations ~ polar 97–99°, ISS-like 51–53°
  const near = (a,b) => Math.exp(-Math.pow((a-b)/3.5,2));
  const fInc = Math.max(near(inc, 98), near(inc, 52), near(inc, 64));

  const fKind = (item.kind === "debris") ? 1.0 : 0.6;

  // solar activity/drag bump: higher Kp => higher conjunction churn
  const kpNorm = Math.min(9, Math.max(0, kp)) / 9;
  const fKp = 0.6 + 0.8 * kpNorm * dragScale;

  const score = Math.max(0, Math.min(1, 0.45*fAlt + 0.35*fInc + 0.20*fKind)) * fKp;
  return Math.max(0, Math.min(1, score));
}

export function summarizeRisk(queue, opts) {
  if (!queue?.length) return { total: 0, mean: 0, pct: "0.0%" };
  const scores = queue.map(q => riskScore(q, opts));
  const mean = scores.reduce((a,b)=>a+b,0) / scores.length;
  const pct = (mean*100).toFixed(1) + "%";
  return { total: scores.reduce((a,b)=>a+b,0), mean, pct };
}
