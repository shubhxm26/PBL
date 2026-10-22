import os
import sys
import time
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.engines.autonomous_agent import (
    autonomous_agent_engine,
    MODE_AUTONOMOUS,
    MODE_MANUAL,
    RISK_THRESHOLD_CRITICAL,
    RISK_THRESHOLD_NOMINAL
)
from app.engines.telemetry_engine import telemetry_engine

DIRECTOR_HEADERS = {"X-Persona-Role": "director"}
ADMIN_HEADERS = {"X-Persona-Role": "admin"}
CUSTOMS_HEADERS = {"X-Persona-Role": "customs"}
DISPATCHER_HEADERS = {"X-Persona-Role": "dispatcher"}


def test_forecast_bounds_ingestion():
    """
    Assert that the AutonomousAgentEngine ingests PyTorch LSTM multi-horizon
    demand forecast bounds (upper 95% CI) across all multi-echelon nodes.
    """
    autonomous_agent_engine._refresh_forecast_cache(force=True)
    cache = autonomous_agent_engine._forecast_cache

    assert len(cache) >= 5
    for node_id in ["PORT-JNPT-01", "DC-BHW-01", "HUB-THN-01", "DEP-NSK-01", "FC-PUN-01"]:
        assert node_id in cache, f"Node {node_id} missing from forecast cache"
        fc = cache[node_id]
        assert "sku_id" in fc
        assert fc["avg_upper_7d"] > 0
        assert fc["avg_upper_14d"] > 0
        assert fc["total_upper_7d"] > 0
        assert fc["recommended_safety_stock"] > 0


def test_corridor_risk_scoring_under_shock():
    """
    Assert risk scoring algorithm:
    1. Baseline without disruptions produces safe/nominal risk (< 70).
    2. Critical disruption/roadblock causes risk to exceed safe threshold (>= 70).
    """
    # 1. Baseline risk
    baseline_analysis = autonomous_agent_engine.compute_corridor_risk(active_roadblocks=[])
    assert baseline_analysis["risk_index"] < RISK_THRESHOLD_CRITICAL, (
        f"Baseline risk {baseline_analysis['risk_index']} should be < {RISK_THRESHOLD_CRITICAL}"
    )
    assert baseline_analysis["status"] in ["NOMINAL", "ELEVATED"]

    # 2. Injected severe disruption at Kasara Ghat
    critical_roadblock = {
        "roadblock_id": "RB-KASARA-TEST",
        "name": "Kasara Ghat Landslide",
        "latitude": 19.6967,
        "longitude": 73.5611,
        "severity": "CRITICAL",
        "penalty_multiplier": 10.0
    }

    shocked_analysis = autonomous_agent_engine.compute_corridor_risk(
        active_roadblocks=[critical_roadblock],
        custom_demand_factor=1.35
    )

    assert shocked_analysis["risk_index"] >= RISK_THRESHOLD_CRITICAL, (
        f"Shocked risk {shocked_analysis['risk_index']} should be >= {RISK_THRESHOLD_CRITICAL}"
    )
    assert shocked_analysis["status"] == "CRITICAL_INTERVENTION"
    assert shocked_analysis["active_shocks_count"] == 1


def test_autonomous_mitigation_trigger_and_directives():
    """
    Assert that when risk >= 70:
    - In AUTONOMOUS_SENTINEL mode: Directive status is 'DISPATCHED_TO_TMS'.
    - In MANUAL_OPERATOR mode: Directive status is 'PENDING_OPERATOR_APPROVAL'.
    - Decision audit log records all generated events.
    """
    # 1. Test Autonomous mode trigger
    autonomous_agent_engine.mode = MODE_AUTONOMOUS
    critical_roadblocks = [{
        "roadblock_id": "RB-TEST-01",
        "name": "Kasara Ghat Monsoon Obstruction",
        "severity": "CRITICAL",
        "penalty_multiplier": 10.0
    }]

    # Simulate tick under critical shock
    telemetry_engine.active_roadblocks = {"RB-TEST-01": critical_roadblocks[0]}
    autonomous_agent_engine.evaluate_tick(telemetry_engine)

    assert autonomous_agent_engine.risk_index >= RISK_THRESHOLD_CRITICAL
    assert len(autonomous_agent_engine.active_directives) > 0

    latest_directive = autonomous_agent_engine.active_directives[0]
    assert latest_directive["status"] == "DISPATCHED_TO_TMS"
    assert "Malshej Ghat" in latest_directive["recommended_bypass"]
    assert latest_directive["expected_sla_preservation_hrs"] > 0

    # Verify decision log entry
    assert len(autonomous_agent_engine.decision_log) > 0
    latest_decision = autonomous_agent_engine.decision_log[-1]
    assert latest_decision["event_type"] in ["DIRECTIVE_GENERATED", "MODE_TOGGLE"]

    # 2. Test Manual Operator mode trigger
    autonomous_agent_engine.mode = MODE_MANUAL
    autonomous_agent_engine.active_directives = []
    autonomous_agent_engine.evaluate_tick(telemetry_engine)

    assert len(autonomous_agent_engine.active_directives) > 0
    manual_directive = autonomous_agent_engine.active_directives[0]
    assert manual_directive["status"] == "PENDING_OPERATOR_APPROVAL"

    # Cleanup
    telemetry_engine.clear_roadblocks()
    autonomous_agent_engine.mode = MODE_AUTONOMOUS
    autonomous_agent_engine.evaluate_tick(telemetry_engine)


def test_1hz_telemetry_tick_payload_schema():
    """
    Assert that 1Hz telemetry tick includes macro_corridor and autonomous_sentinel.
    """
    tick = telemetry_engine.get_tick_payload()

    assert tick["type"] == "TELEMETRY_TICK"
    assert "simulation" in tick
    assert "vehicles" in tick
    assert "macro_corridor" in tick
    assert "autonomous_sentinel" in tick

    # Validate macro_corridor sub-schema
    macro = tick["macro_corridor"]
    assert "nodes" in macro
    assert len(macro["nodes"]) == 5
    assert "corridors" in macro
    assert len(macro["corridors"]) >= 4

    # Validate node fields
    for n in macro["nodes"]:
        assert "node_id" in n
        assert "current_stock" in n
        assert "capacity_units" in n
        assert "capacity_utilization_pct" in n
        assert "status" in n
        assert "upper_forecast_demand_7d" in n

    # Validate corridor fields
    for c in macro["corridors"]:
        assert "link_id" in c
        assert "corridor_name" in c
        assert "congestion_index" in c
        assert "status" in c

    # Validate autonomous_sentinel sub-schema
    sentinel = tick["autonomous_sentinel"]
    assert "mode" in sentinel
    assert sentinel["mode"] in [MODE_AUTONOMOUS, MODE_MANUAL]
    assert "risk_index" in sentinel
    assert 0.0 <= sentinel["risk_index"] <= 100.0
    assert "status" in sentinel
    assert "active_directives" in sentinel


@pytest.mark.asyncio
async def test_autonomous_status_and_toggle_endpoints():
    """
    Verify REST endpoints:
    - GET /api/v1/twin/autonomous-status (accessible to director, admin, dispatcher)
    - POST /api/v1/twin/autonomous-toggle (restricted to director, admin)
    - GET /api/v1/twin/autonomous-directives
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. GET status with director persona
        res = await client.get("/api/v1/twin/autonomous-status", headers=DIRECTOR_HEADERS)
        assert res.status_code == 200
        data = res.json()
        assert "mode" in data
        assert "risk_index" in data
        assert "status" in data
        assert "recent_decision_log" in data

        # 2. Toggle to MANUAL_OPERATOR
        toggle_res = await client.post(
            "/api/v1/twin/autonomous-toggle",
            json={"mode": "MANUAL_OPERATOR"},
            headers=DIRECTOR_HEADERS
        )
        assert toggle_res.status_code == 200
        toggle_data = toggle_res.json()
        assert toggle_data["mode"] == "MANUAL_OPERATOR"

        # 3. Verify state persisted
        status_check = await client.get("/api/v1/twin/autonomous-status", headers=DISPATCHER_HEADERS)
        assert status_check.status_code == 200
        assert status_check.json()["mode"] == "MANUAL_OPERATOR"

        # 4. Toggle back to AUTONOMOUS_SENTINEL
        toggle_back = await client.post(
            "/api/v1/twin/autonomous-toggle",
            json={"mode": "AUTONOMOUS_SENTINEL"},
            headers=ADMIN_HEADERS
        )
        assert toggle_back.status_code == 200
        assert toggle_back.json()["mode"] == "AUTONOMOUS_SENTINEL"

        # 5. RBAC check: Customs persona should be forbidden (403) from toggling mode
        forbidden_res = await client.post(
            "/api/v1/twin/autonomous-toggle",
            json={"mode": "MANUAL_OPERATOR"},
            headers=CUSTOMS_HEADERS
        )
        assert forbidden_res.status_code == 403

        # 6. GET directives endpoint
        dir_res = await client.get("/api/v1/twin/autonomous-directives", headers=DISPATCHER_HEADERS)
        assert dir_res.status_code == 200
        dir_data = dir_res.json()
        assert "active_directives" in dir_data
        assert "decision_log" in dir_data
