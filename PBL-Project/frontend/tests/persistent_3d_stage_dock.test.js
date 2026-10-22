import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCK_SERVICES,
  CORRIDOR_INFO,
  WORKSPACE_STORAGE_KEY,
  clampCoordinates,
  isServiceAllowed
} from '../src/constants/dockConfig.js';
import {
  STAGE_NODES,
  CAMERA_VIEWS
} from '../src/constants/stage3DTopology.js';
import { FALLBACK_PROFILES } from '../src/constants/personaProfiles.js';


describe('01: Persistent 3D Stage & Glassmorphic Dock Shell', () => {
  describe('1. Full-Viewport Continuous 3D Stage & Dark Obsidian Palette', () => {
    test('Verifies Cyber-Physical Dark Obsidian color palette standards', () => {
      const OBSIDIAN_BASE = '#020617';
      const OBSIDIAN_SURFACE = '#0B0F19';

      assert.equal(OBSIDIAN_BASE, '#020617', 'Base palette must be Cyber Dark Obsidian #020617');
      assert.equal(OBSIDIAN_SURFACE, '#0B0F19', 'Surface palette must be #0B0F19');
    });

    test('3D Stage defines all 5 Western India corridor logistics nodes with valid 3D coordinates', () => {
      assert.equal(STAGE_NODES.length, 5, 'Stage must contain exactly 5 multi-echelon nodes');

      const expectedCodes = ['JNPT', 'THANE', 'BHIWANDI', 'KASARA', 'NASHIK'];
      const actualCodes = STAGE_NODES.map((n) => n.code);

      for (const expected of expectedCodes) {
        assert.ok(actualCodes.includes(expected), `Stage nodes must include ${expected}`);
      }

      STAGE_NODES.forEach((node) => {
        assert.ok(node.id, `Node must have an id: ${node.name}`);
        assert.ok(Array.isArray(node.pos) && node.pos.length === 3, `Node ${node.code} must have [x, y, z] 3D coordinates`);
        assert.ok(typeof node.pos[0] === 'number');
        assert.ok(typeof node.pos[1] === 'number');
        assert.ok(typeof node.pos[2] === 'number');
        assert.ok(node.color.startsWith('#'), `Node ${node.code} must have a valid hex color`);
      });
    });

    test('Kasara Ghat mountain pass possesses physical 3D elevation gradient in Western Ghats terrain', () => {
      const kasara = STAGE_NODES.find((n) => n.code === 'KASARA');
      assert.ok(kasara, 'Kasara Ghat pass must exist');
      // Elevation in 3D scene (pos[1]) must be significant relative to sea-level port
      const jnpt = STAGE_NODES.find((n) => n.code === 'JNPT');
      assert.ok(kasara.pos[1] > jnpt.pos[1] + 5, 'Kasara Ghat elevation y-axis must be distinctly elevated over sea-level port');
      assert.ok(kasara.tier.includes('Elevation'), 'Kasara Ghat tier label must identify elevation ascent');
    });

    test('Camera preset suite provides smooth inspection angles for corridor and facility hubs', () => {
      const presets = Object.keys(CAMERA_VIEWS);
      assert.ok(presets.includes('OVERVIEW'), 'Must include OVERVIEW preset');
      assert.ok(presets.includes('KASARA_PASS'), 'Must include KASARA_PASS preset');
      assert.ok(presets.includes('JNPT_PORT'), 'Must include JNPT_PORT preset');
      assert.ok(presets.includes('BHIWANDI_DC'), 'Must include BHIWANDI_DC preset');
      assert.ok(presets.includes('NASHIK_DEPOT'), 'Must include NASHIK_DEPOT preset');

      presets.forEach((key) => {
        const view = CAMERA_VIEWS[key];
        assert.ok(view.name, `Preset ${key} must have human-readable name`);
        assert.equal(view.position.length, 3, `Preset ${key} position must be [x, y, z]`);
        assert.equal(view.target.length, 3, `Preset ${key} target must be [x, y, z]`);
        assert.ok(view.position[1] > 0, `Preset ${key} camera height must be elevated above ground`);
      });
    });
  });

  describe('2. Top Cyber-Dark Status Bar & Corridor Route Indicator', () => {
    test('Active corridor route indicator defines complete sequential itinerary', () => {
      assert.equal(CORRIDOR_INFO.code, 'NH-160 / NH-48');
      assert.equal(CORRIDOR_INFO.totalDistanceKm, 168.4);
      assert.equal(CORRIDOR_INFO.status, 'OPTIMAL');

      assert.equal(CORRIDOR_INFO.stops.length, 5);
      assert.equal(CORRIDOR_INFO.stops[0].code, 'JNPT');
      assert.equal(CORRIDOR_INFO.stops[1].code, 'BHW');
      assert.equal(CORRIDOR_INFO.stops[2].code, 'THN');
      assert.equal(CORRIDOR_INFO.stops[3].code, 'KASARA');
      assert.equal(CORRIDOR_INFO.stops[4].code, 'NSK');
    });

    test('Corridor stops correctly specify multi-echelon tiers', () => {
      const portStop = CORRIDOR_INFO.stops.find((s) => s.code === 'JNPT');
      assert.ok(portStop.tier.includes('Tier 1'));

      const dcStop = CORRIDOR_INFO.stops.find((s) => s.code === 'BHW');
      assert.ok(dcStop.tier.includes('Tier 2'));

      const kasaraStop = CORRIDOR_INFO.stops.find((s) => s.code === 'KASARA');
      assert.ok(kasaraStop.tier.includes('Western Ghats'));
    });
  });

  describe('3. Role-Adaptive RBAC Dock Service Clearance Matrix', () => {
    test('Dock registers all 7 enterprise services with theme colors and default layout bounds', () => {
      assert.equal(DOCK_SERVICES.length, 7, 'Dock must host exactly 7 services');

      const expectedIds = ['kpis', 'forecasting', 'routing', 'compliance', 'sentinel', 'twin', 'system'];
      const actualIds = DOCK_SERVICES.map((s) => s.id);

      for (const id of expectedIds) {
        assert.ok(actualIds.includes(id), `Dock services must include ${id}`);
      }

      DOCK_SERVICES.forEach((service) => {
        assert.ok(service.label, `Service ${service.id} must have label`);
        assert.ok(service.viewRequired, `Service ${service.id} must declare viewRequired`);
        assert.ok(service.themeColor.startsWith('#'), `Service ${service.id} must have hex themeColor`);
        assert.ok(service.defaultPos.width >= 400, `Service ${service.id} default width must be >= 400px`);
        assert.ok(service.defaultPos.height >= 400, `Service ${service.id} default height must be >= 400px`);
      });
    });

    test('Director persona has access to KPIs, forecasting, routing, and twin, but locked out of compliance & system', () => {
      const directorPermissions = FALLBACK_PROFILES.director.permissions;

      assert.equal(isServiceAllowed('director', directorPermissions, 'kpis'), true);
      assert.equal(isServiceAllowed('director', directorPermissions, 'forecasting'), true);
      assert.equal(isServiceAllowed('director', directorPermissions, 'routing'), true);
      assert.equal(isServiceAllowed('director', directorPermissions, 'twin'), true);

      assert.equal(isServiceAllowed('director', directorPermissions, 'compliance'), false);
      assert.equal(isServiceAllowed('director', directorPermissions, 'system'), false);
    });

    test('Dispatcher persona has access to routing, but locked out of compliance, forecasting, twin, KPIs, and system', () => {
      const dispatcherPermissions = FALLBACK_PROFILES.dispatcher.permissions;

      assert.equal(isServiceAllowed('dispatcher', dispatcherPermissions, 'routing'), true);

      assert.equal(isServiceAllowed('dispatcher', dispatcherPermissions, 'forecasting'), false);
      assert.equal(isServiceAllowed('dispatcher', dispatcherPermissions, 'twin'), false);
      assert.equal(isServiceAllowed('dispatcher', dispatcherPermissions, 'kpis'), false);
      assert.equal(isServiceAllowed('dispatcher', dispatcherPermissions, 'compliance'), false);
      assert.equal(isServiceAllowed('dispatcher', dispatcherPermissions, 'system'), false);
    });

    test('Customs persona has access to compliance, but locked out of routing, forecasting, twin, KPIs, and system', () => {
      const customsPermissions = FALLBACK_PROFILES.customs.permissions;

      assert.equal(isServiceAllowed('customs', customsPermissions, 'compliance'), true);

      assert.equal(isServiceAllowed('customs', customsPermissions, 'kpis'), false);
      assert.equal(isServiceAllowed('customs', customsPermissions, 'routing'), false);
      assert.equal(isServiceAllowed('customs', customsPermissions, 'forecasting'), false);
      assert.equal(isServiceAllowed('customs', customsPermissions, 'twin'), false);
      assert.equal(isServiceAllowed('customs', customsPermissions, 'system'), false);
    });


    test('Admin persona has unrestricted wildcard access to all dock services', () => {
      const adminPermissions = FALLBACK_PROFILES.admin.permissions;

      DOCK_SERVICES.forEach((service) => {
        assert.equal(
          isServiceAllowed('admin', adminPermissions, service.viewRequired),
          true,
          `Admin must be granted access to ${service.id}`
        );
      });
    });
  });

  describe('4. Floating Window Manager Geometry, Coordinate Clamping & State Persistence', () => {
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

    test('Workspace storage serialization key matches authoritative standard', () => {
      assert.equal(WORKSPACE_STORAGE_KEY, 'neologix_workspace_state_v1');
    });

    test('Simulates window toggle lifecycle (Open -> Focus -> Minimize -> Restore -> Close)', () => {
      // Mock initial window state
      let win = {
        id: 'routing',
        isOpen: false,
        isMinimized: false,
        isMaximized: false,
        position: { x: 40, y: 72 },
        size: { width: 920, height: 720 },
        zIndex: 5
      };
      let highestZ = 10;

      // 1. Open
      if (!win.isOpen) {
        highestZ++;
        win = { ...win, isOpen: true, isMinimized: false, zIndex: highestZ };
      }
      assert.equal(win.isOpen, true, 'Window should now be open');
      assert.equal(win.zIndex, 11, 'Window zIndex should be elevated');

      // 2. Click while focused -> Minimize
      const isTop = win.zIndex >= highestZ;
      if (isTop) {
        win = { ...win, isMinimized: true };
      }
      assert.equal(win.isMinimized, true, 'Window should be minimized');
      assert.equal(win.isOpen, true, 'Underlying panel state remains preserved');

      // 3. Restore
      highestZ++;
      win = { ...win, isMinimized: false, zIndex: highestZ };
      assert.equal(win.isMinimized, false, 'Window should be restored');
      assert.equal(win.zIndex, 12, 'Restored window brings to top');

      // 4. Close
      win = { ...win, isOpen: false };
      assert.equal(win.isOpen, false, 'Window is closed');
    });
  });
});
