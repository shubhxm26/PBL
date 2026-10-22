/**
 * telematicsControllers.js
 *
 * Telematics gauge controllers, threshold evaluators, vehicle configurations,
 * simulation clock math, and camera tracking resolver for the Western India fleet.
 */

export const VEHICLE_CONFIGS = {
  'TRK-MH-01': {
    id: 'TRK-MH-01',
    plate: 'MH-04-GP-8821',
    name: 'TRK-MH-01 Reefer',
    type: '24T Heavy Commercial Reefer',
    cargo: 'Perishable Vaccines & Biopharma',
    corridor: 'JNPT ➔ Nashik Corridor',
    hasColdChain: true,
    targetTempC: 4.0,
    safeZoneMin: 2.0,
    safeZoneMax: 8.0,
    themeColor: '#FF5400',
    accentColor: '#10b981'
  },
  'TRK-MH-02': {
    id: 'TRK-MH-02',
    plate: 'MH-12-QE-4419',
    name: 'TRK-MH-02 EV Carrier',
    type: '16T Electric Express Carrier',
    cargo: 'Automotive Electronics & Precision Modules',
    corridor: 'Panvel ➔ Pune Expressway',
    hasColdChain: false,
    targetTempC: 20.0,
    safeZoneMin: 15.0,
    safeZoneMax: 25.0,
    themeColor: '#06b6d4',
    accentColor: '#3b82f6'
  }
};

export const KASARA_DISRUPTION_PAYLOAD = {
  roadblock_id: 'RB-KASARA-01',
  name: 'Kasara Ghat Monsoon Landslide',
  corridor_node: 'KSR',
  latitude: 19.6967,
  longitude: 73.5611,
  radius_km: 15.0,
  severity: 'CRITICAL',
  description: 'Rockfall blocked NH-48 uphill section. 10x penalty edge applied.',
  penalty_multiplier: 10.0,
  target_vehicle_id: 'TRK-MH-01'
};

/**
 * Evaluates cold-chain cargo temperature threshold status.
 * Safe zone is 2.0°C to 8.0°C.
 *
 * @param {number} temp - Current cargo temperature in Celsius
 * @returns {'NOMINAL' | 'EXCURSION' | 'CRITICAL'}
 */
export function evaluateColdChainStatus(temp) {
  if (temp >= 2.0 && temp <= 8.0) {
    return 'NOMINAL';
  }
  if ((temp > 8.0 && temp <= 10.0) || (temp >= 0.0 && temp < 2.0)) {
    return 'EXCURSION';
  }
  return 'CRITICAL';
}

/**
 * Calculates speed gauge ratio clamped to [0, 1].
 *
 * @param {number} speedKmh
 * @param {number} maxSpeed
 * @returns {number}
 */
export function calculateSpeedRatio(speedKmh, maxSpeed = 100) {
  if (typeof speedKmh !== 'number' || isNaN(speedKmh) || speedKmh <= 0) return 0;
  return Math.min(1.0, speedKmh / maxSpeed);
}

/**
 * Categorizes battery / fuel SoC percentage for UI styling.
 *
 * @param {number} soc
 * @returns {'HEALTHY_GREEN' | 'WARNING_AMBER' | 'CRITICAL_RED'}
 */
export function calculateSoCCategory(soc) {
  if (soc >= 50) return 'HEALTHY_GREEN';
  if (soc >= 20) return 'WARNING_AMBER';
  return 'CRITICAL_RED';
}

/**
 * Resolves camera focus tracking target coordinates between multiple vehicles.
 *
 * @param {string} activeVehicleId
 * @param {Object} truck1State
 * @param {Object} truck2State
 * @returns {{ pos: number[], heading: number[], id: string }}
 */
export function resolveCameraFocusTarget(activeVehicleId, truck1State, truck2State) {
  if (activeVehicleId === 'TRK-MH-02' && truck2State) {
    return {
      pos: truck2State.pos || [0, 0, 0],
      heading: truck2State.heading || [0, 0, 1],
      id: 'TRK-MH-02'
    };
  }
  return {
    pos: truck1State?.pos || [0, 0, 0],
    heading: truck1State?.heading || [0, 0, 1],
    id: 'TRK-MH-01'
  };
}

/**
 * Determines active corridor spline curve based on roadblock status.
 *
 * @param {boolean} isBlocked
 * @param {Object} mainCurve
 * @param {Object} detourCurve
 * @returns {Object}
 */
export function resolveDetourTrajectory(isBlocked, mainCurve, detourCurve) {
  if (isBlocked && detourCurve) {
    return detourCurve;
  }
  return mainCurve;
}
