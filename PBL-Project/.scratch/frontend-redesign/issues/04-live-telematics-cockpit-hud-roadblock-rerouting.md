# 04: Live Telematics Cockpit HUD & Dynamic Roadblock Re-routing

**What to build:**
Connect the 3D twin to the backend real-time WebSocket (`/ws/telemetry`) and control endpoints. Provide a floating bottom glassmorphic Cockpit HUD containing simulation playback controls (Play, Pause, Step, 1x/2x/5x speed), a fleet vehicle switcher (`TRK-MH-01` Reefer, `TRK-MH-02` EV Carrier), and real-time telematics gauge clusters (digital speedometer, battery/fuel SoC bar, cold-chain temperature gauge with 2°C–8°C safe-zone thresholding). Provide quick disruption injection triggers (Kasara Ghat landslide); when triggered, a 3D roadblock barrier with flashing hazard beacons appears on the highway, and the vehicle visibly slows down and steers onto the bypass detour trajectory in 3D while telemetry gauges update in real time.

**Blocked by:** 02: Three.js / R3F Procedural Logistics World & 3rd-Person Chase Cam

**Status:** completed

- [x] A persistent glassmorphic Cockpit HUD displays above the Dock toolbar with real-time telemetry metrics.
- [x] Simulation Play/Pause/Step and speed multiplier (1x, 2x, 5x) controls successfully dispatch to backend telemetry APIs and update the simulation clock.
- [x] Active vehicle switcher toggles the 3rd-person camera focus between `TRK-MH-01` (Nashik corridor) and `TRK-MH-02` (Pune expressway).
- [x] Telemetry gauge cluster renders live speed, SoC percentage, and cargo temperature with amber/red excursion alerts if cold-chain breaches 2°C–8°C.
- [x] Quick-action button triggers the Kasara Ghat landslide disruption, rendering 3D hazard barricades and blinking beacons on the road mesh.
- [x] Triggering the roadblock causes the truck to execute a smooth detour turn onto the Malshej Ghat bypass route with updated ETA and reroute notification.
- [x] Automated tests verify WebSocket message ingestion, state updates, and detour polyline switching.
