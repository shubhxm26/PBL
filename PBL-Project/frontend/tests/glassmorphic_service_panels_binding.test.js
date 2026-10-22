import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  DOCK_SERVICES,
  clampCoordinates,
  WORKSPACE_STORAGE_KEY
} from '../src/constants/dockConfig.js';
import {
  STAGE_FACILITIES,
  STAGE_NODES,
  CAMERA_VIEWS
} from '../src/constants/stage3DTopology.js';
import {
  CAMERA_MODES
} from '../src/utils/cameraControllers.js';
import {
  createProceduralTruck,
  createRoadblockBarricade,
  createFacilityNodeModel
} from '../src/components/3d/proceduralModels.js';
import {
  createCorridorLogisticsNodes,
  buildCorridorSplines
} from '../src/components/3d/proceduralWorld.js';
import {
  FROSTED_GLASS_CONTAINER_CLASSES,
  SERVICE_MODULE_IDS,
  FACILITY_TO_SKU,
  SKU_TO_FACILITY,
  CORRIDOR_INCIDENTS,
  buildInitialWorkspaceWindows,
  handleWindowMinimize,
  handleWindowMaximize,
  handleWindowRestore,
  handleWindowDrag,
  handleWindowResize,
  create3DFlyToCommand,
  calculateFacilityCameraFocus,
  resolveRaycastEntityHit,
  generateDemandHeatmapData,
  generateOptimalRouteVector
} from '../src/utils/workspaceBindingControllers.js';

describe('05: Glassmorphic Service Panels & Bi-Directional 3D Scene Binding', () => {

  // =========================================================================
  // 1. Frosted Glass Container & 6 Service Modules Architecture
  // =========================================================================
  describe('1. Frosted Glass Container Styling & Service Modules Architecture', () => {
    it('Verifies frosted glass styling invariant: backdrop-blur-md bg-slate-950/75 border-slate-700/50', () => {
      assert.ok(
        FROSTED_GLASS_CONTAINER_CLASSES.includes('backdrop-blur-md'),
        'Must contain backdrop-blur-md token'
      );
      assert.ok(
        FROSTED_GLASS_CONTAINER_CLASSES.includes('bg-slate-950/75'),
        'Must contain bg-slate-950/75 dark obsidian glass background'
      );
      assert.ok(
        FROSTED_GLASS_CONTAINER_CLASSES.includes('border-slate-700/50'),
        'Must contain border-slate-700/50 subtle neon-tinted border'
      );
      assert.ok(
        FROSTED_GLASS_CONTAINER_CLASSES.includes('cyber-glass'),
        'Must include cyber-glass theme utility class'
      );
    });

    it('Registers all six backend business service modules in dock configuration', () => {
      const registeredIds = DOCK_SERVICES.map((s) => s.id);

      SERVICE_MODULE_IDS.forEach((expectedId) => {
        assert.ok(
          registeredIds.includes(expectedId),
          `Dock services must register business module: ${expectedId}`
        );
      });

      assert.ok(registeredIds.includes('forecasting'), 'Forecasting panel registered');
      assert.ok(registeredIds.includes('routing'), 'Routing & Fleet optimizer registered');
      assert.ok(registeredIds.includes('compliance'), 'Trade compliance & IDP registered');
      assert.ok(registeredIds.includes('sentinel'), 'Autonomous AI Sentinel registered');
      assert.ok(registeredIds.includes('kpis'), 'Executive KPIs registered');
      assert.ok(registeredIds.includes('system'), 'IT Admin and retraining registered');
    });

    it('Each service panel defines unique thematic colors, badge tags, and geometry bounds', () => {
      DOCK_SERVICES.forEach((service) => {
        assert.ok(service.themeColor.startsWith('#'), `${service.id} themeColor must be valid hex`);
        assert.ok(service.badgeText, `${service.id} must define operational badge text`);
        assert.ok(service.defaultPos, `${service.id} must specify default layout coordinates`);
        assert.ok(service.defaultPos.width >= 400, `${service.id} default width must accommodate data tables`);
        assert.ok(service.defaultPos.height >= 500, `${service.id} default height must fit scrollable content`);
      });
    });
  });

  // =========================================================================
  // 2. Responsive Panel Window Geometry Lifecycle
  // =========================================================================
  describe('2. Window Manager Geometry, Coordinate Clamping & State Transitions', () => {
    it('Initializes window state map with viewport boundary clamping', () => {
      const windows = buildInitialWorkspaceWindows(1440, 900);
      assert.ok(windows.kpis.isOpen, 'Executive KPIs should be open by default on desktop');
      assert.ok(windows.sentinel.isOpen, 'Autonomous Sentinel should be open by default on desktop');
      assert.strictEqual(windows.forecasting.isMinimized, false);
      assert.strictEqual(windows.routing.isMaximized, false);

      // Verify clamped positions stay inside visible canvas
      Object.values(windows).forEach((win) => {
        assert.ok(win.position.x >= 8, 'Window x-position must be >= 8px');
        assert.ok(win.position.y >= 62, 'Window y-position must be below 62px header');
        assert.ok(win.size.width <= 1440 - 24, 'Window width must fit within viewport');
        assert.ok(win.size.height <= 900 - 80, 'Window height must fit within viewport');
      });
    });

    it('Transitions panel state cleanly on Minimize (collapses to floating pill)', () => {
      let windows = buildInitialWorkspaceWindows(1440, 900);
      windows = handleWindowMinimize(windows, 'routing');

      assert.strictEqual(windows.routing.isMinimized, true, 'Routing panel must become minimized');
      assert.ok(windows.routing.position, 'Position coordinates preserved for floating pill');
    });

    it('Transitions panel state cleanly on Maximize and preserves previous geometry for Restore', () => {
      let windows = buildInitialWorkspaceWindows(1440, 900);
      const initialPos = { ...windows.forecasting.position };
      const initialSize = { ...windows.forecasting.size };

      // 1. Maximize
      windows = handleWindowMaximize(windows, 'forecasting', 1440, 900);
      assert.strictEqual(windows.forecasting.isMaximized, true);
      assert.strictEqual(windows.forecasting.isMinimized, false);
      assert.strictEqual(windows.forecasting.position.x, 12);
      assert.strictEqual(windows.forecasting.position.y, 64);
      assert.strictEqual(windows.forecasting.size.width, 1440 - 24);
      assert.strictEqual(windows.forecasting.size.height, 900 - 148);
      assert.deepStrictEqual(windows.forecasting.prevRect.position, initialPos);
      assert.deepStrictEqual(windows.forecasting.prevRect.size, initialSize);

      // 2. Restore
      windows = handleWindowMaximize(windows, 'forecasting', 1440, 900);
      assert.strictEqual(windows.forecasting.isMaximized, false);
      assert.deepStrictEqual(windows.forecasting.position, initialPos);
      assert.deepStrictEqual(windows.forecasting.size, initialSize);
      assert.strictEqual(windows.forecasting.prevRect, null);
    });

    it('Clamps drag repositioning so panels cannot be dragged off-screen', () => {
      let windows = buildInitialWorkspaceWindows(1440, 900);

      // Attempt to drag off left edge
      windows = handleWindowDrag(windows, 'kpis', -500, 100, 1440, 900);
      assert.strictEqual(windows.kpis.position.x, 8, 'Left clamping must keep panel visible (>= 8px)');

      // Attempt to drag off top edge above status bar
      windows = handleWindowDrag(windows, 'kpis', 200, -200, 1440, 900);
      assert.strictEqual(windows.kpis.position.y, 62, 'Top clamping must keep panel below header (>= 62px)');

      // Attempt to drag off right edge
      windows = handleWindowDrag(windows, 'kpis', 2000, 100, 1440, 900);
      const expectedMaxX = 1440 - windows.kpis.size.width - 8;
      assert.strictEqual(windows.kpis.position.x, expectedMaxX, 'Right clamping must bound panel');
    });

    it('Enforces minimum size boundaries when resizing panels via grab handle', () => {
      let windows = buildInitialWorkspaceWindows(1440, 900);

      // Attempt to resize below minimum dimensions
      windows = handleWindowResize(windows, 'compliance', 100, 80, 1440, 900);
      assert.strictEqual(windows.compliance.size.width, 340, 'Width must enforce 340px minimum constraint');
      assert.strictEqual(windows.compliance.size.height, 260, 'Height must enforce 260px minimum constraint');

      // Valid resize
      windows = handleWindowResize(windows, 'compliance', 800, 650, 1440, 900);
      assert.strictEqual(windows.compliance.size.width, 800);
      assert.strictEqual(windows.compliance.size.height, 650);
    });
  });

  // =========================================================================
  // 3. Bi-Directional 3D Camera Fly-To & Facility Glow Binding
  // =========================================================================
  describe('3. Bi-Directional 3D Camera Fly-To & Facility Node/Route Glow Binding', () => {
    it('Normalizes 3D Fly-To commands dispatched as positional arguments or object payload', () => {
      // Positional call: trigger3DFlyTo('facility', 'DEP-NSK-01')
      const cmd1 = create3DFlyToCommand('facility', 'DEP-NSK-01');
      assert.strictEqual(cmd1.type, 'facility');
      assert.strictEqual(cmd1.id, 'DEP-NSK-01');
      assert.ok(cmd1.timestamp > 0);

      // Object payload call: trigger3DFlyTo({ type: 'vehicle', id: 'TRK-MH-02' })
      const cmd2 = create3DFlyToCommand({ type: 'vehicle', id: 'TRK-MH-02' });
      assert.strictEqual(cmd2.type, 'vehicle');
      assert.strictEqual(cmd2.id, 'TRK-MH-02');

      // Route fly-to: trigger3DFlyTo('route', 'LINK-BHW-NSK')
      const cmd3 = create3DFlyToCommand('route', 'LINK-BHW-NSK');
      assert.strictEqual(cmd3.type, 'route');
      assert.strictEqual(cmd3.id, 'LINK-BHW-NSK');
    });

    it('Calculates calibrated 3D camera inspection perspective for all 6 corridor facilities', () => {
      STAGE_FACILITIES.forEach((facility) => {
        const focus = calculateFacilityCameraFocus(facility.pos);
        assert.deepStrictEqual(focus.targetPos, facility.pos, 'Camera target must align with facility coordinates');
        assert.strictEqual(focus.cameraPos[0], facility.pos[0] + 18, 'Camera X offset +18 for angled 3/4 perspective');
        assert.strictEqual(focus.cameraPos[1], facility.pos[1] + 15, 'Camera Y offset +15 for elevation view');
        assert.strictEqual(focus.cameraPos[2], facility.pos[2] + 22, 'Camera Z offset +22 for clearance');
      });
    });

    it('Forecasting module maps 3D facility selection bidirectionally with SKU inventory units', () => {
      // Nashik Agro Depot ↔ SKU-NAS-AGRI-01
      assert.strictEqual(FACILITY_TO_SKU['DEP-NSK-01'], 'SKU-NAS-AGRI-01');
      assert.strictEqual(SKU_TO_FACILITY['SKU-NAS-AGRI-01'], 'DEP-NSK-01');

      // JNPT Maritime Port ↔ SKU-JNPT-ELEC-01
      assert.strictEqual(FACILITY_TO_SKU['PORT-JNPT-01'], 'SKU-JNPT-ELEC-01');
      assert.strictEqual(SKU_TO_FACILITY['SKU-JNPT-ELEC-01'], 'PORT-JNPT-01');

      // Bhiwandi Central DC ↔ SKU-MUM-PHARM-01
      assert.strictEqual(FACILITY_TO_SKU['DC-BHW-01'], 'SKU-MUM-PHARM-01');
      assert.strictEqual(SKU_TO_FACILITY['SKU-MUM-PHARM-01'], 'DC-BHW-01');

      // Thane Regional Hub ↔ SKU-THN-CHEM-01
      assert.strictEqual(FACILITY_TO_SKU['HUB-THN-01'], 'SKU-THN-CHEM-01');
      assert.strictEqual(SKU_TO_FACILITY['SKU-THN-CHEM-01'], 'HUB-THN-01');

      // Pune Fulfillment Center ↔ SKU-PUN-AUTO-01
      assert.strictEqual(FACILITY_TO_SKU['FC-PUN-01'], 'SKU-PUN-AUTO-01');
      assert.strictEqual(SKU_TO_FACILITY['SKU-PUN-AUTO-01'], 'FC-PUN-01');
    });

    it('Procedural logistics facilities map provides light beam and pulsating ring references for aura glowing', () => {
      const { group, rings, facilitiesMap } = createCorridorLogisticsNodes();
      assert.ok(group instanceof THREE.Group, 'Facilities container must be a THREE.Group');
      assert.strictEqual(Object.keys(facilitiesMap).length, 6, 'Must contain all 6 facilities');

      STAGE_FACILITIES.forEach((fac) => {
        const item = facilitiesMap[fac.id];
        assert.ok(item, `facilitiesMap must register ${fac.id}`);
        assert.ok(item.model, `${fac.id} must have 3D architectural model`);
        assert.ok(item.beam, `${fac.id} must have vertical holographic beacon`);
        assert.ok(item.ringMesh, `${fac.id} must have pulsing ground ring`);
        assert.strictEqual(item.node.id, fac.id);
      });
    });
  });

  // =========================================================================
  // 4. Autonomous Sentinel Disruption Zone & Mitigation Actions
  // =========================================================================
  describe('4. Autonomous Sentinel Incident Alert, 3D Disruption Zone & Mitigation Directives', () => {
    it('Defines critical Kasara Ghat mudslide obstruction at physical 3D coordinates [14, 9.8, -24]', () => {
      assert.ok(CORRIDOR_INCIDENTS.length > 0, 'Must define active corridor incident list');
      const kasaraIncident = CORRIDOR_INCIDENTS.find((i) => i.id === 'INC-KASARA-01');

      assert.ok(kasaraIncident, 'Kasara Ghat disruption incident must exist');
      assert.strictEqual(kasaraIncident.roadblockId, 'RB-KASARA-01');
      assert.strictEqual(kasaraIncident.severity, 'CRITICAL');
      assert.deepStrictEqual(kasaraIncident.location, [14, 9.8, -24], 'Must match Kasara Ghat 3D elevation coordinates');
      assert.ok(kasaraIncident.affectedVehicles.includes('TRK-MH-01'));
    });

    it('Exposes all three autonomous AI mitigation options for corridor incident', () => {
      const kasaraIncident = CORRIDOR_INCIDENTS.find((i) => i.id === 'INC-KASARA-01');
      const options = kasaraIncident.mitigationOptions;
      assert.strictEqual(options.length, 3, 'Must define exactly 3 strategic mitigation responses');

      // Option 1: Autonomous Detour via NH-61 Malshej Ghat
      const opt1 = options.find((o) => o.actionType === 'DETOUR');
      assert.ok(opt1, 'Must include DETOUR mitigation option');
      assert.strictEqual(opt1.targetRoute, 'NH-61');
      assert.ok(opt1.description.includes('Malshej'));

      // Option 2: Hold Fleet at Bhiwandi Mega DC
      const opt2 = options.find((o) => o.actionType === 'HOLD_FLEET');
      assert.ok(opt2, 'Must include HOLD_FLEET mitigation option');
      assert.strictEqual(opt2.targetFacility, 'DC-BHW-01');

      // Option 3: Dispatch Emergency Reconnaissance Drone
      const opt3 = options.find((o) => o.actionType === 'DISPATCH_DRONE');
      assert.ok(opt3, 'Must include DISPATCH_DRONE mitigation option');
    });

    it('3D Roadblock Barricade mesh is tagged for raycasting detection and carries incident reference', () => {
      const roadblock = createRoadblockBarricade({ pos: [14, 9.8, -24], rotationY: 0.45 });
      assert.strictEqual(roadblock.userData.isRoadblock, true);
      assert.strictEqual(roadblock.userData.roadblockId, 'RB-KASARA-01');
      assert.strictEqual(roadblock.userData.incidentId, 'INC-KASARA-01');
      assert.strictEqual(roadblock.position.x, 14);
      assert.strictEqual(roadblock.position.y, 9.8);
      assert.strictEqual(roadblock.position.z, -24);
    });
  });

  // =========================================================================
  // 5. Viewport Raycasting & Cross-Filtering Across Panels
  // =========================================================================
  describe('5. Viewport Raycasting & Entity Cross-Filtering Across Panels', () => {
    it('Commercial truck sub-meshes are tagged recursively with vehicleId for raycast hit detection', () => {
      const truck = createProceduralTruck({ vehicleId: 'TRK-MH-01' });
      assert.strictEqual(truck.userData.isVehicle, true);
      assert.strictEqual(truck.userData.vehicleId, 'TRK-MH-01');
      // Critical invariant check: name must remain CommercialVehicle_Truck for Issue 02 suite
      assert.strictEqual(truck.name, 'CommercialVehicle_Truck');

      let meshCount = 0;
      truck.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          assert.strictEqual(child.userData.isVehicle, true, 'Sub-mesh must have isVehicle tag');
          assert.strictEqual(child.userData.vehicleId, 'TRK-MH-01', 'Sub-mesh must store vehicleId');
        }
      });
      assert.ok(meshCount >= 8, 'Truck must contain cab, trailer, wheels, lamps, and beacon meshes');
    });

    it('Resolves raycast entity hit on Commercial Truck to vehicle context update', () => {
      const truck = createProceduralTruck({ vehicleId: 'TRK-MH-02' });
      const firstMesh = truck.children.find((c) => c.isMesh);
      assert.ok(firstMesh, 'Must find mesh on truck');

      const resolved = resolveRaycastEntityHit(firstMesh);
      assert.deepStrictEqual(resolved, {
        type: 'vehicle',
        vehicleId: 'TRK-MH-02'
      });
    });

    it('Resolves raycast entity hit on Roadblock barricade to incident context update', () => {
      const roadblock = createRoadblockBarricade();
      const resolved = resolveRaycastEntityHit(roadblock);

      assert.strictEqual(resolved.type, 'incident');
      assert.strictEqual(resolved.incidentId, 'INC-KASARA-01');
      assert.strictEqual(resolved.roadblockId, 'RB-KASARA-01');
      assert.deepStrictEqual(resolved.location, [14, 9.8, -24]);
    });

    it('Resolves raycast entity hit on Facility structure to facility node context update', () => {
      const node = STAGE_FACILITIES.find((f) => f.id === 'DC-BHW-01');
      const model = createFacilityNodeModel(node);
      const firstChild = model.children[0];

      const resolved = resolveRaycastEntityHit(firstChild);
      assert.strictEqual(resolved.type, 'facility');
      assert.strictEqual(resolved.facilityId, 'DC-BHW-01');
      assert.strictEqual(resolved.code, 'BHIWANDI');
      assert.ok(resolved.name.includes('Bhiwandi'));
    });
  });

  // =========================================================================
  // 6. Computed ML Demand Heatmaps & Optimal Path Vector 3D Overlays
  // =========================================================================
  describe('6. ML Predictions & Route Optimizations 3D Visual Overlays', () => {
    it('Computes volumetric demand heatmap overlay with multi-echelon scaling distribution', () => {
      const baseDemand = 500;
      const heatmap = generateDemandHeatmapData(baseDemand, 'SKU-MUM-PHARM-01');

      assert.strictEqual(heatmap.active, true, 'Overlay must be activated');
      assert.strictEqual(heatmap.skuId, 'SKU-MUM-PHARM-01');
      assert.ok(heatmap.timestamp > 0);

      // Verify demand values scaled across all corridor nodes
      const d = heatmap.facilityDemands;
      assert.strictEqual(d['PORT-JNPT-01'], 500 * 11.2, 'JNPT Port demand scaling');
      assert.strictEqual(d['DC-BHW-01'], 500 * 9.8, 'Bhiwandi Central DC demand scaling');
      assert.strictEqual(d['HUB-THN-01'], 500 * 5.4, 'Thane Hub demand scaling');
      assert.strictEqual(d['PASS-KASARA-01'], 500 * 2.1, 'Kasara Pass demand scaling');
      assert.strictEqual(d['DEP-NSK-01'], 500 * 8.6, 'Nashik Depot demand scaling');
      assert.strictEqual(d['FC-PUN-01'], 500 * 7.9, 'Pune FC demand scaling');
    });

    it('Generates optimal corridor path vector overlay with 3D spline points and performance telemetry', () => {
      const overlay = generateOptimalRouteVector();

      assert.strictEqual(overlay.active, true, 'Optimal vector overlay must be active');
      assert.ok(overlay.pathCoordinates.length >= 5, 'Must contain waypoints connecting corridor hubs');
      assert.strictEqual(overlay.metrics.distanceKm, 142.8);
      assert.strictEqual(overlay.metrics.durationMin, 135);
      assert.strictEqual(overlay.metrics.savingsPct, 18.4);

      // Construct Catmull-Rom spline from coordinates
      const points = overlay.pathCoordinates.map((c) => new THREE.Vector3(c[0], c[1], c[2]));
      const spline = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);

      const startPt = spline.getPointAt(0);
      assert.strictEqual(startPt.x, -44, 'Vector must begin at JNPT Port [-44, 0.8, 32]');
      assert.strictEqual(startPt.z, 32);

      const endPt = spline.getPointAt(1.0);
      assert.strictEqual(Math.round(endPt.x), 42, 'Vector must conclude at Nashik Agro Depot [42, 6.8, -48]');
      assert.strictEqual(Math.round(endPt.z), -48);
    });

    it('Verifies dynamic 3D spline curve interpolation along optimal path vector', () => {
      const overlay = generateOptimalRouteVector();
      const points = overlay.pathCoordinates.map((c) => new THREE.Vector3(c[0], c[1], c[2]));
      const curve = new THREE.CatmullRomCurve3(points);

      // Midpoint around Kasara Ghat
      const midPoint = curve.getPointAt(0.55);
      assert.ok(typeof midPoint.x === 'number');
      assert.ok(typeof midPoint.y === 'number');
      assert.ok(typeof midPoint.z === 'number');
      // Kasara elevation should elevate midpoint y above sea level
      assert.ok(midPoint.y > 0.8, 'Optimal curve must elevate across Western Ghats ascent');
    });
  });
});
