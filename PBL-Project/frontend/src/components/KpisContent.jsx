import React from 'react';
import {
  TrendingUp,
  Truck,
  CheckCircle2,
  BarChart3,
  Activity,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Radio,
  Boxes
} from 'lucide-react';
import { usePersona } from '../context/PersonaContext';
import { useWorkspace } from '../context/WorkspaceContext';

export default function KpisContent() {
  const { profile, currentRole } = usePersona();
  const { toggleWindow } = useWorkspace();

  return (
    <div className="space-y-5 text-slate-100">
      {/* 4 Core High-Level KPI Cards with Cyber Obsidian Glass */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Card 1: Freight Volume (Safety Orange) */}
        <div className="cyber-glass p-4 rounded-xl border border-slate-700/60 border-l-4 border-l-[#FF5400] bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Corridor Freight Volume
            </span>
            <Truck className="w-4 h-4 text-orange-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-white font-mono-num">
              4,850 T
            </span>
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center">
              +14.2% <TrendingUp className="w-3 h-3 ml-0.5" />
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            JNPT ↔ Nashik active throughput
          </span>
        </div>

        {/* Card 2: On-Time SLA (Signal Emerald) */}
        <div className="cyber-glass p-4 rounded-xl border border-slate-700/60 border-l-4 border-l-[#00C853] bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              On-Time SLA Delivery
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-white font-mono-num">
              98.4%
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              Target 98.0%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Autonomous corridor tracking active
          </span>
        </div>

        {/* Card 3: Forecast Error (Solar Yellow) */}
        <div className="cyber-glass p-4 rounded-xl border border-slate-700/60 border-l-4 border-l-[#FFB703] bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Forecast Error (WAPE)
            </span>
            <BarChart3 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-white font-mono-num">
              4.1%
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
              PyTorch LSTM
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            95% CI bounded
          </span>
        </div>

        {/* Card 4: Active Transit (Vivid Coral) */}
        <div className="cyber-glass p-4 rounded-xl border border-slate-700/60 border-l-4 border-l-[#FF1744] bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Transit Fleets
            </span>
            <Activity className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-white font-mono-num">
              24 Units
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
              0 Disrupted
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Live 1Hz GPS telemetry online
          </span>
        </div>
      </div>

      {/* Multi-Echelon Corridor Stock Health */}
      <div className="cyber-glass p-4 rounded-xl border border-slate-700/60 bg-slate-900/30 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Multi-Echelon Facility Capacity Status
            </h4>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">ALL NOMINAL</span>
        </div>

        <div className="space-y-2">
          {[
            { node: 'PORT-JNPT-01', name: 'JNPT Maritime Port', fill: 84, color: 'bg-emerald-500' },
            { node: 'DC-BHW-01', name: 'Bhiwandi Central DC', fill: 76, color: 'bg-emerald-500' },
            { node: 'HUB-THN-01', name: 'Thane Regional Hub', fill: 68, color: 'bg-emerald-500' },
            { node: 'DEP-NSK-01', name: 'Nashik Agro Depot', fill: 55, color: 'bg-amber-500' },
            { node: 'FC-PUN-01', name: 'Pune Auto FC', fill: 82, color: 'bg-emerald-500' }
          ].map((item) => (
            <div key={item.node} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">{item.name}</span>
                <span className="font-mono text-slate-400 font-bold">{item.fill}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full`}
                  style={{ width: `${item.fill}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Launch Service Workflows */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Quick Operational Launchers
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => toggleWindow('routing')}
            className="p-3 rounded-xl cyber-glass hover:bg-emerald-950/30 border border-slate-700/60 hover:border-emerald-500/50 text-left transition flex items-center justify-between group active:scale-[0.98]"
          >
            <div>
              <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                Launch Route Optimizer
              </div>
              <div className="text-[10px] text-slate-400">Backhaul matching & electric fleet</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
          </button>

          <button
            onClick={() => toggleWindow('sentinel')}
            className="p-3 rounded-xl cyber-glass hover:bg-cyan-950/30 border border-slate-700/60 hover:border-cyan-500/50 text-left transition flex items-center justify-between group active:scale-[0.98]"
          >
            <div>
              <div className="text-xs font-bold text-white group-hover:text-cyan-300">
                Autonomous Sentinel HUD
              </div>
              <div className="text-[10px] text-slate-400">Corridor threat telemetry & detours</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition" />
          </button>
        </div>
      </div>
    </div>
  );
}
