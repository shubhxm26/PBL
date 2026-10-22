import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Navigation,
  FileCheck2,
  ShieldAlert,
  Globe,
  Cpu
} from 'lucide-react';
import { DOCK_SERVICES } from '../constants/dockConfig';
import { useWorkspace } from '../context/WorkspaceContext';
import { usePersona } from '../context/PersonaContext';

import GlassPanel from './GlassPanel';
import KpisContent from './KpisContent';
import ForecastingTab from './ForecastingTab';
import RoutingTab from './RoutingTab';
import ComplianceTab from './ComplianceTab';
import AutonomousSentinelHUD from './AutonomousSentinelHUD';
import DigitalTwinTab from './DigitalTwinTab';
import AdminRetrainContent from './AdminRetrainContent';

const SERVICE_ICONS = {
  kpis: BarChart3,
  forecasting: TrendingUp,
  routing: Navigation,
  compliance: FileCheck2,
  sentinel: ShieldAlert,
  twin: Globe,
  system: Cpu
};

export default function WindowManager() {
  const { windows } = useWorkspace();
  const { profile } = usePersona();

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {DOCK_SERVICES.map((service) => {
        const win = windows[service.id];
        if (!win || !win.isOpen) return null;

        const Icon = SERVICE_ICONS[service.id] || BarChart3;

        return (
          <div key={service.id} className="pointer-events-auto">
            <GlassPanel
              id={service.id}
              title={service.label}
              shortLabel={service.shortLabel}
              icon={Icon}
              themeColor={service.themeColor}
              viewRequired={service.viewRequired}
              badgeText={service.badgeText}
            >
              {service.id === 'kpis' && <KpisContent />}
              {service.id === 'forecasting' && <ForecastingTab personaProfile={profile} />}
              {service.id === 'routing' && <RoutingTab />}
              {service.id === 'compliance' && <ComplianceTab />}
              {service.id === 'sentinel' && <AutonomousSentinelHUD />}
              {service.id === 'twin' && <DigitalTwinTab />}
              {service.id === 'system' && <AdminRetrainContent />}
            </GlassPanel>
          </div>
        );
      })}
    </div>
  );
}
