import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import {
  Globe,
  Anchor,
  Package,
  Layers,
  Building2,
  Mountain,
  Navigation,
  RefreshCw,
  Eye,
  Maximize2,
  Info,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  RotateCcw,
  Zap,
  Route,
  Activity,
  Flame,
  Radio,
  Warehouse,
  Truck,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import {
  FACILITY_NODES,
  HIGHWAY_CORRIDORS,
  SCENARIO_EPICENTERS,
  CAMERA_PRESETS,
  getStockCapacityStatus,
  SCHEMATIC_COORDS,
  SCHEMATIC_CORRIDOR_PATHS,
  SCHEMATIC_EPICENTERS
} from '../constants/logisticsTopology';
import { calculateSchematicVehiclePos } from '../utils/engineSynchronization';
import AutonomousSentinelHUD from './AutonomousSentinelHUD';
import { setupContextLossHandlers } from '../utils/webglHardening';


export {
  SCHEMATIC_COORDS,
  SCHEMATIC_CORRIDOR_PATHS,
  SCHEMATIC_EPICENTERS
};

// Helper to create an SVG icon data URL for facility billboards
function createPinIconSvg(tierNumber, statusColor) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <defs>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${statusColor}" flood-opacity="0.8"/>
      </filter>
    </defs>
    <circle cx="24" cy="20" r="16" fill="#0f172a" stroke="${statusColor}" stroke-width="3" filter="url(#glow)"/>
    <circle cx="24" cy="20" r="12" fill="${statusColor}" fill-opacity="0.25"/>
    <text x="24" y="25" font-family="system-ui, sans-serif" font-size="12" font-weight="900" fill="#ffffff" text-anchor="middle">T${tierNumber}</text>
    <polygon points="20,33 28,33 24,44" fill="${statusColor}"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const CesiumTwinViewport = forwardRef(function CesiumTwinViewport({
  selectedNodeId = 'DC-BHW-01',
  onSelectNode = () => {},
  simulationNodes = null,
  simulationLinks = null,
  activeScenarioId = 'port_strike',
  shockIntensity = 75,
  enableMitigation = true,
  height = '100%',
  className = '',
  showLegend = true,
  showViewportControls = true,
  showTopRibbon = true,
  showSentinelHUD = true,
  vehicleGps = null,
  isPiP = false,
  onSwapPiP = null
}, ref) {
  const containerRef = useRef(null);
  const creditContainerRef = useRef(null);
  const viewerRef = useRef(null);
  const entitiesMapRef = useRef(new Map());
  const corridorEntitiesRef = useRef([]);
  const shockwaveEntitiesRef = useRef([]);
  const osmBuildingsTilesetRef = useRef(null);
  const truckEntityRef = useRef(null);

  const [activePreset, setActivePreset] = useState('CORRIDOR_OVERVIEW');
  const [showBuildings, setShowBuildings] = useState(true);
  const [showFlowConduits, setShowFlowConduits] = useState(true);
  const [showShockwaves, setShowShockwaves] = useState(true);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [useSchematicView, setUseSchematicView] = useState(() => {
    // If Cesium Ion token is absent or network fails, gracefully drop to 2D schematic radar
    const token = typeof window !== 'undefined' ? (import.meta.env?.VITE_CESIUM_ION_TOKEN || '') : '';
    return !token || !token.trim();
  });
  const [webglError, setWebglError] = useState(null);
  const [customToken, setCustomToken] = useState('');
  const [sessionToken, setSessionToken] = useState(() => {
    return import.meta.env.VITE_CESIUM_ION_TOKEN || '';
  });

  const effectiveShowLegend = isPiP ? false : showLegend;
  const effectiveShowTopRibbon = isPiP ? false : showTopRibbon;
  const effectiveShowSentinelHUD = isPiP ? false : showSentinelHUD;
  const effectiveShowControls = isPiP ? false : showViewportControls;

  // Network offline listener to gracefully fall back to 2D schematic radar
  useEffect(() => {
    const handleOffline = () => {
      console.warn('[CesiumTwin] Offline network status detected. Falling back to 2D Schematic Radar.');
      setUseSchematicView(true);
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  // Calculate live stock map for facilities
  const liveStockMap = useMemo(() => {
    const map = new Map();
    if (simulationNodes && Array.isArray(simulationNodes)) {
      simulationNodes.forEach((sn) => {
        const stock = sn.mitigated?.stock ?? sn.stock ?? sn.initial_stock ?? sn.current_stock;
        map.set(sn.node_id, stock);
      });
    }
    return map;
  }, [simulationNodes]);

  // Apply custom token directly from interactive input
  const handleApplyToken = useCallback((e) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean = customToken.trim();
    if (!clean) return;

    setSessionToken(clean);
    try {
      Cesium.Ion.defaultAccessToken = clean;
    } catch {
      // ignore
    }
    setTokenMissing(false);
    setWebglError(null);
    setUseSchematicView(false);
  }, [customToken]);

  // 1. Initialize Cesium Viewer (with WebGL safety guard & automatic fallback)
  useEffect(() => {
    if (useSchematicView) {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.destroy();
        } catch {
          // ignore
        }
        viewerRef.current = null;
        setIsViewerReady(false);
      }
      return;
    }

    if (!containerRef.current) return;

    const currentToken = sessionToken || import.meta.env.VITE_CESIUM_ION_TOKEN;

    if (currentToken && currentToken.trim() !== '') {
      try {
        Cesium.Ion.defaultAccessToken = currentToken.trim();
        setTokenMissing(false);
      } catch (err) {
        console.warn('Failed to assign Cesium Ion token:', err);
      }
    } else {
      console.warn('VITE_CESIUM_ION_TOKEN is not configured. Falling back to default 2D schematic radar view.');
      setTokenMissing(true);
      setUseSchematicView(true);
      return;
    }


    let viewer;
    try {
      viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        creditContainer: creditContainerRef.current || undefined,
        shouldAnimate: true
      });

      // Target steady 60 FPS performance
      viewer.targetFrameRate = 60;
      viewer.scene.requestRenderMode = false;

      viewerRef.current = viewer;

      // Visual and atmosphere tuning
      const scene = viewer.scene;
      scene.globe.depthTestAgainstTerrain = true;
      scene.skyAtmosphere.show = true;
      scene.globe.enableLighting = false; // Steady day lighting for logistics operational clarity
      scene.globe.maximumScreenSpaceError = 2; // Performance optimization

      // Attempt to load Cesium World Terrain asynchronously
      if (currentToken) {
        try {
          if (typeof Cesium.Terrain?.fromWorldTerrain === 'function') {
            const terrain = Cesium.Terrain.fromWorldTerrain({
              requestVertexNormals: true,
              requestWaterMask: true
            });
            if (terrain && typeof terrain.then === 'function') {
              terrain.then((tp) => {
                if (viewerRef.current && !viewerRef.current.isDestroyed()) {
                  viewerRef.current.terrainProvider = tp;
                }
              }).catch((err) => console.warn('Cesium World Terrain fallback triggered:', err));
            } else if (viewer.scene?.setTerrain) {
              viewer.scene.setTerrain(terrain);
            } else {
              viewer.terrain = terrain;
            }
          } else if (typeof Cesium.createWorldTerrainAsync === 'function') {
            Cesium.createWorldTerrainAsync({
              requestVertexNormals: true,
              requestWaterMask: true
            }).then((tp) => {
              if (viewerRef.current && !viewerRef.current.isDestroyed()) {
                viewerRef.current.terrainProvider = tp;
              }
            }).catch((err) => console.warn('Cesium World Terrain fallback triggered:', err));
          }
        } catch (terrainErr) {
          console.warn('Cesium World Terrain loading note:', terrainErr);
        }

        // Attempt to load Cesium OSM 3D Buildings
        if (typeof Cesium.createOsmBuildingsAsync === 'function') {
          Cesium.createOsmBuildingsAsync()
            .then((buildingTileset) => {
              if (viewerRef.current && !viewerRef.current.isDestroyed()) {
                osmBuildingsTilesetRef.current = buildingTileset;
                viewerRef.current.scene.primitives.add(buildingTileset);
              }
            })
            .catch((err) => {
              console.warn('Cesium 3D Buildings fallback triggered:', err);
            });
        }
      }

      // Initial camera positioning: Western India corridor overview
      const overview = CAMERA_PRESETS.CORRIDOR_OVERVIEW;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          overview.longitude,
          overview.latitude,
          overview.height
        ),
        orientation: {
          heading: Cesium.Math.toRadians(overview.heading),
          pitch: Cesium.Math.toRadians(overview.pitch),
          roll: Cesium.Math.toRadians(overview.roll)
        },
        duration: 1.2
      });

      // Interactive Picking & Hover Cursor Handler
      const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

      // Left Click: Node selection & camera fly-to
      handler.setInputAction((click) => {
        const picked = scene.pick(click.position);
        if (Cesium.defined(picked) && picked.id && picked.id._nodeId) {
          const clickedNodeId = picked.id._nodeId;
          onSelectNode(clickedNodeId);
          flyToNode(clickedNodeId);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // Mouse Move: Pointer styling & hover tooltip
      handler.setInputAction((movement) => {
        const picked = scene.pick(movement.endPosition);
        if (Cesium.defined(picked) && picked.id && picked.id._nodeId) {
          if (containerRef.current) containerRef.current.style.cursor = 'pointer';
          const node = FACILITY_NODES.find((n) => n.node_id === picked.id._nodeId);
          if (node) setHoveredNode(node);
        } else {
          if (containerRef.current) containerRef.current.style.cursor = 'default';
          setHoveredNode(null);
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      // WebGL Context Loss safety guard
      let cleanupContextLoss = null;
      if (scene && scene.canvas) {
        cleanupContextLoss = setupContextLossHandlers(
          scene.canvas,
          () => {
            console.warn('[CesiumTwin] Cesium WebGL context lost. Gracefully falling back to 2D schematic radar.');
            setWebglError('Cesium WebGL Context Lost');
            setUseSchematicView(true);
          },
          () => {
            console.info('[CesiumTwin] Cesium WebGL context restored.');
          }
        );
      }

      setIsViewerReady(true);
      setWebglError(null);
    } catch (err) {
      console.warn('Cesium Viewer initialization failed, activating 3D Schematic Vector Fallback:', err);
      setWebglError(err.message || 'WebGL Context Initialization Failed');
      setUseSchematicView(true);
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.destroy();
        } catch {
          // ignore
        }
      }
      viewerRef.current = null;
      truckEntityRef.current = null;
      setIsViewerReady(false);
    };

  }, [sessionToken, useSchematicView]);

  // Container resize observer for smooth PiP / full-screen transitions
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.resize();
        } catch {
          // ignore
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Synchronized Commercial Freight Vehicle (Truck) on Cesium Globe
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !isViewerReady) return;

    if (!vehicleGps || typeof vehicleGps.latitude !== 'number' || typeof vehicleGps.longitude !== 'number') {
      if (truckEntityRef.current) {
        try {
          viewer.entities.remove(truckEntityRef.current);
        } catch {
          // ignore
        }
        truckEntityRef.current = null;
      }
      return;
    }

    const { latitude, longitude, altitudeM, speedKmh, id } = vehicleGps;
    const pos = Cesium.Cartesian3.fromDegrees(longitude, latitude, (altitudeM || 0) + 16);
    const labelText = `${id || 'TRK-MH-01'} • ${speedKmh || 0} km/h`;

    if (!truckEntityRef.current) {
      const truckEntity = viewer.entities.add({
        name: 'NeoLogix Active Freight Vehicle',
        position: pos,
        point: {
          pixelSize: 13,
          color: Cesium.Color.fromCssColorString('#ff5400'),
          outlineColor: Cesium.Color.fromCssColorString('#ffffff'),
          outlineWidth: 2.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: labelText,
          font: 'bold 11px monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString('#38bdf8'),
          outlineColor: Cesium.Color.fromCssColorString('#020617'),
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      truckEntityRef.current = truckEntity;
    } else {
      truckEntityRef.current.position = pos;
      if (truckEntityRef.current.label) {
        truckEntityRef.current.label.text = labelText;
      }
    }
  }, [vehicleGps, isViewerReady]);

  // 2. Synchronize 3D Facility Entities with in-place updates (Maintains >= 60 FPS)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !isViewerReady) return;

    FACILITY_NODES.forEach((node) => {
      const currentStock = liveStockMap.get(node.node_id) ?? node.nominal_stock;
      const { fillPct, hexColor, cesiumColor } = getStockCapacityStatus(
        currentStock,
        node.capacity_units
      );
      const isSelected = selectedNodeId === node.node_id;

      const entityColor = new Cesium.Color(
        cesiumColor.red,
        cesiumColor.green,
        cesiumColor.blue,
        cesiumColor.alpha
      );

      const beaconHeight = 1600; // 1.6km vertical beacon
      const baseRadius = 450;
      const ringRadius = baseRadius + (fillPct / 100) * 550; // Dynamic diameter reflecting fill %

      const existingEntities = entitiesMapRef.current.get(node.node_id);

      if (existingEntities && existingEntities.length >= 5) {
        // --- 60 FPS In-Place Property Updates (Avoids Re-allocating WebGL Buffers) ---
        const [stockRing, innerRing, lightBeacon, coreRay, billboardEntity, selectionHalo] = existingEntities;

        if (stockRing && stockRing.ellipse) {
          stockRing.ellipse.semiMajorAxis = ringRadius;
          stockRing.ellipse.semiMinorAxis = ringRadius;
          stockRing.ellipse.material = new Cesium.ColorMaterialProperty(entityColor.withAlpha(0.28));
          stockRing.ellipse.outlineColor = entityColor.withAlpha(0.95);
        }
        if (innerRing && innerRing.ellipse) {
          innerRing.ellipse.material = new Cesium.ColorMaterialProperty(entityColor.withAlpha(0.4));
        }
        if (lightBeacon && lightBeacon.cylinder) {
          lightBeacon.cylinder.material = new Cesium.ColorMaterialProperty(entityColor.withAlpha(0.42));
          lightBeacon.cylinder.outlineColor = entityColor.withAlpha(0.85);
        }
        if (coreRay && coreRay.polyline) {
          coreRay.polyline.material = new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            taperPower: 0.1,
            color: entityColor
          });
        }
        if (billboardEntity && billboardEntity.label) {
          billboardEntity.label.text = `${node.shortName}\n${currentStock.toLocaleString()} u (${fillPct}%)`;
        }

        // Handle dynamic selection halo update
        if (isSelected && !selectionHalo) {
          const halo = viewer.entities.add({
            name: `${node.name} Selected Halo`,
            position: Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, 20),
            ellipse: {
              semiMajorAxis: ringRadius * 1.35,
              semiMinorAxis: ringRadius * 1.35,
              material: new Cesium.ColorMaterialProperty(
                Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.3)
              ),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('#38bdf8'),
              outlineWidth: 3,
              height: 20,
              extrudedHeight: 30
            }
          });
          halo._nodeId = node.node_id;
          existingEntities.push(halo);
        } else if (!isSelected && selectionHalo) {
          viewer.entities.remove(selectionHalo);
          existingEntities.pop();
        }
        return;
      }

      // --- Initial Creation if Not Present ---
      const entitiesForNode = [];

      // 1. Dynamic Holographic 3D Stock Capacity Ring
      const stockRing = viewer.entities.add({
        name: `${node.name} Stock Ring`,
        position: Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, 10),
        ellipse: {
          semiMajorAxis: ringRadius,
          semiMinorAxis: ringRadius,
          material: new Cesium.ColorMaterialProperty(entityColor.withAlpha(0.28)),
          outline: true,
          outlineColor: entityColor.withAlpha(0.95),
          outlineWidth: 3,
          height: 10,
          extrudedHeight: 45
        }
      });
      stockRing._nodeId = node.node_id;
      entitiesForNode.push(stockRing);

      // 2. Inner Concentric Ring
      const innerRing = viewer.entities.add({
        name: `${node.name} Inner Core Ring`,
        position: Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, 15),
        ellipse: {
          semiMajorAxis: ringRadius * 0.42,
          semiMinorAxis: ringRadius * 0.42,
          material: new Cesium.ColorMaterialProperty(entityColor.withAlpha(0.4)),
          outline: true,
          outlineColor: entityColor,
          outlineWidth: 2,
          height: 15,
          extrudedHeight: 25
        }
      });
      innerRing._nodeId = node.node_id;
      entitiesForNode.push(innerRing);

      // 3. Volumetric Vertical Light Beacon Cylinder
      const lightBeacon = viewer.entities.add({
        name: `${node.name} Light Beacon`,
        position: Cesium.Cartesian3.fromDegrees(
          node.longitude,
          node.latitude,
          beaconHeight / 2
        ),
        cylinder: {
          length: beaconHeight,
          topRadius: 32.0,
          bottomRadius: 75.0,
          material: new Cesium.ColorMaterialProperty(entityColor.withAlpha(0.42)),
          outline: true,
          outlineColor: entityColor.withAlpha(0.85),
          outlineWidth: 1.5
        }
      });
      lightBeacon._nodeId = node.node_id;
      entitiesForNode.push(lightBeacon);

      // 4. Central Glowing Core Polyline
      const coreRay = viewer.entities.add({
        name: `${node.name} Core Ray`,
        polyline: {
          positions: [
            Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, 0),
            Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, beaconHeight + 200)
          ],
          width: 3.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            taperPower: 0.1,
            color: entityColor
          })
        }
      });
      coreRay._nodeId = node.node_id;
      entitiesForNode.push(coreRay);

      // 5. Billboard Pin Badge and Label HUD
      const billboardPos = Cesium.Cartesian3.fromDegrees(
        node.longitude,
        node.latitude,
        beaconHeight + 350
      );

      const billboardSvg = createPinIconSvg(node.echelon_tier, hexColor);

      const billboardEntity = viewer.entities.add({
        name: `${node.name} Billboard`,
        position: billboardPos,
        billboard: {
          image: billboardSvg,
          width: 42,
          height: 42,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: `${node.shortName}\n${currentStock.toLocaleString()} u (${fillPct}%)`,
          font: '900 12px "Plus Jakarta Sans", sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.fromCssColorString('#020617'),
          outlineWidth: 4,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          pixelOffset: new Cesium.Cartesian2(0, -48),
          backgroundColor: Cesium.Color.fromCssColorString('#0f172a').withAlpha(0.82),
          showBackground: true,
          backgroundPadding: new Cesium.Cartesian2(8, 4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      billboardEntity._nodeId = node.node_id;
      entitiesForNode.push(billboardEntity);

      // 6. Selected Facility Halo Highlighter
      if (isSelected) {
        const selectionHalo = viewer.entities.add({
          name: `${node.name} Selected Halo`,
          position: Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, 20),
          ellipse: {
            semiMajorAxis: ringRadius * 1.35,
            semiMinorAxis: ringRadius * 1.35,
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.3)
            ),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#38bdf8'),
            outlineWidth: 3,
            height: 20,
            extrudedHeight: 30
          }
        });
        selectionHalo._nodeId = node.node_id;
        entitiesForNode.push(selectionHalo);
      }

      entitiesMapRef.current.set(node.node_id, entitiesForNode);
    });
  }, [isViewerReady, selectedNodeId, liveStockMap]);

  // 3. Synchronize 3D Highway Flow Conduits & Alternative Bypass Corridors
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !isViewerReady) return;

    // Clear previous corridor entities
    corridorEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    corridorEntitiesRef.current = [];

    if (!showFlowConduits) return;

    // Determine which links are affected by active scenario
    const epicenterConfig = SCENARIO_EPICENTERS[activeScenarioId] || null;
    const affectedLinkIds = new Set(epicenterConfig?.affected_links || []);

    HIGHWAY_CORRIDORS.forEach((corridor) => {
      const isDisrupted = affectedLinkIds.has(corridor.link_id);

      // Convert WGS84 coordinates to Cesium Cartesian3 flat array
      const positions = Cesium.Cartesian3.fromDegreesArray(
        corridor.geometry.flatMap(([lat, lon]) => [lon, lat])
      );

      if (isDisrupted) {
        // --- Disrupted Primary Corridor: Pulsating Red Dashed Hazard Aesthetic ---
        const hazardLine = viewer.entities.add({
          name: `${corridor.corridor_name} (Disrupted Shock Hazard)`,
          polyline: {
            positions,
            width: 6.5,
            clampToGround: true,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.fromCssColorString('#ef4444'),
              gapColor: Cesium.Color.fromCssColorString('#7f1d1d').withAlpha(0.7),
              dashLength: 26.0
            })
          }
        });
        corridorEntitiesRef.current.push(hazardLine);

        // Hazard midpoint warning label
        const midIdx = Math.floor(corridor.geometry.length / 2);
        const midPt = corridor.geometry[midIdx];
        const hazardLabel = viewer.entities.add({
          name: `${corridor.corridor_name} Hazard Label`,
          position: Cesium.Cartesian3.fromDegrees(midPt[1], midPt[0], 250),
          label: {
            text: `⚠️ DISRUPTED (${shockIntensity}% IMPAIRMENT)\n${corridor.corridor_name}`,
            font: '900 11px "Plus Jakarta Sans", sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#fca5a5'),
            outlineColor: Cesium.Color.fromCssColorString('#7f1d1d'),
            outlineWidth: 3.5,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            backgroundColor: Cesium.Color.fromCssColorString('#450a0a').withAlpha(0.9),
            showBackground: true,
            backgroundPadding: new Cesium.Cartesian2(6, 3),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        corridorEntitiesRef.current.push(hazardLabel);

        // --- Active Mitigation Bypass Route: Glowing Emerald / Electric Cyan ---
        if (enableMitigation && corridor.alternative_route) {
          const altPositions = Cesium.Cartesian3.fromDegreesArray(
            corridor.alternative_route.geometry.flatMap(([lat, lon]) => [lon, lat])
          );

          const bypassLine = viewer.entities.add({
            name: `${corridor.alternative_route.name} (Active Dynamic Bypass)`,
            polyline: {
              positions: altPositions,
              width: 5.5,
              clampToGround: true,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.38,
                taperPower: 0.1,
                color: Cesium.Color.fromCssColorString('#10b981')
              })
            }
          });
          corridorEntitiesRef.current.push(bypassLine);

          // Bypass label at midpoint
          const altMidIdx = Math.floor(corridor.alternative_route.geometry.length / 2);
          const altMidPt = corridor.alternative_route.geometry[altMidIdx];
          const bypassLabel = viewer.entities.add({
            name: `${corridor.alternative_route.name} Bypass Label`,
            position: Cesium.Cartesian3.fromDegrees(altMidPt[1], altMidPt[0], 200),
            label: {
              text: `🔄 ACTIVE MITIGATION BYPASS\n${corridor.alternative_route.name}`,
              font: '900 11px "Plus Jakarta Sans", sans-serif',
              fillColor: Cesium.Color.fromCssColorString('#a7f3d0'),
              outlineColor: Cesium.Color.fromCssColorString('#064e3b'),
              outlineWidth: 3.5,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              backgroundColor: Cesium.Color.fromCssColorString('#064e3b').withAlpha(0.85),
              showBackground: true,
              backgroundPadding: new Cesium.Cartesian2(6, 3),
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
          });
          corridorEntitiesRef.current.push(bypassLabel);
        }
      } else {
        // --- Normal Active Flow Corridor: Electric Cyan Glowing Conduit ---
        const normalLine = viewer.entities.add({
          name: `${corridor.corridor_name} (Active Flow Conduit)`,
          polyline: {
            positions,
            width: 4.8,
            clampToGround: true,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.28,
              taperPower: 0.05,
              color: Cesium.Color.fromCssColorString('#38bdf8')
            })
          }
        });
        corridorEntitiesRef.current.push(normalLine);
      }
    });
  }, [isViewerReady, showFlowConduits, activeScenarioId, shockIntensity, enableMitigation]);

  // 4. Synchronize 3D Disruption Shockwave Ellipsoid at Epicenter
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !isViewerReady) return;

    shockwaveEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
    shockwaveEntitiesRef.current = [];

    if (!showShockwaves) return;

    const epicenter = SCENARIO_EPICENTERS[activeScenarioId];
    if (!epicenter) return;

    const baseRadius = epicenter.radius_meters || 3500;
    const centerPos = Cesium.Cartesian3.fromDegrees(
      epicenter.longitude,
      epicenter.latitude,
      50
    );

    // Pulsating Volumetric 3D Shockwave Ellipsoid
    const pulsatingEllipsoid = viewer.entities.add({
      name: `${epicenter.name} 3D Shockwave Ellipsoid`,
      position: centerPos,
      ellipsoid: {
        radii: new Cesium.CallbackProperty(() => {
          const now = Date.now() / 1000.0;
          const cycle = (now % 2.5) / 2.5; // 0.0 to 1.0 every 2.5s
          const currentRadius = baseRadius * (0.6 + 0.65 * cycle);
          return new Cesium.Cartesian3(currentRadius, currentRadius, currentRadius * 0.45);
        }, false),
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => {
            const now = Date.now() / 1000.0;
            const cycle = (now % 2.5) / 2.5;
            const alpha = 0.4 * (1.0 - cycle); // Fades out as shockwave expands
            return Cesium.Color.fromCssColorString('#ef4444').withAlpha(alpha);
          }, false)
        ),
        outline: true,
        outlineColor: new Cesium.CallbackProperty(() => {
          return Cesium.Color.fromCssColorString('#f87171').withAlpha(0.85);
        }, false),
        outlineWidth: 2
      }
    });
    shockwaveEntitiesRef.current.push(pulsatingEllipsoid);

    // Hazard Marker Billboard at Epicenter
    const hazardMarker = viewer.entities.add({
      name: `${epicenter.name} Epicenter Marker`,
      position: Cesium.Cartesian3.fromDegrees(
        epicenter.longitude,
        epicenter.latitude,
        180
      ),
      billboard: {
        image: createPinIconSvg(0, '#ef4444'),
        width: 48,
        height: 48,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: `EPICENTER: ${epicenter.name}\n${epicenter.hazard_type} (${shockIntensity}%)`,
        font: '900 12px "Plus Jakarta Sans", sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#7f1d1d'),
        outlineWidth: 4,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, -48),
        backgroundColor: Cesium.Color.fromCssColorString('#7f1d1d').withAlpha(0.9),
        showBackground: true,
        backgroundPadding: new Cesium.Cartesian2(8, 4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    shockwaveEntitiesRef.current.push(hazardMarker);
  }, [isViewerReady, showShockwaves, activeScenarioId, shockIntensity]);

  // Smooth cinematic glide to a facility hub
  const flyToNode = useCallback((nodeId) => {
    setActivePreset(nodeId);
    if (useSchematicView) return;

    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const node = FACILITY_NODES.find((n) => n.node_id === nodeId);
    if (!node || !node.cameraPreset) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        node.cameraPreset.longitude,
        node.cameraPreset.latitude,
        node.cameraPreset.height
      ),
      orientation: {
        heading: Cesium.Math.toRadians(node.cameraPreset.heading),
        pitch: Cesium.Math.toRadians(node.cameraPreset.pitch),
        roll: Cesium.Math.toRadians(node.cameraPreset.roll)
      },
      duration: 2.0
    });
  }, [useSchematicView]);

  // Smooth cinematic glide to a named camera preset
  const flyToPreset = useCallback((presetKey) => {
    setActivePreset(presetKey);
    if (useSchematicView) return;

    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const preset = CAMERA_PRESETS[presetKey];
    if (!preset) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        preset.longitude,
        preset.latitude,
        preset.height
      ),
      orientation: {
        heading: Cesium.Math.toRadians(preset.heading),
        pitch: Cesium.Math.toRadians(preset.pitch),
        roll: Cesium.Math.toRadians(preset.roll)
      },
      duration: 2.0
    });
  }, [useSchematicView]);

  // Toggle 3D OSM Buildings
  const handleToggleBuildings = () => {
    if (osmBuildingsTilesetRef.current) {
      osmBuildingsTilesetRef.current.show = !showBuildings;
      setShowBuildings(!showBuildings);
    }
  };

  // Imperative API for parent container control
  useImperativeHandle(ref, () => ({
    flyToNode: (nodeId) => flyToNode(nodeId),
    flyToPreset: (presetKey) => flyToPreset(presetKey),
    resetCamera: () => flyToPreset('CORRIDOR_OVERVIEW'),
    toggleBuildings: handleToggleBuildings,
    setShowFlowConduits,
    setShowShockwaves,
    setShowBuildings,
    showFlowConduits,
    showShockwaves,
    showBuildings,
    activePreset,
    useSchematicView,
    setUseSchematicView
  }), [flyToNode, flyToPreset, handleToggleBuildings, showFlowConduits, showShockwaves, showBuildings, activePreset, useSchematicView]);

  // Node icon helper
  const getNodeIcon = (nodeType) => {
    switch (nodeType) {
      case 'port':
        return <Anchor className="w-3.5 h-3.5 text-blue-400" />;
      case 'central_dc':
        return <Package className="w-3.5 h-3.5 text-orange-400" />;
      case 'regional_hub':
        return <Building2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'regional_depot':
        return <Layers className="w-3.5 h-3.5 text-purple-400" />;
      case 'fulfillment_center':
        return <Truck className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const activeEpicenter = SCENARIO_EPICENTERS[activeScenarioId];
  const affectedLinksSet = useMemo(() => {
    return new Set(activeEpicenter?.affected_links || []);
  }, [activeEpicenter]);

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border-2 border-slate-700/80 bg-slate-950 shadow-2xl select-none ${className}`}
      style={{ height }}
    >
      {/* Viewport Render Layer 1: Cesium 3D Globe Canvas Mount */}
      <div
        ref={containerRef}
        className={`w-full h-full ${useSchematicView ? 'hidden' : 'block'}`}
      />

      {/* Hidden container for default Cesium credit link */}
      <div ref={creditContainerRef} className="hidden" />

      {/* Viewport Render Layer 2: Cyber-Tactical 2.5D / 3D Schematic Vector Fallback View */}
      {useSchematicView && (
        <div className="absolute inset-0 w-full h-full bg-[#050a14] overflow-hidden flex flex-col justify-between">
          <svg className="w-full h-full absolute inset-0" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* Cybernetic Dot-Grid Pattern */}
              <pattern id="tacticalGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" opacity="0.45" />
                <circle cx="0" cy="0" r="1.5" fill="#334155" opacity="0.6" />
              </pattern>

              {/* Radial glow filter */}
              <filter id="corridorGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              <radialGradient id="epicenterRipple" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
                <stop offset="70%" stopColor="#ef4444" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Tactical Grid Background */}
            <rect width="100%" height="100%" fill="url(#tacticalGrid)" />

            {/* Geographical Western Ghats Mountain Range Graphic Contour */}
            <path
              d="M 500 50 Q 560 160 590 280 T 630 650"
              fill="none"
              stroke="#1e3a8a"
              strokeWidth="24"
              strokeLinecap="round"
              opacity="0.15"
            />
            <text x="615" y="240" fill="#3b82f6" opacity="0.3" fontSize="11" fontWeight="800" letterSpacing="4">
              WESTERN GHATS RANGE
            </text>

            {/* Mountain Pass Landmark: Kasara Ghat */}
            <g
              transform="translate(600, 185)"
              className="cursor-pointer"
              onClick={() => flyToPreset('KASARA_GHAT')}
            >
              <polygon points="0,-16 14,12 -14,12" fill="#78350f" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="18" y="2" fill="#fbbf24" fontSize="11" fontWeight="800">
                Kasara Ghat (585m)
              </text>
            </g>

            {/* Highway Conduits & Bypasses */}
            {showFlowConduits && HIGHWAY_CORRIDORS.map((corridor) => {
              const paths = SCHEMATIC_CORRIDOR_PATHS[corridor.link_id];
              if (!paths) return null;

              const isDisrupted = affectedLinksSet.has(corridor.link_id);

              return (
                <g key={corridor.link_id}>
                  {/* Primary Highway Path */}
                  <path
                    d={paths.path}
                    fill="none"
                    stroke={isDisrupted ? '#ef4444' : '#0284c7'}
                    strokeWidth={isDisrupted ? '4.5' : '3.5'}
                    strokeDasharray={isDisrupted ? '8 6' : 'none'}
                    className={isDisrupted ? 'animate-pulse' : ''}
                    filter="url(#corridorGlow)"
                  />

                  {/* Disrupted Hazard Badge */}
                  {isDisrupted && (
                    <g transform={`translate(${paths.mid.x}, ${paths.mid.y})`}>
                      <rect x="-55" y="-14" width="110" height="28" rx="6" fill="#450a0a" stroke="#ef4444" strokeWidth="1.5" />
                      <text x="0" y="4" fill="#fca5a5" fontSize="10" fontWeight="900" textAnchor="middle">
                        ⚠️ SHOCK DISRUPTED
                      </text>
                    </g>
                  )}

                  {/* Active Mitigation Bypass Path */}
                  {isDisrupted && enableMitigation && paths.bypassPath && (
                    <g>
                      <path
                        d={paths.bypassPath}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3.5"
                        strokeDasharray="6 4"
                        filter="url(#corridorGlow)"
                      />
                      <g transform={`translate(${paths.mid.x + 35}, ${paths.mid.y + 40})`}>
                        <rect x="-60" y="-12" width="120" height="24" rx="5" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
                        <text x="0" y="4" fill="#a7f3d0" fontSize="9" fontWeight="900" textAnchor="middle">
                          🔄 DETOUR BYPASS ACTIVE
                        </text>
                      </g>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Active Shockwave Concentric Radar Waves */}
            {showShockwaves && activeEpicenter && SCHEMATIC_EPICENTERS[activeScenarioId] && (
              <g transform={`translate(${SCHEMATIC_EPICENTERS[activeScenarioId].x}, ${SCHEMATIC_EPICENTERS[activeScenarioId].y})`}>
                <circle r="75" fill="url(#epicenterRipple)" className="animate-ping" opacity="0.75" />
                <circle r="48" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" className="animate-spin" />
                <circle r="22" fill="#991b1b" stroke="#fca5a5" strokeWidth="2.5" />
                <text x="0" y="5" fill="#ffffff" fontSize="14" fontWeight="900" textAnchor="middle">!</text>
              </g>
            )}

            {/* Synchronized Commercial Freight Vehicle (Truck) on Schematic Corridor */}
            {vehicleGps && (() => {
              const vProgress = vehicleGps.progress ?? 0.15;
              const vPos = calculateSchematicVehiclePos(vProgress);
              return (
                <g transform={`translate(${vPos.x}, ${vPos.y})`} className="transition-transform duration-100">
                  <circle r="16" fill="#ff5400" fillOpacity="0.25" className="animate-ping" />
                  <circle r="10" fill="#ff5400" stroke="#ffffff" strokeWidth="2.5" filter="url(#corridorGlow)" />
                  <circle r="4" fill="#ffffff" />
                  <g transform="translate(0, -20)">
                    <rect
                      x="-48"
                      y="-12"
                      width="96"
                      height="20"
                      rx="5"
                      fill="#090d16"
                      fillOpacity="0.95"
                      stroke="#ff5400"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="2"
                      fill="#38bdf8"
                      fontSize="9"
                      fontWeight="900"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {vehicleGps.id || 'TRK-MH-01'} • {vehicleGps.speedKmh || 64}k
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* Multi-Echelon Facility Nodes */}
            {FACILITY_NODES.map((node) => {
              const coords = SCHEMATIC_COORDS[node.node_id];
              if (!coords) return null;

              const isSelected = selectedNodeId === node.node_id;
              const isHovered = hoveredNode?.node_id === node.node_id;
              const currentStock = liveStockMap.get(node.node_id) ?? node.nominal_stock;
              const { fillPct, hexColor } = getStockCapacityStatus(currentStock, node.capacity_units);

              const outerRadius = 26 + (fillPct / 100) * 16;

              return (
                <g
                  key={node.node_id}
                  transform={`translate(${coords.x}, ${coords.y})`}
                  className="cursor-pointer transition-transform"
                  onClick={() => {
                    onSelectNode(node.node_id);
                    flyToNode(node.node_id);
                  }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Selection Cyan Halo */}
                  {isSelected && (
                    <circle
                      r={outerRadius + 14}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      className="animate-spin"
                    />
                  )}

                  {/* Stock Capacity Ring (Color Coded: Emerald >=60%, Amber 30-59%, Red <30%) */}
                  <circle
                    r={outerRadius}
                    fill={hexColor}
                    fillOpacity="0.22"
                    stroke={hexColor}
                    strokeWidth="3.5"
                    filter="url(#corridorGlow)"
                  />

                  {/* Inner Node Hub Circle */}
                  <circle
                    r="18"
                    fill="#0f172a"
                    stroke={isSelected ? '#38bdf8' : hexColor}
                    strokeWidth="2.5"
                  />

                  {/* Node Tier Center Label */}
                  <text
                    x="0"
                    y="5"
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="900"
                    textAnchor="middle"
                  >
                    T{node.echelon_tier}
                  </text>

                  {/* Holographic Facility Label Badge */}
                  <g transform={`translate(0, ${coords.labelY - coords.y})`}>
                    <rect
                      x="-65"
                      y="-18"
                      width="130"
                      height="36"
                      rx="8"
                      fill="#090d16"
                      fillOpacity="0.9"
                      stroke={isSelected ? '#38bdf8' : '#334155'}
                      strokeWidth={isSelected ? '2' : '1'}
                    />
                    <text x="0" y="-3" fill="#f8fafc" fontSize="11" fontWeight="800" textAnchor="middle">
                      {node.shortName}
                    </text>
                    <text x="0" y="11" fill={hexColor} fontSize="10" fontWeight="900" textAnchor="middle">
                      {currentStock.toLocaleString()} u ({fillPct}%)
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Offline Schematic View Header Banner */}
          <div className="absolute top-14 left-4 z-20 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white shadow-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black tracking-wide text-slate-200 uppercase">
                3D Schematic Mode Active (Offline Resilient)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Compact Status Overlay when operating in PiP Mode */}
      {isPiP && (
        <div className="absolute top-2 left-2 z-20 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-white text-[10px] font-mono shadow-xl backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-extrabold text-cyan-300">WGS84 RADAR</span>
          {vehicleGps && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-amber-300 font-bold">{vehicleGps.speedKmh} km/h</span>
            </>
          )}
        </div>
      )}

      {/* Top Floating Quick-Navigation Camera Ribbon */}
      {effectiveShowTopRibbon && (
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Left: Corridor Header & Cyber Tag */}
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-white shadow-lg">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black tracking-wide text-slate-100 uppercase">
              Western India 3D Cyber-Twin
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold border border-blue-500/30">
              {useSchematicView ? '2.5D Schematic' : 'WGS84 Real-World'}
            </span>
          </div>

          {/* Right: Quick Camera Presets Ribbon */}
          <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 shadow-lg overflow-x-auto max-w-full">
            {/* Overview Reset Button */}
            <button
              type="button"
              onClick={() => flyToPreset('CORRIDOR_OVERVIEW')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activePreset === 'CORRIDOR_OVERVIEW'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Corridor Overview"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

            {/* Individual Hub Glide Links */}
            {FACILITY_NODES.map((node) => {
              const isSelected = selectedNodeId === node.node_id;
              return (
                <button
                  key={node.node_id}
                  type="button"
                  onClick={() => {
                    onSelectNode(node.node_id);
                    flyToNode(node.node_id);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#ff5400] text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title={`${node.tier_label} • ${node.city}`}
                >
                  {getNodeIcon(node.node_type)}
                  <span>{node.shortName}</span>
                </button>
              );
            })}

            <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

            {/* Mountain Pass Preset: Kasara Ghat */}
            <button
              type="button"
              onClick={() => flyToPreset('KASARA_GHAT')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activePreset === 'KASARA_GHAT'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-400/90 hover:text-amber-300 hover:bg-slate-800'
              }`}
              title="Steep mountain pass on NH-160 subject to monsoon landslides"
            >
              <Mountain className="w-3.5 h-3.5" />
              <span>Kasara Ghat</span>
            </button>
          </div>
        </div>
      )}

      {/* Top-Right: Floating Autonomous AI Sentinel 1Hz HUD */}
      {effectiveShowSentinelHUD && (
        <div className="absolute top-3 right-3 z-20 pointer-events-auto max-w-xs sm:max-w-sm">
          <AutonomousSentinelHUD compact={false} />
        </div>
      )}

      {/* Bottom-Left: Holographic Stock Ring Legend, Flow Status, & Active Shock Banner */}
      {effectiveShowLegend && (
        <div className="absolute bottom-3 left-3 z-20 pointer-events-auto flex flex-col gap-2 max-w-sm">
          {/* Active Disruption Alert HUD */}
          {activeEpicenter && (
            <div className="p-2.5 rounded-xl bg-rose-950/90 backdrop-blur-md border border-rose-500/60 text-white shadow-xl flex items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <div className="text-[11px] font-black text-rose-200 uppercase tracking-wide">
                    Active Shock: {activeEpicenter.name}
                  </div>
                  <div className="text-[10px] text-rose-300 font-medium">
                    {enableMitigation ? 'Cyan/Emerald Bypass Route Active' : 'Detours Disabled — Hazard Red'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-rose-900 border border-rose-400 text-rose-200">
                {shockIntensity}%
              </span>
            </div>
          )}

          {/* Corridor & Stock Rings Legend Card */}
          <div className="p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white shadow-xl space-y-2">
            <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-400 tracking-wider">
              <span>Network Layers & Status</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {useSchematicView ? '2.5D Schematic' : '3D Photorealistic'}
              </span>
            </div>

            {/* Highway Conduits Legend */}
            <div className="flex items-center gap-2 text-[10px] font-bold border-b border-slate-700/60 pb-2">
              <span className="flex items-center gap-1 text-sky-400">
                <span className="w-3 h-1 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                Nominal
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-3 h-1 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]" />
                Disrupted
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-3 h-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                Bypass Route
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold pt-0.5">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                <span>&ge;60% Safe</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-950/60 border border-amber-600/40 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                <span>30-59% Warn</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-950/60 border border-rose-600/40 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#ef4444]" />
                <span>&lt;30% Risk</span>
              </div>
            </div>

            {hoveredNode && (
              <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                <div className="font-extrabold text-white flex items-center gap-1.5">
                  {getNodeIcon(hoveredNode.node_type)}
                  <span>{hoveredNode.name}</span>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">
                  {hoveredNode.city}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom-Right: Viewport Controls & Highway Conduit Toggles */}
      {effectiveShowControls && (
        <div className="absolute bottom-3 right-3 z-20 pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-xl text-white">
          {/* Toggle between 3D Globe and 3D Schematic Mode */}
          <button
            type="button"
            onClick={() => setUseSchematicView(!useSchematicView)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              useSchematicView
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Toggle between 3D Globe and 2.5D Schematic Vector View"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{useSchematicView ? 'Switch to Globe' : '3D Schematic'}</span>
          </button>

          {/* Toggle 3D Flow Conduits */}
          <button
            type="button"
            onClick={() => setShowFlowConduits(!showFlowConduits)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              showFlowConduits
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle 3D Highway Flow Conduits & Bypasses"
          >
            <Route className="w-3.5 h-3.5" />
            <span>Highways</span>
          </button>

          {/* Toggle Shockwaves */}
          <button
            type="button"
            onClick={() => setShowShockwaves(!showShockwaves)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              showShockwaves
                ? 'bg-rose-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Volumetric Disruption Shockwave"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Shockwave</span>
          </button>

          {/* Toggle 3D Buildings (Only in Globe mode) */}
          {!useSchematicView && (
            <button
              type="button"
              onClick={handleToggleBuildings}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                showBuildings
                  ? 'bg-blue-600/80 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Photorealistic 3D OSM Buildings"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>3D Mesh</span>
            </button>
          )}

          {/* Reset Camera */}
          <button
            type="button"
            onClick={() => flyToPreset('CORRIDOR_OVERVIEW')}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Reset Camera to Corridor Overview"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Fallback Setup Instructions & Interactive Token Modal */}
      {tokenMissing && !useSchematicView && !isPiP && (
        <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border-2 border-amber-500/50 shadow-2xl text-white space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Cesium Ion Token Unconfigured</h4>
                <p className="text-xs text-amber-300/80 font-medium">World Terrain & 3D Buildings require authentication</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To render photorealistic 3D terrain and OSM building meshes for the Western India corridor, configure your Cesium Ion access token or operate in high-performance 3D schematic mode:
            </p>

            {/* Interactive Token Input Field */}
            <form onSubmit={handleApplyToken} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Paste Cesium Ion JWT Token..."
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 font-mono text-xs text-emerald-400 border border-slate-700 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!customToken.trim()}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white transition cursor-pointer"
                >
                  Apply
                </button>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Environment: VITE_CESIUM_ION_TOKEN
              </div>
            </form>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <a
                href="https://cesium.com/ion/tokens"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 underline underline-offset-4"
              >
                <span>Get Free Token</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUseSchematicView(true);
                    setTokenMissing(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  Use 3D Schematic
                </button>
                <button
                  type="button"
                  onClick={() => setTokenMissing(false)}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black shadow-lg hover:bg-amber-400 transition cursor-pointer"
                >
                  Continue Base View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default CesiumTwinViewport;
