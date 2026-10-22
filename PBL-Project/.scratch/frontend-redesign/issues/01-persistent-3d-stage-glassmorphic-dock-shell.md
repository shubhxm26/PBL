# 01: Persistent 3D Stage & Glassmorphic Dock Shell

**What to build:**
Transform the application shell from a traditional multi-tab page layout into a persistent full-viewport 3D operational workspace. The top bar features a translucent Cyber-Dark status header with system time, active corridor route indicator, and a role-adaptive persona quick-switcher. At the bottom, a floating frosted glass Dock toolbar hosts service toggles that open floating, draggable, collapsible glassmorphic panels over the viewport without unmounting or resetting the underlying 3D canvas.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] The application renders a full-viewport continuous 3D canvas stage with a Cyber-Physical Dark Obsidian palette (`#020617` / `#0B0F19`).
- [x] The top status bar displays the platform title, active corridor indicator, simulation connectivity status, and persona selector.
- [x] Switching persona updates user profile state and dynamically enables, highlights, or locks dock service toggles based on role clearance.
- [x] The floating glassmorphic Dock renders with backdrop blur, glowing icon hover states, and active status indicators.
- [x] Clicking dock icons toggles floating glassmorphic panels that can be minimized, dragged, or closed without disturbing the viewport.
- [x] Automated tests verify window toggle state persistence and role-adaptive access control.

