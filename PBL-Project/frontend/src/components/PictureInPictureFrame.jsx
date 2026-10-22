import React from 'react';
import {
  Maximize2,
  Minimize2,
  ArrowLeftRight,
  Radio,
  Eye,
  Globe,
  Truck,
  Sparkles
} from 'lucide-react';
import { STAGE_ENGINES, ENGINE_METADATA } from '../utils/engineSynchronization.js';

/**
 * PictureInPictureFrame
 *
 * Floating glassmorphic corner inset rendering the secondary viewport engine
 * (e.g. mini Cesium globe radar while in R3F chase mode, or mini tactical chase cam while in Cesium globe mode).
 */
export default function PictureInPictureFrame({
  secondaryEngine = STAGE_ENGINES.CESIUM_GIS,
  onSwap = () => {},
  isMinimized = false,
  onToggleMinimize = () => {},
  children,
  className = ''
}) {
  const metadata = ENGINE_METADATA[secondaryEngine] || ENGINE_METADATA[STAGE_ENGINES.CESIUM_GIS];
  const Icon = secondaryEngine === STAGE_ENGINES.CESIUM_GIS ? Globe : Truck;

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-6 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={() => onToggleMinimize(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl cyber-glass border border-slate-700/80 hover:border-cyan-400/60 shadow-xl backdrop-blur-xl text-slate-200 text-xs font-bold transition hover:scale-105 active:scale-95 group"
          title={`Expand ${metadata.name} Picture-in-Picture [PiP]`}
        >
          <div className="relative flex items-center justify-center">
            <Icon className="w-4 h-4 text-cyan-400 group-hover:animate-spin" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span>Expand {metadata.shortName} PiP</span>
          <Maximize2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-20 right-6 w-96 h-60 z-30 pointer-events-auto flex flex-col rounded-2xl cyber-glass border border-slate-700/80 hover:border-cyan-500/60 shadow-[0_10px_35px_rgba(0,0,0,0.65)] backdrop-blur-2xl overflow-hidden transition-all duration-300 group ${className}`}
      role="complementary"
      aria-label={`${metadata.name} Picture-in-Picture Viewport`}
    >
      {/* PiP Header Toolbar */}
      <div className="h-8 px-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between z-10 shrink-0 text-slate-200 select-none">
        <div
          onClick={onSwap}
          className="flex items-center gap-2 cursor-pointer hover:text-white transition"
          title="Click to promote this engine to Full-Screen Stage"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Icon className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-extrabold uppercase tracking-wide">
            {metadata.shortName}
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold">
            PiP RADAR
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSwap}
            className="p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition"
            title="Swap with Primary Full-Screen Stage"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleMinimize(true)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
            title="Minimize PiP Window"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* PiP Viewport Content Body */}
      <div
        className="relative flex-1 w-full h-full overflow-hidden cursor-pointer"
        onDoubleClick={onSwap}
        title="Double-click to promote to Full-Screen Stage"
      >
        {children}

        {/* Subtle PiP Hover Overlay with Swap Hint */}
        <div className="absolute inset-0 bg-cyan-950/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-end justify-end p-2">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900/90 text-cyan-300 border border-cyan-500/40 shadow-lg">
            Click to Swap ⇄
          </span>
        </div>
      </div>
    </div>
  );
}
