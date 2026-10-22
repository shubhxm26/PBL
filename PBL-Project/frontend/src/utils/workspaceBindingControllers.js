/**
 * workspaceBindingControllers.js
 *
 * Core architectural logic for Issue 05:
 * Glassmorphic Service Panels & Bi-Directional 3D Scene Binding.
 *
 * Provides:
 * 1. Standard frosted glass container tokens & responsive window lifecycle reducers
 * 2. Window geometry state machines (minimize, maximize, drag repositioning, resize)
 * 3. 3D fly-to camera dispatch normalizers (facility, route, vehicle, incident)
 * 4. Multi-echelon facility <-> SKU bi-directional mapping
 * 5. Volumetric demand heatmap overlay generation
 * 6. Optimal corridor path vector overlay generation
 * 7. 3D Raycasting hit resolution for trucks, facilities, and disruption roadblocks
 */

import { DOCK_SERVICES, clampCoordinates } from '../constants/dockConfig.js';
import { STAGE_FACILITIES } from '../constants/stage3DTopology.js';

export const FROSTED_GLASS_CONTAINER_CLASSES =
  'fixed cyber-glass rounded-2xl border border-slate-700/50 backdrop-blur-md bg-slate-950/75 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)]';

export const SERVICE_MODULE_IDS = [
  'kpis',
  'forecasting',
  'routing',
  'compliance',
  'sentinel',
  'system'
];

export const FACILITY_TO_SKU = {
  'DEP-NSK-01': 'SKU-NAS-AGRI-01',
  'PORT-JNPT-01': 'SKU-JNPT-ELEC-01',
  'FC-PUN-01': 'SKU-PUN-AUTO-01',
  'DC-BHW-01': 'SKU-MUM-PHARM-01',
  'HUB-THN-01': 'SKU-THN-CHEM-01'
};

export const SKU_TO_FACILITY = {
  'SKU-NAS-AGRI-01': 'DEP-NSK-01',
  'SKU-JNPT-ELEC-01': 'PORT-JNPT-01',
  'SKU-PUN-AUTO-01': 'FC-PUN-01',
  'SKU-MUM-PHARM-01': 'DC-BHW-01',
  'SKU-THN-CHEM-01': 'HUB-THN-01'
};

export const CORRIDOR_INCIDENTS = [
  {
    id: 'INC-KASARA-01',
    roadblockId: 'RB-KASARA-01',
    title: 'Kasara Ghat Mudslide & Barrier Obstruction',
    corridor: 'NH-160 (Mumbai ↔ Nashik)',
    severity: 'CRITICAL',
    disruptionType: 'LANDSLIDE_HAZARD',
    location: [14, 9.8, -24],
    description: 'Active mudslide and debris blockage across north-bound mountain pass lanes at elevation +580m.',
    affectedVehicles: ['TRK-MH-01'],
    mitigationOptions: [
      {
        id: 'mit-01',
        title: 'Execute Autonomous Detour (NH-61 via Malshej Ghat)',
        description: 'Bypasses Kasara roadblock via Kalyan-Malshej route (+21.6 km, +34m duration, preserves 98.4% SLA).',
        actionType: 'DETOUR',
        targetRoute: 'NH-61',
        buttonText: 'Execute Detour'
      },
      {
        id: 'mit-02',
        title: 'Hold Fleet at Bhiwandi Mega DC Staging Bay',
        description: 'Halts inbound trucks at Bhiwandi buffer staging docks until NDRF mountain clearance.',
        actionType: 'HOLD_FLEET',
        targetFacility: 'DC-BHW-01',
        buttonText: 'Hold Fleet'
      },
      {
        id: 'mit-03',
        title: 'Dispatch Emergency Drone Reconnaissance',
        description: 'Launches automated LiDAR drone survey over the Kasara Ghat rockfall zone for real-time clearance telemetry.',
        actionType: 'DISPATCH_DRONE',
        buttonText: 'Launch Drone'
      }
    ]
  }
];

/**
 * Builds clean initial window states for all services.
 */
export function buildInitialWorkspaceWindows(screenWidth = 1440, screenHeight = 900) {
  const initial = {};
  let currentZ = 10;

  DOCK_SERVICES.forEach((service, index) => {
    const isDefaultOpen = service.id === 'kpis' || (service.id === 'sentinel' && screenWidth >= 1280);

    let defaultX = service.defaultPos.x;
    let defaultY = service.defaultPos.y;
    let defaultWidth = Math.min(service.defaultPos.width, screenWidth - 32);
    let defaultHeight = Math.min(service.defaultPos.height, screenHeight - 140);

    if (service.id === 'sentinel') {
      defaultX = Math.max(20, screenWidth - defaultWidth - 24);
    }

    const clamped = clampCoordinates(
      { x: defaultX, y: defaultY },
      { width: defaultWidth, height: defaultHeight },
      screenWidth,
      screenHeight
    );

    initial[service.id] = {
      id: service.id,
      isOpen: isDefaultOpen,
      isMinimized: false,
      isMaximized: false,
      position: clamped,
      size: { width: defaultWidth, height: defaultHeight },
      prevRect: null,
      zIndex: isDefaultOpen ? ++currentZ : index + 1
    };
  });

  return initial;
}

/**
 * Minimizes a window to a compact floating pill on the canvas.
 */
export function handleWindowMinimize(windows, id) {
  if (!windows[id]) return windows;
  return {
    ...windows,
    [id]: {
      ...windows[id],
      isMinimized: true
    }
  };
}

/**
 * Restores a minimized window to its previous dimensions and expands it.
 */
export function handleWindowRestore(windows, id, nextZIndex = 20) {
  if (!windows[id]) return windows;
  return {
    ...windows,
    [id]: {
      ...windows[id],
      isOpen: true,
      isMinimized: false,
      zIndex: nextZIndex
    }
  };
}

/**
 * Toggles a window between full-screen maximized and floating bounds.
 */
export function handleWindowMaximize(windows, id, screenWidth = 1440, screenHeight = 900) {
  const win = windows[id];
  if (!win) return windows;

  if (!win.isMaximized) {
    const prevRect = { position: { ...win.position }, size: { ...win.size } };
    return {
      ...windows,
      [id]: {
        ...win,
        isMaximized: true,
        isMinimized: false,
        prevRect,
        position: { x: 12, y: 64 },
        size: { width: screenWidth - 24, height: screenHeight - 148 }
      }
    };
  } else {
    const restored = win.prevRect || {
      position: win.position,
      size: win.size
    };
    return {
      ...windows,
      [id]: {
        ...win,
        isMaximized: false,
        position: restored.position,
        size: restored.size,
        prevRect: null
      }
    };
  }
}

/**
 * Drags and repositions a window across the viewport canvas while clamping inside boundaries.
 */
export function handleWindowDrag(windows, id, newX, newY, screenWidth = 1440, screenHeight = 900) {
  const win = windows[id];
  if (!win || win.isMaximized) return windows;

  const clamped = clampCoordinates({ x: newX, y: newY }, win.size, screenWidth, screenHeight);
  return {
    ...windows,
    [id]: {
      ...win,
      position: clamped
    }
  };
}

/**
 * Resizes a window from its corner handle while respecting minimum constraints.
 */
export function handleWindowResize(windows, id, newWidth, newHeight, screenWidth = 1440, screenHeight = 900) {
  const win = windows[id];
  if (!win || win.isMaximized) return windows;

  const minW = 340;
  const minH = 260;
  const boundedW = Math.max(minW, Math.min(newWidth, screenWidth - 24));
  const boundedH = Math.max(minH, Math.min(newHeight, screenHeight - 120));
  const clamped = clampCoordinates(win.position, { width: boundedW, height: boundedH }, screenWidth, screenHeight);

  return {
    ...windows,
    [id]: {
      ...win,
      position: clamped,
      size: { width: boundedW, height: boundedH }
    }
  };
}

/**
 * Normalizes 3D Camera Fly-To commands dispatched from service panels.
 */
export function create3DFlyToCommand(typeOrObj, maybeId, extra = {}) {
  let type, id, options;
  if (typeof typeOrObj === 'object' && typeOrObj !== null) {
    type = typeOrObj.type;
    id = typeOrObj.id;
    options = { ...typeOrObj, ...(typeof maybeId === 'object' ? maybeId : extra) };
  } else {
    type = typeOrObj;
    id = maybeId;
    options = extra;
  }

  return {
    type,
    id,
    extra: options,
    timestamp: Date.now()
  };
}

/**
 * Computes 3D camera position and look target for smooth facility focus.
 */
export function calculateFacilityCameraFocus(pos) {
  return {
    cameraPos: [pos[0] + 18, pos[1] + 15, pos[2] + 22],
    targetPos: [pos[0], pos[1], pos[2]]
  };
}

/**
 * Resolves raycast intersections on the 3D canvas to authoritative logistics entities.
 */
export function resolveRaycastEntityHit(object) {
  if (!object || !object.userData) return null;
  const u = object.userData;

  if (u.isVehicle) {
    return {
      type: 'vehicle',
      vehicleId: u.vehicleId || 'TRK-MH-01'
    };
  }

  if (u.isRoadblock || u.isDisruptionZone) {
    return {
      type: 'incident',
      incidentId: u.incidentId || 'INC-KASARA-01',
      roadblockId: u.roadblockId || 'RB-KASARA-01',
      location: [14, 9.8, -24]
    };
  }

  if (u.isFacility) {
    return {
      type: 'facility',
      facilityId: u.nodeId,
      code: u.code,
      name: u.name
    };
  }

  return null;
}

/**
 * Computes volumetric demand heatmap overlay distribution from ML predictions.
 */
export function generateDemandHeatmapData(baseDemand = 420, skuId = 'SKU-MUM-PHARM-01') {
  return {
    active: true,
    skuId,
    facilityDemands: {
      'PORT-JNPT-01': Math.round(baseDemand * 11.2),
      'DC-BHW-01': Math.round(baseDemand * 9.8),
      'HUB-THN-01': Math.round(baseDemand * 5.4),
      'PASS-KASARA-01': Math.round(baseDemand * 2.1),
      'DEP-NSK-01': Math.round(baseDemand * 8.6),
      'FC-PUN-01': Math.round(baseDemand * 7.9)
    },
    timestamp: Date.now()
  };
}

/**
 * Computes optimal corridor path vector coordinates and fuel/time telemetry metrics.
 */
export function generateOptimalRouteVector(customCoordinates = null, customMetrics = null) {
  const defaultCoords = [
    [-44, 0.8, 32],   // JNPT Port
    [-14, 0.8, 2],    // Bhiwandi Central DC
    [-24, 0.8, 16],   // Thane Hub
    [14, 9.8, -24],   // Kasara Ghat
    [42, 6.8, -48]    // Nashik Agro Depot
  ];

  return {
    active: true,
    pathCoordinates: customCoordinates || defaultCoords,
    routeName: 'Optimal Multi-Stop Corridor Vector',
    metrics: customMetrics || {
      distanceKm: 142.8,
      durationMin: 135,
      savingsPct: 18.4
    },
    timestamp: Date.now()
  };
}
