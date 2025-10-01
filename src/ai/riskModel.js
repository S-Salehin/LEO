// src/ai/riskModel.js
// Lightweight “AI” (logistic model + heuristics) – pure JS, no deps.

/**
 * features:
 *  altKm          Satellite altitude (km)
 *  incDeg         inclination (deg)
 *  density        normalized local traffic density 0..1
 *  dragMult       Kp-derived drag factor (1.0 baseline)
 *  debris         1 if object is debris, 0 if operational sat
 * returns { p, scoreParts }
 */
export function predictCollisionRisk(features) {
  const { altKm, incDeg, density = 0.2, dragMult = 1.0, debris = 0 } = features;

  // Feature transforms
  const x1 = (altKm - 700) / 200;                 // center around 700 km shell
  const x2 = Math.cos((incDeg * Math.PI) / 180);  // polar vs equatorial
  const x3 = density;                             
  const x4 = Math.log(Math.max(0.5, dragMult));  // higher drag → more decay, short-term risk ↑ for LEO
  const x5 = debris ? 1 : 0;

  // Coeffs (fit offline on synthetic traffic; tuned to be sane in LEO)
  const w0 = -1.25;  // bias
  const w = [0.65, -0.35, 1.8, 0.9, 0.7];

  const z = w0 + w[0] * x1 + w[1] * x2 + w[2] * x3 + w[3] * x4 + w[4] * x5;
  const p = 1 / (1 + Math.exp(-z)); // 0..1

  return {
    p,
    scoreParts: { alt: w[0] * x1, inc: w[1] * x2, dens: w[2] * x3, drag: w[3] * x4, debris: w[4] * x5 }
  };
}

/**
 * Simple k-means for 3D orbits (a, i, RAAN).  k small (default 4).
 * items: [{ id, altKm, incDeg, raanDeg, type }]
 */
export function kmeansOrbits(items, k = 4, iters = 8) {
  if (!items.length) return { centroids: [], groups: [] };

  // init: pick k evenly through list
  const centroids = new Array(k).fill(null).map((_, i) => {
    const u = items[(Math.floor((i * items.length) / k)) % items.length];
    return [u.altKm, u.incDeg, u.raanDeg];
  });

  let groups = new Array(k).fill(0).map(() => []);
  for (let t = 0; t < iters; t++) {
    groups = new Array(k).fill(0).map(() => []);
    for (const o of items) {
      let best = 0;
      let bestD = 1e9;
      for (let c = 0; c < k; c++) {
        const d =
          (o.altKm - centroids[c][0]) ** 2 +
          (o.incDeg - centroids[c][1]) ** 2 +
          (wrap360(o.raanDeg - centroids[c][2])) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      groups[best].push(o);
    }
    for (let c = 0; c < k; c++) {
      if (!groups[c].length) continue;
      const mA =
        groups[c].reduce((s, o) => s + o.altKm, 0) / groups[c].length;
      const mI =
        groups[c].reduce((s, o) => s + o.incDeg, 0) / groups[c].length;
      const mR =
        groups[c].reduce((s, o) => s + o. raanDeg, 0) / groups[c].length;
      centroids[c] = [mA, mI, mR];
    }
  }
  return { centroids, groups };
}

function wrap360(v) {
  let x = ((v % 360) + 360) % 360;
  return x > 180 ? 360 - x : x;
}

/**
 * Monte-Carlo one-year projection of collisions under a policy.
 * Returns { collisionsPerYear, series } where series is 12 monthly points.
 */
export function monteCarloYear(items, policy, months = 12) {
  const rng = mulberry32(12345);
  const out = [];
  let total = 0;

  const { deorbitCompliance = 0.5, cadencePerMonth = 4, dragMult = 1.0 } = policy;
  // copy list
  let pool = items.map(x => ({...x}));

  for (let m = 0; m < months; m++) {
    // Apply monthly cleanup (remove top-risk items)
    const ranked = pool
      .map(o => ({ o, risk: predictCollisionRisk({
        altKm: o.altKm, incDeg: o.incDeg, density: o.density ?? 0.2, dragMult, debris: o.type === 'debris' ? 1 : 0
      }).p }))
      .sort((a, b) => b.risk - a.risk);

    const removes = Math.floor(cadencePerMonth * deorbitCompliance);
    const toRemove = ranked.slice(0, removes).map(x => x.o.id);
    pool = pool.filter(x => !toRemove.includes(x.id));

    // Compute collisions this month (binomial on remaining risk)
    let monthCol = 0;
    for (const o of pool) {
      const p = predictCollisionRisk({ altKm: o.altKm, incDeg: o.incDeg, density: o.density ?? 0.2, dragMult, debris: o.type === 'debris' ? 1 : 0 }).p;
      if (rng() < p * 0.015) monthCol++; // scaled so numbers are human sensible
    }
    total += monthCol;
    out.push({ month: m + 1, collisions: monthCol, removed: removes });
  }
  return { collisionsPerYear: total, series: out };
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
