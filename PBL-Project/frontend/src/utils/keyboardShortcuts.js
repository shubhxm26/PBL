/**
 * keyboardShortcuts.js
 *
 * Centralized keyboard shortcuts controller for instant operational command.
 * Maps operational hotkeys:
 * - '1': 3rd-Person Chase Cam
 * - '2': Driver Cockpit Dashcam
 * - '3': Tactical Drone God-View
 * - '4': Free Orbit Inspection
 * - 'Space': Toggle Simulation Play/Pause
 * - 'Tab': Swap Picture-in-Picture Stage Engine
 * - 'Escape': Dismiss / Minimize All Floating Panels
 * - 't' / 'T': Promote Tactical 3D Engine to Primary Stage
 * - 'm' / 'M': Promote Cesium GIS Engine to Primary Stage
 * - 'r' / 'R': Reset Chase Cam Free-Look Alignment
 */

import { useEffect } from 'react';

export const SHORTCUT_ACTIONS = {
  CAMERA_CHASE: 'CAMERA_CHASE',
  CAMERA_COCKPIT: 'CAMERA_COCKPIT',
  CAMERA_DRONE: 'CAMERA_DRONE',
  CAMERA_FREE_ORBIT: 'CAMERA_FREE_ORBIT',
  TOGGLE_PLAY_PAUSE: 'TOGGLE_PLAY_PAUSE',
  SWAP_PIP_ENGINE: 'SWAP_PIP_ENGINE',
  DISMISS_PANELS: 'DISMISS_PANELS',
  SET_ENGINE_TACTICAL: 'SET_ENGINE_TACTICAL',
  SET_ENGINE_CESIUM: 'SET_ENGINE_CESIUM',
  RESET_CAMERA: 'RESET_CAMERA'
};

/**
 * Checks if the target of a keyboard event is an interactive form input.
 *
 * @param {EventTarget} target
 * @returns {boolean}
 */
export function isInputTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Pure dispatcher that translates a KeyboardEvent into an action and invokes the corresponding callback.
 *
 * @param {KeyboardEvent} event
 * @param {Object} handlers
 * @param {Function} [handlers.onCameraMode] - Called with 'CHASE' | 'COCKPIT' | 'DRONE' | 'FREE_ORBIT'
 * @param {Function} [handlers.onTogglePlayPause] - Called to toggle simulation
 * @param {Function} [handlers.onSwapPip] - Called to toggle/swap active stage engine
 * @param {Function} [handlers.onDismissPanels] - Called to minimize all open service panels
 * @param {Function} [handlers.onSetEngine] - Called with 'tactical_3d' | 'cesium_gis'
 * @param {Function} [handlers.onResetCamera] - Called to reset chase free-look
 * @returns {string|null} The resolved action key if handled, or null
 */
export function dispatchKeyboardShortcut(event, handlers = {}) {
  if (!event || isInputTarget(event.target)) {
    return null;
  }

  const { key, code } = event;

  // 1. Camera switching hotkeys [1-4]
  if (key === '1') {
    if (typeof handlers.onCameraMode === 'function') handlers.onCameraMode('CHASE');
    return SHORTCUT_ACTIONS.CAMERA_CHASE;
  }
  if (key === '2') {
    if (typeof handlers.onCameraMode === 'function') handlers.onCameraMode('COCKPIT');
    return SHORTCUT_ACTIONS.CAMERA_COCKPIT;
  }
  if (key === '3') {
    if (typeof handlers.onCameraMode === 'function') handlers.onCameraMode('DRONE');
    return SHORTCUT_ACTIONS.CAMERA_DRONE;
  }
  if (key === '4') {
    if (typeof handlers.onCameraMode === 'function') handlers.onCameraMode('FREE_ORBIT');
    return SHORTCUT_ACTIONS.CAMERA_FREE_ORBIT;
  }

  // 2. Play / Pause simulation toggle [Space]
  if (key === ' ' || code === 'Space') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof handlers.onTogglePlayPause === 'function') handlers.onTogglePlayPause();
    return SHORTCUT_ACTIONS.TOGGLE_PLAY_PAUSE;
  }

  // 3. PiP swap / dual-engine switch [Tab]
  if (key === 'Tab') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof handlers.onSwapPip === 'function') handlers.onSwapPip();
    return SHORTCUT_ACTIONS.SWAP_PIP_ENGINE;
  }

  // 4. Dismiss all floating service panels [Escape]
  if (key === 'Escape' || key === 'Esc') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof handlers.onDismissPanels === 'function') handlers.onDismissPanels();
    return SHORTCUT_ACTIONS.DISMISS_PANELS;
  }

  // 5. Explicit stage engine selection [T / M]
  if (key === 't' || key === 'T') {
    if (typeof handlers.onSetEngine === 'function') handlers.onSetEngine('tactical_3d');
    return SHORTCUT_ACTIONS.SET_ENGINE_TACTICAL;
  }
  if (key === 'm' || key === 'M') {
    if (typeof handlers.onSetEngine === 'function') handlers.onSetEngine('cesium_gis');
    return SHORTCUT_ACTIONS.SET_ENGINE_CESIUM;
  }

  // 6. Reset chase cam alignment [R]
  if (key === 'r' || key === 'R') {
    if (typeof handlers.onResetCamera === 'function') handlers.onResetCamera();
    return SHORTCUT_ACTIONS.RESET_CAMERA;
  }

  return null;
}

/**
 * React hook that registers global window keyboard listeners for operational shortcuts.
 *
 * @param {Object} handlers
 */
export function useGlobalKeyboardShortcuts(handlers = {}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      dispatchKeyboardShortcut(event, handlers);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlers.onCameraMode,
    handlers.onTogglePlayPause,
    handlers.onSwapPip,
    handlers.onDismissPanels,
    handlers.onSetEngine,
    handlers.onResetCamera
  ]);
}
