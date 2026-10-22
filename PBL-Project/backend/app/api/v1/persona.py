from fastapi import APIRouter, Depends
from typing import Dict, Any
from app.core.rbac import get_current_persona, PERSONA_PROFILES

router = APIRouter(prefix="/persona", tags=["Persona"])


@router.get("/profile")
def get_profile(persona: Dict[str, Any] = Depends(get_current_persona)):
    """Return the resolved persona profile from request state / X-Persona-Role header."""
    return persona


@router.get("/roles")
def get_all_roles():
    """Return all available persona definitions for top-bar persona switcher."""
    return {
        "roles": list(PERSONA_PROFILES.keys()),
        "profiles": PERSONA_PROFILES
    }
