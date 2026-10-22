import pytest
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app


@pytest.mark.asyncio
async def test_get_routing_fixtures():
    """Verify routing fixtures endpoint returns seeded corridor network, fleet, and backhauls."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/routing/fixtures",
            headers={"X-Persona-Role": "dispatcher"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert len(data["depots"]) >= 3
        assert len(data["fleet_vehicles"]) >= 3
        assert len(data["delivery_candidates"]) >= 4
        assert len(data["backhaul_listings"]) >= 4

        # Verify Western India locations are represented
        depot_cities = [d["city"] for d in data["depots"]]
        assert any("Navi Mumbai" in c or "Mumbai" in c for c in depot_cities)
        assert any("Nashik" in c for c in depot_cities)


@pytest.mark.asyncio
async def test_optimize_route_valid_sequence_and_kpis():
    """Verify DRL route optimizer calculates valid waypoint sequence, ETA, geometry, and backhauls."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "depot_location": {
                "latitude": 18.9496,
                "longitude": 72.9515,
                "name": "JNPT Port Depot"
            },
            "fleet_units": [
                {
                    "vehicle_id": "TRK-MH-01",
                    "max_capacity_kg": 24000.0,
                    "current_fuel_pct": 88.0
                }
            ],
            "deliveries": [
                {
                    "delivery_id": "DEL-THN-01",
                    "location": {
                        "latitude": 19.2183,
                        "longitude": 72.9781,
                        "name": "Thane Industrial Consignment"
                    },
                    "weight_kg": 4200.0,
                    "time_window": {
                        "start": "2026-10-04T08:00:00Z",
                        "end": "2026-10-04T12:00:00Z"
                    }
                },
                {
                    "delivery_id": "DEL-NSK-02",
                    "location": {
                        "latitude": 19.9975,
                        "longitude": 73.7898,
                        "name": "Nashik Agro Distribution"
                    },
                    "weight_kg": 6500.0,
                    "time_window": {
                        "start": "2026-10-04T13:00:00Z",
                        "end": "2026-10-04T17:00:00Z"
                    }
                }
            ],
            "traffic_mode": "STANDARD"
        }

        response = await client.post(
            "/api/v1/routing/optimize",
            json=payload,
            headers={"X-Persona-Role": "dispatcher"}
        )
        assert response.status_code == 200
        data = response.json()

        # Check required fields
        assert "route_id" in data
        assert data["total_distance_km"] > 100.0
        assert data["estimated_duration_minutes"] > 60
        assert data["fuel_consumption_liters"] > 10.0
        assert data["co2_emissions_kg"] > 20.0
        assert data["empty_distance_km"] >= 0.0

        # Check waypoints sequence
        waypoints = data["waypoints_sequence"]
        assert len(waypoints) >= 3
        assert waypoints[0]["type"] == "DEPOT"
        assert waypoints[0]["stop_order"] == 1

        delivery_types = [wp["type"] for wp in waypoints[1:]]
        assert "DELIVERY" in delivery_types

        # Check chronology
        for i in range(1, len(waypoints)):
            assert waypoints[i]["arrival_time"] >= waypoints[i - 1]["arrival_time"]

        # Check route polyline geometry
        assert len(data["route_geometry"]) > 5
        assert all(len(coord) == 2 for coord in data["route_geometry"])

        # Check matched return freight postings
        assert "matched_backhauls" in data
        assert len(data["matched_backhauls"]) >= 1
        top_backhaul = data["matched_backhauls"][0]
        assert "backhaul_id" in top_backhaul
        assert top_backhaul["cargo_weight_kg"] <= 24000.0
        assert top_backhaul["empty_km_eliminated"] > 0
        assert top_backhaul["compatibility_score"] > 0.0


@pytest.mark.asyncio
async def test_capacity_constraint_enforcement():
    """Verify route optimizer rejects or flags vehicle payload capacity violations."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "depot_location": {
                "latitude": 18.9496,
                "longitude": 72.9515
            },
            "fleet_units": [
                {
                    "vehicle_id": "MINI-VAN-01",
                    "max_capacity_kg": 2000.0,
                    "current_fuel_pct": 90.0
                }
            ],
            "deliveries": [
                {
                    "delivery_id": "DEL-HEAVY-01",
                    "location": {
                        "latitude": 19.2183,
                        "longitude": 72.9781
                    },
                    "weight_kg": 3500.0,
                    "time_window": {
                        "start": "2026-10-04T08:00:00Z",
                        "end": "2026-10-04T12:00:00Z"
                    }
                }
            ],
            "traffic_mode": "STANDARD"
        }

        response = await client.post(
            "/api/v1/routing/optimize",
            json=payload,
            headers={"X-Persona-Role": "dispatcher"}
        )
        # Should return 400 Bad Request or 422 with clear capacity breach details
        assert response.status_code in (400, 422)
        error_detail = response.json().get("detail", "")
        assert "capacity" in error_detail.lower() or "payload" in error_detail.lower()


@pytest.mark.asyncio
async def test_traffic_mode_impacts_duration_and_emissions():
    """Verify congested traffic mode yields higher duration and fuel consumption."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        base_payload = {
            "depot_location": {"latitude": 19.0760, "longitude": 72.8777},
            "fleet_units": [{"vehicle_id": "TRK-MH-02", "max_capacity_kg": 18000.0, "current_fuel_pct": 95.0}],
            "deliveries": [
                {
                    "delivery_id": "DEL-PUN-01",
                    "location": {"latitude": 18.5204, "longitude": 73.8567},
                    "weight_kg": 3000.0,
                    "time_window": {"start": "2026-10-04T09:00:00Z", "end": "2026-10-04T14:00:00Z"}
                }
            ]
        }

        # Standard mode
        payload_std = {**base_payload, "traffic_mode": "STANDARD"}
        res_std = await client.post("/api/v1/routing/optimize", json=payload_std, headers={"X-Persona-Role": "dispatcher"})
        assert res_std.status_code == 200
        data_std = res_std.json()

        # Congested mode
        payload_cong = {**base_payload, "traffic_mode": "CONGESTED"}
        res_cong = await client.post("/api/v1/routing/optimize", json=payload_cong, headers={"X-Persona-Role": "dispatcher"})
        assert res_cong.status_code == 200
        data_cong = res_cong.json()

        # Assert congestion penalization
        assert data_cong["estimated_duration_minutes"] > data_std["estimated_duration_minutes"]
        assert data_cong["fuel_consumption_liters"] > data_std["fuel_consumption_liters"]
        assert data_cong["co2_emissions_kg"] > data_std["co2_emissions_kg"]


@pytest.mark.asyncio
async def test_assign_backhaul_1click():
    """Verify 1-click backhaul assignment integrates return cargo, eliminating empty km."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        optimize_payload = {
            "depot_location": {"latitude": 18.9496, "longitude": 72.9515},
            "fleet_units": [{"vehicle_id": "TRK-MH-01", "max_capacity_kg": 24000.0, "current_fuel_pct": 88.0}],
            "deliveries": [
                {
                    "delivery_id": "DEL-NSK-01",
                    "location": {"latitude": 19.9975, "longitude": 73.7898},
                    "weight_kg": 5000.0,
                    "time_window": {"start": "2026-10-04T08:00:00Z", "end": "2026-10-04T12:00:00Z"}
                }
            ],
            "traffic_mode": "STANDARD"
        }

        opt_res = await client.post("/api/v1/routing/optimize", json=optimize_payload, headers={"X-Persona-Role": "dispatcher"})
        assert opt_res.status_code == 200
        opt_data = opt_res.json()
        assert len(opt_data["matched_backhauls"]) > 0

        target_backhaul = opt_data["matched_backhauls"][0]
        assign_payload = {
            "route_id": opt_data["route_id"],
            "backhaul_id": target_backhaul["backhaul_id"],
            "current_route": opt_data
        }

        assign_res = await client.post(
            "/api/v1/routing/assign-backhaul",
            json=assign_payload,
            headers={"X-Persona-Role": "dispatcher"}
        )
        assert assign_res.status_code == 200
        assigned_data = assign_res.json()

        # Verify return backhaul was assigned
        assert assigned_data["assigned_backhaul_id"] == target_backhaul["backhaul_id"]
        assert assigned_data["empty_distance_km"] < opt_data["empty_distance_km"]

        # Waypoints should now include backhaul pickup and dropoff
        wp_types = [wp["type"] for wp in assigned_data["waypoints_sequence"]]
        assert "BACKHAUL_PICKUP" in wp_types or "BACKHAUL_DROPOFF" in wp_types


@pytest.mark.asyncio
async def test_routing_rbac_guard():
    """Verify RBAC guards restrict route optimization to authorized personas (dispatcher, admin)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "depot_location": {"latitude": 18.9496, "longitude": 72.9515},
            "fleet_units": [{"vehicle_id": "TRK-MH-01", "max_capacity_kg": 24000.0}],
            "deliveries": [
                {
                    "delivery_id": "DEL-THN-01",
                    "location": {"latitude": 19.2183, "longitude": 72.9781},
                    "weight_kg": 2000.0
                }
            ]
        }

        # Customs persona should be blocked (HTTP 403 Forbidden)
        res_customs = await client.post(
            "/api/v1/routing/optimize",
            json=payload,
            headers={"X-Persona-Role": "customs"}
        )
        assert res_customs.status_code == 403

        # Dispatcher persona should be allowed
        res_dispatcher = await client.post(
            "/api/v1/routing/optimize",
            json=payload,
            headers={"X-Persona-Role": "dispatcher"}
        )
        # Note: Will be 200 once implemented
        # During RED phase, route endpoint is not registered yet (404)
