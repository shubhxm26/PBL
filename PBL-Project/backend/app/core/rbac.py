from typing import Dict, Any, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import HTTPException, status, Depends


PERSONA_PROFILES: Dict[str, Dict[str, Any]] = {
    "director": {
        "role": "director",
        "title": "Supply Chain Director",
        "description": "Strategic network KPI oversight, demand forecasting, risk stress-testing, and executive analytics.",
        "badge_color": "orange",
        "permissions": {
            "views": ["dashboard", "forecasting", "routing", "twin", "telemetry", "kpis"],
            "actions": ["view_kpis", "run_forecast", "view_fleet", "optimize_routes", "inject_roadblock", "telemetry_control", "run_twin_simulation", "export_reports"]
        }
    },
    "dispatcher": {
        "role": "dispatcher",
        "title": "Fleet Dispatcher",
        "description": "Real-time fleet tracking, dynamic route optimization, freight matching, and live telematics.",
        "badge_color": "emerald",
        "permissions": {
            "views": ["dashboard", "routing", "telemetry"],
            "actions": ["view_fleet", "optimize_routes", "inject_roadblock", "match_freight", "telemetry_control"]
        }
    },
    "customs": {
        "role": "customs",
        "title": "Customs Officer",
        "description": "Automated trade document ingestion, HS code classification, and discrepancy compliance checks.",
        "badge_color": "amber",
        "permissions": {
            "views": ["dashboard", "compliance"],
            "actions": ["view_documents", "parse_documents", "classify_hs", "review_flags"]
        }
    },
    "admin": {
        "role": "admin",
        "title": "Enterprise IT Administrator",
        "description": "System health monitoring, model fine-tuning orchestration, data pipeline connectivity, and RBAC control.",
        "badge_color": "coral",
        "permissions": {
            "views": ["dashboard", "forecasting", "routing", "compliance", "twin", "telemetry", "system"],
            "actions": ["*"]
        }
    }
}

DEFAULT_PERSONA = "director"


def get_persona_profile(role: str) -> Dict[str, Any]:
    norm_role = role.strip().lower() if role else DEFAULT_PERSONA
    if norm_role not in PERSONA_PROFILES:
        return PERSONA_PROFILES[DEFAULT_PERSONA]
    return PERSONA_PROFILES[norm_role]


class RBACMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        role_header = request.headers.get("X-Persona-Role", DEFAULT_PERSONA)
        persona = get_persona_profile(role_header)
        request.state.persona = persona
        
        response = await call_next(request)
        response.headers["X-Persona-Role"] = persona["role"]
        return response


def get_current_persona(request: Request) -> Dict[str, Any]:
    if hasattr(request.state, "persona") and request.state.persona:
        return request.state.persona
    role_header = request.headers.get("X-Persona-Role", DEFAULT_PERSONA)
    return get_persona_profile(role_header)


def require_role(allowed_roles: List[str]):
    def role_checker(persona: Dict[str, Any] = Depends(get_current_persona)):
        role = persona.get("role", "")
        if role == "admin" or role in allowed_roles:
            return persona
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Persona '{persona.get('title')}' is not authorized to access this resource. Required role: {', '.join(allowed_roles)}"
        )
    return role_checker


def require_permission(action: str):
    def permission_checker(persona: Dict[str, Any] = Depends(get_current_persona)):
        actions = persona.get("permissions", {}).get("actions", [])
        if "*" in actions or action in actions:
            return persona
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Persona '{persona.get('title')}' does not have required action permission: '{action}'"
        )
    return permission_checker
