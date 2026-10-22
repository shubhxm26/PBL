# Feature Specification: 3D GLB Logistics Hub Models & Integration

## Overview

This feature upgrades the 3D Digital Twin visualization across the Western India logistics corridor by generating and integrating authentic OpenStreetMap-derived 3D `.glb` architectural models for 6 core facilities using the project's internal `map3d` tool.

The procedural placeholder boxes in `PersistentStage3D.jsx` are replaced with realistic 3D digital twins featuring solid extruded road ribbons, industrial warehouse classification, and emissive night-mode lighting channels, with zero regression on existing telemetry HUDs, holographic beacons, and 60 FPS performance.

## Target Facilities

1. **PORT-JNPT-01**: JNPT Port Container Terminal (Navi Mumbai)
2. **DEP-PNV-01**: Panvel Logistics Depot (Panvel)
3. **HUB-THN-01**: Thane Regional Hub / Cold Chain DC (Thane)
4. **DC-BHW-01**: Bhiwandi Central Mega DC (Bhiwandi)
5. **DEP-NSK-01**: Nashik Agro Depot (Nashik)
6. **FC-PUN-01**: Pune Auto Fulfillment Center (Pune)
*(Kasara Ghat retains its dedicated procedural mountain pass mesh)*

## Published Tickets

- [01: Map3D Maharashtra Re-Centering & 6-Hub Preset Selector](issues/01-map3d-maharashtra-presets.md)
- [02: 3D Extruded Road Ribbons & Industrial Warehouse Material Classification](issues/02-road-extrusion-warehouse-materials.md)
- [03: Emissive Day/Night Lighting & Origin-Normalized GLB Exporter](issues/03-emissive-lighting-normalized-glb-exporter.md)
- [04: Generation & Asset Delivery of the 6 Corridor Hub Models](issues/04-generate-deliver-corridor-hub-models.md)
- [05: PersistentStage3D In-Place GLB Integration with Procedural Fallback & Night Glow Sync](issues/05-persistentstage3d-gltf-integration.md)
- [06: Camera View Telemetry Profiling & WebGL Performance Verification](issues/06-camera-views-performance-verification.md)
