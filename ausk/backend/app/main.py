"""
CrossAudit AI Backend API
FastAPI application with async SQLModel, WebSocket support, and comprehensive middleware.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as redis
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlmodel import create_engine, SQLModel
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import get_settings
from app.core.database import init_db
from app.core.error_handlers import register_error_handlers
from app.core.middleware import (
    AuditLoggingMiddleware,
    MetricsMiddleware,
    TimingMiddleware,
)
from app.routes import auth
from app.routes import organizations
from app.routes import chat
from app.routes import documents
from app.routes import fragments
from app.routes import rbac
from app.routes import audit
from app.routes import metrics
from app.routes import admin
from app.routes import health
from app.routes import websocket
from app.routes import policies
from app.routes import evaluators
from app.routes import governance
from app.routes import billing

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager."""
    logger.info("Starting CrossAudit API...")
    
    # Initialize database
    await init_db()
    
    # Initialize Redis connection
    app.state.redis = redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True
    )
    
    logger.info("CrossAudit API started successfully")
    
    yield
    
    # Cleanup
    if hasattr(app.state, 'redis'):
        await app.state.redis.close()
    
    logger.info("CrossAudit API stopped")


# Create FastAPI application
app = FastAPI(
    title="CrossAudit AI API",
    description="AI Governance and Audit Platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts,
)

app.add_middleware(TimingMiddleware)
app.add_middleware(MetricsMiddleware)
app.add_middleware(AuditLoggingMiddleware)

# Register error handlers
register_error_handlers(app)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(organizations.router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(fragments.router, prefix="/api/fragments", tags=["Fragments"])
app.include_router(rbac.router, prefix="/api/rbac", tags=["RBAC"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["Metrics"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(policies.router, prefix="/api/policies", tags=["Policies"])
app.include_router(evaluators.router, prefix="/api/evaluators", tags=["Evaluators"])
app.include_router(governance.router, prefix="/api/governance", tags=["Governance"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])
app.include_router(websocket.router, tags=["WebSocket"])


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "CrossAudit AI API v1.0.0"}


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=9000,
        reload=True,
        log_level="info",
    )