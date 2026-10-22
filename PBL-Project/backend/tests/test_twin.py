import os
import sys
import time
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.engines.digital_twin_engine import digital_twin_engine

DIRECTOR_HEADERS = {"X-Persona-Role": "director"}
ADMIN_HEADERS = {"X-Persona-Role": "admin"}
CUSTOMS_HEADERS = {"X-Persona-Role": "customs"}
DISPATCHER_HEADERS = {"X-Persona-Role": "dispatcher"}


def test_engine_topology_structure():
    """Verify that multi-echelon network topology contains all 5 required nodes and transit links."""
    topology = digital_twin_engine.get_network_topology()
    nodes = topology["nodes"]
    node_ids = [n["node_id"] for n in nodes]
    
    # Assert 5 required multi-echelon nodes: JNPT Port, Bhiwandi DC, Thane Hub, Nashik Depot, Pune Center
    assert "PORT-JNPT-01" in node_ids
    assert "DC-BHW-01" in node_ids
    assert "HUB-THN-01" in node_ids
    assert "DEP-NSK-01" in node_ids
    assert "FC-PUN-01" in node_ids

    # Check node attributes: capacity, replenishment lead times, holding costs, WGS84 coordinates
    for node in nodes:
        assert node["capacity_units"] > 0
        assert node["lead_time_days"] > 0
        assert node["holding_cost_per_unit_day"] > 0
        assert "latitude" in node and "longitude" in node
        assert 18.0 <= node["latitude"] <= 20.5, f"Latitude {node['latitude']} outside corridor bounds"
        assert 72.5 <= node["longitude"] <= 74.2, f"Longitude {node['longitude']} outside corridor bounds"

    # Check links
    links = topology["links"]
    assert len(links) >= 4
    for link in links:
        assert "source" in link and "target" in link
        assert link["distance_km"] > 0
        assert link["nominal_transit_hours"] > 0
        assert "alternative_route" in link


def test_preset_scenarios_listing():
    """Assert all 3 primary operational shock scenarios are present with descriptions."""
    scenarios = digital_twin_engine.get_preset_scenarios()
    scenario_ids = [s["id"] for s in scenarios]

    assert "port_strike" in scenario_ids
    assert "monsoon_closures" in scenario_ids
    assert "bridge_failure" in scenario_ids


def test_simulation_sla_delay_and_mitigation_improvement():
    """
    Assert that running a shock simulation with mitigation results in
    mitigated_sla_delay <= baseline_sla_delay and mitigated_risk <= baseline_risk.
    """
    for scenario_id in ["port_strike", "monsoon_closures", "bridge_failure"]:
        start_t = time.perf_counter()
        result = digital_twin_engine.simulate_scenario(
            scenario_id=scenario_id,
            shock_intensity=75.0,
            enable_mitigation=True,
            simulation_horizon_days=7
        )
        duration = time.perf_counter() - start_t

        # SLA performance requirement: < 5.0 seconds
        assert duration < 5.0, f"Simulation took {duration:.3f}s, exceeding 5.0s limit"
        assert result["execution_time_seconds"] < 5.0

        baseline = result["baseline_metrics"]
        mitigated = result["mitigated_metrics"]

        # Mitigation assertion: mitigated_sla_delay <= baseline_sla_delay
        assert mitigated["sla_delay_hours"] <= baseline["sla_delay_hours"], (
            f"Scenario {scenario_id}: Mitigated delay {mitigated['sla_delay_hours']} "
            f"exceeds baseline delay {baseline['sla_delay_hours']}"
        )

        # Mitigation risk assertion: mitigated_risk_index <= baseline_risk_index
        assert mitigated["risk_index"] <= baseline["risk_index"]

        # Stockout and unmet demand should not worsen with mitigation
        assert mitigated["unmet_demand_units"] <= baseline["unmet_demand_units"]

        # Assert contingency recommendations exist
        assert len(result["contingency_recommendations"]) > 0


def test_metric_calculation_consistency():
    """Assert all metric fields are numeric, non-negative, and mathematically bounded."""
    result = digital_twin_engine.simulate_scenario(
        scenario_id="monsoon_closures",
        shock_intensity=50.0,
        enable_mitigation=True,
        simulation_horizon_days=7
    )

    baseline = result["baseline_metrics"]
    mitigated = result["mitigated_metrics"]

    for m in [baseline, mitigated]:
        assert 0.0 <= m["risk_index"] <= 100.0
        assert m["sla_delay_hours"] >= 0.0
        assert m["holding_cost_inr"] >= 0.0
        assert m["co2_emissions_kg"] >= 0.0
        assert 0.0 <= m["stockout_probability_pct"] <= 100.0
        assert m["unmet_demand_units"] >= 0

    # Comparative delta consistency
    delta = result["comparative_delta"]
    assert "sla_delay_reduction_pct" in delta
    assert "risk_reduction_pct" in delta
    assert "cost_savings_inr" in delta
    assert delta["sla_delay_reduction_pct"] >= 0.0

    # Financial impact invariant assertions (mitigated_cost <= baseline_cost)
    assert "baseline_cost_inr" in delta
    assert "mitigated_cost_inr" in delta
    assert "net_savings_inr" in delta
    assert "sla_delay_hours_avoided" in delta
    assert delta["mitigated_cost_inr"] <= delta["baseline_cost_inr"], (
        f"Mitigated cost {delta['mitigated_cost_inr']} exceeds baseline cost {delta['baseline_cost_inr']}"
    )
    assert delta["net_savings_inr"] >= 0.0
    assert abs(delta["net_savings_inr"] - (delta["baseline_cost_inr"] - delta["mitigated_cost_inr"])) < 0.05
    assert delta["sla_delay_hours_avoided"] >= 0.0


@pytest.mark.asyncio
async def test_api_simulate_scenario_endpoint():
    """Assert API endpoint POST /api/v1/twin/simulate-scenario processes requests < 5s."""
    payload = {
        "scenario_id": "port_strike",
        "shock_intensity": 80.0,
        "enable_mitigation": True,
        "simulation_horizon_days": 7
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        start_time = time.perf_counter()
        response = await client.post(
            "/api/v1/twin/simulate-scenario",
            json=payload,
            headers=DIRECTOR_HEADERS
        )
        elapsed = time.perf_counter() - start_time

        assert response.status_code == 200
        assert elapsed < 5.0, f"API took {elapsed:.3f}s, exceeding 5.0s SLA"

        data = response.json()
        assert data["scenario_id"] == "port_strike"
        assert data["status"] == "COMPLETED"
        assert "baseline_metrics" in data
        assert "mitigated_metrics" in data
        assert "nodes" in data
        assert "links" in data
        assert "contingency_recommendations" in data
        assert "timeline_events" in data

        # Verify mitigation improvement
        assert data["mitigated_metrics"]["sla_delay_hours"] <= data["baseline_metrics"]["sla_delay_hours"]


@pytest.mark.asyncio
async def test_api_rbac_permissions():
    """
    Assert RBAC:
    - Supply Chain Director ('director') -> 200 OK
    - IT Admin ('admin') -> 200 OK
    - Customs Officer ('customs') -> 403 Forbidden
    """
    payload = {
        "scenario_id": "bridge_failure",
        "shock_intensity": 60.0,
        "enable_mitigation": True
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Director should succeed
        res_dir = await client.post("/api/v1/twin/simulate-scenario", json=payload, headers=DIRECTOR_HEADERS)
        assert res_dir.status_code == 200

        # Admin should succeed
        res_admin = await client.post("/api/v1/twin/simulate-scenario", json=payload, headers=ADMIN_HEADERS)
        assert res_admin.status_code == 200

        # Customs should be forbidden
        res_customs = await client.post("/api/v1/twin/simulate-scenario", json=payload, headers=CUSTOMS_HEADERS)
        assert res_customs.status_code == 403
        assert "not authorized" in res_customs.json()["detail"].lower()


@pytest.mark.asyncio
async def test_api_topology_and_scenarios_endpoints():
    """Assert GET /api/v1/twin/topology and GET /api/v1/twin/scenarios endpoints succeed."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_top = await client.get("/api/v1/twin/topology", headers=DIRECTOR_HEADERS)
        assert res_top.status_code == 200
        top_data = res_top.json()
        assert len(top_data["nodes"]) == 5
        assert len(top_data["links"]) >= 4

        res_scen = await client.get("/api/v1/twin/scenarios", headers=DIRECTOR_HEADERS)
        assert res_scen.status_code == 200
        scen_data = res_scen.json()
        assert len(scen_data["scenarios"]) >= 3


def test_extreme_intensity_boundary_conditions():
    """Assert simulation handles edge shock intensities: 1% (minimal) and 100% (catastrophic)."""
    # 1% shock
    res_min = digital_twin_engine.simulate_scenario(
        scenario_id="monsoon_closures",
        shock_intensity=1.0,
        enable_mitigation=True
    )
    assert res_min["baseline_metrics"]["risk_index"] < 30.0

    # 100% shock
    res_max = digital_twin_engine.simulate_scenario(
        scenario_id="monsoon_closures",
        shock_intensity=100.0,
        enable_mitigation=True
    )
    assert res_max["baseline_metrics"]["risk_index"] > 60.0
    assert res_max["mitigated_metrics"]["sla_delay_hours"] <= res_max["baseline_metrics"]["sla_delay_hours"]


def test_corridor_highway_geometry_and_bypass_payloads():
    """Verify that all inter-node corridor links contain WGS84 highway geometries, congestion indices, and bypasses."""
    topology = digital_twin_engine.get_network_topology()
    links = topology["links"]
    assert len(links) == 4

    corridor_ids = [l["link_id"] for l in links]
    assert "LINK-JNPT-BHW" in corridor_ids
    assert "LINK-BHW-THN" in corridor_ids
    assert "LINK-BHW-NSK" in corridor_ids
    assert "LINK-BHW-PUN" in corridor_ids

    for link in links:
        assert "geometry" in link and isinstance(link["geometry"], list)
        assert len(link["geometry"]) >= 4, f"Link {link['link_id']} has insufficient polyline points"
        assert "congestion_index" in link
        assert link["congestion_index"] > 0.0
        assert "epicenter_coordinates" in link
        assert len(link["epicenter_coordinates"]) == 2

        # Check alternative route geometry
        assert "alternative_route" in link
        alt = link["alternative_route"]
        assert "geometry" in alt and isinstance(alt["geometry"], list)
        assert len(alt["geometry"]) >= 3, f"Bypass for {link['link_id']} has insufficient points"


def test_disruption_epicenter_and_conduit_congestion():
    """Verify that simulated scenarios return disruption epicenters and realistic corridor congestion."""
    scenarios = ["port_strike", "monsoon_closures", "bridge_failure"]

    for sc_id in scenarios:
        res = digital_twin_engine.simulate_scenario(
            scenario_id=sc_id,
            shock_intensity=75.0,
            enable_mitigation=True
        )

        assert "epicenter" in res and res["epicenter"] is not None
        epi = res["epicenter"]
        assert "latitude" in epi and "longitude" in epi
        assert 18.0 <= epi["latitude"] <= 20.5
        assert 72.5 <= epi["longitude"] <= 74.35
        assert epi["radius_meters"] >= 1000

        assert "affected_links" in res and len(res["affected_links"]) > 0
        aff_id = res["affected_links"][0]

        # Inspect link metrics
        target_link = next(l for l in res["links"] if l["link_id"] == aff_id)
        assert "geometry" in target_link and len(target_link["geometry"]) >= 4
        assert "alternative_route" in target_link
        assert "geometry" in target_link["alternative_route"]

        # Baseline congestion should be high on shocked link (> 70)
        assert target_link["baseline"]["congestion_index"] >= 70.0
        assert target_link["baseline"]["status"] in ["congested", "blocked"]

        # Mitigated congestion should be alleviated (< 45) via bypass rerouting
        assert target_link["mitigated"]["congestion_index"] <= 45.0
        assert target_link["mitigated"]["is_rerouted"] is True
        assert target_link["mitigated"]["status"] == "rerouted_active"

