/**
 * proceduralModels.js
 *
 * Procedural 3D Logistics Models & Commercial Vehicle Generator for the Three.js Stage.
 * Constructs detailed architectural models for:
 *   - JNPT Port Container Terminal (STS Gantry Cranes, Container Stacks, Berth Basin)
 *   - Bhiwandi Central DC (Mega DC, Loading Docks, Solar Roof, Staged Trucks)
 *   - Thane Regional Hub (Cross-Dock Facility, 5G Telemetry Mast, Fleet Canopy)
 *   - Kasara Ghat Mountain Pass (Western Ghats Elevation Terrain, Viaduct, Hazard Beacons)
 *   - Nashik Agro Depot (Agro-Industrial Silos, Cold Storage, Grain Elevator)
 *   - Pune Auto Fulfillment Center (Automotive Assembly Hangar, EV Charging Gantry)
 *   - Articulated Commercial Freight Truck (Spinning Wheels, Dynamic Headlights, Cold-Chain Beacon)
 */

import * as THREE from 'three';

// Shared Materials Palette for optimal WebGL performance and GPU batching
const SHARED_MATERIALS = {
  concrete: new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.15
  }),
  asphalt: new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.9,
    metalness: 0.1
  }),
  steelDark: new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.7
  }),
  steelLight: new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.8
  }),
  craneOrange: new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.35,
    metalness: 0.6
  }),
  craneYellow: new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.4,
    metalness: 0.5
  }),
  waterBasin: new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.2,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85
  }),
  solarGlass: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.1,
    metalness: 0.9
  }),
  hazardAmber: new THREE.MeshBasicMaterial({
    color: 0xf59e0b
  }),
  neonCyan: new THREE.MeshBasicMaterial({
    color: 0x00e5ff
  }),
  neonEmerald: new THREE.MeshBasicMaterial({
    color: 0x10b981
  }),
  beaconRed: new THREE.MeshBasicMaterial({
    color: 0xef4444
  })
};

/**
 * Attaches user metadata recursively to mesh and children for raycasting.
 */
function tagFacilityMesh(group, nodeId, code, name) {
  group.userData = { isFacility: true, nodeId, code, name };
  group.traverse((child) => {
    if (child.isMesh) {
      child.userData = { isFacility: true, nodeId, code, name };
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

/**
 * 1. JNPT Port Container Terminal Model
 * Features dual STS container cranes, stacks of intermodal freight containers, and berth wharf.
 */
export function createJNPTPortModel(node) {
  const group = new THREE.Group();
  group.position.set(...node.pos);

  // Wharf Apron / Concrete Pier Base
  const wharfGeo = new THREE.BoxGeometry(24, 0.8, 20);
  const wharfMesh = new THREE.Mesh(wharfGeo, SHARED_MATERIALS.concrete);
  wharfMesh.position.set(0, 0.4, 0);
  group.add(wharfMesh);

  // Water Basin Plane on seaward side (-X)
  const waterGeo = new THREE.PlaneGeometry(16, 22);
  const waterMesh = new THREE.Mesh(waterGeo, SHARED_MATERIALS.waterBasin);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(-14, 0.15, 0);
  group.add(waterMesh);

  // Container Ship Hull Silhouette at berth
  const shipGeo = new THREE.BoxGeometry(8, 2.5, 18);
  const shipMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.7 });
  const shipMesh = new THREE.Mesh(shipGeo, shipMat);
  shipMesh.position.set(-14, 1.2, 0);
  group.add(shipMesh);

  // Helper to build a Ship-to-Shore (STS) Gantry Crane
  const buildCrane = (zOffset) => {
    const craneGroup = new THREE.Group();
    craneGroup.position.set(-8, 0.8, zOffset);

    // 4 A-frame legs
    const legGeo = new THREE.CylinderGeometry(0.18, 0.25, 10, 8);
    const legPositions = [
      [-1.8, 5, -1.8],
      [1.8, 5, -1.8],
      [-1.8, 5, 1.8],
      [1.8, 5, 1.8]
    ];
    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, SHARED_MATERIALS.craneOrange);
      leg.position.set(x, y, z);
      craneGroup.add(leg);
    });

    // Overhead Trolley Machinery House
    const houseGeo = new THREE.BoxGeometry(4.2, 2.0, 4.2);
    const houseMesh = new THREE.Mesh(houseGeo, SHARED_MATERIALS.craneYellow);
    houseMesh.position.set(0, 10.5, 0);
    craneGroup.add(houseMesh);

    // Horizontal Boom extending over water
    const boomGeo = new THREE.BoxGeometry(16, 0.6, 1.2);
    const boomMesh = new THREE.Mesh(boomGeo, SHARED_MATERIALS.craneOrange);
    boomMesh.position.set(-4, 11.2, 0);
    craneGroup.add(boomMesh);

    // Hoist Cable & Suspended Spreader Bar
    const cableGeo = new THREE.CylinderGeometry(0.04, 0.04, 4.5);
    const cableMesh = new THREE.Mesh(cableGeo, SHARED_MATERIALS.steelLight);
    cableMesh.position.set(-8, 8.8, 0);
    craneGroup.add(cableMesh);

    // Hoisted 40ft Container in mid-air
    const containerGeo = new THREE.BoxGeometry(1.6, 1.5, 4.0);
    const containerMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.3, metalness: 0.4 });
    const hoistedCont = new THREE.Mesh(containerGeo, containerMat);
    hoistedCont.position.set(-8, 6.2, 0);
    craneGroup.add(hoistedCont);

    return craneGroup;
  };

  group.add(buildCrane(-5));
  group.add(buildCrane(5));

  // Multi-tier Stacks of 20ft & 40ft Shipping Containers
  const containerColors = [0x0284c7, 0xea580c, 0x16a34a, 0x94a3b8, 0xd97706, 0xdc2626];
  const contGeo = new THREE.BoxGeometry(1.8, 1.5, 4.2);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const heightTiers = ((row + col) % 3) + 1;
      for (let h = 0; h < heightTiers; h++) {
        const mat = new THREE.MeshStandardMaterial({
          color: containerColors[(row * 3 + col + h) % containerColors.length],
          roughness: 0.4,
          metalness: 0.3
        });
        const box = new THREE.Mesh(contGeo, mat);
        box.position.set(3 + col * 2.3, 0.8 + 0.75 + h * 1.55, -6 + row * 4.8);
        group.add(box);
      }
    }
  }

  return tagFacilityMesh(group, node.id, node.code, node.name);
}

/**
 * 2. Bhiwandi Central DC Model
 * Features a massive distribution warehouse, sawtooth roof skylights with solar panels,
 * active loading dock bays, and staged freight trucks.
 */
export function createBhiwandiDCModel(node) {
  const group = new THREE.Group();
  group.position.set(...node.pos);

  // Concrete DC Apron / Logistics Yard
  const yardGeo = new THREE.BoxGeometry(26, 0.4, 22);
  const yardMesh = new THREE.Mesh(yardGeo, SHARED_MATERIALS.asphalt);
  yardMesh.position.set(0, 0.2, 0);
  group.add(yardMesh);

  // Main Mega Distribution Center Warehouse Body
  const mainHubGeo = new THREE.BoxGeometry(16, 5.0, 18);
  const mainHubMesh = new THREE.Mesh(mainHubGeo, SHARED_MATERIALS.concrete);
  mainHubMesh.position.set(3, 2.7, 0);
  group.add(mainHubMesh);

  // Sawtooth Roof Skylights & Solar Photovoltaic Arrays
  for (let i = -6; i <= 6; i += 3) {
    const roofSawGeo = new THREE.BoxGeometry(14, 0.8, 2.2);
    const roofSaw = new THREE.Mesh(roofSawGeo, SHARED_MATERIALS.solarGlass);
    roofSaw.position.set(3, 5.4, i);
    roofSaw.rotation.x = 0.25;
    group.add(roofSaw);
  }

  // Recessed Loading Dock Bays (Front face at x = -5)
  const dockDoorGeo = new THREE.BoxGeometry(0.3, 2.6, 2.0);
  const dockDoorMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
  for (let z = -6.5; z <= 6.5; z += 2.8) {
    const door = new THREE.Mesh(dockDoorGeo, dockDoorMat);
    door.position.set(-5.1, 1.7, z);
    group.add(door);

    // Hazard yellow dock canopy light
    const dockLightGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const dockLight = new THREE.Mesh(dockLightGeo, SHARED_MATERIALS.hazardAmber);
    dockLight.position.set(-5.3, 3.2, z);
    group.add(dockLight);
  }

  // Docked Semi-Trailers in Bay
  const trailerGeo = new THREE.BoxGeometry(5.2, 2.4, 1.9);
  const trailerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.3 });

  const parked1 = new THREE.Mesh(trailerGeo, trailerMat);
  parked1.position.set(-8.0, 1.6, -3.7);
  group.add(parked1);

  const parked2 = new THREE.Mesh(trailerGeo, trailerMat);
  parked2.position.set(-8.0, 1.6, 4.7);
  group.add(parked2);

  // High-mast yard floodlight tower
  const mastGeo = new THREE.CylinderGeometry(0.12, 0.2, 10, 8);
  const mast = new THREE.Mesh(mastGeo, SHARED_MATERIALS.steelLight);
  mast.position.set(-10, 5, -8);
  group.add(mast);

  const floodlightGeo = new THREE.SphereGeometry(0.4, 8, 8);
  const floodlight = new THREE.Mesh(floodlightGeo, SHARED_MATERIALS.neonCyan);
  floodlight.position.set(-10, 10, -8);
  group.add(floodlight);

  return tagFacilityMesh(group, node.id, node.code, node.name);
}

/**
 * 3. Thane Regional Hub Model
 * Features suburban cross-dock terminal, lattice 5G/IoT communications tower, and fleet dispatch canopy.
 */
export function createThaneHubModel(node) {
  const group = new THREE.Group();
  group.position.set(...node.pos);

  // Base platform
  const baseGeo = new THREE.BoxGeometry(18, 0.4, 16);
  const baseMesh = new THREE.Mesh(baseGeo, SHARED_MATERIALS.concrete);
  baseMesh.position.set(0, 0.2, 0);
  group.add(baseMesh);

  // Primary Cross-Dock Facility
  const hubGeo = new THREE.BoxGeometry(10, 3.8, 12);
  const hubMesh = new THREE.Mesh(hubGeo, SHARED_MATERIALS.steelDark);
  hubMesh.position.set(-2, 2.1, 0);
  group.add(hubMesh);

  // Fleet Parking Canopy Structure
  const canopyRoofGeo = new THREE.BoxGeometry(6, 0.2, 10);
  const canopyRoof = new THREE.Mesh(canopyRoofGeo, SHARED_MATERIALS.solarGlass);
  canopyRoof.position.set(5, 3.2, 0);
  group.add(canopyRoof);

  const canopyPillarGeo = new THREE.CylinderGeometry(0.1, 0.1, 3.0, 6);
  [[-1.8, -4], [-1.8, 4], [1.8, -4], [1.8, 4]].forEach(([px, pz]) => {
    const pillar = new THREE.Mesh(canopyPillarGeo, SHARED_MATERIALS.steelLight);
    pillar.position.set(5 + px, 1.5, pz);
    group.add(pillar);
  });

  // Tall 5G / IoT Communications Tower
  const towerGeo = new THREE.CylinderGeometry(0.15, 0.6, 14, 4);
  const tower = new THREE.Mesh(towerGeo, SHARED_MATERIALS.steelLight);
  tower.position.set(-5, 7.2, -5);
  group.add(tower);

  // Blinking Red Aviation Beacon on top of tower
  const beaconGeo = new THREE.SphereGeometry(0.28, 8, 8);
  const beacon = new THREE.Mesh(beaconGeo, SHARED_MATERIALS.beaconRed);
  beacon.position.set(-5, 14.3, -5);
  group.add(beacon);

  return tagFacilityMesh(group, node.id, node.code, node.name);
}

/**
 * 4. Kasara Ghat Mountain Pass Model & Western Ghats Terrain
 * Procedural mountain topography mesh displaying Western Ghats elevation gradient,
 * highway viaduct bridge pillars, and hazard warning beacons.
 */
export function createKasaraPassModel(node) {
  const group = new THREE.Group();
  group.position.set(...node.pos);

  // High-elevation mountain terrain crags
  const terrainGeo = new THREE.ConeGeometry(22, 11, 10, 4, true);
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.95,
    metalness: 0.1,
    flatShading: true
  });
  const mainPeak = new THREE.Mesh(terrainGeo, terrainMat);
  mainPeak.position.set(0, -2.5, 0);
  group.add(mainPeak);

  // Wireframe elevation contour overlay
  const wireGeo = new THREE.ConeGeometry(22.2, 11.2, 10, 4, true);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    wireframe: true,
    transparent: true,
    opacity: 0.35
  });
  const wireMesh = new THREE.Mesh(wireGeo, wireMat);
  wireMesh.position.set(0, -2.5, 0);
  group.add(wireMesh);

  // Secondary Mountain Ridge
  const ridgeGeo = new THREE.ConeGeometry(16, 8.5, 8, 3, true);
  const ridgeMesh = new THREE.Mesh(ridgeGeo, terrainMat);
  ridgeMesh.position.set(10, -4.0, -8);
  group.add(ridgeMesh);

  // Viaduct Elevated Highway Bridge Pillars Supporting Roadbed
  const pillarGeo = new THREE.CylinderGeometry(0.7, 0.9, 10, 8);
  for (let z = -10; z <= 10; z += 6) {
    const bridgePillar = new THREE.Mesh(pillarGeo, SHARED_MATERIALS.concrete);
    bridgePillar.position.set(0, -5, z);
    group.add(bridgePillar);
  }

  // Mudslide Warning / Hazard Beacons along hairpin switchback
  const hazardLightGeo = new THREE.SphereGeometry(0.35, 12, 12);
  const beacon1 = new THREE.Mesh(hazardLightGeo, SHARED_MATERIALS.hazardAmber);
  beacon1.position.set(-3, 1.2, -6);
  group.add(beacon1);

  const beacon2 = new THREE.Mesh(hazardLightGeo, SHARED_MATERIALS.hazardAmber);
  beacon2.position.set(3, 1.2, 6);
  group.add(beacon2);

  // Mountain Pass Checkpoint Shelter
  const shelterGeo = new THREE.BoxGeometry(3.5, 2.2, 4.5);
  const shelter = new THREE.Mesh(shelterGeo, SHARED_MATERIALS.steelDark);
  shelter.position.set(5, 1.1, 0);
  group.add(shelter);

  return tagFacilityMesh(group, node.id, node.code, node.name);
}

/**
 * 5. Nashik Agro Depot Model
 * Features cylindrical grain/agro storage silos, cold-storage refrigerated warehouse,
 * and rail bulk grain loading hopper.
 */
export function createNashikDepotModel(node) {
  const group = new THREE.Group();
  group.position.set(...node.pos);

  // Depot Concrete Apron Base
  const baseGeo = new THREE.BoxGeometry(22, 0.4, 20);
  const baseMesh = new THREE.Mesh(baseGeo, SHARED_MATERIALS.concrete);
  baseMesh.position.set(0, 0.2, 0);
  group.add(baseMesh);

  // Cluster of 3 Large Galvanized Agro Silos
  const siloRadius = 2.4;
  const siloHeight = 7.5;
  const siloGeo = new THREE.CylinderGeometry(siloRadius, siloRadius, siloHeight, 20);
  const siloCapGeo = new THREE.ConeGeometry(siloRadius * 1.05, 1.6, 20);

  const siloPositions = [
    [-5, siloHeight / 2 + 0.4, -4],
    [-5, siloHeight / 2 + 0.4, 4],
    [-9.5, siloHeight / 2 + 0.4, 0]
  ];

  siloPositions.forEach(([sx, sy, sz]) => {
    const siloBody = new THREE.Mesh(siloGeo, SHARED_MATERIALS.steelLight);
    siloBody.position.set(sx, sy, sz);
    group.add(siloBody);

    const siloCap = new THREE.Mesh(siloCapGeo, SHARED_MATERIALS.steelDark);
    siloCap.position.set(sx, sy + siloHeight / 2 + 0.8, sz);
    group.add(siloCap);
  });

  // Catwalk Connecting Silos
  const catwalkGeo = new THREE.BoxGeometry(6, 0.15, 8.5);
  const catwalk = new THREE.Mesh(catwalkGeo, SHARED_MATERIALS.steelDark);
  catwalk.position.set(-6.5, siloHeight + 0.6, 0);
  group.add(catwalk);

  // Climate-Controlled Cold Storage Warehouse Building
  const coldStorageGeo = new THREE.BoxGeometry(9.0, 4.2, 14.0);
  const coldStorageMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.6
  });
  const coldStorage = new THREE.Mesh(coldStorageGeo, coldStorageMat);
  coldStorage.position.set(4.5, 2.3, 0);
  group.add(coldStorage);

  // Rooftop Refrigerated Chiller Units (Emissive Cyan Glow)
  for (let z = -4; z <= 4; z += 4) {
    const chillerGeo = new THREE.BoxGeometry(2.0, 1.2, 2.0);
    const chillerMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.5
    });
    const chiller = new THREE.Mesh(chillerGeo, chillerMat);
    chiller.position.set(4.5, 4.8, z);
    group.add(chiller);
  }

  return tagFacilityMesh(group, node.id, node.code, node.name);
}

/**
 * 6. Pune Auto Fulfillment Center Model
 * Features high-tech automotive manufacturing hangar, auto-carrier dock, and EV heavy charging gantry.
 */
export function createPuneFCModel(node) {
  const group = new THREE.Group();
  group.position.set(...node.pos);

  // Base platform
  const baseGeo = new THREE.BoxGeometry(22, 0.4, 20);
  const baseMesh = new THREE.Mesh(baseGeo, SHARED_MATERIALS.asphalt);
  baseMesh.position.set(0, 0.2, 0);
  group.add(baseMesh);

  // High-Tech Automotive Fulfillment Assembly Hangar
  const hangarGeo = new THREE.BoxGeometry(14, 4.8, 14);
  const hangar = new THREE.Mesh(hangarGeo, SHARED_MATERIALS.concrete);
  hangar.position.set(-2, 2.6, 0);
  group.add(hangar);

  // Angular Blue Glass Clerestory Skylights
  const glassRoofGeo = new THREE.BoxGeometry(12, 1.0, 12);
  const glassRoof = new THREE.Mesh(glassRoofGeo, SHARED_MATERIALS.solarGlass);
  glassRoof.position.set(-2, 5.2, 0);
  group.add(glassRoof);

  // High-Voltage EV Heavy Charging Gantry Station
  const gantryArchGeo = new THREE.BoxGeometry(4.5, 0.4, 8.0);
  const gantryArch = new THREE.Mesh(gantryArchGeo, SHARED_MATERIALS.steelLight);
  gantryArch.position.set(7.5, 3.8, 0);
  group.add(gantryArch);

  // Neon EV Pulse Conduit
  const evPulseGeo = new THREE.CylinderGeometry(0.12, 0.12, 7.8);
  const evPulse = new THREE.Mesh(evPulseGeo, SHARED_MATERIALS.neonEmerald);
  evPulse.rotation.x = Math.PI / 2;
  evPulse.position.set(7.5, 3.8, 0);
  group.add(evPulse);

  return tagFacilityMesh(group, node.id, node.code, node.name);
}

/**
 * Factory dispatch mapping node codes to procedural 3D models.
 */
export function createFacilityNodeModel(node) {
  switch (node.code) {
    case 'JNPT':
      return createJNPTPortModel(node);
    case 'BHIWANDI':
      return createBhiwandiDCModel(node);
    case 'THANE':
      return createThaneHubModel(node);
    case 'KASARA':
      return createKasaraPassModel(node);
    case 'NASHIK':
      return createNashikDepotModel(node);
    case 'PUNE':
      return createPuneFCModel(node);
    default:
      return createBhiwandiDCModel(node);
  }
}

/**
 * 7. Commercial Freight Vehicle (Truck) Generator
 * Constructs an articulated commercial tractor-trailer with:
 *   - Aerodynamic heavy tractor cab
 *   - Insulated cold-chain freight trailer
 *   - 6 functional spinning rubber wheels
 *   - Forward dynamic headlights with volumetric light cones
 *   - Floating cold-chain status beacon
 */
export function createProceduralTruck({
  vehicleId = 'TRK-MH-01',
  cabColor = 0xff5400, // Safety Orange
  trailerColor = 0xf8fafc,
  beaconColor = 0x10b981
} = {}) {
  const truckGroup = new THREE.Group();
  truckGroup.name = 'CommercialVehicle_Truck';
  truckGroup.userData = { isVehicle: true, vehicleId };

  // 1. Trailer Box (Insulated Composite)
  const trailerGeo = new THREE.BoxGeometry(2.3, 2.7, 6.2);
  const trailerMat = new THREE.MeshStandardMaterial({
    color: trailerColor,
    roughness: 0.25,
    metalness: 0.35
  });
  const trailerMesh = new THREE.Mesh(trailerGeo, trailerMat);
  trailerMesh.position.set(0, 2.0, -1.0);
  trailerMesh.castShadow = true;
  trailerMesh.receiveShadow = true;
  truckGroup.add(trailerMesh);

  // Rear Underride Guard & Red Tail Lamps
  const rearBumperGeo = new THREE.BoxGeometry(2.3, 0.3, 0.2);
  const rearBumper = new THREE.Mesh(rearBumperGeo, SHARED_MATERIALS.steelDark);
  rearBumper.position.set(0, 0.7, -4.1);
  truckGroup.add(rearBumper);

  const tailLampGeo = new THREE.BoxGeometry(0.5, 0.18, 0.08);
  const tailLampMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.8
  });
  const tailLampL = new THREE.Mesh(tailLampGeo, tailLampMat);
  tailLampL.position.set(-0.8, 0.75, -4.18);
  truckGroup.add(tailLampL);

  const tailLampR = new THREE.Mesh(tailLampGeo, tailLampMat);
  tailLampR.position.set(0.8, 0.75, -4.18);
  truckGroup.add(tailLampR);

  // 2. Tractor Cab
  const cabGeo = new THREE.BoxGeometry(2.2, 2.3, 2.6);
  const cabMat = new THREE.MeshStandardMaterial({
    color: cabColor,
    roughness: 0.2,
    metalness: 0.6
  });
  const cabMesh = new THREE.Mesh(cabGeo, cabMat);
  cabMesh.position.set(0, 1.7, 3.1);
  cabMesh.castShadow = true;
  cabMesh.receiveShadow = true;
  truckGroup.add(cabMesh);

  // Windshield (Dark Tinted Cyber Glass)
  const windshieldGeo = new THREE.BoxGeometry(2.0, 1.1, 0.15);
  const windshieldMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.95
  });
  const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
  windshield.position.set(0, 2.2, 4.42);
  truckGroup.add(windshield);

  // Aerodynamic Cab Roof Wind Deflector
  const deflectorGeo = new THREE.BoxGeometry(2.1, 0.5, 1.8);
  const deflector = new THREE.Mesh(deflectorGeo, cabMat);
  deflector.position.set(0, 3.0, 2.9);
  truckGroup.add(deflector);

  // Front Radiator Grille
  const grilleGeo = new THREE.BoxGeometry(1.6, 0.9, 0.1);
  const grille = new THREE.Mesh(grilleGeo, SHARED_MATERIALS.steelDark);
  grille.position.set(0, 1.1, 4.42);
  truckGroup.add(grille);

  // 3. Functional Spinning Rubber Wheels (6 wheels: 2 steer, 4 tandem rear)
  const wheelRadius = 0.52;
  const wheelThickness = 0.38;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 18);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.9,
    metalness: 0.1
  });
  const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, wheelThickness + 0.02, 12);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.9
  });

  const wheelPositions = [
    // Front Steer Axle (Cab)
    [-1.15, wheelRadius, 3.4],
    [1.15, wheelRadius, 3.4],
    // Mid Drive Axle
    [-1.15, wheelRadius, -0.6],
    [1.15, wheelRadius, -0.6],
    // Rear Drive Axle
    [-1.15, wheelRadius, -2.6],
    [1.15, wheelRadius, -2.6]
  ];

  const wheelMeshes = [];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelAssembly = new THREE.Group();
    wheelAssembly.position.set(wx, wy, wz);

    // Cylinder default is along Y; rotate to X for wheel axle
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelAssembly.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelAssembly.add(rim);

    truckGroup.add(wheelAssembly);
    wheelMeshes.push(wheelAssembly);
  });

  // 4. Forward Dynamic Headlights with Volumetric Cones
  const headlightBeamGeo = new THREE.ConeGeometry(1.8, 12, 16, 1, true);
  const headlightBeamMat = new THREE.MeshBasicMaterial({
    color: 0xfff3b0,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  const headlightL = new THREE.Mesh(headlightBeamGeo, headlightBeamMat);
  headlightL.rotation.x = Math.PI / 2;
  headlightL.position.set(-0.75, 1.1, 10.4);
  truckGroup.add(headlightL);

  const headlightR = headlightL.clone();
  headlightR.position.x = 0.75;
  truckGroup.add(headlightR);

  // SpotLight casting real illumination on asphalt
  const spotLight = new THREE.SpotLight(0xfff3b0, 4.5, 45, Math.PI / 5, 0.4, 1.2);
  spotLight.position.set(0, 1.3, 4.4);
  spotLight.target.position.set(0, 0, 25);
  truckGroup.add(spotLight);
  truckGroup.add(spotLight.target);

  // 5. Floating Cold-Chain Telemetry Status Badge
  const beaconGroup = new THREE.Group();
  beaconGroup.position.set(0, 3.8, -1.0);

  // Pulsing Core Sphere
  const beaconCoreGeo = new THREE.SphereGeometry(0.32, 16, 16);
  const beaconCoreMat = new THREE.MeshBasicMaterial({ color: beaconColor });
  const beaconCore = new THREE.Mesh(beaconCoreGeo, beaconCoreMat);
  beaconGroup.add(beaconCore);

  // Holographic Outer Ring
  const beaconRingGeo = new THREE.RingGeometry(0.48, 0.62, 24);
  const beaconRingMat = new THREE.MeshBasicMaterial({
    color: beaconColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
  beaconRing.rotation.x = -Math.PI / 2;
  beaconGroup.add(beaconRing);

  truckGroup.add(beaconGroup);

  // Attach reference properties for animation loops
  truckGroup.wheelMeshes = wheelMeshes;
  truckGroup.beaconGroup = beaconGroup;
  truckGroup.beaconCore = beaconCore;
  truckGroup.beaconRing = beaconRing;

  // Tag all sub-meshes for raycaster hit detection
  truckGroup.traverse((child) => {
    if (child.isMesh) {
      child.userData = { isVehicle: true, vehicleId };
    }
  });

  return truckGroup;
}

/**
 * 8. 3D Procedural Roadblock Barricade & Hazard Warning Beacons
 * Renders concrete Jersey bases, chevron striped hazard crossbars,
 * road closure warning placard, traffic cones, and flashing emergency strobe beacons.
 *
 * @param {Object} [options]
 * @param {Array<number>} [options.pos=[14, 9.8, -24]]
 * @param {number} [options.rotationY=0.4]
 * @returns {THREE.Group}
 */
export function createRoadblockBarricade({
  pos = [14, 9.8, -24],
  rotationY = 0.45
} = {}) {
  const group = new THREE.Group();
  group.name = 'RoadblockBarricade_Kasara';
  group.position.set(pos[0], pos[1], pos[2]);
  group.rotation.y = rotationY;
  group.userData = { isRoadblock: true, roadblockId: 'RB-KASARA-01', incidentId: 'INC-KASARA-01' };

  // Concrete Jersey Barriers Base
  const barrierGeo = new THREE.BoxGeometry(4.2, 0.9, 0.7);
  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.8,
    metalness: 0.2
  });
  const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
  barrierMesh.position.set(0, 0.45, 0);
  barrierMesh.castShadow = true;
  barrierMesh.receiveShadow = true;
  group.add(barrierMesh);

  // Chevron Striped Warning Plate (Reflective Safety Amber & Red)
  const chevronGeo = new THREE.BoxGeometry(4.4, 0.45, 0.12);
  const chevronMat = new THREE.MeshStandardMaterial({
    color: 0xff1744, // Bright hazard red
    roughness: 0.3,
    metalness: 0.5,
    emissive: 0x7f0000,
    emissiveIntensity: 0.5
  });
  const upperChevron = new THREE.Mesh(chevronGeo, chevronMat);
  upperChevron.position.set(0, 1.45, 0);
  group.add(upperChevron);

  const lowerChevronMat = new THREE.MeshStandardMaterial({
    color: 0xffb703, // Safety amber
    roughness: 0.3,
    metalness: 0.5,
    emissive: 0xb45309,
    emissiveIntensity: 0.4
  });
  const lowerChevron = new THREE.Mesh(chevronGeo, lowerChevronMat);
  lowerChevron.position.set(0, 0.95, 0);
  group.add(lowerChevron);

  // Steel Support Uprights
  const uprightGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8);
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.8
  });

  const uprightL = new THREE.Mesh(uprightGeo, steelMat);
  uprightL.position.set(-1.8, 0.9, 0);
  group.add(uprightL);

  const uprightR = new THREE.Mesh(uprightGeo, steelMat);
  uprightR.position.set(1.8, 0.9, 0);
  group.add(uprightR);

  // Road Closure Warning Sign Board
  const signBoardGeo = new THREE.BoxGeometry(2.4, 0.75, 0.08);
  const signBoardMat = new THREE.MeshStandardMaterial({
    color: 0xd97706, // Deep amber orange
    roughness: 0.4,
    metalness: 0.3
  });
  const signBoard = new THREE.Mesh(signBoardGeo, signBoardMat);
  signBoard.position.set(0, 2.05, 0);
  group.add(signBoard);

  // Sign text border outline
  const signBorderGeo = new THREE.BoxGeometry(2.5, 0.85, 0.04);
  const signBorderMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const signBorder = new THREE.Mesh(signBorderGeo, signBorderMat);
  signBorder.position.set(0, 2.05, -0.03);
  group.add(signBorder);

  // Flashing Emergency Strobe Hazard Beacons (Left & Right)
  const beaconDomeGeo = new THREE.SphereGeometry(0.22, 12, 12);
  const beaconAmberMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24
  });
  const beaconRedMat = new THREE.MeshBasicMaterial({
    color: 0xef4444
  });

  const beaconLeft = new THREE.Mesh(beaconDomeGeo, beaconAmberMat);
  beaconLeft.position.set(-1.8, 1.95, 0);
  group.add(beaconLeft);

  const beaconRight = new THREE.Mesh(beaconDomeGeo, beaconRedMat);
  beaconRight.position.set(1.8, 1.95, 0);
  group.add(beaconRight);

  // Dynamic Strobe Point Light (illuminates road and surroundings)
  const strobeLight = new THREE.PointLight(0xff5400, 3.5, 24, 1.2);
  strobeLight.position.set(0, 2.2, 0.5);
  strobeLight.castShadow = true;
  group.add(strobeLight);

  // Reflective Traffic Cones
  const coneGeo = new THREE.ConeGeometry(0.3, 0.85, 12);
  const coneMat = new THREE.MeshStandardMaterial({
    color: 0xff5400,
    roughness: 0.5,
    metalness: 0.2
  });
  const coneStripeGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.2, 12);
  const coneStripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const conePositions = [
    [-2.6, 0.42, 1.8],
    [-1.2, 0.42, 2.8],
    [1.2, 0.42, 2.8],
    [2.6, 0.42, 1.8]
  ];

  conePositions.forEach(([cx, cy, cz]) => {
    const coneGroup = new THREE.Group();
    coneGroup.position.set(cx, cy, cz);

    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.castShadow = true;
    coneGroup.add(cone);

    const stripe = new THREE.Mesh(coneStripeGeo, coneStripeMat);
    stripe.position.y = 0.05;
    coneGroup.add(stripe);

    group.add(coneGroup);
  });

  // Attach dynamic animation controller
  group.beacons = [beaconLeft, beaconRight];
  group.strobeLight = strobeLight;
  group.update = (time) => {
    // Alternating sharp flash pattern (police/hazard strobe)
    const flash = Math.sin(time * 0.012) > 0.1;
    strobeLight.intensity = flash ? 4.5 : 0.4;
    beaconLeft.scale.setScalar(flash ? 1.35 : 0.85);
    beaconRight.scale.setScalar(flash ? 0.85 : 1.35);
  };

  // Tag all roadblock child meshes for raycasting hit detection
  group.traverse((child) => {
    if (child.isMesh) {
      child.userData = { isRoadblock: true, roadblockId: 'RB-KASARA-01', incidentId: 'INC-KASARA-01' };
    }
  });

  return group;
}

