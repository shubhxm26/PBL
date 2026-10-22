import pytest
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app


@pytest.mark.asyncio
async def test_get_skus_catalog():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/forecasting/skus",
            headers={"X-Persona-Role": "director"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert data["count"] >= 4
        sku_ids = [s["sku_id"] for s in data["skus"]]
        assert "SKU-NAS-AGRI-01" in sku_ids
        assert "SKU-JNPT-ELEC-01" in sku_ids


@pytest.mark.asyncio
async def test_get_historical_series():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/forecasting/historical/SKU-NAS-AGRI-01?days=20",
            headers={"X-Persona-Role": "director"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert data["sku_id"] == "SKU-NAS-AGRI-01"
        assert len(data["history"]) > 0
        first = data["history"][0]
        assert "date" in first
        assert "quantity_sold" in first
        assert first["quantity_sold"] > 0


@pytest.mark.asyncio
async def test_predict_schema_and_strict_confidence_intervals():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "sku_id": "SKU-NAS-AGRI-01",
            "forecast_horizon_days": 14,
            "granularity": "daily",
            "include_exogenous_factors": True
        }
        response = await client.post(
            "/api/v1/forecasting/predict",
            json=payload,
            headers={"X-Persona-Role": "director"}
        )
        assert response.status_code == 200
        data = response.json()

        # Schema validation
        assert data["status"] == "SUCCESS"
        assert "request_id" in data
        assert data["forecast_horizon_days"] == 14
        assert "summary" in data
        assert data["summary"]["average_daily_demand"] > 0
        assert data["summary"]["recommended_safety_stock"] > 0
        assert "forecasts" in data
        assert len(data["forecasts"]) == 1

        forecast = data["forecasts"][0]
        assert forecast["sku_id"] == "SKU-NAS-AGRI-01"
        assert len(forecast["predictions"]) == 14

        # Strict Confidence Interval Ordering Guarantee: lower <= point <= upper
        for pred in forecast["predictions"]:
            point = pred["predicted_demand_units"]
            ci = pred["confidence_interval_95"]
            lower = ci["lower"]
            upper = ci["upper"]

            assert lower >= 0, f"Lower bound {lower} must be non-negative"
            assert lower <= point, f"Violation: lower ({lower}) > point ({point})"
            assert point <= upper, f"Violation: point ({point}) > upper ({upper})"
            assert pred["recommended_safety_stock"] > 0, "Safety stock must be positive"


@pytest.mark.asyncio
async def test_horizon_bounds():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test 7 days horizon
        r7 = await client.post(
            "/api/v1/forecasting/predict",
            json={"sku_id": "SKU-JNPT-ELEC-01", "forecast_horizon_days": 7},
            headers={"X-Persona-Role": "director"}
        )
        assert r7.status_code == 200
        d7 = r7.json()
        assert d7["forecast_horizon_days"] == 7
        assert len(d7["forecasts"][0]["predictions"]) == 7

        # Test 30 days horizon
        r30 = await client.post(
            "/api/v1/forecasting/predict",
            json={"sku_id": "SKU-JNPT-ELEC-01", "forecast_horizon_days": 30},
            headers={"X-Persona-Role": "director"}
        )
        assert r30.status_code == 200
        d30 = r30.json()
        assert d30["forecast_horizon_days"] == 30
        assert len(d30["forecasts"][0]["predictions"]) == 30


@pytest.mark.asyncio
async def test_exogenous_simulation_overrides():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Baseline forecast (0% promo)
        r_base = await client.post(
            "/api/v1/forecasting/predict",
            json={
                "sku_id": "SKU-PUN-AUTO-01",
                "forecast_horizon_days": 14,
                "include_exogenous_factors": True,
                "exogenous_overrides": {"promo_discount_pct": 0.0}
            },
            headers={"X-Persona-Role": "director"}
        )
        assert r_base.status_code == 200
        base_demand = r_base.json()["summary"]["total_horizon_demand"]

        # Boosted forecast (25% promo discount)
        r_promo = await client.post(
            "/api/v1/forecasting/predict",
            json={
                "sku_id": "SKU-PUN-AUTO-01",
                "forecast_horizon_days": 14,
                "include_exogenous_factors": True,
                "exogenous_overrides": {"promo_discount_pct": 25.0}
            },
            headers={"X-Persona-Role": "director"}
        )
        assert r_promo.status_code == 200
        promo_demand = r_promo.json()["summary"]["total_horizon_demand"]

        # Promo discount must stimulate higher demand
        assert promo_demand > base_demand, f"Promo demand {promo_demand} should exceed base {base_demand}"


@pytest.mark.asyncio
async def test_forecasting_rbac_enforcement():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {"sku_id": "SKU-NAS-AGRI-01", "forecast_horizon_days": 7}

        # Director has run_forecast permission -> 200
        r_dir = await client.post(
            "/api/v1/forecasting/predict",
            json=payload,
            headers={"X-Persona-Role": "director"}
        )
        assert r_dir.status_code == 200

        # Admin has wildcard * permission -> 200
        r_adm = await client.post(
            "/api/v1/forecasting/predict",
            json=payload,
            headers={"X-Persona-Role": "admin"}
        )
        assert r_adm.status_code == 200

        # Customs officer does NOT have run_forecast permission -> 403 Forbidden
        r_cus = await client.post(
            "/api/v1/forecasting/predict",
            json=payload,
            headers={"X-Persona-Role": "customs"}
        )
        assert r_cus.status_code == 403
        assert "permission" in r_cus.json()["detail"].lower()

        # Dispatcher does NOT have run_forecast permission -> 403 Forbidden
        r_dis = await client.post(
            "/api/v1/forecasting/predict",
            json=payload,
            headers={"X-Persona-Role": "dispatcher"}
        )
        assert r_dis.status_code == 403
