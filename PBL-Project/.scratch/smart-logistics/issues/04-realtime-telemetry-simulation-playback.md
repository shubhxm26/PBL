# 04: Real-Time Telemetry & Live Simulation Playback Slice

**What to build:** A Fleet Dispatcher or Director can control a global simulation playback bar (Play, Pause, Step, 1x–5x Speed, Inject Roadblock) to stream real-time vehicle GPS coordinates, speed, battery/fuel state of charge, and cargo temperature over WebSockets, observing animated vehicle markers moving across the map and witnessing automatic dynamic re-routing when a roadblock disruption is injected.

**Blocked by:** 03: Fleet Route Optimizer & Freight Matching Slice

**Status:** completed

- [x] Telemetry simulation tick generator produces realistic GPS interpolation, speed, fuel consumption, and cargo temperature fluctuations along active routes.
- [x] WebSocket streaming hub at `/ws/telemetry` broadcasts real-time vehicle status ticks and handles client disconnect/reconnect gracefully.
- [x] Roadblock injection endpoint `POST /api/v1/telemetry/inject-disruption` adds temporary high-cost penalty edges to the corridor graph and broadcasts re-route events to active vehicles.
- [x] Frontend `SimulationBar` provides Play, Pause, Step, Speed multiplier controls (1x, 2x, 5x), simulation elapsed clock, and a one-click "Inject Roadblock" action.
- [x] Interactive Leaflet map animates vehicle marker icons smoothly along route coordinates, displaying popups with live sensor metrics and updating route polyline dynamically when a re-routing event arrives.
- [x] Automated tests verify WebSocket message framing, broadcast cadence, and re-routing payload structure upon disruption injection.
