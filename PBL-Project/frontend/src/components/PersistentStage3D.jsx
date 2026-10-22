import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Compass,
  Maximize2,
  Minimize2,
  Radio,
  Layers,
  Activity,
  RotateCcw,
  Eye,
  Truck,
  Mountain,
  Anchor,
  Warehouse,
  Sparkles,
  ChevronRight,
  Info,
  Video,
  Navigation,
  Gauge,
  Thermometer,
  BatteryCharging,
  Play,
  Pause,
  FastForward,
  Rotate3d,
  Crosshair,
  Globe,
  ArrowLeftRight
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import CesiumTwinViewport from './CesiumTwinViewport';
import ViewportEngineSelector from './ViewportEngineSelector';
import {
  STAGE_ENGINES,
  ENGINE_METADATA,
  mapFacilityBetweenEngines,
  calculateSynchronizedVehicleState
} from '../utils/engineSynchronization';
import { worldToWgs84Coordinates } from '../utils/coordinateTransforms';
import {
  STAGE_NODES,
  STAGE_FACILITIES,
  CAMERA_VIEWS,
  PUNE_FC_NODE
} from '../constants/stage3DTopology.js';
import {
  CAMERA_MODES,
  CAMERA_MODE_METADATA,
  calculateChaseCameraPosition,
  calculateCockpitCameraPosition,
  calculateDroneCameraPosition,
  dampArray3
} from '../utils/cameraControllers.js';
import {
  buildCorridorSplines,
  createExtrudedHighwayRibbon,
  createTrafficPulses,
  createKasaraElevationTerrain,
  createCorridorLogisticsNodes
} from './3d/proceduralWorld.js';
import { createProceduralTruck, createRoadblockBarricade } from './3d/proceduralModels.js';
import CockpitHUD from './CockpitHUD';
import {
  disposeThreeScene,
  setupContextLossHandlers,
  shouldThrottleRender,
  isWebGLAvailable,
  ensureSafeShaderPrecisionFormat
} from '../utils/webglHardening.js';
import { useGlobalKeyboardShortcuts } from '../utils/keyboardShortcuts.js';


export {
  STAGE_NODES,
  STAGE_FACILITIES,
  CAMERA_VIEWS,
  CAMERA_MODES,
  CAMERA_MODE_METADATA
};

const ICON_MAP = {
  Anchor,
  Warehouse,
  Mountain
};

export default function PersistentStage3D({ onSelectNode }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const cesiumContainerRef = useRef(null);
  const {
    activeStageEngine,
    setActiveStageEngine,
    toggleStageEngine,
    cameraMode: workspaceCameraMode,
    setCameraMode: setWorkspaceCameraMode,
    minimizeAll,
    pipMinimized,
    setPipMinimized,
    selectedFacilityId,
    setSelectedFacilityId,
    activeVehicleId = 'TRK-MH-01',
    setActiveVehicleId,
    activeRoadblocks = [],
    setActiveRoadblocks,
    simState,
    flyToTarget,
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
    selectIncident
  } = useWorkspace();

  // Reactive UI State
  const [fps, setFps] = useState(60);
  const [cameraMode, setCameraMode] = useState(CAMERA_MODES.CHASE);
  const effectiveCameraMode = workspaceCameraMode || cameraMode;
  const setEffectiveCameraMode = useCallback((mode) => {
    setCameraMode(mode);
    if (setWorkspaceCameraMode) setWorkspaceCameraMode(mode);
  }, [setWorkspaceCameraMode]);

  const [activeCamView, setActiveCamView] = useState('CHASE');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [cameraCoords, setCameraCoords] = useState({ x: 0, y: 15, z: 20 });
  const [hudMinimized, setHudMinimized] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [webglError, setWebglError] = useState(null);
  const isContextLostRef = useRef(false);


  // Synchronized Vehicle WGS84 GPS State
  const [vehicleGps, setVehicleGps] = useState({
    id: 'TRK-MH-01',
    model: 'Volvo FH Electric (Cold-Chain)',
    progress: 0.08,
    speedKmh: 64,
    latitude: 18.9496,
    longitude: 72.9515,
    altitudeM: 5,
    headingDeg: 38
  });

  // Three.js internal references for 60 FPS animation loop
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraModeRef = useRef(CAMERA_MODES.CHASE);
  const simSpeedRef = useRef(1);
  const isPausedRef = useRef(false);

  // Active Vehicle & Roadblock sync references
  const activeVehicleIdRef = useRef('TRK-MH-01');
  const activeRoadblocksRef = useRef([]);

  // Bi-directional 3D Overlay & Binding Refs
  const highlightedRouteRef = useRef(null);
  const activeFacilityGlowRef = useRef('DC-BHW-01');
  const activeIncidentRef = useRef(null);
  const demandHeatmapOverlayRef = useRef(demandHeatmapOverlay);
  const optimalRouteOverlayRef = useRef(optimalRouteOverlay);

  const disruptionZoneGroupRef = useRef(null);
  const demandHeatmapGroupRef = useRef(null);
  const optimalPathGroupRef = useRef(null);
  const facilitiesMapRef = useRef({});
  const highwayRibbonsRef = useRef({});

  // Multi-vehicle trajectory and mesh references
  const truck1GroupRef = useRef(null);
  const truck2GroupRef = useRef(null);
  const roadblockGroupRef = useRef(null);
  const corridorCurveRef = useRef(null);
  const detourCurveRef = useRef(null);
  const southernCurveRef = useRef(null);

  // TRK-MH-01 (Reefer, Nashik Corridor / Malshej Detour)
  const truck1StateRef = useRef({
    progress: 0.12,
    speed: 0.00065,
    pos: [0, 0, 0],
    look: [0, 0, 0],
    heading: [0, 0, 1]
  });

  // TRK-MH-02 (EV Express Carrier, Pune Corridor)
  const truck2StateRef = useRef({
    progress: 0.22,
    speed: 0.00072,
    pos: [0, 0, 0],
    look: [0, 0, 0],
    heading: [0, 0, 1]
  });

  // Free-look orbit parameters when in Chase Cam mode
  const freeLookRef = useRef({
    isDragging: false,
    yaw: 0,
    pitch: 0.15,
    distance: 14.0,
    prevX: 0,
    prevY: 0
  });

  // Free Orbit parameters when in Orbit Inspection mode
  const orbitStateRef = useRef({
    isDragging: false,
    dragButton: 0,
    prevX: 0,
    prevY: 0,
    target: new THREE.Vector3(0, 4, -8)
  });

  // Damped camera interpolation vectors
  const dampedCamPosRef = useRef([0, 20, 30]);
  const dampedLookTargetRef = useRef([0, 4, -8]);

  const pulsesRef = useRef([]);
  const ringsRef = useRef([]);
  const animFrameIdRef = useRef(null);

  // Keep refs synchronized with state
  useEffect(() => {
    activeVehicleIdRef.current = activeVehicleId || 'TRK-MH-01';
  }, [activeVehicleId]);

  useEffect(() => {
    activeRoadblocksRef.current = activeRoadblocks || [];
  }, [activeRoadblocks]);

  useEffect(() => {
    if (simState) {
      simSpeedRef.current = simState.speed_multiplier || 1.0;
      isPausedRef.current = !simState.is_running;
      setSimSpeed(simState.speed_multiplier || 1.0);
      setIsPaused(!simState.is_running);
    }
  }, [simState]);

  useEffect(() => {
    cameraModeRef.current = effectiveCameraMode;
  }, [effectiveCameraMode]);


  // Initialize Three.js 3D Procedural Logistics World
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    // 0. Ensure WebGL shader precision format safety is applied
    ensureSafeShaderPrecisionFormat();

    // Verify WebGL context availability in current browser runtime (using clean test)
    if (!isWebGLAvailable()) {
      console.warn('[PersistentStage3D] WebGL hardware acceleration unavailable. Engaging 2D tactical schematic mode.');
      setWebglError('Hardware WebGL acceleration unavailable');
      return;
    }

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // 1. Cyber-Physical Dark Obsidian Atmosphere
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.FogExp2(0x020617, 0.0065);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.4, 600);
    camera.position.set(-20, 18, 38);
    camera.lookAt(0, 4, -8);
    cameraRef.current = camera;
    dampedCamPosRef.current = [-20, 18, 38];
    dampedLookTargetRef.current = [0, 4, -8];

    // 3. WebGL Renderer with High-Performance Config and Failure Protection
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: false,
        powerPreference: 'default',
        precision: 'mediump',
        stencil: false,
        depth: true
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      rendererRef.current = renderer;
      setWebglError(null);
    } catch (err) {
      console.warn('[PersistentStage3D] WebGLRenderer creation failed:', err);
      setWebglError(err?.message || 'WebGL context initialization failed');
      disposeThreeScene(scene);
      return;
    }

    // 4. Lighting Suite: Steady Ambient + Cyber Ground Rims + Sun
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xe2e8f0, 2.6);
    sunLight.position.set(50, 75, 45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 250;
    sunLight.shadow.camera.left = -70;
    sunLight.shadow.camera.right = 70;
    sunLight.shadow.camera.top = 70;
    sunLight.shadow.camera.bottom = -70;
    scene.add(sunLight);

    // Neon Cyber Ground Bounce Lights
    const cyanRim = new THREE.DirectionalLight(0x06b6d4, 1.8);
    cyanRim.position.set(-60, -10, -60);
    scene.add(cyanRim);

    const orangeRim = new THREE.DirectionalLight(0xff5400, 1.5);
    orangeRim.position.set(60, -5, 60);
    scene.add(orangeRim);

    // 5. Ground Coordinate Spatial Grid
    const gridHelper = new THREE.GridHelper(300, 60, 0x0284c7, 0x1e293b);
    gridHelper.position.y = -0.15;
    scene.add(gridHelper);

    // 6. Floating Cyber Dust Motes / Ambient Particles
    const particleCount = 700;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 260;
      particlePositions[i + 1] = Math.random() * 55;
      particlePositions[i + 2] = (Math.random() - 0.5) * 260;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.65,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 7. Kasara Ghat 3D Elevation Gradient Mountain Topography
    const kasaraElevationGroup = createKasaraElevationTerrain();
    scene.add(kasaraElevationGroup);

    // 8. Procedural Extruded Highway Ribbons from real WGS84 GPS corridor waypoints
    const { mainCorridorCurve, southernCurve, bypassCurve, fullDetourCurve } = buildCorridorSplines();
    corridorCurveRef.current = mainCorridorCurve;
    detourCurveRef.current = fullDetourCurve;
    southernCurveRef.current = southernCurve;

    // Main Corridor Ribbon (JNPT -> Bhiwandi -> Kasara -> Nashik)
    const mainRoadRibbon = createExtrudedHighwayRibbon(mainCorridorCurve, {
      roadWidth: 1.8,
      roadSegments: 260,
      glowColor: 0x00e5ff,
      shoulderColor: 0xff5400
    });
    scene.add(mainRoadRibbon);

    // Southern Spur Road Ribbon (Bhiwandi -> Pune)
    let southRoadRibbon = null;
    if (southernCurve) {
      southRoadRibbon = createExtrudedHighwayRibbon(southernCurve, {
        roadWidth: 1.6,
        roadSegments: 180,
        glowColor: 0x3b82f6,
        shoulderColor: 0x06b6d4
      });
      scene.add(southRoadRibbon);
    }

    // Bypass Corridor Ribbon (Malshej Ghat Detour Route)
    let bypassRoadRibbon = null;
    if (bypassCurve) {
      bypassRoadRibbon = createExtrudedHighwayRibbon(bypassCurve, {
        roadWidth: 1.5,
        roadSegments: 160,
        glowColor: 0xffb703,
        shoulderColor: 0xff5400
      });
      scene.add(bypassRoadRibbon);
    }

    highwayRibbonsRef.current = {
      main_corridor: mainRoadRibbon,
      southern_corridor: southRoadRibbon,
      detour_corridor: bypassRoadRibbon
    };

    // 9. Animated Traffic Flow Light Pulses along highway lanes
    const { group: pulsesGroup, pulses } = createTrafficPulses(mainCorridorCurve, 10);
    scene.add(pulsesGroup);
    pulsesRef.current = pulses;

    // 10. Procedural 3D Logistics Structures at all Key Nodes
    const { group: facilitiesGroup, rings, facilitiesMap } = createCorridorLogisticsNodes();
    scene.add(facilitiesGroup);
    ringsRef.current = rings;
    facilitiesMapRef.current = facilitiesMap;

    // 11. 3D Procedural Roadblock Barricade at Kasara Ghat Mountain Pass
    const roadblockBarricade = createRoadblockBarricade({
      pos: [14, 9.8, -24],
      rotationY: 0.45
    });
    roadblockBarricade.visible = false;
    scene.add(roadblockBarricade);
    roadblockGroupRef.current = roadblockBarricade;

    // 12. Kasara Ghat Disruption Hazard Zone (Aura Sphere & Shockwave Ring)
    const disruptionZoneGroup = new THREE.Group();
    disruptionZoneGroup.position.set(14, 9.8, -24);
    const hazardSphereGeo = new THREE.SphereGeometry(7.5, 24, 24);
    const hazardSphereMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.22,
      wireframe: true
    });
    const hazardSphere = new THREE.Mesh(hazardSphereGeo, hazardSphereMat);
    hazardSphere.userData = { isDisruptionZone: true, incidentId: 'INC-KASARA-01' };
    disruptionZoneGroup.add(hazardSphere);

    const hazardRingGeo = new THREE.RingGeometry(5.5, 7.8, 32);
    const hazardRingMat = new THREE.MeshBasicMaterial({
      color: 0xff1744,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    const hazardRing = new THREE.Mesh(hazardRingGeo, hazardRingMat);
    hazardRing.rotation.x = -Math.PI / 2;
    hazardRing.position.y = 0.15;
    hazardRing.userData = { isDisruptionZone: true, incidentId: 'INC-KASARA-01' };
    disruptionZoneGroup.add(hazardRing);
    disruptionZoneGroup.visible = false;
    scene.add(disruptionZoneGroup);
    disruptionZoneGroupRef.current = disruptionZoneGroup;

    // 13. 3D Volumetric Demand Heatmap Pillars (Over Corridor Facilities)
    const demandHeatmapGroup = new THREE.Group();
    demandHeatmapGroup.name = 'VolumetricDemandHeatmapOverlays';
    STAGE_FACILITIES.forEach((facility) => {
      const defaultDemands = {
        'PORT-JNPT-01': 4800,
        'DC-BHW-01': 4200,
        'HUB-THN-01': 2100,
        'PASS-KASARA-01': 800,
        'DEP-NSK-01': 3800,
        'FC-PUN-01': 3500
      };
      const demandVal = demandHeatmapOverlayRef.current?.facilityDemands?.[facility.id] || defaultDemands[facility.id] || 3000;
      const pillarHeight = Math.max(4.0, (demandVal / 1000) * 3.8);
      const isHigh = demandVal > 4000;
      const isMid = demandVal > 2500;
      const pillarColor = isHigh ? 0xff5400 : isMid ? 0xffb703 : 0x06b6d4;

      const pillarGeo = new THREE.CylinderGeometry(2.4, 2.8, pillarHeight, 16, 1, false);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: pillarColor,
        emissive: pillarColor,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.65,
        roughness: 0.3,
        metalness: 0.7
      });
      const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
      pillarMesh.position.set(facility.pos[0], facility.pos[1] + pillarHeight / 2, facility.pos[2]);

      const capRingGeo = new THREE.RingGeometry(2.2, 2.6, 24);
      const capRingMat = new THREE.MeshBasicMaterial({
        color: pillarColor,
        side: THREE.DoubleSide
      });
      const capRing = new THREE.Mesh(capRingGeo, capRingMat);
      capRing.rotation.x = -Math.PI / 2;
      capRing.position.set(facility.pos[0], facility.pos[1] + pillarHeight + 0.1, facility.pos[2]);

      pillarMesh.userData = { isHeatmapPillar: true, facilityId: facility.id, baseHeight: pillarHeight };
      demandHeatmapGroup.add(pillarMesh);
      demandHeatmapGroup.add(capRing);
    });
    demandHeatmapGroup.visible = Boolean(demandHeatmapOverlayRef.current?.active);
    scene.add(demandHeatmapGroup);
    demandHeatmapGroupRef.current = demandHeatmapGroup;

    // 14. 3D Optimal Path Vector Spline Overlay
    const optimalPathGroup = new THREE.Group();
    optimalPathGroup.name = 'OptimalPathVectorSpline';
    const optimalSplineCurve = mainCorridorCurve;
    const optimalTubeGeo = new THREE.TubeGeometry(optimalSplineCurve, 260, 0.32, 8, false);
    const optimalTubeMat = new THREE.MeshBasicMaterial({
      color: 0x00e676,
      transparent: true,
      opacity: 0.95
    });
    const optimalTubeMesh = new THREE.Mesh(optimalTubeGeo, optimalTubeMat);
    optimalTubeMesh.position.y += 2.0;
    optimalPathGroup.add(optimalTubeMesh);

    // Traveling Vector Light Pulse Packets along Optimal Path
    const optimalPulses = [];
    for (let p = 0; p < 8; p++) {
      const pGeo = new THREE.SphereGeometry(0.55, 12, 12);
      const pMat = new THREE.MeshBasicMaterial({
        color: 0xffd600, // Golden pulse
        transparent: true,
        opacity: 0.95
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      optimalPathGroup.add(pMesh);
      optimalPulses.push({ mesh: pMesh, offset: p / 8, speed: 0.14 });
    }
    optimalPathGroup.pulses = optimalPulses;
    optimalPathGroup.curve = optimalSplineCurve;
    optimalPathGroup.visible = Boolean(optimalRouteOverlayRef.current?.active);
    scene.add(optimalPathGroup);
    optimalPathGroupRef.current = optimalPathGroup;

    // 15. Commercial Freight Fleet Vehicles
    // Truck 1: TRK-MH-01 Reefer (Nashik Corridor, Cold-Chain Vaccines)
    const truck1Group = createProceduralTruck({
      vehicleId: 'TRK-MH-01',
      cabColor: 0xff5400,
      trailerColor: 0xf8fafc,
      beaconColor: 0x10b981
    });
    scene.add(truck1Group);
    truck1GroupRef.current = truck1Group;

    // Truck 2: TRK-MH-02 EV Carrier (Pune Expressway, High-Tech Electronics)
    const truck2Group = createProceduralTruck({
      vehicleId: 'TRK-MH-02',
      cabColor: 0x06b6d4,
      trailerColor: 0x1e293b,
      beaconColor: 0x3b82f6
    });
    scene.add(truck2Group);
    truck2GroupRef.current = truck2Group;

    // 13. 60 FPS Render & Animation Loop
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsAccumulator = 0;
    let telematicsThrottle = 0;

    const animate = (time) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Throttling guard: throttle when document is hidden, context lost, or hidden
      if (shouldThrottleRender({
        documentHidden: typeof document !== 'undefined' && document.hidden,
        isContextLost: isContextLostRef.current,
        isEnginePrimary: activeStageEngine === STAGE_ENGINES.TACTICAL_3D,
        isPiPVisible: !pipMinimized
      })) {
        lastTime = time;
        return;
      }

      const delta = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;


      // FPS tracking
      frameCount++;
      fpsAccumulator += delta;
      if (fpsAccumulator >= 0.5) {
        setFps(Math.round(frameCount / fpsAccumulator));
        frameCount = 0;
        fpsAccumulator = 0;
      }

      // Rotate ambient cyber particles
      particleSystem.rotation.y += 0.0003;

      // Animate highway traffic flow pulses
      pulsesRef.current.forEach((pulse) => {
        pulse.offset = (pulse.offset + delta * pulse.speed) % 1.0;
        const clampedOffset = Math.min(0.9999, Math.max(0, pulse.offset));
        const pt = mainCorridorCurve.getPointAt(clampedOffset);
        if (pt) {
          pulse.mesh.position.copy(pt);
          pulse.mesh.position.y += 1.2;
        }
      });

      // Animate pulsing facility ground beacon rings with active entity glowing
      const activeGlowId = activeFacilityGlowRef.current || selectedFacilityId;
      ringsRef.current.forEach((r) => {
        const isCurrentFacility = r.nodeId === activeGlowId;
        const speed = isCurrentFacility ? 1.6 : 0.9;
        r.scale += delta * speed;
        if (r.scale > (isCurrentFacility ? 3.6 : 2.8)) r.scale = 1;
        r.mesh.scale.set(r.scale, r.scale, r.scale);
        r.mesh.material.opacity = Math.max(0, 1 - (r.scale - 1) / (isCurrentFacility ? 2.6 : 1.8));
        if (isCurrentFacility && r.mesh.material.color) {
          r.mesh.material.color.setHex(0x00e5ff); // High-intensity cyan aura
        }
      });

      // Check Roadblock and Incident status at Kasara Ghat
      const isBlocked = (activeRoadblocksRef.current || []).some(
        (rb) => rb.roadblock_id === 'RB-KASARA-01' || rb.corridor_node === 'KSR'
      );
      const hasIncident = Boolean(activeIncidentRef.current) || isBlocked;

      // Toggle 3D barricade visibility and animate hazard strobe beacons
      if (roadblockGroupRef.current) {
        roadblockGroupRef.current.visible = isBlocked;
        if (isBlocked && roadblockGroupRef.current.update) {
          roadblockGroupRef.current.update(time);
        }
      }

      // Animate Kasara Disruption Zone Hazard Aura Sphere
      if (disruptionZoneGroupRef.current) {
        disruptionZoneGroupRef.current.visible = hasIncident;
        if (hasIncident) {
          const pulseScale = 1.0 + Math.sin(time * 0.007) * 0.16;
          disruptionZoneGroupRef.current.scale.set(pulseScale, pulseScale, pulseScale);
          disruptionZoneGroupRef.current.rotation.y += delta * 0.35;
        }
      }

      // Animate Route Conduits Glow
      const activeRoute = highlightedRouteRef.current;
      if (highwayRibbonsRef.current?.main_corridor?.centerLaneMat) {
        const isMainHighlighted = activeRoute === 'main_corridor' || activeRoute === 'LINK-BHW-NSK';
        highwayRibbonsRef.current.main_corridor.centerLaneMat.color.setHex(isMainHighlighted ? 0x00ffea : 0x00e5ff);
      }
      if (highwayRibbonsRef.current?.detour_corridor?.centerLaneMat) {
        const isDetourHighlighted = activeRoute === 'detour_corridor' || activeRoute === 'malshej_bypass';
        highwayRibbonsRef.current.detour_corridor.centerLaneMat.color.setHex(isDetourHighlighted ? 0xffea00 : 0xffb703);
      }

      // Animate 3D Volumetric Demand Heatmap Pillars (breathing pulse)
      if (demandHeatmapGroupRef.current && demandHeatmapGroupRef.current.visible) {
        const breathe = 1.0 + Math.sin(time * 0.004) * 0.05;
        demandHeatmapGroupRef.current.children.forEach((child) => {
          if (child.userData?.isHeatmapPillar) {
            child.scale.set(breathe, 1.0, breathe);
          }
        });
      }

      // Animate 3D Optimal Path Vector Light Pulses
      if (optimalPathGroupRef.current && optimalPathGroupRef.current.visible && optimalPathGroupRef.current.pulses && optimalPathGroupRef.current.curve) {
        optimalPathGroupRef.current.pulses.forEach((pulse) => {
          pulse.offset = (pulse.offset + delta * pulse.speed) % 1.0;
          const clampedOffset = Math.min(0.9999, Math.max(0, pulse.offset));
          const pt = optimalPathGroupRef.current.curve.getPointAt(clampedOffset);
          if (pt) {
            pulse.mesh.position.copy(pt);
            pulse.mesh.position.y += 2.0;
          }
        });
      }

      // Active trajectory curves for both fleet vehicles
      // TRK-MH-01: if blocked, steer onto Malshej Ghat detour; else main corridor
      const curve1 = (isBlocked && detourCurveRef.current)
        ? detourCurveRef.current
        : (corridorCurveRef.current || mainCorridorCurve);
      truck1StateRef.current.speed = isBlocked ? 0.00045 : 0.00065;

      // TRK-MH-02: traverses southern Pune corridor
      const curve2 = southernCurveRef.current || southernCurve || mainCorridorCurve;

      // Advance both fleet vehicles along trajectories if not paused
      const effectiveSpeedMult = isPausedRef.current ? 0 : simSpeedRef.current;
      if (effectiveSpeedMult > 0) {
        truck1StateRef.current.progress =
          (truck1StateRef.current.progress + truck1StateRef.current.speed * effectiveSpeedMult) % 1.0;
        truck2StateRef.current.progress =
          (truck2StateRef.current.progress + truck2StateRef.current.speed * effectiveSpeedMult) % 1.0;
      }

      // 1. TRK-MH-01 3D Pose Calculation
      const p1 = Math.min(0.9999, Math.max(0, truck1StateRef.current.progress));
      const pNext1 = Math.min(0.9999, Math.max(0, (truck1StateRef.current.progress + 0.006) % 1.0));
      const tPos1 = curve1.getPointAt(p1);
      const tNext1 = curve1.getPointAt(pNext1);
      const headingVec1 = new THREE.Vector3().subVectors(tNext1, tPos1).normalize();
      truck1StateRef.current.pos = [tPos1.x, tPos1.y, tPos1.z];
      truck1StateRef.current.look = [tNext1.x, tNext1.y, tNext1.z];
      truck1StateRef.current.heading = [headingVec1.x, headingVec1.y, headingVec1.z];

      truck1Group.position.copy(tPos1);
      truck1Group.position.y += 0.85;
      truck1Group.lookAt(tNext1.x, tPos1.y + 0.85, tNext1.z);

      // 2. TRK-MH-02 3D Pose Calculation
      const p2 = Math.min(0.9999, Math.max(0, truck2StateRef.current.progress));
      const pNext2 = Math.min(0.9999, Math.max(0, (truck2StateRef.current.progress + 0.006) % 1.0));
      const tPos2 = curve2.getPointAt(p2);
      const tNext2 = curve2.getPointAt(pNext2);
      const headingVec2 = new THREE.Vector3().subVectors(tNext2, tPos2).normalize();
      truck2StateRef.current.pos = [tPos2.x, tPos2.y, tPos2.z];
      truck2StateRef.current.look = [tNext2.x, tNext2.y, tNext2.z];
      truck2StateRef.current.heading = [headingVec2.x, headingVec2.y, headingVec2.z];

      truck2Group.position.copy(tPos2);
      truck2Group.position.y += 0.85;
      truck2Group.lookAt(tNext2.x, tPos2.y + 0.85, tNext2.z);

      // Spin Wheels on both fleet vehicles
      if (effectiveSpeedMult > 0) {
        if (truck1Group.wheelMeshes) {
          truck1Group.wheelMeshes.forEach((w) => {
            w.children.forEach((child) => {
              child.rotation.x += delta * effectiveSpeedMult * 26.0;
            });
          });
        }
        if (truck2Group.wheelMeshes) {
          truck2Group.wheelMeshes.forEach((w) => {
            w.children.forEach((child) => {
              child.rotation.x += delta * effectiveSpeedMult * 28.0;
            });
          });
        }
      }

      // Animate Status Beacons
      if (truck1Group.beaconGroup) {
        const beaconPulse1 = 1.0 + Math.sin(time * 0.006) * 0.15;
        truck1Group.beaconGroup.scale.set(beaconPulse1, beaconPulse1, beaconPulse1);
      }
      if (truck2Group.beaconGroup) {
        const beaconPulse2 = 1.0 + Math.sin(time * 0.007) * 0.15;
        truck2Group.beaconGroup.scale.set(beaconPulse2, beaconPulse2, beaconPulse2);
      }

      // Active Camera Target Determination based on activeVehicleIdRef
      const isTrackingTruck2 = activeVehicleIdRef.current === 'TRK-MH-02';
      const activePos = isTrackingTruck2 ? tPos2 : tPos1;
      const activeHeadingVec = isTrackingTruck2 ? headingVec2 : headingVec1;
      const truckPosArr = [activePos.x, activePos.y + 0.85, activePos.z];
      const truckHeadingArr = [activeHeadingVec.x, activeHeadingVec.y, activeHeadingVec.z];

      // Throttled telemetry state update for WGS84 GPS Cesium Twin Synchronization
      telematicsThrottle += delta;
      if (telematicsThrottle >= 0.25) {
        telematicsThrottle = 0;
        const activeProg = isTrackingTruck2
          ? truck2StateRef.current.progress
          : truck1StateRef.current.progress;
        const activeSpeedKmh = Math.round(
          (isTrackingTruck2 ? 68 : isBlocked ? 48 : 62) * (effectiveSpeedMult > 0 ? 1 : 0)
        );
        const syncVehicle = calculateSynchronizedVehicleState({
          progress: activeProg,
          worldPos: [activePos.x, activePos.y, activePos.z],
          headingVec: [activeHeadingVec.x, activeHeadingVec.y, activeHeadingVec.z],
          speedKmh: activeSpeedKmh,
          baseTelematics: {
            id: isTrackingTruck2 ? 'TRK-MH-02' : 'TRK-MH-01',
            model: isTrackingTruck2
              ? '16T Electric Express Carrier'
              : '24T Heavy Commercial Reefer',
            socPercent: isTrackingTruck2 ? 91.5 : 82.0,
            cargoTempC: isTrackingTruck2 ? 19.2 : 4.1
          }
        });
        setVehicleGps(syncVehicle);
      }

      // Update Camera based on current Active Camera Mode
      const mode = cameraModeRef.current;

      if (mode === CAMERA_MODES.CHASE) {
        // 3rd-Person Dynamic Chase Cam
        const chase = calculateChaseCameraPosition({
          truckPos: truckPosArr,
          truckHeading: truckHeadingArr,
          yawOffset: freeLookRef.current.yaw,
          pitchOffset: freeLookRef.current.pitch,
          distance: freeLookRef.current.distance,
          height: 5.2
        });

        // Smooth damping
        dampedCamPosRef.current = dampArray3(dampedCamPosRef.current, chase.position, 8.5, delta);
        dampedLookTargetRef.current = dampArray3(dampedLookTargetRef.current, chase.lookAt, 12.0, delta);

        camera.position.set(...dampedCamPosRef.current);
        camera.lookAt(new THREE.Vector3(...dampedLookTargetRef.current));
      } else if (mode === CAMERA_MODES.COCKPIT) {
        // Driver Cockpit Dashcam POV
        const cockpit = calculateCockpitCameraPosition({
          truckPos: truckPosArr,
          truckHeading: truckHeadingArr,
          eyeHeight: 2.3,
          forwardOffset: 2.6
        });

        dampedCamPosRef.current = dampArray3(dampedCamPosRef.current, cockpit.position, 22.0, delta);
        dampedLookTargetRef.current = dampArray3(dampedLookTargetRef.current, cockpit.lookAt, 22.0, delta);

        camera.position.set(...dampedCamPosRef.current);
        camera.lookAt(new THREE.Vector3(...dampedLookTargetRef.current));
      } else if (mode === CAMERA_MODES.DRONE) {
        // Tactical Drone God-View
        const drone = calculateDroneCameraPosition({
          truckPos: truckPosArr,
          altitude: 54.0,
          pitchBias: 8.0
        });

        dampedCamPosRef.current = dampArray3(dampedCamPosRef.current, drone.position, 6.0, delta);
        dampedLookTargetRef.current = dampArray3(dampedLookTargetRef.current, drone.lookAt, 10.0, delta);

        camera.position.set(...dampedCamPosRef.current);
        camera.lookAt(new THREE.Vector3(...dampedLookTargetRef.current));
      } else if (mode === CAMERA_MODES.FREE_ORBIT) {
        // Free Orbit Mode: Camera position controlled via mouse handlers
        // Look at current orbit target
        camera.lookAt(orbitStateRef.current.target);
      }

      setCameraCoords({
        x: Math.round(camera.position.x),
        y: Math.round(camera.position.y),
        z: Math.round(camera.position.z)
      });

      // Render Scene
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };

    // Setup WebGL Context Loss Handlers
    const cleanupContextLoss = setupContextLossHandlers(
      canvasRef.current,
      () => {
        console.warn('[PersistentStage3D] WebGL context lost. Pausing render loop.');
        isContextLostRef.current = true;
        if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      },
      () => {
        console.info('[PersistentStage3D] WebGL context restored. Resuming render loop.');
        isContextLostRef.current = false;
        lastTime = performance.now();
        animFrameIdRef.current = requestAnimationFrame(animate);
      }
    );

    animFrameIdRef.current = requestAnimationFrame(animate);

    // 13. Window & Container Resize Handler with ResizeObserver
    const updateSize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (ro) ro.disconnect();
      if (typeof cleanupContextLoss === 'function') cleanupContextLoss();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (scene) disposeThreeScene(scene, renderer);
    };
  }, []);

  // Global operational keyboard shortcuts listener
  useGlobalKeyboardShortcuts({
    onCameraMode: (mode) => setEffectiveCameraMode(mode),
    onTogglePlayPause: () => setIsPaused((prev) => !prev),
    onSwapPip: () => toggleStageEngine && toggleStageEngine(),
    onDismissPanels: () => minimizeAll && minimizeAll(),
    onSetEngine: (eng) => setActiveStageEngine && setActiveStageEngine(eng),
    onResetCamera: () => resetFreeLook()
  });


  // Glides camera smoothly to preset target in Free Orbit mode
  const glideCameraTo = useCallback((targetPos, lookAtTarget) => {
    if (!cameraRef.current) return;
    setCameraMode(CAMERA_MODES.FREE_ORBIT);
    const camera = cameraRef.current;
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(...targetPos);
    orbitStateRef.current.target.set(...lookAtTarget);

    const startTime = performance.now();
    const duration = 1200;

    const animateGlide = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const t = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      camera.position.lerpVectors(startPos, endPos, t);
      camera.lookAt(orbitStateRef.current.target);

      if (progress < 1) {
        requestAnimationFrame(animateGlide);
      }
    };

    requestAnimationFrame(animateGlide);
  }, []);

  // Facility selection synchronized from Macro Cesium GIS
  const handleSelectFacilityFromCesium = useCallback((nodeId) => {
    if (!nodeId) return;
    if (setSelectedFacilityId) setSelectedFacilityId(nodeId);
    const mapped = mapFacilityBetweenEngines(nodeId);
    if (mapped.stageNode) {
      setSelectedNode(mapped.stageNode);
      glideCameraTo(
        [mapped.stageNode.pos[0] + 18, mapped.stageNode.pos[1] + 15, mapped.stageNode.pos[2] + 22],
        mapped.stageNode.pos
      );
    }
    if (onSelectNode) onSelectNode(nodeId);
  }, [glideCameraTo, onSelectNode, setSelectedFacilityId]);

  // Handle Bi-directional 3D Scene Fly-To Commands from Service Panels
  useEffect(() => {
    if (!flyToTarget) return;
    const { type, id } = flyToTarget;

    if (type === 'facility') {
      const found = STAGE_FACILITIES.find((f) => f.id === id || f.code === id);
      if (found) {
        setSelectedNode(found);
        glideCameraTo(
          [found.pos[0] + 18, found.pos[1] + 15, found.pos[2] + 22],
          found.pos
        );
      }
    } else if (type === 'route') {
      if (id === 'main_corridor' || id === 'LINK-BHW-NSK') {
        glideCameraTo([0, 55, 15], [0, 5, -15]);
      } else if (id === 'detour_corridor' || id === 'malshej_bypass' || id === 'LINK-MALSHEJ') {
        glideCameraTo([14, 45, -10], [14, 8, -22]);
      } else if (id === 'southern_corridor' || id === 'LINK-BHW-PUN') {
        glideCameraTo([10, 48, 30], [10, 4, 20]);
      } else {
        glideCameraTo([0, 60, 20], [0, 5, -10]);
      }
    } else if (type === 'vehicle') {
      setCameraMode(CAMERA_MODES.CHASE);
    } else if (type === 'incident') {
      glideCameraTo([28, 18, -12], [14, 9.8, -24]);
    }
  }, [flyToTarget, glideCameraTo]);

  // Synchronize dynamic 3D visual overlays (Demand Heatmaps & Optimal Path Vectors)
  useEffect(() => {
    demandHeatmapOverlayRef.current = demandHeatmapOverlay;
    if (demandHeatmapGroupRef.current) {
      demandHeatmapGroupRef.current.visible = Boolean(demandHeatmapOverlay?.active);
    }
  }, [demandHeatmapOverlay]);

  useEffect(() => {
    optimalRouteOverlayRef.current = optimalRouteOverlay;
    if (optimalPathGroupRef.current) {
      optimalPathGroupRef.current.visible = Boolean(optimalRouteOverlay?.active);
    }
  }, [optimalRouteOverlay]);

  useEffect(() => {
    activeIncidentRef.current = activeIncident;
    if (disruptionZoneGroupRef.current) {
      disruptionZoneGroupRef.current.visible = Boolean(activeIncident || (activeRoadblocks && activeRoadblocks.length > 0));
    }
  }, [activeIncident, activeRoadblocks]);

  useEffect(() => {
    activeFacilityGlowRef.current = activeFacilityGlow;
  }, [activeFacilityGlow]);

  useEffect(() => {
    highlightedRouteRef.current = highlightedRoute;
  }, [highlightedRoute]);

  // Select camera view preset
  const handleSelectView = (presetKey) => {
    const preset = CAMERA_VIEWS[presetKey];
    if (!preset) return;
    setActiveCamView(presetKey);
    glideCameraTo(preset.position, preset.target);
    const mapped = mapFacilityBetweenEngines(presetKey);
    if (mapped.cesiumNode && setSelectedFacilityId) {
      setSelectedFacilityId(mapped.cesiumNode.node_id);
    }
  };

  // Mouse Drag Handlers: supports Free-Look in Chase mode, Orbit/Pan in Free Orbit mode
  const handleMouseDown = (e) => {
    if (e.target !== canvasRef.current) return;

    if (cameraMode === CAMERA_MODES.CHASE) {
      freeLookRef.current.isDragging = true;
      freeLookRef.current.prevX = e.clientX;
      freeLookRef.current.prevY = e.clientY;
    } else {
      orbitStateRef.current.isDragging = true;
      orbitStateRef.current.dragButton = e.button;
      orbitStateRef.current.prevX = e.clientX;
      orbitStateRef.current.prevY = e.clientY;
    }
  };

  const handleMouseMove = (e) => {
    if (cameraMode === CAMERA_MODES.CHASE) {
      if (!freeLookRef.current.isDragging) return;
      const dx = e.clientX - freeLookRef.current.prevX;
      const dy = e.clientY - freeLookRef.current.prevY;
      freeLookRef.current.prevX = e.clientX;
      freeLookRef.current.prevY = e.clientY;

      // Mouse horizontal drag adjusts yaw around moving truck
      freeLookRef.current.yaw += dx * 0.008;
      // Mouse vertical drag adjusts pitch
      freeLookRef.current.pitch = Math.max(
        -0.35,
        Math.min(0.65, freeLookRef.current.pitch - dy * 0.006)
      );
    } else if (cameraMode === CAMERA_MODES.FREE_ORBIT) {
      if (!orbitStateRef.current.isDragging || !cameraRef.current) return;
      const dx = e.clientX - orbitStateRef.current.prevX;
      const dy = e.clientY - orbitStateRef.current.prevY;
      orbitStateRef.current.prevX = e.clientX;
      orbitStateRef.current.prevY = e.clientY;

      const camera = cameraRef.current;

      if (orbitStateRef.current.dragButton === 0) {
        // Orbit rotation
        const rotSpeed = 0.005;
        const x = camera.position.x;
        const z = camera.position.z;
        const cos = Math.cos(-dx * rotSpeed);
        const sin = Math.sin(-dx * rotSpeed);

        camera.position.x = x * cos - z * sin;
        camera.position.z = x * sin + z * cos;
        camera.position.y = Math.max(6, Math.min(130, camera.position.y + dy * 0.12));
        camera.lookAt(orbitStateRef.current.target);
      } else if (orbitStateRef.current.dragButton === 2) {
        // Pan
        const panSpeed = 0.08;
        camera.position.x -= dx * panSpeed;
        camera.position.z += dy * panSpeed;
        orbitStateRef.current.target.x -= dx * panSpeed;
        orbitStateRef.current.target.z += dy * panSpeed;
        camera.lookAt(orbitStateRef.current.target);
      }
    }
  };

  const handleMouseUp = () => {
    freeLookRef.current.isDragging = false;
    orbitStateRef.current.isDragging = false;
  };

  const handleWheel = (e) => {
    if (cameraMode === CAMERA_MODES.CHASE) {
      // Zoom follow distance in chase mode
      freeLookRef.current.distance = Math.max(
        6.0,
        Math.min(32.0, freeLookRef.current.distance + e.deltaY * 0.02)
      );
    } else if (cameraMode === CAMERA_MODES.FREE_ORBIT) {
      if (!cameraRef.current) return;
      const camera = cameraRef.current;
      const zoomFactor = e.deltaY * 0.05;
      const dir = new THREE.Vector3().subVectors(orbitStateRef.current.target, camera.position).normalize();
      const newPos = camera.position.clone().addScaledVector(dir, zoomFactor);

      if (newPos.distanceTo(orbitStateRef.current.target) > 10 && newPos.y > 5 && newPos.y < 160) {
        camera.position.copy(newPos);
      }
    }
  };

  // Raycasting click to inspect 3D logistics node beacons, vehicles, and roadblocks
  const handleCanvasClick = (e) => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);

    // 1. Check for Vehicle Hit (Commercial Trucks)
    const vehicleHit = intersects.find((i) => i.object.userData && i.object.userData.isVehicle);
    if (vehicleHit) {
      const vId = vehicleHit.object.userData.vehicleId || 'TRK-MH-01';
      if (selectVehicle) {
        selectVehicle(vId);
      } else if (setActiveVehicleId) {
        setActiveVehicleId(vId);
      }
      setCameraMode(CAMERA_MODES.CHASE);
      return;
    }

    // 2. Check for Roadblock / Disruption Zone Hit
    const roadblockHit = intersects.find((i) => i.object.userData && (i.object.userData.isRoadblock || i.object.userData.isDisruptionZone));
    if (roadblockHit) {
      if (selectIncident) {
        selectIncident({
          id: 'INC-KASARA-01',
          name: 'Kasara Ghat Torrential Mudslide Hazard',
          location: 'Kasara Ghat Pass NH-160 km 118',
          severity: 'CRITICAL',
          roadblockId: 'RB-KASARA-01'
        });
      }
      glideCameraTo([28, 18, -12], [14, 9.8, -24]);
      return;
    }

    // 3. Check for Logistics Facility Hit
    const facilityHit = intersects.find((i) => i.object.userData && i.object.userData.isFacility);
    if (facilityHit) {
      const nodeId = facilityHit.object.userData.nodeId;
      const foundNode = STAGE_FACILITIES.find((n) => n.id === nodeId);
      if (foundNode) {
        setSelectedNode(foundNode);
        if (selectFacility) {
          selectFacility(foundNode.id);
        } else if (setSelectedFacilityId) {
          setSelectedFacilityId(foundNode.id);
        }
        glideCameraTo(
          [foundNode.pos[0] + 18, foundNode.pos[1] + 15, foundNode.pos[2] + 22],
          foundNode.pos
        );
        if (onSelectNode) onSelectNode(nodeId);
      }
      return;
    }
  };

  const resetFreeLook = () => {
    freeLookRef.current.yaw = 0;
    freeLookRef.current.pitch = 0.15;
    freeLookRef.current.distance = 14.0;
  };

  const isTacticalPrimary = activeStageEngine === STAGE_ENGINES.TACTICAL_3D;
  const isCesiumPrimary = activeStageEngine === STAGE_ENGINES.CESIUM_GIS;

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-auto z-0 overflow-hidden bg-[#020617] select-none">
      {/* 1. Floating Glassmorphic Viewport Engine Selector (Top Center) */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
        <ViewportEngineSelector
          activeEngine={activeStageEngine}
          onSelectEngine={(engine) => setActiveStageEngine && setActiveStageEngine(engine)}
          isPiPVisible={!pipMinimized}
          onTogglePiP={() => setPipMinimized && setPipMinimized(!pipMinimized)}
        />
      </div>

      {/* 2. Tactical 3D World Container (Full-screen when Primary, PiP when Secondary) */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className={
          isTacticalPrimary
            ? 'absolute inset-0 w-full h-full z-0 pointer-events-auto'
            : pipMinimized
            ? 'hidden'
            : 'fixed bottom-22 right-6 w-96 h-60 z-30 rounded-2xl overflow-hidden border border-cyan-500/60 shadow-[0_10px_35px_rgba(0,0,0,0.75)] cyber-glass pointer-events-auto transition-all duration-300 group'
        }
      >
        {/* If in PiP mode, show mini top bar */}
        {!isTacticalPrimary && !pipMinimized && (
          <div className="absolute top-0 inset-x-0 h-8 px-3 bg-slate-950/85 border-b border-slate-800/80 flex items-center justify-between z-20 text-slate-200 select-none">
            <div
              onClick={() => setActiveStageEngine && setActiveStageEngine(STAGE_ENGINES.TACTICAL_3D)}
              className="flex items-center gap-2 cursor-pointer hover:text-white transition"
              title="Click to promote Tactical 3D to Full-Screen Stage"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <Truck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-extrabold uppercase tracking-wide">Tactical 3D</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold">
                CHASE PiP
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveStageEngine && setActiveStageEngine(STAGE_ENGINES.TACTICAL_3D)}
                className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                title="Promote Tactical 3D to Full Screen"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPipMinimized && setPipMinimized(true)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Minimize PiP Window"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 3D WebGL Canvas or 2D Tactical Schematic Radar Fallback */}
        {webglError ? (
          <div className="absolute inset-0 w-full h-full bg-[#020617] flex flex-col items-center justify-center p-6 text-center select-none z-0 overflow-hidden">
            {/* Ambient Tactical Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a25_1px,transparent_1px),linear-gradient(to_bottom,#0f172a25_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] pointer-events-none" />

            <div className="relative z-10 max-w-md p-6 rounded-2xl cyber-glass border border-cyan-500/40 bg-slate-950/85 shadow-2xl backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400">
                <Layers className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base font-extrabold text-white mb-1.5 tracking-wide">
                2D TACTICAL SCHEMATIC RADAR ACTIVE
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
                Hardware WebGL context is unavailable in this environment ({webglError}). The digital twin has engaged resilient 2D tactical schematic mode. All dock service modules and telematics remain fully functional.
              </p>
              <div className="flex items-center justify-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  CORRIDOR RADAR
                </span>
                <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                  6 HUBS MONITORED
                </span>
              </div>
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onClick={isTacticalPrimary ? handleCanvasClick : () => setActiveStageEngine && setActiveStageEngine(STAGE_ENGINES.TACTICAL_3D)}
            className="absolute inset-0 w-full h-full block cursor-grab active:cursor-grabbing"
          />
        )}

        {/* Atmospheric Vignette Overlay (Full-screen only) */}
        {isTacticalPrimary && (
          <div className="absolute inset-0 pointer-events-none bg-radial from-transparent via-[#020617]/20 to-[#020617]/70" />
        )}

        {/* Top-Left Camera Suite Toolbar (only when Tactical is Primary) */}
        {isTacticalPrimary && (
          <div className="absolute top-18 left-6 z-20 flex flex-col gap-2 pointer-events-none">
            {/* Stage Status & FPS Badge */}
            <div className="pointer-events-auto cyber-glass rounded-xl p-2.5 px-3 border border-slate-700/60 text-slate-100 flex items-center gap-3 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-mono font-bold text-emerald-400">R3F SIMULATOR</span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-mono font-semibold text-slate-300">
                {fps} FPS
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                {CAMERA_MODE_METADATA[cameraMode]?.badge}
              </span>
              <button
                onClick={() => setHudMinimized(!hudMinimized)}
                className="text-slate-400 hover:text-white p-1 rounded transition ml-1"
                title={hudMinimized ? 'Expand Camera Suite' : 'Minimize Camera Suite'}
              >
                {hudMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {!hudMinimized && (
              <div className="pointer-events-auto cyber-glass rounded-xl p-3 border border-slate-700/60 shadow-xl flex flex-col gap-2.5 backdrop-blur-xl max-w-xs">
                {/* Perspective Mode Switcher Buttons */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Camera Suite</span>
                    <span className="text-[9px] font-mono text-slate-500">HOTKEYS [1-4]</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* 1. Chase Cam */}
                    <button
                      onClick={() => setCameraMode(CAMERA_MODES.CHASE)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition text-left ${
                        cameraMode === CAMERA_MODES.CHASE
                          ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <div className="leading-tight">
                        <div>Chase Cam</div>
                        <div className="text-[9px] font-mono text-slate-400">[1] 3rd-Person</div>
                      </div>
                    </button>

                    {/* 2. Cockpit Dashcam */}
                    <button
                      onClick={() => setCameraMode(CAMERA_MODES.COCKPIT)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition text-left ${
                        cameraMode === CAMERA_MODES.COCKPIT
                          ? 'bg-orange-500/25 text-orange-300 border border-orange-500/50 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <div className="leading-tight">
                        <div>Cockpit</div>
                        <div className="text-[9px] font-mono text-slate-400">[2] Dashcam</div>
                      </div>
                    </button>

                    {/* 3. Drone God-View */}
                    <button
                      onClick={() => setCameraMode(CAMERA_MODES.DRONE)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition text-left ${
                        cameraMode === CAMERA_MODES.DRONE
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                      }`}
                    >
                      <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div className="leading-tight">
                        <div>Drone POV</div>
                        <div className="text-[9px] font-mono text-slate-400">[3] Overhead</div>
                      </div>
                    </button>

                    {/* 4. Free Orbit */}
                    <button
                      onClick={() => setCameraMode(CAMERA_MODES.FREE_ORBIT)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition text-left ${
                        cameraMode === CAMERA_MODES.FREE_ORBIT
                          ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                      }`}
                    >
                      <Rotate3d className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <div className="leading-tight">
                        <div>Free Orbit</div>
                        <div className="text-[9px] font-mono text-slate-400">[4] Inspect</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* In Chase Mode: Free-look reset button */}
                {cameraMode === CAMERA_MODES.CHASE && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">Drag to Orbit View</span>
                    <button
                      onClick={resetFreeLook}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 flex items-center gap-1 transition"
                      title="Re-align camera directly behind moving vehicle [R]"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Chase [R]</span>
                    </button>
                  </div>
                )}

                {/* Facility Quick Jump Presets */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                    <span>Facility Quick Focus</span>
                    <Compass className="w-3 h-3 text-cyan-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.keys(CAMERA_VIEWS).map((key) => {
                      const view = CAMERA_VIEWS[key];
                      return (
                        <button
                          key={key}
                          onClick={() => handleSelectView(key)}
                          className="px-2 py-1 rounded text-[11px] font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white text-left transition truncate"
                        >
                          {view.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3D Twin Visual Overlays Toggles */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Twin Visual Overlays</span>
                    <Layers className="w-3 h-3 text-cyan-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setDemandHeatmapOverlay?.((prev) => ({ ...prev, active: !prev?.active }))}
                      className={`px-2 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition ${
                        demandHeatmapOverlay?.active
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                      }`}
                      title="Toggle 3D Volumetric Demand Heatmap Pillars over Facilities"
                    >
                      <Activity className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">Demand Heatmap</span>
                    </button>
                    <button
                      onClick={() => setOptimalRouteOverlay?.((prev) => ({ ...prev, active: !prev?.active }))}
                      className={`px-2 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition ${
                        optimalRouteOverlay?.active
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                      }`}
                      title="Toggle 3D Optimal Path Vector Spline Overlay"
                    >
                      <Navigation className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">Optimal Path</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Macro Cesium GIS Container (Full-screen when Primary, PiP when Secondary) */}
      <div
        ref={cesiumContainerRef}
        className={
          isCesiumPrimary
            ? 'absolute inset-0 w-full h-full z-0 pointer-events-auto'
            : pipMinimized
            ? 'hidden'
            : 'fixed bottom-22 right-6 w-96 h-60 z-30 rounded-2xl overflow-hidden border border-blue-500/60 shadow-[0_10px_35px_rgba(0,0,0,0.75)] cyber-glass pointer-events-auto transition-all duration-300 group'
        }
      >
        {/* If in PiP mode, show mini top bar */}
        {!isCesiumPrimary && !pipMinimized && (
          <div className="absolute top-0 inset-x-0 h-8 px-3 bg-slate-950/85 border-b border-slate-800/80 flex items-center justify-between z-20 text-slate-200 select-none">
            <div
              onClick={() => setActiveStageEngine && setActiveStageEngine(STAGE_ENGINES.CESIUM_GIS)}
              className="flex items-center gap-2 cursor-pointer hover:text-white transition"
              title="Click to promote Macro Cesium GIS to Full-Screen Stage"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-extrabold uppercase tracking-wide">Macro Cesium</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-950/80 text-blue-300 border border-blue-800/60 font-bold">
                GIS PiP
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveStageEngine && setActiveStageEngine(STAGE_ENGINES.CESIUM_GIS)}
                className="p-1 rounded text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition"
                title="Promote Macro Cesium GIS to Full Screen"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPipMinimized && setPipMinimized(true)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Minimize PiP Window"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <CesiumTwinViewport
          isPiP={!isCesiumPrimary}
          vehicleGps={vehicleGps}
          selectedNodeId={selectedFacilityId}
          onSelectNode={handleSelectFacilityFromCesium}
          onSwapPiP={() => setActiveStageEngine && setActiveStageEngine(STAGE_ENGINES.CESIUM_GIS)}
        />
      </div>

      {/* 4. Minimized PiP Floating Restore Capsule */}
      {pipMinimized && (
        <div className="fixed bottom-22 right-6 z-30 pointer-events-auto animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={() => setPipMinimized && setPipMinimized(false)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl cyber-glass border border-slate-700/80 hover:border-cyan-400/60 shadow-xl backdrop-blur-xl text-slate-200 text-xs font-bold transition hover:scale-105 active:scale-95 group"
            title="Restore Picture-in-Picture [PiP] Window"
          >
            <div className="relative flex items-center justify-center">
              {isTacticalPrimary ? (
                <Globe className="w-4 h-4 text-blue-400 group-hover:animate-pulse" />
              ) : (
                <Truck className="w-4 h-4 text-cyan-400 group-hover:animate-pulse" />
              )}
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <span>
              {isTacticalPrimary ? 'Open Cesium GIS PiP' : 'Open Tactical 3D PiP'}
            </span>
            <Maximize2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
          </button>
        </div>
      )}

      {/* 5. Persistent Glassmorphic Cockpit HUD (Universal Across Both Engines, Above Dock) */}
      <CockpitHUD
        onVehicleChange={(vId) => {
          if (setActiveVehicleId) setActiveVehicleId(vId);
        }}
      />

      {/* 6. Selected Node Telemetry Badge */}
      {selectedNode && (() => {
        const NodeIcon = ICON_MAP[selectedNode.iconName] || Anchor;
        return (
          <div
            className={`fixed bottom-22 z-20 pointer-events-auto cyber-glass rounded-2xl p-4 border border-slate-700/80 max-w-sm shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-right duration-200 ${
              pipMinimized ? 'right-6' : 'right-[410px]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-900 font-extrabold shadow-md shrink-0"
                  style={{ backgroundColor: selectedNode.color }}
                >
                  <NodeIcon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white leading-tight">{selectedNode.name}</h4>
                  <span className="text-[11px] font-semibold text-cyan-400 font-mono">{selectedNode.tier}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{selectedNode.details}</p>
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">COORDINATES 3D</span>
              <span className="text-cyan-400 font-bold">[{selectedNode.pos.join(', ')}]</span>
            </div>
          </div>
        );
      })()}

      {/* 7. Bottom Center Interaction Hint */}
      <div className="absolute bottom-2 left-6 z-10 text-[11px] font-mono text-slate-500 pointer-events-none select-none">
        <span>
          {isTacticalPrimary
            ? 'Tactical 3D Active • [Tab/E]: Swap to Macro Cesium • Drag: Free-Look • 1-4: Switch Camera • Space: Pause'
            : 'Macro Cesium GIS Active • [Tab/E]: Swap to Tactical 3D • Click Nodes: Focus • Highways & Shockwaves Active'}
        </span>
      </div>
    </div>
  );
}
