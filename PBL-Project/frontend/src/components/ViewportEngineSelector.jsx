import React from 'react';
import {
  Truck,
  Globe,
  Radio,
  Repeat,
  Sparkles,
  Maximize2
} from 'lucide-react';
import {
  STAGE_ENGINES,
  ENGINE_METADATA,
  toggleStageEngine
} from '../utils/engineSynchronization.js';

/**
 * ViewportEngineSelector
 *
 * Floating glassmorphic segmented engine selector for switching between
 * 'Tactical R3F Twin' (Three.js 3rd-person chase) and 'Macro Cesium GIS' (WGS84 Photorealistic Globe).
 */
export default function ViewportEngineSelector({
  activeEngine = STAGE_ENGINES.TACTICAL_3D,
  onSelectEngine = () => {},
  isPiPVisible = true,
  onTogglePiP = () => {},
  className = ''
}) {
  const isTactical = activeEngine === STAGE_ENGINES.TACTICAL_3D;
  const isCesium = activeEngine === STAGE_ENGINES.CESIUM_GIS;

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 p-1.5 rounded-2xl cyber-glass border border-slate-700/80 shadow-2xl backdrop-blur-2xl select-none text-slate-100 ${className}`}
      role="region"
      aria-label="3D Viewport Engine Selector"
    >
      {/* 1. Tactical R3F Twin Toggle Button */}
      <button
        type="button"
        onClick={() => onSelectEngine(STAGE_ENGINES.TACTICAL_3D)}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          isTactical
            ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
        }`}
        title="Switch to Tactical 3D World (Procedural logistics, Kasara elevation, 3rd-person chase cam) [T]"
      >
        <Truck className={`w-3.5 h-3.5 ${isTactical ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
        <div className="flex flex-col text-left leading-tight">
          <span className="font-extrabold tracking-tight">Tactical R3F Twin</span>
          <span className="text-[9px] font-mono text-cyan-400/90 font-semibold">60 FPS • CHASE CAM</span>
        </div>
        {isTactical && (
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
        )}
      </button>

      {/* Center Synchronization Badge & Swap Quick-Action */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-800 text-[10px] font-mono text-slate-400">
        <button
          type="button"
          onClick={() => onSelectEngine(toggleStageEngine(activeEngine))}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
          title="Swap Viewport Engines [Tab / E]"
        >
          <Repeat className="w-3 h-3" />
        </button>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <span className="hidden sm:inline font-bold text-slate-300 tracking-wider">
          SYNCED (1Hz WGS84 ↔ 3D)
        </span>
      </div>

      {/* 2. Macro Cesium GIS Toggle Button */}
      <button
        type="button"
        onClick={() => onSelectEngine(STAGE_ENGINES.CESIUM_GIS)}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          isCesium
            ? 'bg-blue-600/30 text-blue-300 border border-blue-400/60 shadow-[0_0_15px_rgba(56,189,248,0.35)]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
        }`}
        title="Switch to Macro Cesium GIS (Photorealistic 3D terrain, OSM buildings, WGS84 globe) [M]"
      >
        <Globe className={`w-3.5 h-3.5 ${isCesium ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`} />
        <div className="flex flex-col text-left leading-tight">
          <span className="font-extrabold tracking-tight">Macro Cesium GIS</span>
          <span className="text-[9px] font-mono text-blue-400/90 font-semibold">WGS84 • SATELLITE</span>
        </div>
        {isCesium && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#38bdf8]" />
        )}
      </button>
    </div>
  );
}
