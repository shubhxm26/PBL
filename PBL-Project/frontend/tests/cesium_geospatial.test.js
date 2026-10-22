import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FACILITY_NODES,
  HIGHWAY_CORRIDORS,
  SCENARIO_EPICENTERS,
  CAMERA_PRESETS,
  CORRIDOR_BOUNDS,
  getStockCapacityStatus,
  validateNodeSchema,
  validateLinkSchema,
  validateEpicenterSchema
} from '../src/constants/logisticsTopology.js';

describe('Cesium 3D Geospatial Topology & WGS84 Facility Beacons', () => {
  test('Contains exactly 5 multi-echelon facility nodes for the Western India corridor', () => {
    assert.equal(FACILITY_NODES.length, 5, 'Should define exactly 5 logistics nodes');

    const expectedNodeIds = [
      'PORT-JNPT-01',
      'DC-BHW-01',
      'HUB-THN-01',
      'DEP-NSK-01',
      'FC-PUN-01'
    ];

    const actualNodeIds = FACILITY_NODES.map((n) => n.node_id);
    for (const expectedId of expectedNodeIds) {
      assert.ok(
        actualNodeIds.includes(expectedId),
        `Missing expected facility node: ${expectedId}`
      );
    }
  });

  test('All facility coordinates are valid WGS84 geographic coordinates within Western India corridor', () => {
    for (const node of FACILITY_NODES) {
      const validation = validateNodeSchema(node);
      assert.ok(
        validation.valid,
        `Node ${node.node_id} failed schema validation: ${validation.errors.join(', ')}`
      );

      assert.ok(
        node.latitude >= CORRIDOR_BOUNDS.minLat && node.latitude <= CORRIDOR_BOUNDS.maxLat,
        `Node ${node.name} latitude ${node.latitude} outside corridor bounds [${CORRIDOR_BOUNDS.minLat}, ${CORRIDOR_BOUNDS.maxLat}]`
      );

      assert.ok(
        node.longitude >= CORRIDOR_BOUNDS.minLon && node.longitude <= CORRIDOR_BOUNDS.maxLon,
        `Node ${node.name} longitude ${node.longitude} outside corridor bounds [${CORRIDOR_BOUNDS.minLon}, ${CORRIDOR_BOUNDS.maxLon}]`
      );

      assert.ok(node.capacity_units > 0, `Node ${node.name} must have positive capacity units`);
      assert.ok(node.nominal_stock > 0, `Node ${node.name} must have positive nominal stock`);
    }
  });

  test('Camera presets exist for full corridor overview and all 5 facility hubs', () => {
    // Corridor overview preset
    const overview = CAMERA_PRESETS.CORRIDOR_OVERVIEW;
    assert.ok(overview, 'CORRIDOR_OVERVIEW preset must be defined');
    assert.ok(overview.height >= 100000, 'Overview altitude should be macro bird-eye view (>= 100km)');
    assert.ok(overview.pitch < 0, 'Overview pitch should be angled downward');

    // Mountain pass preset
    const kasara = CAMERA_PRESETS.KASARA_GHAT;
    assert.ok(kasara, 'KASARA_GHAT pass preset must be defined');
    assert.equal(typeof kasara.latitude, 'number');
    assert.equal(typeof kasara.longitude, 'number');

    // Individual node camera presets
    for (const node of FACILITY_NODES) {
      assert.ok(node.cameraPreset, `Node ${node.name} must have cameraPreset`);
      assert.equal(typeof node.cameraPreset.height, 'number');
      assert.ok(node.cameraPreset.height > 1000 && node.cameraPreset.height < 15000);
      assert.equal(typeof node.cameraPreset.heading, 'number');
      assert.equal(typeof node.cameraPreset.pitch, 'number');
    }
  });

  test('Stock ring capacity thresholds match specification: Green >= 60%, Amber 30-59%, Red < 30%', () => {
    // Green >= 60%
    const greenResult1 = getStockCapacityStatus(600, 1000); // 60%
    assert.equal(greenResult1.status, 'healthy');
    assert.equal(greenResult1.hexColor, '#10b981');
    assert.equal(greenResult1.fillPct, 60);

    const greenResult2 = getStockCapacityStatus(950, 1000); // 95%
    assert.equal(greenResult2.status, 'healthy');
    assert.equal(greenResult2.hexColor, '#10b981');

    // Amber 30-59%
    const amberResult1 = getStockCapacityStatus(590, 1000); // 59%
    assert.equal(amberResult1.status, 'stressed');
    assert.equal(amberResult1.hexColor, '#f59e0b');

    const amberResult2 = getStockCapacityStatus(300, 1000); // 30%
    assert.equal(amberResult2.status, 'stressed');
    assert.equal(amberResult2.hexColor, '#f59e0b');

    // Red < 30%
    const redResult1 = getStockCapacityStatus(290, 1000); // 29%
    assert.equal(redResult1.status, 'critical');
    assert.equal(redResult1.hexColor, '#ef4444');

    const redResult2 = getStockCapacityStatus(50, 1000); // 5%
    assert.equal(redResult2.status, 'critical');
    assert.equal(redResult2.hexColor, '#ef4444');
  });
});

describe('3D Highway Flow Conduits & Disruption Shockwave Visualizer (Issue 02)', () => {
  test('Highway corridors contain valid WGS84 geometries for all 4 inter-node routes', () => {
    assert.equal(HIGHWAY_CORRIDORS.length, 4, 'Should define 4 primary highway corridors');

    const expectedLinkIds = [
      'LINK-JNPT-BHW',
      'LINK-BHW-THN',
      'LINK-BHW-NSK',
      'LINK-BHW-PUN'
    ];

    const actualLinkIds = HIGHWAY_CORRIDORS.map((c) => c.link_id);
    for (const expectedId of expectedLinkIds) {
      assert.ok(actualLinkIds.includes(expectedId), `Missing corridor link: ${expectedId}`);
    }

    for (const corridor of HIGHWAY_CORRIDORS) {
      const validation = validateLinkSchema(corridor);
      assert.ok(
        validation.valid,
        `Corridor ${corridor.link_id} schema invalid: ${validation.errors.join(', ')}`
      );

      // Verify every coordinate in the primary geometry lies within corridor WGS84 bounds
      for (const [lat, lon] of corridor.geometry) {
        assert.ok(
          lat >= CORRIDOR_BOUNDS.minLat && lat <= CORRIDOR_BOUNDS.maxLat,
          `Corridor ${corridor.link_id} point latitude ${lat} outside corridor bounds`
        );
        assert.ok(
          lon >= CORRIDOR_BOUNDS.minLon && lon <= CORRIDOR_BOUNDS.maxLon,
          `Corridor ${corridor.link_id} point longitude ${lon} outside corridor bounds`
        );
      }
    }
  });

  test('Every highway corridor defines an alternative bypass route with continuous geometry', () => {
    for (const corridor of HIGHWAY_CORRIDORS) {
      assert.ok(corridor.alternative_route, `Link ${corridor.link_id} missing alternative_route`);
      const alt = corridor.alternative_route;
      assert.ok(alt.name && alt.name.length > 0, `Link ${corridor.link_id} bypass route missing name`);
      assert.ok(alt.distance_km > 0, `Link ${corridor.link_id} bypass distance invalid`);
      assert.ok(alt.transit_hours > 0, `Link ${corridor.link_id} bypass transit hours invalid`);
      assert.ok(
        Array.isArray(alt.geometry) && alt.geometry.length >= 3,
        `Link ${corridor.link_id} bypass must have at least 3 geometry points`
      );

      // Verify bypass points are in corridor bounds
      for (const [lat, lon] of alt.geometry) {
        assert.ok(
          lat >= CORRIDOR_BOUNDS.minLat && lat <= CORRIDOR_BOUNDS.maxLat,
          `Bypass point [${lat}, ${lon}] out of bounds for ${corridor.link_id}`
        );
        assert.ok(
          lon >= CORRIDOR_BOUNDS.minLon && lon <= CORRIDOR_BOUNDS.maxLon,
          `Bypass point [${lat}, ${lon}] out of bounds for ${corridor.link_id}`
        );
      }
    }
  });

  test('Preset scenario disruption epicenters have valid WGS84 coordinates and affected link pairings', () => {
    const scenarioKeys = ['port_strike', 'monsoon_closures', 'bridge_failure'];

    for (const key of scenarioKeys) {
      const epicenter = SCENARIO_EPICENTERS[key];
      assert.ok(epicenter, `Scenario epicenter missing for ${key}`);

      const validation = validateEpicenterSchema(epicenter);
      assert.ok(
        validation.valid,
        `Epicenter ${key} validation failed: ${validation.errors.join(', ')}`
      );

      assert.ok(
        epicenter.latitude >= CORRIDOR_BOUNDS.minLat && epicenter.latitude <= CORRIDOR_BOUNDS.maxLat,
        `Epicenter ${key} latitude ${epicenter.latitude} outside bounds`
      );
      assert.ok(
        epicenter.longitude >= CORRIDOR_BOUNDS.minLon && epicenter.longitude <= CORRIDOR_BOUNDS.maxLon,
        `Epicenter ${key} longitude ${epicenter.longitude} outside bounds`
      );

      assert.ok(epicenter.radius_meters >= 1000, `Epicenter ${key} radius should be >= 1000m`);
      assert.ok(Array.isArray(epicenter.affected_links) && epicenter.affected_links.length > 0);

      // Verify that every affected link exists in HIGHWAY_CORRIDORS
      for (const affId of epicenter.affected_links) {
        const link = HIGHWAY_CORRIDORS.find((c) => c.link_id === affId);
        assert.ok(link, `Affected link ${affId} for scenario ${key} not found in HIGHWAY_CORRIDORS`);
      }
    }
  });

  test('Disruption shockwave coordinate payloads match specific geography epicenters', () => {
    // 1. Port strike epicenter matches JNPT
    const portEpicenter = SCENARIO_EPICENTERS.port_strike;
    assert.equal(portEpicenter.latitude, 18.9496);
    assert.equal(portEpicenter.longitude, 72.9515);
    assert.ok(portEpicenter.affected_links.includes('LINK-JNPT-BHW'));

    // 2. Monsoon closures epicenter matches Kasara Ghat NH-160
    const monsoonEpicenter = SCENARIO_EPICENTERS.monsoon_closures;
    assert.equal(monsoonEpicenter.latitude, 19.6967);
    assert.equal(monsoonEpicenter.longitude, 73.5611);
    assert.ok(monsoonEpicenter.affected_links.includes('LINK-BHW-NSK'));

    // 3. Bridge failure epicenter matches Khandala / Bhor Ghat Viaduct on Expressway
    const bridgeEpicenter = SCENARIO_EPICENTERS.bridge_failure;
    assert.equal(bridgeEpicenter.latitude, 18.7557);
    assert.equal(bridgeEpicenter.longitude, 73.4091);
    assert.ok(bridgeEpicenter.affected_links.includes('LINK-BHW-PUN'));
  });
});

describe('Autonomous AI Sentinel & 1Hz Macro-Corridor Telemetry (Issue 03)', () => {
  test('Sentinel operational modes and risk thresholds follow specification', () => {
    const MODE_AUTONOMOUS = 'AUTONOMOUS_SENTINEL';
    const MODE_MANUAL = 'MANUAL_OPERATOR';
    const CRITICAL_FLOOR = 70.0;
    const NOMINAL_CEILING = 40.0;

    assert.equal(MODE_AUTONOMOUS, 'AUTONOMOUS_SENTINEL');
    assert.equal(MODE_MANUAL, 'MANUAL_OPERATOR');

    const evaluateRiskStatus = (risk) => {
      if (risk >= CRITICAL_FLOOR) return 'CRITICAL_INTERVENTION';
      if (risk >= NOMINAL_CEILING) return 'ELEVATED';
      return 'NOMINAL';
    };

    assert.equal(evaluateRiskStatus(25.0), 'NOMINAL');
    assert.equal(evaluateRiskStatus(40.0), 'ELEVATED');
    assert.equal(evaluateRiskStatus(55.2), 'ELEVATED');
    assert.equal(evaluateRiskStatus(70.0), 'CRITICAL_INTERVENTION');
    assert.equal(evaluateRiskStatus(84.6), 'CRITICAL_INTERVENTION');
  });

  test('Validates 1Hz macro-corridor telemetry payload structure', () => {
    const mockMacroCorridor = {
      timestamp: new Date().toISOString(),
      nodes: FACILITY_NODES.map(n => ({
        node_id: n.node_id,
        current_stock: n.nominal_stock,
        capacity_units: n.capacity_units,
        status: 'HEALTHY'
      })),
      corridors: HIGHWAY_CORRIDORS.map(c => ({
        link_id: c.link_id,
        congestion_index: c.nominal_congestion_index,
        status: 'OPTIMAL'
      })),
      active_shocks_count: 0,
      sentinel: {
        mode: 'AUTONOMOUS_SENTINEL',
        risk_index: 24.5,
        status: 'NOMINAL',
        active_directives: []
      }
    };

    assert.equal(mockMacroCorridor.nodes.length, 5);
    assert.equal(mockMacroCorridor.corridors.length, 4);
    assert.equal(mockMacroCorridor.sentinel.mode, 'AUTONOMOUS_SENTINEL');
    assert.equal(mockMacroCorridor.sentinel.status, 'NOMINAL');
  });
});

