import React, { Component } from 'react';
import { RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import {
  createInitialErrorState,
  computeDerivedErrorState,
  executeErrorRecovery,
  formatDiagnosticLog
} from '../utils/errorBoundaryLogic.js';

/**
 * ErrorBoundary
 *
 * Cyber-Physical Error Boundary that isolates rendering failures
 * in 3D WebGL canvases or glassmorphic service panels without crashing
 * the entire operational stage.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = createInitialErrorState();
  }

  static getDerivedStateFromError(error) {
    return computeDerivedErrorState(error);
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary caught in ${this.props.name || 'Component'}]:`, error, errorInfo);
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleRecover = () => {
    this.setState(executeErrorRecovery(this.props.onRecover));
  };

  handleResetWorkspace = () => {
    try {
      localStorage.removeItem('neologix_workspace_state_v1');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, recover: this.handleRecover })
          : this.props.fallback;
      }

      const componentName = this.props.name || 'Operational Module';

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="relative w-full h-full min-h-[220px] rounded-2xl p-6 bg-[#0B0F19]/95 border-2 border-rose-500/60 shadow-2xl flex flex-col justify-between text-slate-100 select-none backdrop-blur-xl animate-in fade-in"
        >
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-white">
                  {componentName} Intercepted an Anomaly
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/80 font-bold uppercase">
                  RECOVERABLE
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                A rendering or runtime exception occurred in this module. The persistent 3D world stage and other service panels remain operational.
              </p>
            </div>
          </div>

          {/* Diagnostic Log */}
          <div className="my-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-rose-300/90 overflow-x-auto max-h-24">
            <div className="font-bold text-rose-400">
              {formatDiagnosticLog(this.state.error)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={this.handleRecover}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/30 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Module</span>
            </button>
            <button
              type="button"
              onClick={this.handleResetWorkspace}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
