from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.persona import router as persona_router
from app.api.v1.admin import router as admin_router
from app.api.v1.forecasting import router as forecasting_router
from app.api.v1.routing import router as routing_router
from app.api.v1.telemetry import router as telemetry_router
from app.api.v1.compliance import router as compliance_router
from app.api.v1.twin import router as twin_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health_router)
api_router.include_router(persona_router)
api_router.include_router(admin_router)
api_router.include_router(forecasting_router)
api_router.include_router(routing_router)
api_router.include_router(telemetry_router)
api_router.include_router(compliance_router)
api_router.include_router(twin_router)
