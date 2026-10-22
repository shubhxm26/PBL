# 01: Cesium 3D Cyber-Geospatial Viewport & WGS84 Facility Beacons

**What to build:** An enterprise user can access the Digital Twin tab and view a real-world 3D virtual globe powered by CesiumJS with digital world terrain and 3D buildings centered on the Western India corridor, observe 5 multi-echelon facility beacons (JNPT, Bhiwandi, Thane, Nashik, Pune) with dynamic color-coded capacity rings reflecting real-time stock levels, and use 1-click camera navigation buttons to smoothly glide (`flyTo`) between strategic logistics hubs.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] CesiumJS and Vite plugin are configured to cleanly bundle WebWorkers, glTF loaders, and Cesium static assets in both development and production builds.
- [x] Cesium Ion token authentication loads securely from environment variables, displaying a graceful fallback setup guide if unconfigured.
- [x] Central 3D viewport renders the Western India corridor with Cesium World Terrain and photorealistic 3D buildings anchored to real WGS84 geographic coordinates.
- [x] Five multi-echelon logistics facilities (JNPT Port, Bhiwandi DC, Thane Hub, Nashik Depot, Pune Center) display illuminated 3D vertical light beacons and billboards.
- [x] Dynamic holographic 3D stock rings surround each facility beacon, with color and diameter reflecting inventory fill percentage (Green $\ge 60\%$, Amber $30-59\%$, Red $< 30\%$).
- [x] Quick-navigation camera ribbon provides 1-click smooth cinematic glide (`flyTo`) presets for each hub and the full corridor overview.
- [x] Automated tests verify frontend build compilation without asset resolution errors and validate facility node geospatial schemas.
