import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field

from app.core.rbac import require_role
from app.config import settings
from app.core.diagnostics import get_platform_diagnostics
from app.engines.forecasting_engine import forecasting_engine
from app.engines.routing_engine import routing_engine
from train_models import train_all_models, train_forecasting_model, train_routing_model

logger = logging.getLogger("admin_api")
router = APIRouter(prefix="/admin", tags=["Admin"])


class RetrainRequest(BaseModel):
    models: str = Field(default="all", description="Models to retrain: 'all', 'forecasting', or 'routing'")
    epochs: int = Field(default=15, ge=1, le=100, description="Training epochs (1 to 100)")
    lr: float = Field(default=0.005, gt=0, le=0.1, description="Learning rate for AdamW")


@router.get("/system-status")
def get_system_status(admin_persona: Dict[str, Any] = Depends(require_role(["admin"]))):
    """Admin-only endpoint returning granular platform diagnostics across DB, Redis, models, and AI SDK."""
    return {
        "status": "ok",
        "authorized_persona": admin_persona["title"],
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "services": get_platform_diagnostics(),
    }


@router.post("/retrain-models")
def retrain_models(
    payload: RetrainRequest = Body(default_factory=RetrainRequest),
    admin_persona: Dict[str, Any] = Depends(require_role(["admin"]))
):
    """
    Admin-only endpoint to trigger on-demand PyTorch model training or fine-tuning.
    Updates checkpoint .pt files and immediately hot-reloads model weights in running engines.
    """
    logger.info("Admin %s triggered PyTorch model retraining (models=%s, epochs=%d)",
                admin_persona["title"], payload.models, payload.epochs)
    try:
        if payload.models == "all":
            results = train_all_models(epochs=payload.epochs, lr=payload.lr, quiet=True)
            forecasting_engine.reload_weights()
            routing_engine.reload_weights()
        elif payload.models == "forecasting":
            fc_res = train_forecasting_model(epochs=payload.epochs, lr=payload.lr, quiet=True)
            forecasting_engine.reload_weights()
            results = {"success": True, "models": {"forecasting": fc_res}}
        elif payload.models == "routing":
            rt_res = train_routing_model(epochs=payload.epochs, lr=payload.lr, quiet=True)
            routing_engine.reload_weights()
            results = {"success": True, "models": {"routing": rt_res}}
        else:
            raise HTTPException(status_code=400, detail=f"Invalid models target: {payload.models}. Must be 'all', 'forecasting', or 'routing'.")

        results["message"] = "PyTorch models retrained, checkpoints persisted, and weights reloaded successfully into memory."
        results["services"] = get_platform_diagnostics()
        return results
    except Exception as e:
        logger.error("Model retraining failed: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Model retraining failed: {str(e)}")

