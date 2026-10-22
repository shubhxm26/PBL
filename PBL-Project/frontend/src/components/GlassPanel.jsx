import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Minus,
  Maximize2,
  Minimize2,
  X,
  GripHorizontal,
  Lock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { usePersona } from '../context/PersonaContext';
import ErrorBoundary from './ErrorBoundary';


export default function GlassPanel({
  id,
  title,
  shortLabel,
  icon: Icon,
  themeColor = '#ff5400',
  viewRequired,
  badgeText,
  children
}) {
  const {
    windows,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    toggleMaximize,
    updatePosition,
    updateSize,
    bringToFront,
    isAllowed
  } = useWorkspace();

  const { currentRole, profile, switchPersona } = usePersona();

  const win = windows[id];
  const isPanelOpen = win?.isOpen;
  const isMinimized = win?.isMinimized;
  const isMaximized = win?.isMaximized;
  const position = win?.position || { x: 30, y: 70 };
  const size = win?.size || { width: 640, height: 580 };
  const zIndex = win?.zIndex || 10;

  const panelRef = useRef(null);
  const dragStartRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Resize handling
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef(null);

  // Dragging handlers with viewport boundary clamping
  const handleMouseDown = useCallback((e) => {
    // Only drag from header bar or drag handle, not buttons or inputs
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }
    bringToFront(id);
    if (isMaximized) return; // cannot drag when maximized

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y
    };
  }, [bringToFront, id, isMaximized, position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      updatePosition(id, dragStartRef.current.posX + dx, dragStartRef.current.posY + dy);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, id, updatePosition]);

  // Corner resize drag handlers
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(id);
    if (isMaximized) return;

    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: size.width,
      height: size.height
    };
  }, [bringToFront, id, isMaximized, size]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      if (!resizeStartRef.current) return;
      const dw = e.clientX - resizeStartRef.current.mouseX;
      const dh = e.clientY - resizeStartRef.current.mouseY;
      updateSize(id, resizeStartRef.current.width + dw, resizeStartRef.current.height + dh);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, id, updateSize]);

  if (!isPanelOpen) return null;

  const allowed = isAllowed(viewRequired);

  // Minimized Floating Pill View (supports drag repositioning across canvas)
  if (isMinimized) {
    return (
      <div
        ref={panelRef}
        onMouseDown={handleMouseDown}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex
        }}
        className="fixed cyber-glass rounded-xl px-3 py-2 border border-slate-700/80 shadow-2xl flex items-center gap-2.5 backdrop-blur-xl cursor-grab active:cursor-grabbing select-none transition-all duration-150 animate-in fade-in"
      >
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: themeColor }}
        >
          {Icon && <Icon className="w-3.5 h-3.5 stroke-[2.2]" />}
        </div>
        <span className="text-xs font-bold text-white whitespace-nowrap">{shortLabel || title}</span>
        <button
          onClick={() => restoreWindow(id)}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Restore window"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => closeWindow(id)}
          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          title="Close window"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      onMouseDown={() => bringToFront(id)}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex
      }}
      className={`fixed cyber-glass rounded-2xl border border-slate-700/50 backdrop-blur-md bg-slate-950/75 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden transition-shadow ${
        isDragging ? 'opacity-95 shadow-cyan-500/10' : ''
      } ${isResizing ? 'select-none pointer-events-auto' : ''}`}
    >
      {/* Draggable Panel Header Bar */}
      <div
        onMouseDown={handleMouseDown}
        className={`px-4 py-3 border-b border-slate-800/80 flex items-center justify-between select-none bg-[#0B0F19]/60 backdrop-blur-md ${
          isMaximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        {/* Left: Icon, Title & Role Tag */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
            style={{ backgroundColor: themeColor }}
          >
            {Icon && <Icon className="w-4 h-4 stroke-[2.2]" />}
          </div>
          <div className="flex items-center gap-2 truncate">
            <h3 className="text-xs sm:text-sm font-extrabold text-white truncate tracking-tight">
              {title}
            </h3>
            {badgeText && (
              <span
                className="hidden sm:inline-block text-[9px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded border tracking-wider shrink-0"
                style={{
                  color: themeColor,
                  borderColor: `${themeColor}60`,
                  backgroundColor: `${themeColor}15`
                }}
              >
                {badgeText}
              </span>
            )}
          </div>
        </div>

        {/* Center: Drag Handle Dots */}
        {!isMaximized && (
          <div className="hidden md:flex items-center justify-center px-4 text-slate-600">
            <GripHorizontal className="w-4 h-4" />
          </div>
        )}

        {/* Right: Window Controls (Minimize, Maximize, Close) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => minimizeWindow(id)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/70 transition"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleMaximize(id)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/70 transition"
            title={isMaximized ? 'Restore Size' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => closeWindow(id)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-800/70 transition"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 relative bg-[#0B0F19]/40">
        {!allowed ? (
          /* Role-Adaptive RBAC Access Barrier */
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-base font-extrabold text-white">RBAC Access Restricted</h4>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Active persona <strong className="text-white font-bold">{profile?.title || currentRole}</strong> does not possess the requisite clearance ({viewRequired}) to interact with this operational module.
            </p>
            <div className="pt-2">
              <button
                onClick={() => switchPersona('admin')}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition shadow-lg shadow-orange-600/30 active:scale-95 flex items-center gap-1.5"
              >
                <span>Switch to IT Administrator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <ErrorBoundary name={title || 'Operational Service Panel'}>
            {children}
          </ErrorBoundary>
        )}

      </div>

      {/* Interactive Bottom-Right Corner Resize Handle */}
      {!isMaximized && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 text-slate-500 hover:text-cyan-400 transition select-none z-30"
          title="Drag to resize panel"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="stroke-current">
            <path d="M7 1L1 7M7 4L4 7" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
