import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE_ENGINES,
  ENGINE_METADATA,
  toggleStageEngine,
  getSecondaryPipEngine,
  mapFacilityBetweenEngines,
  calculateSynchronizedVehicleState,
  calculateSchematicVehiclePos,
  validateDualEngineStateInvariants,
  determineCesiumFallbackState
} from '../src/utils/engineSynchronization.js';
import { CORRIDOR_GPS_BOUNDS } from '../src/utils/coordinateTransforms.js';

describe('03: Dual-Engine Synchronization (Cesium Macro GIS ↔ R3F Tactical Twin & PiP)', () => {
  describe('1. Floating Viewport Engine Selector & Stage Toggle Mechanics', () => {
    test('Defines both Tactical 3D and Macro Cesium GIS operational engines', () => {
      assert.equal(STAGE_ENGINES.TACTICAL_3D, 'tactical_3d');
      assert.equal(STAGE_ENGINES.CESIUM_GIS, 'cesium_gis');
      assert.equal(Object.keys(STAGE_ENGINES).length, 2);
    });

    test('Engine metadata configures labels, badges, theme colors, and hotkeys for cyber command center', () => {
      const tactical = ENGINE_METADATA[STAGE_ENGINES.TACTICAL_3D];
      assert.ok(tactical, 'Tactical engine metadata must exist');
      assert.equal(tactical.name, 'Tactical R3F Twin');
      assert.equal(tactical.badge, '3D TACTICAL');
      assert.equal(tactical.hotkey, 'T');
      assert.ok(tactical.themeColor.startsWith('#'));

      const cesium = ENGINE_METADATA[STAGE_ENGINES.CESIUM_GIS];
      assert.ok(cesium, 'Cesium GIS engine metadata must exist');
      assert.equal(cesium.name, 'Macro Cesium GIS');
      assert.equal(cesium.badge, 'WGS84 GLOBE');
      assert.equal(cesium.hotkey, 'M');
      assert.ok(cesium.themeColor.startsWith('#'));
    });

    test('toggleStageEngine cleanly alternates between Tactical 3D and Macro Cesium GIS', () => {
      assert.equal(toggleStageEngine(STAGE_ENGINES.TACTICAL_3D), STAGE_ENGINES.CESIUM_GIS);
      assert.equal(toggleStageEngine(STAGE_ENGINES.CESIUM_GIS), STAGE_ENGINES.TACTICAL_3D);
    });

    test('getSecondaryPipEngine always returns the complementary engine for Picture-in-Picture', () => {
      assert.equal(getSecondaryPipEngine(STAGE_ENGINES.TACTICAL_3D), STAGE_ENGINES.CESIUM_GIS);
      assert.equal(getSecondaryPipEngine(STAGE_ENGINES.CESIUM_GIS), STAGE_ENGINES.TACTICAL_3D);
    });
  });

  describe('2. Dual-Engine State Preservation Invariants Across Transitions', () => {
    test('Guarantees simulation playback time, vehicle selection, and camera target remain invariant across engine switch', () => {
      const stateBefore = {
        simSpeed: 2,
        isPaused: false,
        truckProgress: 0.42,
        vehicleId: 'TRK-MH-01',
        selectedFacilityId: 'DC-BHW-01',
        primaryEngine: STAGE_ENGINES.TACTICAL_3D,
        secondaryEngine: STAGE_ENGINES.CESIUM_GIS
      };

      const stateAfter = {
        simSpeed: 2,
        isPaused: false,
        truckProgress: 0.42,
        vehicleId: 'TRK-MH-01',
        selectedFacilityId: 'DC-BHW-01',
        primaryEngine: STAGE_ENGINES.CESIUM_GIS,
        secondaryEngine: STAGE_ENGINES.TACTICAL_3D
      };

      const validation = validateDualEngineStateInvariants(stateBefore, stateAfter);
      assert.ok(validation.valid, `Expected valid state preservation, got errors: ${validation.errors.join(', ')}`);
      assert.equal(validation.errors.length, 0);
    });

    test('Detects invariant violation if simulation playback speed or pause state mutates during switch', () => {
      const stateBefore = {
        simSpeed: 1,
        isPaused: false,
        truckProgress: 0.25,
        vehicleId: 'TRK-MH-01',
        selectedFacilityId: 'DC-BHW-01',
        primaryEngine: STAGE_ENGINES.TACTICAL_3D,
        secondaryEngine: STAGE_ENGINES.CESIUM_GIS
      };

      const stateAfter = {
        simSpeed: 4, // Mutated!
        isPaused: true, // Mutated!
        truckProgress: 0.25,
        vehicleId: 'TRK-MH-01',
        selectedFacilityId: 'DC-BHW-01',
        primaryEngine: STAGE_ENGINES.CESIUM_GIS,
        secondaryEngine: STAGE_ENGINES.TACTICAL_3D
      };

      const validation = validateDualEngineStateInvariants(stateBefore, stateAfter);
      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.includes('Simulation speed changed')));
      assert.ok(validation.errors.some((e) => e.includes('Simulation pause state mutated')));
    });

    test('Detects invariant violation if primary and secondary PiP engines collide', () => {
      const stateBefore = {
        simSpeed: 1,
        isPaused: false,
        truckProgress: 0.1,
        vehicleId: 'TRK-MH-01',
        selectedFacilityId: 'PORT-JNPT-01',
        primaryEngine: STAGE_ENGINES.TACTICAL_3D,
        secondaryEngine: STAGE_ENGINES.CESIUM_GIS
      };

      const stateAfter = {
        ...stateBefore,
        primaryEngine: STAGE_ENGINES.TACTICAL_3D,
        secondaryEngine: STAGE_ENGINES.TACTICAL_3D // Collision!
      };

      const validation = validateDualEngineStateInvariants(stateBefore, stateAfter);
      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.includes('cannot be identical')));
    });
  });

  describe('3. Synchronized Vehicle Coordinates (Three.js 3D ↔ WGS84 GPS ↔ 2.5D Schematic)', () => {
    test('Transforms moving vehicle 3D stage position to calibrated WGS84 GPS coordinate', () => {
      // Vehicle at JNPT Port origin
      const vehicleAtJnpt = calculateSynchronizedVehicleState({
        progress: 0.0,
        worldPos: [-44, 0, 32],
        headingVec: [0.8, 0, -0.6],
        speedKmh: 45
      });

      assert.equal(vehicleAtJnpt.id, 'TRK-MH-01');
      assert.equal(vehicleAtJnpt.speedKmh, 45);
      assert.ok(
        vehicleAtJnpt.latitude >= CORRIDOR_GPS_BOUNDS.minLat && vehicleAtJnpt.latitude <= CORRIDOR_GPS_BOUNDS.maxLat,
        `Vehicle latitude ${vehicleAtJnpt.latitude} must be within corridor GPS bounds`
      );
      assert.ok(
        vehicleAtJnpt.longitude >= CORRIDOR_GPS_BOUNDS.minLon && vehicleAtJnpt.longitude <= CORRIDOR_GPS_BOUNDS.maxLon,
        `Vehicle longitude ${vehicleAtJnpt.longitude} must be within corridor GPS bounds`
      );
      assert.equal(typeof vehicleAtJnpt.headingDeg, 'number');
      assert.ok(vehicleAtJnpt.headingDeg >= 0 && vehicleAtJnpt.headingDeg <= 360);
    });

    test('Kasara Ghat mountain ascent reflects high physical altitude (+580m) in synchronized telematics', () => {
      // Vehicle climbing Kasara Ghat summit (y = 9.5)
      const vehicleAtKasara = calculateSynchronizedVehicleState({
        progress: 0.65,
        worldPos: [14, 9.5, -24],
        headingVec: [0.7, 0.4, -0.6],
        speedKmh: 38
      });

      assert.ok(vehicleAtKasara.altitudeM >= 550, `Kasara ascent altitude should be ~580m, got ${vehicleAtKasara.altitudeM}m`);
      assert.ok(vehicleAtKasara.corridorLeg.includes('Kasara Ghat'), `Corridor leg should identify Kasara Ghat: ${vehicleAtKasara.corridorLeg}`);
    });

    test('calculateSchematicVehiclePos maps progress along continuous SVG corridor path', () => {
      // Origin at JNPT (p = 0)
      const pos0 = calculateSchematicVehiclePos(0);
      assert.equal(pos0.x, 120);
      assert.equal(pos0.y, 530);

      // Midpoint near Bhiwandi (p ~ 0.45)
      const posMid = calculateSchematicVehiclePos(0.45);
      assert.equal(posMid.x, 420);
      assert.equal(posMid.y, 390);

      // Summit at Kasara (p ~ 0.75)
      const posKasara = calculateSchematicVehiclePos(0.75);
      assert.equal(posKasara.x, 620);
      assert.equal(posKasara.y, 260);

      // Terminus at Nashik (p = 1.0)
      const pos1 = calculateSchematicVehiclePos(1.0);
      assert.equal(pos1.x, 840);
      assert.equal(pos1.y, 150);
    });
  });

  describe('4. Bidirectional Facility Marker & Camera Gliding Synchronization', () => {
    test('Maps all 5 key corridor facilities accurately between Tactical 3D and Cesium GIS', () => {
      const testCases = [
        { input: 'PORT-JNPT-01', expectedCity: 'JNPT' },
        { input: 'HUB-THN-01', expectedCity: 'Thane' },
        { input: 'DC-BHW-01', expectedCity: 'Bhiwandi' },
        { input: 'KASARA', expectedCity: 'Kasara' },
        { input: 'DEP-NSK-01', expectedCity: 'Nashik' }
      ];

      for (const tc of testCases) {
        const mapped = mapFacilityBetweenEngines(tc.input);
        assert.ok(mapped.stageNode, `Must find stage node for ${tc.input}`);
        assert.ok(mapped.cesiumNode, `Must find cesium node for ${tc.input}`);
        assert.ok(mapped.presetKey, `Must have camera preset key for ${tc.input}`);
      }
    });

    test('Supports Pune Fulfillment Center branch node mapping', () => {
      const mapped = mapFacilityBetweenEngines('FC-PUN-01');
      assert.ok(mapped.stageNode);
      assert.ok(mapped.cesiumNode);
      assert.equal(mapped.stageNode.code, 'PUNE');
      assert.equal(mapped.cesiumNode.node_id, 'FC-PUN-01');
    });

    test('Gracefully handles invalid or unknown facility identifiers with safe default', () => {
      const fallback = mapFacilityBetweenEngines('UNKNOWN-XYZ');
      assert.equal(fallback.normalizedId, 'UNKNOWN-XYZ');
      assert.equal(fallback.presetKey, 'CORRIDOR_OVERVIEW');
    });
  });

  describe('5. Cesium Fallback & Resilient Offline Schematic Validation', () => {
    test('Activates schematic fallback when operator explicitly requests 2.5D schematic mode', () => {
      const state = determineCesiumFallbackState({
        userPrefersSchematic: true,
        ionToken: 'valid-test-token',
        webglSupported: true
      });

      assert.equal(state.useSchematic, true);
      assert.equal(state.reason, 'OPERATOR_SELECTED');
    });

    test('Activates schematic fallback when WebGL context fails or encounters limits', () => {
      const state = determineCesiumFallbackState({
        userPrefersSchematic: false,
        ionToken: 'valid-test-token',
        webglSupported: false,
        webglError: 'CONTEXT_LOST_WEBGL'
      });

      assert.equal(state.useSchematic, true);
      assert.ok(state.reason.includes('WEBGL_UNAVAILABLE'));
    });

    test('Allows base view when Ion token is missing but WebGL is operational', () => {
      const state = determineCesiumFallbackState({
        userPrefersSchematic: false,
        ionToken: '',
        webglSupported: true,
        webglError: null
      });

      assert.equal(state.useSchematic, false);
      assert.equal(state.reason, 'ION_TOKEN_MISSING');
    });

    test('Operates in photorealistic mode when token and WebGL are fully available', () => {
      const state = determineCesiumFallbackState({
        userPrefersSchematic: false,
        ionToken: 'valid-ion-jwt-token',
        webglSupported: true,
        webglError: null
      });

      assert.equal(state.useSchematic, false);
      assert.equal(state.reason, 'NOMINAL_PHOTOREALISTIC');
    });
  });
});
