import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  CloudRain,
  Tag,
  AlertTriangle,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
  Download,
  BarChart3,
  Info,
  Sliders,
  Package,
  Clock,
  Compass
} from 'lucide-react';
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
import { useWorkspace } from '../context/WorkspaceContext';

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

export const FACILITY_TO_SKU = {
  'DEP-NSK-01': 'SKU-NAS-AGRI-01',
  'PORT-JNPT-01': 'SKU-JNPT-ELEC-01',
  'FC-PUN-01': 'SKU-PUN-AUTO-01',
  'DC-BHW-01': 'SKU-MUM-PHARM-01',
  'HUB-THN-01': 'SKU-THN-CHEM-01'
};

export const SKU_TO_FACILITY = {
  'SKU-NAS-AGRI-01': 'DEP-NSK-01',
  'SKU-JNPT-ELEC-01': 'PORT-JNPT-01',
  'SKU-PUN-AUTO-01': 'FC-PUN-01',
  'SKU-MUM-PHARM-01': 'DC-BHW-01',
  'SKU-THN-CHEM-01': 'HUB-THN-01'
};

export default function ForecastingTab({ personaProfile }) {
  const workspace = useWorkspace();
  const selectedFacilityId = workspace?.selectedFacilityId;
  const selectFacility = workspace?.selectFacility;
  const trigger3DFlyTo = workspace?.trigger3DFlyTo;
  const triggerMlPrediction = workspace?.triggerMlPrediction;

  const [skus, setSkus] = useState([]);
  const [selectedSkuId, setSelectedSkuId] = useState('SKU-NAS-AGRI-01');
  const [horizonDays, setHorizonDays] = useState(14);
  const [includeExogenous, setIncludeExogenous] = useState(true);
  const [promoDiscount, setPromoDiscount] = useState(10);
  const [weatherSeverity, setWeatherSeverity] = useState(1.0);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Synchronize 3D warehouse selection to active SKU
  useEffect(() => {
    if (selectedFacilityId && FACILITY_TO_SKU[selectedFacilityId]) {
      const mappedSku = FACILITY_TO_SKU[selectedFacilityId];
      if (mappedSku && mappedSku !== selectedSkuId) {
        setSelectedSkuId(mappedSku);
      }
    }
  }, [selectedFacilityId]);

  // Load SKU catalog on mount
  useEffect(() => {
    async function loadSkus() {
      try {
        const res = await api.getForecastingSKUs();
        if (res.skus && res.skus.length > 0) {
          setSkus(res.skus);
          if (!res.skus.some(s => s.sku_id === selectedSkuId)) {
            setSelectedSkuId(res.skus[0].sku_id);
          }
        }
      } catch (err) {
        console.error('Failed to load SKUs:', err);
      }
    }
    loadSkus();
  }, []);

  // Fetch forecast whenever parameters change
  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        sku_id: selectedSkuId,
        forecast_horizon_days: horizonDays,
        granularity: 'daily',
        include_exogenous_factors: includeExogenous,
        exogenous_overrides: {
          promo_discount_pct: includeExogenous ? Number(promoDiscount) : 0,
          weather_impact_severity: includeExogenous ? Number(weatherSeverity) : 1.0,
          monsoon_alert: weatherSeverity > 1.2
        }
      };
      const res = await api.predictDemand(payload);
      setForecastData(res);
      // Trigger 3D Demand Heatmap overlay update
      if (triggerMlPrediction) {
        triggerMlPrediction(selectedSkuId, res);
      }
    } catch (err) {
      console.error('Forecasting request failed:', err);
      setError(err.message || 'Failed to generate forecast.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [selectedSkuId, horizonDays, includeExogenous, promoDiscount, weatherSeverity]);

  const handleSelectSku = (skuId) => {
    setSelectedSkuId(skuId);
    const facId = SKU_TO_FACILITY[skuId];
    if (facId && selectFacility) {
      selectFacility(facId);
    }
  };

  const handleFlyTo3D = (skuId) => {
    const facId = SKU_TO_FACILITY[skuId || selectedSkuId] || 'DEP-NSK-01';
    if (selectFacility) selectFacility(facId);
    if (trigger3DFlyTo) trigger3DFlyTo({ type: 'facility', id: facId });
  };

  const selectedSku = useMemo(() => {
    return skus.find(s => s.sku_id === selectedSkuId) || {
      sku_id: selectedSkuId,
      name: 'Selected SKU',
      category: 'Inventory',
      default_warehouse_id: 'WH-01',
      unit_price_inr: 500,
      lead_time_days: 4,
      service_level_target: 0.95
    };
  }, [skus, selectedSkuId]);

  // Prepare Chart.js Dataset
  const chartConfig = useMemo(() => {
    if (!forecastData || !forecastData.forecasts || forecastData.forecasts.length === 0) {
      return null;
    }

    const primaryForecast = forecastData.forecasts[0];
    const historical = forecastData.historical_series || [];
    const predictions = primaryForecast.predictions || [];

    // Create continuous timeline labels
    const histDates = historical.map(h => h.date.slice(5)); // 'MM-DD'
    const predDates = predictions.map(p => p.date.slice(5));
    const labels = [...histDates, ...predDates];

    // Historical series points (null for future predictions)
    const histDemand = [
      ...historical.map(h => h.actual_demand_units),
      ...predictions.map(() => null)
    ];

    // Seamless connection: bridge last historical point to first predicted point
    const bridgePoint = historical.length > 0 ? historical[historical.length - 1].actual_demand_units : null;
    const predDemand = [
      ...historical.slice(0, -1).map(() => null),
      bridgePoint,
      ...predictions.map(p => p.predicted_demand_units)
    ];

    // Upper and Lower confidence bounds
    const upperCI = [
      ...historical.map(() => null),
      ...predictions.map(p => p.confidence_interval_95.upper)
    ];

    const lowerCI = [
      ...historical.map(() => null),
      ...predictions.map(p => p.confidence_interval_95.lower)
    ];

    // Safety stock threshold
    const safetyStockLine = [
      ...historical.map(() => null),
      ...predictions.map(p => p.recommended_safety_stock)
    ];

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Historical Actual Demand',
            data: histDemand,
            borderColor: '#64748B',
            backgroundColor: '#64748B',
            borderWidth: 2,
            borderDash: [3, 3],
            pointRadius: 3,
            pointHoverRadius: 6,
            tension: 0.2
          },
          {
            label: 'PyTorch Predicted Demand',
            data: predDemand,
            borderColor: '#FF5400',
            backgroundColor: '#FF5400',
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: '#FF5400',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1.5,
            pointHoverRadius: 7,
            tension: 0.25
          },
          {
            label: '95% CI Upper Bound',
            data: upperCI,
            borderColor: 'rgba(255, 84, 0, 0.45)',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: '+1', // Fill down to Lower Bound
            backgroundColor: 'rgba(255, 84, 0, 0.12)',
            tension: 0.25
          },
          {
            label: '95% CI Lower Bound',
            data: lowerCI,
            borderColor: 'rgba(255, 84, 0, 0.45)',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
            tension: 0.25
          },
          {
            label: 'Recommended Safety Stock',
            data: safetyStockLine,
            borderColor: '#059669',
            borderWidth: 1.8,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
              padding: 18,
              font: {
                family: 'inherit',
                size: 11,
                weight: '600'
              },
              color: '#CBD5E1'
            }
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            callbacks: {
              label: function (context) {
                if (context.raw === null || context.raw === undefined) return null;
                return ` ${context.dataset.label}: ${context.raw} units`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(51, 65, 85, 0.4)',
              drawBorder: false
            },
            ticks: {
              font: { size: 11, weight: '500' },
              color: '#94A3B8',
              maxRotation: 0
            }
          },
          y: {
            grid: {
              color: 'rgba(51, 65, 85, 0.4)',
              drawBorder: false
            },
            ticks: {
              font: { size: 11, weight: '500' },
              color: '#94A3B8'
            },
            title: {
              display: true,
              text: 'Daily Quantity (Units)',
              font: { size: 11, weight: '600' },
              color: '#CBD5E1'
            }
          }
        }
      }
    };
  }, [forecastData]);

  // Summary Metrics
  const summary = forecastData?.summary || {
    average_daily_demand: 0,
    total_horizon_demand: 0,
    volatility_index: 0,
    recommended_safety_stock: 0,
    stockout_risk_score: 0.05
  };

  const predictionsList = forecastData?.forecasts?.[0]?.predictions || [];

  // Export JSON handler
  const handleExportJSON = () => {
    if (!forecastData) return;
    const blob = new Blob([JSON.stringify(forecastData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast-${selectedSkuId}-${horizonDays}d.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 cyber-glass bg-slate-900/60 p-5 rounded-2xl border border-slate-700/60 backdrop-blur-md shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-orange-950/80 text-[#FF5400] border border-orange-500/40">
              Neural Forecasting Studio
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Western India Corridor • LSTM/GRU Engine v2.1
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Multi-Horizon Demand Predictions & Safety Stock
          </h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleFlyTo3D()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            title="Fly 3D Camera to Depot Node"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Fly 3D Camera</span>
          </button>

          <button
            onClick={fetchForecast}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-bold transition-all border border-slate-700 active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Recalculate neural weights inference"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FF5400]' : ''}`} />
            <span>{loading ? 'Inferencing...' : 'Re-run Inference'}</span>
          </button>

          <button
            onClick={handleExportJSON}
            disabled={!forecastData}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-white text-xs font-bold transition-all border border-slate-700 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Payload</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Error: {error}</span>
          </div>
          <button
            onClick={fetchForecast}
            className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-100 text-xs font-bold transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Control Panel: SKU Selector + Horizon Buttons + Exogenous Sliders */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Col 1 & 2: SKU Catalog & Horizon Selection */}
        <div className="xl:col-span-2 cyber-glass bg-slate-900/60 p-6 rounded-2xl border border-slate-700/60 backdrop-blur-md shadow-lg space-y-5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-[#FF5400]" />
              <span>Select Inventory SKU Catalog</span>
            </label>
            <span className="text-[11px] font-semibold text-slate-400">
              Corridor Nodes: Nashik, JNPT, Pune, Mumbai, Thane
            </span>
          </div>

          {/* SKU Pill Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {skus.map((sku) => {
              const isSelected = sku.sku_id === selectedSkuId;
              return (
                <button
                  key={sku.sku_id}
                  onClick={() => handleSelectSku(sku.sku_id)}
                  className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'border-[#FF5400] bg-orange-950/40 text-white shadow-md ring-1 ring-orange-500/50'
                      : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isSelected ? 'bg-[#FF5400] text-white' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {sku.category}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {sku.default_warehouse_id}
                      </span>
                    </div>
                    <div className="text-xs font-extrabold text-white line-clamp-1">
                      {sku.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {sku.sku_id}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-semibold text-slate-300">
                    <span>₹{sku.unit_price_inr}</span>
                    <span className="text-slate-400">Lead: {sku.lead_time_days}d</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Horizon Selection Bar */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-200">Forecast Horizon:</span>
            </div>

            <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800">
              {[
                { days: 7, label: '7 Days', sub: 'Operational' },
                { days: 14, label: '14 Days', sub: 'Procurement' },
                { days: 30, label: '30 Days', sub: 'Monthly S&OP' }
              ].map(({ days, label, sub }) => (
                <button
                  key={days}
                  onClick={() => setHorizonDays(days)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    horizonDays === days
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-[10px] font-medium text-slate-500 hidden md:inline">({sub})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Col 3: Exogenous Neural Features & Scenario Tweaks */}
        <div className="cyber-glass bg-slate-900/60 p-6 rounded-2xl border border-slate-700/60 backdrop-blur-md shadow-lg space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#FF5400]" />
                <span>Exogenous What-If Controls</span>
              </label>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExogenous}
                  onChange={(e) => setIncludeExogenous(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF5400]"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Inject promotional price discounts and Western Ghats monsoon weather anomalies into LSTM input tensors to test resilience.
            </p>

            {/* Promo Discount Slider */}
            <div className={`space-y-2 p-3.5 rounded-xl border transition-all ${
              includeExogenous ? 'bg-orange-950/20 border-orange-500/40' : 'bg-slate-950/40 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#FF5400]" />
                  <span>Promotional Discount:</span>
                </span>
                <span className="font-mono text-[#FF5400] text-sm">{promoDiscount}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="5"
                value={promoDiscount}
                disabled={!includeExogenous}
                onChange={(e) => setPromoDiscount(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#FF5400]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                <span>0% (Standard)</span>
                <span>15% (Seasonal)</span>
                <span>30% (Flash Sale)</span>
              </div>
            </div>

            {/* Weather Anomaly Buttons */}
            <div className={`space-y-2 p-3.5 rounded-xl border transition-all ${
              includeExogenous ? 'bg-sky-950/20 border-sky-500/40' : 'bg-slate-950/40 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                  <span>Weather Anomaly Index:</span>
                </span>
                <span className="font-mono text-sky-400 text-sm">{weatherSeverity}x</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[
                  { value: 1.0, label: 'Clear', color: 'slate' },
                  { value: 1.3, label: 'Monsoon', color: 'blue' },
                  { value: 1.6, label: 'Storm', color: 'indigo' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    disabled={!includeExogenous}
                    onClick={() => setWeatherSeverity(value)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      weatherSeverity === value && includeExogenous
                        ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-sky-500/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Neural model dynamically balances demand price elasticity with supply chain lead-time variability.
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Average Daily Demand */}
        <div className="cyber-glass bg-slate-900/60 p-5 rounded-2xl border border-slate-700/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Daily Demand</span>
            <div className="w-8 h-8 rounded-lg bg-orange-950/60 border border-orange-500/40 flex items-center justify-center text-[#FF5400]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {summary.average_daily_demand} <span className="text-sm font-semibold text-slate-400">units/day</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Total: {summary.total_horizon_demand.toLocaleString()} units ({horizonDays}d)</span>
          </div>
        </div>

        {/* KPI 2: Volatility Index */}
        <div className="cyber-glass bg-slate-900/60 p-5 rounded-2xl border border-slate-700/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Volatility Index (CV)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {(summary.volatility_index * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] font-semibold text-slate-400">
            {summary.volatility_index < 0.15 ? '🟢 Stable daily pattern' : '🟡 Moderate volatility'}
          </div>
        </div>

        {/* KPI 3: Recommended Safety Stock */}
        <div className="cyber-glass bg-slate-900/60 p-5 rounded-2xl border border-slate-700/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Suggested Safety Stock</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-[#00C853]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#00E676] tracking-tight">
            {summary.recommended_safety_stock} <span className="text-sm font-semibold text-slate-400">units</span>
          </div>
          <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
            <span>Target SLA:</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px]">
              {(selectedSku.service_level_target * 100).toFixed(0)}% (Z=1.65)
            </span>
          </div>
        </div>

        {/* KPI 4: Stockout Risk */}
        <div className="cyber-glass bg-slate-900/60 p-5 rounded-2xl border border-slate-700/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Stockout Risk Score</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {(summary.stockout_risk_score * 100).toFixed(1)}%
          </div>
          <div className="text-[11px] font-semibold text-slate-400">
            Current stock: {selectedSku.current_stock?.toLocaleString() || '2,500'} units
          </div>
        </div>
      </div>

      {/* Main Multi-Line Chart with Shaded 95% Confidence Intervals */}
      <div className="cyber-glass bg-slate-900/60 p-6 rounded-2xl border border-slate-700/60 backdrop-blur-md shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#FF5400]" />
              <span>Neural Demand Trajectory & 95% Confidence Interval Band</span>
            </h3>
            <p className="text-xs font-medium text-slate-400">
              Historical actuals (past 14 days) concatenated with PyTorch multi-step point predictions ($lower \le point \le upper$).
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FF5400]"></span>
              <span>Point Forecast</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-orange-500/30 border border-orange-400"></span>
              <span>95% CI Range</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-500"></span>
              <span>Safety Stock</span>
            </div>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-[340px] w-full">
          {loading && !forecastData ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-[#FF5400]" />
              <span className="text-xs font-bold">Executing PyTorch LSTM Sequence Inference...</span>
            </div>
          ) : chartConfig ? (
            <Line data={chartConfig.data} options={chartConfig.options} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-semibold text-slate-400">
              No forecast data available.
            </div>
          )}
        </div>
      </div>

      {/* Detailed Forecast Schedule Table */}
      <div className="cyber-glass bg-slate-900/60 rounded-2xl border border-slate-700/60 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-extrabold text-white">
              Daily Prediction Schedule & Statistical Variance Bounds
            </h4>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">
            {predictionsList.length} Horizon Steps
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-300 font-extrabold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Day</th>
                <th className="py-3 px-4 text-right">Point Prediction</th>
                <th className="py-3 px-4 text-center">95% Confidence Interval</th>
                <th className="py-3 px-4 text-right">Exogenous Delta</th>
                <th className="py-3 px-4 text-right">Suggested Safety Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {predictionsList.map((pred) => {
                const isWeekend = pred.day_name === 'Saturday' || pred.day_name === 'Sunday';
                return (
                  <tr
                    key={pred.date}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isWeekend ? 'bg-slate-950/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {pred.date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-300">
                      {pred.day_name}
                      {isWeekend && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
                          Weekend
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-white text-sm">
                      {pred.predicted_demand_units}{' '}
                      <span className="text-[11px] font-normal text-slate-400">units</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-mono font-bold px-2.5 py-1 rounded-lg bg-orange-950/40 text-orange-200 border border-orange-500/40 text-xs">
                        <span>{pred.confidence_interval_95.lower}</span>
                        <span className="text-orange-400">↔</span>
                        <span>{pred.confidence_interval_95.upper}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {pred.exogenous_impact.promo_uplift_units > 0 ? (
                        <span className="text-emerald-400 font-bold">
                          +{pred.exogenous_impact.promo_uplift_units} (promo)
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                      {pred.exogenous_impact.weather_delta_units !== 0 && (
                        <span className="ml-1 text-sky-400 font-bold">
                          {pred.exogenous_impact.weather_delta_units > 0 ? '+' : ''}
                          {pred.exogenous_impact.weather_delta_units} (weather)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      {pred.recommended_safety_stock}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">units</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
