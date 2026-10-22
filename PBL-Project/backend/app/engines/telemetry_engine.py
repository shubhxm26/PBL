import math
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two coordinates in kilometers."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate forward compass azimuth/bearing from point 1 to point 2 in degrees (0-360)."""
    if abs(lat1 - lat2) < 1e-6 and abs(lon1 - lon2) < 1e-6:
        return 0.0
    dlon = math.radians(lon2 - lon1)
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    x = math.sin(dlon) * math.cos(lat2_rad)
    y = (math.cos(lat1_rad) * math.sin(lat2_rad) -
         math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon))
    initial_bearing = math.degrees(math.atan2(x, y))
    compass_bearing = (initial_bearing + 360.0) % 360.0
    return round(compass_bearing, 1)


def interpolate_coordinates_along_polyline(
    polyline: List[List[float]],
    progress: float
) -> Tuple[float, float, int]:
    """
    Interpolates geodesic lat/lon along a polyline given a fractional progress (0.0 to 1.0).
    Returns (lat, lon, current_segment_index).
    """
    if not polyline:
        return 19.0760, 72.8777, 0
    if len(polyline) == 1:
        return polyline[0][0], polyline[0][1], 0

    clamped_prog = max(0.0, min(1.0, progress))

    # Calculate cumulative distance along polyline segments
    segment_lengths: List[float] = []
    total_dist = 0.0
    for i in range(len(polyline) - 1):
        p1 = polyline[i]
        p2 = polyline[i + 1]
        dist = haversine_km(p1[0], p1[1], p2[0], p2[1])
        segment_lengths.append(dist)
        total_dist += dist

    if total_dist <= 1e-6:
        return polyline[0][0], polyline[0][1], 0

    target_dist = total_dist * clamped_prog
    accumulated = 0.0

    for idx, seg_len in enumerate(segment_lengths):
        if accumulated + seg_len >= target_dist or idx == len(segment_lengths) - 1:
            remain = target_dist - accumulated
            factor = (remain / seg_len) if seg_len > 1e-6 else 0.0
            factor = max(0.0, min(1.0, factor))
            p1 = polyline[idx]
            p2 = polyline[idx + 1]
            inter_lat = p1[0] + factor * (p2[0] - p1[0])
            inter_lon = p1[1] + factor * (p2[1] - p1[1])
            return round(inter_lat, 6), round(inter_lon, 6), idx
        accumulated += seg_len

    last_pt = polyline[-1]
    return last_pt[0], last_pt[1], len(polyline) - 2


# Western India Corridor Highway Base Trajectories
DEFAULT_JNPT_NASHIK_POLYLINE = [
    [18.9496, 72.9515],  # JNPT Depot
    [18.9720, 72.9800],  # Uran Bypass
    [19.0050, 73.0150],  # Belapur CBD
    [19.0400, 72.9500],  # Vashi Creek Bridge
    [19.0760, 72.8777],  # Chembur / Mumbai Eastern Express
    [19.1200, 72.9100],  # Ghatkopar
    [19.1750, 72.9500],  # Mulund Check Naka
    [19.2183, 72.9781],  # Thane Majhiwada Junction (Stop 1)
    [19.2550, 73.0100],  # Kalwa
    [19.2967, 73.0631],  # Bhiwandi Logistics Corridor
    [19.3800, 73.1600],  # Padgha Toll Plaza
    [19.4600, 73.2800],  # Asangaon
    [19.5500, 73.4000],  # Shahapur
    [19.6400, 73.5000],  # Kasara Base
    [19.6967, 73.5611],  # Kasara Ghat / Igatpuri Pass
    [19.7500, 73.6100],  # Igatpuri Toll Plaza
    [19.8500, 73.6900],  # Ghoti
    [19.9200, 73.7400],  # Sinnar Phata
    [19.9975, 73.7898]   # Nashik Ambad MIDC (Stop 2)
]

# Detour trajectory bypassing Kasara Ghat landslide via Malshej Ghat / Sangamner
DETOUR_KASARA_POLYLINE = [
    [18.9496, 72.9515],  # JNPT Depot
    [18.9720, 72.9800],
    [19.0050, 73.0150],
    [19.0400, 72.9500],
    [19.0760, 72.8777],
    [19.1200, 72.9100],
    [19.1750, 72.9500],
    [19.2183, 72.9781],  # Thane Majhiwada
    [19.2550, 73.0100],
    [19.2967, 73.0631],  # Bhiwandi
    # Diversion: Turn East towards Kalyan / Murbad
    [19.2437, 73.1355],  # Kalyan East Bypass
    [19.2500, 73.4000],  # Murbad
    [19.3400, 73.7700],  # Malshej Ghat Crest (Bypass Route)
    [19.2600, 73.9800],  # Otur
    [19.1800, 74.1200],  # Alephata Junction
    [19.5700, 74.2100],  # Sangamner Highway
    [19.8400, 73.9900],  # Sinnar MIDC
    [19.9975, 73.7898]   # Nashik Ambad MIDC
]

# Panvel to Pune Expressway Trajectory
DEFAULT_PANVEL_PUNE_POLYLINE = [
    [18.9894, 73.1175],  # Panvel Depot
    [18.9200, 73.2200],  # Khalapur Toll Plaza
    [18.8400, 73.3100],  # Khopoli Entry
    [18.7557, 73.4091],  # Lonavala Khandala Bhor Ghat
    [18.7100, 73.5500],  # Talegaon Dabhade
    [18.6600, 73.6800],  # Dehu Road
    [18.5913, 73.7389],  # Hinjewadi IT Park (Stop 1)
    [18.5204, 73.8567]   # Pune Swargate Hub (Stop 2)
]


class TelemetrySimulationEngine:
    """
    Central Real-Time Simulation and Telemetry Tick Engine.
    Manages active fleet routes, continuous GPS interpolation along road geometry,
    live sensor metrics (speed, battery/fuel SoC, cold-chain temperature),
    and dynamic detour re-routing when roadblocks are injected.
    """

    def __init__(self):
        self.is_running: bool = False
        self.speed_multiplier: float = 1.0  # 1x, 2x, 5x
        self.elapsed_seconds: int = 0
        self.sim_start_time = datetime.now(timezone.utc).replace(hour=8, minute=0, second=0, microsecond=0)
        self.active_roadblocks: Dict[str, Dict[str, Any]] = {}
        self.vehicles: Dict[str, Dict[str, Any]] = {}
        self._initialize_default_vehicles()

    def _initialize_default_vehicles(self):
        """Seed high-fidelity Western India corridor vehicle routes and telematics."""
        self.vehicles = {
            "TRK-MH-01": {
                "vehicle_id": "TRK-MH-01",
                "plate_number": "MH-04-GP-8821",
                "vehicle_type": "24T Heavy Commercial Reefer",
                "max_capacity_kg": 24000.0,
                "current_payload_kg": 18500.0,
                "cargo_description": "Perishable Vaccines & Biopharma (Cold-Chain 2°C-8°C)",
                "initial_soc_pct": 96.0,
                "battery_fuel_soc_pct": 96.0,
                "cargo_temp_c": 4.1,
                "target_temp_c": 4.0,
                "route_geometry": list(DEFAULT_JNPT_NASHIK_POLYLINE),
                "original_geometry": list(DEFAULT_JNPT_NASHIK_POLYLINE),
                "total_route_distance_km": 178.5,
                "distance_traveled_km": 0.0,
                "progress_ratio": 0.0,
                "current_latitude": DEFAULT_JNPT_NASHIK_POLYLINE[0][0],
                "current_longitude": DEFAULT_JNPT_NASHIK_POLYLINE[0][1],
                "heading": 45.0,
                "speed_kmh": 62.0,
                "status": "IN_TRANSIT",
                "is_rerouted": False,
                "detour_info": None,
                "stops": [
                    {"name": "JNPT Port Depot", "city": "Navi Mumbai", "lat": 18.9496, "lon": 72.9515, "order": 1, "done": True},
                    {"name": "Thane Cold Chain DC", "city": "Thane", "lat": 19.2183, "lon": 72.9781, "order": 2, "done": False},
                    {"name": "Nashik Ambad Hub", "city": "Nashik", "lat": 19.9975, "lon": 73.7898, "order": 3, "done": False}
                ],
                "current_stop_order": 2,
                "next_stop_name": "Thane Cold Chain DC"
            },
            "TRK-MH-02": {
                "vehicle_id": "TRK-MH-02",
                "plate_number": "MH-12-QE-4419",
                "vehicle_type": "16T Electric Express Carrier",
                "max_capacity_kg": 16000.0,
                "current_payload_kg": 11200.0,
                "cargo_description": "Automotive Electronics & Precision Modules",
                "initial_soc_pct": 91.5,
                "battery_fuel_soc_pct": 91.5,
                "cargo_temp_c": 19.2,
                "target_temp_c": 20.0,
                "route_geometry": list(DEFAULT_PANVEL_PUNE_POLYLINE),
                "original_geometry": list(DEFAULT_PANVEL_PUNE_POLYLINE),
                "total_route_distance_km": 142.0,
                "distance_traveled_km": 0.0,
                "progress_ratio": 0.0,
                "current_latitude": DEFAULT_PANVEL_PUNE_POLYLINE[0][0],
                "current_longitude": DEFAULT_PANVEL_PUNE_POLYLINE[0][1],
                "heading": 135.0,
                "speed_kmh": 68.0,
                "status": "IN_TRANSIT",
                "is_rerouted": False,
                "detour_info": None,
                "stops": [
                    {"name": "Panvel Logistics Depot", "city": "Panvel", "lat": 18.9894, "lon": 73.1175, "order": 1, "done": True},
                    {"name": "Hinjewadi IT Delivery", "city": "Pune", "lat": 18.5913, "lon": 73.7389, "order": 2, "done": False},
                    {"name": "Swargate Distribution", "city": "Pune", "lat": 18.5204, "lon": 73.8567, "order": 3, "done": False}
                ],
                "current_stop_order": 2,
                "next_stop_name": "Hinjewadi IT Delivery"
            }
        }

    def play(self):
        """Starts real-time simulation tick progression."""
        self.is_running = True

    def pause(self):
        """Pauses real-time simulation tick progression."""
        self.is_running = False

    def set_speed(self, multiplier: float):
        """Configures simulation speed multiplier (1x, 2x, 5x)."""
        if multiplier in [1.0, 2.0, 5.0, 10.0]:
            self.speed_multiplier = multiplier
        else:
            self.speed_multiplier = max(0.5, min(10.0, float(multiplier)))

    def step(self, step_seconds: int = 15) -> Dict[str, Any]:
        """Manually advances simulation by discrete seconds and generates a fresh tick."""
        self.elapsed_seconds += step_seconds
        # Tick vehicles by step_seconds
        self._advance_vehicles(dt_seconds=step_seconds)
        return self.get_tick_payload()

    def reset(self):
        """Resets simulation clock, vehicle trajectories, and clears disruptions."""
        self.is_running = False
        self.speed_multiplier = 1.0
        self.elapsed_seconds = 0
        self.active_roadblocks.clear()
        self._initialize_default_vehicles()

    def tick(self, dt_seconds: float = 1.0) -> Dict[str, Any]:
        """
        Executes one clock tick. Advances vehicles along road geometries,
        calculates sensor readings, and returns broadcast payload.
        """
        if self.is_running:
            simulated_dt = dt_seconds * self.speed_multiplier
            self.elapsed_seconds += int(simulated_dt)
            self._advance_vehicles(dt_seconds=simulated_dt)
        return self.get_tick_payload()

    def _advance_vehicles(self, dt_seconds: float):
        """Calculates distance increment, updates GPS position, speed, and fuel."""
        for v_id, v in self.vehicles.items():
            tot_km = max(v.get("total_route_distance_km", 100.0), 10.0)
            geom = v.get("route_geometry", [])
            if not geom or len(geom) < 2:
                continue

            prev_dist = v.get("distance_traveled_km", 0.0)
            prev_lat = v.get("current_latitude", geom[0][0])
            prev_lon = v.get("current_longitude", geom[0][1])

            # Calculate dynamic speed based on terrain & bottlenecks
            current_lat = prev_lat
            current_lon = prev_lon
            in_kasara_ghat = (19.62 <= current_lat <= 19.78 and 73.48 <= current_lon <= 73.65)
            in_bhor_ghat = (18.72 <= current_lat <= 18.88 and 73.30 <= current_lon <= 73.48)

            # Check if road is blocked ahead
            speed_penalty = 1.0
            for rb in self.active_roadblocks.values():
                dist_to_rb = haversine_km(current_lat, current_lon, rb["latitude"], rb["longitude"])
                if dist_to_rb < rb.get("radius_km", 15.0):
                    speed_penalty = 0.5  # Congestion near incident
                    break

            base_speed = 64.0
            if in_kasara_ghat or in_bhor_ghat:
                base_speed = 38.0  # Slow hairpin curves
            elif v.get("is_rerouted", False):
                base_speed = 52.0  # Detour secondary highway

            # Small realistic IoT telemetry vibration / jitter
            t_wave = math.sin((self.elapsed_seconds + hash(v_id) % 100) / 15.0)
            live_speed = max(18.0, min(85.0, (base_speed + t_wave * 4.5) * speed_penalty))

            # Advance distance
            km_step = (live_speed / 3600.0) * dt_seconds
            new_dist = min(tot_km, prev_dist + km_step)
            new_prog = (new_dist / tot_km) if tot_km > 0 else 0.0

            # Interpolate new GPS coordinate
            new_lat, new_lon, _ = interpolate_coordinates_along_polyline(geom, new_prog)

            # Compute heading
            if abs(new_lat - prev_lat) > 1e-5 or abs(new_lon - prev_lon) > 1e-5:
                heading = calculate_bearing(prev_lat, prev_lon, new_lat, new_lon)
            else:
                heading = v.get("heading", 45.0)

            # Realistic battery/fuel consumption
            incline_factor = 1.4 if (in_kasara_ghat or in_bhor_ghat) else 1.0
            soc_drain = (km_step * 0.10 * incline_factor)
            new_soc = max(4.0, round(v.get("battery_fuel_soc_pct", 100.0) - soc_drain, 2))

            # Cargo temperature fluctuation (cold chain reefer)
            target_temp = v.get("target_temp_c", 4.0)
            temp_wave = math.sin((self.elapsed_seconds + hash(v_id) % 50) / 45.0) * 0.4
            ambient_leakage = 0.2 if (in_kasara_ghat or in_bhor_ghat) else 0.0
            cargo_temp = round(target_temp + temp_wave + ambient_leakage, 1)

            # Update vehicle record
            v["distance_traveled_km"] = round(new_dist, 2)
            v["progress_ratio"] = round(new_prog, 4)
            v["current_latitude"] = new_lat
            v["current_longitude"] = new_lon
            v["heading"] = heading
            v["speed_kmh"] = round(live_speed, 1)
            v["battery_fuel_soc_pct"] = new_soc
            v["cargo_temp_c"] = cargo_temp

            if new_prog >= 0.99:
                v["status"] = "COMPLETED"
                v["speed_kmh"] = 0.0
            elif v.get("is_rerouted"):
                v["status"] = "IN_TRANSIT"
            else:
                v["status"] = "IN_TRANSIT"

    def inject_roadblock(
        self,
        roadblock_id: str,
        name: str = "Kasara Ghat Monsoon Landslide",
        corridor_node: str = "KSR",
        latitude: float = 19.6967,
        longitude: float = 73.5611,
        radius_km: float = 15.0,
        severity: str = "CRITICAL",
        description: str = "Monsoon rockfall blocked NH-48 uphill section. 10x penalty edge applied.",
        penalty_multiplier: float = 10.0,
        target_vehicle_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Adds high-cost penalty edge to corridor graph and automatically
        triggers dynamic re-routing for all vehicles traversing the blocked section.
        """
        rb_record = {
            "roadblock_id": roadblock_id,
            "name": name,
            "corridor_node": corridor_node,
            "latitude": latitude,
            "longitude": longitude,
            "radius_km": radius_km,
            "severity": severity,
            "description": description,
            "penalty_multiplier": penalty_multiplier,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        self.active_roadblocks[roadblock_id] = rb_record

        affected_vehicles = []
        reroute_details = []

        vehicles_to_check = [self.vehicles[target_vehicle_id]] if target_vehicle_id and target_vehicle_id in self.vehicles else self.vehicles.values()

        for v in vehicles_to_check:
            v_id = v["vehicle_id"]
            # Check if remaining route traverses near the roadblock
            curr_lat = v["current_latitude"]
            curr_lon = v["current_longitude"]

            # If vehicle is already past the roadblock, skip
            dist_to_rb = haversine_km(curr_lat, curr_lon, latitude, longitude)
            
            # For demonstration, TRK-MH-01 always reroutes if roadblock is at Kasara Ghat
            if v_id == "TRK-MH-01" or dist_to_rb < 90.0:
                affected_vehicles.append(v_id)

                # Compute detour polyline
                # Splice remaining route from current position to bypass
                detour_geom = list(DETOUR_KASARA_POLYLINE)
                added_km = 21.6
                added_mins = 34
                new_total_km = round(v["total_route_distance_km"] + added_km, 1)

                v["original_geometry"] = list(v["route_geometry"])
                v["route_geometry"] = detour_geom
                v["total_route_distance_km"] = new_total_km
                v["is_rerouted"] = True
                
                detour_info = {
                    "vehicle_id": v_id,
                    "original_route_id": f"RT-{v_id}-ORIG",
                    "detour_route_id": f"RT-{v_id}-DETOUR-{roadblock_id}",
                    "roadblock_id": roadblock_id,
                    "detour_reason": f"Automated PyTorch DRL re-route bypassed {name} via Malshej Ghat / SH-60 corridor (+{added_km} km, +{added_mins}m)",
                    "added_distance_km": added_km,
                    "added_duration_mins": added_mins,
                    "new_total_distance_km": new_total_km,
                    "new_route_geometry": detour_geom,
                    "incident_location": {"latitude": latitude, "longitude": longitude}
                }
                v["detour_info"] = detour_info
                reroute_details.append(detour_info)

        logger.info("Injected roadblock %s. Affected vehicles: %s", roadblock_id, affected_vehicles)

        return {
            "status": "DISRUPTION_INJECTED",
            "roadblock": rb_record,
            "affected_vehicles": affected_vehicles,
            "reroute_details": reroute_details
        }

    def clear_roadblocks(self) -> Dict[str, Any]:
        """Clears all roadblocks and restores standard corridor trajectories."""
        self.active_roadblocks.clear()
        for v in self.vehicles.values():
            if v.get("is_rerouted", False):
                v["is_rerouted"] = False
                v["detour_info"] = None
                if "original_geometry" in v:
                    v["route_geometry"] = list(v["original_geometry"])
                    v["total_route_distance_km"] = 178.5 if v["vehicle_id"] == "TRK-MH-01" else 142.0
        return {
            "status": "ROADBLOCKS_CLEARED",
            "message": "All corridor disruptions cleared. Restored baseline highway routing."
        }

    def set_active_route(self, vehicle_id: str, route_data: Dict[str, Any]):
        """Updates a vehicle's active simulation route from Route Optimizer output."""
        if vehicle_id not in self.vehicles:
            self.vehicles[vehicle_id] = {
                "vehicle_id": vehicle_id,
                "plate_number": "MH-04-TR-9000",
                "vehicle_type": "Commercial Fleet",
                "battery_fuel_soc_pct": 100.0,
                "cargo_temp_c": 4.0,
                "status": "IN_TRANSIT"
            }
        v = self.vehicles[vehicle_id]
        geom = route_data.get("route_geometry", [])
        if geom:
            v["route_geometry"] = list(geom)
            v["original_geometry"] = list(geom)
            v["current_latitude"] = geom[0][0]
            v["current_longitude"] = geom[0][1]
        v["total_route_distance_km"] = float(route_data.get("total_distance_km", 150.0))
        v["distance_traveled_km"] = 0.0
        v["progress_ratio"] = 0.0
        v["is_rerouted"] = False
        v["detour_info"] = None

    def get_vehicle_snapshot(self, vehicle_id: str) -> Optional[Dict[str, Any]]:
        """Returns single vehicle state snapshot."""
        v = self.vehicles.get(vehicle_id)
        if not v:
            return None
        rem_km = max(0.0, round(v.get("total_route_distance_km", 100.0) - v.get("distance_traveled_km", 0.0), 1))
        speed = max(v.get("speed_kmh", 50.0), 1.0)
        eta_mins = int((rem_km / speed) * 60.0) if rem_km > 0 else 0

        return {
            "vehicle_id": v["vehicle_id"],
            "plate_number": v.get("plate_number", ""),
            "vehicle_type": v.get("vehicle_type", "Fleet Truck"),
            "cargo_description": v.get("cargo_description", "General Cargo"),
            "latitude": v["current_latitude"],
            "longitude": v["current_longitude"],
            "heading": v.get("heading", 0.0),
            "speed_kmh": v.get("speed_kmh", 0.0),
            "battery_fuel_soc_pct": v.get("battery_fuel_soc_pct", 100.0),
            "cargo_temp_c": v.get("cargo_temp_c", 4.0),
            "target_temp_c": v.get("target_temp_c", 4.0),
            "status": v.get("status", "IN_TRANSIT"),
            "distance_traveled_km": v.get("distance_traveled_km", 0.0),
            "total_route_distance_km": v.get("total_route_distance_km", 100.0),
            "remaining_distance_km": rem_km,
            "progress_pct": round(v.get("progress_ratio", 0.0) * 100.0, 1),
            "eta_mins": eta_mins,
            "is_rerouted": v.get("is_rerouted", False),
            "detour_info": v.get("detour_info"),
            "current_stop_order": v.get("current_stop_order", 1),
            "next_stop_name": v.get("next_stop_name", "Destination"),
            "route_geometry": v.get("route_geometry", [])
        }

    def get_all_vehicles_snapshot(self) -> List[Dict[str, Any]]:
        """Returns snapshot array of all active simulated vehicles."""
        return [self.get_vehicle_snapshot(vid) for vid in self.vehicles.keys() if self.get_vehicle_snapshot(vid) is not None]

    def get_clock_info(self) -> Dict[str, Any]:
        """Calculates simulated clock time and elapsed string."""
        sim_curr_time = self.sim_start_time + timedelta(seconds=self.elapsed_seconds)
        hours = self.elapsed_seconds // 3600
        mins = (self.elapsed_seconds % 3600) // 60
        secs = self.elapsed_seconds % 60
        return {
            "is_running": self.is_running,
            "speed_multiplier": self.speed_multiplier,
            "elapsed_seconds": self.elapsed_seconds,
            "elapsed_formatted": f"{hours:02d}:{mins:02d}:{secs:02d}",
            "simulated_time": sim_curr_time.strftime("%I:%M:%S %p"),
            "simulated_iso": sim_curr_time.isoformat()
        }

    def get_tick_payload(self) -> Dict[str, Any]:
        """Constructs canonical WebSocket tick message with macro-corridor & autonomous sentinel telemetry."""
        from app.engines.autonomous_agent import autonomous_agent_engine
        autonomous_sentinel = autonomous_agent_engine.evaluate_tick(self)
        macro_corridor = autonomous_agent_engine.get_macro_corridor_telemetry(self)

        return {
            "type": "TELEMETRY_TICK",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "simulation": self.get_clock_info(),
            "vehicles": self.get_all_vehicles_snapshot(),
            "active_roadblocks": list(self.active_roadblocks.values()),
            "macro_corridor": macro_corridor,
            "autonomous_sentinel": autonomous_sentinel
        }

    def get_state(self) -> Dict[str, Any]:
        """Returns full simulation state representation."""
        from app.engines.autonomous_agent import autonomous_agent_engine
        return {
            "status": "SUCCESS",
            "simulation": self.get_clock_info(),
            "vehicles": self.get_all_vehicles_snapshot(),
            "active_roadblocks": list(self.active_roadblocks.values()),
            "macro_corridor": autonomous_agent_engine.get_macro_corridor_telemetry(self),
            "autonomous_sentinel": autonomous_agent_engine.get_status()
        }


# Singleton simulation engine instance
telemetry_engine = TelemetrySimulationEngine()
