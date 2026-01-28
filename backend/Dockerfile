# Multi-stage build for optimized image size
FROM python:3.12-slim as builder

# Install system dependencies including FFmpeg and libmagic
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libmagic1 \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies using uv
RUN uv pip install --system -r pyproject.toml


# Final stage - runtime
FROM python:3.12-slim

# Install only runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /tmp/genova && \
    chown -R appuser:appuser /tmp/genova

# Set working directory
WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose port (Cloud Run will provide PORT environment variable)
EXPOSE 8000

# Environment variables for Cloud Run
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FILE_SAVE_DIR=/tmp/genova

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:${PORT:-8000}/health', timeout=5.0)" || exit 1

# Start application using uvicorn directly
# Cloud Run provides PORT environment variable
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
