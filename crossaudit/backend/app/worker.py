#!/usr/bin/env python3
"""Celery worker startup script for CrossAudit AI."""

import logging
import sys
from app.celery_app import celery_app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Starting CrossAudit AI Celery worker...")
    
    # Start the worker
    celery_app.worker_main(sys.argv[1:] if len(sys.argv) > 1 else [
        "worker",
        "--loglevel=info",
        "--concurrency=4",
        "--pool=prefork"
    ])