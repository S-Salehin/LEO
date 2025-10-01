/**
 * Collision detection and warning system for LEO satellites and debris
 */

const EARTH_RADIUS_KM = 6371.0;
const COLLISION_THRESHOLD_KM = 5.0; // Consider potential collision if within 5km
const WARNING_TIME_SECONDS = 3600; // Warn up to 1 hour ahead

/**
 * Calculate distance between two ECEF positions
 */
export function distance3D(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Predict future position for a satellite/debris
 */
function predictPosition(rec, currentDate, secondsAhead, satelliteLib) {
  const futureDate = new Date(currentDate.getTime() + secondsAhead * 1000);
  
  if (rec.mode === "synthetic") {
    // Synthetic orbit calculation
    const n = rec.n_rad_s;
    const M = rec.m0 + n * (futureDate.getTime() / 1000);
    const x_orb = rec.a_km * Math.cos(M);
    const y_orb = rec.a_km * Math.sin(M);
    const z_orb = 0;
    
    // Simple rotation (this is approximate, full calculation in Globe3D)
    const gmst = satelliteLib.gstime(futureDate);
    const cosGmst = Math.cos(gmst);
    const sinGmst = Math.sin(gmst);
    
    return {
      x: x_orb * cosGmst - y_orb * sinGmst,
      y: x_orb * sinGmst + y_orb * cosGmst,
      z: z_orb
    };
  }
  
  // TLE-based calculation
  try {
    const pv = satelliteLib.propagate(rec, futureDate);
    if (!pv.position) return null;
    const gmst = satelliteLib.gstime(futureDate);
    return satelliteLib.eciToEcf(pv.position, gmst);
  } catch {
    return null;
  }
}

/**
 * Calculate satellite lifecycle stage based on orbital decay
 * Returns: 'healthy' | 'aging' | 'critical'
 */
export function calculateLifecycle(altKm, incDeg, dragMult = 1.0) {
  // Rough lifetime estimation based on altitude and drag
  const baseAlt = 400; // Below 400km = high drag
  const safeAlt = 700; // Above 700km = very stable
  
  if (altKm < baseAlt) {
    // Critical zone - rapid decay
    return 'critical';
  } else if (altKm < (baseAlt + safeAlt) / 2) {
    // Aging zone - moderate decay
    return dragMult > 1.2 ? 'critical' : 'aging';
  } else {
    // Healthy zone
    return 'healthy';
  }
}

/**
 * Estimate remaining orbital lifetime in days
 */
export function estimateLifetimeDays(altKm, dragMult = 1.0) {
  // Very rough approximation
  if (altKm < 300) return Math.max(1, 30 / dragMult);
  if (altKm < 400) return Math.max(30, 180 / dragMult);
  if (altKm < 500) return Math.max(180, 365 * 2 / dragMult);
  if (altKm < 600) return Math.max(365 * 2, 365 * 5 / dragMult);
  return 365 * 10; // Very long lived
}

/**
 * Detect potential collisions between all tracked objects
 * Returns array of collision warnings with timing
 */
export function detectCollisions(objects, currentDate, satelliteLib, dragMult = 1.0) {
  const collisions = [];
  const timeSteps = [60, 300, 600, 1200, 1800, 3600]; // Check at various intervals
  
  // Check all pairs
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const obj1 = objects[i];
      const obj2 = objects[j];
      
      // Skip if same object
      if (obj1.userData.name === obj2.userData.name) continue;
      
      // Check multiple time steps
      for (const dt of timeSteps) {
        try {
          const pos1 = predictPosition(obj1.userData.rec, currentDate, dt, satelliteLib);
          const pos2 = predictPosition(obj2.userData.rec, currentDate, dt, satelliteLib);
          
          if (!pos1 || !pos2) continue;
          
          const dist = distance3D(pos1, pos2);
          
          if (dist < COLLISION_THRESHOLD_KM) {
            // Found a potential collision
            const existing = collisions.find(
              c => 
                (c.obj1 === obj1.userData.name && c.obj2 === obj2.userData.name) ||
                (c.obj1 === obj2.userData.name && c.obj2 === obj1.userData.name)
            );
            
            if (!existing) {
              collisions.push({
                obj1: obj1.userData.name,
                obj2: obj2.userData.name,
                timeSeconds: dt,
                distance: dist,
                severity: dist < 2 ? 'critical' : dist < 3.5 ? 'high' : 'medium',
                type1: obj1.userData.kind,
                type2: obj2.userData.kind
              });
            } else if (dt < existing.timeSeconds) {
              // Update with closer approach
              existing.timeSeconds = dt;
              existing.distance = dist;
              existing.severity = dist < 2 ? 'critical' : dist < 3.5 ? 'high' : 'medium';
            }
          }
        } catch (err) {
          // Skip failed predictions
          continue;
        }
      }
    }
  }
  
  // Sort by time (most urgent first)
  return collisions.sort((a, b) => a.timeSeconds - b.timeSeconds);
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/**
 * Get color for satellite based on lifecycle stage
 */
export function getLifecycleColor(stage) {
  switch (stage) {
    case 'healthy': return '#0099ff'; // Blue
    case 'aging': return '#ffd600'; // Yellow
    case 'critical': return '#ff6b6b'; // Red
    default: return '#0099ff';
  }
}

/**
 * Get hex color as THREE.Color compatible number
 */
export function hexToNumber(hex) {
  return parseInt(hex.replace('#', ''), 16);
}
