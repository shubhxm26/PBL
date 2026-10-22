import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.rbac import require_permission, get_current_persona
from app.db.connection import db_manager
from app.db.models import InventorySKU
from app.db.seed_data import FALLBACK_SKUS
from app.engines.forecasting_engine import forecasting_engine

router = APIRouter(prefix="/forecasting", tags=["Demand Forecasting"])


def get_db():
    db = db_manager.session_maker()
    try:
        yield db
    finally:
        db.close()


class ExogenousOverrides(BaseModel):
    promo_discount_pct: Optional[float] = Field(default=0.0, ge=0.0, le=50.0)
    weather_impact_severity: Optional[float] = Field(default=1.0, ge=0.5, le=3.0)
    monsoon_alert: Optional[bool] = Field(default=False)
    fuel_price_index: Optional[float] = Field(default=100.0)


class ForecastingRequest(BaseModel):
    request_id: Optional[str] = Field(default=None, description="Client tracking request ID")
    sku_id: Optional[str] = Field(default=None, description="Primary SKU to forecast")
    sku_list: Optional[List[str]] = Field(default=None, description="List of SKUs to forecast")
    warehouse_ids: Optional[List[str]] = Field(default=None, description="Target warehouses")
    forecast_horizon_days: int = Field(default=14, description="Forecast horizon in days (7, 14, 30)")
    granularity: str = Field(default="daily", description="Time granularity (daily, weekly)")
    include_exogenous_factors: bool = Field(default=True, description="Whether to include weather & promo adjustments")
    exogenous_overrides: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Dynamic simulation overrides for weather anomaly or promo discounts"
    )


class ConfidenceInterval(BaseModel):
    lower: int
    upper: int


class ExogenousImpact(BaseModel):
    promo_uplift_units: int
    weather_delta_units: int


class DailyPrediction(BaseModel):
    date: str
    day_index: int
    day_name: str
    predicted_demand_units: int
    confidence_interval_95: ConfidenceInterval
    recommended_safety_stock: int
    exogenous_impact: ExogenousImpact


class SKUForecast(BaseModel):
    sku_id: str
    sku_name: str
    warehouse_id: str
    predictions: List[DailyPrediction]


class ForecastSummary(BaseModel):
    sku_id: str
    sku_name: str
    average_daily_demand: float
    total_horizon_demand: int
    volatility_index: float
    recommended_safety_stock: int
    stockout_risk_score: float


class ForecastingResponse(BaseModel):
    request_id: str
    status: str
    generated_at: str
    forecast_horizon_days: int
    summary: ForecastSummary
    forecasts: List[SKUForecast]
    historical_series: Optional[List[Dict[str, Any]]] = None


@router.get("/skus", summary="List all inventory SKUs available for forecasting")
def get_skus(db: Session = Depends(get_db)):
    """Return SKU catalog with holding costs, base demand, and default warehouses."""
    skus = []
    try:
        rows = db.query(InventorySKU).all()
        if rows:
            skus = [
                {
                    "sku_id": r.sku_id,
                    "name": r.name,
                    "category": r.category,
                    "default_warehouse_id": r.default_warehouse_id,
                    "unit_price_inr": r.unit_price_inr,
                    "holding_cost_per_day": r.holding_cost_per_day,
                    "base_daily_demand": r.base_daily_demand,
                    "lead_time_days": r.lead_time_days,
                    "service_level_target": r.service_level_target,
                    "current_stock": r.current_stock
                }
                for r in rows
            ]
    except Exception:
        pass

    if not skus:
        skus = FALLBACK_SKUS

    return {
        "status": "SUCCESS",
        "count": len(skus),
        "skus": skus
    }


@router.get("/historical/{sku_id}", summary="Get historical daily sales series for a SKU")
def get_historical_series(sku_id: str, days: int = 30, db: Session = Depends(get_db)):
    """Fetch historical actual daily sales series."""
    sales = forecasting_engine._get_historical_sales(sku_id, limit_days=days, db=db)
    sku_meta = forecasting_engine._get_sku_metadata(sku_id, db=db)
    return {
        "status": "SUCCESS",
        "sku_id": sku_id,
        "sku_name": sku_meta["name"],
        "category": sku_meta["category"],
        "count": len(sales),
        "history": sales
    }


@router.post(
    "/predict",
    response_model=ForecastingResponse,
    summary="Generate PyTorch multi-horizon neural demand predictions with 95% confidence intervals"
)
def predict_demand(
    payload: ForecastingRequest,
    db: Session = Depends(get_db),
    persona: Dict[str, Any] = Depends(require_permission("run_forecast"))
):
    """
    Generate multi-horizon daily neural demand predictions.
    Outputs:
    - Multi-step point predictions
    - 95% confidence bands (lower <= point <= upper guaranteed)
    - Exogenous factor impact (weather anomalies, promo discount elasticity)
    - Statistical safety stock recommendation
    """
    req_id = payload.request_id or f"req-{uuid.uuid4().hex[:8]}"

    # Determine target SKUs
    target_skus = []
    if payload.sku_id:
        target_skus.append(payload.sku_id)
    if payload.sku_list:
        for s in payload.sku_list:
            if s not in target_skus:
                target_skus.append(s)

    if not target_skus:
        # Default to first SKU in catalog
        target_skus = ["SKU-NAS-AGRI-01"]

    horizon = payload.forecast_horizon_days
    # Validate horizon bounds
    if horizon not in [7, 14, 30]:
        if horizon <= 7:
            horizon = 7
        elif horizon <= 14:
            horizon = 14
        else:
            horizon = 30

    forecast_results = []
    primary_summary = None
    historical_series = None

    for idx, sku_id in enumerate(target_skus):
        target_wh = None
        if payload.warehouse_ids and len(payload.warehouse_ids) > idx:
            target_wh = payload.warehouse_ids[idx]

        result = forecasting_engine.predict(
            sku_id=sku_id,
            horizon_days=horizon,
            warehouse_id=target_wh,
            include_exogenous_factors=payload.include_exogenous_factors,
            exogenous_overrides=payload.exogenous_overrides,
            db=db
        )

        forecast_results.append({
            "sku_id": result["sku_id"],
            "sku_name": result["sku_name"],
            "warehouse_id": result["warehouse_id"],
            "predictions": result["predictions"]
        })

        if idx == 0:
            primary_summary = {
                "sku_id": result["sku_id"],
                "sku_name": result["sku_name"],
                "average_daily_demand": result["summary"]["average_daily_demand"],
                "total_horizon_demand": result["summary"]["total_horizon_demand"],
                "volatility_index": result["summary"]["volatility_index"],
                "recommended_safety_stock": result["summary"]["recommended_safety_stock"],
                "stockout_risk_score": result["summary"]["stockout_risk_score"]
            }
            historical_series = result["historical_series"]

    return {
        "request_id": req_id,
        "status": "SUCCESS",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "forecast_horizon_days": horizon,
        "summary": primary_summary,
        "forecasts": forecast_results,
        "historical_series": historical_series
    }
