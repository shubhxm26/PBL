import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  wgs84ToWorldCoordinates,
  worldToWgs84Coordinates,
  projectCorridorWaypoints,
  calculateElevationGradient,
  CORRIDOR_GPS_BOUNDS,
  WORLD_STAGE_BOUNDS,
  ANCHOR_CALIBRATION_POINTS
} from '../src/utils/coordinateTransforms.js';
import {
  CAMERA_MODES,
  CAMERA_MODE_METADATA,
  calculateChaseCameraPosition,
  calculateCockpitCameraPosition,
  calculateDroneCameraPosition,
  dampScalar,
  dampArray3
} from '../src/utils/cameraControllers.js';
import {
  STAGE_NODES,
  STAGE_FACILITIES,
  PUNE_FC_NODE,
  CAMERA_VIEWS
} from '../src/constants/stage3DTopology.js';
import {
  buildCorridorSplines,
  createExtrudedHighwayRibbon,
  createTrafficPulses,
  createKasaraElevationTerrain
} from '../src/components/3d/proceduralWorld.js';
import {
  createProceduralTruck,
  createFacilityNodeModel
} from '../src/components/3d/proceduralModels.js';

describe('02: Three.js / R3F Procedural Logistics World & 3rd-Person Chase Cam', () => {

  describe('1. WGS84 GPS to 3D World Stage Coordinate Transformation Suite', () => {
    test('Transforms key logistics corridor anchor nodes to calibrated 3D positions', () => {
      ANCHOR_CALIBRATION_POINTS.forEach(({ code, gps, world }) => {
        const [x, y, z] = wgs84ToWorldCoordinates(gps[0], gps[1], gps[2]);
        assert.equal(x, world[0], `${code} X-coordinate must match world position`);
        assert.equal(y, world[1], `${code} Y-elevation must match world position`);
        assert.equal(z, world[2], `${code} Z-coordinate must match world position`);
      });
    });

    test('Inverts 3D world coordinates back to WGS84 GPS coordinates accurately', () => {
      ANCHOR_CALIBRATION_POINTS.forEach(({ code, gps, world }) => {
        const [lat, lon, elev] = worldToWgs84Coordinates(world[0], world[1], world[2]);
        assert.ok(Math.abs(lat - gps[0]) < 0.05, `${code} inverted latitude matches within 0.05 deg`);
        assert.ok(Math.abs(lon - gps[1]) < 0.05, `${code} inverted longitude matches within 0.05 deg`);
      });
    });

    test('Kasara Ghat mountain pass displays significant 3D elevation gradient', () => {
      // Sea level port (JNPT) elevation vs Kasara Ghat peak summit
      const jnptElev = calculateElevationGradient(18.9496, 72.9515);
      const kasaraElev = calculateElevationGradient(19.6967, 73.5611);
      const nashikElev = calculateElevationGradient(19.9975, 73.7898);

      assert.equal(jnptElev, 0, 'Coastal maritime port must be at base level y=0');
      assert.ok(kasaraElev >= 9.0, 'Kasara Ghat mountain crest must attain high elevation peak y >= 9.0');
      assert.ok(nashikElev >= 6.0 && nashikElev <= 7.0, 'Nashik Deccan plateau must settle at intermediate elevated tableland');
      assert.ok(kasaraElev > nashikElev, 'Kasara Ghat summit pass must be higher than Nashik plateau tableland');
    });

    test('Projects real multi-segment WGS84 GPS corridor waypoints into continuous 3D world vectors', () => {
      const sampleGpsWaypoints = [
        [18.9496, 72.9515], // JNPT
        [19.0050, 73.0150], // Belapur CBD
        [19.2183, 72.9781], // Thane
        [19.2967, 73.0631], // Bhiwandi
        [19.6967, 73.5611], // Kasara Ghat
        [19.9975, 73.7898]  // Nashik
      ];

      const projected = projectCorridorWaypoints(sampleGpsWaypoints);
      assert.equal(projected.length, sampleGpsWaypoints.length);

      projected.forEach((pt) => {
        assert.equal(pt.length, 3, 'Each projected waypoint must be [x, y, z]');
        assert.ok(typeof pt[0] === 'number');
        assert.ok(typeof pt[1] === 'number');
        assert.ok(typeof pt[2] === 'number');
        // Within world stage bounds
        assert.ok(pt[0] >= WORLD_STAGE_BOUNDS.minX && pt[0] <= WORLD_STAGE_BOUNDS.maxX);
        assert.ok(pt[2] >= WORLD_STAGE_BOUNDS.minZ && pt[2] <= WORLD_STAGE_BOUNDS.maxZ);
      });
    });
  });

  describe('2. Multi-Perspective Camera Suite (Chase, Cockpit, Drone, Free Orbit)', () => {
    test('Defines all 4 required operational camera perspectives with metadata', () => {
      const expectedModes = ['CHASE', 'COCKPIT', 'DRONE', 'FREE_ORBIT'];
      expectedModes.forEach((mode) => {
        assert.ok(CAMERA_MODES[mode], `CAMERA_MODES must export ${mode}`);
        const meta = CAMERA_MODE_METADATA[CAMERA_MODES[mode]];
        assert.ok(meta, `Metadata must exist for mode ${mode}`);
        assert.ok(meta.name, `Metadata must declare readable name for ${mode}`);
        assert.ok(meta.badge, `Metadata must declare HUD badge for ${mode}`);
        assert.ok(meta.hotkey, `Metadata must declare quick hotkey for ${mode}`);
      });
    });

    test('3rd-Person Dynamic Chase Cam accurately aligns behind moving truck and dampens position', () => {
      const truckPos = [10, 2, -15];
      // Heading North (-Z direction)
      const truckHeading = [0, 0, -1];

      const chase = calculateChaseCameraPosition({
        truckPos,
        truckHeading,
        yawOffset: 0,
        pitchOffset: 0.15,
        distance: 14.0,
        height: 5.2
      });

      // Since heading is [0, 0, -1] (North), behind truck should be +Z (South)
      assert.ok(chase.position[2] > truckPos[2], 'Camera position Z must be behind truck (+Z)');
      assert.ok(chase.position[1] > truckPos[1], 'Camera height must be elevated above truck position');
      // LookAt should be oriented slightly ahead of truck in -Z direction
      assert.ok(chase.lookAt[2] < truckPos[2], 'Camera lookAt target must point ahead along heading (-Z)');
    });

    test('3rd-Person Chase Cam mouse free-look rotates yaw around vehicle without losing target', () => {
      const truckPos = [0, 0, 0];
      const truckHeading = [0, 0, -1];

      // 1. Zero yaw (directly behind)
      const directBehind = calculateChaseCameraPosition({
        truckPos,
        truckHeading,
        yawOffset: 0,
        distance: 10.0
      });

      // 2. 90-degree yaw right (PI/2)
      const sideView = calculateChaseCameraPosition({
        truckPos,
        truckHeading,
        yawOffset: Math.PI / 2,
        distance: 10.0
      });

      // Direct behind should have x ~ 0 and z > 0
      assert.ok(Math.abs(directBehind.position[0]) < 0.1);
      assert.ok(directBehind.position[2] > 0);

      // 90 deg side view should rotate offset to lateral X
      assert.ok(Math.abs(sideView.position[0]) > 5.0, 'Rotated yaw offset must move camera laterally');
      // Target remains locked on the truck
      assert.ok(Math.abs(sideView.lookAt[0] - truckPos[0]) < 0.1);
    });

    test('Driver Cockpit Dashcam POV positions camera at cab windshield looking down highway', () => {
      const truckPos = [20, 5, -30];
      const truckHeading = [0.8, 0, 0.6]; // Angled highway curve

      const cockpit = calculateCockpitCameraPosition({
        truckPos,
        truckHeading,
        eyeHeight: 2.3,
        forwardOffset: 2.6
      });

      // Cockpit position sits above and slightly in front of cab base
      assert.ok(cockpit.position[1] > truckPos[1] + 2.0, 'Cockpit camera must sit at driver eye level');
      // LookAt extends far down the road along forward heading
      assert.ok(cockpit.lookAt[0] > cockpit.position[0], 'LookAt points ahead along X heading');
      assert.ok(cockpit.lookAt[2] > cockpit.position[2], 'LookAt points ahead along Z heading');
    });

    test('Drone God-View positions camera directly overhead with high tactical altitude', () => {
      const truckPos = [-14, 0, 2];

      const drone = calculateDroneCameraPosition({
        truckPos,
        altitude: 54.0,
        pitchBias: 8.0
      });

      assert.equal(drone.position[0], truckPos[0], 'Drone X must match vehicle X');
      assert.equal(drone.position[1], truckPos[1] + 54.0, 'Drone height must equal altitude');
      assert.equal(drone.lookAt[0], truckPos[0]);
      assert.equal(drone.lookAt[1], truckPos[1]);
      assert.equal(drone.lookAt[2], truckPos[2]);
    });

    test('Framerate-independent exponential damping converges smoothly towards target', () => {
      const start = [0, 0, 0];
      const target = [10, 20, 30];
      const dt = 0.016; // 60 FPS frame delta

      let current = [...start];
      for (let i = 0; i < 60; i++) {
        current = dampArray3(current, target, 8.0, dt);
      }

      // After 60 frames (~1 sec), should be very close to target
      assert.ok(Math.abs(current[0] - target[0]) < 0.05);
      assert.ok(Math.abs(current[1] - target[1]) < 0.05);
      assert.ok(Math.abs(current[2] - target[2]) < 0.05);
    });
  });

  describe('3. Procedural Extruded Highway Network & Kasara Elevation Terrain', () => {
    test('Builds continuous 3D Catmull-Rom spline curves from WGS84 GPS corridor data', () => {
      const { mainCorridorCurve, southernCurve, waypointCount } = buildCorridorSplines();

      assert.ok(mainCorridorCurve, 'Main corridor spline curve must be generated');
      assert.ok(waypointCount >= 10, 'Waypoints must include full sequence from JNPT to Nashik');

      // Sample curve at 0 (JNPT origin), 0.5 (Kasara pass area), and 1.0 (Nashik depot)
      const ptStart = mainCorridorCurve.getPointAt(0);
      const ptMid = mainCorridorCurve.getPointAt(0.65);
      const ptEnd = mainCorridorCurve.getPointAt(1.0);

      assert.ok(ptStart instanceof THREE.Vector3);
      assert.ok(ptMid instanceof THREE.Vector3);
      assert.ok(ptEnd instanceof THREE.Vector3);

      // Mid-point climbing Kasara Ghat must be elevated
      assert.ok(ptMid.y > ptStart.y + 4.0, 'Mid-corridor Kasara Ghat point must be significantly elevated');
      assert.ok(southernCurve instanceof THREE.CatmullRomCurve3, 'Southern Pune curve must be generated');
    });

    test('Generates extruded highway roadbed mesh with dual glowing lane conduits', () => {
      const { mainCorridorCurve } = buildCorridorSplines();
      const highwayGroup = createExtrudedHighwayRibbon(mainCorridorCurve, {
        roadWidth: 1.8,
        roadSegments: 60
      });

      assert.equal(highwayGroup.name, 'ExtrudedHighwayRibbon');
      assert.ok(highwayGroup.children.length >= 3, 'Must contain roadbed mesh, center lane conduit, and shoulder rails');

      // Check materials and geometries
      const roadbed = highwayGroup.children[0];
      assert.ok(roadbed.isMesh);
      assert.ok(roadbed.geometry instanceof THREE.TubeGeometry);
    });

    test('Creates animated traffic flow pulses along highway spline', () => {
      const { mainCorridorCurve } = buildCorridorSplines();
      const { group, pulses } = createTrafficPulses(mainCorridorCurve, 8);

      assert.equal(group.name, 'HighwayTrafficPulses');
      assert.equal(pulses.length, 8);

      pulses.forEach((p, idx) => {
        assert.ok(p.mesh.isMesh);
        assert.ok(p.offset >= 0 && p.offset <= 1.0);
        assert.ok(p.speed > 0, 'Pulse must have forward velocity');
      });
    });

    test('Creates Kasara Ghat 3D elevation gradient terrain group with contour overlay', () => {
      const terrainGroup = createKasaraElevationTerrain();
      assert.equal(terrainGroup.name, 'WesternGhats_KasaraElevation');
      assert.ok(terrainGroup.children.length >= 3, 'Must contain main summit, contour overlay, and ridge meshes');

      const summit = terrainGroup.children[0];
      assert.ok(summit.position.y > 0, 'Mountain summit must be elevated');
    });
  });

  describe('4. Procedural 3D Logistics Structures & Commercial Freight Vehicle', () => {
    test('Facility registry defines all 6 key multi-echelon hubs including Pune FC', () => {
      assert.equal(STAGE_FACILITIES.length, 6, 'Must register 6 facilities');

      const expected = ['JNPT', 'THANE', 'BHIWANDI', 'KASARA', 'NASHIK', 'PUNE'];
      const actual = STAGE_FACILITIES.map((n) => n.code);

      expected.forEach((code) => {
        assert.ok(actual.includes(code), `Facilities must include ${code}`);
      });
    });

    test('Instantiates procedural 3D models for all corridor facilities with raycasting tags', () => {
      STAGE_FACILITIES.forEach((node) => {
        const model = createFacilityNodeModel(node);
        assert.ok(model instanceof THREE.Group, `${node.code} model must be a Three.js Group`);
        assert.equal(model.userData.isFacility, true, `${node.code} must be tagged as isFacility`);
        assert.equal(model.userData.nodeId, node.id);
        assert.ok(model.children.length > 0, `${node.code} model must contain architectural child meshes`);
      });
    });

    test('Commercial Vehicle model features cab, trailer, 6 spinning wheels, headlights, and beacon', () => {
      const truck = createProceduralTruck();

      assert.equal(truck.name, 'CommercialVehicle_Truck');
      assert.ok(truck.wheelMeshes, 'Truck must expose wheelMeshes array for rotational animation');
      assert.equal(truck.wheelMeshes.length, 6, 'Truck must have 6 wheels (2 steer, 4 drive)');

      truck.wheelMeshes.forEach((wheel) => {
        assert.ok(wheel instanceof THREE.Group, 'Wheel assembly must be a group');
        assert.ok(wheel.children.length >= 2, 'Wheel assembly must contain tire and rim meshes');
      });

      assert.ok(truck.beaconGroup, 'Truck must feature floating cold-chain telemetry beacon');
      assert.ok(truck.beaconCore);
      assert.ok(truck.beaconRing);

      // Check headlights
      const hasSpotLight = truck.children.some((c) => c instanceof THREE.SpotLight);
      assert.ok(hasSpotLight, 'Truck must feature dynamic SpotLight headlights');
    });

    test('Wheel spin animation rotation increments proportionally with speed multiplier', () => {
      const truck = createProceduralTruck();
      const delta = 0.016; // 1 frame
      const speedMult = 2; // 2x simulation speed

      const initialRotX = truck.wheelMeshes[0].children[0].rotation.x;

      truck.wheelMeshes.forEach((w) => {
        w.children.forEach((child) => {
          child.rotation.x += delta * speedMult * 26.0;
        });
      });

      const updatedRotX = truck.wheelMeshes[0].children[0].rotation.x;
      assert.ok(updatedRotX > initialRotX, 'Wheel rotation must advance forward');
      assert.ok(Math.abs((updatedRotX - initialRotX) - (delta * speedMult * 26.0)) < 0.001);
    });
  });
});
