import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.rbac import RBACMiddleware
from app.api.v1.router import api_router
from app.api.v1.telemetry import telemetry_hub
from app.db.connection import db_manager
from app.db.seed_data import seed_initial_data

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("smart_logistics")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Cognitive Smart Logistics Platform Backend...")
    # Initialize DB connection manager with fallback
    db_manager.initialize()
    # Seed initial Western India corridor data
    seed_initial_data()
    logger.info("Backend services initialized and seeded successfully.")
    yield
    logger.info("Shutting down Cognitive Smart Logistics Platform Backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Cognitive Software-Driven Smart Logistics & Multi-Agent Orchestration Platform",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Persona-Role"]
)

# RBAC Middleware
app.add_middleware(RBACMiddleware)

# Include API v1 Router
app.include_router(api_router)


@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await telemetry_hub.handle_client(websocket)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/v1/health"
    }
