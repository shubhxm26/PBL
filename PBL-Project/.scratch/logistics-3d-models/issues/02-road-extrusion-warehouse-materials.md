# 02: 3D Extruded Road Ribbons & Industrial Warehouse Material Classification

**What to build:** An enhanced 3D mesh generation pipeline in `map3d` where highways and roads are extruded as solid 3D ribbons with physical width (rather than 1px line wireframes that do not export properly to GLTF), and buildings are semantically differentiated by OpenStreetMap tags. Industrial facilities, logistics warehouses, and port terminals are styled with distinct metallic/slate architectural materials and dock highlights, while surrounding structures render as muted urban blocks, resting on a foundational asphalt ground plane.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Road generation in `Space.tsx` replaces standard `Line` with extruded quad ribbon geometry (`BufferGeometry` / `TubeGeometry`) with physical width (~3-5m scale) so road surfaces export as solid meshes in GLTF/GLB.
- [x] Buildings are categorized by OSM tags (`building: industrial`, `warehouse`, `commercial`, `port`, `storage`):
  - Industrial/warehouses receive modern slate/graphite metallic PBR materials (`#1e293b` / `#334155`).
  - General residential/commercial buildings receive neutral stone materials (`#64748b` / `#94a3b8`).
- [x] A planar asphalt/terrain ground slab is generated beneath the scene matching the bounding box bounds (`#0f172a`), eliminating floating buildings in 3D void.
- [x] All generated road meshes and ground geometry have `userData: { exportToGLB: true }` assigned so they export cleanly into the GLB payload.
