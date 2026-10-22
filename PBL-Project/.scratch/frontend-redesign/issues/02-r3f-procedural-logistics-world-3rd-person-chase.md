# 02: Three.js / R3F Procedural Logistics World & 3rd-Person Chase Cam

**What to build:**
Implement the tactical Three.js / React Three Fiber renderer as the central 3D operational environment. The 3D world procedurally builds the Western India logistics highway network (JNPT ➔ Bhiwandi ➔ Kasara Ghat ➔ Nashik) as an extruded asphalt roadway with glowing flow conduits, elevated mountain terrain for Kasara Ghat, and procedural models for key logistics nodes (container cranes at JNPT, distribution docks at Bhiwandi, depot silos at Nashik). Render an animated procedural 3D truck with spinning wheels, dynamic headlights, and a floating cold-chain telemetry badge. Provide a multi-perspective camera suite with smooth 3rd-Person Dynamic Chase (with velocity damping and free-look orbit), Cockpit Dashcam POV, Drone God-view, and Free Orbit inspection.

**Blocked by:** 01: Persistent 3D Stage & Glassmorphic Dock Shell

**Status:** completed

- [x] Three.js / React Three Fiber renders inside the central stage with 60 FPS performance and steady lighting.
- [x] Procedural extruded highway ribbons render from real WGS84 GPS corridor waypoints with glowing animated traffic flow pulses.
- [x] Kasara Ghat mountain pass displays 3D elevation gradient terrain representing the Western Ghats ascent.
- [x] Procedural 3D logistics structures render at key node locations (JNPT Port, Bhiwandi DC, Thane Hub, Nashik Depot, Pune FC).
- [x] A 3D commercial vehicle model navigates along the highway trajectory with animated wheels, functional headlights, and cargo status beacon.
- [x] The camera suite allows switching between 3rd-Person Chase Cam (default), Cockpit Dashcam, Drone Overhead God-view, and Free Orbit.
- [x] 3rd-person chase camera smoothly damps behind the moving vehicle, aligns with truck heading, and supports mouse drag free-look.
- [x] Automated/component tests verify camera mode switching and coordinate transformation functions.

