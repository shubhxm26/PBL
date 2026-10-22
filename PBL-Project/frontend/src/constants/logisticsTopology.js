/**
 * logisticsTopology.js
 * 
 * Authoritative WGS84 geospatial topology definitions for the Western India Logistics Corridor.
 * Includes nodes (JNPT, Bhiwandi, Thane, Nashik, Pune), highway corridors, bypass routes,
 * scenario disruption epicenters, camera presets, and stock capacity threshold logic.
 */

export const CORRIDOR_BOUNDS = {
  minLat: 18.0,
  maxLat: 20.5,
  minLon: 72.5,
  maxLon: 74.35
};

export const FACILITY_NODES = [
  {
    node_id: 'PORT-JNPT-01',
    name: 'JNPT Port Container Terminal',
    shortName: 'JNPT Port',
    city: 'Navi Mumbai',
    echelon_tier: 1,
    tier_label: 'Tier 1 Maritime Gateway',
    node_type: 'port',
    latitude: 18.9496,
    longitude: 72.9515,
    capacity_units: 500000,
    nominal_stock: 42000,
    daily_inflow_nominal: 6500,
    daily_demand_nominal: 5800,
    holding_cost_rate: 18.5,
    lead_time_days: 8.0,
    dock_doors: 14,
    handling_rate_units_hr: 4500,
    description: 'Primary maritime import gateway with multi-berth container handling and automated rail siding.',
    cameraPreset: {
      longitude: 72.9515,
      latitude: 18.9496,
      height: 3800,
      heading: 25,
      pitch: -35,
      roll: 0
    }
  },
  {
    node_id: 'DC-BHW-01',
    name: 'Bhiwandi Central DC',
    shortName: 'Bhiwandi DC',
    city: 'Bhiwandi',
    echelon_tier: 2,
    tier_label: 'Tier 2 Mega DC',
    node_type: 'central_dc',
    latitude: 19.2967,
    longitude: 73.0631,
    capacity_units: 250000,
    nominal_stock: 28500,
    daily_inflow_nominal: 5200,
    daily_demand_nominal: 4900,
    holding_cost_rate: 8.2,
    lead_time_days: 1.5,
    dock_doors: 28,
    handling_rate_units_hr: 3200,
    description: 'Mega distribution hub consolidating port freight for Maharashtra corridors and cross-docking.',
    cameraPreset: {
      longitude: 73.0631,
      latitude: 19.2967,
      height: 4200,
      heading: 345,
      pitch: -38,
      roll: 0
    }
  },
  {
    node_id: 'HUB-THN-01',
    name: 'Thane Regional Hub',
    shortName: 'Thane Hub',
    city: 'Thane',
    echelon_tier: 3,
    tier_label: 'Tier 3 Regional Hub',
    node_type: 'regional_hub',
    latitude: 19.2183,
    longitude: 72.9781,
    capacity_units: 85000,
    nominal_stock: 11200,
    daily_inflow_nominal: 1450,
    daily_demand_nominal: 1400,
    holding_cost_rate: 6.5,
    lead_time_days: 0.8,
    dock_doors: 12,
    handling_rate_units_hr: 1600,
    description: 'Suburban micro-hub serving Mumbai Metropolitan Region retail, dark stores, and FMCG clients.',
    cameraPreset: {
      longitude: 72.9781,
      latitude: 19.2183,
      height: 3200,
      heading: 15,
      pitch: -35,
      roll: 0
    }
  },
  {
    node_id: 'DEP-NSK-01',
    name: 'Nashik Agro Depot',
    shortName: 'Nashik Depot',
    city: 'Nashik',
    echelon_tier: 3,
    tier_label: 'Tier 3 Regional Depot',
    node_type: 'regional_depot',
    latitude: 19.9975,
    longitude: 73.7898,
    capacity_units: 95000,
    nominal_stock: 12800,
    daily_inflow_nominal: 1300,
    daily_demand_nominal: 1250,
    holding_cost_rate: 5.0,
    lead_time_days: 1.2,
    dock_doors: 10,
    handling_rate_units_hr: 1400,
    description: 'Northern agricultural and industrial transit depot accessed via the steep Kasara Ghat NH-160 corridor.',
    cameraPreset: {
      longitude: 73.7898,
      latitude: 19.9975,
      height: 4500,
      heading: 45,
      pitch: -38,
      roll: 0
    }
  },
  {
    node_id: 'FC-PUN-01',
    name: 'Pune Auto Fulfillment Center',
    shortName: 'Pune Center',
    city: 'Pune',
    echelon_tier: 3,
    tier_label: 'Tier 3 Auto FC',
    node_type: 'fulfillment_center',
    latitude: 18.5204,
    longitude: 73.8567,
    capacity_units: 150000,
    nominal_stock: 21500,
    daily_inflow_nominal: 2350,
    daily_demand_nominal: 2250,
    holding_cost_rate: 7.5,
    lead_time_days: 1.0,
    dock_doors: 20,
    handling_rate_units_hr: 2800,
    description: 'High-velocity automotive assembly and industrial components center fed via Mumbai-Pune Expressway.',
    cameraPreset: {
      longitude: 73.8567,
      latitude: 18.5204,
      height: 4800,
      heading: 190,
      pitch: -40,
      roll: 0
    }
  }
];

export const HIGHWAY_CORRIDORS = [
  {
    link_id: 'LINK-JNPT-BHW',
    source: 'PORT-JNPT-01',
    target: 'DC-BHW-01',
    corridor_name: 'JNPT-Bhiwandi Freight Expressway',
    highway_code: 'NH-348 / NH-48',
    distance_km: 64.5,
    nominal_transit_hours: 3.0,
    nominal_congestion: 18.5,
    capacity_trucks_per_day: 350,
    epicenter_coordinates: [18.9496, 72.9515],
    geometry: [
      [18.9496, 72.9515], // JNPT Port
      [18.9720, 72.9800], // Uran Bypass
      [19.0050, 73.0150], // Belapur CBD
      [19.0400, 72.9500], // Vashi Creek Bridge
      [19.1200, 72.9100], // Ghatkopar / Eastern Express
      [19.1750, 72.9500], // Mulund Check Naka
      [19.2183, 72.9781], // Thane Majhiwada
      [19.2550, 73.0100], // Kalwa
      [19.2967, 73.0631]  // Bhiwandi Central DC
    ],
    alternative_route: {
      name: 'Dighi / Coastal Rail Feeder Bypass',
      distance_km: 88.0,
      transit_hours: 4.8,
      description: 'Coastal freight rail bypass routing directly into Navi Mumbai dry terminals.',
      geometry: [
        [18.9496, 72.9515], // JNPT
        [18.8800, 72.9700], // Dighi feeder rail junction
        [18.9200, 73.0300], // Panvel Rail Logistics Siding
        [19.0800, 73.0900], // Taloja Industrial Feeder
        [19.1800, 73.1200], // Dombivli East Bypass
        [19.2967, 73.0631]  // Bhiwandi Central DC
      ]
    }
  },
  {
    link_id: 'LINK-BHW-THN',
    source: 'DC-BHW-01',
    target: 'HUB-THN-01',
    corridor_name: 'Bhiwandi-Thane Urban Spur',
    highway_code: 'Old Agra Road / SH-40',
    distance_km: 22.0,
    nominal_transit_hours: 1.5,
    nominal_congestion: 22.0,
    capacity_trucks_per_day: 200,
    epicenter_coordinates: [19.2550, 73.0200],
    geometry: [
      [19.2967, 73.0631], // Bhiwandi Central DC
      [19.2700, 73.0400], // Anjurphata
      [19.2450, 73.0100], // Balkum
      [19.2183, 72.9781]  // Thane Regional Hub
    ],
    alternative_route: {
      name: 'Ghodbunder Road Express Connector',
      distance_km: 31.0,
      transit_hours: 2.2,
      description: 'Peripheral arterial ring bypass skirting central municipal bottlenecks.',
      geometry: [
        [19.2967, 73.0631], // Bhiwandi Central DC
        [19.3200, 73.0100], // Kaman Bypass
        [19.2800, 72.9300], // Ghodbunder Road
        [19.2300, 72.9500], // Ovala
        [19.2183, 72.9781]  // Thane Regional Hub
      ]
    }
  },
  {
    link_id: 'LINK-BHW-NSK',
    source: 'DC-BHW-01',
    target: 'DEP-NSK-01',
    corridor_name: 'NH-160 Kasara Ghat Corridor',
    highway_code: 'NH-160',
    distance_km: 142.0,
    nominal_transit_hours: 4.5,
    nominal_congestion: 25.0,
    capacity_trucks_per_day: 180,
    epicenter_coordinates: [19.6967, 73.5611],
    geometry: [
      [19.2967, 73.0631], // Bhiwandi Central DC
      [19.3800, 73.1600], // Padgha Toll Plaza
      [19.4600, 73.2800], // Asangaon
      [19.5500, 73.4000], // Shahapur
      [19.6400, 73.5000], // Kasara Base
      [19.6967, 73.5611], // Kasara Ghat / Igatpuri Pass (Mudslide Epicenter)
      [19.7500, 73.6100], // Igatpuri Toll Plaza
      [19.8500, 73.6900], // Ghoti
      [19.9200, 73.7400], // Sinnar Phata
      [19.9975, 73.7898]  // Nashik Agro Depot
    ],
    alternative_route: {
      name: 'NH-61 via Malshej Ghat / SH-44 Feeder Bypass',
      distance_km: 195.0,
      transit_hours: 6.8,
      description: 'All-weather southern mountain pass bypass maintaining freight continuity when Kasara Ghat is closed.',
      geometry: [
        [19.2967, 73.0631], // Bhiwandi Central DC
        [19.2437, 73.1355], // Kalyan East Bypass
        [19.2500, 73.4000], // Murbad
        [19.3400, 73.7700], // Malshej Ghat Crest Pass
        [19.2600, 73.9800], // Otur
        [19.1800, 74.1200], // Alephata Junction
        [19.5700, 74.2100], // Sangamner Highway
        [19.8400, 73.9900], // Sinnar MIDC
        [19.9975, 73.7898]  // Nashik Agro Depot
      ]
    }
  },
  {
    link_id: 'LINK-BHW-PUN',
    source: 'DC-BHW-01',
    target: 'FC-PUN-01',
    corridor_name: 'Mumbai-Pune Expressway Viaduct Corridor',
    highway_code: 'Yashwantrao Chavan Expressway',
    distance_km: 158.0,
    nominal_transit_hours: 4.0,
    nominal_congestion: 20.0,
    capacity_trucks_per_day: 260,
    epicenter_coordinates: [18.7557, 73.4091],
    geometry: [
      [19.2967, 73.0631], // Bhiwandi Central DC
      [19.2183, 72.9781], // Thane
      [19.1000, 73.0100], // Navi Mumbai
      [18.9894, 73.1175], // Panvel Expressway Entry
      [18.9200, 73.2200], // Khalapur Toll Plaza
      [18.8400, 73.3100], // Khopoli
      [18.7557, 73.4091], // Lonavala / Khandala Bhor Ghat (Bridge Fracture Epicenter)
      [18.7100, 73.5500], // Talegaon Dabhade
      [18.6600, 73.6800], // Dehu Road
      [18.5913, 73.7389], // Hinjewadi IT Park
      [18.5204, 73.8567]  // Pune Auto Fulfillment Center
    ],
    alternative_route: {
      name: 'Old NH-48 Highway + Khopoli/Tamhini Secondary Bypass',
      distance_km: 178.0,
      transit_hours: 5.8,
      description: 'Parallel national highway alignment with dedicated night freight convoy windows.',
      geometry: [
        [19.2967, 73.0631], // Bhiwandi Central DC
        [19.1500, 73.1200], // Taloja Bypass
        [18.9894, 73.1175], // Panvel Old Highway
        [18.8800, 73.2800], // Chowk Old NH-48
        [18.7800, 73.3500], // Bhor Ghat Old Highway Alignment
        [18.7400, 73.4500], // Kamshet Bypass
        [18.6500, 73.6000], // Somatane Phata
        [18.5204, 73.8567]  // Pune Auto Fulfillment Center
      ]
    }
  }
];

export const SCENARIO_EPICENTERS = {
  port_strike: {
    id: 'port_strike',
    name: 'JNPT Port Container Terminal Gate',
    latitude: 18.9496,
    longitude: 72.9515,
    radius_meters: 3200,
    hazard_type: 'Labor Strike Gate Blockade',
    affected_links: ['LINK-JNPT-BHW'],
    bypass_corridor_id: 'LINK-JNPT-BHW'
  },
  monsoon_closures: {
    id: 'monsoon_closures',
    name: 'Kasara Ghat NH-160 Mudslide Epicenter',
    latitude: 19.6967,
    longitude: 73.5611,
    radius_meters: 4500,
    hazard_type: 'Extreme Torrential Mudslide',
    affected_links: ['LINK-BHW-NSK'],
    bypass_corridor_id: 'LINK-BHW-NSK'
  },
  bridge_failure: {
    id: 'bridge_failure',
    name: 'Khandala Expressway Viaduct Pier Fracture',
    latitude: 18.7557,
    longitude: 73.4091,
    radius_meters: 3800,
    hazard_type: 'Structural Pier Fracture',
    affected_links: ['LINK-BHW-PUN'],
    bypass_corridor_id: 'LINK-BHW-PUN'
  }
};

export const CAMERA_PRESETS = {
  CORRIDOR_OVERVIEW: {
    id: 'CORRIDOR_OVERVIEW',
    label: 'Corridor Overview',
    icon: 'Globe',
    longitude: 73.35,
    latitude: 19.25,
    height: 175000,
    heading: 355,
    pitch: -48,
    roll: 0,
    description: 'Strategic macro bird-eye view of the entire Western India logistics corridor.'
  },
  KASARA_GHAT: {
    id: 'KASARA_GHAT',
    label: 'Kasara Ghat Pass',
    icon: 'Mountain',
    longitude: 73.4912,
    latitude: 19.6975,
    height: 6500,
    heading: 40,
    pitch: -32,
    roll: 0,
    description: 'Mountain pass elevation on NH-160 subject to monsoon landslide shocks.'
  }
};

/**
 * Calculates stock capacity fill percentage and returns color and status.
 * Green >= 60%, Amber 30-59%, Red < 30%.
 */
export function getStockCapacityStatus(currentStock, capacityUnits) {
  const stock = Number(currentStock) || 0;
  const cap = Number(capacityUnits) || 1;
  const fillPct = Math.max(0, Math.min(100, Math.round((stock / cap) * 100)));

  if (fillPct >= 60) {
    return {
      fillPct,
      status: 'healthy',
      label: 'Optimal',
      hexColor: '#10b981', // Emerald
      cesiumColor: { red: 0.06, green: 0.72, blue: 0.51, alpha: 1.0 },
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300'
    };
  } else if (fillPct >= 30) {
    return {
      fillPct,
      status: 'stressed',
      label: 'Stressed',
      hexColor: '#f59e0b', // Amber
      cesiumColor: { red: 0.96, green: 0.62, blue: 0.04, alpha: 1.0 },
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-300'
    };
  } else {
    return {
      fillPct,
      status: 'critical',
      label: 'Critical',
      hexColor: '#ef4444', // Red
      cesiumColor: { red: 0.94, green: 0.27, blue: 0.27, alpha: 1.0 },
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300'
    };
  }
}

/**
 * Validates facility node schema compliance.
 */
export function validateNodeSchema(node) {
  const errors = [];
  if (!node.node_id || typeof node.node_id !== 'string') errors.push('Missing or invalid node_id');
  if (!node.name || typeof node.name !== 'string') errors.push('Missing or invalid name');
  if (typeof node.latitude !== 'number' || node.latitude < -90 || node.latitude > 90) {
    errors.push('Latitude out of WGS84 range (-90 to 90)');
  }
  if (typeof node.longitude !== 'number' || node.longitude < -180 || node.longitude > 180) {
    errors.push('Longitude out of WGS84 range (-180 to 180)');
  }
  if (typeof node.capacity_units !== 'number' || node.capacity_units <= 0) {
    errors.push('Capacity units must be a positive number');
  }
  if (!node.cameraPreset || typeof node.cameraPreset.height !== 'number') {
    errors.push('Missing camera preset');
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates highway corridor link schema compliance.
 */
export function validateLinkSchema(link) {
  const errors = [];
  if (!link.link_id || typeof link.link_id !== 'string') errors.push('Missing or invalid link_id');
  if (!link.source || typeof link.source !== 'string') errors.push('Missing or invalid source');
  if (!link.target || typeof link.target !== 'string') errors.push('Missing or invalid target');
  if (typeof link.distance_km !== 'number' || link.distance_km <= 0) {
    errors.push('Distance must be a positive number');
  }
  if (!Array.isArray(link.geometry) || link.geometry.length < 2) {
    errors.push('Geometry must contain at least 2 coordinate points');
  } else {
    for (let i = 0; i < link.geometry.length; i++) {
      const pt = link.geometry[i];
      if (!Array.isArray(pt) || pt.length < 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
        errors.push(`Invalid point at index ${i} in link ${link.link_id}`);
        break;
      }
    }
  }

  if (link.alternative_route) {
    const alt = link.alternative_route;
    if (!alt.name || typeof alt.name !== 'string') errors.push('Alternative route missing name');
    if (typeof alt.distance_km !== 'number' || alt.distance_km <= 0) errors.push('Alternative route distance invalid');
    if (!Array.isArray(alt.geometry) || alt.geometry.length < 2) {
      errors.push('Alternative route geometry must contain at least 2 coordinate points');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates shockwave epicenter schema compliance.
 */
export function validateEpicenterSchema(epicenter) {
  const errors = [];
  if (!epicenter.name || typeof epicenter.name !== 'string') errors.push('Missing or invalid epicenter name');
  if (typeof epicenter.latitude !== 'number' || epicenter.latitude < -90 || epicenter.latitude > 90) {
    errors.push('Epicenter latitude out of range');
  }
  if (typeof epicenter.longitude !== 'number' || epicenter.longitude < -180 || epicenter.longitude > 180) {
    errors.push('Epicenter longitude out of range');
  }
  if (typeof epicenter.radius_meters !== 'number' || epicenter.radius_meters <= 0) {
    errors.push('Radius meters must be a positive number');
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 2.5D / 3D Cyber-Tactical Schematic Vector Coordinates for Offline / Fallback Display.
 */
export const SCHEMATIC_COORDS = {
  'PORT-JNPT-01': { x: 220, y: 470, labelX: 220, labelY: 535 },
  'HUB-THN-01':   { x: 270, y: 350, labelX: 220, labelY: 335 },
  'DC-BHW-01':    { x: 440, y: 240, labelX: 440, labelY: 175 },
  'DEP-NSK-01':   { x: 770, y: 130, labelX: 770, labelY: 70 },
  'FC-PUN-01':    { x: 670, y: 550, labelX: 670, labelY: 620 }
};

export const SCHEMATIC_CORRIDOR_PATHS = {
  'LINK-JNPT-BHW': {
    path: 'M 220 470 C 240 410, 260 360, 270 350 C 310 320, 390 270, 440 240',
    bypassPath: 'M 220 470 C 320 480, 410 390, 440 240',
    mid: { x: 340, y: 330 }
  },
  'LINK-BHW-THN': {
    path: 'M 440 240 L 270 350',
    bypassPath: 'M 440 240 Q 320 280 270 350',
    mid: { x: 355, y: 295 }
  },
  'LINK-BHW-NSK': {
    path: 'M 440 240 Q 600 185 770 130',
    bypassPath: 'M 440 240 C 510 110, 680 90, 770 130',
    mid: { x: 600, y: 185 }
  },
  'LINK-BHW-PUN': {
    path: 'M 440 240 C 490 340, 580 460, 670 550',
    bypassPath: 'M 440 240 C 430 380, 540 540, 670 550',
    mid: { x: 550, y: 400 }
  }
};

export const SCHEMATIC_EPICENTERS = {
  port_strike: { x: 220, y: 470, label: 'JNPT Gate Strike Blockade' },
  monsoon_closures: { x: 600, y: 185, label: 'Kasara Ghat NH-160 Mudslide' },
  bridge_failure: { x: 550, y: 400, label: 'Khandala Viaduct Pier Fracture' }
};

