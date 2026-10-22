import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Navigation,
  FileCheck2,
  ShieldAlert,
  Globe,
  Cpu,
  Lock,
  Minus,
  RotateCcw,
  Sparkles,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { DOCK_SERVICES } from '../constants/dockConfig';
import { usePersona } from '../context/PersonaContext';
import { useWorkspace } from '../context/WorkspaceContext';

const ICON_MAP = {
  kpis: BarChart3,
  forecasting: TrendingUp,
  routing: Navigation,
  compliance: FileCheck2,
  sentinel: ShieldAlert,
  twin: Globe,
  system: Cpu
};

export default function GlassDock() {
  const { currentRole, profile, switchPersona } = usePersona();
  const {
    windows,
    toggleWindow,
    isAllowed,
    minimizeAll,
    restoreAll,
    resetLayout
  } = useWorkspace();

  const [hoveredId, setHoveredId] = useState(null);
  const [lockedNotice, setLockedNotice] = useState(null);

  const handleDockClick = (service) => {
    const allowed = isAllowed(service.viewRequired);
    if (!allowed) {
      setLockedNotice({
        service: service.label,
        role: profile?.title || currentRole,
        viewRequired: service.viewRequired
      });
      setTimeout(() => setLockedNotice(null), 4000);
      return;
    }
    toggleWindow(service.id);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-auto">
      {/* RBAC Lock Toast Notice */}
      {lockedNotice && (
        <div className="mb-3 cyber-glass rounded-xl px-4 py-2.5 border border-rose-500/60 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-white">{lockedNotice.service}</span> is locked for{' '}
            <span className="text-rose-300 font-bold">{lockedNotice.role}</span>.
          </div>
          <button
            onClick={() => {
              switchPersona('admin');
              setLockedNotice(null);
            }}
            className="text-[11px] font-bold px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm ml-1"
          >
            Switch to Admin
          </button>
          <button
            onClick={() => setLockedNotice(null)}
            className="text-slate-400 hover:text-white text-xs ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Floating Frosted Glass Dock Toolbar */}
      <nav
        aria-label="Service Dock"
        className="cyber-glass-dock rounded-2xl px-3 py-2 flex items-center gap-1.5 sm:gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-slate-700/60 backdrop-blur-2xl"
      >
        {DOCK_SERVICES.map((service) => {
          const Icon = ICON_MAP[service.id] || BarChart3;
          const allowed = isAllowed(service.viewRequired);
          const win = windows[service.id];
          const isOpen = win?.isOpen;
          const isMinimized = win?.isMinimized;
          const isHovered = hoveredId === service.id;

          return (
            <div key={service.id} className="relative group flex flex-col items-center">
              {/* Tooltip Label */}
              {isHovered && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 cyber-glass px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-bold text-white whitespace-nowrap shadow-xl pointer-events-none z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-1.5">
                    <span>{service.label}</span>
                    {!allowed && (
                      <span className="text-[10px] text-rose-400 font-mono font-bold flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> LOCKED
                      </span>
                    )}
                  </div>
                  {/* Triangle pointer */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0B0F19] rotate-45 border-r border-b border-slate-700" />
                </div>
              )}

              {/* Service Toggle Button */}
              <button
                onClick={() => handleDockClick(service)}
                onMouseEnter={() => setHoveredId(service.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 ${
                  !allowed
                    ? 'opacity-40 cursor-not-allowed bg-slate-900/60 border border-slate-800 text-slate-500'
                    : isOpen && !isMinimized
                      ? 'bg-slate-800/90 text-white border border-slate-600 shadow-md scale-105'
                      : 'hover:bg-slate-800/60 text-slate-300 hover:text-white border border-transparent hover:border-slate-700/60 hover:scale-105'
                }`}
                style={
                  allowed && (isHovered || (isOpen && !isMinimized))
                    ? { boxShadow: `0 0 16px -2px ${service.themeColor}50` }
                    : undefined
                }
              >
                <Icon
                  className="w-5 h-5 sm:w-6 sm:h-6 transition-colors"
                  style={{
                    color: allowed
                      ? (isOpen && !isMinimized ? service.themeColor : undefined)
                      : '#64748b'
                  }}
                />

                {/* Lock Badge for RBAC Restricted Services */}
                {!allowed && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-950 border border-rose-500/70 text-rose-400 flex items-center justify-center shadow-xs">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                )}

                {/* Minimized Docked Badge */}
                {isOpen && isMinimized && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900 animate-pulse" />
                )}
              </button>

              {/* Active Indicator Dot / Line Beneath Icon */}
              <div className="h-1 w-6 mt-1 flex items-center justify-center">
                {isOpen && !isMinimized && (
                  <span
                    className="h-1 w-3.5 rounded-full shadow-xs transition-all"
                    style={{ backgroundColor: service.themeColor }}
                  />
                )}
                {isOpen && isMinimized && (
                  <span className="h-1 w-1.5 rounded-full bg-amber-400 shadow-xs" />
                )}
              </div>
            </div>
          );
        })}

        {/* Vertical Divider */}
        <div className="h-7 w-[1px] bg-slate-700/60 mx-1 sm:mx-1.5" />

        {/* Quick Dock Action Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={minimizeAll}
            title="Minimize all open panels"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 transition active:scale-90"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={resetLayout}
            title="Reset workspace panels to default layout"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition active:scale-90"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>
    </div>
  );
}
