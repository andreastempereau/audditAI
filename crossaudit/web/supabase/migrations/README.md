# CrossAudit Database Migrations

This directory contains the database schema migrations for the CrossAudit AI Governance platform.

## Overview

The migration system creates a comprehensive database schema with:
- **Complete RBAC system** (roles, permissions, departments)
- **Chat system** with threading support
- **Document management** with versioning and vector search
- **API management** (keys, webhooks, events)
- **AI governance** (policies, evaluators)
- **Audit logging** and metrics collection
- **Row-level security** policies
- **Automated triggers** and indexes

## Prerequisites

1. **Supabase CLI** installed and configured
2. **PostgreSQL extensions** enabled:
   - `uuid-ossp` (UUID generation)
   - `pgcrypto` (cryptographic functions)
   - `vector` (vector embeddings for search)
   - `pg_trgm` (trigram text search)

## Quick Start

### 1. Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Using Homebrew (macOS)
brew install supabase/tap/supabase

# Using Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2. Initialize Supabase Project

```bash
# Initialize if not already done
supabase init

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Enable Required Extensions

Run this SQL in your Supabase SQL Editor or via CLI:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### 4. Run the Migration

```bash
# Apply the migration
supabase db push

# Or apply specific migration
supabase migration up --target 001_core_schema
```

## Migration Files

### Core Migration Files

- **`001_core_schema.sql`** - Main migration creating all tables, indexes, RLS policies, triggers
- **`001_core_schema_down.sql`** - Rollback migration to undo all changes
- **`diagram.puml`** - PlantUML entity relationship diagram
- **`README.md`** - This documentation file

### Migration Contents

The core schema migration includes:

#### Tables Created (15 new tables)
1. **RBAC System**
   - `permissions` - System-wide permission registry
   - `roles` - Organization-specific roles
   - `departments` - Hierarchical department structure
   - `user_roles` - User role assignments with context

2. **Chat System**
   - `chat_threads` - Conversation threads
   - `chat_messages` - Individual messages with threading

3. **Document Management**
   - `documents` - Core document registry
   - `document_versions` - Version history with change tracking
   - `fragments` - Text fragments for vector search

4. **API Management**
   - `api_keys` - External API key management
   - `webhooks` - Webhook endpoint configurations
   - `webhook_events` - Webhook delivery tracking

5. **AI Governance**
   - `policies` - AI governance policies and rules
   - `evaluators` - AI model evaluator configurations

6. **Audit & Metrics**
   - `audit_logs` - Comprehensive audit trail
   - `metrics_data` - Time-series metrics storage

#### Security Features
- **Row-Level Security** policies on all tables
- **Organization-based data isolation**
- **Automatic audit logging** triggers
- **Soft delete patterns** with `deleted_at` timestamps

#### Performance Features
- **Comprehensive indexes** including GIN and vector indexes
- **Automatic timestamp management** triggers
- **Optimized queries** with partial indexes
- **Vector search support** for document fragments

## Usage Examples

### Running Migrations

```bash
# Check migration status
supabase migration list

# Apply all pending migrations
supabase db push

# Apply migrations up to specific version
supabase migration up --target 001_core_schema

# Check database differences
supabase db diff

# Reset database (destructive)
supabase db reset
```

### Rolling Back

```bash
# Rollback the core schema migration
supabase migration down --target 001_core_schema

# Or run the rollback SQL directly
supabase db push --file 001_core_schema_down.sql
```

### Generating New Migrations

```bash
# Create a new migration file
supabase migration new your_migration_name

# Generate migration from database changes
supabase db diff --file new_changes
```

## Environment Setup

### Local Development

```bash
# Start local Supabase
supabase start

# Apply migrations to local instance
supabase db push --local

# View local database
supabase db studio
```

### Production Deployment

```bash
# Link to production project
supabase link --project-ref YOUR_PROD_PROJECT_REF

# Apply migrations to production
supabase db push --password YOUR_DB_PASSWORD
```

## Verification

After running the migration, verify the setup:

### 1. Check Tables Created

```sql
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

### 2. Verify RLS Policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public';
```

### 3. Check Indexes

```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### 4. Test Data Insertion

```sql
-- Test basic data insertion (should work for authenticated users)
INSERT INTO permissions (name, description, resource, action) 
VALUES ('test_permission', 'Test permission', 'test', 'read');
```

## Troubleshooting

### Common Issues

1. **Extension Not Found**
   ```
   ERROR: extension "vector" is not available
   ```
   **Solution**: Install pgvector extension in your Supabase project

2. **Permission Denied**
   ```
   ERROR: permission denied for schema public
   ```
   **Solution**: Ensure you're connected as a database owner/admin

3. **RLS Policy Conflicts**
   ```
   ERROR: infinite recursion detected in policy
   ```
   **Solution**: Check that existing RLS policies don't conflict

### Getting Help

- **Supabase Documentation**: https://supabase.com/docs
- **Migration Reference**: https://supabase.com/docs/guides/cli/local-development#database-migrations
- **SQL Reference**: https://supabase.com/docs/guides/database

## Schema Diagram

The `diagram.puml` file contains a comprehensive entity-relationship diagram showing all tables and their relationships. You can view it using:

- **PlantUML online**: http://www.plantuml.com/plantuml/
- **VS Code extension**: PlantUML
- **IntelliJ plugin**: PlantUML integration

## Data Seeding

The migration includes basic seed data:
- **System permissions** for common actions
- **Table comments** for documentation
- **Default constraints** and validations

## Next Steps

After successful migration:

1. **Update API endpoints** to use the new schema
2. **Test authentication flow** with new RLS policies  
3. **Implement chat functionality** using the chat tables
4. **Set up document processing** with vector embeddings
5. **Configure webhook endpoints** for event notifications
6. **Create admin interfaces** for RBAC management

---

**⚠️ Important Notes:**
- Always backup your database before running migrations
- Test thoroughly in development before production deployment
- The rollback migration will permanently delete all data in the new tables
- RLS policies are restrictive by default - adjust as needed for your use case