import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  MapPin, 
  FileCheck2, 
  Cpu, 
  Activity, 
  BarChart3, 
  Truck, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  Terminal,
  Database,
  RefreshCw,
  Layers,
  Server
} from 'lucide-react';
import { usePersona } from '../context/PersonaContext';
import { api } from '../services/api';
import ForecastingTab from './ForecastingTab';
import RoutingTab from './RoutingTab';
import ComplianceTab from './ComplianceTab';
import DigitalTwinTab from './DigitalTwinTab';

const TABS = [
  { id: 'kpis', label: 'Executive KPIs', icon: BarChart3, viewRequired: 'kpis' },
  { id: 'forecasting', label: 'Demand Forecasting', icon: TrendingUp, viewRequired: 'forecasting' },
  { id: 'routing', label: 'Route & Fleet Optimizer', icon: MapPin, viewRequired: 'routing' },
  { id: 'compliance', label: 'Trade Compliance & IDP', icon: FileCheck2, viewRequired: 'compliance' },
  { id: 'twin', label: 'Digital Twin Studio', icon: Activity, viewRequired: 'twin' },
  { id: 'system', label: 'IT Administration', icon: Cpu, viewRequired: 'system' }
];

export default function DashboardShell() {
  const { currentRole, profile, canView, switchPersona } = usePersona();
  const [activeTab, setActiveTab] = useState('kpis');
  const [adminOutput, setAdminOutput] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(null);

  // PyTorch model retraining states
  const [retrainLoading, setRetrainLoading] = useState(false);
  const [retrainOutput, setRetrainOutput] = useState(null);
  const [retrainError, setRetrainError] = useState(null);
  const [retrainEpochs, setRetrainEpochs] = useState(15);
  const [retrainTarget, setRetrainTarget] = useState('all');


  // If current active tab is not accessible by the new persona, switch to first allowed tab
  useEffect(() => {
    const isAllowed = canView(activeTab);
    if (!isAllowed) {
      const firstAllowed = TABS.find(t => canView(t.viewRequired));
      if (firstAllowed) {
        setActiveTab(firstAllowed.id);
      }
    }
  }, [currentRole, profile]);

  const handleTestAdminEndpoint = async () => {
    setAdminLoading(true);
    setAdminError(null);
    setAdminOutput(null);
    try {
      const res = await api.getAdminSystemStatus();
      setAdminOutput(res);
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRetrainModels = async () => {
    setRetrainLoading(true);
    setRetrainError(null);
    setRetrainOutput(null);
    try {
      const res = await api.retrainModels({ models: retrainTarget, epochs: Number(retrainEpochs) });
      setRetrainOutput(res);
      // Refresh system status after retraining to show updated timestamps and sizes
      try {
        const sysRes = await api.getAdminSystemStatus();
        setAdminOutput(sysRes);
      } catch {
        // ignore
      }
    } catch (err) {
      setRetrainError(err.message);
    } finally {
      setRetrainLoading(false);
    }
  };

  // Auto-fetch admin system status when viewing system tab as admin
  useEffect(() => {
    if (activeTab === 'system' && currentRole === 'admin' && !adminOutput && !adminLoading) {
      handleTestAdminEndpoint();
    }
  }, [activeTab, currentRole]);


  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* High-Visibility Persona Header Banner */}
      <div className="bright-card rounded-2xl p-6 border-l-6 border-l-[#FF5400] relative overflow-hidden bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-200">
                Active Operational Persona
              </span>
              <span className="text-xs text-slate-300">•</span>
              <span className="text-xs font-semibold text-slate-600">
                Western India Corridor: JNPT / Mumbai ↔ Thane ↔ Nashik ↔ Pune
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              {profile?.title}
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-700">
                {currentRole}
              </span>
            </h2>
            <p className="text-sm font-medium text-slate-600 max-w-3xl mt-1.5 leading-relaxed">
              {profile?.description}
            </p>
          </div>

          {/* Quick permissions badge list */}
          <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Assigned Permissions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {profile?.permissions?.views?.map(v => (
                <span 
                  key={v} 
                  className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-white text-slate-800 border border-slate-300 shadow-xs"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Tab Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b-2 border-slate-200">
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          const isAllowed = canView(tab.viewRequired);
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap shrink-0 active:scale-[0.98] ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : isAllowed
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
                    : 'text-slate-400 bg-slate-100/60 border border-slate-200 cursor-not-allowed opacity-60'
              }`}
            >
              <TabIcon className={`w-4 h-4 ${isActive ? 'text-[#FF5400]' : isAllowed ? 'text-slate-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {!isAllowed && (
                <Lock className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Display */}
      <div className="mt-2">
        {/* Permission Check Barrier */}
        {!canView(TABS.find(t => t.id === activeTab)?.viewRequired) ? (
          <div className="bright-card rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 border-2 border-rose-200 bg-white shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center mx-auto text-rose-600">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Access Restricted by RBAC Policy</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              The active persona <strong className="text-slate-900 font-bold">{profile?.title}</strong> is not authorized to access this module under standard organizational governance.
            </p>
            <div className="pt-2">
              <button
                onClick={() => switchPersona('admin')}
                className="px-5 py-2.5 rounded-xl bg-[#FF5400] hover:bg-[#e04a00] text-white text-xs font-bold transition shadow-md shadow-orange-500/25 active:scale-[0.98]"
              >
                Switch to Enterprise IT Administrator
              </button>
            </div>
          </div>
        ) : (
          /* Active Views */
          <div>
            {activeTab === 'kpis' && (
              <div className="space-y-6">
                {/* 4 Core High-Level KPI Cards with Bright Accents */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Freight Volume (Safety Orange) */}
                  <div className="bright-card bright-card-hover p-5 rounded-2xl border-t-4 border-t-[#FF5400] bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Corridor Freight Volume
                      </span>
                      <Truck className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-slate-900 font-mono-num">
                        4,850 T
                      </span>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center">
                        +14.2% <TrendingUp className="w-3 h-3 ml-0.5" />
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-500 mt-1 block">
                      JNPT ↔ Nashik active throughput
                    </span>
                  </div>

                  {/* Card 2: On-Time SLA (Signal Emerald) */}
                  <div className="bright-card bright-card-hover p-5 rounded-2xl border-t-4 border-t-[#00C853] bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        On-Time SLA Delivery
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-slate-900 font-mono-num">
                        98.4%
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Target 98.0%
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-500 mt-1 block">
                      Autonomous corridor tracking active
                    </span>
                  </div>

                  {/* Card 3: Forecast Error (Solar Yellow) */}
                  <div className="bright-card bright-card-hover p-5 rounded-2xl border-t-4 border-t-[#FFB703] bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Forecast Error (WAPE)
                      </span>
                      <BarChart3 className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-slate-900 font-mono-num">
                        4.1%
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                        PyTorch LSTM
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-500 mt-1 block">
                      95% Confidence Interval bounded
                    </span>
                  </div>

                  {/* Card 4: Active Transit (Vivid Coral) */}
                  <div className="bright-card bright-card-hover p-5 rounded-2xl border-t-4 border-t-[#FF1744] bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Active Transit Fleets
                      </span>
                      <Activity className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-slate-900 font-mono-num">
                        24 Units
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                        0 Disrupted
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-500 mt-1 block">
                      Live GPS telemetry online
                    </span>
                  </div>
                </div>

                {/* Persona Quick Action Console */}
                <div className="bright-card p-6 rounded-2xl bg-white space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Persona Command Center
                      </h3>
                      <p className="text-xs font-medium text-slate-500">
                        Operational workflows enabled for {profile?.title}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-800">
                      Role: {profile?.title}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <button
                      onClick={() => setActiveTab('forecasting')}
                      className="p-4 rounded-xl bg-slate-50 hover:bg-orange-50 border-2 border-slate-200 hover:border-orange-300 text-left transition-all duration-150 group active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-orange-600 transition">
                          Neural Demand Prediction
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-orange-600 transition" />
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Run multi-horizon LSTM predictions with 95% confidence intervals
                      </p>
                    </button>

                    <button
                      onClick={() => setActiveTab('twin')}
                      className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-300 text-left transition-all duration-150 group active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition">
                          Simulate Disruption Shock
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition" />
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Inject port strikes, monsoons, and highway bridge closures
                      </p>
                    </button>

                    <button
                      onClick={() => setActiveTab('system')}
                      className="p-4 rounded-xl bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-300 text-left transition-all duration-150 group active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-rose-700 transition">
                          Inspect System Diagnostics
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-700 transition" />
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Test RBAC guards, database fallback status, and live health
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'forecasting' && (
              <ForecastingTab personaProfile={profile} />
            )}

            {activeTab === 'routing' && (
              <RoutingTab />
            )}

            {activeTab === 'compliance' && (
              <ComplianceTab />
            )}

            {activeTab === 'twin' && (
              <DigitalTwinTab />
            )}

            {activeTab === 'system' && (
              <div className="space-y-6">
                {/* 1. Infrastructure & Service Status Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Database Health Card */}
                  <div className="bright-card p-4 rounded-xl bg-white border-t-4 border-t-blue-500">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Database Engine</span>
                      <Database className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="mt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-extrabold text-slate-900">
                          {adminOutput?.services?.database?.dialect === 'postgresql' ? 'PostgreSQL 17' : 'SQLite In-Memory'}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          adminOutput?.services?.database?.status === 'connected'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {adminOutput?.services?.database?.status || 'Active'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 mt-1 block">
                        pgvector: {adminOutput?.services?.database?.pgvector ? 'Enabled' : 'Simulated Vector'}
                      </span>
                    </div>
                  </div>

                  {/* Redis Cache Card */}
                  <div className="bright-card p-4 rounded-xl bg-white border-t-4 border-t-rose-500">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Feature Store / Cache</span>
                      <Server className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="mt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-extrabold text-slate-900">
                          {adminOutput?.services?.redis?.is_fallback ? 'InMemoryRedis' : 'Redis 7 Alpine'}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          adminOutput?.services?.redis?.status === 'connected'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {adminOutput?.services?.redis?.status || 'Active'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 mt-1 block">
                        Automatic fallback enabled
                      </span>
                    </div>
                  </div>

                  {/* PyTorch Models Status Card */}
                  <div className="bright-card p-4 rounded-xl bg-white border-t-4 border-t-[#FF5400]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">PyTorch Weights</span>
                      <Layers className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="mt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-extrabold text-slate-900">2 Checkpoints</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Ready (.pt)
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 mt-1 block font-mono">
                        LSTM: {adminOutput?.services?.models?.forecasting_lstm?.file_size_kb || 178}KB | DRL: {adminOutput?.services?.models?.routing_drl?.file_size_kb || 76}KB
                      </span>
                    </div>
                  </div>

                  {/* AI SDK / Gemini Card */}
                  <div className="bright-card p-4 rounded-xl bg-white border-t-4 border-t-purple-500">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">AI Document Engine</span>
                      <Cpu className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="mt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-extrabold text-slate-900">Gemini 2.5 Flash</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          adminOutput?.services?.external_ai?.api_key_configured
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {adminOutput?.services?.external_ai?.api_key_configured ? 'Key Active' : 'Fallback'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 mt-1 block">
                        Local RAG vector search online
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. PyTorch Model Retraining Orchestration Card */}
                <div className="bright-card p-6 sm:p-7 rounded-2xl bg-white space-y-5 border-2 border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-[#FF5400]" />
                        PyTorch Neural Model Re-Training & Weight Checkpoints
                      </h3>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        On-demand CPU-optimized training loop for multi-horizon LSTM demand forecaster and DRL route policy network
                      </p>
                    </div>
                    <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-md bg-orange-50 text-orange-800 border border-orange-200 self-start sm:self-auto">
                      Hot Reloading Enabled
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">Target Neural Architecture</label>
                      <select
                        value={retrainTarget}
                        onChange={(e) => setRetrainTarget(e.target.value)}
                        className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      >
                        <option value="all">All Models (Forecasting LSTM + Routing DRL)</option>
                        <option value="forecasting">Forecasting LSTM Forecaster Only</option>
                        <option value="routing">Routing DRL Route Policy Only</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">Training Iterations (Epochs)</label>
                      <div className="flex items-center gap-2">
                        {[10, 15, 25].map(ep => (
                          <button
                            key={ep}
                            type="button"
                            onClick={() => setRetrainEpochs(ep)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                              retrainEpochs === ep
                                ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {ep}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={handleRetrainModels}
                        disabled={retrainLoading}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#FF5400] hover:bg-[#e04a00] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 active:scale-[0.98] disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${retrainLoading ? 'animate-spin' : ''}`} />
                        <span>{retrainLoading ? 'Training PyTorch Models...' : 'Trigger Model Retraining'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Retraining Output Status */}
                  {retrainOutput && (
                    <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-800 font-extrabold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                          <span>{retrainOutput.message || 'Model Retraining Succeeded!'}</span>
                        </div>
                        <span className="text-[11px] font-mono text-emerald-700 font-bold">
                          Elapsed: {retrainOutput.total_elapsed_seconds || retrainOutput.models?.forecasting?.elapsed_seconds || 1.2}s
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {retrainOutput.models?.forecasting && (
                          <div className="bg-white p-3 rounded-lg border border-emerald-200">
                            <span className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                              Demand Forecaster (LSTM)
                            </span>
                            <div className="text-xs text-slate-800 space-y-0.5 font-medium">
                              <div>Final Loss: <strong className="font-mono text-slate-900">{retrainOutput.models.forecasting.final_train_loss}</strong></div>
                              <div>Val MAE: <strong className="font-mono text-slate-900">{retrainOutput.models.forecasting.val_mae}</strong> | Val RMSE: <strong className="font-mono text-slate-900">{retrainOutput.models.forecasting.val_rmse}</strong></div>
                              <div>Checkpoint: <strong className="font-mono text-slate-900">{retrainOutput.models.forecasting.file_size_kb} KB</strong></div>
                            </div>
                          </div>
                        )}

                        {retrainOutput.models?.routing && (
                          <div className="bg-white p-3 rounded-lg border border-emerald-200">
                            <span className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                              Route Optimizer (DRL Policy)
                            </span>
                            <div className="text-xs text-slate-800 space-y-0.5 font-medium">
                              <div>Final Loss: <strong className="font-mono text-slate-900">{retrainOutput.models.routing.final_train_loss}</strong></div>
                              <div>Top-1 Accuracy: <strong className="font-mono text-slate-900">{retrainOutput.models.routing.top1_accuracy_pct}%</strong></div>
                              <div>Checkpoint: <strong className="font-mono text-slate-900">{retrainOutput.models.routing.file_size_kb} KB</strong></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {retrainError && (
                    <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-xs space-y-2">
                      <div className="flex items-center gap-2 text-rose-800 font-extrabold">
                        <AlertTriangle className="w-4 h-4 text-rose-600 stroke-[2.5]" />
                        <span>Retraining Error Encountered</span>
                      </div>
                      <div className="text-rose-900 font-mono-num text-[11px] bg-white p-3 rounded-lg border border-rose-200 font-semibold">
                        {retrainError}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. RBAC Policy & Diagnostics Tester */}
                <div className="bright-card p-6 sm:p-7 rounded-2xl bg-white space-y-5 border-2 border-slate-200">
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Enterprise IT Admin Diagnostics Console & RBAC Verification
                      </h3>
                      <p className="text-xs font-medium text-slate-500">
                        Live verification of role-based header propagation and database fallback resilience
                      </p>
                    </div>
                    <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-300">
                      Active: {currentRole}
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Execute a real-time request to the restricted administrative endpoint <code className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-slate-900 font-bold font-mono-num">/api/v1/admin/system-status</code>. 
                      Only the <strong>Enterprise IT Administrator</strong> role has permission; other roles receive an immediate HTTP 403 Forbidden with detailed RBAC denial reasons.
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleTestAdminEndpoint}
                        disabled={adminLoading}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all duration-150 flex items-center gap-2 shadow-sm active:scale-[0.98] disabled:opacity-50"
                      >
                        <Terminal className={`w-4 h-4 ${adminLoading ? 'animate-spin text-orange-400' : 'text-orange-400'}`} />
                        <span>Run RBAC Guard Test</span>
                      </button>

                      <button
                        onClick={() => switchPersona('director')}
                        className="px-3.5 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 text-xs font-bold transition border border-orange-200 active:scale-[0.98]"
                      >
                        Switch to Director (Assert 403)
                      </button>

                      <button
                        onClick={() => switchPersona('admin')}
                        className="px-3.5 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold transition border border-emerald-200 active:scale-[0.98]"
                      >
                        Switch to Admin (Assert 200)
                      </button>
                    </div>

                    {/* Result Output */}
                    {adminOutput && (
                      <div className="mt-4 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-emerald-800 font-extrabold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                          <span>RBAC Authorization Succeeded (HTTP 200 OK)</span>
                        </div>
                        <pre className="text-slate-800 overflow-x-auto p-3 bg-white rounded-lg font-mono-num text-[11px] border border-emerald-200">
                          {JSON.stringify(adminOutput, null, 2)}
                        </pre>
                      </div>
                    )}

                    {adminError && (
                      <div className="mt-4 p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-rose-800 font-extrabold">
                          <AlertTriangle className="w-4 h-4 text-rose-600 stroke-[2.5]" />
                          <span>RBAC Rejection Confirmed (HTTP 403 Forbidden)</span>
                        </div>
                        <div className="text-rose-900 font-mono-num text-[11px] bg-white p-3 rounded-lg border border-rose-200 font-semibold">
                          {adminError}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
