import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Layers, 
  Truck, 
  FileCheck2, 
  ChevronDown, 
  Check, 
  Database, 
  Server, 
  Cpu, 
  RefreshCw,
  Box,
  Radio
} from 'lucide-react';
import { usePersona } from '../context/PersonaContext';
import { api } from '../services/api';

const ROLE_ICONS = {
  director: Layers,
  dispatcher: Truck,
  customs: FileCheck2,
  admin: Cpu
};

// Bright High-Visibility Persona Badges (Zero Purple / Blue Slop)
const BADGE_THEMES = {
  orange: {
    button: 'bg-orange-500 text-white border-orange-600 shadow-orange-500/20 hover:bg-orange-600',
    itemBadge: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500'
  },
  emerald: {
    button: 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-600/20 hover:bg-emerald-700',
    itemBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500'
  },
  amber: {
    button: 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20 hover:bg-amber-600',
    itemBadge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500'
  },
  coral: {
    button: 'bg-rose-600 text-white border-rose-700 shadow-rose-600/20 hover:bg-rose-700',
    itemBadge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500'
  }
};

export default function Navbar() {
  const { currentRole, profile, rolesMap, switchPersona } = usePersona();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [latency, setLatency] = useState(null);

  const fetchHealth = async () => {
    setHealthLoading(true);
    const start = performance.now();
    try {
      const data = await api.getHealth();
      setHealth(data);
      setLatency(Math.round(performance.now() - start));
    } catch {
      setHealth(null);
      setLatency(null);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const ActiveIcon = ROLE_ICONS[currentRole] || Layers;
  const activeColorKey = profile?.badge_color || 'orange';
  const activeTheme = BADGE_THEMES[activeColorKey] || BADGE_THEMES.orange;

  const isHealthy = Boolean(health);
  const isFallbackDb = health?.services?.database?.status === 'fallback_in_memory';
  const isFallbackRedis = health?.services?.redis?.status === 'fallback_in_memory';

  return (
    <header className="sticky top-0 z-50 bright-header bg-white/95 backdrop-blur-md border-b-2 border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs">
      {/* Brand & Platform Identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#FF5400] text-white shadow-md shadow-orange-500/25">
          <Box className="w-5 h-5 stroke-[2.2]" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Cognitive Logistics
            </h1>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 border border-orange-200">
              v1.0 Live
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            Autonomous Freight Corridor & Dynamic Intelligence Hub
          </p>
        </div>
      </div>

      {/* Right controls: Health Indicator & Persona Switcher */}
      <div className="flex items-center gap-3">
        {/* Live System Health Badge */}
        <div className="relative">
          <button
            onClick={() => setHealthModalOpen(!healthModalOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-300 text-xs font-semibold text-slate-800 transition-all duration-200 active:scale-[0.98]"
            title="System infrastructure & data fallback status"
          >
            <span className="relative flex h-2.5 w-2.5">
              {isHealthy ? (
                <>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFallbackDb ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isFallbackDb ? 'bg-amber-500' : 'bg-emerald-600'}`}></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              )}
            </span>
            <span className="font-semibold text-slate-800 hidden md:inline">
              {isHealthy ? (isFallbackDb ? 'In-Memory Fallback' : 'Connected') : 'Offline'}
            </span>
            {latency !== null && (
              <span className="text-[11px] text-slate-500 font-mono-num font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 hidden lg:inline">
                {latency}ms
              </span>
            )}
          </button>

          {/* Health Details Popover */}
          {healthModalOpen && (
            <div className="absolute right-0 mt-2 w-80 p-5 rounded-2xl bg-white border-2 border-slate-200 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Infrastructure Status
                  </span>
                </div>
                <button
                  onClick={fetchHealth}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition"
                  disabled={healthLoading}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin text-orange-600' : ''}`} />
                </button>
              </div>

              <div className="mt-3.5 space-y-3 text-xs">
                {/* API Status */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-2 font-medium">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    FastAPI Gateway
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${isHealthy ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                    {isHealthy ? 'Operational' : 'Disconnected'}
                  </span>
                </div>

                {/* Database Status */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-2 font-medium">
                    <Database className="w-3.5 h-3.5 text-slate-400" />
                    Database
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${!isFallbackDb && isHealthy ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                    {health?.services?.database?.dialect === 'postgresql' ? 'PostgreSQL 17' : 'SQLite In-Memory'}
                  </span>
                </div>

                {/* pgvector Status */}
                <div className="flex items-center justify-between pl-5">
                  <span className="text-slate-500 font-medium">Vector Index</span>
                  <span className="text-[11px] font-bold text-slate-700">
                    {health?.services?.database?.pgvector ? 'pgvector Active' : 'In-Memory Cosine'}
                  </span>
                </div>

                {/* Redis Status */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-2 font-medium">
                    <Radio className="w-3.5 h-3.5 text-slate-400" />
                    State Store / Redis
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${!isFallbackRedis && isHealthy ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                    {health?.services?.redis?.is_fallback ? 'In-Memory Dict' : 'Redis 7 Online'}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-medium">Active Transit Corridor</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  Mumbai (JNPT) ↔ Nashik
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Persona Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-[0.98] ${activeTheme.button}`}
          >
            <ActiveIcon className="w-4 h-4 stroke-[2.2]" />
            <div className="text-left hidden sm:block">
              <div className="text-xs font-extrabold leading-tight">{profile?.title || 'Persona'}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-90">{currentRole} Mode</div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Persona Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-84 rounded-2xl bg-white border-2 border-slate-200 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2.5 border-b border-slate-100">
                <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Select Persona Mode</div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Permissions and UI modules adapt in real-time
                </div>
              </div>

              <div className="mt-1.5 space-y-1">
                {Object.entries(rolesMap).map(([roleKey, roleItem]) => {
                  const Icon = ROLE_ICONS[roleKey] || Layers;
                  const isSelected = currentRole === roleKey;
                  const itemColorKey = roleItem.badge_color || 'orange';
                  const theme = BADGE_THEMES[itemColorKey] || BADGE_THEMES.orange;

                  return (
                    <button
                      key={roleKey}
                      onClick={() => {
                        switchPersona(roleKey);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                        isSelected 
                          ? 'bg-slate-100 border-2 border-slate-300 shadow-xs' 
                          : 'hover:bg-slate-50 border-2 border-transparent'
                      }`}
                    >
                      <div className={`p-2 rounded-lg border ${theme.itemBadge}`}>
                        <Icon className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {roleItem.title}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 stroke-[3] ml-1 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                          {roleItem.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {roleItem.permissions?.views?.map(v => (
                            <span key={v} className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800">
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
