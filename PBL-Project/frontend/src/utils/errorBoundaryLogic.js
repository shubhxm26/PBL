/**
 * errorBoundaryLogic.js
 *
 * Core state machine and diagnostic formatter for cyber-physical ErrorBoundaries.
 * Handles isolation, state recovery, and error diagnostics across 3D viewports and service panels.
 */

export function createInitialErrorState() {
  return {
    hasError: false,
    error: null,
    errorInfo: null
  };
}

export function computeDerivedErrorState(error) {
  return {
    hasError: true,
    error: error instanceof Error ? error : new Error(String(error))
  };
}

export function executeErrorRecovery(onRecover) {
  if (typeof onRecover === 'function') {
    onRecover();
  }
  return createInitialErrorState();
}

export function formatDiagnosticLog(error) {
  if (!error) return 'No anomaly detected';
  const name = error.name || 'RuntimeError';
  const message = error.message || 'Unknown runtime exception';
  return `[${name}] ${message}`;
}
