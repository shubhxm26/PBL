# 05: Glassmorphic Service Panels & Bi-directional 3D Scene Binding

**What to build:**
Re-architect all backend business service modules (Demand Forecasting, Route & Fleet Optimizer, Trade Compliance & IDP, Autonomous Sentinel, Executive KPIs, and IT Administration) into floating, draggable, collapsible frosted glass panels. Establish deep bi-directional binding between the panels and the 3D scene: clicking a route, warehouse node, or incident alert in any panel commands the 3D camera to smoothly fly-to and highlight that entity in the 3D world; conversely, clicking a 3D truck or depot in the viewport cross-filters and focuses open service panels onto that entity.

**Blocked by:** 01: Persistent 3D Stage & Glassmorphic Dock Shell, 04: Live Telematics Cockpit HUD & Dynamic Roadblock Re-routing

**Status:** completed

- [x] All six service modules (Forecasting, Routing, Compliance, Sentinel, KPIs, IT Admin) render inside responsive frosted glass panel containers (`backdrop-blur-md bg-slate-950/75 border-slate-700/50`).
- [x] Each panel supports minimize, maximize, and drag repositioning across the viewport canvas.
- [x] Selecting a facility node or highway route in the Routing or Forecasting panel triggers a smooth 3D camera fly-to and glows the corresponding 3D entity.
- [x] Selecting an incident alert in Autonomous Sentinel highlights the disruption zone in 3D and displays mitigation options.
- [x] Clicking on a 3D warehouse or vehicle in the viewport updates the active context across open service panels.
- [x] Running ML predictions or route optimizations updates the 3D twin's visual overlays with computed demand heatmaps and optimal path vectors.
