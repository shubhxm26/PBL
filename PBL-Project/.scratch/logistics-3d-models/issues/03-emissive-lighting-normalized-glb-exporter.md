# 03: Emissive Day/Night Lighting & Origin-Normalized GLB Exporter

**What to build:** Emissive lighting shader properties embedded into the 3D building and road materials within `map3d`, enabling dynamic night-shift luminescent glowing when loaded in the logistics simulation. Additionally, the `GLTFExporter` logic is upgraded to automatically center all exported geometry around `(0, 0, 0)` and normalize the footprint to fit standard ~8 world units, exporting self-contained binary `.glb` files with predictable naming matching the active facility preset (`facility_<hubId>.glb`).

**Blocked by:** 01 (Map3D Maharashtra Re-Centering & 6-Hub Preset Selector), 02 (3D Extruded Road Ribbons & Industrial Warehouse Material Classification)

**Status:** completed

- [x] Material definitions include emissive channels:
  - Warehouse/facility windows feature subtle cyan/amber emissive glow (`#38bdf8` / `#f59e0b`, `emissiveIntensity: 0.6`).
  - Road ribbons feature luminescent lane markings for night visibility.
- [x] Export transformation step centers the scene's bounding box centroid at `(0, 0, 0)` in local space.
- [x] Scene bounding radius is normalized to a target footprint (~8.0 units) to seamlessly match `PersistentStage3D` node dimensions.
- [x] `exportGLB()` in `Space.tsx` names files dynamically based on the active facility preset (e.g. `facility_jnpt.glb`, `facility_bhiwandi.glb`) instead of a generic `scene.glb`.
- [x] Exported `.glb` binaries are verified to be fully valid and loadable without missing textures or inverted normals.
