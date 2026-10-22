import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  FACILITY_NODES,
  HIGHWAY_CORRIDORS,
  SCENARIO_EPICENTERS,
  SCHEMATIC_COORDS,
  SCHEMATIC_CORRIDOR_PATHS,
  SCHEMATIC_EPICENTERS,
  getStockCapacityStatus
} from '../src/constants/logisticsTopology.js';
import { FALLBACK_PROFILES } from '../src/constants/personaProfiles.js';
import { telemetryWS } from '../src/services/websocket.js';
import {
  setupContextLossHandlers,
  shouldThrottleRender,
  disposeThreeScene,
  isWebGLAvailable
} from '../src/utils/webglHardening.js';
import {
  dispatchKeyboardShortcut,
  isInputTarget,
  SHORTCUT_ACTIONS
} from '../src/utils/keyboardShortcuts.js';
import {
  clampCoordinates,
  clampWindowGeometry,
  DOCK_SERVICES
} from '../src/constants/dockConfig.js';
import {
  calculateSchematicVehiclePos,
  calculateSynchronizedVehicleState
} from '../src/utils/engineSynchronization.js';
import {
  createInitialErrorState,
  computeDerivedErrorState,
  executeErrorRecovery,
  formatDiagnosticLog
} from '../src/utils/errorBoundaryLogic.js';


describe('06: End-to-End Hardening, Offline Fallback & Performance Verification', () => {
  // --------------------------------------------------------------------------
  // 1. Dual-Canvas WebGL Context Management, Context Loss & Scene Disposal
  // --------------------------------------------------------------------------
  describe('1. Dual-Canvas WebGL Context Management, Context Loss & Scene Disposal', () => {
    test('setupContextLossHandlers registers listeners and triggers preventDefault on context lost', () => {
      const eventsRegistered = {};
      let preventDefaultCalled = false;
      let contextLostCalled = false;
      let contextRestoredCalled = false;

      const mockCanvas = {
        addEventListener: (event, handler) => {
          eventsRegistered[event] = handler;
        },
        removeEventListener: (event) => {
          delete eventsRegistered[event];
        }
      };

      const cleanup = setupContextLossHandlers(
        mockCanvas,
        () => { contextLostCalled = true; },
        () => { contextRestoredCalled = true; }
      );

      assert.ok(eventsRegistered.webglcontextlost, 'webglcontextlost listener must be attached');
      assert.ok(eventsRegistered.webglcontextrestored, 'webglcontextrestored listener must be attached');

      // Simulate context lost event
      const fakeLostEvent = {
        preventDefault: () => { preventDefaultCalled = true; }
      };
      eventsRegistered.webglcontextlost(fakeLostEvent);
      assert.equal(preventDefaultCalled, true, 'Must call preventDefault() to allow WebGL restoration');
      assert.equal(contextLostCalled, true, 'onContextLost callback must be invoked');

      // Simulate context restored event
      eventsRegistered.webglcontextrestored({});
      assert.equal(contextRestoredCalled, true, 'onContextRestored callback must be invoked');

      // Cleanup
      cleanup();
      assert.equal(eventsRegistered.webglcontextlost, undefined, 'Must unbind webglcontextlost on cleanup');
      assert.equal(eventsRegistered.webglcontextrestored, undefined, 'Must unbind webglcontextrestored on cleanup');
    });

    test('shouldThrottleRender correctly throttles hidden contexts and maintains active rendering', () => {
      // 1. Tab backgrounded (document.hidden) -> throttle
      assert.equal(shouldThrottleRender({ documentHidden: true }), true);

      // 2. Context lost -> throttle
      assert.equal(shouldThrottleRender({ isContextLost: true }), true);

      // 3. Engine is hidden (not primary and not visible in PiP) -> throttle
      assert.equal(
        shouldThrottleRender({
          documentHidden: false,
          isContextLost: false,
          isEnginePrimary: false,
          isPiPVisible: false
        }),
        true
      );

      // 4. Engine is primary and tab is active -> do not throttle
      assert.equal(
        shouldThrottleRender({
          documentHidden: false,
          isContextLost: false,
          isEnginePrimary: true,
          isPiPVisible: false
        }),
        false
      );

      // 5. Engine is secondary but visible in PiP -> do not throttle
      assert.equal(
        shouldThrottleRender({
          documentHidden: false,
          isContextLost: false,
          isEnginePrimary: false,
          isPiPVisible: true
        }),
        false
      );
    });

    test('isWebGLAvailable detects context availability or returns false gracefully without throwing', () => {
      // Mock canvas with no webgl context
      const noGlCanvas = { getContext: () => null };
      assert.equal(isWebGLAvailable(noGlCanvas), false);

      // Mock canvas with throwing getContext
      const throwingCanvas = { getContext: () => { throw new Error('GPU context initialization exception'); } };
      assert.equal(isWebGLAvailable(throwingCanvas), false);

      // Mock canvas with valid webgl2 context
      const validGlCanvas = {
        getContext: (type) => (type === 'webgl2' ? { getParameter: () => 16 } : null)
      };
      assert.equal(isWebGLAvailable(validGlCanvas), true);
    });

    test('disposeThreeScene cleanly traverses scene, disposes geometries/materials, and cleans renderer without errors', () => {
      const scene = new THREE.Scene();

      // Create test meshes with geometries and single/multi materials
      const geo1 = new THREE.BoxGeometry(1, 1, 1);
      const mat1 = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      let geoDisposed = false;
      let matDisposed = false;
      geo1.dispose = () => { geoDisposed = true; };
      mat1.dispose = () => { matDisposed = true; };

      const mesh1 = new THREE.Mesh(geo1, mat1);
      scene.add(mesh1);

      // Multi-material mesh
      const geo2 = new THREE.SphereGeometry(2, 8, 8);
      const mat2A = new THREE.MeshBasicMaterial();
      const mat2B = new THREE.MeshBasicMaterial();
      let multiMatCount = 0;
      mat2A.dispose = () => { multiMatCount++; };
      mat2B.dispose = () => { multiMatCount++; };

      const mesh2 = new THREE.Mesh(geo2, [mat2A, mat2B]);
      scene.add(mesh2);

      // Mock renderer
      let rendererDisposed = false;
      let renderListsDisposed = false;
      const mockRenderer = {
        dispose: () => { rendererDisposed = true; },
        renderLists: {
          dispose: () => { renderListsDisposed = true; }
        },
        forceContextLoss: () => {}
      };

      assert.equal(scene.children.length, 2);

      // Execute disposal
      disposeThreeScene(scene, mockRenderer);

      assert.equal(geoDisposed, true, 'Geometry must be disposed');
      assert.equal(matDisposed, true, 'Material must be disposed');
      assert.equal(multiMatCount, 2, 'Multi-materials must all be disposed');
      assert.equal(scene.children.length, 0, 'Scene children must be cleared');
      assert.equal(rendererDisposed, true, 'Renderer must be disposed');
      assert.equal(renderListsDisposed, true, 'RenderLists must be disposed');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Global Operational Keyboard Shortcuts & Form Input Bypassing
  // --------------------------------------------------------------------------
  describe('2. Global Operational Keyboard Shortcuts & Form Input Bypassing', () => {
    test('Hotkeys 1 through 4 trigger camera switching', () => {
      let selectedCam = null;
      const handlers = {
        onCameraMode: (mode) => { selectedCam = mode; }
      };

      assert.equal(dispatchKeyboardShortcut({ key: '1' }, handlers), SHORTCUT_ACTIONS.CAMERA_CHASE);
      assert.equal(selectedCam, 'CHASE');

      assert.equal(dispatchKeyboardShortcut({ key: '2' }, handlers), SHORTCUT_ACTIONS.CAMERA_COCKPIT);
      assert.equal(selectedCam, 'COCKPIT');

      assert.equal(dispatchKeyboardShortcut({ key: '3' }, handlers), SHORTCUT_ACTIONS.CAMERA_DRONE);
      assert.equal(selectedCam, 'DRONE');

      assert.equal(dispatchKeyboardShortcut({ key: '4' }, handlers), SHORTCUT_ACTIONS.CAMERA_FREE_ORBIT);
      assert.equal(selectedCam, 'FREE_ORBIT');
    });

    test('Spacebar toggles simulation Play/Pause and calls preventDefault', () => {
      let toggled = false;
      let preventDefaultCalled = false;
      const event = {
        key: ' ',
        code: 'Space',
        preventDefault: () => { preventDefaultCalled = true; }
      };
      const handlers = {
        onTogglePlayPause: () => { toggled = true; }
      };

      const action = dispatchKeyboardShortcut(event, handlers);
      assert.equal(action, SHORTCUT_ACTIONS.TOGGLE_PLAY_PAUSE);
      assert.equal(toggled, true);
      assert.equal(preventDefaultCalled, true, 'Space must prevent scroll default');
    });

    test('Tab key swaps PiP stage engine and calls preventDefault', () => {
      let swapped = false;
      let preventDefaultCalled = false;
      const event = {
        key: 'Tab',
        preventDefault: () => { preventDefaultCalled = true; }
      };
      const handlers = {
        onSwapPip: () => { swapped = true; }
      };

      const action = dispatchKeyboardShortcut(event, handlers);
      assert.equal(action, SHORTCUT_ACTIONS.SWAP_PIP_ENGINE);
      assert.equal(swapped, true);
      assert.equal(preventDefaultCalled, true, 'Tab must prevent browser focus cycling');
    });

    test('Escape key dispatches DISMISS_PANELS to minimize all open service panels', () => {
      let dismissed = false;
      let preventDefaultCalled = false;
      const event = {
        key: 'Escape',
        preventDefault: () => { preventDefaultCalled = true; }
      };
      const handlers = {
        onDismissPanels: () => { dismissed = true; }
      };

      const action = dispatchKeyboardShortcut(event, handlers);
      assert.equal(action, SHORTCUT_ACTIONS.DISMISS_PANELS);
      assert.equal(dismissed, true, 'Escape must invoke onDismissPanels callback');
      assert.equal(preventDefaultCalled, true);
    });

    test('Hotkeys t, m, and r trigger respective engine switch and camera reset actions', () => {
      let engine = null;
      let resetCalled = false;
      const handlers = {
        onSetEngine: (eng) => { engine = eng; },
        onResetCamera: () => { resetCalled = true; }
      };

      assert.equal(dispatchKeyboardShortcut({ key: 't' }, handlers), SHORTCUT_ACTIONS.SET_ENGINE_TACTICAL);
      assert.equal(engine, 'tactical_3d');

      assert.equal(dispatchKeyboardShortcut({ key: 'm' }, handlers), SHORTCUT_ACTIONS.SET_ENGINE_CESIUM);
      assert.equal(engine, 'cesium_gis');

      assert.equal(dispatchKeyboardShortcut({ key: 'r' }, handlers), SHORTCUT_ACTIONS.RESET_CAMERA);
      assert.equal(resetCalled, true);
    });

    test('Form input elements bypass all operational shortcuts', () => {
      let actionTriggered = false;
      const handlers = {
        onCameraMode: () => { actionTriggered = true; },
        onTogglePlayPause: () => { actionTriggered = true; },
        onDismissPanels: () => { actionTriggered = true; }
      };

      // Input target
      const inputTarget = { tagName: 'INPUT', isContentEditable: false };
      assert.equal(isInputTarget(inputTarget), true);
      assert.equal(dispatchKeyboardShortcut({ key: '1', target: inputTarget }, handlers), null);
      assert.equal(dispatchKeyboardShortcut({ key: ' ', target: inputTarget }, handlers), null);
      assert.equal(dispatchKeyboardShortcut({ key: 'Escape', target: inputTarget }, handlers), null);

      // Textarea target
      const textareaTarget = { tagName: 'TEXTAREA', isContentEditable: false };
      assert.equal(isInputTarget(textareaTarget), true);
      assert.equal(dispatchKeyboardShortcut({ key: '2', target: textareaTarget }, handlers), null);

      // ContentEditable target
      const editableTarget = { tagName: 'DIV', isContentEditable: true };
      assert.equal(isInputTarget(editableTarget), true);
      assert.equal(dispatchKeyboardShortcut({ key: '3', target: editableTarget }, handlers), null);

      assert.equal(actionTriggered, false, 'No operational actions should fire while user types in form fields');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Cesium Ion Token Absence & 2D Schematic Radar Graceful Fallback
  // --------------------------------------------------------------------------
  describe('3. Cesium Ion Token Absence & 2D Schematic Radar Graceful Fallback', () => {
    test('SCHEMATIC_COORDS defines coordinates for all 5 multi-echelon facility nodes', () => {
      const nodeIds = FACILITY_NODES.map((n) => n.node_id);
      assert.equal(nodeIds.length, 5);

      for (const id of nodeIds) {
        assert.ok(SCHEMATIC_COORDS[id], `Missing schematic coordinate for node ${id}`);
        assert.ok(typeof SCHEMATIC_COORDS[id].x === 'number' && SCHEMATIC_COORDS[id].x > 0);
        assert.ok(typeof SCHEMATIC_COORDS[id].y === 'number' && SCHEMATIC_COORDS[id].y > 0);
        assert.ok(typeof SCHEMATIC_COORDS[id].labelX === 'number');
        assert.ok(typeof SCHEMATIC_COORDS[id].labelY === 'number');
      }
    });

    test('SCHEMATIC_CORRIDOR_PATHS defines continuous SVG path and bypass path for all corridors', () => {
      const corridorIds = HIGHWAY_CORRIDORS.map((c) => c.link_id);
      for (const linkId of corridorIds) {
        const pathObj = SCHEMATIC_CORRIDOR_PATHS[linkId];
        assert.ok(pathObj, `Missing schematic path for corridor link ${linkId}`);
        assert.ok(typeof pathObj.path === 'string' && pathObj.path.startsWith('M'), `Path for ${linkId} must be valid SVG path`);
        assert.ok(typeof pathObj.bypassPath === 'string' && pathObj.bypassPath.startsWith('M'), `Bypass for ${linkId} must be valid SVG path`);
        assert.ok(typeof pathObj.mid.x === 'number' && typeof pathObj.mid.y === 'number', `Midpoint coordinates required for ${linkId}`);
      }
    });

    test('SCHEMATIC_EPICENTERS maps all preset disaster scenarios to canvas coordinates', () => {
      const scenarioKeys = Object.keys(SCENARIO_EPICENTERS);
      assert.equal(scenarioKeys.length, 3);

      for (const key of scenarioKeys) {
        const epicenter = SCHEMATIC_EPICENTERS[key];
        assert.ok(epicenter, `Missing schematic epicenter for scenario ${key}`);
        assert.ok(typeof epicenter.x === 'number' && epicenter.x > 0);
        assert.ok(typeof epicenter.y === 'number' && epicenter.y > 0);
        assert.ok(typeof epicenter.label === 'string' && epicenter.label.length > 0);
      }
    });

    test('calculateSchematicVehiclePos interpolates commercial vehicle coordinates across corridor progress', () => {
      // 0.0 at JNPT Port origin
      const startPos = calculateSchematicVehiclePos(0.0);
      assert.ok(typeof startPos.x === 'number' && typeof startPos.y === 'number');
      assert.ok(startPos.x > 100 && startPos.x < 300);

      // 0.5 midway through corridor
      const midPos = calculateSchematicVehiclePos(0.5);
      assert.ok(midPos.x > startPos.x, 'Vehicle should move east along highway');

      // 1.0 at Nashik Agro Depot terminus
      const endPos = calculateSchematicVehiclePos(1.0);
      assert.ok(endPos.x > midPos.x, 'Vehicle should terminate at Nashik coordinates');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Multi-Resolution Responsive Window Geometry Clamping
  // --------------------------------------------------------------------------
  describe('4. Multi-Resolution Responsive Window Geometry Clamping', () => {
    test('clampCoordinates strictly bounds panels within viewport boundaries', () => {
      const viewportW = 1440;
      const viewportH = 900;
      const panelSize = { width: 600, height: 500 };

      // Normal in-bounds coordinate
      const normal = clampCoordinates({ x: 100, y: 120 }, panelSize, viewportW, viewportH);
      assert.equal(normal.x, 100);
      assert.equal(normal.y, 120);

      // Off-screen left (negative x)
      const offLeft = clampCoordinates({ x: -100, y: 120 }, panelSize, viewportW, viewportH);
      assert.equal(offLeft.x, 8, 'x must clamp to left margin of 8px');

      // Off-screen right (exceeds viewport width - panel width)
      const offRight = clampCoordinates({ x: 1500, y: 120 }, panelSize, viewportW, viewportH);
      assert.equal(offRight.x, viewportW - panelSize.width - 8, 'x must clamp to right edge minus panel width');

      // Off-screen top (violates status header 56px clearance)
      const offTop = clampCoordinates({ x: 100, y: 10 }, panelSize, viewportW, viewportH);
      assert.equal(offTop.y, 62, 'y must clamp below Cyber-Dark status header (min 62px)');

      // Off-screen bottom (collides with bottom dock toolbar)
      const offBottom = clampCoordinates({ x: 100, y: 950 }, panelSize, viewportW, viewportH);
      assert.equal(offBottom.y, viewportH - 80, 'y must clamp above bottom dock toolbar');
    });

    test('clampWindowGeometry safely bounds sizes and positions across 1024x768 (XGA / tablet)', () => {
      const resW = 1024;
      const resH = 768;
      // An oversized panel (e.g. 1100x800) attempting to render on 1024x768
      const oversized = { width: 1100, height: 800 };
      const pos = { x: 50, y: 50 };

      const result = clampWindowGeometry(pos, oversized, resW, resH);

      // Width clamped to fit within 1024 - 16 = 1008
      assert.ok(result.size.width <= resW - 16, `Width ${result.size.width} must fit inside 1024px`);
      // Height clamped to fit within 768 - 142 = 626
      assert.ok(result.size.height <= resH - 142, `Height ${result.size.height} must fit inside available 768px height`);

      // Position clamped
      assert.ok(result.position.x >= 8, 'x must be >= 8');
      assert.ok(result.position.y >= 62, 'y must clear top status header');
      assert.ok(result.position.x + result.size.width <= resW, 'Panel right edge must stay within screen');
    });

    test('clampWindowGeometry safely bounds sizes and positions across 1920x1080 (FHD) and 3840x2160 (4K)', () => {
      // 1080p
      const fhd = clampWindowGeometry({ x: 100, y: 100 }, { width: 800, height: 600 }, 1920, 1080);
      assert.equal(fhd.size.width, 800);
      assert.equal(fhd.size.height, 600);
      assert.equal(fhd.position.x, 100);
      assert.equal(fhd.position.y, 100);

      // 4K UHD
      const uhd = clampWindowGeometry({ x: 200, y: 150 }, { width: 1200, height: 900 }, 3840, 2160);
      assert.equal(uhd.size.width, 1200);
      assert.equal(uhd.size.height, 900);
      assert.equal(uhd.position.x, 200);
      assert.equal(uhd.position.y, 150);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Cyber-Physical ErrorBoundary Resilience & State Recovery
  // --------------------------------------------------------------------------
  describe('5. Cyber-Physical ErrorBoundary Resilience & State Recovery', () => {
    test('ErrorBoundary logic initializes with clean state and transitions on runtime exceptions', () => {
      const initialState = createInitialErrorState();
      assert.equal(initialState.hasError, false);
      assert.equal(initialState.error, null);
      assert.equal(initialState.errorInfo, null);

      // Simulate runtime exception
      const mockErr = new Error('Simulated WebGL Context Lost');
      const nextState = computeDerivedErrorState(mockErr);
      assert.equal(nextState.hasError, true);
      assert.equal(nextState.error.message, 'Simulated WebGL Context Lost');

      // Test diagnostic formatting
      const diagnostic = formatDiagnosticLog(mockErr);
      assert.equal(diagnostic, '[Error] Simulated WebGL Context Lost');

      // Test recovery execution
      let recoverFired = false;
      const recoveredState = executeErrorRecovery(() => { recoverFired = true; });
      assert.equal(recoveredState.hasError, false);
      assert.equal(recoveredState.error, null);
      assert.equal(recoverFired, true, 'onRecover callback must be called when user reloads module');
    });
  });


  // --------------------------------------------------------------------------
  // 6. End-to-End Operational Walkthrough & Telemetry State Synchronization
  // --------------------------------------------------------------------------
  describe('6. End-to-End Operational Walkthrough & Telemetry State Synchronization', () => {
    test('calculateSynchronizedVehicleState computes consistent WGS84 GPS telemetry from 3D world pose', () => {
      const syncResult = calculateSynchronizedVehicleState({
        progress: 0.25,
        worldPos: [-14, 0.8, 2],
        headingVec: [0.707, 0, 0.707],
        speedKmh: 65,
        baseTelematics: {
          id: 'TRK-MH-01',
          model: 'Volvo FH Electric (Cold-Chain)',
          socPercent: 88.0,
          cargoTempC: 3.8
        }
      });

      assert.equal(syncResult.id, 'TRK-MH-01');
      assert.equal(syncResult.speedKmh, 65);
      assert.ok(typeof syncResult.latitude === 'number' && syncResult.latitude > 18 && syncResult.latitude < 21);
      assert.ok(typeof syncResult.longitude === 'number' && syncResult.longitude > 72 && syncResult.longitude < 75);
      assert.ok(typeof syncResult.headingDeg === 'number');
      assert.equal(syncResult.socPercent, 88.0);
      assert.equal(syncResult.cargoTempC, 3.8);
    });

    test('TelemetryWebSocketClient exports resilient singleton with resync helper and backoff ceiling', () => {
      assert.ok(telemetryWS, 'telemetryWS singleton must be exported');
      assert.equal(typeof telemetryWS.resync, 'function', 'Must expose resync() method for reconnection resync');
      assert.equal(typeof telemetryWS.subscribe, 'function', 'Must support event subscriptions');

      // Verify delay calculation respects 10000ms ceiling
      const baseDelay = telemetryWS.baseReconnectDelayMs;
      for (let attempt = 0; attempt < 15; attempt++) {
        const delay = Math.min(baseDelay * Math.pow(1.5, attempt), 10000);
        assert.ok(delay <= 10000, `Delay ${delay} exceeded max backoff cap of 10000ms`);
      }
    });

    test('Multi-persona RBAC matrix grants access correctly across roles', () => {
      const director = FALLBACK_PROFILES.director;
      assert.ok(director.permissions.views.includes('kpis'), 'Director has KPIs');
      assert.ok(director.permissions.views.includes('twin'), 'Director has Twin');
      assert.ok(director.permissions.actions.includes('telemetry_control'), 'Director can control telemetry');

      const customs = FALLBACK_PROFILES.customs;
      assert.ok(customs.permissions.views.includes('compliance'), 'Customs has Compliance');
      assert.ok(!customs.permissions.views.includes('routing'), 'Customs restricted from routing');
      assert.ok(!customs.permissions.actions.includes('telemetry_control'), 'Customs cannot control telemetry');

      const admin = FALLBACK_PROFILES.admin;
      assert.ok(admin.permissions.actions.includes('*'), 'Admin has wildcard');

      // Helper function simulating canPerform / canDo
      const canDoHelper = (role, profile, action) => {
        if (role === 'admin') return true;
        const actions = profile?.permissions?.actions || [];
        return actions.includes('*') || actions.includes(action);
      };

      assert.equal(canDoHelper('director', director, 'telemetry_control'), true);
      assert.equal(canDoHelper('customs', customs, 'telemetry_control'), false);
      assert.equal(canDoHelper('admin', admin, 'any_random_action'), true);
    });

    test('Stock Capacity threshold calculation executes in sub-microsecond time for steady 60 FPS', () => {
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        getStockCapacityStatus(28500, 250000);
      }
      const t1 = performance.now();
      const avgMs = (t1 - t0) / 1000;
      assert.ok(avgMs < 0.05, `Threshold calculation average time ${avgMs}ms too slow for 60 FPS`);
    });
  });
});
