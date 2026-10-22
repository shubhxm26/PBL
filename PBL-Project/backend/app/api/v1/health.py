from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import settings
from app.core.diagnostics import get_platform_diagnostics

router = APIRouter(tags=["Health"])


@router.get("/health")
def get_health():
    services_health = get_platform_diagnostics()
    return {
        "status": "healthy",
        "services": services_health,
        "version": settings.VERSION,
        "project": settings.PROJECT_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

