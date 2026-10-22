# 01: Core Architecture, Database & Persona Shell

**What to build:** An enterprise IT administrator or developer can launch the containerized data services (PostgreSQL with pgvector and Redis) or run with automatic in-memory fallback, start the FastAPI backend and Vite+React frontend, and access a dark-themed dashboard featuring a persistent top-bar Persona Switcher (Supply Chain Director, Fleet Dispatcher, Customs Officer, IT Administrator) with live system health and connectivity indicators.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] `docker-compose.yml` configures PostgreSQL 17 with `pgvector` and Redis with healthchecks and persistent volumes.
- [x] Backend starts with FastAPI, CORS, environment configuration, database connection manager with automatic in-memory fallback, and health check endpoint `/api/v1/health`.
- [x] RBAC middleware injects persona profile headers (`X-Persona-Role`) and validates role permissions.
- [x] Frontend initializes with Vite, React, Tailwind CSS dark-mode glassmorphic theme, and Lucide icons.
- [x] Top-bar Persona Switcher allows switching between Director, Dispatcher, Customs, and IT Admin roles, persisting state and dynamically adjusting active UI view permissions.
- [x] API integration tests verify `/api/v1/health` and persona header propagation.

