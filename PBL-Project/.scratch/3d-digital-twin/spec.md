# Specification: 3D Digital Twin with CesiumJS & Autonomous AI Sentinel

**Status:** ready-for-agent

---

## Problem Statement

Modern enterprise logistics and supply chain networks operate under severe friction and vulnerability caused by disconnected legacy systems and a lack of real-time geospatial intelligence:

1. **Lack of Spatial & Environmental Context**: Existing logistics control towers rely on flat 2D maps or abstract tabular dashboards. These interfaces completely fail to communicate crucial real-world geographical obstacles that dictate logistics velocity—such as mountainous terrain gradients (e.g., the steep Kasara Ghat pass along NH-160), coastal and port terminal layouts (e.g., JNPT maritime container yards), and multi-lane highway chokepoints during monsoons, landslides, or labor strikes.
2. **Reactive Rather than Autonomous Mitigation**: Current supply chain monitoring tools require manual intervention at every step. An operator must notice a demand spike, recognize a delayed shipment, manually configure simulation parameters, run a scenario, and brainstorm rerouting plans. By the time human analysts execute this workflow, warehouse inventory has already stocked out, port demurrage fees have accumulated, and delivery SLAs have failed.
3. **Disconnected Analytical Pipelines**: Advanced forecasting neural networks (such as multi-horizon LSTM/GRU forecasters) and discrete-event network models operate in analytical silos. Planners cannot see how a 95% upper-bound demand surge predicted by an AI model dynamically ripples through multi-echelon warehouse inventory levels and creates physical freight bottleneck shockwaves across highway corridors in real time.
4. **Cognitive Overload During Complex Crises**: When major network disruptions occur simultaneously (e.g., a port strike combined with expressway bridge failures), dispatchers and supply chain leaders are overwhelmed with raw tabular logs, making it impossible to quickly identify optimal freight bypass corridors or evaluate trade-offs between holding costs and transit delays.

---

## Solution

The 3D Digital Twin with CesiumJS and Autonomous AI Sentinel is an immersive, cyber-geospatial operational command center integrated into the Cognitive Smart Logistics Platform. It bridges real-time telemetry, multi-echelon discrete-event simulation, and deep neural demand forecasting into an interactive 3D virtual environment.

From the user's perspective, the system provides:

1. **Cinematic Cyber-Geospatial 3D Operations Twin**:
   - Built on a photorealistic 3D virtual globe powered by CesiumJS, featuring digital world terrain, accurate elevation models, and photorealistic 3D building geometry anchored to real WGS84 geographic coordinates across the Western India logistics corridor (JNPT, Bhiwandi, Thane, Nashik, Pune).
   - Macro-facility volumetric light beacons and holographic 3D stock capacity rings whose colors and dimensions dynamically indicate real-time inventory saturation (Green $\ge 60\%$, Amber $30-59\%$, Red $< 30\%$).
   - 3D flow conduits draped over terrain along major highway corridors (NH-48, NH-160, Mumbai-Pune Expressway) featuring animated particle pulses representing freight volume and velocity.
   - Pulsating 3D disruption shockwaves at shock epicenters and glowing cyan/emerald detour lighting along alternative mitigation routes.

2. **Autonomous AI Logistics Sentinel**:
   - A real-time autonomous agent running in a continuous 1Hz evaluation loop within the simulation tick engine.
   - Continuously monitors 7-day and 14-day neural demand predictions, residual variance, and 95% upper confidence interval bounds from the PyTorch LSTM forecasting engine.
   - Cross-references forecast bounds against current echelon inventory levels, reorder points, and nominal freight corridor capacities.
   - Autonomously computes corridor bottleneck risk scores (0–100) and automatically issues preventative mitigation directives (e.g., pre-emptive freight diversion via Malshej Ghat or coastal rail feeder bypass) before physical stockouts materialize.

3. **Modern Floating Glassmorphic Command Center UI**:
   - Modernized Digital Twin studio layout with a centralized full-height 3D Cesium viewport.
   - Top-left Autonomous AI Sentinel HUD displaying live risk index, active preventative measures, and mode toggles (Autonomous Sentinel vs. Manual Operator).
   - Top-right Camera Navigation ribbon providing 1-click cinematic glide (`flyTo`) presets for JNPT Port, Bhiwandi Central DC, Kasara Ghat, Nashik Depot, Pune Fulfillment Center, and the full corridor overview.
   - Collapsible bottom drawers for shock scenario presets, intensity sliders, financial impact cards (baseline vs. mitigated costs and net savings), and inventory/delay timeline charts.
   - Interactive 3D entity picking that glides the camera directly to a selected facility and opens an inspector drawer with granular real-time telemetry.

---

## User Stories

### Persona 1: Supply Chain Director

1. As a Supply Chain Director, I want to view an immersive 3D digital twin of the Western India logistics corridor anchored to real-world terrain and 3D buildings, so that I have complete geospatial situational awareness of our physical supply chain network.
2. As a Supply Chain Director, I want to see volumetric 3D facility beacons and holographic capacity rings at each logistics node, so that I can instantly assess inventory health across ports, central distribution centers, and regional hubs at a glance.
3. As a Supply Chain Director, I want capacity rings to dynamically change color (Green for optimal, Amber for warning, Red for critical depletion), so that facilities at risk of stockout or overflow immediately catch my attention.
4. As a Supply Chain Director, I want animated 3D flow conduits along highway corridors representing freight volume and congestion, so that I can immediately identify active logistical bottlenecks.
5. As a Supply Chain Director, I want the system to feature an Autonomous AI Sentinel that continuously evaluates neural demand forecasts against node inventory levels, so that emerging supply chain risks are detected without requiring manual monitoring.
6. As a Supply Chain Director, I want the Autonomous AI Sentinel to automatically trigger preventative mitigation directives when link risk scores exceed safe thresholds, so that disruptions are mitigated before stockouts occur.
7. As a Supply Chain Director, I want to toggle between Autonomous Sentinel mode and Manual Operator mode, so that I can maintain executive oversight while allowing AI automation when desired.
8. As a Supply Chain Director, I want to inspect a live Autonomous Decision Log on the HUD, so that I can audit why the AI triggered a specific preventative measure and what forecast variance justified it.
9. As a Supply Chain Director, I want to select preset operational shocks (Port Labor Strike, Extreme Monsoon Road Closures, Expressway Bridge Failure) with an intensity slider, so that I can stress-test our multi-echelon network against historical black-swan events.
10. As a Supply Chain Director, I want to view side-by-side comparative financial impact metrics (baseline cost vs. mitigated cost, net cost savings, and SLA delay hours avoided) directly within the 3D twin, so that I can validate the ROI of proactive mitigations.
11. As a Supply Chain Director, I want to see pulsating 3D shockwaves rendered at disruption epicenters (such as rockfall zones in mountain passes or closed container terminals), so that I can visually communicate risk zones to stakeholders.
12. As a Supply Chain Director, I want alternative mitigation bypass routes illuminated in high-visibility cyan/emerald on the 3D globe when a disruption occurs, so that contingency corridors are immediately understandable.
13. As a Supply Chain Director, I want 1-click camera presets to smoothly glide between key strategic hubs (JNPT Port, Bhiwandi DC, Kasara Ghat, Nashik Depot, Pune Center), so that I can conduct executive walkthroughs effortlessly.
14. As a Supply Chain Director, I want to click any 3D facility beacon to open a detailed telemetry drawer displaying current stock, storage costs, replenishment lead times, and dock door throughput, so that I have immediate access to facility-level operations.
15. As a Supply Chain Director, I want timeline charts comparing inventory depletion and SLA delay hours over a 7-day to 30-day horizon, so that I can evaluate long-term recovery velocity under different shock scenarios.

### Persona 2: Fleet Dispatcher

16. As a Fleet Dispatcher, I want to view high-resolution 3D highway corridors draped over mountainous terrain, so that I can understand elevation-related transit slowdowns and hazard zones along routes.
17. As a Fleet Dispatcher, I want corridor polyline colors to dynamically shift to glowing red hazard dashes when a roadway is disrupted or congested, so that I can immediately redirect active drivers.
18. As a Fleet Dispatcher, I want the 3D twin to show real-time 1Hz telemetry updates synchronized with the global simulation clock, so that the 3D operational picture reflects the exact state of active routes.
19. As a Fleet Dispatcher, I want the Autonomous AI Sentinel to recommend specific bypass routes (such as Malshej Ghat NH-61 or coastal rail feeders) when primary corridors fail, so that I don't have to manually calculate complex detours under pressure.
20. As a Fleet Dispatcher, I want to inspect corridor throughput metrics (transit hours, truck capacity per day, CO2 emissions per trip) by clicking on highway conduits in the 3D view, so that I can balance fleet dispatch loads effectively.
21. As a Fleet Dispatcher, I want to use standard pan, tilt, zoom, and rotate camera controls around any logistics node, so that I can inspect local road network geography and highway interchanges in 3D.
22. As a Fleet Dispatcher, I want to see real-time transit delay hours updated continuously on the HUD as traffic or roadblock conditions evolve, so that I can provide accurate ETAs to receiving distribution centers.

### Persona 3: Customs & Compliance Officer

23. As a Customs Officer, I want to zoom directly to maritime container terminals (such as JNPT Port) using 1-click camera navigation, so that I can monitor import cargo dwell times and container holding levels in 3D.
24. As a Customs Officer, I want port facility capacity rings to alert me when container backlogs approach demurrage thresholds, so that customs inspection resources can be mobilized to clear bonded freight.
25. As a Customs Officer, I want to see the volume of bonded cargo moving along dedicated coastal rail feeder bypass corridors during port congestion, so that I can schedule customs clearance at inland dry ports (ICDs).

### Persona 4: Enterprise IT Administrator

26. As an IT Administrator, I want the CesiumJS 3D engine to integrate seamlessly into the Vite and React frontend build system without WebWorker or asset bundling errors, so that deployment pipelines remain reliable.
27. As an IT Administrator, I want Cesium Ion authentication to load securely from environment variables (`VITE_CESIUM_ION_TOKEN`), so that sensitive API keys are not hardcoded into source code.
28. As an IT Administrator, I want a graceful visual fallback guide if the Cesium Ion token is missing or invalid, so that developers and users are instructed on how to configure the token without the entire application crashing.
29. As an IT Administrator, I want the 3D viewport to maintain smooth 60 FPS performance on standard laptop hardware by focusing on macro-facility beacons and summary flow conduits rather than rendering thousands of individual truck meshes, so that the platform is accessible to all enterprise users.
30. As an IT Administrator, I want WebSocket telemetry connections to automatically reconnect upon network drops and resynchronize node states without requiring a hard page refresh, so that command center dashboards remain stable during extended operational shifts.
31. As an IT Administrator, I want REST API endpoints to inspect the Autonomous AI Sentinel status and decision history, so that external monitoring tools can log autonomous agent actions.
32. As an IT Administrator, I want the discrete-event simulation and 3D telemetry streaming to execute with zero external Docker dependencies when running in in-memory fallback mode, so that local development and CI testing remain frictionless.

---

## Implementation Decisions

### 1. Architectural & Modular Structure

The 3D Digital Twin feature builds upon the existing platform architecture by introducing two primary modules and extending existing telemetry and UI layers:

- **Autonomous AI Sentinel Engine (`backend/app/engines/autonomous_agent.py`)**:
  - Encapsulates continuous risk assessment logic.
  - Queries multi-horizon PyTorch LSTM forecasts, quantile variance, and 95% upper bounds from the forecasting engine.
  - Compares forecast demand against inventory levels and nominal capacities across all multi-echelon nodes.
  - Maintains internal sentinel states and generates structured mitigation directives when risk thresholds are breached.
- **Cesium 3D Cyber-Geospatial Viewport (`frontend/src/components/CesiumTwinViewport.jsx`)**:
  - High-performance React wrapper around `Cesium.Viewer`.
  - Configures Cesium Ion World Terrain and 3D Photorealistic Building tilesets.
  - Renders custom 3D holographic beacons, dynamic stock rings, 3D highway flow conduits, and pulsating disruption shockwaves.
  - Manages camera glide animations (`flyTo`) across key corridor nodes.
- **Discrete-Event Simulation Engine Updates (`backend/app/engines/digital_twin_engine.py`)**:
  - Extended to output macro-corridor flow vectors, capacity utilization indices, and bypass route metadata.
- **Telemetry Engine & WebSocket Integration (`backend/app/engines/telemetry_engine.py`)**:
  - Integrates the Autonomous Sentinel evaluation into the 1Hz simulation clock loop.
  - Broadcasts unified 1Hz payloads containing both vehicle micro-telemetry and macro-corridor twin state.
- **Digital Twin Command Center UI (`frontend/src/components/DigitalTwinTab.jsx`)**:
  - Restructured to feature the full-height 3D Cesium Viewport as the central canvas, overlaid with floating glassmorphism HUD cards, collapsible shock controls, financial impact metrics, and node inspection drawers.

### 2. State Machine & Autonomous Sentinel Protocol

The Autonomous AI Sentinel operates under a strict finite-state model:

```text
[IDLE / STANDBY] ──(1Hz Tick)──> [EVALUATING]
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
         (Risk Score < 70)                         (Risk Score >= 70)
                 │                                         │
                 ▼                                         ▼
         [MONITORING_NOMINAL]                     [AUTONOMOUS_MITIGATING]
                 │                                         │
                 │                                   (Synthesize Directive)
                 │                                         │
                 │                                         ▼
                 └──────────────────┬─────────────────> [ALERT_ACTIVE]
                                    │
                            (Disruption Resolved)
                                    │
                                    ▼
                            [MONITORING_NOMINAL]
```

### 3. Data Contracts & Schemas

#### A. Macro Corridor Telemetry Tick Payload (appended to 1Hz WebSocket stream)
```json
{
  "type": "twin_telemetry_tick",
  "timestamp": "2026-10-04T19:15:00Z",
  "simulation_clock_sec": 420,
  "autonomous_sentinel": {
    "mode": "autonomous",
    "status": "alert_active",
    "network_risk_score": 78.4,
    "active_directives": [
      {
        "directive_id": "DIR-AUTO-089",
        "timestamp": "2026-10-04T19:14:52Z",
        "trigger": "95% upper forecast demand (7,420 units) exceeds Bhiwandi-Thane nominal capacity (4,900 units)",
        "source_node": "DC-BHW-01",
        "target_node": "HUB-THN-01",
        "action": "Pre-emptive freight diversion to Ghodbunder Road Express Connector",
        "status": "dispatched"
      }
    ]
  },
  "nodes": [
    {
      "node_id": "PORT-JNPT-01",
      "stock_level": 42000,
      "capacity_units": 500000,
      "fill_pct": 8.4,
      "status_color": "green",
      "dock_utilization_pct": 74.2
    },
    {
      "node_id": "DC-BHW-01",
      "stock_level": 28500,
      "capacity_units": 250000,
      "fill_pct": 11.4,
      "status_color": "green",
      "dock_utilization_pct": 81.0
    }
  ],
  "corridor_links": [
    {
      "link_id": "LINK-BHW-NSK",
      "status": "disrupted",
      "congestion_index": 92.5,
      "active_shockwave": {
        "epicenter": [19.6540, 73.4820],
        "radius_meters": 4500,
        "severity": 0.85
      },
      "active_bypass_link_id": "BYPASS-MALSHEJ-01"
    }
  ]
}
```

#### B. Autonomous Mode Toggle & State Inspection Endpoints
- `GET /api/v1/twin/autonomous-status`: Returns current sentinel operating mode, recent decision history, evaluated forecast variances, and active risk scores.
- `POST /api/v1/twin/autonomous-toggle`: Accepts `{"mode": "autonomous" | "manual"}` and returns updated sentinel state.

### 4. Visual & Rendering Technical Clarifications

- **Coordinate System**: All geographic entities use standard WGS84 coordinates (`[longitude, latitude, elevation_meters]`) projected onto Cesium's Ellipsoid.
- **Macro-Facility Focus**: To guarantee 60 FPS performance, the twin does not render thousands of individual vehicle models; instead, it renders summary highway flow conduits with animated particle pulses and volumetric facility beacons with dynamic stock rings.
- **Cesium Asset Handling**: Cesium static assets and workers are bundled via `vite-plugin-cesium` to ensure asset URLs resolve properly in both development (`npm run dev`) and production (`npm run build`).
- **Graceful Token Fallback**: If `VITE_CESIUM_ION_TOKEN` is unset or invalid, the component renders a high-tech placeholder canvas with full instructions and fallback 3D schematic rendering rather than raising unhandled exceptions.

---

## Testing Decisions

### What Makes a Good Test

Tests must verify **external behavior, wire contracts, and operational states** rather than private implementation details. A good test for this feature:
- Sends HTTP requests with realistic persona headers to verify API contract schemas and status codes.
- Connects to the WebSocket telemetry endpoint and verifies that 1Hz tick payloads adhere to the macro-corridor telemetry schema without mocking internal engine calculations.
- Verifies that autonomous sentinel mode toggles persist and govern simulation tick output.
- Verifies that simulation metrics maintain physical and financial consistency (e.g., $mitigated\_cost \le baseline\_cost$ during active shocks).
- Validates that the frontend application builds cleanly without WebWorker or bundle resolution failures.

### Testing Seams

1. **Primary High-Level Seam: API & WebSocket Wire Seam**
   - The highest and cleanest boundary in the backend.
   - Tests execute against FastAPI endpoints (`GET /api/v1/twin/autonomous-status`, `POST /api/v1/twin/autonomous-toggle`, `POST /api/v1/twin/simulate-scenario`) using `httpx.AsyncClient`.
   - Tests connect to the WebSocket streaming hub (`/ws/telemetry`), listen for tick frames, and validate that autonomous sentinel metrics, node capacity percentages, and corridor shockwave attributes are broadcast synchronously with the 1Hz clock.

2. **Frontend Packaging & Component Contract Seam**
   - Executed via `npm run build` and `npx oxlint` in the `frontend` directory.
   - Validates that Vite compiles CesiumJS WebWorkers, Cesium Ion token loaders, and JSX components without errors.
   - Validates that `DigitalTwinTab` gracefully handles both active WebSocket telemetry streams and fallback mock fixtures when live connections are absent.

### Prior Art in Codebase

- `backend/tests/test_twin.py`: Tests discrete-event simulation scenarios, node topology attributes, and mitigation improvement calculations.
- `backend/tests/test_telemetry.py`: Tests WebSocket message framing, broadcast cadence, and disruption injection payloads.
- `backend/tests/test_health_rbac.py`: Tests persona role header injection and RBAC authorization boundaries.

---

## Out of Scope

The following items are explicitly excluded from this specification:

1. **Micro-Vehicle Mesh Rendering**: Rendering individual 3D animated truck models for hundreds of individual vehicles simultaneously is excluded to maintain 60 FPS performance across all client devices; summary flow conduits with particle vectors are used instead.
2. **Interior Warehouse Digital Twin**: Detailed interior warehouse pallet racking, forklift automation, or barcode scanner 3D models are out of scope; facilities are modeled as macro-echelon nodes with volumetric exterior beacons and capacity rings.
3. **Offline Air-Gapped Satellite Imagery Cache**: Storing gigabytes of offline high-resolution satellite tiles locally is excluded; the 3D twin relies on live streaming via Cesium Ion World Terrain and Photorealistic 3D Buildings.
4. **Manual Joystick / Gamepad Drone Flight**: Free-form drone flying or manual gamepad controls are excluded; navigation is managed via standard intuitive orbit controls and 1-click cinematic camera presets.
5. **Direct ERP/TMS Database Connectors**: Real-time integration with proprietary SAP/Oracle TMS systems is excluded; the platform operates on the existing simulated enterprise corridor data fixtures.

---

## Further Notes

- **Environment Configuration**: Requires `VITE_CESIUM_ION_TOKEN` in `.env` (or `frontend/.env`) for full 3D World Terrain and photorealistic buildings. A default instruction alert is displayed when unconfigured.
- **Performance Targets**:
  - 3D rendering framerate: $\ge 60$ FPS on modern browser hardware.
  - WebSocket telemetry tick cadence: $1.0 \pm 0.1$ seconds.
  - Discrete-event scenario simulation execution time: $< 5.0$ seconds.
- **Compatibility**: Compatible with modern Chromium, Firefox, and WebKit browsers supporting WebGL 2.0.
