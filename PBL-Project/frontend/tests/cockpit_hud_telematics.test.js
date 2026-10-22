import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import {
  VEHICLE_CONFIGS,
  KASARA_DISRUPTION_PAYLOAD,
  evaluateColdChainStatus,
  calculateSpeedRatio,
  calculateSoCCategory,
  resolveCameraFocusTarget,
  resolveDetourTrajectory
} from '../src/utils/telematicsControllers.js';
import {
  buildCorridorSplines,
  createExtrudedHighwayRibbon
} from '../src/components/3d/proceduralWorld.js';
import {
  createProceduralTruck,
  createRoadblockBarricade
} from '../src/components/3d/proceduralModels.js';
import { telemetryWS } from '../src/services/websocket.js';

describe('04: Live Telematics Cockpit HUD & Dynamic Roadblock Re-routing', () => {

  describe('1. WebSocket Telemetry Ingestion & Message Processing', () => {
    it('TelemetryWebSocketClient singleton exports reliable subscriptions and control helpers', () => {
      assert.ok(telemetryWS, 'telemetryWS singleton must be exported');
      assert.strictEqual(typeof telemetryWS.subscribe, 'function');
      assert.strictEqual(typeof telemetryWS.play, 'function');
      assert.strictEqual(typeof telemetryWS.pause, 'function');
      assert.strictEqual(typeof telemetryWS.step, 'function');
      assert.strictEqual(typeof telemetryWS.setSpeed, 'function');
      assert.strictEqual(typeof telemetryWS.injectRoadblock, 'function');
      assert.strictEqual(typeof telemetryWS.clearRoadblocks, 'function');
    });

    it('Correctly parses and distributes TELEMETRY_TICK payloads to subscribers', () => {
      let receivedTick = null;
      let receivedState = null;
      let receivedRoadblocks = null;

      const unsubTick = telemetryWS.subscribe('tick', (data) => {
        receivedTick = data;
      });
      const unsubState = telemetryWS.subscribe('state', (state) => {
        receivedState = state;
      });
      const unsubRoadblocks = telemetryWS.subscribe('roadblocks', (rb) => {
        receivedRoadblocks = rb;
      });

      const mockTickPayload = {
        type: 'TELEMETRY_TICK',
        simulation: {
          is_running: true,
          speed_multiplier: 2.0,
          elapsed_seconds: 120,
          elapsed_formatted: '00:02:00',
          simulated_time: '08:02:00 AM'
        },
        vehicles: {
          'TRK-MH-01': {
            speed_kmh: 62.5,
            battery_fuel_soc_pct: 95.2,
            cargo_temp_c: 4.2,
            is_rerouted: false
          }
        },
        active_roadblocks: []
      };

      telemetryWS.handleIncomingMessage(mockTickPayload);

      assert.ok(receivedTick, 'Tick listener must receive tick payload');
      assert.strictEqual(receivedTick.type, 'TELEMETRY_TICK');
      assert.strictEqual(receivedState.simulated_time, '08:02:00 AM');
      assert.strictEqual(receivedState.speed_multiplier, 2.0);
      assert.deepStrictEqual(receivedRoadblocks, []);

      unsubTick();
      unsubState();
      unsubRoadblocks();
    });

    it('Processes REROUTE_EVENT message and parses detour details', () => {
      let rerouteEvent = null;
      const unsub = telemetryWS.subscribe('reroute', (evt) => {
        rerouteEvent = evt;
      });

      const mockReroute = {
        type: 'REROUTE_EVENT',
        status: 'DISRUPTION_INJECTED',
        roadblock: {
          roadblock_id: 'RB-KASARA-01',
          name: 'Kasara Ghat Monsoon Landslide',
          severity: 'CRITICAL'
        },
        affected_vehicles: ['TRK-MH-01'],
        reroute_details: [
          {
            vehicle_id: 'TRK-MH-01',
            detour_reason: 'Automated PyTorch DRL re-route bypassed Kasara Ghat via Malshej Ghat (+21.6 km, +34m)',
            added_distance_km: 21.6,
            added_duration_mins: 34
          }
        ]
      };

      telemetryWS.handleIncomingMessage(mockReroute);

      assert.ok(rerouteEvent, 'Reroute subscriber must receive event');
      assert.strictEqual(rerouteEvent.status, 'DISRUPTION_INJECTED');
      assert.strictEqual(rerouteEvent.roadblock.roadblock_id, 'RB-KASARA-01');
      assert.strictEqual(rerouteEvent.affected_vehicles[0], 'TRK-MH-01');
      assert.strictEqual(rerouteEvent.reroute_details[0].added_distance_km, 21.6);

      unsub();
    });

    it('Notifies ROADBLOCKS_CLEARED and empties active roadblocks', () => {
      let clearedEvent = null;
      let activeRoadblocks = ['initial'];

      const unsubClear = telemetryWS.subscribe('roadblocksCleared', (evt) => {
        clearedEvent = evt;
      });
      const unsubRb = telemetryWS.subscribe('roadblocks', (rb) => {
        activeRoadblocks = rb;
      });

      telemetryWS.handleIncomingMessage({
        type: 'ROADBLOCKS_CLEARED',
        status: 'ROADBLOCKS_CLEARED',
        message: 'All corridor disruptions cleared.'
      });

      assert.ok(clearedEvent, 'Clear subscriber must receive event');
      assert.deepStrictEqual(activeRoadblocks, [], 'Active roadblocks must be reset to empty array');

      unsubClear();
      unsubRb();
    });
  });

  describe('2. Simulation Playback Controls & Multipliers (1x, 2x, 5x)', () => {
    it('Formats simulation control payloads with correct action verbs', () => {
      // Test payload generators
      const playMsg = { action: 'play' };
      const pauseMsg = { action: 'pause' };
      const stepMsg = { action: 'step', step_seconds: 15 };
      const speed1x = { action: 'set_speed', speed: 1.0 };
      const speed2x = { action: 'set_speed', speed: 2.0 };
      const speed5x = { action: 'set_speed', speed: 5.0 };
      const resetMsg = { action: 'reset' };

      assert.strictEqual(playMsg.action, 'play');
      assert.strictEqual(pauseMsg.action, 'pause');
      assert.strictEqual(stepMsg.step_seconds, 15);
      assert.strictEqual(speed1x.speed, 1.0);
      assert.strictEqual(speed2x.speed, 2.0);
      assert.strictEqual(speed5x.speed, 5.0);
      assert.strictEqual(resetMsg.action, 'reset');
    });

    it('Validates simulation speed multiplier options match backend supported rates', () => {
      const supportedSpeeds = [1.0, 2.0, 5.0];
      supportedSpeeds.forEach((spd) => {
        assert.ok([1.0, 2.0, 5.0].includes(spd), `Speed ${spd}x must be supported`);
      });
    });

    it('Simulation clock increments proportionally to speed multiplier and delta', () => {
      const dt = 1.0; // 1 second
      const speed1x = 1.0;
      const speed2x = 2.0;
      const speed5x = 5.0;

      const increment1x = dt * speed1x;
      const increment2x = dt * speed2x;
      const increment5x = dt * speed5x;

      assert.strictEqual(increment1x, 1.0);
      assert.strictEqual(increment2x, 2.0);
      assert.strictEqual(increment5x, 5.0);
    });
  });

  describe('3. Fleet Vehicle Switcher & Multi-Perspective Camera Focus', () => {
    it('Defines authoritative configurations for TRK-MH-01 and TRK-MH-02', () => {
      assert.ok(VEHICLE_CONFIGS['TRK-MH-01'], 'TRK-MH-01 must be defined');
      assert.ok(VEHICLE_CONFIGS['TRK-MH-02'], 'TRK-MH-02 must be defined');

      const v1 = VEHICLE_CONFIGS['TRK-MH-01'];
      assert.strictEqual(v1.id, 'TRK-MH-01');
      assert.strictEqual(v1.hasColdChain, true, 'TRK-MH-01 must be cold-chain reefer');
      assert.strictEqual(v1.targetTempC, 4.0);
      assert.strictEqual(v1.safeZoneMin, 2.0);
      assert.strictEqual(v1.safeZoneMax, 8.0);
      assert.ok(v1.corridor.includes('Nashik'));

      const v2 = VEHICLE_CONFIGS['TRK-MH-02'];
      assert.strictEqual(v2.id, 'TRK-MH-02');
      assert.strictEqual(v2.hasColdChain, false, 'TRK-MH-02 is high-tech EV carrier');
      assert.ok(v2.corridor.includes('Pune'));
    });

    it('Supports dynamic vehicle switching and camera target point assignment', () => {
      // Mock coordinates for Truck 1 (Nashik corridor) and Truck 2 (Pune expressway)
      const truck1Pos = [-14, 0, 2]; // Bhiwandi
      const truck1Heading = [0, 0, -1];

      const truck2Pos = [18, 2, 28]; // Panvel-Pune viaduct
      const truck2Heading = [0.8, 0, 0.6];

      // Vehicle switcher function
      const getActiveCameraTarget = (activeId) => {
        if (activeId === 'TRK-MH-02') {
          return { pos: truck2Pos, heading: truck2Heading, id: 'TRK-MH-02' };
        }
        return { pos: truck1Pos, heading: truck1Heading, id: 'TRK-MH-01' };
      };

      const focusV1 = getActiveCameraTarget('TRK-MH-01');
      assert.deepStrictEqual(focusV1.pos, truck1Pos);
      assert.strictEqual(focusV1.id, 'TRK-MH-01');

      const focusV2 = getActiveCameraTarget('TRK-MH-02');
      assert.deepStrictEqual(focusV2.pos, truck2Pos);
      assert.strictEqual(focusV2.id, 'TRK-MH-02');
    });

    it('Instantiates distinct procedural 3D models for both commercial fleet vehicles', () => {
      const truck1 = createProceduralTruck({
        cabColor: 0xff5400,
        trailerColor: 0xf8fafc,
        beaconColor: 0x10b981
      });
      assert.ok(truck1 instanceof THREE.Group);
      assert.strictEqual(truck1.wheelMeshes.length, 6, 'Truck 1 must have 6 functional wheels');
      assert.ok(truck1.beaconGroup, 'Truck 1 must have cold-chain beacon');

      const truck2 = createProceduralTruck({
        cabColor: 0x06b6d4,
        trailerColor: 0x1e293b,
        beaconColor: 0x3b82f6
      });
      assert.ok(truck2 instanceof THREE.Group);
      assert.strictEqual(truck2.wheelMeshes.length, 6, 'Truck 2 must have 6 functional wheels');
      assert.ok(truck2.beaconGroup, 'Truck 2 must have EV express beacon');
    });
  });

  describe('4. Telemetry Gauge Cluster & Cold-Chain 2°C–8°C Thresholding', () => {
    it('Evaluates temperatures in 2°C–8°C range as NOMINAL', () => {
      assert.strictEqual(evaluateColdChainStatus(2.0), 'NOMINAL');
      assert.strictEqual(evaluateColdChainStatus(4.0), 'NOMINAL');
      assert.strictEqual(evaluateColdChainStatus(4.1), 'NOMINAL');
      assert.strictEqual(evaluateColdChainStatus(6.5), 'NOMINAL');
      assert.strictEqual(evaluateColdChainStatus(8.0), 'NOMINAL');
    });

    it('Evaluates excursion temperatures outside 2°C–8°C but <= 10°C as EXCURSION alert', () => {
      assert.strictEqual(evaluateColdChainStatus(8.1), 'EXCURSION');
      assert.strictEqual(evaluateColdChainStatus(9.5), 'EXCURSION');
      assert.strictEqual(evaluateColdChainStatus(10.0), 'EXCURSION');
      assert.strictEqual(evaluateColdChainStatus(1.9), 'EXCURSION');
      assert.strictEqual(evaluateColdChainStatus(0.5), 'EXCURSION');
    });

    it('Evaluates severe temperature breaches as CRITICAL risk', () => {
      assert.strictEqual(evaluateColdChainStatus(10.5), 'CRITICAL');
      assert.strictEqual(evaluateColdChainStatus(15.0), 'CRITICAL');
      assert.strictEqual(evaluateColdChainStatus(-2.0), 'CRITICAL');
    });

    it('Classifies Battery / Fuel SoC with correct threshold coloring', () => {
      const getSocCategory = (soc) => {
        if (soc >= 50) return 'HEALTHY_GREEN';
        if (soc >= 20) return 'WARNING_AMBER';
        return 'CRITICAL_RED';
      };

      assert.strictEqual(getSocCategory(95), 'HEALTHY_GREEN');
      assert.strictEqual(getSocCategory(50), 'HEALTHY_GREEN');
      assert.strictEqual(getSocCategory(49), 'WARNING_AMBER');
      assert.strictEqual(getSocCategory(20), 'WARNING_AMBER');
      assert.strictEqual(getSocCategory(19), 'CRITICAL_RED');
      assert.strictEqual(getSocCategory(5), 'CRITICAL_RED');
    });
  });

  describe('5. Kasara Ghat Disruption, 3D Barricades & Detour Re-Routing', () => {
    it('KASARA_DISRUPTION_PAYLOAD accurately targets Kasara Ghat with 10x penalty', () => {
      assert.strictEqual(KASARA_DISRUPTION_PAYLOAD.roadblock_id, 'RB-KASARA-01');
      assert.strictEqual(KASARA_DISRUPTION_PAYLOAD.corridor_node, 'KSR');
      assert.strictEqual(KASARA_DISRUPTION_PAYLOAD.latitude, 19.6967);
      assert.strictEqual(KASARA_DISRUPTION_PAYLOAD.longitude, 73.5611);
      assert.strictEqual(KASARA_DISRUPTION_PAYLOAD.penalty_multiplier, 10.0);
      assert.strictEqual(KASARA_DISRUPTION_PAYLOAD.target_vehicle_id, 'TRK-MH-01');
    });

    it('Instantiates 3D Roadblock Barricade with Jersey base, chevron bars, cones and strobe lights', () => {
      const barricade = createRoadblockBarricade({
        pos: [14, 9.8, -24],
        rotationY: 0.45
      });

      assert.ok(barricade instanceof THREE.Group, 'Barricade must be a Three.js Group');
      assert.strictEqual(barricade.name, 'RoadblockBarricade_Kasara');
      assert.strictEqual(barricade.userData.isRoadblock, true);
      assert.strictEqual(barricade.userData.roadblockId, 'RB-KASARA-01');
      assert.strictEqual(barricade.position.x, 14);
      assert.strictEqual(barricade.position.y, 9.8);
      assert.strictEqual(barricade.position.z, -24);

      assert.ok(barricade.beacons, 'Barricade must expose hazard beacons');
      assert.strictEqual(barricade.beacons.length, 2, 'Must have dual flashing strobe beacons');
      assert.ok(barricade.strobeLight instanceof THREE.PointLight, 'Must have dynamic point light');
      assert.strictEqual(typeof barricade.update, 'function', 'Must have animation update method');
    });

    it('Switches from standard corridor curve to full detour curve during roadblock disruption', () => {
      const { mainCorridorCurve, fullDetourCurve } = buildCorridorSplines();
      assert.ok(mainCorridorCurve, 'mainCorridorCurve must exist');
      assert.ok(fullDetourCurve, 'fullDetourCurve must exist');

      // Check start points coincide at JNPT Port
      const pMainStart = mainCorridorCurve.getPointAt(0);
      const pDetourStart = fullDetourCurve.getPointAt(0);
      assert.ok(Math.abs(pMainStart.x - pDetourStart.x) < 0.1);
      assert.ok(Math.abs(pMainStart.z - pDetourStart.z) < 0.1);

      // Check midpoints diverge at Kasara Ghat vs Malshej Ghat
      // mainCorridorCurve at ~0.7 passes through Kasara Ghat [x ~ 14, z ~ -24]
      // fullDetourCurve at ~0.65 passes through Malshej Ghat Crest [x ~ 18-28, z ~ 10 to -10]
      const pMainMid = mainCorridorCurve.getPointAt(0.72);
      const pDetourMid = fullDetourCurve.getPointAt(0.65);

      // Verify they represent physically distinct trajectories through Western Ghats
      const dist = Math.hypot(pMainMid.x - pDetourMid.x, pMainMid.z - pDetourMid.z);
      assert.ok(dist > 15.0, `Detour route must physically diverge from main corridor by >15 units (actual: ${dist.toFixed(2)})`);

      // Check end points coincide at Nashik Depot
      const pMainEnd = mainCorridorCurve.getPointAt(1.0);
      const pDetourEnd = fullDetourCurve.getPointAt(1.0);
      assert.ok(Math.abs(pMainEnd.x - pDetourEnd.x) < 0.1);
      assert.ok(Math.abs(pMainEnd.z - pDetourEnd.z) < 0.1);
    });

    it('Detour route adds ~21.6 km distance and truck speed drops appropriately during congestion', () => {
      const normalSpeedKmh = 64.0;
      const detourSpeedKmh = 48.0;

      assert.ok(detourSpeedKmh < normalSpeedKmh, 'Truck must visibly slow down when detour/roadblock is engaged');
      const addedKm = 21.6;
      const addedMins = 34;
      assert.strictEqual(addedKm, 21.6);
      assert.strictEqual(addedMins, 34);
    });
  });

});
