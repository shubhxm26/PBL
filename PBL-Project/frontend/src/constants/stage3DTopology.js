/**
 * stage3DTopology.js
 *
 * 3D Spatial coordinates, logistics nodes, and camera presets for the Persistent 3D Stage.
 */

export const STAGE_NODES = [
  {
    id: 'PORT-JNPT-01',
    code: 'JNPT',
    name: 'JNPT Port Container Terminal',
    tier: 'Tier 1 Maritime Gateway',
    pos: [-44, 0, 32],
    color: '#06b6d4', // Cyan
    iconName: 'Anchor',
    details: 'Primary maritime container gateway. 14 dock doors, 4,500 units/hr throughput.'
  },
  {
    id: 'HUB-THN-01',
    code: 'THANE',
    name: 'Thane Regional Hub',
    tier: 'Tier 3 Regional Hub',
    pos: [-24, 0, 16],
    color: '#a855f7', // Purple
    iconName: 'Warehouse',
    details: 'Suburban micro-hub serving Mumbai Metropolitan Region & dark stores.'
  },
  {
    id: 'DC-BHW-01',
    code: 'BHIWANDI',
    name: 'Bhiwandi Central DC',
    tier: 'Tier 2 Mega DC',
    pos: [-14, 0, 2],
    color: '#ff5400', // Orange
    iconName: 'Warehouse',
    details: 'Mega distribution hub consolidating port freight with 28 dock doors.'
  },
  {
    id: 'PASS-KASARA-01',
    code: 'KASARA',
    name: 'Kasara Ghat Mountain Pass',
    tier: 'Western Ghats Elevation Crest (Elevation +580m)',
    pos: [14, 9.5, -24],
    color: '#ffb703', // Amber
    iconName: 'Mountain',
    details: 'Steep NH-160 mountain pass ascent. Critical bottleneck vulnerable to monsoon mudslides.'
  },
  {
    id: 'DEP-NSK-01',
    code: 'NASHIK',
    name: 'Nashik Agro Depot',
    tier: 'Tier 3 Regional Depot',
    pos: [42, 6.5, -48],
    color: '#00c853', // Emerald
    iconName: 'Warehouse',
    details: 'Northern agricultural and industrial transit depot accessed via NH-160.'
  }
];

export const PUNE_FC_NODE = {
  id: 'FC-PUN-01',
  code: 'PUNE',
  name: 'Pune Auto Fulfillment Center',
  tier: 'Tier 3 Auto FC',
  pos: [28, 5.5, 42],
  color: '#3b82f6', // Cobalt Blue
  iconName: 'Warehouse',
  details: 'High-velocity automotive assembly and industrial components center fed via Mumbai-Pune Expressway.'
};

export const STAGE_FACILITIES = [
  ...STAGE_NODES,
  PUNE_FC_NODE
];

export const CAMERA_VIEWS = {
  OVERVIEW: {
    name: 'Corridor Overview',
    position: [0, 52, 65],
    target: [0, 4, -8]
  },
  KASARA_PASS: {
    name: 'Kasara Ghat Pass',
    position: [24, 20, -10],
    target: [14, 9.5, -24]
  },
  JNPT_PORT: {
    name: 'JNPT Maritime Port',
    position: [-36, 16, 50],
    target: [-44, 0, 32]
  },
  BHIWANDI_DC: {
    name: 'Bhiwandi Mega DC',
    position: [-6, 14, 20],
    target: [-14, 0, 2]
  },
  NASHIK_DEPOT: {
    name: 'Nashik Agro Depot',
    position: [34, 18, -32],
    target: [42, 6.5, -48]
  },
  PUNE_FC: {
    name: 'Pune Auto Center',
    position: [20, 16, 58],
    target: [28, 5.5, 42]
  }
};

