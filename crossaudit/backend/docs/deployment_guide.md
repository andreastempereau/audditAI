# CrossAudit AI Deployment Guide

## Overview

This guide covers the complete deployment process for CrossAudit AI, from local development to production deployment using various infrastructure options including Docker, Kubernetes, AWS ECS, and traditional server deployments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Local Development](#local-development)
5. [Docker Deployment](#docker-deployment)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [AWS ECS Deployment](#aws-ecs-deployment)
8. [Traditional Server Deployment](#traditional-server-deployment)
9. [CI/CD Pipeline](#cicd-pipeline)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Security Considerations](#security-considerations)
12. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 1Gbps

**Recommended Production:**
- CPU: 8 cores
- RAM: 16GB
- Storage: 100GB SSD
- Network: 10Gbps

### Software Dependencies

- **Python**: 3.11+
- **Node.js**: 18+ (for frontend)
- **PostgreSQL**: 15+
- **Redis**: 7+
- **Docker**: 24+ (for containerized deployment)
- **Kubernetes**: 1.28+ (for k8s deployment)

### External Services

- **Email Service**: SMTP server or service (SendGrid, AWS SES, etc.)
- **AI Providers**: API keys for OpenAI, Anthropic, Google AI
- **Payment Processing**: Stripe account (for billing features)
- **File Storage**: AWS S3 or compatible service
- **Monitoring**: DataDog, Prometheus, or similar

## Environment Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```bash
# Application Settings
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=info
SECRET_KEY=your-super-secret-key-change-this

# Database Configuration
DATABASE_URL=postgresql+asyncpg://username:password@host:5432/crossaudit
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30

# Redis Configuration
REDIS_URL=redis://username:password@host:6379/0
REDIS_POOL_SIZE=20

# Security Settings
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
ENCRYPTION_KEY=your-32-byte-encryption-key

# CORS and Security
ALLOWED_ORIGINS=https://your-domain.com,https://app.your-domain.com
ALLOWED_HOSTS=your-domain.com,app.your-domain.com
FRONTEND_URL=https://app.your-domain.com

# Email Configuration
SMTP_SERVER=smtp.your-email-provider.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_USE_TLS=true
FROM_EMAIL=noreply@your-domain.com

# AI Service API Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key

# Stripe Configuration (for billing)
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_PRICE_ID_STARTER=price_starter_plan_id
STRIPE_PRICE_ID_BUSINESS=price_business_plan_id
STRIPE_PRICE_ID_ENTERPRISE=price_enterprise_plan_id

# File Storage
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-crossaudit-bucket

# Celery Configuration
CELERY_BROKER_URL=redis://username:password@host:6379/1
CELERY_RESULT_BACKEND=redis://username:password@host:6379/2
CELERY_WORKER_CONCURRENCY=4
CELERY_BEAT_SCHEDULE_DB=celerybeat-schedule

# Monitoring and Observability
DATADOG_API_KEY=your-datadog-api-key
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

# Feature Flags
ENABLE_BILLING=true
ENABLE_ANALYTICS=true
ENABLE_CHAT_INFERENCE=true
ENABLE_DOCUMENT_PROCESSING=true
```

### Configuration Validation

```bash
# Validate configuration
python -c "from app.core.config import get_settings; settings = get_settings(); print('Configuration valid')"

# Test database connection
python -c "from app.core.database import test_connection; asyncio.run(test_connection())"

# Test Redis connection
python -c "import redis; r = redis.from_url('$REDIS_URL'); r.ping(); print('Redis connected')"
```

## Database Setup

### PostgreSQL Installation and Configuration

#### Ubuntu/Debian
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE crossaudit;
CREATE USER crossaudit_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE crossaudit TO crossaudit_user;
ALTER USER crossaudit_user CREATEDB;  # For running tests
\q
```

#### Docker PostgreSQL
```bash
# Run PostgreSQL in Docker
docker run -d \
  --name crossaudit-postgres \
  -e POSTGRES_DB=crossaudit \
  -e POSTGRES_USER=crossaudit_user \
  -e POSTGRES_PASSWORD=your-secure-password \
  -p 5432:5432 \
  -v crossaudit_postgres_data:/var/lib/postgresql/data \
  postgres:15

# Install extensions
docker exec -it crossaudit-postgres psql -U crossaudit_user -d crossaudit
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
\q
```

### Database Migrations

```bash
# Initialize database with schema and seed data
python -m app.scripts.init_db

# Run specific migration
python -m app.scripts.migrate --target 004_governance_and_billing

# Reset database (development only)
python -m app.scripts.init_db --reset
```

### Redis Setup

#### Ubuntu/Debian
```bash
# Install Redis
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set password: requirepass your-redis-password
# Set max memory: maxmemory 2gb
# Set eviction policy: maxmemory-policy allkeys-lru

sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

#### Docker Redis
```bash
# Run Redis in Docker
docker run -d \
  --name crossaudit-redis \
  -p 6379:6379 \
  -v crossaudit_redis_data:/data \
  redis:7 redis-server --requirepass your-redis-password
```

## Local Development

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/crossaudit.git
cd crossaudit

# Setup Python environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements-dev.txt

# Setup pre-commit hooks
pre-commit install

# Initialize database
cp .env.example .env
# Edit .env with your local configuration
python -m app.scripts.init_db

# Start development servers
# Terminal 1: API server
./scripts/start.sh

# Terminal 2: Celery worker
./scripts/start.sh worker

# Terminal 3: Celery beat scheduler
./scripts/start.sh beat

# Terminal 4: Frontend (if developing)
cd frontend
npm install
npm run dev
```

### Development Tools

```bash
# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html

# Code formatting
black app/
isort app/

# Type checking
mypy app/

# Security scanning
bandit -r app/

# API documentation
python scripts/generate_openapi.py
```

## Docker Deployment

### Single Container Development

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start command
CMD ["./scripts/start.sh"]
```

```bash
# Build and run
docker build -t crossaudit-api .
docker run -d \
  --name crossaudit-api \
  -p 8000:8000 \
  --env-file .env \
  crossaudit-api
```

### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: crossaudit
      POSTGRES_USER: crossaudit_user
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crossaudit_user -d crossaudit"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql+asyncpg://crossaudit_user:${DATABASE_PASSWORD}@postgres:5432/crossaudit
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
    env_file:
      - .env
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: ./scripts/start.sh worker
    environment:
      - DATABASE_URL=postgresql+asyncpg://crossaudit_user:${DATABASE_PASSWORD}@postgres:5432/crossaudit
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 2

  beat:
    build:
      context: .
      dockerfile: Dockerfile
    command: ./scripts/start.sh beat
    environment:
      - DATABASE_URL=postgresql+asyncpg://crossaudit_user:${DATABASE_PASSWORD}@postgres:5432/crossaudit
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 1

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

```bash
# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale api=4 --scale worker=6

# View logs
docker-compose -f docker-compose.prod.yml logs -f api

# Update deployment
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Kubernetes Deployment

### Namespace and RBAC

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: crossaudit
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: crossaudit
  namespace: crossaudit
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: crossaudit
  name: crossaudit-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: crossaudit-rolebinding
  namespace: crossaudit
subjects:
- kind: ServiceAccount
  name: crossaudit
  namespace: crossaudit
roleRef:
  kind: Role
  name: crossaudit-role
  apiGroup: rbac.authorization.k8s.io
```

### ConfigMaps and Secrets

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: crossaudit-config
  namespace: crossaudit
data:
  ENVIRONMENT: "production"
  DEBUG: "false"
  LOG_LEVEL: "info"
  ALLOWED_ORIGINS: "https://your-domain.com"
  FRONTEND_URL: "https://app.your-domain.com"
  ENABLE_BILLING: "true"
  ENABLE_ANALYTICS: "true"
---
apiVersion: v1
kind: Secret
metadata:
  name: crossaudit-secrets
  namespace: crossaudit
type: Opaque
stringData:
  SECRET_KEY: "your-super-secret-key"
  JWT_SECRET_KEY: "your-jwt-secret-key"
  ENCRYPTION_KEY: "your-32-byte-encryption-key"
  DATABASE_URL: "postgresql+asyncpg://user:pass@postgres:5432/crossaudit"
  REDIS_URL: "redis://:password@redis:6379/0"
  OPENAI_API_KEY: "sk-your-openai-key"
  STRIPE_SECRET_KEY: "sk_live_your-stripe-key"
  AWS_ACCESS_KEY_ID: "your-aws-key"
  AWS_SECRET_ACCESS_KEY: "your-aws-secret"
```

### Database Deployment

```yaml
# k8s/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: crossaudit
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: crossaudit
        - name: POSTGRES_USER
          value: crossaudit_user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: crossaudit
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

### Application Deployment

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crossaudit-api
  namespace: crossaudit
spec:
  replicas: 3
  selector:
    matchLabels:
      app: crossaudit-api
  template:
    metadata:
      labels:
        app: crossaudit-api
    spec:
      serviceAccountName: crossaudit
      containers:
      - name: api
        image: your-registry/crossaudit-api:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: crossaudit-config
        - secretRef:
            name: crossaudit-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: crossaudit-api-service
  namespace: crossaudit
spec:
  selector:
    app: crossaudit-api
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
```

### Worker Deployment

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crossaudit-worker
  namespace: crossaudit
spec:
  replicas: 4
  selector:
    matchLabels:
      app: crossaudit-worker
  template:
    metadata:
      labels:
        app: crossaudit-worker
    spec:
      serviceAccountName: crossaudit
      containers:
      - name: worker
        image: your-registry/crossaudit-api:latest
        command: ["./scripts/start.sh", "worker"]
        envFrom:
        - configMapRef:
            name: crossaudit-config
        - secretRef:
            name: crossaudit-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crossaudit-beat
  namespace: crossaudit
spec:
  replicas: 1
  selector:
    matchLabels:
      app: crossaudit-beat
  template:
    metadata:
      labels:
        app: crossaudit-beat
    spec:
      serviceAccountName: crossaudit
      containers:
      - name: beat
        image: your-registry/crossaudit-api:latest
        command: ["./scripts/start.sh", "beat"]
        envFrom:
        - configMapRef:
            name: crossaudit-config
        - secretRef:
            name: crossaudit-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
```

### Ingress Configuration

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: crossaudit-ingress
  namespace: crossaudit
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.your-domain.com
    secretName: crossaudit-api-tls
  rules:
  - host: api.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: crossaudit-api-service
            port:
              number: 80
```

### Deployment Commands

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Check deployment status
kubectl get pods -n crossaudit
kubectl get services -n crossaudit
kubectl get ingress -n crossaudit

# View logs
kubectl logs -f deployment/crossaudit-api -n crossaudit

# Scale deployment
kubectl scale deployment crossaudit-api --replicas=6 -n crossaudit
kubectl scale deployment crossaudit-worker --replicas=8 -n crossaudit

# Rolling update
kubectl set image deployment/crossaudit-api api=your-registry/crossaudit-api:v2.0 -n crossaudit
kubectl rollout status deployment/crossaudit-api -n crossaudit

# Rollback if needed
kubectl rollout undo deployment/crossaudit-api -n crossaudit
```

## AWS ECS Deployment

### ECS Task Definitions

```json
{
  "family": "crossaudit-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/crossauditTaskRole",
  "containerDefinitions": [
    {
      "name": "crossaudit-api",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/crossaudit-api:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "ENVIRONMENT",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:crossaudit/database-url"
        },
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:crossaudit/openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/crossaudit-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### Terraform ECS Configuration

```hcl
# infrastructure/ecs.tf
resource "aws_ecs_cluster" "crossaudit" {
  name = "crossaudit"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_service" "api" {
  name            = "crossaudit-api"
  cluster         = aws_ecs_cluster.crossaudit.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 3
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "crossaudit-api"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.api]
}

resource "aws_ecs_service" "worker" {
  name            = "crossaudit-worker"
  cluster         = aws_ecs_cluster.crossaudit.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 4
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.worker.id]
  }
}
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy CrossAudit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v4

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements-dev.txt

    - name: Run tests
      run: |
        pytest --cov=app --cov-report=xml
      env:
        DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/postgres
        REDIS_URL: redis://localhost:6379/0

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging

    steps:
    - name: Deploy to staging
      run: |
        # Deploy to staging environment
        echo "Deploying to staging..."
        # Add your staging deployment commands here

  deploy-production:
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
    - name: Deploy to production
      run: |
        # Deploy to production environment
        echo "Deploying to production..."
        # Add your production deployment commands here
```

### Blue-Green Deployment Script

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

NAMESPACE="crossaudit"
IMAGE_TAG=$1
ENVIRONMENT=${2:-production}

if [ -z "$IMAGE_TAG" ]; then
    echo "Usage: $0 <image-tag> [environment]"
    exit 1
fi

echo "Starting blue-green deployment for image tag: $IMAGE_TAG"

# Determine current and new colors
CURRENT_COLOR=$(kubectl get service crossaudit-api-service -n $NAMESPACE -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "blue")
if [ "$CURRENT_COLOR" = "blue" ]; then
    NEW_COLOR="green"
else
    NEW_COLOR="blue"
fi

echo "Current color: $CURRENT_COLOR, New color: $NEW_COLOR"

# Deploy new version with new color
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crossaudit-api-$NEW_COLOR
  namespace: $NAMESPACE
spec:
  replicas: 3
  selector:
    matchLabels:
      app: crossaudit-api
      color: $NEW_COLOR
  template:
    metadata:
      labels:
        app: crossaudit-api
        color: $NEW_COLOR
    spec:
      containers:
      - name: api
        image: ghcr.io/your-org/crossaudit:$IMAGE_TAG
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: crossaudit-config
        - secretRef:
            name: crossaudit-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
EOF

# Wait for new deployment to be ready
echo "Waiting for new deployment to be ready..."
kubectl rollout status deployment/crossaudit-api-$NEW_COLOR -n $NAMESPACE --timeout=300s

# Run health checks
echo "Running health checks..."
NEW_POD=$(kubectl get pods -n $NAMESPACE -l color=$NEW_COLOR -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n $NAMESPACE $NEW_POD -- curl -f http://localhost:8000/health/ready

# Switch traffic to new version
echo "Switching traffic to new version..."
kubectl patch service crossaudit-api-service -n $NAMESPACE -p '{"spec":{"selector":{"color":"'$NEW_COLOR'"}}}'

# Wait a bit and verify
sleep 30
echo "Verifying new deployment..."
curl -f https://api.your-domain.com/health

# Clean up old deployment
echo "Cleaning up old deployment..."
kubectl delete deployment crossaudit-api-$CURRENT_COLOR -n $NAMESPACE --ignore-not-found=true

echo "Blue-green deployment completed successfully!"
```

## Monitoring and Logging

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'crossaudit-api'
    static_configs:
      - targets: ['api.crossaudit.svc.cluster.local:8000']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "id": null,
    "title": "CrossAudit AI Monitoring",
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Policy Evaluations per Second",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(policy_evaluations_total[1m])",
            "legendFormat": "Evaluations/sec"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules

```yaml
# monitoring/alerts.yml
groups:
- name: crossaudit-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} for the last 5 minutes"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s"

  - alert: DatabaseConnectionFailure
    expr: up{job="postgres"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database is down"
      description: "PostgreSQL database is not responding"

  - alert: CeleryWorkerDown
    expr: absent(celery_worker_up) or celery_worker_up == 0
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Celery worker is down"
      description: "One or more Celery workers are not responding"
```

## Security Considerations

### SSL/TLS Configuration

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/ssl/certs/crossaudit.crt;
    ssl_certificate_key /etc/ssl/private/crossaudit.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://api-backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Network Security

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: crossaudit-network-policy
  namespace: crossaudit
spec:
  podSelector:
    matchLabels:
      app: crossaudit-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to: []
    ports:
    - protocol: TCP
      port: 443  # HTTPS egress
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53   # DNS
```

### Secret Management

```bash
# Using AWS Secrets Manager
aws secretsmanager create-secret \
    --name crossaudit/database-url \
    --description "CrossAudit database connection string" \
    --secret-string "postgresql+asyncpg://user:pass@host:5432/db"

# Using Kubernetes secrets
kubectl create secret generic crossaudit-secrets \
    --from-literal=database-url="postgresql+asyncpg://..." \
    --from-literal=jwt-secret="your-jwt-secret" \
    --namespace crossaudit
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues

```bash
# Check database connectivity
kubectl exec -it deployment/crossaudit-api -n crossaudit -- \
    python -c "from app.core.database import test_connection; import asyncio; asyncio.run(test_connection())"

# Check database logs
kubectl logs statefulset/postgres -n crossaudit

# Check for connection pool exhaustion
kubectl exec -it deployment/crossaudit-api -n crossaudit -- \
    python -c "from app.core.database import get_async_session; print('Pool size:', get_async_session.pool_size)"
```

#### 2. Redis Connection Issues

```bash
# Test Redis connectivity
kubectl exec -it deployment/crossaudit-api -n crossaudit -- \
    python -c "import redis; r = redis.from_url('redis://redis:6379'); print(r.ping())"

# Check Redis memory usage
kubectl exec -it statefulset/redis -n crossaudit -- redis-cli info memory
```

#### 3. Celery Worker Issues

```bash
# Check worker status
kubectl logs deployment/crossaudit-worker -n crossaudit

# Monitor task queue
kubectl exec -it deployment/crossaudit-api -n crossaudit -- \
    celery -A app.celery_app inspect stats

# Check for stuck tasks
kubectl exec -it deployment/crossaudit-api -n crossaudit -- \
    celery -A app.celery_app inspect active
```

#### 4. Performance Issues

```bash
# Check resource usage
kubectl top pods -n crossaudit

# Check API metrics
curl https://api.your-domain.com/metrics

# Check database performance
kubectl exec -it statefulset/postgres -n crossaudit -- \
    psql -U crossaudit_user -d crossaudit -c "SELECT * FROM pg_stat_activity;"
```

### Health Check Endpoints

```bash
# Basic health check
curl https://api.your-domain.com/health

# Detailed health check
curl https://api.your-domain.com/health/detailed

# Readiness check
curl https://api.your-domain.com/health/ready

# Liveness check
curl https://api.your-domain.com/health/live
```

### Log Analysis

```bash
# View application logs
kubectl logs -f deployment/crossaudit-api -n crossaudit

# Search for errors
kubectl logs deployment/crossaudit-api -n crossaudit | grep -i error

# View specific time range
kubectl logs deployment/crossaudit-api -n crossaudit --since=1h

# Get logs from all containers
kubectl logs -f deployment/crossaudit-api -n crossaudit --all-containers=true
```

This comprehensive deployment guide covers all aspects of deploying CrossAudit AI from development to production across various infrastructure platforms.