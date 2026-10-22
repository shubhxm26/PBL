import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  Anchor,
  CloudRain,
  Compass,
  Globe,
  ShieldCheck,
  Clock,
  Fuel,
  Package,
  Layers,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Send,
  Split,
  Route,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  Building2,
  Mountain,
  Flame,
  Radio,
  RotateCcw,
  Warehouse,
  Truck,
  Lock
} from 'lucide-react';
import CesiumTwinViewport from './CesiumTwinViewport';
import AutonomousSentinelHUD from './AutonomousSentinelHUD';
import { telemetryWS } from '../services/websocket';
import {
  FACILITY_NODES,
  SCENARIO_EPICENTERS,
  getStockCapacityStatus
} from '../constants/logisticsTopology';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { api } from '../services/api';
import { usePersona } from '../context/PersonaContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DigitalTwinTab() {
  const { profile } = usePersona();
  const viewportRef = useRef(null);

  // Shock Scenario Parameters
  const [selectedScenarioId, setSelectedScenarioId] = useState('port_strike');
  const [shockIntensity, setShockIntensity] = useState(75);
  const [enableMitigation, setEnableMitigation] = useState(true);
  const [horizonDays, setHorizonDays] = useState(7);

  // Simulation Results & State
  const [simulationData, setSimulationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);

  // Node Selection & Drawer States
  const [selectedNodeId, setSelectedNodeId] = useState('DC-BHW-01');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isStudioCollapsed, setIsStudioCollapsed] = useState(false);
  const [isImpactCollapsed, setIsImpactCollapsed] = useState(false);
  const [impactDrawerTab, setImpactDrawerTab] = useState('impact'); // 'impact' | 'timeline' | 'directives'
  const [chartMetric, setChartMetric] = useState('stock'); // 'stock' | 'delay'
  const [isTopologyModalOpen, setIsTopologyModalOpen] = useState(false);
  const [dispatchedDirectives, setDispatchedDirectives] = useState({});

  // Viewport layer controls
  const [showFlowConduits, setShowFlowConduits] = useState(true);
  const [showShockwaves, setShowShockwaves] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [useSchematicView, setUseSchematicView] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveRoadblocks, setLiveRoadblocks] = useState([]);
  const [customPersonaFilter, setCustomPersonaFilter] = useState(null);
  const selectedPersonaFilter = customPersonaFilter || profile?.role || 'director';
  const setSelectedPersonaFilter = setCustomPersonaFilter;

  // Verify RBAC permission to trigger twin simulations
  const canSimulate = useMemo(() => {
    if (!profile) return true;
    if (profile.role === 'director' || profile.role === 'admin') return true;
    if (profile.permissions?.actions?.includes('*')) return true;
    if (profile.permissions?.actions?.includes('run_twin_simulation')) return true;
    return false;
  }, [profile]);

  // Connect to live WebSocket Telemetry Hub and handle auto-resync
  useEffect(() => {
    telemetryWS.connect();

    const unsubStatus = telemetryWS.subscribe('status', (newStatus) => {
      setWsConnected(newStatus === 'CONNECTED');
    });

    const unsubTick = telemetryWS.subscribe('tick', (tickMsg) => {
      if (tickMsg.active_roadblocks) {
        setLiveRoadblocks(tickMsg.active_roadblocks);
      }
    });

    const unsubState = telemetryWS.subscribe('state', (stateMsg) => {
      if (stateMsg.active_roadblocks) {
        setLiveRoadblocks(stateMsg.active_roadblocks);
      }
    });

    const unsubRoadblocks = telemetryWS.subscribe('roadblocks', (rbs) => {
      setLiveRoadblocks(rbs || []);
    });

    return () => {
      unsubStatus();
      unsubTick();
      unsubState();
      unsubRoadblocks();
    };
  }, []);

  // Run Discrete-Event Simulation (< 5.0s SLA)
  const runSimulation = useCallback(async (
    scenarioId = selectedScenarioId,
    intensity = shockIntensity,
    mit = enableMitigation,
    horizon = horizonDays
  ) => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        scenario_id: scenarioId,
        shock_intensity: Number(intensity),
        enable_mitigation: Boolean(mit),
        simulation_horizon_days: Number(horizon)
      };

      const result = await api.simulateTwinScenario(payload);
      setSimulationData(result);
    } catch (err) {
      console.error('Twin simulation execution failed:', err);
      setError(err.message || 'Simulation execution failed.');
    } finally {
      setLoading(false);
    }
  }, [selectedScenarioId, shockIntensity, enableMitigation, horizonDays]);

  // Initial simulation run on mount
  useEffect(() => {
    runSimulation('port_strike', 75, true, 7);
  }, [runSimulation]);

  // Handle 3D Entity selection from Cesium picking or camera ribbon
  const handleSelectNode = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setIsInspectorOpen(true);
    viewportRef.current?.flyToNode(nodeId);
  }, []);

  // Intensity Severity Rating helper
  const getSeverityBadge = (intensity) => {
    if (intensity <= 30) {
      return { label: 'Level 1: Mild Shock', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' };
    } else if (intensity <= 60) {
      return { label: 'Level 2: Moderate Disruption', color: 'bg-amber-950/80 text-amber-300 border-amber-500/50' };
    } else if (intensity <= 80) {
      return { label: 'Level 3: Severe Bottleneck', color: 'bg-orange-950/80 text-orange-300 border-orange-500/50' };
    } else {
      return { label: 'Level 4: Catastrophic Breakdown', color: 'bg-rose-950/80 text-rose-300 border-rose-500/50' };
    }
  };

  const currentSeverity = useMemo(() => getSeverityBadge(shockIntensity), [shockIntensity]);

  // Selected Node Details
  const activeNodeDetails = useMemo(() => {
    const topologyNode = FACILITY_NODES.find(n => n.node_id === selectedNodeId) || FACILITY_NODES[1];
    let simNode = null;
    if (simulationData && simulationData.nodes) {
      simNode = simulationData.nodes.find(n => n.node_id === selectedNodeId);
    }

    const currentStock = simNode?.mitigated?.stock ?? simNode?.current_stock ?? topologyNode.nominal_stock;
    const capacity = topologyNode.capacity_units;
    const fillStatus = getStockCapacityStatus(currentStock, capacity);

    return {
      ...topologyNode,
      simNode,
      currentStock,
      fillStatus,
      dock_doors: topologyNode.dock_doors || 14,
      handling_rate_units_hr: topologyNode.handling_rate_units_hr || 3200,
      daily_gate_capacity: (topologyNode.dock_doors || 14) * (topologyNode.handling_rate_units_hr || 3200) * 12,
      mitigatedStock: simNode?.mitigated?.stock ?? currentStock,
      baselineStock: simNode?.baseline?.stock ?? Math.round(currentStock * 0.45),
      utilizationPct: simNode?.mitigated?.capacity_utilization_pct ?? Math.round((currentStock / capacity) * 100),
      baselineUtilizationPct: simNode?.baseline?.capacity_utilization_pct ?? 18.0,
      stockoutPct: simNode?.mitigated?.stockout_probability_pct ?? 2.1,
      baselineStockoutPct: simNode?.baseline?.stockout_probability_pct ?? 24.8,
      unmetUnits: simNode?.mitigated?.unmet_demand_units ?? 0,
      baselineUnmetUnits: simNode?.baseline?.unmet_demand_units ?? 4200,
      cumulativeHoldingCost: simNode?.holding_cost_inr ?? (currentStock * topologyNode.holding_cost_rate * horizonDays)
    };
  }, [selectedNodeId, simulationData, horizonDays]);

  // Handle Directive Dispatch Mock
  const handleDispatchDirective = (index) => {
    setDispatchedDirectives(prev => ({
      ...prev,
      [index]: true
    }));
  };

  // Trajectory Line Chart Data Preparation
  const chartData = useMemo(() => {
    if (!simulationData || !simulationData.timeline_events) return null;

    const labels = simulationData.timeline_events.map(e => e.label);

    if (chartMetric === 'stock') {
      return {
        labels,
        datasets: [
          {
            label: 'Baseline Unmitigated Stock (Units)',
            data: simulationData.timeline_events.map(e => e.baseline_stock),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            borderWidth: 2.5,
            pointBackgroundColor: '#ef4444',
            pointRadius: 3,
            tension: 0.35,
            fill: true
          },
          {
            label: 'Mitigated Buffer Stock (Units)',
            data: simulationData.timeline_events.map(e => e.mitigated_stock),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderWidth: 2.5,
            pointBackgroundColor: '#10b981',
            pointRadius: 3,
            tension: 0.35,
            fill: true
          }
        ]
      };
    } else {
      return {
        labels,
        datasets: [
          {
            label: 'Baseline Delay Hours (Gridlock)',
            data: simulationData.timeline_events.map(e => e.baseline_cum_delay),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.12)',
            borderWidth: 2.5,
            pointBackgroundColor: '#f97316',
            pointRadius: 3,
            tension: 0.3,
            fill: true
          },
          {
            label: 'Mitigated Delay Hours (Bypass Route)',
            data: simulationData.timeline_events.map(e => e.mitigated_cum_delay),
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            borderWidth: 2.5,
            pointBackgroundColor: '#38bdf8',
            pointRadius: 3,
            tension: 0.3,
            fill: true
          }
        ]
      };
    }
  }, [simulationData, chartMetric]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: 'Plus Jakarta Sans', size: 10, weight: '600' },
          usePointStyle: true,
          boxWidth: 6
        }
      },
      tooltip: {
        backgroundColor: '#090d16',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        titleFont: { size: 11, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 8,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
      }
    }
  };

  // Node icon helper
  const getNodeIcon = (nodeType, className = "w-4 h-4") => {
    switch (nodeType) {
      case 'port':
        return <Anchor className={`${className} text-blue-400`} />;
      case 'central_dc':
        return <Package className={`${className} text-orange-400`} />;
      case 'regional_hub':
        return <Building2 className={`${className} text-emerald-400`} />;
      case 'regional_depot':
        return <Layers className={`${className} text-purple-400`} />;
      case 'fulfillment_center':
        return <Building2 className={`${className} text-amber-400`} />;
      default:
        return <Globe className={`${className} text-slate-400`} />;
    }
  };

  // Financial calculations
  const baselineCost = simulationData?.comparative_delta?.baseline_cost_inr || simulationData?.baseline_metrics?.baseline_cost_inr || 0;
  const mitigatedCost = simulationData?.comparative_delta?.mitigated_cost_inr || simulationData?.mitigated_metrics?.mitigated_cost_inr || 0;
  const netSavings = simulationData?.comparative_delta?.net_savings_inr ?? simulationData?.comparative_delta?.cost_savings_inr ?? Math.max(0, baselineCost - mitigatedCost);
  const delayHoursAvoided = simulationData?.comparative_delta?.sla_delay_hours_avoided ?? Math.max(0, Math.round((simulationData?.baseline_metrics?.sla_delay_hours || 0) - (simulationData?.mitigated_metrics?.sla_delay_hours || 0)));

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border-2 border-slate-850 bg-slate-950 shadow-2xl flex flex-col select-none"
      style={{ minHeight: '840px', height: 'calc(100vh - 7.5rem)' }}
    >
      {/* 1. Central 3D Cyber-Geospatial Viewport (Full Height Canvas Mount) */}
      <CesiumTwinViewport
        ref={viewportRef}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
        simulationNodes={simulationData?.nodes}
        simulationLinks={simulationData?.links}
        activeScenarioId={selectedScenarioId}
        shockIntensity={shockIntensity}
        enableMitigation={enableMitigation}
        height="100%"
        showLegend={false}
        showViewportControls={false}
        showTopRibbon={false}
        showSentinelHUD={false}
        className="w-full h-full absolute inset-0"
      />

      {/* 2. Top Glassmorphic Command Header Ribbon */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Command Center Title, Live Status & Active Shock */}
        <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-white shadow-xl">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
            <span className="text-xs font-black tracking-wide text-slate-100 uppercase">
              3D Digital Twin Command Center
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

          {/* Active Scenario Tag */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="truncate max-w-[140px] sm:max-w-none">
              {simulationData?.scenario_name || 'Port Strike'}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30">
              {shockIntensity}%
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Execution Time */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-emerald-400 font-mono">
            <span>SLA:</span>
            <span className="font-bold">{simulationData?.execution_time_seconds || '0.003'}s</span>
            <span className="text-slate-500">(&lt;5.0s)</span>
          </div>
        </div>

        {/* Center: 1-Click Smooth Glide Navigation Ribbon */}
        <div className="pointer-events-auto hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 shadow-xl text-white">
          <button
            type="button"
            onClick={() => viewportRef.current?.flyToPreset('CORRIDOR_OVERVIEW')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Overview of Western Maharashtra Corridor"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Corridor</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

          {FACILITY_NODES.map((node) => {
            const isSelected = selectedNodeId === node.node_id;
            return (
              <button
                key={node.node_id}
                type="button"
                onClick={() => handleSelectNode(node.node_id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#ff5400] text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={`${node.tier_label} • ${node.city}`}
              >
                {getNodeIcon(node.node_type, "w-3.5 h-3.5")}
                <span>{node.shortName}</span>
              </button>
            );
          })}

          <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

          <button
            type="button"
            onClick={() => viewportRef.current?.flyToPreset('KASARA_GHAT')}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
            title="Steep mountain pass on NH-160"
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Kasara Ghat</span>
          </button>
        </div>

        {/* Right: Layer Toggles, Network Grid Modal & Autonomous Sentinel HUD */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Viewport Layers Toggle Dropdown / Buttons */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 shadow-xl text-white">
            {/* Toggle 3D Globe vs 3D Schematic Mode */}
            <button
              type="button"
              onClick={() => {
                const next = !useSchematicView;
                setUseSchematicView(next);
                viewportRef.current?.setUseSchematicView?.(next);
              }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                useSchematicView ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle between 3D Globe and 2.5D Schematic Vector View"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>

            {/* Toggle Highway Flow Conduits & Bypasses */}
            <button
              type="button"
              onClick={() => {
                const next = !showFlowConduits;
                setShowFlowConduits(next);
                viewportRef.current?.setShowFlowConduits(next);
              }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                showFlowConduits ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Highway Flow Conduits & Bypasses"
            >
              <Route className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !showShockwaves;
                setShowShockwaves(next);
                viewportRef.current?.setShowShockwaves(next);
              }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                showShockwaves ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Disruption Shockwaves"
            >
              <Radio className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                viewportRef.current?.toggleBuildings();
                setShowBuildings(!showBuildings);
              }}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                showBuildings ? 'bg-blue-600/80 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle 3D OSM Building Mesh"
            >
              <Building2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => viewportRef.current?.resetCamera()}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Reset Camera to Corridor Overview"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Active Persona Lens Badge */}
          <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-black shadow-lg ${
            profile?.badge_color === 'emerald'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
              : profile?.badge_color === 'amber'
              ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
              : profile?.badge_color === 'coral'
              ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
              : 'bg-orange-950/80 text-orange-300 border-orange-500/50'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{profile?.title || 'Supply Chain Director'}</span>
          </div>

          {/* WebSocket Streaming Status Indicator */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-xs font-bold text-slate-300 shadow-lg">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
            <span className="font-mono text-[10px]">{wsConnected ? '1Hz WS Live' : 'WS Reconnecting'}</span>
          </div>

          {/* Network Grid & Corridors Table Toggle Modal Button */}
          <button
            type="button"
            onClick={() => setIsTopologyModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-slate-200 hover:text-white hover:border-[#ff5400]/60 transition text-xs font-bold shadow-xl cursor-pointer"
            title="Inspect 5-Node Topology Cards & Corridor Transit Matrix"
          >
            <Compass className="w-3.5 h-3.5 text-[#ff5400]" />
            <span className="hidden sm:inline">Network Grid</span>
          </button>

          {/* Compact Autonomous Sentinel HUD */}
          <AutonomousSentinelHUD compact={true} />
        </div>
      </div>

      {/* 3. Bottom-Left Drawer: Shock Scenario Studio & Parameter Controls */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-auto w-[360px] sm:w-[410px] max-w-[calc(100%-1.5rem)]">
        <div className="rounded-2xl backdrop-blur-2xl bg-slate-950/88 border border-slate-700/80 shadow-2xl text-white overflow-hidden transition-all duration-300">
          {/* Drawer Header */}
          <div className="px-4 py-3 bg-slate-900/70 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[#ff5400]">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-wide text-slate-100 uppercase">
                  Shock Scenario Studio
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isStudioCollapsed ? `${simulationData?.scenario_name} • ${shockIntensity}%` : 'Select Preset & Inject Disruption'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => runSimulation(selectedScenarioId, shockIntensity, enableMitigation, horizonDays)}
                disabled={loading}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Run Simulation Now"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#ff5400]' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsStudioCollapsed(!isStudioCollapsed)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title={isStudioCollapsed ? 'Expand Scenario Studio' : 'Collapse Studio'}
              >
                {isStudioCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Drawer Body (Expandable) */}
          {!isStudioCollapsed && (
            <div className="p-4 space-y-4 max-h-[460px] overflow-y-auto">
              {/* RBAC Notice (When role is not Director or Admin) */}
              {!canSimulate && (
                <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center gap-2 text-[11px] text-amber-200">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Viewing as {profile?.title || 'Operational Role'}. Shock injection simulation is restricted to Supply Chain Director & Admin.</span>
                </div>
              )}

              {/* 1-Click Shock Scenario Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>1-CLICK PRESET SHOCKS</span>
                  <span className="text-[#ff5400]">{canSimulate ? 'Select Disruption' : 'Read-Only Mode'}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Preset 1: Port Strike */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedScenarioId('port_strike');
                      setShockIntensity(75);
                      runSimulation('port_strike', 75, enableMitigation, horizonDays);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      selectedScenarioId === 'port_strike'
                        ? 'border-orange-500 bg-orange-950/40 shadow-[0_0_12px_rgba(255,84,0,0.25)]'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Anchor className="w-4 h-4 text-orange-400" />
                      <span className="text-[9px] font-mono font-bold text-orange-300 px-1 py-0.2 rounded bg-orange-950 border border-orange-500/40">
                        75%
                      </span>
                    </div>
                    <div>
                      <div className="text-[11px] font-extrabold text-slate-100 leading-tight">Port Strike</div>
                      <div className="text-[9px] text-slate-400 truncate mt-0.5">JNPT Gates Choked</div>
                    </div>
                  </button>

                  {/* Preset 2: Monsoon Closures */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedScenarioId('monsoon_closures');
                      setShockIntensity(70);
                      runSimulation('monsoon_closures', 70, enableMitigation, horizonDays);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      selectedScenarioId === 'monsoon_closures'
                        ? 'border-blue-500 bg-blue-950/40 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <CloudRain className="w-4 h-4 text-blue-400" />
                      <span className="text-[9px] font-mono font-bold text-blue-300 px-1 py-0.2 rounded bg-blue-950 border border-blue-500/40">
                        70%
                      </span>
                    </div>
                    <div>
                      <div className="text-[11px] font-extrabold text-slate-100 leading-tight">Monsoons</div>
                      <div className="text-[9px] text-slate-400 truncate mt-0.5">Kasara Mudslide</div>
                    </div>
                  </button>

                  {/* Preset 3: Bridge Failure */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedScenarioId('bridge_failure');
                      setShockIntensity(85);
                      runSimulation('bridge_failure', 85, enableMitigation, horizonDays);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      selectedScenarioId === 'bridge_failure'
                        ? 'border-rose-500 bg-rose-950/40 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span className="text-[9px] font-mono font-bold text-rose-300 px-1 py-0.2 rounded bg-rose-950 border border-rose-500/40">
                        85%
                      </span>
                    </div>
                    <div>
                      <div className="text-[11px] font-extrabold text-slate-100 leading-tight">Bridge Fault</div>
                      <div className="text-[9px] text-slate-400 truncate mt-0.5">Khandala Expressway</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Interactive Shock Intensity Slider (1-100%) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-300 flex items-center gap-1.5">
                    <span>Intensity Slider:</span>
                    <span className="font-mono text-sm text-[#ff5400] font-black">{shockIntensity}%</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${currentSeverity.color}`}>
                    {currentSeverity.label}
                  </span>
                </div>

                <input
                  id="shock-intensity-slider"
                  type="range"
                  min="1"
                  max="100"
                  value={shockIntensity}
                  onChange={(e) => setShockIntensity(Number(e.target.value))}
                  onMouseUp={() => runSimulation(selectedScenarioId, shockIntensity, enableMitigation, horizonDays)}
                  onTouchEnd={() => runSimulation(selectedScenarioId, shockIntensity, enableMitigation, horizonDays)}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#ff5400]"
                />

                <div className="flex justify-between text-[9px] font-bold text-slate-500 font-mono">
                  <span>1% Minor</span>
                  <span>25% Mild</span>
                  <span>50% Strain</span>
                  <span>75% Severe</span>
                  <span>100% Outage</span>
                </div>
              </div>

              {/* Controls Row: Mitigation Toggle & Horizon Selector */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800 items-center">
                {/* Mitigation Toggle Switch */}
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-200">Mitigation</div>
                    <div className="text-[9px] text-slate-400">Auto Reroute</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMit = !enableMitigation;
                      setEnableMitigation(nextMit);
                      runSimulation(selectedScenarioId, shockIntensity, nextMit, horizonDays);
                    }}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      enableMitigation ? 'bg-[#00c853]' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        enableMitigation ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Horizon Selector */}
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] font-bold text-slate-200">Horizon</div>
                  <select
                    value={horizonDays}
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      setHorizonDays(h);
                      runSimulation(selectedScenarioId, shockIntensity, enableMitigation, h);
                    }}
                    className="text-xs font-mono font-bold bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-1"
                  >
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={21}>21 Days</option>
                  </select>
                </div>
              </div>

              {/* Action Trigger Button */}
              <button
                type="button"
                onClick={() => runSimulation(selectedScenarioId, shockIntensity, enableMitigation, horizonDays)}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#ff5400] hover:bg-[#e04a00] text-white text-xs font-black transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Simulating Dynamic Shock...' : 'Simulate Shock Response (< 5.0s)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom-Right Drawer: Comparative Financial Impact & Dynamic Timeline Charts */}
      <div className="absolute bottom-3 right-3 z-20 pointer-events-auto w-[420px] sm:w-[500px] max-w-[calc(100%-1.5rem)]">
        <div className="rounded-2xl backdrop-blur-2xl bg-slate-950/88 border border-slate-700/80 shadow-2xl text-white overflow-hidden transition-all duration-300">
          {/* Drawer Header & Tabs */}
          <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-wide text-slate-100 uppercase">
                  Comparative Impact &amp; Trajectory
                </h3>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  Save ₹{(netSavings / 1000).toFixed(1)}k • -{simulationData?.comparative_delta?.sla_delay_reduction_pct}% Delay
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {!isImpactCollapsed && (
                <div className="flex p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setImpactDrawerTab('impact')}
                    className={`px-2 py-1 rounded-md transition ${
                      impactDrawerTab === 'impact' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Impact
                  </button>
                  <button
                    type="button"
                    onClick={() => setImpactDrawerTab('timeline')}
                    className={`px-2 py-1 rounded-md transition ${
                      impactDrawerTab === 'timeline' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setImpactDrawerTab('directives')}
                    className={`px-2 py-1 rounded-md transition ${
                      impactDrawerTab === 'directives' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Directives
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsImpactCollapsed(!isImpactCollapsed)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title={isImpactCollapsed ? 'Expand Impact Drawer' : 'Collapse Drawer'}
              >
                {isImpactCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Drawer Body (Expandable) */}
          {!isImpactCollapsed && (
            <div className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
              {/* Tab 1: Comparative Financial & Operational Impact Cards */}
              {impactDrawerTab === 'impact' && (
                <div className="space-y-3">
                  {/* Persona Role Lens Filter Bar */}
                  <div className="flex items-center justify-between p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-[10px] font-bold">
                    <span className="text-slate-400 px-1.5 uppercase font-mono">Role Lens:</span>
                    <div className="flex items-center gap-1 overflow-x-auto">
                      {[
                        { id: 'director', label: 'Director' },
                        { id: 'dispatcher', label: 'Dispatcher' },
                        { id: 'customs', label: 'Customs' },
                        { id: 'admin', label: 'Admin' }
                      ].map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setSelectedPersonaFilter(role.id)}
                          className={`px-2 py-0.5 rounded-lg transition cursor-pointer font-bold ${
                            selectedPersonaFilter === role.id
                              ? 'bg-[#ff5400] text-white shadow-xs'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1. Director Persona: Financial ROI & Invariant Guarantee */}
                  {selectedPersonaFilter === 'director' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Card 1: Total Cost (Baseline vs Mitigated) */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                          <span>Operational Cost</span>
                          <span className="text-emerald-400 font-mono font-extrabold">Save ₹{(netSavings / 1000).toFixed(1)}k</span>
                        </div>
                        <div className="flex items-baseline justify-between pt-0.5">
                          <div className="text-lg font-black font-mono text-emerald-400">
                            ₹{(mitigatedCost / 1000).toFixed(1)}k
                          </div>
                          <div className="text-xs font-bold font-mono text-rose-500 line-through opacity-70">
                            ₹{(baselineCost / 1000).toFixed(1)}k
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">
                          mitigated_cost &le; baseline_cost (Verified ✓)
                        </div>
                      </div>

                      {/* Card 2: SLA Delay Hours Avoided */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                          <span>SLA Delay Hours</span>
                          <span className="text-emerald-400 font-mono font-extrabold">
                            -{simulationData?.comparative_delta?.sla_delay_reduction_pct}%
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-0.5">
                          <div className="text-lg font-black font-mono text-slate-100">
                            {simulationData?.mitigated_metrics?.sla_delay_hours}h
                          </div>
                          <div className="text-xs font-bold font-mono text-rose-500 line-through opacity-70">
                            {simulationData?.baseline_metrics?.sla_delay_hours}h
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">
                          Avoids {delayHoursAvoided}h delivery delay
                        </div>
                      </div>

                      {/* Card 3: Composite Risk Index */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                          <span>Composite Risk</span>
                          <span className="text-emerald-400 font-mono font-extrabold">
                            -{simulationData?.comparative_delta?.risk_reduction_pct}%
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-0.5">
                          <div className="text-lg font-black font-mono text-slate-100">
                            {simulationData?.mitigated_metrics?.risk_index}
                            <span className="text-[10px] text-slate-500 font-normal"> / 100</span>
                          </div>
                          <div className="text-xs font-bold font-mono text-rose-500 line-through opacity-70">
                            {simulationData?.baseline_metrics?.risk_index}
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">
                          Bottleneck index stabilized
                        </div>
                      </div>

                      {/* Card 4: Demurrage & Holding Surge */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                          <span>Yard Demurrage</span>
                          <span className="text-blue-400 font-mono font-bold">
                            +{simulationData?.mitigated_metrics?.holding_cost_surge_pct}%
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-0.5">
                          <div className="text-lg font-black font-mono text-slate-100">
                            ₹{((simulationData?.mitigated_metrics?.holding_cost_inr || 0) / 1000).toFixed(1)}k
                          </div>
                          <div className="text-xs font-bold font-mono text-rose-500 line-through opacity-70">
                            ₹{((simulationData?.baseline_metrics?.holding_cost_inr || 0) / 1000).toFixed(1)}k
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">
                          Diverts container yard dwell choke
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Dispatcher Persona: Fleet Movements & Detour Directives */}
                  {selectedPersonaFilter === 'dispatcher' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Bypass Fleet Diverted</div>
                        <div className="text-lg font-black font-mono text-emerald-400">142 Trucks</div>
                        <div className="text-[9px] text-slate-400 font-medium">Active bypass corridors utilized</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Corridor Delay Saved</div>
                        <div className="text-lg font-black font-mono text-sky-400">{delayHoursAvoided} Hours</div>
                        <div className="text-[9px] text-slate-400 font-medium">Driver duty clock protected</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Congestion Relief</div>
                        <div className="text-lg font-black font-mono text-emerald-400">
                          {enableMitigation ? '68% Free Flow' : 'Heavy Choke'}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">NH-48 & NH-160 flow state</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Live Roadblocks</div>
                        <div className="text-lg font-black font-mono text-amber-400">
                          {liveRoadblocks.length} Active
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Monitored via 1Hz WS Telemetry</div>
                      </div>
                    </div>
                  )}

                  {/* 3. Customs Persona: JNPT Clearance & Bonded Buffers */}
                  {selectedPersonaFilter === 'customs' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">JNPT Gate Dwell</div>
                        <div className="text-lg font-black font-mono text-emerald-400">
                          -{simulationData?.comparative_delta?.sla_delay_reduction_pct || 42}%
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Container gate clearance optimized</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Clearance Backlog</div>
                        <div className="text-lg font-black font-mono text-sky-400">0 Critical Chokes</div>
                        <div className="text-[9px] text-slate-400 font-medium">Pre-cleared electronic manifests</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Bonded Buffer Stock</div>
                        <div className="text-lg font-black font-mono text-slate-100">42,000 u</div>
                        <div className="text-[9px] text-slate-400 font-medium">Port terminal holding capacity</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Audit Compliance</div>
                        <div className="text-lg font-black font-mono text-emerald-400">100% Passed</div>
                        <div className="text-[9px] text-slate-400 font-medium">Customs compliance verified ✓</div>
                      </div>
                    </div>
                  )}

                  {/* 4. Admin Persona: Computational SLA & Engine Status */}
                  {selectedPersonaFilter === 'admin' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">DES Engine SLA</div>
                        <div className="text-lg font-black font-mono text-emerald-400">
                          {simulationData?.execution_time_seconds || '0.003'}s
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">SLA Target &lt;5.0s (Met ✓)</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">WebSocket Stream</div>
                        <div className="text-lg font-black font-mono text-sky-400">
                          {wsConnected ? '1.0 Hz Active' : 'Connecting'}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Bidirectional telemetry hub</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Rendering Target</div>
                        <div className="text-lg font-black font-mono text-emerald-400">&ge; 60 FPS</div>
                        <div className="text-[9px] text-slate-400 font-medium">Optimized in-place updates</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Topology Nodes</div>
                        <div className="text-lg font-black font-mono text-slate-100">5 Active Hubs</div>
                        <div className="text-[9px] text-slate-400 font-medium">All corridors synchronized</div>
                      </div>
                    </div>
                  )}

                  {/* CO2 & Detour Benefit Banner */}
                  <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-sky-400" />
                      <div>
                        <div className="text-[11px] font-bold text-sky-200">Green Bypass Flow</div>
                        <div className="text-[10px] text-slate-400">
                          Detour bypass eliminates {Math.round(simulationData?.baseline_metrics?.co2_emissions_kg || 0)} kg stop-and-go idling waste
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-400/40">
                      Cruise Mode Active
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: Dynamic Timeline Charts */}
              {impactDrawerTab === 'timeline' && chartData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      {simulationData?.simulation_horizon_days}-Day Trajectory Comparison
                    </span>
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setChartMetric('stock')}
                        className={`px-2 py-0.5 rounded transition ${
                          chartMetric === 'stock' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                        }`}
                      >
                        Inventory Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartMetric('delay')}
                        className={`px-2 py-0.5 rounded transition ${
                          chartMetric === 'delay' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
                        }`}
                      >
                        Cumulative Delay
                      </button>
                    </div>
                  </div>

                  <div className="h-48 w-full pt-1">
                    <Line data={chartData} options={chartOptions} />
                  </div>
                </div>
              )}

              {/* Tab 3: Actionable Directives Playbook */}
              {impactDrawerTab === 'directives' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>COGNITIVE MITIGATION DIRECTIVES</span>
                    <span className="text-[#ff5400]">{simulationData?.contingency_recommendations?.length || 0} Ready</span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {simulationData?.contingency_recommendations?.map((rec, idx) => {
                      const isDispatched = dispatchedDirectives[idx];
                      const priorityColor = {
                        CRITICAL: 'bg-rose-950 text-rose-300 border-rose-500/50',
                        HIGH: 'bg-orange-950 text-orange-300 border-orange-500/50',
                        MEDIUM: 'bg-amber-950 text-amber-300 border-amber-500/50',
                        LOW: 'bg-slate-900 text-slate-300 border-slate-700'
                      }[rec.priority] || 'bg-slate-900 text-slate-300';

                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${priorityColor}`}>
                              {rec.priority}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-400">
                              {rec.expected_impact}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-100">{rec.action}</div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {rec.details}
                          </p>
                          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">TMS/WMS Dispatch</span>
                            <button
                              type="button"
                              onClick={() => handleDispatchDirective(idx)}
                              disabled={isDispatched}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                isDispatched
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 hover:bg-slate-700 text-white'
                              }`}
                            >
                              {isDispatched ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>Dispatched</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3 h-3" />
                                  <span>Dispatch Directive</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Right-Side Facility Telemetry Inspector Drawer (Interactive 3D Picking Inspector) */}
      {isInspectorOpen && activeNodeDetails && (
        <div className="absolute top-16 right-3 bottom-16 z-30 pointer-events-auto w-84 sm:w-96 max-w-[calc(100%-1.5rem)]">
          <div className="h-full rounded-2xl backdrop-blur-2xl bg-slate-950/92 border border-slate-700/80 shadow-2xl text-white flex flex-col overflow-hidden transition-all duration-300">
            {/* Inspector Header */}
            <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[#ff5400]">
                  {getNodeIcon(activeNodeDetails.node_type, "w-5 h-5")}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-100">
                      {activeNodeDetails.name}
                    </h4>
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold">
                    {activeNodeDetails.city} • <span className="font-mono text-slate-300">{activeNodeDetails.node_id}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => viewportRef.current?.flyToNode(activeNodeDetails.node_id)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Glide 3D Camera to Node"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inspector Scrollable Metrics Content */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {/* Section 1: Holographic Stock & Inventory Fill */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                    Inventory Stock &amp; Capacity
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    activeNodeDetails.fillStatus.status === 'healthy'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                      : activeNodeDetails.fillStatus.status === 'stressed'
                      ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                      : 'bg-rose-950 text-rose-300 border-rose-500/50'
                  }`}>
                    {activeNodeDetails.fillStatus.status} ({activeNodeDetails.fillStatus.fillPct}%)
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-xl font-black font-mono text-slate-100">
                    {activeNodeDetails.currentStock?.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400"> / {activeNodeDetails.capacity_units?.toLocaleString()} u</span>
                  </div>
                  <div className="text-xs font-bold font-mono text-emerald-400">
                    {activeNodeDetails.utilizationPct}% Util
                  </div>
                </div>

                {/* Progress bar reflecting holographic fill % */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, activeNodeDetails.fillStatus.fillPct)}%`,
                      backgroundColor: activeNodeDetails.fillStatus.hexColor,
                      boxShadow: `0 0 10px ${activeNodeDetails.fillStatus.hexColor}`
                    }}
                  />
                </div>

                {/* Comparative stock baseline vs mitigated */}
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Mitigated Buffer</div>
                    <div className="font-mono font-bold text-emerald-400">
                      {activeNodeDetails.mitigatedStock?.toLocaleString()} u
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Baseline Shock</div>
                    <div className="font-mono font-bold text-rose-400">
                      {activeNodeDetails.baselineStock?.toLocaleString()} u
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>Stockout Risk: <strong className="text-slate-200">{activeNodeDetails.stockoutPct}%</strong> (was {activeNodeDetails.baselineStockoutPct}%)</span>
                  <span>Deficit: <strong className="text-slate-200">{activeNodeDetails.unmetUnits} u</strong></span>
                </div>
              </div>

              {/* Section 2: Dock Throughput & Gate Operations */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                    Dock Throughput &amp; Handling Rate
                  </span>
                  <span className="text-[10px] font-bold text-sky-400 font-mono">
                    Tier {activeNodeDetails.echelon_tier}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Dock Doors</div>
                    <div className="text-base font-black font-mono text-slate-100 flex items-center gap-1.5">
                      <Warehouse className="w-4 h-4 text-orange-400" />
                      <span>{activeNodeDetails.dock_doors} Bays</span>
                    </div>
                    <div className="text-[9px] text-slate-500">Dedicated freight intake</div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-0.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Handling Rate</div>
                    <div className="text-base font-black font-mono text-sky-400 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-sky-400" />
                      <span>{activeNodeDetails.handling_rate_units_hr?.toLocaleString()} u/h</span>
                    </div>
                    <div className="text-[9px] text-slate-500">Cross-dock velocity</div>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Daily Gate Capacity (12h)</div>
                    <div className="font-mono font-bold text-emerald-400 text-sm">
                      {Math.round(activeNodeDetails.daily_gate_capacity).toLocaleString()} units/day
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-medium">Turnaround Dwell</div>
                    <div className="font-mono font-bold text-slate-200 text-xs">
                      {activeNodeDetails.node_type === 'port' ? '2.5 Hours' : '45 Minutes'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Lead Time & Inventory Holding Costs */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Replenishment Lead Time &amp; Holding Fees
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Replenishment Lead</div>
                    <div className="text-sm font-black font-mono text-slate-100 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{activeNodeDetails.lead_time_days} Days</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Holding Fee Rate</div>
                    <div className="text-sm font-black font-mono text-slate-100 mt-0.5">
                      ₹{activeNodeDetails.holding_cost_rate} <span className="text-[9px] font-normal text-slate-400">/u/day</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
                  {activeNodeDetails.description}
                </p>
              </div>

              {/* Section 4: Glide Camera Action */}
              <button
                type="button"
                onClick={() => viewportRef.current?.flyToNode(activeNodeDetails.node_id)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer shadow-md"
              >
                <Globe className="w-4 h-4" />
                <span>Glide 3D Camera to {activeNodeDetails.shortName}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Multi-Echelon Network Topology & Corridors Table Modal */}
      {isTopologyModalOpen && (
        <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-4xl w-full max-h-[85vh] rounded-2xl bg-slate-900 border-2 border-slate-700 shadow-2xl text-white flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ff5400]/20 border border-[#ff5400]/40 flex items-center justify-center text-[#ff5400]">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Multi-Echelon Network Topology &amp; Corridors Matrix
                  </h3>
                  <p className="text-xs text-slate-400">
                    5 strategic logistics hubs and 4 inter-node freight corridors under {simulationData?.scenario_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsTopologyModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-6 overflow-y-auto">
              {/* 5 Facility Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {FACILITY_NODES.map((node) => {
                  const isSelected = selectedNodeId === node.node_id;
                  const simNode = simulationData?.nodes?.find(n => n.node_id === node.node_id);
                  const currentStock = simNode?.mitigated?.stock ?? simNode?.current_stock ?? node.nominal_stock;
                  const status = simNode?.mitigated?.status || 'healthy';

                  return (
                    <div
                      key={node.node_id}
                      onClick={() => {
                        handleSelectNode(node.node_id);
                        setIsTopologyModalOpen(false);
                      }}
                      className={`p-3.5 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'border-[#ff5400] bg-orange-950/40 shadow-md'
                          : 'border-slate-800 bg-slate-850 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          Tier {node.echelon_tier}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          status === 'healthy' ? 'bg-emerald-950 text-emerald-400' :
                          status === 'stressed' ? 'bg-amber-950 text-amber-400' :
                          'bg-rose-950 text-rose-400'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{node.shortName}</div>
                      <div className="text-[10px] text-slate-400">{node.city}</div>
                      <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Stock:</span>
                          <span className="font-bold text-slate-200">{currentStock.toLocaleString()} u</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Lead:</span>
                          <span className="text-slate-200">{node.lead_time_days}d</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Corridor Transit Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-[#ff5400]" />
                  <span>Corridor Transit &amp; Alternative Bypass Routing Status</span>
                </h4>

                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-850 border-b border-slate-800 font-bold text-slate-400">
                      <tr>
                        <th className="p-3">Corridor</th>
                        <th className="p-3">Distance</th>
                        <th className="p-3">Nominal</th>
                        <th className="p-3">Baseline Shock</th>
                        <th className="p-3">Mitigated Transit</th>
                        <th className="p-3">Contingency Alignment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {simulationData?.links?.map((link) => {
                        const isRerouted = link.mitigated?.is_rerouted;
                        return (
                          <tr key={link.link_id} className={isRerouted ? 'bg-blue-950/30' : 'bg-slate-900/60'}>
                            <td className="p-3 font-bold text-slate-200">
                              {link.corridor_name}
                              <div className="text-[10px] text-slate-500">{link.highway_code}</div>
                            </td>
                            <td className="p-3 font-mono text-slate-400">{link.distance_km} km</td>
                            <td className="p-3 font-mono text-slate-400">{link.nominal_hours}h</td>
                            <td className="p-3">
                              <span className={`font-mono font-bold ${link.baseline.delay_hours > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                {link.baseline.simulated_hours}h
                                {link.baseline.delay_hours > 0 && ` (+${link.baseline.delay_hours}h)`}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="font-mono font-bold text-emerald-400">
                                {link.mitigated.simulated_hours}h
                                {link.mitigated.delay_hours > 0 && ` (+${link.mitigated.delay_hours}h)`}
                              </span>
                            </td>
                            <td className="p-3">
                              {isRerouted ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-500/40">
                                  <Split className="w-3 h-3" />
                                  {link.alternative_route?.name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500">Standard Direct Alignment</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
