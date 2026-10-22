# 01: Map3D Maharashtra Re-Centering & 6-Hub Preset Selector

**What to build:** An updated map selection workflow inside the `map3d` tool where the default Leaflet map viewport immediately centers on the Western India logistics corridor (Maharashtra) instead of New York, accompanied by a dedicated toolbar featuring the 6 project logistics hubs (`JNPT Port`, `Panvel Depot`, `Thane Hub`, `Bhiwandi Mega DC`, `Nashik Depot`, `Pune FC`). Clicking any facility button automatically sets the exact GPS coordinates and bounding box, advancing the workflow directly to 3D building and road queries without requiring manual map panning or imprecise drag selection.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] `map3d/src/constants/facilityPresets.ts` defines GPS center coordinates, bounding footprint delta (~900m radius), and metadata for all 6 hubs:
  - `PORT-JNPT-01`: JNPT Port Container Terminal (18.9496, 72.9515)
  - `DEP-PNV-01`: Panvel Logistics Depot (18.9894, 73.1175)
  - `HUB-THN-01`: Thane Regional Hub (19.2183, 72.9781)
  - `DC-BHW-01`: Bhiwandi Central Mega DC (19.2967, 73.0631)
  - `DEP-NSK-01`: Nashik Agro Depot (19.9975, 73.7898)
  - `FC-PUN-01`: Pune Auto Fulfillment Center (18.5204, 73.8567)
- [x] `SelectMap.tsx` and `areaStore.ts` default Leaflet center is updated to Maharashtra (`[19.15, 73.05]`, zoom level 10).
- [x] A clean preset selector bar is embedded in `SelectMap.tsx` / `App.tsx` showing interactive buttons for each of the 6 facilities.
- [x] Clicking any facility preset locks the bounding rectangle on the map, updates `areaStore`, and enables the "Next Step" action immediately.
