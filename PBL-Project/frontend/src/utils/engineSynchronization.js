/**
 * engineSynchronization.js
 *
 * Authoritative Synchronization & Dual-Engine Controller for:
 *   1. Tactical 3D World (Three.js / R3F)
 *   2. Strategic Macro GIS (CesiumJS WGS84 Photorealistic Globe)
 *
 * Manages engine toggling, bidirectional coordinate synchronization,
 * simulation time preservation, facility mapping, PiP configuration,
 * and graceful fallback states.
 */

import { wgs84ToWorldCoordinates, worldToWgs84Coordinates } from './coordinateTransforms.js';
import { STAGE_NODES, STAGE_FACILITIES, PUNE_FC_NODE } from '../constants/stage3DTopology.js';
import { FACILITY_NODES, CAMERA_PRESETS, SCHEMATIC_COORDS } from '../constants/logisticsTopology.js';

export const STAGE_ENGINES = {
  TACTICAL_3D: 'tactical_3d',
  CESIUM_GIS: 'cesium_gis'
};

export const ENGINE_METADATA = {
  [STAGE_ENGINES.TACTICAL_3D]: {
    id: STAGE_ENGINES.TACTICAL_3D,
    name: 'Tactical R3F Twin',
    shortName: 'Tactical 3D',
    badge: '3D TACTICAL',
    iconName: 'Truck',
    themeColor: '#06b6d4', // Cyan
    accentGlow: 'rgba(6, 182, 212, 0.4)',
    hotkey: 'T',
    description: 'Continuous 60 FPS procedural logistics world with 3rd-person vehicle chase cam.'
  },
  [STAGE_ENGINES.CESIUM_GIS]: {
    id: STAGE_ENGINES.CESIUM_GIS,
    name: 'Macro Cesium GIS',
    shortName: 'Macro GIS',
    badge: 'WGS84 GLOBE',
    iconName: 'Globe',
    themeColor: '#38bdf8', // Sky Blue
    accentGlow: 'rgba(56, 189, 248, 0.4)',
    hotkey: 'M',
    description: 'WGS84 geospatial corridor digital twin with satellite imagery, terrain, and OSM 3D buildings.'
  }
};

/**
 * Toggles the active stage engine.
 * @param {string} currentEngine - 'tactical_3d' | 'cesium_gis'
 * @returns {string} The alternative engine
 */
export function toggleStageEngine(currentEngine) {
  return currentEngine === STAGE_ENGINES.TACTICAL_3D
    ? STAGE_ENGINES.CESIUM_GIS
    : STAGE_ENGINES.TACTICAL_3D;
}

/**
 * Returns the secondary engine that should be rendered in the Picture-in-Picture (PiP) inset.
 * @param {string} primaryEngine - 'tactical_3d' | 'cesium_gis'
 * @returns {string} Secondary engine id
 */
export function getSecondaryPipEngine(primaryEngine) {
  return toggleStageEngine(primaryEngine);
}

/**
 * Normalizes and maps facility identifier across Tactical 3D and Macro Cesium GIS.
 * Supports node IDs ('PORT-JNPT-01'), codes ('JNPT'), or preset keys ('KASARA_PASS').
 *
 * @param {string} identifier - Facility ID, code, or camera preset key
 * @returns {{
 *   stageNode: object|null,
 *   cesiumNode: object|null,
 *   normalizedId: string,
 *   presetKey: string
 * }}
 */
export function mapFacilityBetweenEngines(identifier) {
  if (!identifier) {
    return {
      stageNode: null,
      cesiumNode: null,
      normalizedId: 'DC-BHW-01',
      presetKey: 'CORRIDOR_OVERVIEW'
    };
  }

  const clean = String(identifier).toUpperCase().trim();

  // 1. Direct ID match
  let stageNode = STAGE_FACILITIES.find((n) => n.id.toUpperCase() === clean || n.code.toUpperCase() === clean);
  let cesiumNode = FACILITY_NODES.find((n) => n.node_id.toUpperCase() === clean || n.shortName.toUpperCase() === clean);

  // 2. Special aliases for Kasara Ghat
  if (!stageNode && (clean.includes('KASARA') || clean === 'PASS-KASARA-01')) {
    stageNode = STAGE_FACILITIES.find((n) => n.code === 'KASARA');
  }
  if (!cesiumNode && (clean.includes('KASARA') || clean === 'PASS-KASARA-01')) {
    // Kasara Ghat is a designated camera preset & elevation point in Cesium
    cesiumNode = {
      node_id: 'PASS-KASARA-01',
      name: 'Kasara Ghat Mountain Pass',
      shortName: 'Kasara Ghat',
      echelon_tier: 3,
      tier_label: 'Mountain Pass Bottleneck',
      city: 'Kasara',
      latitude: CAMERA_PRESETS.KASARA_GHAT.latitude,
      longitude: CAMERA_PRESETS.KASARA_GHAT.longitude,
      cameraPreset: CAMERA_PRESETS.KASARA_GHAT
    };
  }

  // 3. Pune Fulfillment Center fallback
  if (!stageNode && (clean.includes('PUN') || clean === 'FC-PUN-01')) {
    stageNode = PUNE_FC_NODE;
  }
  if (!cesiumNode && (clean.includes('PUN') || clean === 'FC-PUN-01')) {
    cesiumNode = FACILITY_NODES.find((n) => n.node_id === 'FC-PUN-01');
  }

  const normalizedId = stageNode?.id || cesiumNode?.node_id || clean;

  // Derive preset key
  let presetKey = 'CORRIDOR_OVERVIEW';
  if (clean.includes('JNPT')) presetKey = 'JNPT_PORT';
  else if (clean.includes('BHW') || clean.includes('BHIWANDI')) presetKey = 'BHIWANDI_DC';
  else if (clean.includes('KASARA')) presetKey = 'KASARA_PASS';
  else if (clean.includes('NSK') || clean.includes('NASHIK')) presetKey = 'NASHIK_DEPOT';
  else if (clean.includes('THN') || clean.includes('THANE')) presetKey = 'OVERVIEW';

  return {
    stageNode: stageNode || null,
    cesiumNode: cesiumNode || null,
    normalizedId,
    presetKey
  };
}

/**
 * Calculates synchronized vehicle spatial state across 3D and WGS84 GPS domains.
 *
 * @param {object} params
 * @param {number} params.progress - Corridor progress [0.0, 1.0]
 * @param {Array<number>} params.worldPos - [x, y, z] in Three.js world space
 * @param {Array<number>} params.headingVec - [hx, hy, hz] direction vector
 * @param {number} [params.speedKmh] - Vehicle velocity
 * @param {object} [params.baseTelematics] - Optional base telemetry properties
 * @returns {object} Synchronized vehicle telematics state
 */
export function calculateSynchronizedVehicleState({
  progress = 0.08,
  worldPos = [0, 0, 0],
  headingVec = [0, 0, 1],
  speedKmh = 64,
  baseTelematics = {}
}) {
  const [x, y, z] = worldPos;
  const [lat, lon, altMeters] = worldToWgs84Coordinates(x, y, z);

  // Compute heading in degrees (0 = North, 90 = East, 180 = South, 270 = West)
  const hx = headingVec[0] || 0;
  const hz = headingVec[2] || 1;
  const headingDeg = Math.round(((Math.atan2(hx, -hz) * 180) / Math.PI + 360) % 360);

  // Determine corridor leg
  let corridorLeg = 'NH-160 / JNPT Expressway';
  if (y > 6.0 || (lat >= 19.55 && lat <= 19.80)) {
    corridorLeg = 'Kasara Ghat Mountain Ascent (+580m)';
  } else if (progress > 0.6 || lat > 19.80) {
    corridorLeg = 'Nashik Agro Corridor NH-160';
  } else if (z > 20) {
    corridorLeg = 'Bhiwandi-Pune Express Arterial';
  }

  return {
    id: baseTelematics.id || 'TRK-MH-01',
    model: baseTelematics.model || 'Volvo FH Electric (Cold-Chain)',
    progress: Number(progress.toFixed(4)),
    worldPos: [Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2))],
    gpsPos: [Number(lat.toFixed(4)), Number(lon.toFixed(4)), altMeters],
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lon.toFixed(4)),
    altitudeM: altMeters,
    speedKmh: Math.max(0, Math.round(speedKmh)),
    headingDeg,
    corridorLeg,
    socPercent: baseTelematics.socPercent ?? 82,
    cargoTempC: baseTelematics.cargoTempC ?? -18.4,
    status: 'ACTIVE_CONDUIT'
  };
}

/**
 * Calculates 2.5D schematic SVG coordinates for the moving vehicle along the corridor.
 *
 * @param {number} progress - Progress along corridor [0.0, 1.0]
 * @returns {{ x: number, y: number }}
 */
export function calculateSchematicVehiclePos(progress) {
  // Key schematic corridor anchor positions
  // JNPT: { x: 120, y: 530 }
  // THANE: { x: 260, y: 440 }
  // BHIWANDI: { x: 420, y: 390 }
  // KASARA: { x: 620, y: 260 }
  // NASHIK: { x: 840, y: 150 }
  const p = Math.max(0, Math.min(1, progress));

  if (p <= 0.22) {
    // JNPT -> THANE
    const t = p / 0.22;
    return {
      x: Math.round(120 + (260 - 120) * t),
      y: Math.round(530 + (440 - 530) * t)
    };
  } else if (p <= 0.45) {
    // THANE -> BHIWANDI
    const t = (p - 0.22) / (0.45 - 0.22);
    return {
      x: Math.round(260 + (420 - 260) * t),
      y: Math.round(440 + (390 - 440) * t)
    };
  } else if (p <= 0.75) {
    // BHIWANDI -> KASARA
    const t = (p - 0.45) / (0.75 - 0.45);
    return {
      x: Math.round(420 + (620 - 420) * t),
      y: Math.round(390 + (260 - 390) * t)
    };
  } else {
    // KASARA -> NASHIK
    const t = (p - 0.75) / (1.0 - 0.75);
    return {
      x: Math.round(620 + (840 - 620) * t),
      y: Math.round(260 + (150 - 260) * t)
    };
  }
}

/**
 * Validates dual-engine state preservation invariants when switching between engines.
 *
 * Invariants:
 * 1. Sim playback time (progress, speed, paused state) must not jump or reset to zero.
 * 2. Active vehicle selection must remain unchanged.
 * 3. Selected facility node must remain synchronized across both engines.
 * 4. Primary and secondary PiP engines must be strictly complementary.
 *
 * @param {object} prevState - State before switch
 * @param {object} nextState - State after switch
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDualEngineStateInvariants(prevState, nextState) {
  const errors = [];

  // Invariant 1: Simulation playback time continuity
  if (Math.abs(prevState.simSpeed - nextState.simSpeed) > 0.001) {
    errors.push(`Simulation speed changed during engine switch: was ${prevState.simSpeed}, now ${nextState.simSpeed}`);
  }

  if (prevState.isPaused !== nextState.isPaused) {
    errors.push(`Simulation pause state mutated during engine switch: was ${prevState.isPaused}, now ${nextState.isPaused}`);
  }

  if (Math.abs(prevState.truckProgress - nextState.truckProgress) > 0.05) {
    errors.push(`Truck progress discontinuous across engine switch: was ${prevState.truckProgress}, now ${nextState.truckProgress}`);
  }

  // Invariant 2: Vehicle selection preserved
  if (prevState.vehicleId !== nextState.vehicleId) {
    errors.push(`Vehicle ID mutated during engine switch: was ${prevState.vehicleId}, now ${nextState.vehicleId}`);
  }

  // Invariant 3: Facility focus preserved
  if (prevState.selectedFacilityId && nextState.selectedFacilityId && prevState.selectedFacilityId !== nextState.selectedFacilityId) {
    errors.push(`Facility selection mutated during engine switch: was ${prevState.selectedFacilityId}, now ${nextState.selectedFacilityId}`);
  }

  // Invariant 4: Primary vs Secondary exclusivity
  if (nextState.primaryEngine === nextState.secondaryEngine) {
    errors.push(`Primary engine and secondary PiP engine cannot be identical (${nextState.primaryEngine})`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Assesses whether Cesium requires schematic fallback.
 *
 * @param {object} params
 * @param {boolean} params.userPrefersSchematic - User toggle
 * @param {string} [params.ionToken] - Cesium Ion token
 * @param {boolean} [params.webglSupported] - Browser WebGL context availability
 * @param {string|null} [params.webglError] - Runtime WebGL error message if thrown
 * @returns {{ useSchematic: boolean, reason: string }}
 */
export function determineCesiumFallbackState({
  userPrefersSchematic = false,
  ionToken = '',
  webglSupported = true,
  webglError = null
}) {
  if (userPrefersSchematic) {
    return {
      useSchematic: true,
      reason: 'OPERATOR_SELECTED'
    };
  }

  if (!webglSupported || webglError) {
    return {
      useSchematic: true,
      reason: `WEBGL_UNAVAILABLE: ${webglError || 'Context Limit or Driver Failure'}`
    };
  }

  if (!ionToken || ionToken.trim() === '') {
    return {
      useSchematic: false, // Cesium can still run in base ellipsoid view, or fallback
      reason: 'ION_TOKEN_MISSING'
    };
  }

  return {
    useSchematic: false,
    reason: 'NOMINAL_PHOTOREALISTIC'
  };
}
