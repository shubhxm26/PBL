import os
from datetime import datetime, timezone
from typing import Dict, Any
from app.config import settings
from app.db.connection import db_manager


def get_platform_diagnostics() -> Dict[str, Any]:
    """
    Consolidated infrastructure health & operational diagnostics:
    - PostgreSQL connection / In-memory SQLite fallback
    - Redis connection / In-memory Redis fallback
    - PyTorch neural model checkpoint weights & architecture metadata
    - Google Gemini AI SDK configuration & local RAG index readiness
    """
    services = db_manager.get_services_health()

    # Checkpoint paths
    checkpoint_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "checkpoints")
    fc_path = os.path.join(checkpoint_dir, "forecasting_lstm.pt")
    rt_path = os.path.join(checkpoint_dir, "routing_drl.pt")

    fc_exists = os.path.exists(fc_path)
    fc_size_kb = round(os.path.getsize(fc_path) / 1024, 1) if fc_exists else 0
    fc_mtime = (
        datetime.fromtimestamp(os.path.getmtime(fc_path), tz=timezone.utc).isoformat()
        if fc_exists else None
    )

    rt_exists = os.path.exists(rt_path)
    rt_size_kb = round(os.path.getsize(rt_path) / 1024, 1) if rt_exists else 0
    rt_mtime = (
        datetime.fromtimestamp(os.path.getmtime(rt_path), tz=timezone.utc).isoformat()
        if rt_exists else None
    )

    has_gemini_key = bool(settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("your_"))

    services["models"] = {
        "status": "ready" if (fc_exists and rt_exists) else "degraded",
        "forecasting_lstm": {
            "checkpoint_present": fc_exists,
            "file_size_kb": fc_size_kb,
            "last_modified": fc_mtime,
            "architecture": "PyTorch Multi-Horizon LSTM (5 Features -> 48 Hidden -> 30 Horizon Points/Variance)"
        },
        "routing_drl": {
            "checkpoint_present": rt_exists,
            "file_size_kb": rt_size_kb,
            "last_modified": rt_mtime,
            "architecture": "PyTorch DRL Attention Route Policy Network (5 Node/Context -> 64 Hidden -> Q-Scores)"
        }
    }

    services["external_ai"] = {
        "status": "configured" if has_gemini_key else "fallback_local_rules",
        "provider": "Google Gemini",
        "model": "gemini-2.5-flash",
        "api_key_configured": has_gemini_key,
        "rag_vector_engine": "Local PyTorch / Transformers Semantic Retrieval"
    }

    return services
