# CrossAudit AI API Reference

## Overview

The CrossAudit AI REST API provides programmatic access to all governance features including policy management, evaluator configuration, compliance reporting, and billing operations.

**Base URL**: `https://api.your-domain.com`  
**API Version**: v1  
**Authentication**: Bearer Token (JWT)

## Authentication

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "token_type": "bearer",
    "expires_in": 1800
  },
  "message": "Login successful"
}
```

### Using Bearer Token
```http
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

## Policy Management

### Create Policy
```http
POST /api/policies
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Content Safety Policy",
  "description": "Prevents harmful content generation",
  "policy_yaml": "name: \"Content Safety\"\ndescription: \"Safety policy\"\nversion: \"1.0\"\n..."
}
```

### List Policies
```http
GET /api/policies?skip=0&limit=100&search=safety
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": {
    "policies": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Content Safety Policy",
        "description": "Prevents harmful content",
        "priority": 100,
        "is_active": true,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 1,
    "skip": 0,
    "limit": 100
  }
}
```

### Get Policy
```http
GET /api/policies/{policy_id}
Authorization: Bearer {token}
```

### Update Policy
```http
PUT /api/policies/{policy_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Policy Name",
  "description": "Updated description"
}
```

### Delete Policy
```http
DELETE /api/policies/{policy_id}
Authorization: Bearer {token}
```

### Test Policy
```http
POST /api/policies/{policy_id}/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "prompt": "Tell me about science",
  "response": "Science is the study of the natural world..."
}
```

### Validate Policy YAML
```http
POST /api/policies/validate
Authorization: Bearer {token}
Content-Type: application/json

{
  "policy_yaml": "name: \"Test Policy\"\ndescription: \"Test\"\nversion: \"1.0\"\n..."
}
```

### Activate/Deactivate Policy
```http
POST /api/policies/{policy_id}/activate
POST /api/policies/{policy_id}/deactivate
Authorization: Bearer {token}
```

## Evaluator Management

### Create Evaluator
```http
POST /api/evaluators
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Safety Evaluator",
  "description": "Evaluates content safety",
  "evaluator_type": "llm",
  "config": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.1
  },
  "code": "def evaluate(prompt, response, context=None): ..."
}
```

### List Evaluators
```http
GET /api/evaluators?evaluator_type=llm&skip=0&limit=100
Authorization: Bearer {token}
```

### Get Evaluator
```http
GET /api/evaluators/{evaluator_id}
Authorization: Bearer {token}
```

### Update Evaluator
```http
PUT /api/evaluators/{evaluator_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Evaluator",
  "config": {
    "temperature": 0.5
  }
}
```

### Delete Evaluator
```http
DELETE /api/evaluators/{evaluator_id}
Authorization: Bearer {token}
```

### Test Evaluator
```http
POST /api/evaluators/{evaluator_id}/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "prompt": "Test prompt",
  "response": "Test response",
  "context": {"key": "value"}
}
```

### Deploy Evaluator
```http
POST /api/evaluators/{evaluator_id}/deploy
Authorization: Bearer {token}
Content-Type: application/json

{
  "config": {
    "environment": "production",
    "replicas": 2
  }
}
```

### Get Available Types
```http
GET /api/evaluators/types/available
Authorization: Bearer {token}
```

### Upload Plugin
```http
POST /api/evaluators/plugins/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [plugin_file.py]
metadata: {"name": "Custom Plugin", "version": "1.0"}
```

## Governance Operations

### Get Dashboard
```http
GET /api/governance/dashboard
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": {
    "policy_count": 5,
    "evaluator_count": 8,
    "violation_count": 12,
    "compliance_score": 0.95,
    "recent_violations": [...],
    "metrics_summary": {...}
  }
}
```

### Get Policy Violations
```http
GET /api/governance/violations?severity=high&start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer {token}
```

### Resolve Violation
```http
POST /api/governance/violations/{violation_id}/resolve
Authorization: Bearer {token}
Content-Type: application/json

{
  "notes": "Issue resolved by updating content filter"
}
```

### Generate Compliance Report
```http
POST /api/governance/compliance-reports/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "report_type": "comprehensive",
  "config": {
    "include_violations": true,
    "include_metrics": true,
    "date_range_days": 30
  }
}
```

### Get Compliance Reports
```http
GET /api/governance/compliance-reports
Authorization: Bearer {token}
```

### Generate Risk Assessment
```http
POST /api/governance/risk-assessments/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "config": {
    "assessment_scope": ["policies", "evaluators"],
    "risk_categories": ["security", "compliance"],
    "include_mitigation": true
  }
}
```

### Get Risk Assessments
```http
GET /api/governance/risk-assessments?risk_level=high
Authorization: Bearer {token}
```

### Get Available Frameworks
```http
GET /api/governance/frameworks
Authorization: Bearer {token}
```

### Apply Framework
```http
POST /api/governance/frameworks/{framework_id}/apply
Authorization: Bearer {token}
Content-Type: application/json

{
  "config": {
    "customize_policies": true,
    "selected_controls": ["access_control", "data_protection"]
  }
}
```

### Get Metrics Summary
```http
GET /api/governance/metrics/summary?days=30
Authorization: Bearer {token}
```

### Analyze Policy Effectiveness
```http
POST /api/governance/policy-effectiveness/analyze
Authorization: Bearer {token}
Content-Type: application/json

{
  "config": {
    "analysis_period": 30,
    "include_false_positives": true,
    "benchmark_against": "industry_average"
  }
}
```

### Get/Update Governance Settings
```http
GET /api/governance/settings
PUT /api/governance/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "auto_remediation": true,
  "notification_preferences": {
    "email_alerts": true,
    "digest_frequency": "daily"
  }
}
```

## Billing Management

### Get Subscription Plans
```http
GET /api/billing/plans
```

**Response:**
```json
{
  "data": {
    "plans": [
      {
        "id": "plan_starter",
        "name": "starter",
        "display_name": "Starter Plan",
        "price_monthly": 49.00,
        "features": ["Basic policies", "Email support"],
        "quotas": {
          "users": 5,
          "api_calls": 10000,
          "evaluations": 1000
        }
      }
    ],
    "total": 3
  }
}
```

### Get Current Subscription
```http
GET /api/billing/subscription
Authorization: Bearer {token}
```

### Create Subscription
```http
POST /api/billing/subscription/create
Authorization: Bearer {token}
Content-Type: application/json

{
  "plan_id": "plan_starter",
  "billing_interval": "monthly",
  "payment_method_id": "pm_1234567890"
}
```

### Update Subscription
```http
PUT /api/billing/subscription/update
Authorization: Bearer {token}
Content-Type: application/json

{
  "plan_id": "plan_business",
  "billing_interval": "yearly"
}
```

### Cancel Subscription
```http
POST /api/billing/subscription/cancel
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "No longer needed"
}
```

### Get Usage Metrics
```http
GET /api/billing/usage?days=30
Authorization: Bearer {token}
```

### Get Invoices
```http
GET /api/billing/invoices
Authorization: Bearer {token}
```

### Get Payment Methods
```http
GET /api/billing/payment-methods
Authorization: Bearer {token}
```

### Add Payment Method
```http
POST /api/billing/payment-methods
Authorization: Bearer {token}
Content-Type: application/json

{
  "payment_method_id": "pm_1234567890",
  "set_as_default": true
}
```

### Remove Payment Method
```http
DELETE /api/billing/payment-methods/{payment_method_id}
Authorization: Bearer {token}
```

### Get Quota Status
```http
GET /api/billing/quotas/status
Authorization: Bearer {token}
```

### Stripe Webhook
```http
POST /api/billing/webhooks/stripe
Stripe-Signature: t=1234567890,v1=signature...

{
  "type": "invoice.payment_succeeded",
  "data": {...}
}
```

### Create Billing Portal Session
```http
POST /api/billing/billing-portal
Authorization: Bearer {token}
```

## Chat and Inference

### Create Chat Thread
```http
POST /api/chat/threads
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Customer Support Chat",
  "metadata": {
    "customer_id": "cust_123",
    "department": "support"
  }
}
```

### Send Message
```http
POST /api/chat/threads/{thread_id}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Hello, I need help with my account",
  "message_type": "user"
}
```

### Get Chat History
```http
GET /api/chat/threads/{thread_id}/messages?limit=50
Authorization: Bearer {token}
```

### Stream Chat Response
```http
GET /api/chat/threads/{thread_id}/stream
Authorization: Bearer {token}
Accept: text/event-stream
```

## Document Processing

### Upload Document
```http
POST /api/documents/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [document.pdf]
metadata: {"category": "policy", "department": "legal"}
```

### Get Document
```http
GET /api/documents/{document_id}
Authorization: Bearer {token}
```

### List Documents
```http
GET /api/documents?category=policy&limit=50
Authorization: Bearer {token}
```

### Process Document
```http
POST /api/documents/{document_id}/process
Authorization: Bearer {token}
Content-Type: application/json

{
  "processing_options": {
    "extract_text": true,
    "generate_embeddings": true,
    "analyze_content": true
  }
}
```

### Search Documents
```http
POST /api/documents/search
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "privacy policy requirements",
  "filters": {
    "category": "policy",
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    }
  },
  "limit": 20
}
```

## Health and Status

### Basic Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Detailed Health Check
```http
GET /api/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "response_time_ms": 15
    },
    "redis": {
      "status": "healthy",
      "response_time_ms": 2
    },
    "external_services": {
      "openai": "healthy",
      "stripe": "healthy"
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Readiness Check
```http
GET /api/health/ready
```

### Liveness Check
```http
GET /api/health/live
```

## Metrics and Monitoring

### Application Metrics
```http
GET /metrics
```

**Response:** Prometheus format metrics

### Custom Metrics
```http
GET /api/metrics?start_time=2024-01-01T00:00:00Z&end_time=2024-01-01T23:59:59Z
Authorization: Bearer {token}
```

## WebSocket Endpoints

### Chat Streaming
```javascript
const ws = new WebSocket('wss://api.your-domain.com/ws/chat/{thread_id}?token={jwt_token}');

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.send(JSON.stringify({
  type: 'message',
  content: 'Hello, how can you help me?'
}));
```

### Notifications
```javascript
const ws = new WebSocket('wss://api.your-domain.com/ws/notifications?token={jwt_token}');

ws.onmessage = function(event) {
  const notification = JSON.parse(event.data);
  // Handle real-time notifications
};
```

### Analytics Updates
```javascript
const ws = new WebSocket('wss://api.your-domain.com/ws/analytics?token={jwt_token}');

ws.onmessage = function(event) {
  const analytics = JSON.parse(event.data);
  // Handle real-time analytics updates
};
```

## Error Responses

All API endpoints return errors in a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error

### Error Codes

- `VALIDATION_ERROR` - Input validation failed
- `AUTH_ERROR` - Authentication failed
- `PERMISSION_DENIED` - Insufficient permissions
- `QUOTA_EXCEEDED` - Usage quota exceeded
- `POLICY_VIOLATION` - Request violates policy
- `RATE_LIMITED` - Too many requests
- `SERVICE_UNAVAILABLE` - External service unavailable

## Rate Limiting

API requests are rate limited per user and organization:

- **Free tier**: 100 requests/hour
- **Starter**: 1,000 requests/hour
- **Business**: 10,000 requests/hour
- **Enterprise**: Unlimited

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## SDKs and Libraries

### Python SDK
```python
from crossaudit import CrossAuditClient

client = CrossAuditClient(
    api_key="your-api-key",
    base_url="https://api.your-domain.com"
)

# Create policy
policy = client.policies.create({
    "name": "Safety Policy",
    "description": "Content safety policy",
    "policy_yaml": policy_yaml
})

# Test policy
result = client.policies.test(
    policy.id,
    prompt="Test prompt",
    response="Test response"
)
```

### JavaScript SDK
```javascript
import { CrossAuditClient } from '@crossaudit/sdk';

const client = new CrossAuditClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.your-domain.com'
});

// Create evaluator
const evaluator = await client.evaluators.create({
  name: 'Safety Evaluator',
  type: 'llm',
  config: {
    provider: 'openai',
    model: 'gpt-4'
  }
});
```

### cURL Examples

Create and test a complete governance workflow:

```bash
# 1. Login
TOKEN=$(curl -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.data.access_token')

# 2. Create evaluator
EVALUATOR_ID=$(curl -X POST https://api.your-domain.com/api/evaluators \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Safety Evaluator",
    "evaluator_type": "llm",
    "config": {"provider": "openai", "model": "gpt-4"}
  }' | jq -r '.data.id')

# 3. Create policy
POLICY_ID=$(curl -X POST https://api.your-domain.com/api/policies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Safety Policy",
    "description": "Content safety policy",
    "policy_yaml": "name: \"Safety Policy\"\nversion: \"1.0\"\nrules:\n  - name: \"safety\"\n    evaluator: \"safety_evaluator\"\n    threshold: 0.8\n    action: \"block\""
  }' | jq -r '.data.id')

# 4. Test policy
curl -X POST https://api.your-domain.com/api/policies/$POLICY_ID/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Tell me about renewable energy",
    "response": "Renewable energy sources include solar, wind, and hydroelectric power..."
  }'
```

This API reference provides comprehensive coverage of all CrossAudit AI endpoints and usage patterns.