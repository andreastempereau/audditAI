# CrossAudit API Documentation

## Overview

The CrossAudit AI Governance Platform provides comprehensive APIs for managing documents, chat interactions, role-based access control (RBAC), audit logging, and administrative functions. This documentation covers the enhanced features including conditional permissions, webhook delivery, and real-time metrics.

## Authentication

### JWT Authentication
```http
Authorization: Bearer <jwt_token>
```

### API Key Authentication
```http
X-API-Key: <api_key>
```

**API Key Scopes:**
- `read` - Read-only access to documents and chat
- `write` - Create and modify documents and chat
- `admin` - Full administrative access

## RBAC (Role-Based Access Control) API

### Enhanced Features
- **Sub-5ms Permission Checks** with Redis caching
- **Conditional Permissions** with context-aware evaluation
- **Bulk Permission Operations** for performance
- **Real-time Analytics** and usage tracking

### Endpoints

#### GET /api/rbac/roles
Get all roles for organization.

**Required Permission:** `admin.role:manage`

**Response:**
```json
{
  "roles": [
    {
      "id": "uuid",
      "name": "admin",
      "display_name": "Administrator",
      "description": "Full system access",
      "is_system_role": true,
      "is_active": true,
      "permissions": ["admin.full", "documents.write"],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/rbac/roles
Create new role.

**Required Permission:** `admin.role:manage`

**Request Body:**
```json
{
  "name": "manager",
  "display_name": "Manager",
  "description": "Team management role"
}
```

#### GET /api/rbac/permissions
Get all system permissions.

**Required Permission:** `admin.role:manage`

**Response:**
```json
{
  "permissions": [
    {
      "id": "uuid",
      "name": "document:read",
      "display_name": "Read Documents",
      "description": "View documents",
      "resource": "document",
      "action": "read",
      "conditions": {
        "max_classification": "restricted",
        "own_only": false
      },
      "is_active": true
    }
  ]
}
```

#### POST /api/rbac/permissions/check
Check user permissions (bulk operation).

**Required Permission:** `admin.role:manage`

**Request Body:**
```json
{
  "user_id": "uuid",
  "checks": [
    {
      "permission": "document:read",
      "context": {
        "resource_owner_id": "uuid",
        "classification": "confidential"
      }
    },
    {
      "permission": "chat.message:create"
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "permission": "document:read",
      "allowed": true,
      "reason": "Permission granted with context"
    },
    {
      "permission": "chat.message:create",
      "allowed": false,
      "reason": "Permission not found"
    }
  ]
}
```

#### GET /api/rbac/analytics
Get RBAC analytics for organization.

**Required Permission:** `admin.role:manage`

**Query Parameters:**
- `days` (optional): Number of days to analyze (default: 30)

**Response:**
```json
{
  "role_distribution": [
    {
      "role": "admin",
      "display_name": "Administrator",
      "user_count": 2
    }
  ],
  "permission_usage": [
    {
      "permission": "document:read",
      "resource": "document",
      "action": "read",
      "user_count": 15
    }
  ],
  "department_distribution": [
    {
      "department": "engineering",
      "user_count": 10
    }
  ],
  "generated_at": "2024-01-01T00:00:00Z"
}
```

### Conditional Permissions

The RBAC system supports conditional permissions with the following conditions:

#### Own-Only Access
```json
{
  "conditions": {
    "own_only": true
  }
}
```
User can only access resources they own.

#### IP Restrictions
```json
{
  "conditions": {
    "ip_restrictions": ["192.168.1.0/24", "10.0.0.0/8"]
  }
}
```
Access restricted to specific IP ranges.

#### Time Restrictions
```json
{
  "conditions": {
    "time_restrictions": {
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "timezone": "UTC"
    }
  }
}
```
Access restricted to specific time windows.

#### Classification Limits
```json
{
  "conditions": {
    "max_classification": "restricted"
  }
}
```
Limits access based on document classification levels.

### Performance Characteristics

- **Permission Check Latency:** ≤5ms with Redis caching
- **Cache Hit Rate:** >95% for active permissions
- **Bulk Operations:** Support up to 100 permission checks per request
- **Concurrent Users:** Optimized for 10,000+ concurrent permission checks

## Audit Logging API

### Enhanced Features
- **HMAC Integrity Verification** using SHA-256
- **Universal Audit Decorators** for automatic logging
- **Redis Batching** for high-performance logging
- **Compliance Export** with multiple formats

### Endpoints

#### GET /api/audit/logs
Get audit logs with filtering.

**Required Permission:** `admin.audit:view`

**Query Parameters:**
- `start_date`: Start date (ISO 8601)
- `end_date`: End date (ISO 8601)
- `action`: Filter by action
- `resource_type`: Filter by resource type
- `user_id`: Filter by user
- `limit`: Number of results (max 1000)
- `offset`: Pagination offset

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "actor_user_id": "uuid",
      "actor_type": "user",
      "action": "document.upload",
      "resource_type": "document",
      "resource_id": "uuid",
      "outcome": "success",
      "details": {
        "filename": "report.pdf",
        "size": 1024000
      },
      "metadata": {
        "path": "/api/documents/upload",
        "method": "POST",
        "status_code": 201
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-01-01T00:00:00Z",
      "hmac_signature": "sha256:abc123..."
    }
  ],
  "total": 1,
  "has_more": false
}
```

#### POST /api/audit/export
Export audit logs for compliance.

**Required Permission:** `admin.audit:export`

**Request Body:**
```json
{
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-01-31T23:59:59Z",
  "format": "json",
  "filters": {
    "actions": ["document.upload", "document.delete"],
    "user_ids": ["uuid1", "uuid2"]
  }
}
```

**Response:**
```json
{
  "export_id": "uuid",
  "download_url": "/api/audit/exports/uuid/download",
  "expires_at": "2024-01-02T00:00:00Z",
  "record_count": 1000
}
```

#### POST /api/audit/verify
Verify HMAC integrity of audit log.

**Required Permission:** `admin.audit:view`

**Request Body:**
```json
{
  "log_id": "uuid"
}
```

**Response:**
```json
{
  "log_id": "uuid",
  "is_valid": true,
  "verification_time": "2024-01-01T00:00:00Z"
}
```

### Audit Decorators

Use decorators for automatic audit logging:

```python
from app.services.audit import audit_action

@audit_action("document.upload")
async def upload_document(file_data: bytes, user_id: UUID):
    # Function implementation
    pass
```

### HMAC Integrity

All audit logs include HMAC signatures for tamper detection:
- **Algorithm:** HMAC-SHA256
- **Key Rotation:** Automatic every 90 days
- **Verification:** Available via API and CLI

## Admin API

### Enhanced Features
- **API Key Management** with rate limiting and scopes
- **Webhook Delivery System** with retry logic and tracking
- **Usage Analytics** and monitoring
- **Automated Webhook Retry** with exponential backoff

### API Keys

#### GET /api/admin/api-keys
List API keys for organization.

**Required Permission:** `admin.api_key:manage`

**Response:**
```json
{
  "api_keys": [
    {
      "id": "uuid",
      "name": "Production API Key",
      "scopes": ["read", "write"],
      "is_active": true,
      "rate_limit": 1000,
      "last_used_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "expires_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/admin/api-keys
Create new API key.

**Required Permission:** `admin.api_key:manage`

**Request Body:**
```json
{
  "name": "Production API Key",
  "scopes": ["read", "write"],
  "rate_limit": 1000,
  "expires_days": 365,
  "ip_restrictions": ["192.168.1.0/24"]
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Production API Key",
  "key_value": "sk_prod_abc123...",
  "scopes": ["read", "write"],
  "rate_limit": 1000,
  "expires_at": "2025-01-01T00:00:00Z"
}
```

#### DELETE /api/admin/api-keys/{key_id}
Revoke API key.

**Required Permission:** `admin.api_key:manage`

### Webhooks

#### GET /api/admin/webhooks
List webhooks for organization.

**Required Permission:** `admin.webhook:manage`

**Response:**
```json
{
  "webhooks": [
    {
      "id": "uuid",
      "url": "https://api.example.com/webhooks",
      "events": ["document.uploaded", "chat.message.created"],
      "is_active": true,
      "hmac_secret": "whsec_abc123...",
      "timeout_seconds": 30,
      "max_retries": 3,
      "headers": {
        "Authorization": "Bearer token123"
      },
      "consecutive_failures": 0,
      "last_triggered_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/admin/webhooks
Create webhook endpoint.

**Required Permission:** `admin.webhook:manage`

**Request Body:**
```json
{
  "url": "https://api.example.com/webhooks",
  "events": ["document.uploaded", "chat.message.created"],
  "timeout_seconds": 30,
  "max_retries": 3,
  "headers": {
    "Authorization": "Bearer token123"
  }
}
```

#### GET /api/admin/webhooks/{webhook_id}/deliveries
Get webhook delivery history.

**Required Permission:** `admin.webhook:manage`

**Query Parameters:**
- `limit`: Number of results (max 100)
- `status`: Filter by status (pending, success, failed)

**Response:**
```json
{
  "deliveries": [
    {
      "id": "uuid",
      "event_type": "document.uploaded",
      "status": "success",
      "attempt_count": 1,
      "response_status": 200,
      "created_at": "2024-01-01T00:00:00Z",
      "delivered_at": "2024-01-01T00:00:01Z"
    }
  ]
}
```

#### POST /api/admin/webhooks/{webhook_id}/retry
Retry failed webhook deliveries.

**Required Permission:** `admin.webhook:manage`

**Request Body:**
```json
{
  "hours": 24,
  "max_retries": 3
}
```

### Webhook Event Types

#### User Events
- `user.created` - New user registration
- `user.updated` - User profile changes
- `user.login` - User authentication
- `user.logout` - User session end

#### Document Events
- `document.uploaded` - New document upload
- `document.processed` - Document processing complete
- `document.updated` - Document metadata changes
- `document.deleted` - Document removal
- `document.shared` - Document sharing

#### Chat Events
- `chat.message.created` - New chat message
- `chat.thread.created` - New chat thread
- `chat.thread.closed` - Chat thread ended

#### Audit Events
- `audit.log.created` - New audit log entry
- `policy.violation.detected` - Policy violation
- `security.event` - Security-related event

#### Admin Events
- `api_key.created` - New API key
- `api_key.revoked` - API key revocation
- `webhook.created` - New webhook
- `webhook.updated` - Webhook configuration change

### Webhook Payload Format

All webhooks receive payloads in this format:

```json
{
  "event_type": "document.uploaded",
  "data": {
    "document_id": "uuid",
    "filename": "report.pdf",
    "size": 1024000,
    "user_id": "uuid"
  },
  "_meta": {
    "event_type": "document.uploaded",
    "delivery_id": "uuid",
    "webhook_id": "uuid",
    "timestamp": "2024-01-01T00:00:00Z",
    "attempt": 1
  }
}
```

### Webhook Security

#### HMAC Signatures
All webhook payloads include HMAC signatures:

```http
X-CrossAudit-Signature: sha256=abc123...
X-CrossAudit-Event: document.uploaded
X-CrossAudit-Delivery: uuid
X-CrossAudit-Timestamp: 1640995200
```

#### Verification Example (Python)
```python
import hmac
import hashlib

def verify_webhook(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

### Webhook Retry Logic

- **Initial Retry:** Immediate retry on transient failures
- **Exponential Backoff:** 2^attempt seconds (max 5 minutes)
- **Jitter:** ±10% randomization to prevent thundering herd
- **Max Retries:** Configurable per webhook (default: 3)
- **Auto-disable:** After 10 consecutive failures

**Retryable Status Codes:** 408, 429, 502, 503, 504
**Non-retryable Status Codes:** 400, 401, 403, 404, 422

## Metrics API

### Enhanced Features
- **Real-time Collection** with Redis counters
- **Automated Aggregation** to 1-minute and hourly buckets
- **Policy Violation Tracking**
- **Custom Dimensions** and filtering

### Endpoints

#### GET /api/metrics/dashboard
Get dashboard metrics for organization.

**Required Permission:** `admin.metrics:view`

**Query Parameters:**
- `start_date`: Start date (ISO 8601)
- `end_date`: End date (ISO 8601)
- `granularity`: Aggregation level (minute, hour, day)

**Response:**
```json
{
  "metrics": {
    "request_count": [
      {
        "timestamp": "2024-01-01T00:00:00Z",
        "value": 1000
      }
    ],
    "response_time_avg": [
      {
        "timestamp": "2024-01-01T00:00:00Z",
        "value": 150.5
      }
    ],
    "error_rate": [
      {
        "timestamp": "2024-01-01T00:00:00Z",
        "value": 0.02
      }
    ]
  },
  "summary": {
    "total_requests": 24000,
    "avg_response_time": 145.3,
    "error_rate": 0.015,
    "uptime": 99.9
  }
}
```

#### GET /api/metrics/usage
Get detailed usage metrics.

**Required Permission:** `admin.metrics:view`

**Response:**
```json
{
  "api_usage": {
    "total_calls": 10000,
    "by_endpoint": {
      "/api/documents": 5000,
      "/api/chat": 3000
    },
    "by_method": {
      "GET": 7000,
      "POST": 2500,
      "PUT": 300,
      "DELETE": 200
    }
  },
  "user_activity": {
    "active_users": 150,
    "new_users": 25,
    "retention_rate": 0.85
  },
  "resource_usage": {
    "storage_gb": 1024.5,
    "bandwidth_gb": 500.2,
    "processing_hours": 24.5
  }
}
```

## Rate Limiting

### Default Limits
- **JWT Users:** 1000 requests/hour
- **API Keys:** Configurable per key
- **Public Endpoints:** 100 requests/hour per IP

### Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640999999
```

### Rate Limit Response
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retry_after": 3600
}
```

## Error Handling

### Standard Error Format
```json
{
  "error": "permission_denied",
  "message": "Insufficient permissions. Required: document:read",
  "details": {
    "required_permission": "document:read",
    "user_permissions": ["chat.message:read"]
  },
  "request_id": "uuid"
}
```

### Common Error Codes
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error

## CLI Commands

The platform includes CLI commands for administrative tasks:

### Permission Management
```bash
# Sync permissions from definitions
crossaudit sync-permissions --file permissions.json

# List all permissions
crossaudit list-permissions --resource document

# Get RBAC analytics
crossaudit rbac-analytics <org-id> --days 30
```

### Audit Management
```bash
# Export audit logs
crossaudit audit-export <org-id> --output export.json --days 30

# Verify audit log integrity
crossaudit audit-verify <log-id>
```

### Metrics Management
```bash
# Clean up old metrics
crossaudit metrics-cleanup --days 7

# Run hourly aggregation
crossaudit metrics-aggregate
```

### Webhook Management
```bash
# Get webhook statistics
crossaudit webhook-stats <org-id> --days 30

# Check system health
crossaudit health-check
```

## SDK Examples

### Python SDK Usage
```python
import crossaudit

# Initialize client
client = crossaudit.Client(
    api_key="sk_prod_abc123...",
    base_url="https://api.crossaudit.com"
)

# Check permissions
result = await client.rbac.check_permission(
    user_id="uuid",
    permission="document:read",
    context={"classification": "confidential"}
)

# Upload document
document = await client.documents.upload(
    file_path="report.pdf",
    metadata={"department": "finance"}
)

# Send chat message
message = await client.chat.send_message(
    thread_id="uuid",
    content="Please review this document",
    attachments=[document.id]
)
```

## Best Practices

### Security
- Always use HTTPS in production
- Rotate API keys regularly (recommended: 90 days)
- Verify webhook HMAC signatures
- Implement proper error handling
- Use conditional permissions for sensitive operations

### Performance
- Enable Redis caching for RBAC checks
- Use bulk operations for multiple permission checks
- Implement proper pagination for large result sets
- Monitor rate limits and adjust as needed

### Monitoring
- Set up webhook endpoints for critical events
- Monitor audit logs for security incidents
- Track metrics for performance optimization
- Use health check endpoints for uptime monitoring

## Support

For technical support and questions:
- **Documentation:** https://docs.crossaudit.com
- **API Status:** https://status.crossaudit.com
- **Support Email:** support@crossaudit.com
- **Community:** https://community.crossaudit.com