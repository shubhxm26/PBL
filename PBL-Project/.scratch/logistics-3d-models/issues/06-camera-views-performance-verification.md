# 06: Camera View Telemetry Profiling & WebGL Performance Verification

**What to build:** Comprehensive validation and performance optimization of the complete 3D corridor system. Confirms all camera presets (`CAMERA_VIEWS.JNPT_PORT`, `BHIWANDI_DC`, `PUNE_FC`, `KASARA_PASS`, etc.) orbit and frame the realistic hub models smoothly, telemetry click HUDs populate live node metrics, and rendering maintains a steady 60 FPS without WebGL memory leaks, GPU stalls, or context loss.

**Blocked by:** 05 (PersistentStage3D In-Place GLB Integration with Procedural Fallback & Night Glow Sync)

**Status:** ready-for-agent

- [ ] All camera preset transitions in `CAMERA_VIEWS` (`OVERVIEW`, `JNPT_PORT`, `BHIWANDI_DC`, `NASHIK_DEPOT`, `PUNE_FC`, `KASARA_PASS`) frame their respective 3D hub models accurately with clean focal distance.
- [ ] Clicking on any 3D facility triggers node selection in the workspace context (`selectFacility(nodeId)`) and displays the facility telemetry card without lag.
- [ ] Night simulation toggle / clock transition correctly shifts ambient illumination and activates the emissive window and highway conduits across all 6 hubs.
- [ ] WebGL memory profiling confirms proper disposal and zero texture leaks during engine toggles between Three.js and Cesium.
- [ ] 60 FPS render loop remains smooth across Chase Cam, Cockpit HUD, Drone Cam, and Orbit Inspection modes.
