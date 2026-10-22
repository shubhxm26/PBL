import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_role
from app.engines.digital_twin_engine import digital_twin_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/twin", tags=["Digital Twin Scenario Studio"])


# Pydantic Schemas
class ScenarioSimulateRequest(BaseModel):
    scenario_id: str = Field(..., description="Unique ID of preset shock or 'custom'")
    shock_intensity: float = Field(default=75.0, ge=1.0, le=100.0, description="Severity percentage (1-100%)")
    enable_mitigation: bool = Field(default=True, description="Whether to simulate active automated contingency mitigation")
    simulation_horizon_days: int = Field(default=7, ge=3, le=30, description="Simulation time horizon in days")
    custom_scenario_name: Optional[str] = Field(default=None, description="Custom scenario title if scenario_id is 'custom'")
    custom_affected_nodes: Optional[List[str]] = Field(default=None, description="Custom node IDs affected by the shock")


@router.get("/topology")
def get_network_topology(
    _persona: Dict[str, Any] = Depends(require_role(["director", "admin"]))
):
    """
    Returns the multi-echelon supply chain network topology:
    ports, central distribution centers, regional hubs, node capacities,
    replenishment lead times, and inventory holding costs.
    """
    try:
        return digital_twin_engine.get_network_topology()
    except Exception as e:
        logger.error("Failed to fetch digital twin topology: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch digital twin topology: {str(e)}"
        )


@router.get("/scenarios")
def get_preset_scenarios(
    _persona: Dict[str, Any] = Depends(require_role(["director", "admin"]))
):
    """
    Returns catalog of preset operational shock scenarios:
    Port Labor Strike at JNPT, Extreme Monsoon Road Closures, Expressway Bridge Failure.
    """
    try:
        return {
            "scenarios": digital_twin_engine.get_preset_scenarios()
        }
    except Exception as e:
        logger.error("Failed to fetch twin preset scenarios: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch scenarios: {str(e)}"
        )


@router.post("/simulate-scenario")
def simulate_scenario(
    request: ScenarioSimulateRequest,
    _persona: Dict[str, Any] = Depends(require_role(["director", "admin"]))
):
    """
    Executes Discrete-Event Simulation (DES) across multi-echelon network nodes under injected shock.
    Returns execution results and comparative metrics (Risk Index, SLA delay hours, holding cost surge,
    CO2 impact, stockout probabilities) and automated contingency rerouting recommendations.
    Guaranteed response time < 5.0 seconds.
    """
    try:
        result = digital_twin_engine.simulate_scenario(
            scenario_id=request.scenario_id,
            shock_intensity=request.shock_intensity,
            enable_mitigation=request.enable_mitigation,
            simulation_horizon_days=request.simulation_horizon_days,
            custom_scenario_name=request.custom_scenario_name,
            custom_affected_nodes=request.custom_affected_nodes
        )
        return result
    except ValueError as ve:
        logger.warning("Simulation input validation error: %s", str(ve))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error("Digital twin simulation failed: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation failed: {str(e)}"
        )


class AutonomousToggleRequest(BaseModel):
    mode: Optional[str] = Field(default=None, description="Optional target mode: AUTONOMOUS_SENTINEL or MANUAL_OPERATOR. If omitted, flips mode.")


@router.get("/autonomous-status")
def get_autonomous_sentinel_status(
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "director", "admin"]))
):
    """
    Returns live Autonomous AI Sentinel telemetry status, composite risk index,
    active preventative directives, and recent decision audit events.
    """
    try:
        from app.engines.autonomous_agent import autonomous_agent_engine
        status_data = autonomous_agent_engine.get_status()
        status_data["recent_decision_log"] = autonomous_agent_engine.decision_log[-20:]
        return status_data
    except Exception as e:
        logger.error("Failed to fetch autonomous sentinel status: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch autonomous sentinel status: {str(e)}"
        )


@router.post("/autonomous-toggle")
def toggle_autonomous_sentinel_mode(
    request: Optional[AutonomousToggleRequest] = None,
    _persona: Dict[str, Any] = Depends(require_role(["director", "admin"]))
):
    """
    Toggles between AUTONOMOUS_SENTINEL mode and MANUAL_OPERATOR mode.
    Restricted to Supply Chain Director and Administrator roles.
    """
    try:
        from app.engines.autonomous_agent import autonomous_agent_engine
        target_mode = request.mode if request else None
        return autonomous_agent_engine.toggle_mode(target_mode)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error("Failed to toggle autonomous sentinel mode: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle autonomous mode: {str(e)}"
        )


@router.get("/autonomous-directives")
def get_autonomous_directives(
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "director", "admin"]))
):
    """
    Returns active autonomous mitigation directives and full historical decision audit log.
    """
    try:
        from app.engines.autonomous_agent import autonomous_agent_engine
        return {
            "mode": autonomous_agent_engine.mode,
            "risk_index": autonomous_agent_engine.risk_index,
            "active_directives": autonomous_agent_engine.active_directives,
            "decision_log": autonomous_agent_engine.decision_log
        }
    except Exception as e:
        logger.error("Failed to fetch autonomous directives: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch directives: {str(e)}"
        )

