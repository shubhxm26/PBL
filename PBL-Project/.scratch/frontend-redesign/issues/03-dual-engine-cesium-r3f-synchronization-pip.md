# 03: Dual-Engine Synchronization (Cesium Macro GIS ↔ R3F Tactical Twin & PiP)

**What to build:**
Incorporate CesiumJS alongside the Three.js / React Three Fiber world in a unified dual-engine stage. Operators can switch between the Strategic Macro GIS view (Cesium globe with satellite imagery, real terrain, and 3D OSM buildings) and the Tactical 3D Simulator (R3F 3rd-person vehicle chase) with a single click. In both modes, a Picture-in-Picture (PiP) mini-radar window renders the secondary engine concurrently, maintaining synchronized camera coordinates and spatial markers between macro and tactical scales.

**Blocked by:** 02: Three.js / R3F Procedural Logistics World & 3rd-Person Chase Cam

**Status:** completed

- [x] A floating glassmorphic Viewport Engine Selector allows toggling between 'Tactical R3F Twin' and 'Macro Cesium GIS'.
- [x] Switching engines preserves simulation playback time, active vehicle selection, and camera focus without reloading page state.
- [x] An interactive Picture-in-Picture (PiP) widget renders in the corner, displaying the alternative engine (e.g., mini Cesium globe radar while in R3F chase mode).
- [x] Clicking the PiP window swaps it into the primary full-screen stage and moves the former primary into the PiP inset.
- [x] Facility markers and vehicle coordinates stay synchronized across both engines.
- [x] If Cesium Ion token is missing or WebGL context encounters limits, Cesium displays a graceful schematic fallback while R3F continues uninterrupted.
