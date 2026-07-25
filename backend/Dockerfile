# ─── Stage 1: Builder ──────────────────────────────────────────────────────────
# Builds Python wheels so the runtime stage has no compiler toolchain
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install only the build-time OS deps (gcc, libpq-dev for psycopg2, etc.)
# These will NOT appear in the final runtime image
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libpq-dev \
        libglib2.0-dev \
        libgl1-mesa-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and pre-compile all wheels into /wheels
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip wheel --wheel-dir=/wheels -r requirements.txt

# ─── Stage 2: Runtime ──────────────────────────────────────────────────────────
# Lean final image — no compiler, no build tools, non-root user
FROM python:3.12-slim AS runtime

LABEL org.opencontainers.image.title="ICMS Backend" \
      org.opencontainers.image.description="Spark Innovation Center — FastAPI Backend"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# Runtime-only OS deps (libpq for psycopg2, libglib/libgl for Pillow/OpenCV)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        libpq5 \
        libglib2.0-0 \
        libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install from pre-built wheels (no network, no compiler required)
COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install \
        --no-cache-dir \
        --no-index \
        --find-links=/wheels \
        -r requirements.txt \
    && rm -rf /wheels requirements.txt

# Copy application code
COPY --chown=appuser:appuser . .

# Ensure uploads directory exists and is writable
RUN mkdir -p uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 2 workers: safe for 512MB RAM (Render free tier)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
