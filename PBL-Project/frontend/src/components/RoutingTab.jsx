import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import {
  Truck,
  MapPin,
  Clock,
  Gauge,
  Leaf,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Navigation,
  Compass,
  Package,
  Zap,
  Activity,
  Radio,
  Thermometer,
  BatteryCharging,
  ShieldAlert,
  Flame
} from 'lucide-react';
import { api } from '../services/api';
import { telemetryWS } from '../services/websocket';
import SimulationBar from './SimulationBar';
import { useWorkspace } from '../context/WorkspaceContext';

// Fix Leaflet standard marker icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Leaflet DivIcon helpers for stop waypoints
function createCustomMarkerIcon(type, number) {
  let bgColor = '#0F172A';
  let borderColor = '#334155';
  let textColor = '#FFFFFF';
  let text = number || '';

  if (type === 'DEPOT') {
    bgColor = '#FF5400';
    borderColor = '#FFFFFF';
    textColor = '#FFFFFF';
    text = '★';
  } else if (type === 'BACKHAUL_PICKUP') {
    bgColor = '#00C853';
    borderColor = '#FFFFFF';
    textColor = '#FFFFFF';
    text = '⤓';
  } else if (type === 'BACKHAUL_DROPOFF') {
    bgColor = '#00897B';
    borderColor = '#FFFFFF';
    textColor = '#FFFFFF';
    text = '⤒';
  }

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        background-color: ${bgColor};
        color: ${textColor};
        border: 2px solid ${borderColor};
        border-radius: 9999px;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25);
      ">
        ${text}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16]
  });
}

// Live Vehicle Truck Marker with Heading Rotation & Pulsing Radar Wave
function createVehicleMarkerIcon(vehicle) {
  const isRerouted = vehicle?.is_rerouted;
  const heading = vehicle?.heading || 0;
  const plate = vehicle?.vehicle_id || 'TRK';
  const speed = vehicle?.speed_kmh != null ? `${Math.round(vehicle.speed_kmh)} km/h` : '0';

  return L.divIcon({
    className: 'live-vehicle-marker-wrapper',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <!-- Pulsing radar ping wave -->
        <div style="
          position: absolute;
          width: 44px;
          height: 44px;
          top: -5px;
          left: -4px;
          border-radius: 9999px;
          background: ${isRerouted ? 'rgba(255, 23, 68, 0.35)' : 'rgba(0, 200, 83, 0.3)'};
          animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        "></div>
        <!-- Truck directional badge -->
        <div style="
          background: ${isRerouted ? '#FF1744' : '#0F172A'};
          color: #FFFFFF;
          border: 2.5px solid ${isRerouted ? '#FFD600' : '#00E676'};
          border-radius: 9999px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
          position: relative;
          z-index: 10;
        ">
          <!-- Rotated heading arrow -->
          <svg style="transform: rotate(${heading}deg); transition: transform 0.4s ease;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 19 21 12 17 5 21 12 2" fill="white" />
          </svg>
        </div>
        <!-- Live telemetry badge label -->
        <div style="
          background: #0F172A;
          color: #FFFFFF;
          border: 1px solid ${isRerouted ? '#FF5400' : '#334155'};
          border-radius: 6px;
          padding: 1.5px 6px;
          margin-top: 3px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 10;
        ">
          <span style="color: ${isRerouted ? '#FF5400' : '#00E676'};">●</span>
          <span>${plate}</span>
          <span style="color: #64748B;">|</span>
          <span style="color: #FFB703;">${speed}</span>
        </div>
      </div>
    `,
    iconSize: [36, 56],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22]
  });
}

// Roadblock Hazard DivIcon
function createRoadblockMarkerIcon(roadblock) {
  return L.divIcon({
    className: 'roadblock-hazard-wrapper',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          position: absolute;
          width: 50px;
          height: 50px;
          top: -8px;
          left: -7px;
          border-radius: 9999px;
          background: rgba(255, 23, 68, 0.4);
          animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        "></div>
        <div style="
          background: #D50000;
          color: #FFFFFF;
          border: 2px solid #FFFFFF;
          border-radius: 10px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(213, 0, 0, 0.5);
          z-index: 10;
        ">
          ⛔
        </div>
        <div style="
          background: #B71C1C;
          color: #FFFFFF;
          border: 1px solid #FF8A80;
          border-radius: 4px;
          padding: 1px 5px;
          margin-top: 3px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          white-space: nowrap;
          z-index: 10;
        ">
          ROADBLOCK
        </div>
      </div>
    `,
    iconSize: [36, 56],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22]
  });
}

// Popup HTML builder for Live Vehicle Marker
function getVehiclePopupHtml(v) {
  const isRerouted = v.is_rerouted;
  const soc = v.battery_fuel_soc_pct != null ? v.battery_fuel_soc_pct : 100;
  const socColor = soc > 50 ? '#00C853' : soc > 20 ? '#FFB703' : '#FF1744';

  return `
    <div style="font-family: inherit; font-size: 12px; line-height: 1.4; color: #0F172A; min-width: 230px; padding: 2px;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 8px;">
        <div>
          <div style="font-weight: 800; font-size: 14px; color: #0F172A;">${v.vehicle_id}</div>
          <div style="font-size: 11px; font-weight: 600; color: #64748B;">${v.plate_number || 'Commercial Fleet'} &bull; ${v.vehicle_type || 'Reefer'}</div>
        </div>
        <span style="
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: 6px;
          background: ${isRerouted ? '#FEE2E2' : '#DCFCE7'};
          color: ${isRerouted ? '#991B1B' : '#166534'};
          border: 1px solid ${isRerouted ? '#FCA5A5' : '#86EFAC'};
        ">
          ${isRerouted ? 'REROUTED' : v.status || 'IN TRANSIT'}
        </span>
      </div>

      ${isRerouted ? `
        <div style="background: #FFFBEB; border: 1px solid #FCD34D; color: #92400E; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-bottom: 8px;">
          ⚠️ Dynamic Detour: Bypassed Kasara Ghat (+21.6 km, +34m)
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 6px; border-radius: 6px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase;">Live Speed</div>
          <div style="font-size: 13px; font-weight: 800; font-family: monospace; color: #0F172A;">${v.speed_kmh} km/h</div>
        </div>
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 6px; border-radius: 6px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase;">Cargo Temp</div>
          <div style="font-size: 13px; font-weight: 800; font-family: monospace; color: #0284C7;">${v.cargo_temp_c}&deg;C</div>
        </div>
      </div>

      <!-- Battery / Fuel SoC Bar -->
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px; border-radius: 6px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 4px;">
          <span style="color: #64748B;">Battery / Fuel SoC:</span>
          <span style="font-family: monospace; font-weight: 800; color: ${socColor};">${soc}%</span>
        </div>
        <div style="width: 100%; height: 6px; background: #E2E8F0; border-radius: 9999px; overflow: hidden;">
          <div style="width: ${soc}%; height: 100%; background: ${socColor}; border-radius: 9999px;"></div>
        </div>
      </div>

      <!-- Route Progress & ETA -->
      <div style="font-size: 11px; color: #475569; space-y: 2px;">
        <div><strong>GPS:</strong> <span style="font-family: monospace;">${v.latitude?.toFixed(4)}, ${v.longitude?.toFixed(4)}</span></div>
        <div><strong>Heading:</strong> ${Math.round(v.heading || 0)}&deg; &bull; <strong>ETA:</strong> ~${v.eta_mins || 0} mins</div>
        <div><strong>Traveled:</strong> ${v.distance_traveled_km || 0} km (${v.progress_pct || 0}%)</div>
        <div><strong>Next Stop:</strong> <span style="font-weight: 700; color: #0F172A;">${v.next_stop_name || 'Destination'}</span></div>
      </div>
    </div>
  `;
}

// Popup HTML builder for Roadblock Marker
function getRoadblockPopupHtml(rb) {
  return `
    <div style="font-family: inherit; font-size: 12px; line-height: 1.4; color: #0F172A; min-width: 210px; padding: 2px;">
      <div style="display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #FECACA; padding-bottom: 4px; margin-bottom: 6px;">
        <span style="font-size: 16px;">⛔</span>
        <div style="font-weight: 800; font-size: 13px; color: #B91C1C;">${rb.name}</div>
      </div>
      <div style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #991B1B; padding: 6px; border-radius: 6px; margin-bottom: 6px; font-weight: 600; font-size: 11px;">
        ${rb.description}
      </div>
      <div style="font-size: 11px; color: #475569;">
        <div><strong>Severity:</strong> <span style="color: #DC2626; font-weight: 800;">${rb.severity}</span></div>
        <div><strong>Edge Cost Penalty:</strong> ${rb.penalty_multiplier}x Normal</div>
        <div><strong>Incident Radius:</strong> ${rb.radius_km} km</div>
        <div><strong>Coordinates:</strong> ${rb.latitude?.toFixed(4)}, ${rb.longitude?.toFixed(4)}</div>
      </div>
    </div>
  `;
}

export default function RoutingTab() {
  const workspace = useWorkspace();
  const selectedFacilityId = workspace?.selectedFacilityId;
  const activeVehicleId = workspace?.activeVehicleId;
  const selectFacility = workspace?.selectFacility;
  const selectVehicle = workspace?.selectVehicle;
  const trigger3DFlyTo = workspace?.trigger3DFlyTo;
  const triggerRouteOptimization = workspace?.triggerRouteOptimization;

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routePolylineRef = useRef(null);
  const detourPolylineRef = useRef(null);
  const markersGroupRef = useRef(null);
  const vehicleMarkersGroupRef = useRef(null);
  const roadblocksGroupRef = useRef(null);
  const vehicleMarkersMapRef = useRef({});

  // Fixtures and control states
  const [fixtures, setFixtures] = useState(null);
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState('TRK-MH-01');
  const [selectedDepotId, setSelectedDepotId] = useState('PORT-JNPT-01');
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState(['DEL-THN-01', 'DEL-NSK-01', 'DEL-NSK-02']);
  const [trafficMode, setTrafficMode] = useState('STANDARD');

  // Optimization output states
  const [optimizing, setOptimizing] = useState(false);
  const [routeResult, setRouteResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Backhaul assignment states
  const [assigningBackhaulId, setAssigningBackhaulId] = useState(null);
  const [backhaulSuccessMessage, setBackhaulSuccessMessage] = useState(null);

  // Real-Time Telemetry & Simulation states
  const [liveVehicles, setLiveVehicles] = useState([]);
  const [activeRoadblocks, setActiveRoadblocks] = useState([]);
  const [rerouteAlert, setRerouteAlert] = useState(null);
  const [trackedVehicleId, setTrackedVehicleId] = useState('TRK-MH-01');

  // Synchronize 3D stage vehicle selection
  useEffect(() => {
    if (activeVehicleId && activeVehicleId !== trackedVehicleId) {
      setTrackedVehicleId(activeVehicleId);
      setSelectedVehicleId(activeVehicleId);
    }
  }, [activeVehicleId]);

  // Synchronize 3D stage facility selection to depot
  useEffect(() => {
    if (selectedFacilityId && fixtures?.depots?.some(d => d.node_id === selectedFacilityId)) {
      setSelectedDepotId(selectedFacilityId);
    }
  }, [selectedFacilityId, fixtures]);

  const handleSelectTrackedVehicle = (vId) => {
    setTrackedVehicleId(vId);
    setSelectedVehicleId(vId);
    if (selectVehicle) selectVehicle(vId);
    if (trigger3DFlyTo) trigger3DFlyTo({ type: 'vehicle', id: vId });
  };

  const handleSelectDepot = (nodeId) => {
    setSelectedDepotId(nodeId);
    if (selectFacility) selectFacility(nodeId);
    if (trigger3DFlyTo) trigger3DFlyTo({ type: 'facility', id: nodeId });
  };

  const handleFlyToStop = (wp) => {
    if (trigger3DFlyTo) {
      trigger3DFlyTo({
        type: 'facility',
        id: wp.node_id || wp.id || 'DC-BHW-01',
        name: wp.name || wp.city
      });
    }
  };

  const handleFlyToCorridor = () => {
    if (trigger3DFlyTo) {
      trigger3DFlyTo({ type: 'route', id: 'NH-160' });
    }
  };

  // 1. Fetch initial routing fixtures
  const fetchFixtures = useCallback(async () => {
    setLoadingFixtures(true);
    setErrorMessage(null);
    try {
      const data = await api.getRoutingFixtures();
      setFixtures(data);
      if (data.fleet_vehicles?.length) {
        setSelectedVehicleId(prev => (data.fleet_vehicles.some(v => v.vehicle_id === prev) ? prev : data.fleet_vehicles[0].vehicle_id));
      }
      if (data.depots?.length) {
        setSelectedDepotId(prev => (data.depots.some(d => d.node_id === prev) ? prev : data.depots[0].node_id));
      }
    } catch (err) {
      console.error('Failed to load routing fixtures:', err);
      setErrorMessage(err.message || 'Failed to load Western India corridor data.');
    } finally {
      setLoadingFixtures(false);
    }
  }, []);

  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    // Center on Western India Corridor (JNPT ↔ Thane ↔ Kasara ↔ Nashik)
    const map = L.map(mapContainerRef.current, {
      center: [19.45, 73.30],
      zoom: 8,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // High clarity CartoDB Positron / OSM light tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    markersGroupRef.current = L.featureGroup().addTo(map);
    detourPolylineRef.current = null;
    vehicleMarkersGroupRef.current = L.featureGroup().addTo(map);
    roadblocksGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      vehicleMarkersMapRef.current = {};
    };
  }, []);

  // 3. Connect to WebSocket Telemetry Hub & Listen to Ticks / Reroutes
  useEffect(() => {
    telemetryWS.connect();

    const unsubTick = telemetryWS.subscribe('tick', (tickMsg) => {
      if (tickMsg.vehicles) {
        setLiveVehicles(tickMsg.vehicles);
      }
      if (tickMsg.active_roadblocks) {
        setActiveRoadblocks(tickMsg.active_roadblocks);
      }
    });

    const unsubReroute = telemetryWS.subscribe('reroute', (event) => {
      handleRerouteEvent(event);
    });

    const unsubCleared = telemetryWS.subscribe('roadblocksCleared', () => {
      setActiveRoadblocks([]);
      setRerouteAlert(null);
      // Remove detour polyline if any
      if (detourPolylineRef.current) {
        detourPolylineRef.current.remove();
        detourPolylineRef.current = null;
      }
    });

    // Initial load of telemetry state
    api.getTelemetryState().then(res => {
      if (res.vehicles) setLiveVehicles(res.vehicles);
      if (res.active_roadblocks) setActiveRoadblocks(res.active_roadblocks);
    }).catch(err => console.debug('Initial telemetry state REST load:', err));

    return () => {
      unsubTick();
      unsubReroute();
      unsubCleared();
    };
  }, []);

  // 4. Handle Re-routing Event (Dynamic detours & polyline updates)
  const handleRerouteEvent = useCallback((event) => {
    const map = mapInstanceRef.current;
    if (!event) return;

    const details = event.reroute_details?.[0];
    if (details) {
      setRerouteAlert({
        vehicleId: details.vehicle_id,
        reason: details.detour_reason,
        addedKm: details.added_distance_km,
        addedMins: details.added_duration_mins
      });

      // If new route geometry arrived, update map polyline dynamically!
      if (details.new_route_geometry && map) {
        if (detourPolylineRef.current) {
          detourPolylineRef.current.remove();
        }

        // Draw animated detour polyline in safety red/crimson with dashed stroke
        const detourLine = L.polyline(details.new_route_geometry, {
          color: '#FF1744',
          weight: 6,
          opacity: 0.9,
          dashArray: '10, 8',
          lineJoin: 'round'
        }).addTo(map);

        detourPolylineRef.current = detourLine;

        // If the original polyline is present, fade it slightly
        if (routePolylineRef.current) {
          routePolylineRef.current.setStyle({ opacity: 0.35, color: '#94A3B8' });
        }
      }
    }
  }, []);

  // 5. Update Vehicle Markers and Roadblock Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const vGroup = vehicleMarkersGroupRef.current;
    const rbGroup = roadblocksGroupRef.current;
    if (!map || !vGroup || !rbGroup) return;

    // A. Update active vehicle markers
    liveVehicles.forEach((v) => {
      let marker = vehicleMarkersMapRef.current[v.vehicle_id];
      const icon = createVehicleMarkerIcon(v);
      const popupHtml = getVehiclePopupHtml(v);

      if (!marker) {
        marker = L.marker([v.latitude, v.longitude], {
          icon,
          zIndexOffset: 1000
        }).addTo(vGroup);
        marker.bindPopup(popupHtml);
        marker.on('click', () => setTrackedVehicleId(v.vehicle_id));
        vehicleMarkersMapRef.current[v.vehicle_id] = marker;
      } else {
        marker.setLatLng([v.latitude, v.longitude]);
        marker.setIcon(icon);
        const popup = marker.getPopup();
        if (popup && popup.isOpen()) {
          popup.setContent(popupHtml);
        }
      }
    });

    // B. Update Roadblock Hazard Markers
    rbGroup.clearLayers();
    activeRoadblocks.forEach((rb) => {
      const rbMarker = L.marker([rb.latitude, rb.longitude], {
        icon: createRoadblockMarkerIcon(rb),
        zIndexOffset: 950
      }).addTo(rbGroup);
      rbMarker.bindPopup(getRoadblockPopupHtml(rb));
    });
  }, [liveVehicles, activeRoadblocks]);

  // 6. Trigger Route Optimization
  const handleOptimizeRoute = useCallback(async () => {
    if (!fixtures) return;
    setOptimizing(true);
    setErrorMessage(null);
    setBackhaulSuccessMessage(null);

    try {
      const activeDepot = fixtures.depots?.find(d => d.node_id === selectedDepotId) || {
        latitude: 18.9496,
        longitude: 72.9515,
        name: 'JNPT Port Depot',
        city: 'Navi Mumbai'
      };

      const activeVehicle = fixtures.fleet_vehicles?.find(v => v.vehicle_id === selectedVehicleId) || {
        vehicle_id: selectedVehicleId,
        max_capacity_kg: 24000.0,
        current_fuel_pct: 90.0
      };

      const deliveriesToOptimize = (fixtures.delivery_candidates || [])
        .filter(d => selectedDeliveryIds.includes(d.delivery_id))
        .map(d => ({
          delivery_id: d.delivery_id,
          customer_name: d.customer_name,
          city: d.city,
          latitude: d.latitude,
          longitude: d.longitude,
          weight_kg: d.weight_kg,
          time_window: {
            start: d.time_window_start,
            end: d.time_window_end
          }
        }));

      if (deliveriesToOptimize.length === 0) {
        throw new Error('Please select at least one delivery stop to optimize.');
      }

      const payload = {
        depot_location: {
          latitude: activeDepot.latitude,
          longitude: activeDepot.longitude,
          name: activeDepot.name,
          city: activeDepot.city
        },
        fleet_units: [
          {
            vehicle_id: activeVehicle.vehicle_id,
            max_capacity_kg: activeVehicle.max_payload_kg || activeVehicle.max_capacity_kg || 24000.0,
            current_fuel_pct: activeVehicle.battery_fuel_soc_pct || 90.0
          }
        ],
        deliveries: deliveriesToOptimize,
        traffic_mode: trafficMode
      };

      const result = await api.optimizeRoute(payload);
      setRouteResult(result);
      if (triggerRouteOptimization) {
        triggerRouteOptimization(result);
      }
    } catch (err) {
      console.error('Optimization error:', err);
      setErrorMessage(err.message || 'Route optimization failed.');
    } finally {
      setOptimizing(false);
    }
  }, [fixtures, selectedDepotId, selectedVehicleId, selectedDeliveryIds, trafficMode]);

  // Initial optimization run when fixtures finish loading
  useEffect(() => {
    if (fixtures && !routeResult && !optimizing) {
      handleOptimizeRoute();
    }
  }, [fixtures]);

  // 7. Update Leaflet Map with Planned Route Polyline and Stop Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup || !routeResult) return;

    // Clear previous stop markers and polyline
    markersGroup.clearLayers();
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    const { waypoints_sequence, route_geometry, traffic_mode: tMode } = routeResult;

    // Draw Route Polyline
    if (route_geometry && route_geometry.length > 0) {
      const isCongested = tMode === 'CONGESTED';
      const polyline = L.polyline(route_geometry, {
        color: isCongested ? '#FF1744' : '#FF5400',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
        dashArray: isCongested ? '8, 6' : undefined
      }).addTo(map);

      routePolylineRef.current = polyline;
    }

    // Add Stop Markers
    if (waypoints_sequence && waypoints_sequence.length > 0) {
      waypoints_sequence.forEach((wp) => {
        const icon = createCustomMarkerIcon(wp.type, wp.stop_order);
        const marker = L.marker([wp.latitude, wp.longitude], { icon });

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4; color: #0F172A; min-width: 180px;">
            <div style="font-weight: 800; font-size: 13px; margin-bottom: 2px;">
              #${wp.stop_order}: ${wp.name || wp.type}
            </div>
            <div style="color: #64748B; font-weight: 600; margin-bottom: 6px;">
              ${wp.city || ''} &bull; <span style="text-transform: uppercase;">${wp.type}</span>
            </div>
            <div style="background: #F1F5F9; padding: 6px; border-radius: 6px; margin-bottom: 4px;">
              <div><strong>ETA:</strong> ${new Date(wp.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div><strong>Leg Dist:</strong> ${wp.distance_from_prev_km} km (${wp.duration_from_prev_mins} mins)</div>
              ${wp.demand_kg > 0 ? `<div><strong>Payload:</strong> ${wp.demand_kg.toLocaleString()} kg</div>` : ''}
              <div><strong>Remaining Cap:</strong> ${wp.remaining_capacity_kg.toLocaleString()} kg</div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        markersGroup.addLayer(marker);
      });

      // Fit map bounds to show full route
      try {
        const bounds = markersGroup.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        }
      } catch (e) {
        console.warn('Map bounds fit warning:', e);
      }
    }
  }, [routeResult]);

  // 8. One-Click Backhaul Assignment Handler
  const handleAssignBackhaul = async (backhaulId) => {
    if (!routeResult) return;
    setAssigningBackhaulId(backhaulId);
    setErrorMessage(null);
    setBackhaulSuccessMessage(null);

    try {
      const payload = {
        route_id: routeResult.route_id,
        backhaul_id: backhaulId,
        current_route: routeResult
      };

      const updated = await api.assignBackhaul(payload);
      setRouteResult(updated);
      if (triggerRouteOptimization) {
        triggerRouteOptimization(updated);
      }
      setBackhaulSuccessMessage(`Successfully assigned return backhaul ${backhaulId}! Eliminated ${updated.empty_km_eliminated} unladen empty kilometers.`);
    } catch (err) {
      console.error('Failed to assign backhaul:', err);
      setErrorMessage(err.message || 'Failed to assign backhaul.');
    } finally {
      setAssigningBackhaulId(null);
    }
  };

  // Toggle delivery checkbox
  const toggleDeliverySelection = (delId) => {
    setSelectedDeliveryIds(prev => {
      if (prev.includes(delId)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter(id => id !== delId);
      } else {
        return [...prev, delId];
      }
    });
  };

  const selectedVehicle = fixtures?.fleet_vehicles?.find(v => v.vehicle_id === selectedVehicleId);
  const maxCap = selectedVehicle?.max_payload_kg || 24000.0;
  const currentTotalWeight = (fixtures?.delivery_candidates || [])
    .filter(d => selectedDeliveryIds.includes(d.delivery_id))
    .reduce((sum, d) => sum + (d.weight_kg || 0), 0);
  const capacityPct = Math.min(100, Math.round((currentTotalWeight / maxCap) * 100));
  const isOverCapacity = currentTotalWeight > maxCap;

  // Active tracked vehicle for telematics sensor gauges
  const trackedVehicle = liveVehicles.find(v => v.vehicle_id === trackedVehicleId) || liveVehicles[0] || {
    vehicle_id: 'TRK-MH-01',
    plate_number: 'MH-04-GP-8821',
    speed_kmh: 62.0,
    battery_fuel_soc_pct: 94.5,
    cargo_temp_c: 4.1,
    heading: 48,
    status: 'IN_TRANSIT',
    distance_traveled_km: 0.0,
    total_route_distance_km: 178.5,
    progress_pct: 0.0,
    next_stop_name: 'Thane Cold Chain DC',
    eta_mins: 95
  };

  if (loadingFixtures && !fixtures) {
    return (
      <div className="bright-card p-12 rounded-2xl bg-white border-2 border-slate-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-300 flex items-center justify-center mx-auto text-orange-600 animate-pulse">
          <Truck className="w-6 h-6 stroke-[2.2]" />
        </div>
        <h3 className="text-base font-extrabold text-slate-900">Loading Western India Corridor GIS & Fleet Network...</h3>
        <p className="text-xs text-slate-500 font-medium">Connecting to JNPT / Mumbai / Thane / Nashik / Pune telemetry fixtures</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* 1. Global Real-Time Simulation Playback & Disruption Injection Bar */}
      <SimulationBar onRerouteEvent={handleRerouteEvent} />

      {/* Dynamic Roadblock & Re-Routing Warning Banner */}
      {rerouteAlert && (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-slate-900 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-rose-900 uppercase tracking-wider flex items-center gap-2">
                <span>Autonomous Re-Routing Triggered</span>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full font-mono-num font-bold">
                  +{rerouteAlert.addedKm} km / +{rerouteAlert.addedMins}m
                </span>
              </div>
              <div className="text-xs text-slate-700 font-medium mt-0.5">
                {rerouteAlert.reason}
              </div>
            </div>
          </div>
          <button
            onClick={() => setRerouteAlert(null)}
            className="text-xs font-bold text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-lg bg-rose-100 border border-rose-200"
          >
            Dismiss Alert
          </button>
        </div>
      )}

      {/* 2. Tab Header Banner */}
      <div className="cyber-glass rounded-2xl p-6 bg-slate-900/60 border border-slate-700/60 backdrop-blur-md shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-500/40">
                DRL Fleet Dispatcher Console
              </span>
              <span className="text-xs text-slate-600">•</span>
              <span className="text-xs font-semibold text-slate-400">
                PyTorch Neural VRP & Live Telemetry Stream
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Route & Fleet Optimizer
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                Western India Corridor
              </span>
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-400 max-w-3xl mt-1.5 leading-relaxed">
              Dynamically solve optimal multi-stop vehicle schedules across Mumbai, JNPT, Thane, Kasara Ghat, Nashik, and Pune. 
              Track animated truck coordinates, cold-chain temperature telematics, and autonomous roadblock detours in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleFlyToCorridor}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs sm:text-sm font-extrabold transition-all duration-150 flex items-center gap-2 shadow-sm active:scale-[0.98] cursor-pointer"
              title="Fly 3D Camera along Corridor Spline"
            >
              <Compass className="w-4 h-4" />
              <span>Fly 3D Corridor</span>
            </button>

            <button
              onClick={handleOptimizeRoute}
              disabled={optimizing || isOverCapacity}
              className="px-5 py-2.5 rounded-xl bg-[#FF5400] hover:bg-[#e04a00] text-white text-xs sm:text-sm font-extrabold transition-all duration-150 flex items-center gap-2 shadow-sm active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Zap className={`w-4 h-4 ${optimizing ? 'animate-spin' : ''}`} />
              <span>{optimizing ? 'Solving Neural VRP...' : 'Re-Optimize Route'}</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/60 text-xs font-bold text-rose-200 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 stroke-[2.5]" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Backhaul Success Banner */}
        {backhaulSuccessMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/60 text-xs font-bold text-emerald-200 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />
              <span>{backhaulSuccessMessage}</span>
            </div>
            <button 
              onClick={() => setBackhaulSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-300 underline text-[11px] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 3. Live Telematics Sensor Telemetry Dashboard Card */}
      <div className="cyber-glass p-5 rounded-2xl bg-slate-900/60 border border-slate-700/60 backdrop-blur-md shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Live Vehicle IoT Telemetry Stream
            </h3>
            <span className="text-[10px] font-mono-num font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
              1.0 Hz Cadence
            </span>
          </div>

          {/* Vehicle Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Track Unit:</span>
            <div className="flex gap-1">
              {['TRK-MH-01', 'TRK-MH-02'].map(vId => (
                <button
                  key={vId}
                  onClick={() => handleSelectTrackedVehicle(vId)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                    trackedVehicleId === vId
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {vId}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Core Telemetry Gauges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Gauge 1: Speed */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-orange-600" />
                Live Speed
              </span>
              <span className="font-mono-num text-[10px] text-slate-400">OBD-II</span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-1">
              <span className="text-2xl font-extrabold text-slate-900 font-mono-num">
                {trackedVehicle.speed_kmh}
              </span>
              <span className="text-xs font-semibold text-slate-500">km/h</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Heading: <strong className="text-slate-800 font-mono-num">{Math.round(trackedVehicle.heading || 0)}&deg;</strong> &bull; GPS Active
            </div>
          </div>

          {/* Gauge 2: Battery / Fuel State of Charge */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span className="flex items-center gap-1.5">
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
                Fuel / SoC State
              </span>
              <span className={`text-[10px] font-bold font-mono-num ${trackedVehicle.battery_fuel_soc_pct < 25 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {trackedVehicle.battery_fuel_soc_pct}%
              </span>
            </div>
            <div className="pt-2">
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    trackedVehicle.battery_fuel_soc_pct > 50
                      ? 'bg-emerald-500'
                      : trackedVehicle.battery_fuel_soc_pct > 25
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, trackedVehicle.battery_fuel_soc_pct || 0)}%` }}
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-medium pt-1">
              Estimated range: <strong className="text-slate-800 font-mono-num">~{(trackedVehicle.battery_fuel_soc_pct * 3.8).toFixed(0)} km</strong>
            </div>
          </div>

          {/* Gauge 3: Cold-Chain Cargo Temperature */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span className="flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-blue-600" />
                Reefer Cargo Temp
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded font-mono-num">
                2°C-8°C SLA
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-1">
              <span className="text-2xl font-extrabold text-blue-900 font-mono-num">
                {trackedVehicle.cargo_temp_c}
              </span>
              <span className="text-xs font-semibold text-slate-500">&deg;C</span>
            </div>
            <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Cold Chain Integrity Optimal</span>
            </div>
          </div>

          {/* Gauge 4: Route Progress & Next Stop */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-purple-600" />
                Route Progress
              </span>
              <span className="text-[10px] font-bold font-mono-num text-slate-700">
                {trackedVehicle.progress_pct}%
              </span>
            </div>
            <div className="flex items-baseline gap-1 pt-1">
              <span className="text-lg font-extrabold text-slate-900 font-mono-num">
                {trackedVehicle.distance_traveled_km}
              </span>
              <span className="text-xs text-slate-500">/ {trackedVehicle.total_route_distance_km} km</span>
            </div>
            <div className="text-[10px] text-slate-600 font-medium truncate">
              Next: <strong className="text-slate-900">{trackedVehicle.next_stop_name || 'En Route'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Control Panel Grid: Vehicle, Traffic, Depot, Capacity Utilization */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Fleet Vehicle Selector */}
        <div className="cyber-glass p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-orange-400" />
              Active Fleet Unit
            </span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono-num font-bold">
              {selectedVehicle?.plate_number || 'TRUCK'}
            </span>
          </div>
          <select
            value={selectedVehicleId}
            onChange={(e) => {
              handleSelectTrackedVehicle(e.target.value);
            }}
            className="w-full text-xs font-bold bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-orange-500"
          >
            {fixtures?.fleet_vehicles?.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                {v.vehicle_id} &bull; {v.vehicle_type} ({(v.max_payload_kg / 1000).toFixed(0)}T)
              </option>
            ))}
          </select>
          <div className="text-[11px] font-semibold text-slate-400 flex justify-between">
            <span>Payload Limit:</span>
            <span className="font-mono-num text-white font-bold">{maxCap.toLocaleString()} kg</span>
          </div>
        </div>

        {/* 2. Central Depot Selector */}
        <div className="cyber-glass p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-400" />
              Corridor Central Depot
            </span>
            <button
              type="button"
              onClick={() => handleSelectDepot(selectedDepotId)}
              className="text-[10px] bg-orange-950/80 text-orange-300 hover:text-white border border-orange-500/40 px-1.5 py-0.5 rounded font-bold uppercase cursor-pointer flex items-center gap-1"
              title="Fly 3D Camera to Depot Node"
            >
              <Compass className="w-2.5 h-2.5" />
              <span>Fly 3D</span>
            </button>
          </div>
          <select
            value={selectedDepotId}
            onChange={(e) => handleSelectDepot(e.target.value)}
            className="w-full text-xs font-bold bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-orange-500"
          >
            {fixtures?.depots?.map(d => (
              <option key={d.node_id} value={d.node_id}>
                {d.name} &bull; {d.city}
              </option>
            ))}
          </select>
          <div className="text-[11px] font-semibold text-slate-400">
            Automated return routing to central corridor origin
          </div>
        </div>

        {/* 3. Traffic Congestion Mode Selector */}
        <div className="cyber-glass p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              Corridor Traffic Flow
            </span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-bold">
              {trafficMode}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setTrafficMode('STANDARD')}
              className={`py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                trafficMode === 'STANDARD' ? 'bg-slate-800 shadow-xs text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setTrafficMode('CONGESTED')}
              className={`py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                trafficMode === 'CONGESTED' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Congested
            </button>
          </div>
          <div className="text-[11px] font-medium text-slate-400">
            {trafficMode === 'CONGESTED' ? 'Kasara Ghat & Thane toll delays active (+65% duration)' : 'Clear highway flow along NH-48 / NH-160'}
          </div>
        </div>

        {/* 4. Vehicle Payload Utilization Bar */}
        <div className="cyber-glass p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-orange-400" />
              Payload Capacity
            </span>
            <span className={`text-xs font-mono-num font-extrabold ${isOverCapacity ? 'text-rose-400' : 'text-white'}`}>
              {capacityPct}%
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isOverCapacity
                  ? 'bg-rose-600'
                  : capacityPct > 85
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, capacityPct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Loaded: <strong className="text-white font-mono-num">{currentTotalWeight.toLocaleString()} kg</strong></span>
            <span>Rem: <strong className="text-white font-mono-num">{Math.max(0, maxCap - currentTotalWeight).toLocaleString()} kg</strong></span>
          </div>
        </div>
      </div>

      {/* 5. Main Interactive Map & Route Telematics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Leaflet.js Interactive Map (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="bright-card rounded-2xl bg-white border-2 border-slate-200 overflow-hidden flex flex-col">
            {/* Map Header Bar */}
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Western India Corridor Dynamic GIS Map
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  {routeResult?.waypoints_sequence?.length || 0} Scheduled Waypoints &bull; {liveVehicles.length} Telemetry Units
                </span>
              </div>
            </div>

            {/* Leaflet Map Canvas Container */}
            <div
              ref={mapContainerRef}
              className="w-full h-[480px] bg-slate-100 relative z-0"
              style={{ minHeight: '480px' }}
            />

            {/* Map Legend Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#FF5400] inline-block" />
                  <span>Depot / Hub</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-slate-900 inline-block" />
                  <span>Delivery Stop</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span>Live Vehicle</span>
                </div>
                {activeRoadblocks.length > 0 && (
                  <div className="flex items-center gap-1.5 text-rose-600 font-bold">
                    <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping inline-block" />
                    <span>Roadblock / Detour</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono-num">
                  Route: {routeResult?.route_id || 'PENDING'}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Order Candidates Selection Matrix */}
          <div className="bright-card p-5 rounded-2xl bg-white border-2 border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Available Corridor Delivery Orders (Select to Re-Route)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {selectedDeliveryIds.length} of {fixtures?.delivery_candidates?.length || 0} active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {fixtures?.delivery_candidates?.map(del => {
                const isSelected = selectedDeliveryIds.includes(del.delivery_id);
                return (
                  <div
                    key={del.delivery_id}
                    onClick={() => toggleDeliverySelection(del.delivery_id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-150 flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-orange-50/70 border-orange-300 text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-extrabold flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-orange-600' : 'bg-slate-300'}`} />
                        <span>{del.city}</span>
                        <span className="text-[10px] text-slate-400 font-mono-num font-normal">({del.delivery_id})</span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-600 truncate max-w-[200px]">
                        {del.customer_name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono-num">
                        Payload: <strong className="text-slate-800">{del.weight_kg.toLocaleString()} kg</strong>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by div click
                      className="mt-1 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Route KPIs, Turn-by-Turn Waypoints & Backhaul Matching (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Key Route Metrics Card */}
          <div className="bright-card p-5 rounded-2xl bg-white border-2 border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                DRL Optimization Metrics
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Neural Policy Verified
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5 text-orange-600" />
                  Distance
                </span>
                <div className="text-lg font-extrabold text-slate-900 font-mono-num mt-1">
                  {routeResult?.total_distance_km || 0} <span className="text-xs font-semibold text-slate-500">km</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Duration
                </span>
                <div className="text-lg font-extrabold text-slate-900 font-mono-num mt-1">
                  {Math.floor((routeResult?.estimated_duration_minutes || 0) / 60)}h {(routeResult?.estimated_duration_minutes || 0) % 60}m
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-amber-600" />
                  Fuel Burn
                </span>
                <div className="text-lg font-extrabold text-slate-900 font-mono-num mt-1">
                  {routeResult?.fuel_consumption_liters || 0} <span className="text-xs font-semibold text-slate-500">L</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                  CO2 Footprint
                </span>
                <div className="text-lg font-extrabold text-emerald-700 font-mono-num mt-1">
                  {routeResult?.co2_emissions_kg || 0} <span className="text-xs font-semibold text-slate-500">kg</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    Unladen "Empty" Kilometers
                  </span>
                  {routeResult?.assigned_backhaul_id && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                      ELIMINATED!
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <div className={`text-lg font-extrabold font-mono-num ${routeResult?.empty_distance_km < 30 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {routeResult?.empty_distance_km || 0} <span className="text-xs font-semibold text-slate-500">km</span>
                  </div>
                  {routeResult?.empty_km_eliminated > 0 && (
                    <span className="text-xs font-bold text-emerald-600">
                      (-{routeResult.empty_km_eliminated} km avoided)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Backhaul Freight Matching Section */}
          <div className="bright-card p-5 rounded-2xl bg-white border-2 border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Return-Haul Freight Matching (Backhauls)
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                {routeResult?.matched_backhauls?.length || 0} Compatible
              </span>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Eliminate deadheading by picking up high-value return loads compatible with truck capacity and return geometry.
            </p>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {routeResult?.matched_backhauls?.map(bhl => {
                const isAssigned = bhl.assigned || routeResult?.assigned_backhaul_id === bhl.backhaul_id;
                return (
                  <div
                    key={bhl.backhaul_id}
                    className={`p-3.5 rounded-xl border transition-all duration-150 space-y-2 ${
                      isAssigned
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-slate-900">{bhl.origin_city} ➔ {bhl.destination_city}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-1.5 py-0.2 rounded font-mono-num">
                            Match: {(bhl.compatibility_score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                          {bhl.shipper_name}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-extrabold text-emerald-700 font-mono-num">
                          ₹{bhl.payout_inr.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-500">Guaranteed Payout</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 font-medium bg-white p-2 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-1">
                      <span>Cargo: <strong className="text-slate-800">{bhl.cargo_type}</strong></span>
                      <span>Weight: <strong className="text-slate-800 font-mono-num">{bhl.cargo_weight_kg.toLocaleString()} kg</strong></span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                        <Leaf className="w-3 h-3 text-emerald-600" />
                        <span>Saves {bhl.co2_savings_kg} kg CO2 & {bhl.empty_km_eliminated} empty km</span>
                      </div>

                      <button
                        onClick={() => handleAssignBackhaul(bhl.backhaul_id)}
                        disabled={isAssigned || assigningBackhaulId === bhl.backhaul_id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          isAssigned
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-[0.98]'
                        }`}
                      >
                        {isAssigned ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            <span>Assigned</span>
                          </>
                        ) : assigningBackhaulId === bhl.backhaul_id ? (
                          <span>Assigning...</span>
                        ) : (
                          <>
                            <span>1-Click Assign</span>
                            <ArrowRight className="w-3 h-3 text-orange-400" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {(!routeResult?.matched_backhauls || routeResult.matched_backhauls.length === 0) && (
                <div className="p-4 text-center text-xs text-slate-500 font-semibold bg-slate-50 rounded-xl">
                  No return backhauls matching current route endpoints.
                </div>
              )}
            </div>
          </div>

          {/* Turn-by-Turn Waypoint Sequence Table */}
          <div className="cyber-glass p-5 rounded-2xl bg-slate-900/60 border border-slate-700/60 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Turn-by-Turn Waypoint Sequence
                </h3>
              </div>
              <span className="text-[11px] font-mono-num text-slate-400">
                Chronological Order
              </span>
            </div>

            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-2">Stop</th>
                    <th className="pb-2">Destination / Type</th>
                    <th className="pb-2 text-right">ETA</th>
                    <th className="pb-2 text-right">Leg Dist</th>
                    <th className="pb-2 text-right">Capacity Rem</th>
                    <th className="pb-2 text-right">3D Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {routeResult?.waypoints_sequence?.map((wp) => (
                    <tr key={wp.stop_order} className="hover:bg-slate-800/40 transition">
                      <td className="py-2 font-mono-num font-bold text-white">
                        #{wp.stop_order}
                      </td>
                      <td className="py-2">
                        <div className="font-bold text-white truncate max-w-[130px]">
                          {wp.name || wp.type}
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          wp.type === 'DEPOT' 
                            ? 'bg-orange-950 text-orange-300 border border-orange-500/40' 
                            : wp.type.startsWith('BACKHAUL')
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {wp.type}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono-num font-semibold text-slate-300">
                        {new Date(wp.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 text-right font-mono-num text-slate-400">
                        {wp.distance_from_prev_km} km
                      </td>
                      <td className="py-2 text-right font-mono-num font-semibold text-slate-300">
                        {wp.remaining_capacity_kg?.toLocaleString()} kg
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleFlyToStop(wp)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-orange-600 text-slate-300 hover:text-white text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Fly 3D Camera to Stop"
                        >
                          <Compass className="w-2.5 h-2.5" />
                          <span>3D</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
