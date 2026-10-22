import React, { useState, useEffect } from 'react';
import {
  Box,
  Radio,
  Clock,
  Layers,
  Truck,
  FileCheck2,
  Cpu,
  ChevronDown,
  Check,
  RotateCcw,
  Minimize2,
  Activity,
  ArrowRight,
  ShieldAlert,
  Server,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { usePersona } from '../context/PersonaContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { CORRIDOR_INFO } from '../constants/dockConfig';

const PERSONA_ICONS = {
  director: Layers,
  dispatcher: Truck,
  customs: FileCheck2,
  admin: Cpu
};

const PERSONA_COLORS = {
  director: {
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    dot: 'bg-orange-400',
    glow: 'rgba(255, 84, 0, 0.4)'
  },
  dispatcher: {
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    dot: 'bg-emerald-400',
    glow: 'rgba(0, 200, 83, 0.4)'
  },
  customs: {
    badge: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    dot: 'bg-rose-400',
    glow: 'rgba(255, 23, 68, 0.4)'
  },
  admin: {
    badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    dot: 'bg-purple-400',
    glow: 'rgba(168, 85, 247, 0.4)'
  }
};

export default function CyberStatusBar() {
  const { currentRole, profile, rolesMap, switchPersona } = usePersona();
  const { resetLayout, minimizeAll, restoreAll } = useWorkspace();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState({ utc: '', ist: '' });
  const [corridorTooltipOpen, setCorridorTooltipOpen] = useState(false);

  // Live system clock ticking every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const utcStr = now.toISOString().slice(11, 19) + ' UTC';
      const istStr = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' IST';
      setCurrentTime({ utc: utcStr, ist: istStr });
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const ActiveIcon = PERSONA_ICONS[currentRole] || Layers;
  const personaTheme = PERSONA_COLORS[currentRole] || PERSONA_COLORS.director;

  return (
    <header className="fixed top-0 inset-x-0 h-14 z-40 cyber-header px-4 sm:px-6 flex items-center justify-between text-slate-100 select-none shadow-2xl">
      {/* Left: Platform Branding & Live Beacon */}
      <div className="flex items-center gap-3.5">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/30">
          <Box className="w-4 h-4 stroke-[2.4]" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400 border border-slate-900" />
          </span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
              NEO-LOGIX <span className="text-cyan-400 text-xs font-mono font-bold">3D TWIN</span>
            </span>
            <span className="hidden md:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-bold">
              v2.4 AUTONOMOUS
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400 hidden lg:inline-block leading-tight">
            Cognitive Smart Logistics & Autonomous Freight Platform
          </span>
        </div>
      </div>

      {/* Center: Active Corridor Route Indicator */}
      <div className="relative hidden md:flex items-center">
        <button
          onClick={() => setCorridorTooltipOpen(!corridorTooltipOpen)}
          className="cyber-glass px-3.5 py-1.5 rounded-xl border border-slate-700/60 hover:border-cyan-500/50 flex items-center gap-2.5 transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-200">
            <span className="text-cyan-400">JNPT</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="text-slate-300">BHW</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="text-amber-400">KASARA</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="text-emerald-400">NSK</span>
          </div>

          <span className="text-slate-600">|</span>

          <span className="text-[11px] font-mono font-bold text-slate-300">
            {CORRIDOR_INFO.code}
          </span>

          <span className="flex items-center gap-1 text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {CORRIDOR_INFO.status}
          </span>
        </button>

        {/* Detailed Corridor Popover */}
        {corridorTooltipOpen && (
          <div className="absolute top-11 left-1/2 -translate-x-1/2 w-80 cyber-glass rounded-xl p-3 border border-slate-700/80 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-extrabold text-white">{CORRIDOR_INFO.name}</span>
              <span className="text-[10px] font-mono text-cyan-400 font-bold">{CORRIDOR_INFO.totalDistanceKm} KM</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {CORRIDOR_INFO.stops.map((stop, i) => (
                <div key={stop.code} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span className="text-slate-500 font-mono text-[10px]">{i + 1}.</span>
                    <strong>{stop.code}</strong> - {stop.name}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">STATUS:</span>
              <span className="text-emerald-400 font-bold">{CORRIDOR_INFO.statusLabel}</span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Telemetry Connectivity, Clock & Role Persona Selector */}
      <div className="flex items-center gap-3">
        {/* Simulation Connectivity Badge */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
            1Hz WS LIVE
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">24ms</span>
          <span className="text-slate-600">•</span>
          <span className="text-cyan-400 font-bold">60 FPS</span>
        </div>

        {/* Real-time Clock Ticker */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentTime.ist || '17:30:00 IST'}</span>
        </div>

        {/* Role-Adaptive Persona Quick-Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-md active:scale-[0.98] ${personaTheme.badge}`}
          >
            <ActiveIcon className="w-3.5 h-3.5" />
            <span className="capitalize">{currentRole}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${personaTheme.dot}`} />
            <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-11 w-72 cyber-glass rounded-2xl p-2.5 border border-slate-700/80 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95">
              <div className="px-2.5 py-2 border-b border-slate-800 mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Select Operational Persona (RBAC)
                </span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                  Dynamically filters Dock service clearance
                </span>
              </div>

              <div className="space-y-1">
                {Object.keys(rolesMap || {}).map((roleKey) => {
                  const r = rolesMap[roleKey];
                  const isSelected = currentRole === roleKey;
                  const Icon = PERSONA_ICONS[roleKey] || Layers;
                  const color = PERSONA_COLORS[roleKey] || PERSONA_COLORS.director;

                  return (
                    <button
                      key={roleKey}
                      onClick={() => {
                        switchPersona(roleKey);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-slate-800/80 border border-slate-700 text-white'
                          : 'hover:bg-slate-800/40 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${color.badge}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white capitalize">{r.title || roleKey}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{r.description}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Workspace Layout Quick Actions */}
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between px-1">
                <button
                  onClick={() => {
                    minimizeAll();
                    setDropdownOpen(false);
                  }}
                  className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 p-1 rounded transition"
                  title="Minimize all open service panels"
                >
                  <Minimize2 className="w-3 h-3" /> Minimize All
                </button>
                <button
                  onClick={() => {
                    resetLayout();
                    setDropdownOpen(false);
                  }}
                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 p-1 rounded transition"
                  title="Reset floating panel layout to default"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Layout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
