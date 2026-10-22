# 04: Generation & Asset Delivery of the 6 Corridor Hub Models

**What to build:** The execution, optimization, and delivery of all 6 production `.glb` model files generated from `map3d` directly into the frontend static public assets directory (`frontend/public/models/facilities/`). Each model represents the real-world geometry of the respective logistics facility with solid roads, differentiated warehouse architecture, emissive day/night channels, and normalized coordinate origin.

**Blocked by:** 03 (Emissive Day/Night Lighting & Origin-Normalized GLB Exporter)

**Status:** completed

- [x] Directory `frontend/public/models/facilities/` is created and structured.
- [x] The following 6 models are generated and verified:
  - `facility_jnpt.glb` (JNPT Port Container Terminal — 594.7 KB, 320 meshes)
  - `facility_panvel.glb` (Panvel Logistics Depot — 758.2 KB, 266 meshes)
  - `facility_thane.glb` (Thane Regional Hub — 755.2 KB, 287 meshes)
  - `facility_bhiwandi.glb` (Bhiwandi Central Mega DC — 993.5 KB, 423 meshes)
  - `facility_nashik.glb` (Nashik Agro Depot — 762.0 KB, 352 meshes)
  - `facility_pune.glb` (Pune Auto Fulfillment Center — 794.0 KB, 395 meshes)
- [x] Each file is inspected:
  - Binary size < 4 MB per model (all models under 1.0 MB).
  - Mesh geometry valid and watertight (glTF 2.0 binary, POSITION & NORMAL attributes).
  - Center positioned at `(0, 0, 0)` with standard ~8-unit bounding footprint (`boundingRadius: 8.000`).
- [x] A manifest JSON file (`frontend/public/models/facilities/manifest.json`) is generated documenting node IDs, file sizes, and bounding sphere radii for the loader.

