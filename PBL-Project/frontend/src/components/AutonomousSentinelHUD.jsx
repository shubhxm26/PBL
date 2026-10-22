import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  Cpu,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Radio,
  Clock,
  Sparkles,
  RefreshCw,
  Send,
  Compass,
  Navigation,
  PlaneTakeoff,
  AlertOctagon,
  Flame
} from 'lucide-react';
import { api } from '../services/api';
import { telemetryWS } from '../services/websocket';
import { useWorkspace } from '../context/WorkspaceContext';

export const CORRIDOR_INCIDENTS = [
  {
    id: 'INC-KASARA-01',
    roadblockId: 'RB-KASARA-01',
    title: 'Kasara Ghat Mudslide & Barrier Obstruction',
    corridor: 'NH-160 (Mumbai ↔ Nashik)',
    severity: 'CRITICAL',
    disruptionType: 'LANDSLIDE_HAZARD',
    location: [14, 9.8, -24],
    description: 'Active mudslide and debris blockage across north-bound mountain pass lanes at elevation +580m.',
    affectedVehicles: ['TRK-MH-01'],
    mitigationOptions: [
      {
        id: 'mit-01',
        title: 'Execute Autonomous Detour (NH-61 via Malshej Ghat)',
        description: 'Bypasses Kasara roadblock via Kalyan-Malshej route (+21.6 km, +34m duration, preserves 98.4% SLA).',
        actionType: 'DETOUR',
        targetRoute: 'NH-61',
        icon: Navigation,
        buttonText: 'Execute Detour'
      },
      {
        id: 'mit-02',
        title: 'Hold Fleet at Bhiwandi Mega DC Staging Bay',
        description: 'Halts inbound trucks at Bhiwandi buffer staging docks until NDRF mountain clearance.',
        actionType: 'HOLD_FLEET',
        targetFacility: 'DC-BHW-01',
        icon: ShieldAlert,
        buttonText: 'Hold Fleet'
      },
      {
        id: 'mit-03',
        title: 'Dispatch Emergency Drone Reconnaissance',
        description: 'Launches automated LiDAR drone survey over the Kasara Ghat rockfall zone for real-time clearance telemetry.',
        actionType: 'DISPATCH_DRONE',
        icon: PlaneTakeoff,
        buttonText: 'Launch Drone'
      }
    ]
  }
];

export default function AutonomousSentinelHUD({
  compact = false,
  className = '',
  onDirectiveDispatch = null
}) {
  const workspace = useWorkspace();
  const activeIncident = workspace?.activeIncident;
  const selectIncident = workspace?.selectIncident;
  const trigger3DFlyTo = workspace?.trigger3DFlyTo;
  const selectFacility = workspace?.selectFacility;

  const [selectedIncidentId, setSelectedIncidentId] = useState(activeIncident?.id || 'INC-KASARA-01');
  const [mitigationStatus, setMitigationStatus] = useState(null);

  // Sync when 3D scene clicks a roadblock/hazard
  useEffect(() => {
    if (activeIncident?.id && activeIncident.id !== selectedIncidentId) {
      setSelectedIncidentId(activeIncident.id);
      setExpanded(true);
    }
  }, [activeIncident]);

  const handleSelectIncident = (incident) => {
    setSelectedIncidentId(incident.id);
    if (selectIncident) {
      selectIncident(incident);
    }
    if (trigger3DFlyTo) {
      trigger3DFlyTo({
        type: 'incident',
        id: incident.id,
        position: incident.location
      });
    }
  };

  const handleExecuteMitigation = (option, incident) => {
    setMitigationStatus(`Executing: ${option.title}...`);
    if (option.actionType === 'DETOUR') {
      if (trigger3DFlyTo) {
        trigger3DFlyTo({ type: 'route', id: 'NH-61' });
      }
      setTimeout(() => {
        setMitigationStatus(`Detour Active: Fleet unit rerouted via NH-61 Malshej Ghat (+21.6 km).`);
      }, 1000);
    } else if (option.actionType === 'HOLD_FLEET') {
      if (selectFacility) {
        selectFacility(option.targetFacility);
      }
      if (trigger3DFlyTo) {
        trigger3DFlyTo({ type: 'facility', id: option.targetFacility });
      }
      setTimeout(() => {
        setMitigationStatus(`Fleet held at Bhiwandi Mega DC Staging Bay.`);
      }, 1000);
    } else if (option.actionType === 'DISPATCH_DRONE') {
      if (trigger3DFlyTo) {
        trigger3DFlyTo({ type: 'incident', id: incident.id, position: incident.location });
      }
      setTimeout(() => {
        setMitigationStatus(`Drone aerial LiDAR survey live streaming to TMS.`);
      }, 1000);
    }
  };

  const [sentinel, setSentinel] = useState({
    mode: 'AUTONOMOUS_SENTINEL',
    risk_index: 24.5,
    status: 'NOMINAL',
    active_directives: [],
    active_directives_count: 0,
    thresholds: { nominal_ceiling: 40.0, critical_floor: 70.0 }
  });

  const [recentLogs, setRecentLogs] = useState([]);
  const [expanded, setExpanded] = useState(!compact);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // 1. Fetch initial status from REST API
  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTwinAutonomousStatus();
      if (data) {
        setSentinel(prev => ({
          ...prev,
          mode: data.mode || prev.mode,
          risk_index: typeof data.risk_index === 'number' ? data.risk_index : prev.risk_index,
          status: data.status || prev.status,
          active_directives: data.active_directives || [],
          active_directives_count: data.active_directives_count || 0,
          thresholds: data.thresholds || prev.thresholds
        }));
        if (data.recent_decision_log) {
          setRecentLogs(data.recent_decision_log);
        }
      }
    } catch (err) {
      console.warn('[AutonomousSentinelHUD] REST status check failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // 2. Subscribe to live 1Hz WebSocket telemetry ticks
  useEffect(() => {
    telemetryWS.connect();

    const handleTick = (payload) => {
      if (payload && payload.autonomous_sentinel) {
        const liveSentinel = payload.autonomous_sentinel;
        setSentinel(prev => ({
          ...prev,
          mode: liveSentinel.mode || prev.mode,
          risk_index: typeof liveSentinel.risk_index === 'number' ? liveSentinel.risk_index : prev.risk_index,
          status: liveSentinel.status || prev.status,
          active_directives: liveSentinel.active_directives || prev.active_directives,
          active_directives_count: liveSentinel.active_directives_count ?? prev.active_directives_count,
          thresholds: liveSentinel.thresholds || prev.thresholds
        }));
      }
    };

    const unsubscribe = telemetryWS.subscribe('tick', handleTick);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 3. Mode Toggle Handler (Director / Admin RBAC)
  const handleToggleMode = async () => {
    try {
      setToggling(true);
      const nextMode = sentinel.mode === 'AUTONOMOUS_SENTINEL' ? 'MANUAL_OPERATOR' : 'AUTONOMOUS_SENTINEL';
      const result = await api.toggleTwinAutonomousMode(nextMode);
      if (result) {
        setSentinel(prev => ({
          ...prev,
          mode: result.mode || nextMode,
          risk_index: result.risk_index ?? prev.risk_index
        }));
      }
      await refreshStatus();
    } catch (err) {
      console.error('[AutonomousSentinelHUD] Mode toggle failed:', err);
    } finally {
      setToggling(false);
    }
  };

  const isAutonomous = sentinel.mode === 'AUTONOMOUS_SENTINEL';
  const risk = sentinel.risk_index || 0;
  const isCritical = risk >= (sentinel.thresholds?.critical_floor || 70.0);
  const isElevated = risk >= (sentinel.thresholds?.nominal_ceiling || 40.0) && !isCritical;

  // Status Badge Colors & Glow
  const statusConfig = isCritical
    ? {
        label: 'CRITICAL INTERVENTION',
        color: 'text-rose-400 bg-rose-950/80 border-rose-500/80',
        glow: 'shadow-[0_0_12px_rgba(244,63,94,0.4)]',
        barColor: 'bg-rose-500'
      }
    : isElevated
    ? {
        label: 'ELEVATED RISK',
        color: 'text-amber-400 bg-amber-950/80 border-amber-500/80',
        glow: 'shadow-[0_0_10px_rgba(245,158,11,0.3)]',
        barColor: 'bg-amber-500'
      }
    : {
        label: 'NOMINAL VIGILANCE',
        color: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/80',
        glow: 'shadow-[0_0_10px_rgba(16,185,129,0.3)]',
        barColor: 'bg-emerald-500'
      };

  return (
    <div
      className={`pointer-events-auto select-none rounded-2xl bg-slate-950/92 backdrop-blur-md border border-slate-700/80 text-white shadow-2xl transition-all ${className}`}
      data-testid="autonomous-sentinel-hud"
    >
      {/* HUD Header Bar */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
              isCritical
                ? 'bg-rose-950/80 border-rose-500 text-rose-400 animate-pulse'
                : isAutonomous
                ? 'bg-sky-950/80 border-sky-400 text-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                : 'bg-slate-800 border-slate-600 text-slate-400'
            }`}
          >
            {isCritical ? (
              <ShieldAlert className="w-4 h-4" />
            ) : isAutonomous ? (
              <Cpu className="w-4 h-4" />
            ) : (
              <Sliders className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-wider uppercase text-slate-100">
                Autonomous AI Sentinel
              </span>
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <span>1Hz PyTorch Telemetry Stream</span>
            </div>
          </div>
        </div>

        {/* Right Header Action: Minimize / Expand */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={expanded ? 'Minimize Sentinel HUD' : 'Expand Sentinel HUD'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content View */}
      {expanded ? (
        <div className="p-3.5 space-y-3 max-w-sm sm:max-w-md w-full">
          {/* Top Row: Risk Meter & Status Pill */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Corridor Bottleneck Risk
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black font-mono tracking-tight text-white">
                    {risk.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">/ 100</span>
                </div>
              </div>
              <div className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${statusConfig.color} ${statusConfig.glow}`}>
                {statusConfig.label}
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden relative">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${statusConfig.barColor}`}
                style={{ width: `${Math.min(100, Math.max(4, risk))}%` }}
              />
              {/* Threshold tick marks */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-600/80"
                style={{ left: '40%' }}
                title="Nominal Ceiling (40)"
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80"
                style={{ left: '70%' }}
                title="Critical Floor (70)"
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>0 (Flowing)</span>
              <span className="text-amber-400/80">40 (Elevated)</span>
              <span className="text-rose-400/80">70 (Critical)</span>
              <span>100</span>
            </div>
          </div>

          {/* Mode Switch Card: Autonomous Sentinel vs Manual Operator */}
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Operating Mode
              </span>
              <span
                className={`text-xs font-black uppercase tracking-wider ${
                  isAutonomous ? 'text-sky-400' : 'text-amber-400'
                }`}
              >
                {isAutonomous ? 'Autonomous Sentinel' : 'Manual Operator'}
              </span>
              <span className="text-[9px] text-slate-500">
                {isAutonomous
                  ? 'Auto-dispatches bypass when risk >= 70'
                  : 'Requires dispatcher approval'}
              </span>
            </div>

            <button
              type="button"
              disabled={toggling}
              onClick={handleToggleMode}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isAutonomous ? 'bg-sky-600' : 'bg-slate-700'
              }`}
              title="Toggle Autonomous Sentinel vs Manual Operator Mode"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isAutonomous ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Corridor Incident Alerts & 3D Disruption Mitigations Card */}
          <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-300">
              <span className="flex items-center gap-1.5 text-rose-400">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span>Corridor Disruption Alerts</span>
              </span>
              <span className="text-[10px] font-mono text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/40">
                1 Active Hazard
              </span>
            </div>

            {CORRIDOR_INCIDENTS.map((incident) => {
              const isSelected = selectedIncidentId === incident.id;
              return (
                <div
                  key={incident.id}
                  onClick={() => handleSelectIncident(incident)}
                  className={`p-3 rounded-xl border text-xs space-y-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-500/80 text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-rose-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-rose-900/80 text-rose-200 border border-rose-500/50">
                          {incident.severity}
                        </span>
                        <span className="font-bold text-white text-[12px]">{incident.title}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {incident.corridor} • {incident.id}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectIncident(incident);
                      }}
                      className="px-2 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-white text-[10px] font-bold border border-rose-500/50 flex items-center gap-1 cursor-pointer"
                      title="Focus 3D Disruption Zone"
                    >
                      <Compass className="w-2.5 h-2.5" />
                      <span>Focus 3D</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {incident.description}
                  </p>

                  {/* Mitigation Options Drawer */}
                  {isSelected && (
                    <div className="pt-2 border-t border-rose-900/60 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-rose-300">
                        <span>Autonomous Mitigation Options</span>
                        <span className="text-slate-400 font-normal">Select response</span>
                      </div>

                      <div className="space-y-1.5">
                        {incident.mitigationOptions.map((opt) => {
                          const Icon = opt.icon || Navigation;
                          return (
                            <div
                              key={opt.id}
                              className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-sky-500/40 transition flex items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div className="font-bold text-white text-[11px] flex items-center gap-1">
                                  <Icon className="w-3 h-3 text-sky-400" />
                                  <span>{opt.title}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 leading-tight">
                                  {opt.description}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExecuteMitigation(opt, incident);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-[10px] font-black shrink-0 transition shadow-sm cursor-pointer"
                              >
                                {opt.buttonText}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {mitigationStatus && (
                        <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-[10px] font-bold flex items-center gap-1.5 animate-fadeIn">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{mitigationStatus}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Directives Stream Card */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Active AI Directives</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {sentinel.active_directives.length} active
              </span>
            </div>

            {sentinel.active_directives.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {sentinel.active_directives.map((dir, idx) => (
                  <div
                    key={dir.directive_id || idx}
                    className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                      isAutonomous
                        ? 'bg-sky-950/40 border-sky-500/50 text-sky-100 shadow-[0_0_8px_rgba(56,189,248,0.15)]'
                        : 'bg-amber-950/40 border-amber-500/50 text-amber-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900/80 border border-slate-700 text-slate-300">
                        {dir.directive_id}
                      </span>
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                          dir.status === 'DISPATCHED_TO_TMS'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60'
                            : 'bg-amber-950 text-amber-300 border border-amber-500/60'
                        }`}
                      >
                        {dir.status === 'DISPATCHED_TO_TMS' ? 'Dispatched TMS' : 'Pending Approval'}
                      </span>
                    </div>

                    <div className="font-bold text-white text-[11px] leading-snug">
                      {dir.action}
                    </div>

                    <div className="text-[10px] text-slate-400 leading-tight">
                      {dir.recommended_bypass}
                    </div>

                    <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span>SLA Saved: ~{dir.expected_sla_preservation_hrs || 4.2}h</span>
                      {onDirectiveDispatch && dir.status !== 'DISPATCHED_TO_TMS' && (
                        <button
                          type="button"
                          onClick={() => onDirectiveDispatch(dir)}
                          className="px-2 py-0.5 rounded bg-sky-600 text-white font-bold hover:bg-sky-500 cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1 opacity-80" />
                <div className="text-xs font-bold text-slate-300">Corridor Flow Within Limits</div>
                <div className="text-[10px] text-slate-500">
                  Risk ({risk.toFixed(1)}) &lt; 70.0. PyTorch LSTM bounds nominal.
                </div>
              </div>
            )}
          </div>

          {/* Audit Decision Log Link */}
          <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Decisions Logged: {sentinel.decision_log_count || recentLogs.length}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowLogsModal(true)}
              className="text-sky-400 hover:text-sky-300 font-bold underline cursor-pointer"
            >
              View Audit Log
            </button>
          </div>
        </div>
      ) : (
        /* Collapsed Compact View */
        <div className="p-2.5 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Risk:</span>
            <span
              className={`font-mono text-xs font-black px-1.5 py-0.5 rounded border ${statusConfig.color}`}
            >
              {risk.toFixed(1)}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <button
            type="button"
            onClick={handleToggleMode}
            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded transition cursor-pointer ${
              isAutonomous
                ? 'bg-sky-900/60 text-sky-300 border border-sky-500/40 hover:bg-sky-800/60'
                : 'bg-amber-900/60 text-amber-300 border border-amber-500/40 hover:bg-amber-800/60'
            }`}
          >
            {isAutonomous ? 'Autonomous' : 'Manual'}
          </button>
        </div>
      )}

      {/* Decision Audit Log Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full p-5 rounded-2xl bg-slate-900 border border-slate-700 text-white shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-400" />
                <h4 className="text-sm font-black uppercase tracking-wider text-white">
                  Autonomous AI Sentinel Audit Decision Log
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                className="px-2 py-1 rounded-md text-xs text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕ Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 flex-1 text-xs">
              {recentLogs.length > 0 ? (
                recentLogs.map((log, idx) => (
                  <div
                    key={log.event_id || idx}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="font-bold text-sky-300">{log.event_type}</span>
                      <span>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Recent'}</span>
                    </div>
                    <div className="font-bold text-white text-[11px]">
                      {log.action_taken || log.directive?.action || 'Event recorded'}
                    </div>
                    {log.rationale && (
                      <div className="text-[10px] text-slate-400 leading-relaxed">
                        {log.rationale}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500">
                  No decision audit events recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
