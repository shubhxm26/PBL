# 05: End-to-End Hardening, Offline Fallback & Persona Verification

**What to build:** Any enterprise user can run the complete platform across all 4 persona workflows (Director, Dispatcher, Customs, Admin) with zero console errors, verify graceful fallback with setup instructions if `VITE_CESIUM_ION_TOKEN` is unconfigured, experience automatic WebSocket reconnection upon network drops, and achieve steady 60 FPS performance verified by the automated end-to-end test suite.

**Blocked by:** 04: Modernized Glassmorphic Command Center & Scenario Studio

**Status:** completed

- [x] Graceful fallback view renders interactive setup instructions and 3D schematic rendering when `VITE_CESIUM_ION_TOKEN` is unconfigured or invalid, without crashing the tab.
- [x] WebSocket streaming client automatically reconnects upon temporary network disconnection and resynchronizes 3D node and corridor states.
- [x] Rendering performance maintains $\ge 60$ FPS on standard hardware through macro-facility aggregation and optimized polyline shaders.
- [x] End-to-end operational verification across all 4 personas confirms correct RBAC permissions, camera navigation, and metric filtering.
- [x] Automated end-to-end test suite passes completely across all backend engines (`pytest`) and frontend production build/lint (`npm run build`, `npx oxlint`).
- [x] Project documentation and setup instructions in `README.md` are updated with Cesium Ion token configuration and 3D Digital Twin walkthrough steps.
