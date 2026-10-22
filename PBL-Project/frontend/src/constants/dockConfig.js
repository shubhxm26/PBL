/**
 * dockConfig.js
 *
 * Central configuration for all glassmorphic services available in the floating Dock.
 * Maps services to permissions, icons, theme colors, and default viewport geometry.
 */

export const DOCK_SERVICES = [
  {
    id: 'kpis',
    label: 'Executive KPIs',
    shortLabel: 'KPIs',
    viewRequired: 'kpis',
    themeColor: '#ff5400', // Safety Orange
    accentGlow: 'rgba(255, 84, 0, 0.4)',
    badgeText: 'COMMAND',
    description: 'Executive logistics KPIs, cargo volume, on-time delivery rates, and fuel telemetry.',
    defaultPos: { x: 24, y: 72, width: 560, height: 640 }
  },
  {
    id: 'forecasting',
    label: 'Demand Forecasting',
    shortLabel: 'Forecast',
    viewRequired: 'forecasting',
    themeColor: '#ffb703', // Solar Yellow
    accentGlow: 'rgba(255, 183, 3, 0.4)',
    badgeText: 'AI-PREDICT',
    description: 'Temporal fusion demand predictions, inventory rebalancing, and stock risk alerts.',
    defaultPos: { x: 50, y: 72, width: 880, height: 680 }
  },
  {
    id: 'routing',
    label: 'Route & Fleet Optimizer',
    shortLabel: 'Routing',
    viewRequired: 'routing',
    themeColor: '#00c853', // Signal Emerald
    accentGlow: 'rgba(0, 200, 83, 0.4)',
    badgeText: 'FLEET-OPT',
    description: 'Dynamic multi-stop vehicle routing, cold-chain telematics, and backhaul matching.',
    defaultPos: { x: 40, y: 72, width: 920, height: 720 }
  },
  {
    id: 'compliance',
    label: 'Trade Compliance & IDP',
    shortLabel: 'Compliance',
    viewRequired: 'compliance',
    themeColor: '#ff1744', // Vivid Coral
    accentGlow: 'rgba(255, 23, 68, 0.4)',
    badgeText: 'CUSTOMS-IDP',
    description: 'Automated bill-of-lading processing, HS-code validation, and tariff calculations.',
    defaultPos: { x: 60, y: 72, width: 900, height: 700 }
  },
  {
    id: 'sentinel',
    label: 'Autonomous AI Sentinel',
    shortLabel: 'Sentinel',
    viewRequired: 'twin',
    themeColor: '#06b6d4', // Neon Cyan
    accentGlow: 'rgba(6, 182, 212, 0.4)',
    badgeText: 'AUTONOMOUS',
    description: 'Real-time corridor threat detection, automated detour execution, and risk telemetry.',
    defaultPos: { x: 800, y: 72, width: 460, height: 620 }
  },
  {
    id: 'twin',
    label: 'Cesium Twin Studio',
    shortLabel: 'Cesium GIS',
    viewRequired: 'twin',
    themeColor: '#38bdf8', // Sky Blue
    accentGlow: 'rgba(56, 189, 248, 0.4)',
    badgeText: 'MACRO-GIS',
    description: 'WGS84 3D geospatial corridor digital twin, shockwave visualizer, and scenario studio.',
    defaultPos: { x: 30, y: 72, width: 960, height: 740 }
  },
  {
    id: 'system',
    label: 'IT Administration & Retraining',
    shortLabel: 'Admin',
    viewRequired: 'system',
    themeColor: '#a855f7', // Cyber Purple
    accentGlow: 'rgba(168, 85, 247, 0.4)',
    badgeText: 'SYSTEM-OPS',
    description: 'PyTorch model retraining studio, system health diagnostics, and audit logs.',
    defaultPos: { x: 80, y: 80, width: 840, height: 660 }
  }
];

export const CORRIDOR_INFO = {
  name: 'Western India Logistics Arterial',
  code: 'NH-160 / NH-48',
  totalDistanceKm: 168.4,
  stops: [
    { code: 'JNPT', name: 'JNPT Port Container Terminal', tier: 'Tier 1 Maritime Gateway' },
    { code: 'BHW', name: 'Bhiwandi Central DC', tier: 'Tier 2 Mega DC' },
    { code: 'THN', name: 'Thane Regional Hub', tier: 'Tier 3 Regional Hub' },
    { code: 'KASARA', name: 'Kasara Ghat Mountain Pass', tier: 'Western Ghats Elevation Crest' },
    { code: 'NSK', name: 'Nashik Agro Depot', tier: 'Tier 3 Regional Depot' }
  ],
  status: 'OPTIMAL',
  statusLabel: 'ALL CORRIDORS CLEAR'
};

export const WORKSPACE_STORAGE_KEY = 'neologix_workspace_state_v1';

/**
 * Clamps coordinates so floating panels stay comfortably inside visible viewport bounds.
 */
export function clampCoordinates(pos, size, viewportWidth, viewportHeight) {
  const minX = 8;
  const maxX = Math.max(minX, viewportWidth - size.width - 8);
  const minY = 62; // Below Cyber-Dark status header (56px)
  const maxY = Math.max(minY, viewportHeight - 80); // Above Dock toolbar (70px)

  return {
    x: Math.round(Math.max(minX, Math.min(pos.x, maxX))),
    y: Math.round(Math.max(minY, Math.min(pos.y, maxY)))
  };
}

/**
 * Fully adapts and clamps window geometry (size & position) across any desktop resolution.
 * Ensures panels are always reachable, never off-screen, and fit within available bounds.
 */
export function clampWindowGeometry(pos, size, viewportWidth, viewportHeight) {
  const minWidth = 320;
  const minHeight = 240;
  const maxWidth = Math.max(minWidth, viewportWidth - 16);
  const maxHeight = Math.max(minHeight, viewportHeight - 142); // 62px top header + 80px dock

  const clampedWidth = Math.round(Math.max(minWidth, Math.min(size.width, maxWidth)));
  const clampedHeight = Math.round(Math.max(minHeight, Math.min(size.height, maxHeight)));

  const clampedPos = clampCoordinates(pos, { width: clampedWidth, height: clampedHeight }, viewportWidth, viewportHeight);

  return {
    position: clampedPos,
    size: {
      width: clampedWidth,
      height: clampedHeight
    }
  };
}

/**
 * Helper to determine if a persona has access to a dock item.
 */
export function isServiceAllowed(currentRole, userPermissions, viewRequired) {
  if (currentRole === 'admin') return true;
  const views = userPermissions?.views || [];
  return views.includes('*') || views.includes(viewRequired);
}

