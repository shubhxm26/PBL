# 05: PersistentStage3D In-Place GLB Integration with Procedural Fallback & Night Glow Sync

**What to build:** Integration of the generated `.glb` facility models directly into the main operational 3D stage (`PersistentStage3D.jsx` and `proceduralWorld.js`). Replaces the simple procedural box nodes with the realistic 3D architectural digital twins anchored at their respective world coordinates. Incorporates a singleton `GLTFLoader` with memory caching and procedural fallback, while preserving all interactive features (holographic vertical light beacons, pulsing ground status rings, facility click HUDs) and dynamically controlling material emissive night-glow synchronized with the simulation clock.

**Blocked by:** 04 (Generation & Asset Delivery of the 6 Corridor Hub Models)

**Status:** ready-for-agent

- [ ] A cached singleton loader utility `frontend/src/utils/modelLoader.js` is created to load, cache, and clone `.glb` scenes efficiently without duplicate network fetches.
- [ ] `createCorridorLogisticsNodes` in `proceduralWorld.js` loads the 6 GLB models asynchronously and mounts them at their spatial world positions (`JNPT`, `Panvel`, `Thane`, `Bhiwandi`, `Nashik`, `Pune`).
- [ ] Procedural facility models remain as instant fallbacks while GLB models stream or if an asset fails to load.
- [ ] Kasara Ghat continues to render its dedicated procedural mountain elevation pass (`createKasaraElevationTerrain`).
- [ ] Holographic vertical light beams (`CylinderGeometry`), pulsing status rings (`RingGeometry`), and click-to-select raycasting remain functional on the loaded GLB meshes.
- [ ] Material emissive intensity dynamically modulates based on the simulation time (illuminating windows and conduits during night hours).
