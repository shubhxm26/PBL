# Frontend Architecture Redesign: 3D Digital Twin & Cyber-Glass Console

## Overview

Redesign the frontend architecture of the Cognitive Smart Logistics & Autonomous Freight Platform from a traditional multi-tab layout into a persistent 3D Digital Twin console with multi-perspective 3rd-person vehicle tracking, dual-engine rendering (Three.js / React Three Fiber + CesiumJS), floating glassmorphic service toggles, live telematics cockpit HUD, and deep bi-directional binding between business services and 3D simulation entities.

---

## Key Pillars

1. **Persistent Central 3D Operational Stage**:
   - The 3D Digital Twin serves as the primary continuous background canvas running at 60 FPS.
   - Dual-engine architecture:
     - **React Three Fiber (R3F) Tactical Simulator**: Procedural extruded highway ribbons, 3D truck with wheel spin and headlights, Kasara Ghat mountain pass elevation, and 3rd-person dynamic chase camera.
     - **CesiumJS Macro Engine**: Regional WGS84 satellite Earth, terrain, and corridor overview.
     - 1-click toggle and Picture-in-Picture (PiP) mini-radar.

2. **Floating Glassmorphic Service Overlays**:
   - Bottom Dock toolbar featuring role-adaptive service toggles.
   - Modules (Demand Forecasting, Route & Fleet Optimizer, Trade Compliance/IDP, Autonomous Sentinel, Executive KPIs, Admin Retraining) open as draggable/collapsible frosted glass cards over the live 3D canvas without unmounting the simulation.

3. **Multi-Perspective Camera Suite**:
   - **3rd-Person Dynamic Chase Cam** (default follow with velocity damping and free-look).
   - **Driver Cockpit Dashcam POV**.
   - **Tactical Drone God-View**.
   - **Free Orbit & Facility Inspection Cam**.

4. **Live Telematics & Simulation Cockpit**:
   - Bottom HUD ribbon with Play/Pause, speed selector (1x, 2x, 5x), vehicle switcher (`TRK-MH-01`, `TRK-MH-02`), live speedometer, battery SoC, and cold-chain cargo temp indicators.
   - Real-time roadblock injection (Kasara Ghat landslide) causing visual 3D obstacles and autonomous rerouting onto alternate bypass highway in 3D.

5. **Deep Bi-Directional Binding**:
   - Clicking routes, facilities, or disruptions in any service panel commands the 3D camera to navigate and highlight the entity.
   - Clicking 3D trucks or warehouses cross-filters open service panels.

6. **Cyber-Physical Dark Obsidian Aesthetic & RBAC**:
   - Deep cosmic dark glassmorphism (`#020617`, `#0B0F19`, frosted glass blur, neon cyan/emerald/amber/rose status accents).
   - Top status bar with role-adaptive persona switcher dynamically filtering dock service access.
