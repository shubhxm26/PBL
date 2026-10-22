/**
 * coordinateTransforms.js
 *
 * Authoritative Coordinate Transformation Suite for the Western India Logistics Corridor.
 * Converts between WGS84 GPS Geographic Coordinates (Latitude, Longitude, Altitude/Elevation)
 * and 3D World Stage Coordinates (X, Y, Z).
 *
 * Orientation Conventions in Three.js World Stage:
 *   +X: East (towards Nashik / Deccan Plateau)
 *   -X: West (towards JNPT Port / Arabian Sea)
 *   +Y: Up (Vertical Elevation / Mountain Crest)
 *   +Z: South (towards Navi Mumbai / Pune)
 *   -Z: North (towards Igatpuri / Nashik)
 */

// Geographic Reference Anchors for the Western India Corridor
export const CORRIDOR_GPS_BOUNDS = {
  minLat: 18.50,
  maxLat: 20.05,
  minLon: 72.90,
  maxLon: 73.90,
  seaLevelMeters: 0,
  kasaraPeakMeters: 580,
  deccanPlateauMeters: 600
};

// World Stage 3D Bounds
export const WORLD_STAGE_BOUNDS = {
  minX: -55,
  maxX: 55,
  minZ: -58,
  maxZ: 50,
  minY: 0,
  maxY: 12
};

// Calibrated Control Points [Lat, Lon, Elevation] -> [X, Y, Z]
export const ANCHOR_CALIBRATION_POINTS = [
  {
    code: 'JNPT',
    gps: [18.9496, 72.9515, 5],
    world: [-44, 0, 32]
  },
  {
    code: 'THANE',
    gps: [19.2183, 72.9781, 15],
    world: [-24, 0, 16]
  },
  {
    code: 'BHIWANDI',
    gps: [19.2967, 73.0631, 24],
    world: [-14, 0, 2]
  },
  {
    code: 'KASARA',
    gps: [19.6967, 73.5611, 580],
    world: [14, 9.5, -24]
  },
  {
    code: 'NASHIK',
    gps: [19.9975, 73.7898, 600],
    world: [42, 6.5, -48]
  },
  {
    code: 'PUNE',
    gps: [18.5204, 73.8567, 560],
    world: [28, 5.5, 42]
  }
];

// Linear regression / affine basis for Lon -> X and Lat -> Z
// Lon range: [72.9515, 73.7898] -> X range: [-44, 42]
// Lat range: [18.9496, 19.9975] -> Z range: [32, -48]
const LON_REF = 73.0631; // Bhiwandi
const LAT_REF = 19.2967; // Bhiwandi
const X_REF = -14.0;
const Z_REF = 2.0;

// Derived scale factors:
// ΔX / ΔLon = (42 - (-44)) / (73.7898 - 72.9515) = 86 / 0.8383 ≈ 102.5886
// ΔZ / ΔLat = (-48 - 32) / (19.9975 - 18.9496) = -80 / 1.0479 ≈ -76.3431
const SCALE_X_NORTH = 102.5886;
const SCALE_Z_NORTH = -76.3431;

/**
 * Calculates 3D elevation gradient (Y) representing the Western Ghats topography.
 * Near Kasara Ghat (19.6967, 73.5611), terrain climbs to steep crest (y ~ 9.5).
 * Near Nashik plateau, elevation settles around 6.5.
 * Near JNPT/Bhiwandi/Thane, elevation is near sea level (y ~ 0).
 * Near Pune, elevation is elevated plateau (y ~ 5.5).
 *
 * @param {number} lat - WGS84 Latitude
 * @param {number} lon - WGS84 Longitude
 * @param {number} [elevationMeters] - Physical altitude in meters if known
 * @returns {number} 3D World Y coordinate
 */
export function calculateElevationGradient(lat, lon, elevationMeters = null) {
  if (elevationMeters !== null && elevationMeters !== undefined) {
    if (elevationMeters <= 25) return 0;
    if (elevationMeters >= 550 && lat > 19.5 && lat < 19.8) {
      // Kasara Ghat peak region
      return 9.5;
    }
    // Proportional mapping for other points
    return Math.min(10.5, Math.max(0, (elevationMeters / 600) * 6.5));
  }

  // Geographic distance from Kasara Ghat mudslide crest epicenter
  const kasaraLat = 19.6967;
  const kasaraLon = 73.5611;
  const distKasara = Math.hypot(lat - kasaraLat, (lon - kasaraLon) * 0.9);

  if (distKasara < 0.08) {
    // Summit crest
    return 9.5 - (distKasara / 0.08) * 1.5;
  }

  // Western Ghats slope between Asangaon (lat ~19.46) and Igatpuri (lat ~19.75)
  if (lat >= 19.40 && lat <= 19.75 && lon >= 73.25 && lon <= 73.65) {
    const t = (lat - 19.40) / (19.70 - 19.40);
    const clampedT = Math.min(1, Math.max(0, t));
    return clampedT * 9.5;
  }

  // Nashik elevated plateau
  if (lat > 19.75 && lon > 73.60) {
    return 6.5;
  }

  // Pune elevated Deccan plateau
  if (lat < 18.80 && lon > 73.40) {
    return 5.5;
  }

  // Coastal / Konkan lowlands (JNPT, Mumbai, Thane, Bhiwandi)
  if (lat < 19.35 && lon < 73.15) {
    return 0;
  }

  // Intermediate transition
  const progress = Math.min(1, Math.max(0, (lat - 19.20) / (19.70 - 19.20)));
  return progress * 6.0;
}

/**
 * Converts WGS84 GPS coordinate [lat, lon, elevation] to 3D World Stage [x, y, z].
 *
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lon - Longitude in decimal degrees
 * @param {number} [elevation] - Altitude in meters (optional)
 * @returns {[number, number, number]} [x, y, z] in Three.js world space
 */
export function wgs84ToWorldCoordinates(lat, lon, elevation = null) {
  // Check exact anchor overrides first for key nodes
  for (const anchor of ANCHOR_CALIBRATION_POINTS) {
    const dLat = Math.abs(lat - anchor.gps[0]);
    const dLon = Math.abs(lon - anchor.gps[1]);
    if (dLat < 0.005 && dLon < 0.005) {
      return [...anchor.world];
    }
  }

  // Southern Corridor branch (Bhiwandi -> Pune)
  if (lat < 19.20 && lon > 73.10) {
    // Panvel / Lonavala / Pune alignment
    const tLat = (19.2967 - lat) / (19.2967 - 18.5204); // 0 at Bhiwandi, 1 at Pune
    const tLon = (lon - 73.0631) / (73.8567 - 73.0631); // 0 at Bhiwandi, 1 at Pune
    const t = (tLat + tLon) / 2;

    const x = -14.0 + (28.0 - -14.0) * tLon;
    const z = 2.0 + (42.0 - 2.0) * tLat;
    const y = calculateElevationGradient(lat, lon, elevation);
    return [Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))];
  }

  // Northern Corridor branch (JNPT -> Bhiwandi -> Kasara Ghat -> Nashik)
  const dLon = lon - LON_REF;
  const dLat = lat - LAT_REF;

  let x = X_REF + dLon * SCALE_X_NORTH;
  let z = Z_REF + dLat * SCALE_Z_NORTH;
  let y = calculateElevationGradient(lat, lon, elevation);

  return [Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))];
}

/**
 * Inverts 3D World Stage coordinate [x, y, z] back to WGS84 GPS coordinate [lat, lon, elevation].
 *
 * @param {number} x - World X
 * @param {number} y - World Y
 * @param {number} z - World Z
 * @returns {[number, number, number]} [lat, lon, elevationMeters]
 */
export function worldToWgs84Coordinates(x, y, z) {
  // Check exact anchor overrides
  for (const anchor of ANCHOR_CALIBRATION_POINTS) {
    const dX = Math.abs(x - anchor.world[0]);
    const dZ = Math.abs(z - anchor.world[2]);
    if (dX < 0.5 && dZ < 0.5) {
      return [...anchor.gps];
    }
  }

  // Southern branch check
  if (z > 10 && x > 0) {
    const tLat = (z - 2.0) / (42.0 - 2.0);
    const tLon = (x - -14.0) / (28.0 - -14.0);

    const lat = 19.2967 - tLat * (19.2967 - 18.5204);
    const lon = 73.0631 + tLon * (73.8567 - 73.0631);
    const elev = (y / 9.5) * 580;
    return [Number(lat.toFixed(4)), Number(lon.toFixed(4)), Math.round(elev)];
  }

  // Northern branch
  const dLon = (x - X_REF) / SCALE_X_NORTH;
  const dLat = (z - Z_REF) / SCALE_Z_NORTH;

  const lon = LON_REF + dLon;
  const lat = LAT_REF + dLat;
  const elev = y <= 0.1 ? 5 : (y / 9.5) * 580;

  return [Number(lat.toFixed(4)), Number(lon.toFixed(4)), Math.round(elev)];
}

/**
 * Transforms an array of WGS84 GPS waypoints into 3D world coordinate vectors.
 *
 * @param {Array<[number, number] | [number, number, number]>} waypoints - [[lat, lon], ...]
 * @returns {Array<[number, number, number]>} Array of [x, y, z] points
 */
export function projectCorridorWaypoints(waypoints) {
  if (!Array.isArray(waypoints)) return [];
  return waypoints.map((pt) => {
    const lat = pt[0];
    const lon = pt[1];
    const elev = pt.length > 2 ? pt[2] : null;
    return wgs84ToWorldCoordinates(lat, lon, elev);
  });
}
