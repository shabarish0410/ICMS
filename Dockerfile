# ──────────────────────────────────────────────────────────────────────────────
# ICMS — Deployment Orchestrator
# ──────────────────────────────────────────────────────────────────────────────
# 
# This root Dockerfile is intentionally kept minimal to act as documentation.
# The project has been optimized into separate microservices (frontend/backend)
# to drastically reduce image sizes, improve caching, and increase security.
#
# Please use Docker Compose to build and run the application:
# 
#   docker compose build
#   docker compose up -d
#
# See docker-compose.yml for the full service definitions.
# 
# Image sizes have been reduced by ~90-95%:
# - Backend: multi-stage build via backend/Dockerfile (<300MB)
# - Frontend: Next.js standalone mode via frontend/Dockerfile (<140MB)
#
FROM scratch
