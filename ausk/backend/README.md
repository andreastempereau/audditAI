# CrossAudit AI Backend API

A comprehensive FastAPI backend for the CrossAudit AI Governance Platform providing authentication, document management, chat functionality, RBAC, audit logging, and administrative features.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Document Management**: File upload, versioning, and fragment-based search
- **Real-time Chat**: WebSocket-powered chat system with threading
- **RBAC**: Comprehensive role and permission management
- **Audit Logging**: Complete audit trail with advanced filtering
- **Metrics Collection**: System and custom metrics with aggregation
- **Admin Features**: API key management, webhooks, billing integration
- **Async Architecture**: Built with async/await for high performance

## Tech Stack

- **FastAPI**: Modern, fast web framework
- **SQLModel**: Type-safe database ORM
- **PostgreSQL**: Primary database with async support
- **Redis**: Caching and session management
- **MinIO**: S3-compatible object storage
- **JWT**: Secure token-based authentication
- **WebSocket**: Real-time communication
- **Docker**: Containerized deployment

## Quick Start

### Development Setup

1. **Install Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   # or with Poetry
   poetry install
   ```

2. **Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Services**
   ```bash
   # Start database and Redis
   docker-compose -f ../docker-compose.backend.yml up postgres redis minio -d
   
   # Run migrations
   python scripts/migrate.py
   
   # Start the API server
   uvicorn app.main:app --reload --host 0.0.0.0 --port 9000
   ```

### Docker Setup

```bash
# Build and start all services
docker-compose -f docker-compose.backend.yml up --build

# Or start individual services
docker-compose -f docker-compose.backend.yml up postgres redis minio -d
docker-compose -f docker-compose.backend.yml up backend
```

## API Documentation

Once running, access the interactive API documentation:

- **Swagger UI**: http://localhost:9000/docs
- **ReDoc**: http://localhost:9000/redoc
- **OpenAPI Spec**: http://localhost:9000/openapi.json

## Project Structure

```
backend/
├── app/
│   ├── core/              # Core configuration and utilities
│   │   ├── config.py      # Settings and environment variables
│   │   ├── database.py    # Database connection and session management
│   │   └── middleware.py  # Custom middleware (auth, RBAC, audit, metrics)
│   ├── models/            # SQLModel database models
│   │   ├── auth.py        # User and organization models
│   │   ├── chat.py        # Chat threads and messages
│   │   ├── documents.py   # Document management models
│   │   ├── rbac.py        # Role-based access control models
│   │   ├── audit.py       # Audit logging and metrics models
│   │   └── admin.py       # Admin features (API keys, webhooks, billing)
│   ├── routes/            # API route handlers
│   │   ├── auth.py        # Authentication endpoints
│   │   ├── organizations.py # Organization management
│   │   ├── chat.py        # Chat and WebSocket endpoints
│   │   ├── documents.py   # Document management endpoints
│   │   ├── rbac.py        # RBAC management endpoints
│   │   ├── audit.py       # Audit log endpoints
│   │   ├── metrics.py     # Metrics collection endpoints
│   │   └── admin.py       # Admin endpoints
│   ├── schemas/           # Pydantic request/response models
│   ├── services/          # Business logic layer
│   └── main.py           # FastAPI application setup
├── tests/                # Test suite
├── scripts/              # Utility scripts
├── docs/                 # Generated documentation
├── Dockerfile           # Container definition
├── pyproject.toml       # Poetry configuration
└── requirements.txt     # Python dependencies
```

## Core Features

### Authentication System
- User registration and login
- JWT access and refresh tokens
- Password reset functionality
- Organization-scoped authentication
- Profile management

### Document Management
- File upload with metadata
- Version control and history
- Fragment-based indexing for search
- Sensitivity classification
- Retention policies

### Chat System
- Real-time messaging with WebSocket
- Threaded conversations
- Typing indicators
- Message editing and deletion
- Private and public channels

### RBAC (Role-Based Access Control)
- Hierarchical role system
- Granular permission management
- Department-based organization
- Default role templates
- Permission inheritance

### Audit Logging
- Comprehensive activity tracking
- Automatic event capture
- Advanced filtering and search
- Compliance reporting
- Retention management

### Metrics & Monitoring
- Request timing and performance
- Custom business metrics
- Aggregation and analytics
- System health monitoring
- Usage statistics

### Admin Features
- API key management with scopes
- Webhook configuration
- Billing plan management
- Usage tracking and limits
- Organization settings

## Configuration

Key environment variables:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/crossaudit

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minio_access
MINIO_SECRET_KEY=minio_secret

# App
DEBUG=true
ALLOWED_ORIGINS=http://localhost:3000
ALLOWED_HOSTS=localhost,127.0.0.1
```

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_auth.py

# Run with verbose output
pytest -v
```

## Development

### Code Quality
```bash
# Format code
black app/
isort app/

# Lint code
flake8 app/

# Type checking
mypy app/
```

### Database Migrations
```bash
# Generate migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### API Documentation Generation
```bash
python scripts/generate_openapi.py
```

## Deployment

### Production Considerations
- Set strong JWT secret keys
- Configure proper CORS origins
- Enable HTTPS/TLS
- Set up proper monitoring
- Configure log aggregation
- Set up backup strategies
- Enable rate limiting

### Health Checks
- `/health` - Basic health check
- `/` - API status and version

## Security Features

- JWT token-based authentication
- RBAC permission system
- Automatic audit logging
- Request rate limiting (middleware)
- Input validation and sanitization
- CORS protection
- SQL injection prevention (SQLModel)
- XSS protection (FastAPI)

## Performance Features

- Async/await throughout
- Connection pooling
- Redis caching
- Optimized database queries
- Background task processing
- WebSocket for real-time features
- Middleware optimization

## Monitoring & Observability

- Request timing middleware
- Metrics collection
- Audit event tracking
- Health check endpoints
- Structured logging
- Error tracking integration ready

## Contributing

1. Follow code style guidelines (Black, isort)
2. Add tests for new features
3. Update documentation
4. Ensure type hints are present
5. Run the full test suite

## License

Copyright (c) 2024 CrossAudit AI. All rights reserved.