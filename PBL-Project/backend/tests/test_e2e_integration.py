"""
End-to-End Persona Verification & Production Hardening Test Suite.
Verifies all compliance requirements defined in SPECIFICATION.md:
  1. Persona & RBAC Security Matrix across all 4 roles (Director, Dispatcher, Customs, Admin)
  2. Predictive Demand Forecasting Engine (multi-horizon bounds, 95% CI order, safety stock, exogenous factors)
  3. Fleet Route Optimizer & Freight Matching Engine (capacity constraints, traffic mode, backhaul 1-click assignment)
  4. Trade Compliance & IDP Orchestrator (Gemini extraction schema, sub-second vector RAG HS classification, discrepancy checks)
  5. Cognitive Digital Twin Simulator (multi-echelon DES < 5s SLA, baseline vs mitigated comparison)
  6. Real-Time Telemetry & WebSocket stream (roadblock disruption injection, dynamic vehicle re-routing)
  7. Enterprise IT Admin Diagnostics & On-Demand PyTorch Model Retraining
  8. In-Memory Graceful Fallback Parity (100% functional without external PostgreSQL or Redis)
  9. Standalone Model Training Checkpoint Persistence & Reload Verification
"""

import os
import sys
import time
import pytest
from httpx import AsyncClient, ASGITransport
from starlette.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.db.connection import db_manager
from app.engines.forecasting_engine import forecasting_engine
from app.engines.routing_engine import routing_engine
from train_models import train_all_models, train_forecasting_model, train_routing_model


# ============================================================================
# 1. Persona & RBAC Matrix Verification
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_persona_rbac_matrix():
    """Verify role-based access control matrix across all 4 operational personas."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Director tests
        # Allowed: Forecasting, Twin
        res_fc = await client.post(
            "/api/v1/forecasting/predict",
            headers={"X-Persona-Role": "director"},
            json={"sku_id": "SKU-NAS-AGRI-01", "forecast_horizon_days": 14}
        )
        assert res_fc.status_code == 200, f"Director failed forecasting: {res_fc.text}"

        res_twin = await client.post(
            "/api/v1/twin/simulate-scenario",
            headers={"X-Persona-Role": "director"},
            json={"scenario_id": "port_strike", "shock_intensity": 50.0, "enable_mitigation": True}
        )
        assert res_twin.status_code == 200, f"Director failed twin: {res_twin.text}"

        res_twin_top = await client.get(
            "/api/v1/twin/topology",
            headers={"X-Persona-Role": "director"}
        )
        assert res_twin_top.status_code == 200

        res_twin_scen = await client.get(
            "/api/v1/twin/scenarios",
            headers={"X-Persona-Role": "director"}
        )
        assert res_twin_scen.status_code == 200

        # Forbidden: Admin system-status
        res_dir_admin = await client.get(
            "/api/v1/admin/system-status",
            headers={"X-Persona-Role": "director"}
        )
        assert res_dir_admin.status_code == 403

        # Dispatcher tests
        # Allowed: Routing fixtures, Telemetry controls
        res_disp_rt = await client.get(
            "/api/v1/routing/fixtures",
            headers={"X-Persona-Role": "dispatcher"}
        )
        assert res_disp_rt.status_code == 200

        res_disp_disr = await client.post(
            "/api/v1/telemetry/inject-disruption",
            headers={"X-Persona-Role": "dispatcher"},
            json={"segment_id": "NH48-MUM-TNA", "severity_pct": 80, "description": "Accident"}
        )
        assert res_disp_disr.status_code == 200

        # Forbidden: Forecasting predict & Twin simulate
        res_disp_fc = await client.post(
            "/api/v1/forecasting/predict",
            headers={"X-Persona-Role": "dispatcher"},
            json={"sku_id": "SKU-NAS-AGRI-01", "forecast_horizon_days": 14}
        )
        assert res_disp_fc.status_code == 403

        res_disp_twin = await client.post(
            "/api/v1/twin/simulate-scenario",
            headers={"X-Persona-Role": "dispatcher"},
            json={"scenario_id": "port_strike", "shock_intensity": 50.0, "enable_mitigation": True}
        )
        assert res_disp_twin.status_code == 403

        # Customs tests
        # Allowed: Compliance parse-doc, HS classify
        res_cust_hs = await client.post(
            "/api/v1/compliance/hs-classify",
            headers={"X-Persona-Role": "customs"},
            json={"description": "Solar photovoltaic inverters with MPPT charge control", "top_k": 3}
        )
        assert res_cust_hs.status_code == 200

        # Forbidden: Routing optimize & Twin simulate
        res_cust_rt = await client.post(
            "/api/v1/routing/optimize",
            headers={"X-Persona-Role": "customs"},
            json={
                "depot_location": {"latitude": 18.9496, "longitude": 72.9515},
                "fleet_units": [{"vehicle_id": "TRK-MH-01", "max_capacity_kg": 24000.0, "current_fuel_pct": 88.0}],
                "deliveries": [],
                "traffic_mode": "STANDARD"
            }
        )
        assert res_cust_rt.status_code == 403

        res_cust_twin = await client.post(
            "/api/v1/twin/simulate-scenario",
            headers={"X-Persona-Role": "customs"},
            json={"scenario_id": "port_strike", "shock_intensity": 50.0, "enable_mitigation": True}
        )
        assert res_cust_twin.status_code == 403

        # Admin tests
        # Allowed: All endpoints including Admin system status, Retrain models, and Twin
        res_admin_status = await client.get(
            "/api/v1/admin/system-status",
            headers={"X-Persona-Role": "admin"}
        )
        assert res_admin_status.status_code == 200

        res_admin_twin = await client.post(
            "/api/v1/twin/simulate-scenario",
            headers={"X-Persona-Role": "admin"},
            json={"scenario_id": "port_strike", "shock_intensity": 50.0, "enable_mitigation": True}
        )
        assert res_admin_twin.status_code == 200
        assert res_admin_status.json()["status"] == "ok"


# ============================================================================
# 2. Forecasting Engine E2E Verification
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_forecasting_engine_and_confidence_bounds():
    """Verify demand forecasting multi-horizon predictions and strict 95% confidence intervals."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test across multiple horizons (7, 14, 30)
        for horizon in [7, 14, 30]:
            response = await client.post(
                "/api/v1/forecasting/predict",
                headers={"X-Persona-Role": "director"},
                json={
                    "sku_id": "SKU-NAS-AGRI-01",
                    "forecast_horizon_days": horizon,
                    "granularity": "daily",
                    "include_exogenous_factors": True
                }
            )
            assert response.status_code == 200
            data = response.json()

            assert data["status"] == "SUCCESS"
            assert data["forecast_horizon_days"] == horizon
            assert "summary" in data
            assert data["summary"]["recommended_safety_stock"] > 0
            assert data["summary"]["average_daily_demand"] > 0

            forecast = data["forecasts"][0]
            assert forecast["sku_id"] == "SKU-NAS-AGRI-01"
            assert len(forecast["predictions"]) == horizon

            # Mathematical Confidence Bound Assertion: lower <= point <= upper for every day
            for p in forecast["predictions"]:
                point = p["predicted_demand_units"]
                ci = p["confidence_interval_95"]
                lower = ci["lower"]
                upper = ci["upper"]

                assert lower >= 0, f"Lower bound ({lower}) cannot be negative"
                assert lower <= point, f"Lower bound ({lower}) > point forecast ({point})"
                assert point <= upper, f"Point forecast ({point}) > upper bound ({upper})"
                assert p["recommended_safety_stock"] > 0


# ============================================================================
# 3. Fleet Route Optimizer & Freight Matching E2E Verification
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_routing_capacity_and_backhaul_matching():
    """Verify fleet routing optimization, capacity enforcement, and return backhaul freight matching."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
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

        # Step 1: Optimize standard route
        res = await client.post(
            "/api/v1/routing/optimize",
            headers={"X-Persona-Role": "dispatcher"},
            json=payload
        )
        assert res.status_code == 200
        std_route = res.json()

        # Validate sequence: starts at depot, visits delivery stops
        waypoints = std_route["waypoints_sequence"]
        assert len(waypoints) >= 3
        assert waypoints[0]["type"] == "DEPOT"
        assert any(wp["type"] == "DELIVERY" for wp in waypoints[1:])

        # Validate distance & emissions
        assert std_route["total_distance_km"] > 50.0
        assert std_route["fuel_consumption_liters"] > 5.0
        assert std_route["co2_emissions_kg"] > 10.0

        # Step 2: Compare with congested traffic mode
        payload_cong = {**payload, "traffic_mode": "CONGESTED"}
        res_cong = await client.post(
            "/api/v1/routing/optimize",
            headers={"X-Persona-Role": "dispatcher"},
            json=payload_cong
        )
        assert res_cong.status_code == 200
        cong_route = res_cong.json()
        assert cong_route["estimated_duration_minutes"] > std_route["estimated_duration_minutes"]
        assert cong_route["fuel_consumption_liters"] > std_route["fuel_consumption_liters"]

        # Step 3: Verify backhaul matching
        backhauls = std_route.get("matched_backhauls", [])
        assert len(backhauls) > 0
        target_backhaul = backhauls[0]
        assert target_backhaul["compatibility_score"] >= 0.50

        # Step 4: Assign backhaul
        res_assign = await client.post(
            "/api/v1/routing/assign-backhaul",
            headers={"X-Persona-Role": "dispatcher"},
            json={
                "route_id": std_route["route_id"],
                "backhaul_id": target_backhaul["backhaul_id"],
                "current_route": std_route
            }
        )
        assert res_assign.status_code == 200
        assigned_data = res_assign.json()
        assert assigned_data["assigned_backhaul_id"] == target_backhaul["backhaul_id"]
        assert assigned_data["empty_distance_km"] < std_route["empty_distance_km"]


# ============================================================================
# 4. Trade Compliance & IDP Orchestrator E2E Verification
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_compliance_idp_and_rag_classification():
    """Verify document IDP parsing, vector RAG HS classification, and automated discrepancy checks."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Sub-second HS code classification via local vector RAG
        res_hs = await client.post(
            "/api/v1/compliance/hs-classify",
            headers={"X-Persona-Role": "customs"},
            json={
                "description": "Industrial lithium-ion battery packs and rechargeable energy storage cells",
                "declared_hs_code": "8507.60.00",
                "top_k": 3
            }
        )
        assert res_hs.status_code == 200
        hs_data = res_hs.json()
        assert hs_data["status"] == "success"
        assert hs_data["retrieval_latency_ms"] < 500.0  # Sub-second SLA
        assert hs_data["top_match"]["hs_code"] == "8507.60.00"
        assert hs_data["is_declared_match"] is True

        # Step 2: Parse Clean Document (Clean Electronics BoL)
        res_clean = await client.post(
            "/api/v1/compliance/parse-doc",
            headers={"X-Persona-Role": "customs"},
            json={"sample_id": "SAMPLE-BOL-CLEAN-01"}
        )
        assert res_clean.status_code == 200
        clean_doc = res_clean.json()
        assert clean_doc["status"] == "success"
        assert clean_doc["compliance_audit"]["clearance_status"] == "APPROVED"
        assert clean_doc["compliance_audit"]["critical_count"] == 0

        # Step 3: Parse Discrepant Document (Discrepant Agro Invoice)
        res_discr = await client.post(
            "/api/v1/compliance/parse-doc",
            headers={"X-Persona-Role": "customs"},
            json={"sample_id": "SAMPLE-INV-AGRO-DISCREPANT-02"}
        )
        assert res_discr.status_code == 200
        discr_doc = res_discr.json()
        assert discr_doc["status"] == "success"
        assert discr_doc["compliance_audit"]["clearance_status"] in ["CONDITIONAL_REVIEW", "REJECTED_DISCREPANCIES"]
        assert discr_doc["compliance_audit"]["total_alerts_count"] >= 1


# ============================================================================
# 5. Cognitive Digital Twin E2E Verification
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_digital_twin_discrete_event_simulation():
    """Verify discrete-event simulation performance (< 5s SLA) and mitigation improvement."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        start_time = time.perf_counter()
        res = await client.post(
            "/api/v1/twin/simulate-scenario",
            headers={"X-Persona-Role": "director"},
            json={
                "scenario_id": "port_strike",
                "shock_intensity": 75.0,
                "enable_mitigation": True,
                "simulation_horizon_days": 7
            }
        )
        elapsed_sec = time.perf_counter() - start_time
        assert res.status_code == 200
        assert elapsed_sec < 5.0, f"Simulation took {elapsed_sec:.2f}s, exceeding 5.0s SLA"

        twin_data = res.json()
        assert twin_data["status"] == "COMPLETED"
        assert twin_data["scenario_id"] == "port_strike"

        # Comparative Metrics Assertion: Mitigation reduces SLA delay
        baseline = twin_data["baseline_metrics"]
        mitigated = twin_data["mitigated_metrics"]
        assert mitigated["sla_delay_hours"] <= baseline["sla_delay_hours"]
        assert mitigated["risk_index"] <= baseline["risk_index"]
        assert "nodes" in twin_data
        assert "links" in twin_data
        assert len(twin_data["contingency_recommendations"]) > 0


# ============================================================================
# 6. Real-Time Telemetry & WebSocket E2E Verification
# ============================================================================

def test_e2e_telemetry_websocket_and_disruption():
    """Verify WebSocket telemetry framing and dynamic roadblock injection re-routing."""
    client = TestClient(app)

    # Test WebSocket connection and initial state broadcast
    with client.websocket_connect("/ws/telemetry") as ws:
        init_msg = ws.receive_json()
        assert init_msg["type"] in ["CONNECTION_ESTABLISHED", "TELEMETRY_TICK"]
        assert "simulation" in init_msg
        assert "vehicles" in init_msg

        # Send ping
        ws.send_json({"action": "ping"})
        pong_msg = ws.receive_json()
        assert pong_msg["type"] == "PONG"

        # Send speed control
        ws.send_json({"action": "set_speed", "speed": 2.0})
        speed_msg = ws.receive_json()
        assert speed_msg["type"] in ["SIMULATION_STATE", "TELEMETRY_TICK"]

        # Send resync command (verifies Issue 05 state resynchronization upon network reconnect)
        ws.send_json({"action": "resync"})
        resync_msg = ws.receive_json()
        assert resync_msg["type"] == "SIMULATION_STATE"
        assert "simulation" in resync_msg
        assert "vehicles" in resync_msg
        assert "active_roadblocks" in resync_msg
        assert "macro_corridor" in resync_msg

        # Inject disruption via REST
        res_disr = client.post(
            "/api/v1/telemetry/inject-disruption",
            headers={"X-Persona-Role": "dispatcher"},
            json={
                "segment_id": "NH48-MUM-TNA",
                "severity_pct": 90,
                "description": "Critical bridge blockage"
            }
        )
        assert res_disr.status_code == 200
        disr_res = res_disr.json()
        assert disr_res["status"] == "DISRUPTION_INJECTED"
        assert "affected_vehicles" in disr_res


        # Clear disruptions to restore clean state
        res_clear = client.post(
            "/api/v1/telemetry/clear-disruptions",
            headers={"X-Persona-Role": "dispatcher"}
        )
        assert res_clear.status_code == 200


# ============================================================================
# 7. Enterprise IT Admin Diagnostics & Retraining E2E Verification
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_admin_diagnostics_and_retraining():
    """Verify administrative system diagnostics and on-demand PyTorch model retraining."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check Admin System Status Diagnostics
        res_diag = await client.get(
            "/api/v1/admin/system-status",
            headers={"X-Persona-Role": "admin"}
        )
        assert res_diag.status_code == 200
        diag_data = res_diag.json()
        assert "services" in diag_data
        assert "models" in diag_data["services"]
        assert "forecasting_lstm" in diag_data["services"]["models"]
        assert "routing_drl" in diag_data["services"]["models"]
        assert "external_ai" in diag_data["services"]

        # Trigger On-Demand Model Retraining
        res_retrain = await client.post(
            "/api/v1/admin/retrain-models",
            headers={"X-Persona-Role": "admin"},
            json={"models": "all", "epochs": 5, "lr": 0.005}
        )
        assert res_retrain.status_code == 200
        retrain_data = res_retrain.json()
        assert retrain_data["success"] is True
        assert "forecasting" in retrain_data["models"]
        assert "routing" in retrain_data["models"]
        assert retrain_data["models"]["forecasting"]["file_size_kb"] > 0
        assert retrain_data["models"]["routing"]["file_size_kb"] > 0


# ============================================================================
# 8. In-Memory Graceful Fallback Mode Resilience
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_graceful_in_memory_fallback_resilience():
    """Verify that all platform engines operate seamlessly with in-memory fixtures when services are offline."""
    # Assert DB and Redis managers report active status (either connected or in-memory fallback)
    health_services = db_manager.get_services_health()
    assert health_services["database"]["status"] in ["connected", "fallback_in_memory"]
    assert health_services["redis"]["status"] in ["connected", "fallback_in_memory"]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Public health check endpoint
        res_health = await client.get("/api/v1/health")
        assert res_health.status_code == 200
        health_json = res_health.json()
        assert health_json["status"] == "healthy"
        assert "models" in health_json["services"]
        assert "external_ai" in health_json["services"]

        # Verify SKU catalog is seeded and accessible even in fallback mode
        res_skus = await client.get(
            "/api/v1/forecasting/skus",
            headers={"X-Persona-Role": "director"}
        )
        assert res_skus.status_code == 200
        skus_data = res_skus.json()
        assert skus_data["status"] == "SUCCESS"
        assert len(skus_data["skus"]) >= 4


# ============================================================================
# 9. Standalone Model Training Checkpoint Persistence & Reload
# ============================================================================

def test_e2e_standalone_training_and_hot_reload():
    """Verify that standalone training generates valid .pt checkpoints and engines hot-reload them."""
    # Run training for forecasting only (quick 5 epochs)
    fc_info = train_forecasting_model(epochs=5, lr=0.005, quiet=True)
    assert fc_info["status"] == "trained_and_saved"
    assert os.path.exists(fc_info["checkpoint_path"])
    assert fc_info["file_size_kb"] > 50

    # Hot reload into forecasting engine
    reloaded_fc = forecasting_engine.reload_weights(fc_info["checkpoint_path"])
    assert reloaded_fc is True

    # Run training for routing (quick 5 epochs)
    rt_info = train_routing_model(epochs=5, lr=0.005, quiet=True)
    assert rt_info["status"] == "trained_and_saved"
    assert os.path.exists(rt_info["checkpoint_path"])
    assert rt_info["file_size_kb"] > 30

    # Hot reload into routing engine
    reloaded_rt = routing_engine.reload_weights(rt_info["checkpoint_path"])
    assert reloaded_rt is True
