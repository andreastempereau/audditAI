#!/bin/bash
# CrossAudit AI Backend Startup Script

set -e

echo "Starting CrossAudit AI Backend..."

# Load environment variables
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set default values
export ENVIRONMENT=${ENVIRONMENT:-development}
export DATABASE_URL=${DATABASE_URL:-postgresql+asyncpg://postgres:postgres@localhost:5432/crossaudit}
export REDIS_URL=${REDIS_URL:-redis://localhost:6379/0}

echo "Environment: $ENVIRONMENT"

# Function to wait for service
wait_for_service() {
    local service_name=$1
    local host=$2
    local port=$3
    local max_attempts=30
    local attempt=1

    echo "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z $host $port 2>/dev/null; then
            echo "$service_name is ready!"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts: $service_name not ready, waiting 2 seconds..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "ERROR: $service_name failed to become ready after $max_attempts attempts"
    return 1
}

# Extract database host and port from DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

# Extract Redis host and port from REDIS_URL
REDIS_HOST=$(echo $REDIS_URL | sed -n 's/redis:\/\/\([^:]*\):.*/\1/p')
REDIS_PORT=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

# Wait for dependencies
if [ "$ENVIRONMENT" != "test" ]; then
    wait_for_service "PostgreSQL" ${DB_HOST:-localhost} ${DB_PORT:-5432}
    wait_for_service "Redis" ${REDIS_HOST:-localhost} ${REDIS_PORT:-6379}
fi

# Initialize database if needed
if [ "$INIT_DB" = "true" ] || [ "$1" = "init-db" ]; then
    echo "Initializing database..."
    python -m app.scripts.init_db
fi

# Run migrations
if [ "$RUN_MIGRATIONS" = "true" ] || [ "$1" = "migrate" ]; then
    echo "Running database migrations..."
    python -m app.scripts.init_db
fi

# Start the application
case "$1" in
    "worker")
        echo "Starting Celery worker..."
        exec python -m app.worker
        ;;
    "beat")
        echo "Starting Celery beat scheduler..."
        exec celery -A app.celery_app beat --loglevel=info
        ;;
    "flower")
        echo "Starting Flower monitoring..."
        exec celery -A app.celery_app flower --port=5555
        ;;
    "init-db")
        echo "Database initialization completed."
        exit 0
        ;;
    "migrate")
        echo "Database migration completed."
        exit 0
        ;;
    *)
        echo "Starting FastAPI server..."
        
        # Determine host and port
        HOST=${HOST:-0.0.0.0}
        PORT=${PORT:-8000}
        
        if [ "$ENVIRONMENT" = "development" ]; then
            echo "Starting in development mode with auto-reload..."
            exec uvicorn app.main:app --host $HOST --port $PORT --reload
        else
            echo "Starting in production mode..."
            exec uvicorn app.main:app --host $HOST --port $PORT --workers 4
        fi
        ;;
esac