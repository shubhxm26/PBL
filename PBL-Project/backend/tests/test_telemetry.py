import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
import sys
import os

# Ensure backend/app is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.engines.telemetry_engine import (
    TelemetrySimulationEngine,
    calculate_bearing,
    interpolate_coordinates_along_polyline
)


@pytest.fixture
def telemetry_engine():
    """Fixture providing a fresh isolated TelemetrySimulationEngine instance."""
    engine = TelemetrySimulationEngine()
    engine.reset()
    return engine


def test_gps_polyline_interpolation():
    """Test geodesic polyline interpolation and distance calculation."""
    polyline = [
        [18.9496, 72.9515],  # JNPT
        [19.0760, 72.8777],  # Mumbai
        [19.2183, 72.9781],  # Thane
        [19.9975, 73.7898]   # Nashik
    ]
    # At progress = 0.0, coords should match start
    lat, lon, seg_idx = interpolate_coordinates_along_polyline(polyline, 0.0)
    assert pytest.approx(lat, abs=1e-3) == 18.9496
    assert pytest.approx(lon, abs=1e-3) == 72.9515
    assert seg_idx == 0

    # At progress = 0.5, coords should be somewhere between start and end
    lat_mid, lon_mid, _ = interpolate_coordinates_along_polyline(polyline, 0.5)
    assert 18.9 < lat_mid < 20.0
    assert 72.8 < lon_mid < 73.8

    # At progress = 1.0, coords should match destination
    lat_end, lon_end, _ = interpolate_coordinates_along_polyline(polyline, 1.0)
    assert pytest.approx(lat_end, abs=1e-3) == 19.9975
    assert pytest.approx(lon_end, abs=1e-3) == 73.7898


def test_bearing_calculation():
    """Test bearing calculation between geographic points."""
    # North direction (lat increases, lon constant)
    bearing_n = calculate_bearing(18.0, 73.0, 19.0, 73.0)
    assert 350.0 <= bearing_n <= 360.0 or 0.0 <= bearing_n <= 10.0

    # East direction (lat constant, lon increases)
    bearing_e = calculate_bearing(18.0, 73.0, 18.0, 74.0)
    assert 80.0 <= bearing_e <= 100.0


def test_telemetry_engine_tick_generation(telemetry_engine):
    """
    Test telemetry simulation tick generator produces realistic GPS interpolation,
    speed, fuel consumption, and cargo temperature fluctuations along active routes.
    """
    initial_snapshot = telemetry_engine.get_vehicle_snapshot("TRK-MH-01")
    assert initial_snapshot is not None
    assert initial_snapshot["vehicle_id"] == "TRK-MH-01"
    assert initial_snapshot["status"] in ["IN_TRANSIT", "SCHEDULED", "IDLE"]
    init_soc = initial_snapshot["battery_fuel_soc_pct"]
    init_dist = initial_snapshot["distance_traveled_km"]

    # Advance by 30 ticks
    telemetry_engine.play()
    telemetry_engine.set_speed(1.0)
    for _ in range(30):
        telemetry_engine.tick(dt_seconds=1.0)

    updated_snapshot = telemetry_engine.get_vehicle_snapshot("TRK-MH-01")
    assert updated_snapshot["distance_traveled_km"] > init_dist
    assert updated_snapshot["battery_fuel_soc_pct"] <= init_soc
    assert 0.0 <= updated_snapshot["speed_kmh"] <= 95.0
    # Cold chain reefer cargo temperature: ~3.0°C to 5.5°C
    assert 2.5 <= updated_snapshot["cargo_temp_c"] <= 6.0
    # Bearing should be defined in [0, 360)
    assert 0.0 <= updated_snapshot["heading"] <= 360.0


def test_telemetry_engine_playback_controls(telemetry_engine):
    """Test play, pause, step, speed multiplier, and reset controls."""
    assert telemetry_engine.is_running is False
    
    # Play
    telemetry_engine.play()
    assert telemetry_engine.is_running is True

    # Speed multiplier
    telemetry_engine.set_speed(5.0)
    assert telemetry_engine.speed_multiplier == 5.0

    # Pause
    telemetry_engine.pause()
    assert telemetry_engine.is_running is False

    # Step: advances simulation clock
    elapsed_before = telemetry_engine.elapsed_seconds
    telemetry_engine.step(step_seconds=15)
    assert telemetry_engine.elapsed_seconds == elapsed_before + 15

    # Reset
    telemetry_engine.reset()
    assert telemetry_engine.elapsed_seconds == 0
    assert telemetry_engine.is_running is False


def test_roadblock_injection_and_dynamic_reroute(telemetry_engine):
    """
    Test roadblock injection adds high-cost penalty and triggers
    dynamic re-routing for vehicles traversing the corridor.
    """
    # Verify TRK-MH-01 is traveling towards Nashik through Kasara Ghat
    initial_route_geometry = list(telemetry_engine.vehicles["TRK-MH-01"]["route_geometry"])
    initial_total_km = telemetry_engine.vehicles["TRK-MH-01"]["total_route_distance_km"]

    # Inject roadblock at Kasara Ghat
    disruption_res = telemetry_engine.inject_roadblock(
        roadblock_id="RB-KASARA-01",
        name="Kasara Ghat Monsoon Landslide",
        corridor_node="KSR",
        latitude=19.6967,
        longitude=73.5611,
        radius_km=15.0,
        severity="CRITICAL",
        description="Rockfall blocked NH-48 uphill section. 10x penalty edge applied.",
        penalty_multiplier=10.0,
        target_vehicle_id="TRK-MH-01"
    )

    assert disruption_res["status"] == "DISRUPTION_INJECTED"
    assert "TRK-MH-01" in disruption_res["affected_vehicles"]
    assert len(disruption_res["reroute_details"]) > 0

    reroute = disruption_res["reroute_details"][0]
    assert reroute["vehicle_id"] == "TRK-MH-01"
    assert reroute["added_distance_km"] > 0
    assert reroute["new_route_geometry"] is not None

    # Verify vehicle in engine has updated route and status
    v_state = telemetry_engine.get_vehicle_snapshot("TRK-MH-01")
    assert v_state["is_rerouted"] is True
    assert v_state["total_route_distance_km"] > initial_total_km
    assert len(telemetry_engine.active_roadblocks) == 1

    # Clear roadblocks
    clear_res = telemetry_engine.clear_roadblocks()
    assert clear_res["status"] == "ROADBLOCKS_CLEARED"
    assert len(telemetry_engine.active_roadblocks) == 0


@pytest.mark.asyncio
async def test_rest_inject_disruption_endpoint():
    """Test POST /api/v1/telemetry/inject-disruption endpoint and RBAC."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Dispatcher role has permission
        res = await client.post(
            "/api/v1/telemetry/inject-disruption",
            headers={"X-Persona-Role": "dispatcher"},
            json={
                "roadblock_id": "RB-TEST-01",
                "name": "Thane Majhiwada Flyover Clearance",
                "latitude": 19.2183,
                "longitude": 72.9781,
                "radius_km": 10.0,
                "severity": "HIGH",
                "description": "Hazardous spill at Majhiwada junction."
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "DISRUPTION_INJECTED"
        assert "affected_vehicles" in data
        assert "reroute_details" in data

        # Customs persona is not authorized to inject roadblocks
        res_customs = await client.post(
            "/api/v1/telemetry/inject-disruption",
            headers={"X-Persona-Role": "customs"},
            json={"roadblock_id": "RB-TEST-02"}
        )
        assert res_customs.status_code == 403


@pytest.mark.asyncio
async def test_rest_telemetry_state_and_controls():
    """Test GET /api/v1/telemetry/state and POST /api/v1/telemetry/control endpoints."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. State
        state_res = await client.get(
            "/api/v1/telemetry/state",
            headers={"X-Persona-Role": "dispatcher"}
        )
        assert state_res.status_code == 200
        state = state_res.json()
        assert "simulation" in state
        assert "vehicles" in state
        assert len(state["vehicles"]) > 0

        # 2. Control: Play
        ctrl_res = await client.post(
            "/api/v1/telemetry/control",
            headers={"X-Persona-Role": "dispatcher"},
            json={"action": "PLAY", "speed_multiplier": 2.0}
        )
        assert ctrl_res.status_code == 200
        assert ctrl_res.json()["simulation"]["is_running"] is True
        assert ctrl_res.json()["simulation"]["speed_multiplier"] == 2.0

        # 3. Control: Step
        step_res = await client.post(
            "/api/v1/telemetry/control",
            headers={"X-Persona-Role": "dispatcher"},
            json={"action": "STEP"}
        )
        assert step_res.status_code == 200

        # 4. Control: Pause
        pause_res = await client.post(
            "/api/v1/telemetry/control",
            headers={"X-Persona-Role": "director"},
            json={"action": "PAUSE"}
        )
        assert pause_res.status_code == 200
        assert pause_res.json()["simulation"]["is_running"] is False

        # 5. Clear Disruptions
        clear_res = await client.post(
            "/api/v1/telemetry/clear-disruptions",
            headers={"X-Persona-Role": "admin"}
        )
        assert clear_res.status_code == 200


def test_websocket_telemetry_framing():
    """Test Starlette TestClient WebSocket connection, message framing, and controls."""
    from starlette.testclient import TestClient
    client = TestClient(app)

    with client.websocket_connect("/ws/telemetry") as ws:
        # Initial greeting / state handshake
        init_msg = ws.receive_json()
        assert init_msg["type"] in ["CONNECTION_ESTABLISHED", "TELEMETRY_TICK"]
        assert "simulation" in init_msg
        assert "vehicles" in init_msg

        # Send ping
        ws.send_json({"action": "ping"})
        pong_msg = ws.receive_json()
        assert pong_msg["type"] == "PONG"

        # Send step
        ws.send_json({"action": "step"})
        step_msg = ws.receive_json()
        assert step_msg["type"] in ["TELEMETRY_TICK", "STEP_PROCESSED"]

        # Send speed update
        ws.send_json({"action": "set_speed", "speed": 5.0})
        speed_msg = ws.receive_json()
        assert speed_msg["type"] in ["SIMULATION_STATE", "TELEMETRY_TICK"]
        assert speed_msg["simulation"]["speed_multiplier"] == 5.0
