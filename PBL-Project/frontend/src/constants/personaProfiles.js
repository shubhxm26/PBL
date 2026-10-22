/**
 * Built-in fallback persona profiles for instant zero-latency UI hydration
 * and RBAC operational policy enforcement across the command center.
 */
export const FALLBACK_PROFILES = {
  director: {
    role: 'director',
    title: 'Supply Chain Director',
    description: 'Strategic network KPI oversight, demand forecasting, risk stress-testing, and executive analytics.',
    badge_color: 'orange',
    permissions: {
      views: ['dashboard', 'forecasting', 'routing', 'twin', 'telemetry', 'kpis'],
      actions: ['view_kpis', 'run_forecast', 'view_fleet', 'optimize_routes', 'inject_roadblock', 'telemetry_control', 'run_twin_simulation', 'export_reports']
    }
  },
  dispatcher: {
    role: 'dispatcher',
    title: 'Fleet Dispatcher',
    description: 'Real-time fleet tracking, dynamic route optimization, freight matching, and live telematics.',
    badge_color: 'emerald',
    permissions: {
      views: ['dashboard', 'routing', 'telemetry'],
      actions: ['view_fleet', 'optimize_routes', 'inject_roadblock', 'match_freight', 'telemetry_control']
    }
  },
  customs: {
    role: 'customs',
    title: 'Customs Officer',
    description: 'Automated trade document ingestion, HS code classification, and discrepancy compliance checks.',
    badge_color: 'amber',
    permissions: {
      views: ['dashboard', 'compliance'],
      actions: ['view_documents', 'parse_documents', 'classify_hs', 'review_flags']
    }
  },
  admin: {
    role: 'admin',
    title: 'Enterprise IT Administrator',
    description: 'System health monitoring, model fine-tuning orchestration, data pipeline connectivity, and RBAC control.',
    badge_color: 'coral',
    permissions: {
      views: ['dashboard', 'forecasting', 'routing', 'compliance', 'twin', 'telemetry', 'system'],
      actions: ['*']
    }
  }
};
