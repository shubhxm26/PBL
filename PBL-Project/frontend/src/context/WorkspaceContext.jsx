import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  DOCK_SERVICES,
  WORKSPACE_STORAGE_KEY,
  clampCoordinates,
  clampWindowGeometry,
  isServiceAllowed
} from '../constants/dockConfig';

import { usePersona } from './PersonaContext';

const WorkspaceContext = createContext(null);

export function buildDefaultWindows() {
  const isClient = typeof window !== 'undefined';
  const screenWidth = isClient ? window.innerWidth : 1440;
  const screenHeight = isClient ? window.innerHeight : 900;

  const initial = {};
  let currentZ = 10;

  DOCK_SERVICES.forEach((service, index) => {
    // Determine default opening state
    // On first visit: 'kpis' and 'sentinel' are open for an immediate operational command feel
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

export function loadStoredWorkspace() {
  if (typeof window === 'undefined') return buildDefaultWindows();
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return buildDefaultWindows();
    const parsed = JSON.parse(raw);
    const defaults = buildDefaultWindows();

    // Merge parsed with defaults in case new services were added
    const merged = {};
    Object.keys(defaults).forEach((key) => {
      if (parsed[key]) {
        merged[key] = {
          ...defaults[key],
          ...parsed[key],
          position: clampCoordinates(
            parsed[key].position || defaults[key].position,
            parsed[key].size || defaults[key].size,
            window.innerWidth,
            window.innerHeight
          )
        };
      } else {
        merged[key] = defaults[key];
      }
    });
    return merged;
  } catch (err) {
    console.warn('Failed to load workspace state from localStorage:', err);
    return buildDefaultWindows();
  }
}

export function WorkspaceProvider({ children }) {
  const { currentRole, profile } = usePersona();
  const [windows, setWindows] = useState(() => loadStoredWorkspace());
  const [highestZIndex, setHighestZIndex] = useState(25);
  const [activeStageEngine, setActiveStageEngine] = useState('tactical_3d'); // 'tactical_3d' | 'cesium_gis'
  const [cameraMode, setCameraMode] = useState('CHASE'); // 'CHASE' | 'COCKPIT' | 'DRONE' | 'FREE_ORBIT'
  const [pipMinimized, setPipMinimized] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState('DC-BHW-01');
  const [activeVehicleId, setActiveVehicleId] = useState('TRK-MH-01');
  const [activeRoadblocks, setActiveRoadblocks] = useState([]);
  const [simState, setSimState] = useState({
    is_running: false,
    speed_multiplier: 1.0,
    elapsed_seconds: 0,
    elapsed_formatted: '00:00:00',
    simulated_time: '08:00:00 AM'
  });

  // Bi-directional 3D Scene Binding States
  const [flyToTarget, setFlyToTarget] = useState(null); // { type, id, timestamp, options }
  const [highlightedRoute, setHighlightedRoute] = useState(null); // 'main_corridor' | 'southern_corridor' | 'detour_corridor' | 'optimal_vector'
  const [activeFacilityGlow, setActiveFacilityGlow] = useState('DC-BHW-01');
  const [activeIncident, setActiveIncident] = useState(null); // { id, name, location, severity, options }
  const [demandHeatmapOverlay, setDemandHeatmapOverlay] = useState({
    active: false,
    facilityDemands: {
      'PORT-JNPT-01': 4800,
      'DC-BHW-01': 4200,
      'HUB-THN-01': 2100,
      'PASS-KASARA-01': 800,
      'DEP-NSK-01': 3800,
      'FC-PUN-01': 3500
    },
    timestamp: Date.now()
  });
  const [optimalRouteOverlay, setOptimalRouteOverlay] = useState({
    active: false,
    pathCoordinates: [],
    routeName: 'Optimal Multi-Stop Corridor Vector',
    metrics: { distanceKm: 142.8, durationMin: 135, savingsPct: 18.4 },
    timestamp: Date.now()
  });

  const toggleStageEngine = useCallback(() => {
    setActiveStageEngine((prev) => (prev === 'tactical_3d' ? 'cesium_gis' : 'tactical_3d'));
  }, []);

  // Persist to localStorage on modification
  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(windows));
    } catch {
      // ignore storage quota / sandbox issues
    }
  }, [windows]);

  // Adjust window coordinates and geometry on browser viewport resize
  useEffect(() => {
    const handleResize = () => {
      setWindows((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          const win = next[id];
          if (!win.isMaximized) {
            const clamped = clampWindowGeometry(win.position, win.size, window.innerWidth, window.innerHeight);
            if (
              clamped.position.x !== win.position.x ||
              clamped.position.y !== win.position.y ||
              clamped.size.width !== win.size.width ||
              clamped.size.height !== win.size.height
            ) {
              next[id] = {
                ...win,
                position: clamped.position,
                size: clamped.size
              };
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const bringToFront = useCallback((id) => {
    setHighestZIndex((prevMax) => {
      const nextZ = prevMax + 1;
      setWindows((prev) => {
        if (!prev[id] || prev[id].zIndex === nextZ) return prev;
        return {
          ...prev,
          [id]: {
            ...prev[id],
            zIndex: nextZ
          }
        };
      });
      return nextZ;
    });
  }, []);

  const openWindow = useCallback((id) => {
    setHighestZIndex((prevMax) => {
      const nextZ = prevMax + 1;
      setWindows((prev) => {
        const current = prev[id] || buildDefaultWindows()[id];
        return {
          ...prev,
          [id]: {
            ...current,
            isOpen: true,
            isMinimized: false,
            zIndex: nextZ
          }
        };
      });
      return nextZ;
    });
  }, []);

  const closeWindow = useCallback((id) => {
    setWindows((prev) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          isOpen: false
        }
      };
    });
  }, []);

  const minimizeWindow = useCallback((id) => {
    setWindows((prev) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          isMinimized: true
        }
      };
    });
  }, []);

  const restoreWindow = useCallback((id) => {
    setHighestZIndex((prevMax) => {
      const nextZ = prevMax + 1;
      setWindows((prev) => {
        if (!prev[id]) return prev;
        return {
          ...prev,
          [id]: {
            ...prev[id],
            isOpen: true,
            isMinimized: false,
            zIndex: nextZ
          }
        };
      });
      return nextZ;
    });
  }, []);

  const toggleWindow = useCallback((id) => {
    setWindows((prev) => {
      const win = prev[id];
      if (!win || !win.isOpen) {
        // Open it
        const nextZ = highestZIndex + 1;
        setHighestZIndex(nextZ);
        return {
          ...prev,
          [id]: {
            ...(win || buildDefaultWindows()[id]),
            isOpen: true,
            isMinimized: false,
            zIndex: nextZ
          }
        };
      }

      if (win.isMinimized) {
        // Unminimize it
        const nextZ = highestZIndex + 1;
        setHighestZIndex(nextZ);
        return {
          ...prev,
          [id]: {
            ...win,
            isMinimized: false,
            zIndex: nextZ
          }
        };
      }

      // If open & focused at top zIndex -> minimize it
      // If open but not top -> bring to top
      const isTop = win.zIndex >= highestZIndex;
      if (isTop) {
        return {
          ...prev,
          [id]: {
            ...win,
            isMinimized: true
          }
        };
      } else {
        const nextZ = highestZIndex + 1;
        setHighestZIndex(nextZ);
        return {
          ...prev,
          [id]: {
            ...win,
            zIndex: nextZ
          }
        };
      }
    });
  }, [highestZIndex]);

  const toggleMaximize = useCallback((id) => {
    setWindows((prev) => {
      const win = prev[id];
      if (!win) return prev;

      if (!win.isMaximized) {
        // Maximize
        const prevRect = { position: { ...win.position }, size: { ...win.size } };
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440;
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 900;
        return {
          ...prev,
          [id]: {
            ...win,
            isMaximized: true,
            isMinimized: false,
            prevRect,
            position: { x: 12, y: 64 },
            size: { width: screenW - 24, height: screenH - 148 }
          }
        };
      } else {
        // Restore to previous bounds
        const restored = win.prevRect || {
          position: win.position,
          size: win.size
        };
        return {
          ...prev,
          [id]: {
            ...win,
            isMaximized: false,
            position: restored.position,
            size: restored.size,
            prevRect: null
          }
        };
      }
    });
  }, []);

  const updatePosition = useCallback((id, x, y) => {
    setWindows((prev) => {
      const win = prev[id];
      if (!win || win.isMaximized) return prev;
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 900;
      const clamped = clampCoordinates({ x, y }, win.size, screenW, screenH);
      return {
        ...prev,
        [id]: {
          ...win,
          position: clamped
        }
      };
    });
  }, []);

  const updateSize = useCallback((id, width, height) => {
    setWindows((prev) => {
      const win = prev[id];
      if (!win || win.isMaximized) return prev;
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 900;
      const newWidth = Math.max(340, Math.min(width, screenW - 24));
      const newHeight = Math.max(260, Math.min(height, screenH - 120));
      const clamped = clampCoordinates(win.position, { width: newWidth, height: newHeight }, screenW, screenH);
      return {
        ...prev,
        [id]: {
          ...win,
          position: clamped,
          size: { width: newWidth, height: newHeight }
        }
      };
    });
  }, []);

  const resetLayout = useCallback(() => {
    const defaults = buildDefaultWindows();
    setWindows(defaults);
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(defaults));
    } catch {
      // ignore
    }
  }, []);

  const minimizeAll = useCallback(() => {
    setWindows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (next[id].isOpen) {
          next[id] = { ...next[id], isMinimized: true };
        }
      });
      return next;
    });
  }, []);

  const restoreAll = useCallback(() => {
    setWindows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (next[id].isOpen) {
          next[id] = { ...next[id], isMinimized: false };
        }
      });
      return next;
    });
  }, []);

  // Quick helper to check if a service is allowed for current persona
  const isAllowed = useCallback((viewRequired) => {
    return isServiceAllowed(currentRole, profile?.permissions, viewRequired);
  }, [currentRole, profile]);

  // Bi-directional 3D Scene Binding Action Dispatchers
  const trigger3DFlyTo = useCallback((typeOrObj, maybeId, extra = {}) => {
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

    setFlyToTarget({
      type,
      id,
      extra: options,
      timestamp: Date.now()
    });

    if (type === 'facility') {
      setSelectedFacilityId(id);
      setActiveFacilityGlow(id);
    } else if (type === 'vehicle') {
      setActiveVehicleId(id);
    } else if (type === 'route') {
      setHighlightedRoute(id);
    } else if (type === 'incident') {
      setActiveIncident(options.incident || { id, name: 'Disruption Zone Alert' });
    }
  }, []);

  const selectFacility = useCallback((facilityId, extra = {}) => {
    setSelectedFacilityId(facilityId);
    setActiveFacilityGlow(facilityId);
    trigger3DFlyTo('facility', facilityId, extra);
  }, [trigger3DFlyTo]);

  const selectVehicle = useCallback((vehicleId, extra = {}) => {
    setActiveVehicleId(vehicleId);
    trigger3DFlyTo('vehicle', vehicleId, extra);
  }, [trigger3DFlyTo]);

  const selectIncident = useCallback((incident, extra = {}) => {
    const incObj = typeof incident === 'string'
      ? { id: incident, name: 'Kasara Mountain Pass Disruption', location: 'Kasara Ghat NH-160' }
      : incident;
    setActiveIncident(incObj);
    trigger3DFlyTo('incident', incObj.id, { incident: incObj, ...extra });
    // Also ensure Autonomous Sentinel panel is open and focused for immediate mitigation view
    openWindow('sentinel');
    bringToFront('sentinel');
  }, [bringToFront, openWindow, trigger3DFlyTo]);

  const triggerMlPrediction = useCallback((skuId, forecastResult) => {
    // Generate facility-specific demand distribution from ML prediction result
    const baseDemand = forecastResult?.summary?.mean_daily_demand || 420;
    const demands = {
      'PORT-JNPT-01': Math.round(baseDemand * 11.2),
      'DC-BHW-01': Math.round(baseDemand * 9.8),
      'HUB-THN-01': Math.round(baseDemand * 5.4),
      'PASS-KASARA-01': Math.round(baseDemand * 2.1),
      'DEP-NSK-01': Math.round(baseDemand * 8.6),
      'FC-PUN-01': Math.round(baseDemand * 7.9)
    };
    setDemandHeatmapOverlay({
      active: true,
      skuId,
      facilityDemands: demands,
      timestamp: Date.now()
    });
  }, []);

  const triggerRouteOptimization = useCallback((routeResult) => {
    const defaultCoords = [
      [-44, 0.8, 32],   // JNPT Port
      [-14, 0.8, 2],    // Bhiwandi Central DC
      [-24, 0.8, 16],   // Thane Hub
      [14, 9.8, -24],   // Kasara Ghat
      [42, 6.8, -48]    // Nashik Agro Depot
    ];
    setOptimalRouteOverlay({
      active: true,
      pathCoordinates: routeResult?.optimal_coordinates || defaultCoords,
      routeName: routeResult?.route_name || 'Computed Optimal Multi-Stop Vector',
      metrics: {
        distanceKm: routeResult?.total_distance_km || 142.8,
        durationMin: routeResult?.total_duration_mins || 135,
        savingsPct: routeResult?.fuel_saved_pct || 18.4
      },
      timestamp: Date.now()
    });
    setHighlightedRoute('optimal_vector');
  }, []);

  const value = useMemo(() => ({
    windows,
    highestZIndex,
    activeStageEngine,
    setActiveStageEngine,
    toggleStageEngine,
    cameraMode,
    setCameraMode,
    clampWindowGeometry,
    pipMinimized,
    setPipMinimized,
    selectedFacilityId,
    setSelectedFacilityId,
    activeVehicleId,
    setActiveVehicleId,
    activeRoadblocks,
    setActiveRoadblocks,
    simState,
    setSimState,
    flyToTarget,
    setFlyToTarget,
    trigger3DFlyTo,
    highlightedRoute,
    setHighlightedRoute,
    activeFacilityGlow,
    setActiveFacilityGlow,
    activeIncident,
    setActiveIncident,
    demandHeatmapOverlay,
    setDemandHeatmapOverlay,
    optimalRouteOverlay,
    setOptimalRouteOverlay,
    selectFacility,
    selectVehicle,
    selectIncident,
    triggerMlPrediction,
    triggerRouteOptimization,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleWindow,
    toggleMaximize,
    updatePosition,
    updateSize,
    bringToFront,
    resetLayout,
    minimizeAll,
    restoreAll,
    isAllowed
  }), [
    windows,
    highestZIndex,
    activeStageEngine,
    setActiveStageEngine,
    toggleStageEngine,
    cameraMode,
    setCameraMode,
    pipMinimized,
    selectedFacilityId,
    activeVehicleId,
    activeRoadblocks,
    simState,
    flyToTarget,
    trigger3DFlyTo,
    highlightedRoute,
    activeFacilityGlow,
    activeIncident,
    demandHeatmapOverlay,
    optimalRouteOverlay,
    selectFacility,
    selectVehicle,
    selectIncident,
    triggerMlPrediction,
    triggerRouteOptimization,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleWindow,
    toggleMaximize,
    updatePosition,
    updateSize,
    bringToFront,
    resetLayout,
    minimizeAll,
    restoreAll,
    isAllowed
  ]);


  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
