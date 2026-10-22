/**
 * proceduralWorld.js
 *
 * Procedural 3D Logistics World Builder for the Three.js Operational Stage.
 * Constructs:
 *   1. Procedural Extruded Highway Ribbons from real WGS84 GPS corridor waypoints
 *   2. Dual Glowing Lane Conduits (Neon Cyan & Safety Orange)
 *   3. Animated Highway Traffic Flow Pulses
 *   4. Kasara Ghat 3D Elevation Gradient Mountain Topography Mesh
 *   5. Full Corridor Logistics Nodes Group (JNPT, Bhiwandi, Thane, Kasara, Nashik, Pune)
 */

import * as THREE from 'three';
import { HIGHWAY_CORRIDORS } from '../../constants/logisticsTopology.js';
import { projectCorridorWaypoints } from '../../utils/coordinateTransforms.js';
import { STAGE_FACILITIES } from '../../constants/stage3DTopology.js';
import { createFacilityNodeModel } from './proceduralModels.js';

/**
 * Builds the primary corridor spline curve from real WGS84 GPS waypoints.
 * Combines JNPT -> Bhiwandi and Bhiwandi -> Nashik (via Kasara Ghat)
 * into a single unified continuous 3D logistics spline curve.
 */
export function buildCorridorSplines() {
  // 1. Extract GPS geometries from authoritative HIGHWAY_CORRIDORS
  const jnptBhwLink = HIGHWAY_CORRIDORS.find((l) => l.link_id === 'LINK-JNPT-BHW');
  const bhwNskLink = HIGHWAY_CORRIDORS.find((l) => l.link_id === 'LINK-BHW-NSK');
  const bhwPunLink = HIGHWAY_CORRIDORS.find((l) => l.link_id === 'LINK-BHW-PUN');

  // Primary Western India Logistics Highway: JNPT -> Bhiwandi -> Kasara Ghat -> Nashik
  let rawWaypoints = [];
  if (jnptBhwLink && bhwNskLink) {
    // Exclude duplicate Bhiwandi junction point
    rawWaypoints = [...jnptBhwLink.geometry, ...bhwNskLink.geometry.slice(1)];
  }

  // Transform WGS84 coordinates to 3D world space
  const worldPoints = projectCorridorWaypoints(rawWaypoints);
  const vectorPoints = worldPoints.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]));

  // Create smooth Catmull-Rom 3D Curve
  const mainCorridorCurve = new THREE.CatmullRomCurve3(
    vectorPoints,
    false,
    'catmullrom',
    0.2
  );

  // Southern Spur Curve (Bhiwandi -> Pune)
  let southernCurve = null;
  if (bhwPunLink) {
    const southernWorldPts = projectCorridorWaypoints(bhwPunLink.geometry);
    const southVecs = southernWorldPts.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]));
    southernCurve = new THREE.CatmullRomCurve3(southVecs, false, 'catmullrom', 0.2);
  }

  // Kasara Ghat Mudslide Alternate Bypass Curve (Bhiwandi -> Malshej -> Nashik)
  let bypassCurve = null;
  if (bhwNskLink && bhwNskLink.alternative_route) {
    const bypassWorldPts = projectCorridorWaypoints(bhwNskLink.alternative_route.geometry);
    const bypassVecs = bypassWorldPts.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]));
    bypassCurve = new THREE.CatmullRomCurve3(bypassVecs, false, 'catmullrom', 0.2);
  }

  // Full Detour Trajectory: JNPT -> Bhiwandi -> Kalyan -> Malshej Ghat -> Nashik
  let fullDetourWaypoints = [];
  let fullDetourCurve = null;
  if (jnptBhwLink && bhwNskLink && bhwNskLink.alternative_route) {
    fullDetourWaypoints = [...jnptBhwLink.geometry, ...bhwNskLink.alternative_route.geometry.slice(1)];
    const fullDetourWorldPts = projectCorridorWaypoints(fullDetourWaypoints);
    const fullDetourVecs = fullDetourWorldPts.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]));
    fullDetourCurve = new THREE.CatmullRomCurve3(fullDetourVecs, false, 'catmullrom', 0.2);
  }

  return {
    mainCorridorCurve,
    southernCurve,
    bypassCurve,
    fullDetourCurve,
    waypointCount: rawWaypoints.length,
    fullDetourWaypointCount: fullDetourWaypoints.length
  };
}

/**
 * Builds the extruded asphalt roadway ribbon with glowing traffic conduits.
 *
 * @param {THREE.Curve} curve - 3D Catmull-Rom spline curve
 * @param {Object} options
 * @returns {THREE.Group} Highway roadbed mesh group
 */
export function createExtrudedHighwayRibbon(curve, {
  roadWidth = 1.6,
  roadSegments = 240,
  glowColor = 0x00e5ff,
  shoulderColor = 0xff5400
} = {}) {
  const roadGroup = new THREE.Group();
  roadGroup.name = 'ExtrudedHighwayRibbon';

  // 1. Asphalt Roadbed (Extruded Tube / Ribbon)
  const roadbedGeo = new THREE.TubeGeometry(curve, roadSegments, roadWidth, 8, false);
  const roadbedMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
    metalness: 0.2
  });
  const roadbedMesh = new THREE.Mesh(roadbedGeo, roadbedMat);
  roadbedMesh.receiveShadow = true;
  roadGroup.add(roadbedMesh);

  // 2. Glowing Center Lane Conduit (Neon Cyan)
  const centerLaneGeo = new THREE.TubeGeometry(curve, roadSegments, 0.16, 6, false);
  const centerLaneMat = new THREE.MeshBasicMaterial({
    color: glowColor
  });
  const centerLaneMesh = new THREE.Mesh(centerLaneGeo, centerLaneMat);
  centerLaneMesh.position.y += roadWidth * 0.95;
  roadGroup.add(centerLaneMesh);

  // 3. Glowing Safety Shoulder Rails (Left and Right Safety Orange conduits)
  const shoulderOffset = roadWidth * 0.85;

  const leftShoulderGeo = new THREE.TubeGeometry(curve, roadSegments, 0.08, 6, false);
  const shoulderMat = new THREE.MeshBasicMaterial({
    color: shoulderColor,
    transparent: true,
    opacity: 0.85
  });

  const leftShoulder = new THREE.Mesh(leftShoulderGeo, shoulderMat);
  leftShoulder.position.set(-shoulderOffset * 0.4, roadWidth * 0.9, -shoulderOffset * 0.4);
  roadGroup.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(leftShoulderGeo, shoulderMat);
  rightShoulder.position.set(shoulderOffset * 0.4, roadWidth * 0.9, shoulderOffset * 0.4);
  roadGroup.add(rightShoulder);

  // Attach reference properties for route glowing
  roadGroup.centerLaneMesh = centerLaneMesh;
  roadGroup.centerLaneMat = centerLaneMat;
  roadGroup.leftShoulder = leftShoulder;
  roadGroup.rightShoulder = rightShoulder;

  return roadGroup;
}

/**
 * Creates dynamic glowing traffic flow pulses that travel continuously along the highway.
 *
 * @param {THREE.Curve} curve - Highway trajectory
 * @param {number} count - Number of traffic pulse packets
 * @returns {{ group: THREE.Group, pulses: Array<{ mesh: THREE.Mesh, offset: number, speed: number }> }}
 */
export function createTrafficPulses(curve, count = 9) {
  const group = new THREE.Group();
  group.name = 'HighwayTrafficPulses';
  const pulses = [];

  for (let i = 0; i < count; i++) {
    const isCyan = i % 2 === 0;
    const pulseGeo = new THREE.SphereGeometry(0.48, 12, 12);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: isCyan ? 0x00e5ff : 0xff5400,
      transparent: true,
      opacity: 0.95
    });
    const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    group.add(pulseMesh);

    pulses.push({
      mesh: pulseMesh,
      offset: i / count,
      speed: 0.08 + (i % 3) * 0.03
    });
  }

  return { group, pulses };
}

/**
 * Creates 3D Elevation Gradient Terrain Mesh for Kasara Ghat and Western Ghats.
 * Features steep mountain pass ascent, craggy topographical relief, and elevation contour grid.
 */
export function createKasaraElevationTerrain() {
  const group = new THREE.Group();
  group.name = 'WesternGhats_KasaraElevation';

  // Kasara Ghat Pass summit epicenter is at [14, 9.5, -24]
  const terrainGeo = new THREE.ConeGeometry(24, 13, 12, 5, true);
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x0b1329,
    roughness: 0.95,
    metalness: 0.15,
    flatShading: true
  });
  const mainSummit = new THREE.Mesh(terrainGeo, terrainMat);
  mainSummit.position.set(14, 3.5, -24);
  mainSummit.receiveShadow = true;
  group.add(mainSummit);

  // Glowing Topographical Contour Lines
  const contourGeo = new THREE.ConeGeometry(24.2, 13.2, 12, 5, true);
  const contourMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    wireframe: true,
    transparent: true,
    opacity: 0.3
  });
  const contourMesh = new THREE.Mesh(contourGeo, contourMat);
  contourMesh.position.set(14, 3.5, -24);
  group.add(contourMesh);

  // Western Ghats Adjoining Ridge 1 (Thal Ghat North Ridge)
  const ridge1Geo = new THREE.ConeGeometry(18, 10, 8, 3, true);
  const ridge1 = new THREE.Mesh(ridge1Geo, terrainMat);
  ridge1.position.set(24, 2.5, -34);
  group.add(ridge1);

  // Western Ghats Adjoining Ridge 2 (Bhor/Malshej Southern Flank)
  const ridge2Geo = new THREE.ConeGeometry(16, 8, 8, 3, true);
  const ridge2 = new THREE.Mesh(ridge2Geo, terrainMat);
  ridge2.position.set(6, 1.8, -14);
  group.add(ridge2);

  return group;
}

/**
 * Instantiates all 3D procedural logistics structures across the Western India corridor:
 * JNPT Port, Bhiwandi Central DC, Thane Hub, Kasara Ghat Pass, Nashik Agro Depot, and Pune FC.
 */
export function createCorridorLogisticsNodes(onSelectNode) {
  const group = new THREE.Group();
  group.name = 'CorridorLogisticsFacilities';
  const rings = [];
  const facilitiesMap = {};

  STAGE_FACILITIES.forEach((node) => {
    // 1. Procedural 3D Architectural Model
    const model = createFacilityNodeModel(node);
    group.add(model);

    // 2. Holographic Vertical Light Beam
    const beamGeo = new THREE.CylinderGeometry(0.15, 0.45, 18, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(node.color),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(node.pos[0], node.pos[1] + 9, node.pos[2]);
    group.add(beam);

    // 3. Pulsing Ground Ring Indicator
    const ringGeo = new THREE.RingGeometry(3.0, 3.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(node.color),
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(node.pos[0], node.pos[1] + 0.08, node.pos[2]);
    group.add(ringMesh);

    rings.push({ mesh: ringMesh, scale: 1, nodeId: node.id });
    facilitiesMap[node.id] = { model, beam, ringMesh, node };
  });

  return { group, rings, facilitiesMap };
}
