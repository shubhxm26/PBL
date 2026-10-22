import logging
import time
from typing import Generator, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()


class InMemoryRedis:
    """In-memory key-value fallback when Redis daemon is not reachable."""
    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._ttls: Dict[str, float] = {}

    def get(self, key: str):
        if key in self._ttls and time.time() > self._ttls[key]:
            self.delete(key)
            return None
        val = self._store.get(key)
        if isinstance(val, str):
            return val.encode("utf-8")
        return val

    def set(self, key: str, value: Any, ex: int = None):
        if isinstance(value, bytes):
            self._store[key] = value.decode("utf-8")
        else:
            self._store[key] = value
        if ex:
            self._ttls[key] = time.time() + ex
        elif key in self._ttls:
            del self._ttls[key]
        return True

    def delete(self, *keys: str):
        count = 0
        for k in keys:
            if k in self._store:
                del self._store[k]
                count += 1
            if k in self._ttls:
                del self._ttls[k]
        return count

    def keys(self, pattern: str = "*"):
        return list(self._store.keys())

    def ping(self):
        return True


class DatabaseConnectionManager:
    def __init__(self):
        self._engine = None
        self._session_maker = None
        self._is_fallback = False
        self._pgvector_enabled = False
        self._redis_client = None
        self._redis_fallback = False
        self._initialized = False

    def initialize(self):
        if self._initialized:
            return

        # Initialize Database
        db_url = settings.DATABASE_URL
        try:
            logger.info("Attempting connection to primary PostgreSQL database...")
            # Try connecting with short timeout
            test_engine = create_engine(
                db_url,
                connect_args={"connect_timeout": 2},
                pool_pre_ping=True
            )
            with test_engine.connect() as conn:
                # Check pgvector extension
                res = conn.execute(
                    text("SELECT 1 FROM pg_extension WHERE extname = 'vector';")
                ).fetchone()
                self._pgvector_enabled = bool(res)
                
            self._engine = test_engine
            self._session_maker = sessionmaker(autocommit=False, autoflush=False, bind=self._engine)
            self._is_fallback = False
            logger.info("Connected successfully to PostgreSQL (pgvector=%s)", self._pgvector_enabled)
        except Exception as e:
            logger.warning(
                "PostgreSQL unreachable (%s). Initializing in-memory SQLite fallback...",
                str(e)
            )
            self._engine = create_engine(
                "sqlite:///:memory:",
                connect_args={"check_same_thread": False}
            )
            self._session_maker = sessionmaker(autocommit=False, autoflush=False, bind=self._engine)
            self._is_fallback = True
            self._pgvector_enabled = False

        # Initialize Redis
        try:
            import redis
            r = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=1.5, socket_connect_timeout=1.5)
            r.ping()
            self._redis_client = r
            self._redis_fallback = False
            logger.info("Connected successfully to Redis server.")
        except Exception as e:
            logger.warning("Redis server unreachable (%s). Using InMemoryRedis fallback...", str(e))
            self._redis_client = InMemoryRedis()
            self._redis_fallback = True

        self._initialized = True

    @property
    def engine(self):
        if not self._initialized:
            self.initialize()
        return self._engine

    @property
    def session_maker(self):
        if not self._initialized:
            self.initialize()
        return self._session_maker

    @property
    def redis_client(self):
        if not self._initialized:
            self.initialize()
        return self._redis_client

    def get_services_health(self) -> Dict[str, Any]:
        if not self._initialized:
            self.initialize()

        db_status = "fallback_in_memory" if self._is_fallback else "connected"
        dialect = "sqlite_in_memory" if self._is_fallback else "postgresql"
        redis_status = "fallback_in_memory" if self._redis_fallback else "connected"

        return {
            "database": {
                "status": db_status,
                "dialect": dialect,
                "pgvector": self._pgvector_enabled,
                "is_fallback": self._is_fallback
            },
            "redis": {
                "status": redis_status,
                "is_fallback": self._redis_fallback
            }
        }


db_manager = DatabaseConnectionManager()


def get_db() -> Generator:
    """FastAPI Dependency for database sessions."""
    db = db_manager.session_maker()
    try:
        yield db
    finally:
        db.close()


def get_redis():
    """FastAPI Dependency for Redis / in-memory cache client."""
    return db_manager.redis_client
