/**
 * cameraControllers.js
 *
 * Camera controllers and mathematical perspective suite for the Persistent 3D Stage.
 * Supports:
 *   1. 3rd-Person Dynamic Chase Cam (Velocity damped, aligns with vehicle heading, mouse free-look orbit)
 *   2. Driver Cockpit Dashcam POV (Interior windshield perspective looking out over the hood)
 *   3. Tactical Drone God-View (Overhead high-altitude aerial reconnaissance view)
 *   4. Free Orbit Inspection (Orbital inspection around any point of interest or facility)
 */

export const CAMERA_MODES = {
  CHASE: 'CHASE',
  COCKPIT: 'COCKPIT',
  DRONE: 'DRONE',
  FREE_ORBIT: 'FREE_ORBIT'
};

export const CAMERA_MODE_METADATA = {
  [CAMERA_MODES.CHASE]: {
    id: CAMERA_MODES.CHASE,
    name: '3rd-Person Chase',
    shortName: 'CHASE',
    badge: 'DYNAMIC CHASE',
    hotkey: '1',
    description: 'Dynamic chase cam tracking behind moving commercial vehicle with heading alignment and mouse free-look.'
  },
  [CAMERA_MODES.COCKPIT]: {
    id: CAMERA_MODES.COCKPIT,
    name: 'Cockpit Dashcam',
    shortName: 'COCKPIT',
    badge: 'POV DASHCAM',
    hotkey: '2',
    description: 'Driver dashcam perspective mounted inside the cab looking out over the highway and headlights.'
  },
  [CAMERA_MODES.DRONE]: {
    id: CAMERA_MODES.DRONE,
    name: 'Tactical Drone',
    shortName: 'DRONE',
    badge: 'AERIAL GOD-VIEW',
    hotkey: '3',
    description: 'Overhead tactical aerial reconnaissance view monitoring macro-corridor and terrain.'
  },
  [CAMERA_MODES.FREE_ORBIT]: {
    id: CAMERA_MODES.FREE_ORBIT,
    name: 'Free Orbit',
    shortName: 'ORBIT',
    badge: 'FREE INSPECTION',
    hotkey: '4',
    description: 'Free-form inspection camera supporting orbit rotation, panning, and facility zooming.'
  }
};

/**
 * Framerate-independent exponential damping helper.
 *
 * @param {number} current - Current scalar value
 * @param {number} target - Target scalar value
 * @param {number} lambda - Damping coefficient (higher = faster convergence)
 * @param {number} dt - Frame delta time in seconds
 * @returns {number} Damped value
 */
export function dampScalar(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/**
 * Damp a 3D coordinate array [x, y, z].
 *
 * @param {[number, number, number]} current - Current [x, y, z]
 * @param {[number, number, number]} target - Target [x, y, z]
 * @param {number} lambda - Damping coefficient
 * @param {number} dt - Frame delta time in seconds
 * @returns {[number, number, number]} Damped coordinate
 */
export function dampArray3(current, target, lambda, dt) {
  const factor = 1 - Math.exp(-lambda * Math.max(0.001, Math.min(0.1, dt)));
  return [
    current[0] + (target[0] - current[0]) * factor,
    current[1] + (target[1] - current[1]) * factor,
    current[2] + (target[2] - current[2]) * factor
  ];
}

/**
 * Calculates 3rd-Person Dynamic Chase Camera position and look-at target.
 * Aligns behind the moving vehicle according to vehicle forward vector,
 * with optional mouse free-look yaw and pitch offsets.
 *
 * @param {Object} params
 * @param {[number, number, number]} params.truckPos - [x, y, z] position of vehicle
 * @param {[number, number, number]} params.truckHeading - Forward direction vector [fx, fy, fz]
 * @param {number} [params.yawOffset=0] - Horizontal free-look rotation offset in radians
 * @param {number} [params.pitchOffset=0.15] - Vertical free-look pitch offset in radians
 * @param {number} [params.distance=13.5] - Follow distance behind truck
 * @param {number} [params.height=5.2] - Camera elevation above truck base
 * @returns {{ position: [number, number, number], lookAt: [number, number, number] }}
 */
export function calculateChaseCameraPosition({
  truckPos,
  truckHeading,
  yawOffset = 0,
  pitchOffset = 0.15,
  distance = 13.5,
  height = 5.2
}) {
  const [px, py, pz] = truckPos;
  let [fx, fy, fz] = truckHeading;

  // Normalize forward heading
  const len = Math.hypot(fx, fz) || 1;
  fx /= len;
  fz /= len;

  // Backward direction vector relative to truck
  const bx = -fx;
  const bz = -fz;

  // Apply horizontal yaw offset to backward vector:
  // Rotation matrix around Y axis:
  // x' = x*cos(yaw) - z*sin(yaw)
  // z' = x*sin(yaw) + z*cos(yaw)
  const cosYaw = Math.cos(yawOffset);
  const sinYaw = Math.sin(yawOffset);
  const rx = bx * cosYaw - bz * sinYaw;
  const rz = bx * sinYaw + bz * cosYaw;

  // Clamped pitch offset controls height variation
  const clampedPitch = Math.max(-0.35, Math.min(0.65, pitchOffset));
  const effectiveHeight = height + Math.sin(clampedPitch) * (distance * 0.7);
  const effectiveDistance = Math.max(5, distance * Math.cos(clampedPitch));

  const camX = px + rx * effectiveDistance;
  const camY = py + effectiveHeight;
  const camZ = pz + rz * effectiveDistance;

  // Look-at point slightly ahead of the truck cab
  const lookAt = [
    px + fx * 3.5,
    py + 2.0,
    pz + fz * 3.5
  ];

  return {
    position: [camX, camY, camZ],
    lookAt
  };
}

/**
 * Calculates Cockpit Dashcam POV camera position and look-at target.
 * Positioned inside the driver cab looking out over the hood and road.
 *
 * @param {Object} params
 * @param {[number, number, number]} params.truckPos - [x, y, z] position of vehicle
 * @param {[number, number, number]} params.truckHeading - Forward direction vector [fx, fy, fz]
 * @param {number} [params.eyeHeight=2.3] - Driver eye level height
 * @param {number} [params.forwardOffset=2.6] - Position along cab center
 * @returns {{ position: [number, number, number], lookAt: [number, number, number] }}
 */
export function calculateCockpitCameraPosition({
  truckPos,
  truckHeading,
  eyeHeight = 2.3,
  forwardOffset = 2.6
}) {
  const [px, py, pz] = truckPos;
  let [fx, fy, fz] = truckHeading;

  const len = Math.hypot(fx, fz) || 1;
  fx /= len;
  fz /= len;

  const camPos = [
    px + fx * forwardOffset,
    py + eyeHeight,
    pz + fz * forwardOffset
  ];

  const lookAt = [
    px + fx * 30.0,
    py + eyeHeight * 0.9,
    pz + fz * 30.0
  ];

  return {
    position: camPos,
    lookAt
  };
}

/**
 * Calculates Tactical Drone God-View camera position and look-at target.
 * Positioned overhead looking straight down / high-angle pitch.
 *
 * @param {Object} params
 * @param {[number, number, number]} params.truckPos - [x, y, z] position of vehicle
 * @param {number} [params.altitude=52.0] - Drone altitude in units
 * @param {number} [params.pitchBias=6.0] - Slight South offset for perspective depth
 * @returns {{ position: [number, number, number], lookAt: [number, number, number] }}
 */
export function calculateDroneCameraPosition({
  truckPos,
  altitude = 52.0,
  pitchBias = 6.0
}) {
  const [px, py, pz] = truckPos;

  return {
    position: [px, py + altitude, pz + pitchBias],
    lookAt: [px, py, pz]
  };
}
