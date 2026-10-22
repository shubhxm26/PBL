import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  AlertTriangle,
  Radio,
  Clock,
  Gauge,
  Flame,
  CheckCircle2,
  Lock,
  ChevronDown
} from 'lucide-react';
import { usePersona } from '../context/PersonaContext';
import { telemetryWS } from '../services/websocket';
import { api } from '../services/api';

const ROADBLOCK_PRESETS = [
  {
    id: 'RB-KASARA-01',
    name: 'Kasara Ghat Monsoon Landslide',
    corridor_node: 'KSR',
    latitude: 19.6967,
    longitude: 73.5611,
    radius_km: 15.0,
    severity: 'CRITICAL',
    description: 'Rockfall blocked NH-48 uphill section. 10x penalty edge applied.',
    penalty_multiplier: 10.0
  },
  {
    id: 'RB-MAJHIWADA-02',
    name: 'Thane Majhiwada Chemical Spill',
    corridor_node: 'THN',
    latitude: 19.2183,
    longitude: 72.9781,
    radius_km: 10.0,
    severity: 'HIGH',
    description: 'Hazardous tanker overturned on flyover. 8x congestion penalty.',
    penalty_multiplier: 8.0
  },
  {
    id: 'RB-BHIWANDI-03',
    name: 'Bhiwandi Bypass Freight Gridlock',
    corridor_node: 'BHW',
    latitude: 19.2967,
    longitude: 73.0631,
    radius_km: 12.0,
    severity: 'HIGH',
    description: 'Severe multi-vehicle logistics gridlock at warehousing hub.',
    penalty_multiplier: 6.0
  }
];

export default function SimulationBar({ onRerouteEvent }) {
  const { canDo, currentRole } = usePersona();
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [simState, setSimState] = useState({
    is_running: false,
    speed_multiplier: 1.0,
    elapsed_seconds: 0,
    elapsed_formatted: '00:00:00',
    simulated_time: '08:00:00 AM'
  });
  const [activeRoadblocks, setActiveRoadblocks] = useState([]);
  const [selectedRoadblock, setSelectedRoadblock] = useState(ROADBLOCK_PRESETS[0]);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const canControl = (typeof canDo === 'function' ? canDo('telemetry_control') : false) || currentRole === 'admin' || currentRole === 'dispatcher' || currentRole === 'director';
  const canInject = (typeof canDo === 'function' ? canDo('inject_roadblock') : false) || currentRole === 'admin' || currentRole === 'dispatcher' || currentRole === 'director';

  // Connect WebSocket & subscribe to events
  useEffect(() => {
    telemetryWS.connect();

    const unsubStatus = telemetryWS.subscribe('status', (st) => {
      setWsStatus(st);
    });

    const unsubState = telemetryWS.subscribe('state', (state) => {
      if (state) {
        setSimState(prev => ({ ...prev, ...state }));
      }
    });

    const unsubTick = telemetryWS.subscribe('tick', (tickMsg) => {
      if (tickMsg.simulation) {
        setSimState(prev => ({ ...prev, ...tickMsg.simulation }));
      }
      if (tickMsg.active_roadblocks) {
        setActiveRoadblocks(tickMsg.active_roadblocks);
      }
    });

    const unsubReroute = telemetryWS.subscribe('reroute', (event) => {
      if (event.roadblock) {
        setActiveRoadblocks(prev => {
          const exists = prev.some(r => r.roadblock_id === event.roadblock.roadblock_id);
          return exists ? prev : [...prev, event.roadblock];
        });
      }
      if (onRerouteEvent) {
        onRerouteEvent(event);
      }
      setStatusMessage({
        type: 'warning',
        text: `🚨 Dynamic Re-routing Broadcast: ${event.affected_vehicles?.join(', ')} diverted around ${event.roadblock?.name} (+21.6 km detour).`
      });
      setTimeout(() => setStatusMessage(null), 9000);
    });

    const unsubCleared = telemetryWS.subscribe('roadblocksCleared', () => {
      setActiveRoadblocks([]);
      setStatusMessage({
        type: 'success',
        text: '✅ All corridor disruptions cleared. Baseline highway trajectories restored.'
      });
      setTimeout(() => setStatusMessage(null), 5000);
    });

    // Also fetch initial state via REST fallback
    api.getTelemetryState().then(res => {
      if (res.simulation) setSimState(res.simulation);
      if (res.active_roadblocks) setActiveRoadblocks(res.active_roadblocks);
    }).catch(err => console.debug('Initial telemetry state REST load:', err));

    return () => {
      unsubStatus();
      unsubState();
      unsubTick();
      unsubReroute();
      unsubCleared();
    };
  }, [onRerouteEvent]);

  // Controls handlers
  const handleTogglePlay = async () => {
    if (!canControl) return;
    setActionLoading(true);
    try {
      if (simState.is_running) {
        telemetryWS.pause();
        await api.controlTelemetry('PAUSE');
        setSimState(s => ({ ...s, is_running: false }));
      } else {
        telemetryWS.play();
        await api.controlTelemetry('PLAY', simState.speed_multiplier);
        setSimState(s => ({ ...s, is_running: true }));
      }
    } catch (e) {
      console.warn('Play/pause error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStep = async () => {
    if (!canControl) return;
    setActionLoading(true);
    try {
      telemetryWS.step(15);
      await api.controlTelemetry('STEP', simState.speed_multiplier, 15);
    } catch (e) {
      console.warn('Step error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSpeedChange = async (speed) => {
    if (!canControl) return;
    try {
      telemetryWS.setSpeed(speed);
      await api.controlTelemetry('SET_SPEED', speed);
      setSimState(s => ({ ...s, speed_multiplier: speed }));
    } catch (e) {
      console.warn('Speed set error:', e);
    }
  };

  const handleReset = async () => {
    if (!canControl) return;
    setActionLoading(true);
    try {
      telemetryWS.reset();
      await api.controlTelemetry('RESET');
      setSimState({
        is_running: false,
        speed_multiplier: 1.0,
        elapsed_seconds: 0,
        elapsed_formatted: '00:00:00',
        simulated_time: '08:00:00 AM'
      });
      setActiveRoadblocks([]);
    } catch (e) {
      console.warn('Reset error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  // One-click roadblock injection
  const handleInjectRoadblock = async (preset = selectedRoadblock) => {
    if (!canInject) return;
    setActionLoading(true);
    setShowPresetsMenu(false);
    try {
      const payload = {
        roadblock_id: preset.id,
        name: preset.name,
        corridor_node: preset.corridor_node,
        latitude: preset.latitude,
        longitude: preset.longitude,
        radius_km: preset.radius_km,
        severity: preset.severity,
        description: preset.description,
        penalty_multiplier: preset.penalty_multiplier,
        target_vehicle_id: 'TRK-MH-01'
      };

      telemetryWS.injectRoadblock(payload);
      const res = await api.injectDisruption(payload);
      if (res.roadblock) {
        setActiveRoadblocks(prev => {
          const exists = prev.some(r => r.roadblock_id === res.roadblock.roadblock_id);
          return exists ? prev : [...prev, res.roadblock];
        });
      }
      if (onRerouteEvent) {
        onRerouteEvent(res);
      }
    } catch (e) {
      console.error('Roadblock injection failed:', e);
      setStatusMessage({
        type: 'error',
        text: `Failed to inject disruption: ${e.message}`
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearRoadblocks = async () => {
    if (!canInject) return;
    setActionLoading(true);
    try {
      telemetryWS.clearRoadblocks();
      await api.clearDisruptions();
      setActiveRoadblocks([]);
    } catch (e) {
      console.error('Clear roadblocks failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Main Playback Bar Container */}
      <div className="bright-card p-4 rounded-2xl bg-white border-2 border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left Cluster: Live Clock & WebSocket Status */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Pulsing WS status pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="relative flex h-2.5 w-2.5">
                {wsStatus === 'CONNECTED' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : wsStatus === 'CONNECTING' ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 animate-pulse"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                )}
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                {wsStatus === 'CONNECTED' ? 'WS Telemetry Live' : wsStatus === 'CONNECTING' ? 'WS Connecting' : 'WS Reconnecting'}
              </span>
            </div>

            {/* Simulated Time Readout */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white shadow-xs">
              <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-extrabold font-mono-num tracking-tight text-white">
                  {simState.simulated_time}
                </span>
                <span className="text-[10px] font-bold text-slate-400 font-mono-num">
                  +{simState.elapsed_formatted}
                </span>
              </div>
            </div>
          </div>

          {/* Center Cluster: Playback Controls (Play, Pause, Step, Speed, Reset) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Play / Pause Toggle Button */}
            <button
              onClick={handleTogglePlay}
              disabled={!canControl || actionLoading}
              title={!canControl ? 'Permission required: telemetry_control' : simState.is_running ? 'Pause Simulation' : 'Start Simulation'}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 shadow-sm active:scale-[0.98] ${
                simState.is_running
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-900'
                  : 'bg-[#FF5400] hover:bg-[#e04a00] text-white shadow-orange-500/20'
              } ${!canControl ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {simState.is_running ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play</span>
                </>
              )}
            </button>

            {/* Step Button */}
            <button
              onClick={handleStep}
              disabled={!canControl || actionLoading}
              title={!canControl ? 'Permission required' : 'Advance simulation clock by 15 seconds'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <SkipForward className="w-3.5 h-3.5 text-slate-600" />
              <span>Step (+15s)</span>
            </button>

            {/* Speed Multiplier Pill Selectors: 1x, 2x, 5x */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              {[1.0, 2.0, 5.0].map((spd) => {
                const isActive = Math.abs(simState.speed_multiplier - spd) < 0.1;
                return (
                  <button
                    key={spd}
                    onClick={() => handleSpeedChange(spd)}
                    disabled={!canControl}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition font-mono-num ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {spd}x
                  </button>
                );
              })}
            </div>

            {/* Reset Simulation */}
            <button
              onClick={handleReset}
              disabled={!canControl || actionLoading}
              title="Reset simulation to initial state"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition active:scale-[0.98] disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Right Cluster: One-Click "Inject Roadblock" Action & Disruption Controls */}
          <div className="flex items-center gap-2 relative shrink-0">
            {activeRoadblocks.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-extrabold text-rose-700 bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-300">
                  <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping"></span>
                  <span>{activeRoadblocks.length} Roadblock Active</span>
                </span>
                <button
                  onClick={handleClearRoadblocks}
                  disabled={!canInject || actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs active:scale-[0.98] disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Clear Disruption</span>
                </button>
              </div>
            ) : (
              <div className="inline-flex rounded-xl shadow-xs">
                {/* Primary 1-Click Action */}
                <button
                  onClick={() => handleInjectRoadblock(selectedRoadblock)}
                  disabled={!canInject || actionLoading}
                  title={!canInject ? 'Permission required: inject_roadblock' : `1-Click: Inject ${selectedRoadblock.name}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-l-xl bg-[#FF1744] hover:bg-[#d50000] text-white text-xs font-extrabold transition-all duration-150 shadow-md shadow-rose-500/20 active:scale-[0.98] disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4 text-white fill-rose-900 stroke-[2.5]" />
                  <span>Inject Roadblock</span>
                </button>

                {/* Dropdown chevron to pick other presets */}
                <button
                  onClick={() => setShowPresetsMenu(p => !p)}
                  disabled={!canInject}
                  title="Choose incident scenario"
                  className="px-2 py-2 rounded-r-xl bg-[#d50000] hover:bg-[#b71c1c] text-white border-l border-rose-400 transition"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Roadblock Preset Selector Dropdown */}
                {showPresetsMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 space-y-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-2 py-1">
                      Select Corridor Incident
                    </div>
                    {ROADBLOCK_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSelectedRoadblock(preset);
                          handleInjectRoadblock(preset);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs transition ${
                          selectedRoadblock.id === preset.id
                            ? 'bg-rose-50 text-rose-900 font-bold border border-rose-200'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="font-extrabold text-slate-900">{preset.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{preset.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Alert Banner when Re-Routing occurs */}
      {statusMessage && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
          statusMessage.type === 'warning'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${statusMessage.type === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-2"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
