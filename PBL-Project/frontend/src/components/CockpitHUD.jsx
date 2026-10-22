import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  AlertTriangle,
  Clock,
  Gauge,
  Thermometer,
  BatteryCharging,
  Truck,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { usePersona } from '../context/PersonaContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { telemetryWS } from '../services/websocket';
import { api } from '../services/api';
import {
  VEHICLE_CONFIGS,
  KASARA_DISRUPTION_PAYLOAD,
  evaluateColdChainStatus,
  calculateSpeedRatio
} from '../utils/telematicsControllers.js';

export default function CockpitHUD({
  onVehicleChange,
  onRerouteEvent,
  className = ''
}) {
  const { canDo, currentRole } = usePersona();
  const {
    activeVehicleId,
    setActiveVehicleId,
    activeRoadblocks,
    setActiveRoadblocks,
    simState,
    setSimState
  } = useWorkspace();

  const [isMinimized, setIsMinimized] = useState(false);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [actionLoading, setActionLoading] = useState(false);
  const [rerouteNotification, setRerouteNotification] = useState(null);
  const [simulatedExcursion, setSimulatedExcursion] = useState(false);

  // Live vehicles telematics snapshot from WebSocket
  const [vehiclesData, setVehiclesData] = useState({
    'TRK-MH-01': {
      speedKmh: 62.0,
      batteryFuelSocPct: 96.0,
      cargoTempC: 4.1,
      headingDeg: 45,
      isRerouted: false,
      status: 'IN_TRANSIT',
      distanceTraveledKm: 12.4
    },
    'TRK-MH-02': {
      speedKmh: 68.0,
      batteryFuelSocPct: 91.5,
      cargoTempC: 19.2,
      headingDeg: 135,
      isRerouted: false,
      status: 'IN_TRANSIT',
      distanceTraveledKm: 8.6
    }
  });

  const canControl =
    (typeof canDo === 'function' ? canDo('telemetry_control') : false) ||
    currentRole === 'admin' ||
    currentRole === 'dispatcher' ||
    currentRole === 'director';

  const canInject =
    (typeof canDo === 'function' ? canDo('inject_roadblock') : false) ||
    currentRole === 'admin' ||
    currentRole === 'dispatcher' ||
    currentRole === 'director';

  // Active vehicle configuration and data
  const currentVehicleConfig = VEHICLE_CONFIGS[activeVehicleId] || VEHICLE_CONFIGS['TRK-MH-01'];
  const currentTelemetry = vehiclesData[activeVehicleId] || vehiclesData['TRK-MH-01'];

  // Current display temperature (allows simulated excursion testing)
  const displayCargoTemp = simulatedExcursion
    ? 9.6
    : currentTelemetry.cargoTempC ?? currentVehicleConfig.targetTempC;

  const coldChainStatus = evaluateColdChainStatus(displayCargoTemp);
  const isKasaraBlocked = activeRoadblocks.some(
    (rb) => rb.roadblock_id === 'RB-KASARA-01' || rb.corridor_node === 'KSR'
  );

  // Synchronize WebSocket connection and listeners
  useEffect(() => {
    telemetryWS.connect();

    const unsubStatus = telemetryWS.subscribe('status', (st) => {
      setWsStatus(st);
    });

    const unsubState = telemetryWS.subscribe('state', (state) => {
      if (state && setSimState) {
        setSimState((prev) => ({ ...prev, ...state }));
      }
    });

    const unsubTick = telemetryWS.subscribe('tick', (tickMsg) => {
      if (tickMsg.simulation && setSimState) {
        setSimState((prev) => ({ ...prev, ...tickMsg.simulation }));
      }
      if (tickMsg.active_roadblocks && setActiveRoadblocks) {
        setActiveRoadblocks(tickMsg.active_roadblocks);
      }
      if (tickMsg.vehicles) {
        setVehiclesData((prev) => {
          const updated = { ...prev };
          Object.keys(tickMsg.vehicles).forEach((vId) => {
            const v = tickMsg.vehicles[vId];
            updated[vId] = {
              speedKmh: v.speed_kmh ?? updated[vId]?.speedKmh ?? 60,
              batteryFuelSocPct: v.battery_fuel_soc_pct ?? updated[vId]?.batteryFuelSocPct ?? 90,
              cargoTempC: v.cargo_temp_c ?? updated[vId]?.cargoTempC ?? 4.0,
              headingDeg: v.heading ?? updated[vId]?.headingDeg ?? 45,
              isRerouted: v.is_rerouted ?? false,
              status: v.status ?? 'IN_TRANSIT',
              distanceTraveledKm: v.distance_traveled_km ?? 0
            };
          });
          return updated;
        });
      }
    });

    const unsubReroute = telemetryWS.subscribe('reroute', (event) => {
      if (event.roadblock && setActiveRoadblocks) {
        setActiveRoadblocks((prev) => {
          const exists = prev.some((r) => r.roadblock_id === event.roadblock.roadblock_id);
          return exists ? prev : [...prev, event.roadblock];
        });
      }
      const detour = event.reroute_details?.[0] || event;
      setRerouteNotification({
        title: '🚨 DYNAMIC RE-ROUTING ENGAGED',
        vehicleId: detour.vehicle_id || 'TRK-MH-01',
        detourReason: detour.detour_reason || 'Bypassing Kasara Ghat landslide via Malshej Ghat / SH-60',
        addedKm: detour.added_distance_km || 21.6,
        addedMins: detour.added_duration_mins || 34,
        timestamp: new Date().toLocaleTimeString()
      });
      if (onRerouteEvent) onRerouteEvent(event);
    });

    const unsubCleared = telemetryWS.subscribe('roadblocksCleared', () => {
      if (setActiveRoadblocks) setActiveRoadblocks([]);
      setRerouteNotification({
        title: '✅ BASELINE HIGHWAY RESTORED',
        vehicleId: 'ALL FLEET',
        detourReason: 'Kasara Ghat landslide cleared. NH-160 corridor operational.',
        addedKm: 0,
        addedMins: 0,
        timestamp: new Date().toLocaleTimeString()
      });
      setTimeout(() => setRerouteNotification(null), 6000);
    });

    // REST fallback for initial state
    api.getTelemetryState().then((res) => {
      if (res.simulation && setSimState) setSimState(res.simulation);
      if (res.active_roadblocks && setActiveRoadblocks) setActiveRoadblocks(res.active_roadblocks);
      if (res.vehicles) {
        setVehiclesData((prev) => {
          const updated = { ...prev };
          Object.keys(res.vehicles).forEach((vId) => {
            const v = res.vehicles[vId];
            updated[vId] = {
              speedKmh: v.speed_kmh ?? 60,
              batteryFuelSocPct: v.battery_fuel_soc_pct ?? 90,
              cargoTempC: v.cargo_temp_c ?? 4.0,
              headingDeg: v.heading ?? 45,
              isRerouted: v.is_rerouted ?? false,
              status: v.status ?? 'IN_TRANSIT',
              distanceTraveledKm: v.distance_traveled_km ?? 0
            };
          });
          return updated;
        });
      }
    }).catch((err) => console.debug('Initial telemetry load error:', err));

    return () => {
      unsubStatus();
      unsubState();
      unsubTick();
      unsubReroute();
      unsubCleared();
    };
  }, [onRerouteEvent, setActiveRoadblocks, setSimState]);

  // Handle active vehicle toggle
  const handleSelectVehicle = (vId) => {
    if (setActiveVehicleId) setActiveVehicleId(vId);
    if (onVehicleChange) onVehicleChange(vId);
  };

  // Playback handlers
  const handleTogglePlay = async () => {
    if (!canControl) return;
    setActionLoading(true);
    try {
      if (simState.is_running) {
        telemetryWS.pause();
        await api.controlTelemetry('PAUSE');
        if (setSimState) setSimState((s) => ({ ...s, is_running: false }));
      } else {
        telemetryWS.play();
        await api.controlTelemetry('PLAY', simState.speed_multiplier);
        if (setSimState) setSimState((s) => ({ ...s, is_running: true }));
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
      if (setSimState) setSimState((s) => ({ ...s, speed_multiplier: speed }));
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
      if (setSimState) {
        setSimState({
          is_running: false,
          speed_multiplier: 1.0,
          elapsed_seconds: 0,
          elapsed_formatted: '00:00:00',
          simulated_time: '08:00:00 AM'
        });
      }
      if (setActiveRoadblocks) setActiveRoadblocks([]);
      setSimulatedExcursion(false);
    } catch (e) {
      console.warn('Reset error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  // Roadblock injection handler
  const handleToggleRoadblock = async () => {
    if (!canInject) return;
    setActionLoading(true);
    try {
      if (isKasaraBlocked) {
        telemetryWS.clearRoadblocks();
        await api.clearDisruptions();
        if (setActiveRoadblocks) setActiveRoadblocks([]);
      } else {
        telemetryWS.injectRoadblock(KASARA_DISRUPTION_PAYLOAD);
        const res = await api.injectDisruption(KASARA_DISRUPTION_PAYLOAD);
        if (res.roadblock && setActiveRoadblocks) {
          setActiveRoadblocks((prev) => {
            const exists = prev.some((r) => r.roadblock_id === res.roadblock.roadblock_id);
            return exists ? prev : [...prev, res.roadblock];
          });
        }
      }
    } catch (e) {
      console.error('Roadblock toggle error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  // Speedometer fill percentage (0 to 100 km/h)
  const speedRatio = Math.min(1.0, (currentTelemetry.speedKmh || 0) / 100);

  return (
    <div
      className={`fixed bottom-22 sm:bottom-24 left-1/2 -translate-x-1/2 z-35 pointer-events-auto transition-all duration-300 w-[96%] max-w-5xl ${className}`}
      data-testid="cockpit-hud"
    >
      {/* Dynamic Re-routing Detour Notification Toast */}
      {rerouteNotification && (
        <div
          data-testid="reroute-notification-banner"
          className="mb-2 cyber-glass rounded-2xl p-3 px-4 border border-amber-500/80 shadow-[0_10px_35px_rgba(245,158,11,0.35)] flex items-center justify-between gap-3 text-slate-100 backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/25 border border-amber-500/60 flex items-center justify-center text-amber-400 shrink-0 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-300 tracking-wider">
                  {rerouteNotification.title}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-200 border border-amber-800/80 font-bold">
                  {rerouteNotification.vehicleId}
                </span>
                {rerouteNotification.addedKm > 0 && (
                  <span className="text-[10px] font-mono font-bold text-orange-400">
                    +{rerouteNotification.addedKm} km (+{rerouteNotification.addedMins}m ETA)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                {rerouteNotification.detourReason}
              </p>
            </div>
          </div>
          <button
            onClick={() => setRerouteNotification(null)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/80 text-xs transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Glassmorphic Cockpit HUD Frame */}
      <div className="cyber-glass rounded-2xl border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden transition-all">
        {/* Top Header Strip: Simulation Clock, Controls, WS Status, and Minimize Toggle */}
        <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-slate-200 select-none">
          {/* Left: WS Status & Simulation Time Readout */}
          <div className="flex items-center gap-3">
            {/* WS Live Pulse Pill */}
            <div
              data-testid="ws-status-badge"
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 shadow-inner"
            >
              <span className="relative flex h-2 w-2">
                {wsStatus === 'CONNECTED' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : wsStatus === 'CONNECTING' ? (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                )}
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                {wsStatus === 'CONNECTED'
                  ? 'WS LIVE'
                  : wsStatus === 'CONNECTING'
                  ? 'CONNECTING'
                  : 'OFFLINE'}
              </span>
            </div>

            {/* Simulated Clock Readout */}
            <div
              data-testid="simulation-clock-display"
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-white font-mono"
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-xs font-black tracking-tight text-cyan-300">
                {simState.simulated_time}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                +{simState.elapsed_formatted}
              </span>
            </div>
          </div>

          {/* Center: Playback Controls (Play/Pause, Step, 1x/2x/5x, Reset) */}
          <div className="flex items-center gap-1.5" data-testid="playback-controls">
            {/* Play / Pause Toggle */}
            <button
              type="button"
              data-testid="playback-play-pause-btn"
              onClick={handleTogglePlay}
              disabled={!canControl || actionLoading}
              title={
                !canControl
                  ? 'Permission required: telemetry_control'
                  : simState.is_running
                  ? 'Pause Simulation [Space]'
                  : 'Start Simulation [Space]'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition active:scale-95 ${
                simState.is_running
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              } ${!canControl ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {simState.is_running ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>PLAY</span>
                </>
              )}
            </button>

            {/* Step Button (+15s) */}
            <button
              type="button"
              data-testid="playback-step-btn"
              onClick={handleStep}
              disabled={!canControl || actionLoading}
              title="Advance simulation clock by 15 seconds"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700/80 transition active:scale-95 disabled:opacity-40"
            >
              <SkipForward className="w-3 h-3 text-cyan-400" />
              <span className="font-mono text-[11px]">+15s</span>
            </button>

            {/* Speed Multiplier Pills (1x, 2x, 5x) */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700/80">
              {[1.0, 2.0, 5.0].map((spd) => {
                const isActive = Math.abs((simState.speed_multiplier || 1.0) - spd) < 0.1;
                return (
                  <button
                    key={spd}
                    type="button"
                    data-testid={`speed-btn-${spd}x`}
                    onClick={() => handleSpeedChange(spd)}
                    disabled={!canControl}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-black transition ${
                      isActive
                        ? 'bg-cyan-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                );
              })}
            </div>

            {/* Reset Button */}
            <button
              type="button"
              data-testid="playback-reset-btn"
              onClick={handleReset}
              disabled={!canControl || actionLoading}
              title="Reset simulation to initial baseline"
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 border border-slate-700/80 transition active:scale-95 disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Quick Roadblock Action & Minimize Toggle */}
          <div className="flex items-center gap-2">
            {/* Quick Kasara Ghat Landslide Disruption Action */}
            <button
              type="button"
              data-testid="roadblock-toggle-btn"
              onClick={handleToggleRoadblock}
              disabled={!canInject || actionLoading}
              title={
                isKasaraBlocked
                  ? 'Clear Kasara Ghat roadblock disruption'
                  : 'Inject Kasara Ghat monsoon landslide disruption'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition active:scale-95 ${
                isKasaraBlocked
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-500/35'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
              } ${!canInject ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {isKasaraBlocked ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CLEAR ROADBLOCK</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  <span>BLOCK KASARA GHAT</span>
                </>
              )}
            </button>

            {/* Minimize / Expand HUD Toggle */}
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title={isMinimized ? 'Expand Cockpit HUD' : 'Minimize Cockpit HUD'}
            >
              {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Cockpit HUD Body: Vehicle Switcher & Telemetry Cluster */}
        {!isMinimized && (
          <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
            {/* 1. Fleet Vehicle Switcher (Cols 1-4) */}
            <div className="lg:col-span-4 flex flex-col gap-2" data-testid="fleet-vehicle-switcher">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Active Fleet Vehicle Focus</span>
                </span>
                <span className="text-slate-500">CAMERA TRACKED</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Vehicle 1: TRK-MH-01 Reefer */}
                <button
                  type="button"
                  data-testid="vehicle-btn-TRK-MH-01"
                  onClick={() => handleSelectVehicle('TRK-MH-01')}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    activeVehicleId === 'TRK-MH-01'
                      ? 'bg-orange-500/20 border-orange-500/80 shadow-[0_0_15px_rgba(255,84,0,0.3)] text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-mono">TRK-MH-01</span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                        activeVehicleId === 'TRK-MH-01'
                          ? 'bg-orange-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      REEFER
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-semibold truncate mt-1">
                    Nashik Corridor (NH-160)
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">
                    Perishable Vaccines
                  </div>
                </button>

                {/* Vehicle 2: TRK-MH-02 EV Carrier */}
                <button
                  type="button"
                  data-testid="vehicle-btn-TRK-MH-02"
                  onClick={() => handleSelectVehicle('TRK-MH-02')}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    activeVehicleId === 'TRK-MH-02'
                      ? 'bg-cyan-500/20 border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-mono">TRK-MH-02</span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                        activeVehicleId === 'TRK-MH-02'
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      EV CARRIER
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-semibold truncate mt-1">
                    Pune Expressway
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">
                    Automotive Electronics
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Telematics Gauge Cluster (Cols 5-12) */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5" data-testid="telematics-gauge-cluster">
              {/* Gauge 1: Digital Speedometer */}
              <div
                data-testid="gauge-speedometer"
                className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Velocity</span>
                  </span>
                  <span className="text-[9px] font-mono text-cyan-400 font-bold">
                    LIMIT 80
                  </span>
                </div>

                {/* Digital Speed Value & Meter */}
                <div className="my-1.5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-mono text-white tracking-tight">
                    {Math.round(currentTelemetry.speedKmh || 0)}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">km/h</span>
                </div>

                {/* Speed Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden relative">
                  <div
                    className="h-full bg-linear-to-r from-cyan-500 via-emerald-400 to-amber-500 transition-all duration-300"
                    style={{ width: `${Math.round(speedRatio * 100)}%` }}
                  />
                </div>

                <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-500">
                  <span>0 KM/H</span>
                  <span>{currentTelemetry.isRerouted ? 'DETOUR PACE' : 'CRUISING'}</span>
                  <span>100 KM/H</span>
                </div>
              </div>

              {/* Gauge 2: Cold-Chain Temperature Gauge with 2°C–8°C Thresholding */}
              <div
                data-testid="gauge-cold-chain"
                className={`rounded-xl p-3 border flex flex-col justify-between relative overflow-hidden transition-all duration-200 ${
                  coldChainStatus === 'NOMINAL'
                    ? 'bg-slate-900/80 border-slate-800'
                    : coldChainStatus === 'EXCURSION'
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
                    : 'bg-rose-950/50 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cold-Chain</span>
                  </span>
                  {/* Threshold Status Pill */}
                  <span
                    data-testid="cold-chain-status-pill"
                    className={`text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded-full border ${
                      coldChainStatus === 'NOMINAL'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                        : coldChainStatus === 'EXCURSION'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                        : 'bg-rose-600 text-white border-rose-400 font-black'
                    }`}
                  >
                    {coldChainStatus === 'NOMINAL'
                      ? 'NOMINAL'
                      : coldChainStatus === 'EXCURSION'
                      ? 'EXCURSION'
                      : 'CRITICAL'}
                  </span>
                </div>

                {/* Digital Temperature Value */}
                <div className="my-1.5 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1">
                    <span
                      data-testid="cargo-temp-readout"
                      className={`text-3xl font-black font-mono tracking-tight ${
                        coldChainStatus === 'NOMINAL'
                          ? 'text-emerald-400'
                          : coldChainStatus === 'EXCURSION'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {displayCargoTemp.toFixed(1)}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">°C</span>
                  </div>

                  {/* Interactive Excursion Test Trigger */}
                  <button
                    type="button"
                    data-testid="simulate-excursion-toggle"
                    onClick={() => setSimulatedExcursion(!simulatedExcursion)}
                    title="Toggle simulated cold-chain temperature breach for verification"
                    className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    {simulatedExcursion ? 'RESTORE' : 'TEST 9°C'}
                  </button>
                </div>

                {/* Safe Zone Indicator Bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden relative">
                  {/* 2°C to 8°C Safe Zone indicator marker */}
                  <div className="absolute left-[20%] right-[20%] top-0 bottom-0 bg-emerald-500/40 border-x border-emerald-400/60" />
                  {/* Current temp pointer dot */}
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      coldChainStatus === 'NOMINAL'
                        ? 'bg-emerald-400'
                        : coldChainStatus === 'EXCURSION'
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                    style={{
                      width: `${Math.max(5, Math.min(100, (displayCargoTemp / 12) * 100))}%`
                    }}
                  />
                </div>

                <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-500">
                  <span>0°C</span>
                  <span className="text-emerald-400 font-bold">SAFE [2°C–8°C]</span>
                  <span>12°C</span>
                </div>
              </div>

              {/* Gauge 3: Battery / Fuel State of Charge (SoC) Bar */}
              <div
                data-testid="gauge-soc"
                className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                    <span>State of Charge</span>
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">
                    RANGE ~{Math.round((currentTelemetry.batteryFuelSocPct || 90) * 2.5)} KM
                  </span>
                </div>

                {/* SoC Percentage Value */}
                <div className="my-1.5 flex items-baseline gap-1.5">
                  <span
                    data-testid="soc-readout"
                    className="text-3xl font-black font-mono text-white tracking-tight"
                  >
                    {Math.round(currentTelemetry.batteryFuelSocPct || 90)}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">%</span>
                </div>

                {/* SoC Progress Bar with Threshold Color Coding */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-300 ${
                      (currentTelemetry.batteryFuelSocPct || 90) > 50
                        ? 'bg-emerald-400'
                        : (currentTelemetry.batteryFuelSocPct || 90) > 20
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.round(currentTelemetry.batteryFuelSocPct || 90)}%` }}
                  />
                </div>

                <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-500">
                  <span>DEPLETED</span>
                  <span>HEALTH 98%</span>
                  <span>100% FULL</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
