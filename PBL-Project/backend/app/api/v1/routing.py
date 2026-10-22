import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.connection import get_db
from app.core.rbac import require_role
from app.engines.routing_engine import routing_engine
from app.engines.telemetry_engine import telemetry_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/routing", tags=["Fleet Route Optimizer & Freight Matching"])


# Pydantic Schemas
class LocationCoordinate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    name: Optional[str] = None
    city: Optional[str] = None


class FleetUnitInput(BaseModel):
    vehicle_id: str
    max_capacity_kg: float = Field(..., gt=0)
    current_fuel_pct: Optional[float] = 100.0


class TimeWindowInput(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None


class DeliveryStopInput(BaseModel):
    delivery_id: str
    location: Optional[LocationCoordinate] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    name: Optional[str] = None
    customer_name: Optional[str] = None
    city: Optional[str] = None
    weight_kg: float = Field(..., ge=0)
    volume_m3: Optional[float] = 10.0
    time_window: Optional[TimeWindowInput] = None


class RouteOptimizeRequest(BaseModel):
    depot_location: LocationCoordinate
    fleet_units: List[FleetUnitInput] = Field(default_factory=list)
    deliveries: List[DeliveryStopInput] = Field(..., min_length=1)
    traffic_mode: Optional[str] = "STANDARD"


class AssignBackhaulRequest(BaseModel):
    route_id: str
    backhaul_id: str
    current_route: Dict[str, Any]


@router.get("/fixtures")
def get_routing_fixtures(
    db: Session = Depends(get_db),
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "admin"]))
):
    """
    Returns seeded Western India corridor nodes, available fleet vehicles,
    candidate delivery orders, and backhaul freight listings.
    """
    try:
        return routing_engine.get_fixtures(db=db)
    except Exception as e:
        logger.error("Failed to fetch routing fixtures: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch routing fixtures: {str(e)}"
        )


@router.post("/optimize")
def optimize_route(
    request: RouteOptimizeRequest,
    db: Session = Depends(get_db),
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "admin"]))
):
    """
    Optimizes stop visitation sequence using PyTorch DRL, enforces vehicle capacity limits,
    calculates fuel/CO2 emissions under standard and congested modes, generates road geometry,
    and identifies compatible return backhaul freight pairings.
    """
    try:
        depot_dict = request.depot_location.model_dump()
        fleet_units = [f.model_dump() for f in request.fleet_units]
        deliveries = [d.model_dump() for d in request.deliveries]

        result = routing_engine.optimize_route(
            depot_location=depot_dict,
            fleet_units=fleet_units,
            deliveries=deliveries,
            traffic_mode=request.traffic_mode or "STANDARD",
            db=db
        )
        # Synchronize vehicle active route with telemetry simulation engine
        try:
            v_id = result.get("vehicle_id", "TRK-MH-01")
            telemetry_engine.set_active_route(v_id, result)
        except Exception as te_err:
            logger.debug("Telemetry sync error: %s", str(te_err))

        return result
    except ValueError as ve:
        # Handles capacity limit breaches or invalid inputs
        logger.warning("Routing validation error: %s", str(ve))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error("Route optimization execution failed: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Route optimization failed: {str(e)}"
        )


@router.post("/assign-backhaul")
def assign_backhaul(
    request: AssignBackhaulRequest,
    db: Session = Depends(get_db),
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "admin"]))
):
    """
    Assigns a return freight backhaul to an optimized route, updating waypoints,
    eliminating empty return kilometers, and recalculating revenue/CO2 savings.
    """
    try:
        result = routing_engine.assign_backhaul(
            current_route=request.current_route,
            backhaul_id=request.backhaul_id,
            db=db
        )
        try:
            v_id = result.get("vehicle_id", "TRK-MH-01")
            telemetry_engine.set_active_route(v_id, result)
        except Exception as te_err:
            logger.debug("Telemetry sync error: %s", str(te_err))

        return {
            "status": "SUCCESS",
            "assigned_backhaul_id": request.backhaul_id,
            **result
        }
    except ValueError as ve:
        logger.warning("Backhaul assignment error: %s", str(ve))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error("Failed to assign backhaul: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backhaul assignment failed: {str(e)}"
        )
