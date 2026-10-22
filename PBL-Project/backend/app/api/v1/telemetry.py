import asyncio
import logging
from typing import Dict, Any, Optional, Set, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rbac import require_role
from app.engines.telemetry_engine import telemetry_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telemetry", tags=["Real-Time Telemetry & Simulation Playback"])


class RoadblockDisruptionRequest(BaseModel):
    roadblock_id: Optional[str] = "RB-KASARA-01"
    name: Optional[str] = "Kasara Ghat Monsoon Landslide"
    corridor_node: Optional[str] = "KSR"
    latitude: Optional[float] = Field(19.6967, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(73.5611, ge=-180.0, le=180.0)
    radius_km: Optional[float] = Field(15.0, gt=0)
    severity: Optional[str] = "CRITICAL"
    description: Optional[str] = "Rockfall blocked NH-48 uphill section. 10x penalty edge applied."
    penalty_multiplier: Optional[float] = Field(10.0, gt=1.0)
    target_vehicle_id: Optional[str] = "TRK-MH-01"


class SimulationControlRequest(BaseModel):
    action: str = Field(..., description="PLAY, PAUSE, STEP, SET_SPEED, or RESET")
    speed_multiplier: Optional[float] = Field(1.0, description="1.0, 2.0, 5.0")
    step_seconds: Optional[int] = Field(15, ge=1, le=300)


class SetVehicleRouteRequest(BaseModel):
    vehicle_id: str
    route_geometry: List[List[float]]
    total_distance_km: float


class TelemetryWebSocketHub:
    """
    Manages active WebSocket client connections for live telematics streaming,
    graceful disconnection handling, bidirectional control, and real-time broadcasts.
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._ticker_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info("WebSocket telemetry client connected. Total clients: %d", len(self.active_connections))
        
        # Send initial handshake state snapshot
        state = telemetry_engine.get_state()
        greeting = {
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to Cognitive Logistics Real-Time Telemetry Streaming Hub",
            "client_count": len(self.active_connections),
            "simulation": telemetry_engine.get_clock_info(),
            "vehicles": telemetry_engine.get_all_vehicles_snapshot(),
            "active_roadblocks": list(telemetry_engine.active_roadblocks.values()),
            "macro_corridor": state.get("macro_corridor"),
            "autonomous_sentinel": state.get("autonomous_sentinel")
        }
        await websocket.send_json(greeting)

        # Ensure background broadcast ticker is running
        self.ensure_ticker_running()

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info("WebSocket telemetry client disconnected. Total clients: %d", len(self.active_connections))

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts a JSON message to all connected clients, removing dead sockets."""
        async with self._lock:
            dead_connections = set()
            for connection in list(self.active_connections):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.debug("Error sending to websocket client (%s), pruning socket.", str(e))
                    dead_connections.add(connection)
            for dead in dead_connections:
                self.active_connections.discard(dead)

    def ensure_ticker_running(self):
        """Starts background simulation loop if not already running."""
        if self._ticker_task is None or self._ticker_task.done():
            self._ticker_task = asyncio.create_task(self._simulation_tick_loop())

    async def _simulation_tick_loop(self):
        """Background loop broadcasting vehicle telemetry ticks at ~1.0 Hz cadence."""
        logger.info("Started background telemetry tick broadcast loop.")
        try:
            while True:
                await asyncio.sleep(1.0)
                if telemetry_engine.is_running:
                    tick_payload = telemetry_engine.tick(dt_seconds=1.0)
                    if self.active_connections:
                        await self.broadcast(tick_payload)
        except asyncio.CancelledError:
            logger.info("Simulation tick broadcast loop cancelled.")
        except Exception as e:
            logger.error("Simulation tick broadcast loop error: %s", str(e), exc_info=True)

    async def handle_client(self, websocket: WebSocket):
        """Processes incoming client messages and commands over WebSocket."""
        await self.connect(websocket)
        try:
            while True:
                data = await websocket.receive_json()
                action = data.get("action", "").lower()

                if action == "ping":
                    await websocket.send_json({"type": "PONG", "timestamp": telemetry_engine.get_clock_info()})

                elif action in ("resync", "get_state"):
                    state = telemetry_engine.get_state()
                    resync_msg = {
                        "type": "SIMULATION_STATE",
                        "simulation": telemetry_engine.get_clock_info(),
                        "vehicles": telemetry_engine.get_all_vehicles_snapshot(),
                        "active_roadblocks": list(telemetry_engine.active_roadblocks.values()),
                        "macro_corridor": state.get("macro_corridor"),
                        "autonomous_sentinel": state.get("autonomous_sentinel")
                    }
                    await websocket.send_json(resync_msg)

                elif action == "play":
                    telemetry_engine.play()
                    state_msg = {
                        "type": "SIMULATION_STATE",
                        "simulation": telemetry_engine.get_clock_info(),
                        "vehicles": telemetry_engine.get_all_vehicles_snapshot()
                    }
                    await self.broadcast(state_msg)

                elif action == "pause":
                    telemetry_engine.pause()
                    state_msg = {
                        "type": "SIMULATION_STATE",
                        "simulation": telemetry_engine.get_clock_info(),
                        "vehicles": telemetry_engine.get_all_vehicles_snapshot()
                    }
                    await self.broadcast(state_msg)

                elif action == "step":
                    step_secs = int(data.get("step_seconds", 15))
                    tick_payload = telemetry_engine.step(step_seconds=step_secs)
                    await self.broadcast(tick_payload)

                elif action == "set_speed":
                    speed = float(data.get("speed", 1.0))
                    telemetry_engine.set_speed(speed)
                    state_msg = {
                        "type": "SIMULATION_STATE",
                        "simulation": telemetry_engine.get_clock_info(),
                        "vehicles": telemetry_engine.get_all_vehicles_snapshot()
                    }
                    await self.broadcast(state_msg)

                elif action == "reset":
                    telemetry_engine.reset()
                    state_msg = {
                        "type": "SIMULATION_STATE",
                        "simulation": telemetry_engine.get_clock_info(),
                        "vehicles": telemetry_engine.get_all_vehicles_snapshot(),
                        "active_roadblocks": []
                    }
                    await self.broadcast(state_msg)

                elif action == "inject_disruption":
                    rb_id = data.get("roadblock_id", "RB-KASARA-01")
                    res = telemetry_engine.inject_roadblock(
                        roadblock_id=rb_id,
                        name=data.get("name", "Kasara Ghat Landslide"),
                        latitude=float(data.get("latitude", 19.6967)),
                        longitude=float(data.get("longitude", 73.5611)),
                        severity=data.get("severity", "CRITICAL"),
                        description=data.get("description", "Landslide on NH-48"),
                        penalty_multiplier=float(data.get("penalty_multiplier", 10.0)),
                        target_vehicle_id=data.get("target_vehicle_id")
                    )
                    reroute_broadcast = {
                        "type": "REROUTE_EVENT",
                        **res
                    }
                    await self.broadcast(reroute_broadcast)
                    await self.broadcast(telemetry_engine.get_tick_payload())

                elif action == "clear_disruptions":
                    res = telemetry_engine.clear_roadblocks()
                    await self.broadcast({
                        "type": "ROADBLOCKS_CLEARED",
                        **res
                    })
                    await self.broadcast(telemetry_engine.get_tick_payload())

        except WebSocketDisconnect:
            await self.disconnect(websocket)
        except Exception as e:
            logger.warning("WebSocket client connection error: %s", str(e))
            await self.disconnect(websocket)


# Global WebSocket Hub
telemetry_hub = TelemetryWebSocketHub()


# REST Endpoints
@router.get("/state")
def get_telemetry_state(
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "director", "admin"]))
):
    """Returns current simulation clock, active vehicles, and roadblocks."""
    return telemetry_engine.get_state()


@router.post("/control")
async def control_simulation(
    request: SimulationControlRequest,
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "director", "admin"]))
):
    """
    Controls simulation playback bar:
    PLAY, PAUSE, STEP, SET_SPEED, or RESET.
    Broadcasts state update to all WebSocket subscribers.
    """
    action = request.action.upper()
    if action == "PLAY":
        if request.speed_multiplier:
            telemetry_engine.set_speed(request.speed_multiplier)
        telemetry_engine.play()
    elif action == "PAUSE":
        telemetry_engine.pause()
    elif action == "STEP":
        telemetry_engine.step(step_seconds=request.step_seconds or 15)
    elif action == "SET_SPEED":
        telemetry_engine.set_speed(request.speed_multiplier or 1.0)
    elif action == "RESET":
        telemetry_engine.reset()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown simulation action '{action}'. Valid actions: PLAY, PAUSE, STEP, SET_SPEED, RESET"
        )

    # Broadcast updated tick / state
    tick_data = telemetry_engine.get_tick_payload()
    await telemetry_hub.broadcast(tick_data)

    return {
        "status": "SUCCESS",
        "action": action,
        **telemetry_engine.get_state()
    }


@router.post("/inject-disruption")
async def inject_disruption(
    request: RoadblockDisruptionRequest,
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "director", "admin"]))
):
    """
    Injects high-cost penalty roadblock on Western India corridor graph,
    recalculates detour trajectories for traversing fleets, and broadcasts
    re-routing event payloads to connected dispatch dashboards.
    """
    try:
        res = telemetry_engine.inject_roadblock(
            roadblock_id=request.roadblock_id or "RB-KASARA-01",
            name=request.name or "Kasara Ghat Landslide",
            corridor_node=request.corridor_node or "KSR",
            latitude=request.latitude or 19.6967,
            longitude=request.longitude or 73.5611,
            radius_km=request.radius_km or 15.0,
            severity=request.severity or "CRITICAL",
            description=request.description or "High congestion & road closure",
            penalty_multiplier=request.penalty_multiplier or 10.0,
            target_vehicle_id=request.target_vehicle_id
        )

        # Broadcast REROUTE_EVENT and updated tick
        reroute_broadcast = {
            "type": "REROUTE_EVENT",
            **res
        }
        await telemetry_hub.broadcast(reroute_broadcast)
        await telemetry_hub.broadcast(telemetry_engine.get_tick_payload())

        return res
    except Exception as e:
        logger.error("Failed to inject disruption: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to inject corridor disruption: {str(e)}"
        )


@router.post("/clear-disruptions")
async def clear_disruptions(
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "director", "admin"]))
):
    """Clears active roadblocks and restores standard corridor trajectories."""
    res = telemetry_engine.clear_roadblocks()
    await telemetry_hub.broadcast({
        "type": "ROADBLOCKS_CLEARED",
        **res
    })
    await telemetry_hub.broadcast(telemetry_engine.get_tick_payload())
    return res


@router.post("/set-route")
def set_vehicle_route(
    request: SetVehicleRouteRequest,
    _persona: Dict[str, Any] = Depends(require_role(["dispatcher", "director", "admin"]))
):
    """Updates active vehicle simulation trajectory from Route Optimizer output."""
    telemetry_engine.set_active_route(
        vehicle_id=request.vehicle_id,
        route_data={
            "route_geometry": request.route_geometry,
            "total_distance_km": request.total_distance_km
        }
    )
    return {"status": "SUCCESS", "vehicle_id": request.vehicle_id}
