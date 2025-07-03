-- Migration: Admin APIs, Enhanced RBAC, and Metrics Pipeline
-- File: 003_admin_and_metrics.sql

-- ========================================
-- 1. RBAC Permission Seeds
-- ========================================

-- Insert canonical permission slugs
INSERT INTO permissions (id, name, display_name, description, resource, action, conditions, is_active, created_at)
VALUES 
    -- Chat permissions
    (gen_random_uuid(), 'chat.message:create', 'Create Chat Message', 'Ability to send messages in chat', 'chat.message', 'create', '{}', true, NOW()),
    (gen_random_uuid(), 'chat.message:read', 'Read Chat Messages', 'Ability to view chat messages', 'chat.message', 'read', '{}', true, NOW()),
    (gen_random_uuid(), 'chat.message:update', 'Update Chat Message', 'Ability to edit own messages', 'chat.message', 'update', '{"own_only": true}', true, NOW()),
    (gen_random_uuid(), 'chat.message:delete', 'Delete Chat Message', 'Ability to delete own messages', 'chat.message', 'delete', '{"own_only": true}', true, NOW()),
    (gen_random_uuid(), 'chat.thread:create', 'Create Chat Thread', 'Ability to create new chat threads', 'chat.thread', 'create', '{}', true, NOW()),
    (gen_random_uuid(), 'chat.thread:manage', 'Manage Chat Thread', 'Ability to manage thread settings', 'chat.thread', 'manage', '{}', true, NOW()),
    
    -- Document permissions
    (gen_random_uuid(), 'document:create', 'Create Document', 'Ability to upload new documents', 'document', 'create', '{}', true, NOW()),
    (gen_random_uuid(), 'document:read', 'Read Document', 'Ability to view documents', 'document', 'read', '{}', true, NOW()),
    (gen_random_uuid(), 'document:update', 'Update Document', 'Ability to update document metadata', 'document', 'update', '{}', true, NOW()),
    (gen_random_uuid(), 'document:delete', 'Delete Document', 'Ability to delete documents', 'document', 'delete', '{}', true, NOW()),
    (gen_random_uuid(), 'document:search', 'Search Documents', 'Ability to search document fragments', 'document', 'search', '{}', true, NOW()),
    (gen_random_uuid(), 'document:download', 'Download Document', 'Ability to download original files', 'document', 'download', '{}', true, NOW()),
    
    -- Admin permissions
    (gen_random_uuid(), 'admin.audit:view', 'View Audit Logs', 'Ability to view audit trail', 'admin.audit', 'view', '{}', true, NOW()),
    (gen_random_uuid(), 'admin.audit:export', 'Export Audit Logs', 'Ability to export audit logs', 'admin.audit', 'export', '{}', true, NOW()),
    (gen_random_uuid(), 'admin.metrics:view', 'View Metrics', 'Ability to view system metrics', 'admin.metrics', 'view', '{}', true, NOW()),
    (gen_random_uuid(), 'admin.api_key:manage', 'Manage API Keys', 'Ability to create and revoke API keys', 'admin.api_key', 'manage', '{}', true, NOW()),
    (gen_random_uuid(), 'admin.webhook:manage', 'Manage Webhooks', 'Ability to configure webhooks', 'admin.webhook', 'manage', '{}', true, NOW()),
    (gen_random_uuid(), 'admin.user:manage', 'Manage Users', 'Ability to manage organization users', 'admin.user', 'manage', '{}', true, NOW()),
    (gen_random_uuid(), 'admin.role:manage', 'Manage Roles', 'Ability to create and modify roles', 'admin.role', 'manage', '{}', true, NOW()),
    (gen_random_uuid(), 'admin.org:manage', 'Manage Organization', 'Ability to manage organization settings', 'admin.org', 'manage', '{}', true, NOW()),
    
    -- Platform admin permissions
    (gen_random_uuid(), 'platform.admin:access', 'Platform Admin Access', 'Full platform administrator access', 'platform.admin', 'access', '{}', true, NOW()),
    (gen_random_uuid(), 'platform.org:view_all', 'View All Organizations', 'Ability to view all organizations', 'platform.org', 'view_all', '{}', true, NOW()),
    (gen_random_uuid(), 'platform.metrics:view_all', 'View All Metrics', 'Ability to view platform-wide metrics', 'platform.metrics', 'view_all', '{}', true, NOW())
ON CONFLICT (name) DO NOTHING;

-- Create permission cache table for fast lookups
CREATE TABLE IF NOT EXISTS permission_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    permissions TEXT[] NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '60 seconds',
    UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS permission_cache_user_org_idx ON permission_cache (user_id, organization_id);
CREATE INDEX IF NOT EXISTS permission_cache_expires_idx ON permission_cache (expires_at);

-- ========================================
-- 2. Enhanced Audit Logging
-- ========================================

-- Add HMAC checksum column to audit_logs
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS hmac_checksum VARCHAR(64),
ADD COLUMN IF NOT EXISTS request_id UUID,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS extra JSONB DEFAULT '{}';

-- Create index for HMAC verification
CREATE INDEX IF NOT EXISTS audit_logs_hmac_idx ON audit_logs (hmac_checksum);
CREATE INDEX IF NOT EXISTS audit_logs_request_id_idx ON audit_logs (request_id);
CREATE INDEX IF NOT EXISTS audit_logs_extra_gin_idx ON audit_logs USING gin (extra);

-- Function to calculate HMAC for audit log integrity
CREATE OR REPLACE FUNCTION calculate_audit_hmac() RETURNS TRIGGER AS $$
DECLARE
    hmac_key TEXT;
    hmac_data TEXT;
BEGIN
    -- Get HMAC key from environment or use default (in production, use proper secret)
    hmac_key := current_setting('app.audit_hmac_key', true);
    IF hmac_key IS NULL THEN
        hmac_key := 'default-audit-hmac-key-change-in-production';
    END IF;
    
    -- Concatenate fields for HMAC calculation
    hmac_data := COALESCE(NEW.organization_id::TEXT, '') || '|' ||
                 COALESCE(NEW.actor_user_id::TEXT, '') || '|' ||
                 COALESCE(NEW.actor_type, '') || '|' ||
                 COALESCE(NEW.action, '') || '|' ||
                 COALESCE(NEW.resource_type, '') || '|' ||
                 COALESCE(NEW.resource_id::TEXT, '') || '|' ||
                 COALESCE(NEW.created_at::TEXT, '');
    
    -- Calculate HMAC
    NEW.hmac_checksum := encode(
        hmac(hmac_data::bytea, hmac_key::bytea, 'sha256'),
        'hex'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for HMAC calculation
DROP TRIGGER IF EXISTS audit_logs_hmac_trigger ON audit_logs;
CREATE TRIGGER audit_logs_hmac_trigger
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION calculate_audit_hmac();

-- ========================================
-- 3. API Keys Table (Enhanced)
-- ========================================

-- Modify api_keys table to store only hashed keys
ALTER TABLE api_keys
ADD COLUMN IF NOT EXISTS key_hash VARCHAR(256) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS last_used_ip INET,
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rate_limit INTEGER DEFAULT 1000;

-- Create index for fast key lookup
CREATE INDEX IF NOT EXISTS api_keys_key_prefix_idx ON api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);

-- ========================================
-- 4. Enhanced Webhooks Table
-- ========================================

ALTER TABLE webhooks
ADD COLUMN IF NOT EXISTS hmac_secret VARCHAR(256),
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '{}';

-- Webhook event delivery tracking
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    attempt_count INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, success, failed
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx ON webhook_deliveries (webhook_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_status_idx ON webhook_deliveries (status);
CREATE INDEX IF NOT EXISTS webhook_deliveries_next_retry_idx ON webhook_deliveries (next_retry_at) WHERE status = 'pending';

-- ========================================
-- 5. Metrics Tables
-- ========================================

-- Raw metrics data table
CREATE TABLE IF NOT EXISTS metrics_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    route VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    request_size INTEGER,
    response_size INTEGER,
    error_type VARCHAR(100),
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for metrics queries
CREATE INDEX IF NOT EXISTS metrics_raw_org_created_idx ON metrics_raw (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS metrics_raw_route_idx ON metrics_raw (route, created_at DESC);
CREATE INDEX IF NOT EXISTS metrics_raw_status_idx ON metrics_raw (status_code, created_at DESC);

-- Aggregated metrics table (1-minute buckets)
CREATE TABLE IF NOT EXISTS metrics_aggregate_1min (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    bucket_time TIMESTAMP WITH TIME ZONE NOT NULL,
    route VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_errors INTEGER NOT NULL DEFAULT 0,
    avg_duration_ms NUMERIC(10,2),
    p50_duration_ms INTEGER,
    p95_duration_ms INTEGER,
    p99_duration_ms INTEGER,
    total_request_bytes BIGINT DEFAULT 0,
    total_response_bytes BIGINT DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    error_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, bucket_time, route, method)
);

-- Indexes for aggregated metrics
CREATE INDEX IF NOT EXISTS metrics_agg_1min_org_time_idx ON metrics_aggregate_1min (organization_id, bucket_time DESC);
CREATE INDEX IF NOT EXISTS metrics_agg_1min_time_idx ON metrics_aggregate_1min (bucket_time DESC);

-- Hourly rollup table
CREATE TABLE IF NOT EXISTS metrics_aggregate_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    bucket_time TIMESTAMP WITH TIME ZONE NOT NULL,
    route VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_errors INTEGER NOT NULL DEFAULT 0,
    avg_duration_ms NUMERIC(10,2),
    p50_duration_ms INTEGER,
    p95_duration_ms INTEGER,
    p99_duration_ms INTEGER,
    total_request_bytes BIGINT DEFAULT 0,
    total_response_bytes BIGINT DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    error_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, bucket_time, route, method)
);

CREATE INDEX IF NOT EXISTS metrics_agg_hourly_org_time_idx ON metrics_aggregate_hourly (organization_id, bucket_time DESC);

-- Policy violation metrics
CREATE TABLE IF NOT EXISTS policy_violation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID,
    policy_type VARCHAR(100) NOT NULL,
    violation_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS policy_violations_org_created_idx ON policy_violation_metrics (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS policy_violations_type_idx ON policy_violation_metrics (policy_type, violation_type);

-- ========================================
-- 6. Support for TimescaleDB (Optional)
-- ========================================

-- If TimescaleDB is available, convert metrics tables to hypertables
-- This significantly improves time-series query performance
DO $$
BEGIN
    -- Check if TimescaleDB is installed
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        -- Convert raw metrics to hypertable
        PERFORM create_hypertable('metrics_raw', 'created_at', 
            chunk_time_interval => INTERVAL '1 day',
            if_not_exists => TRUE);
        
        -- Convert aggregates to hypertables
        PERFORM create_hypertable('metrics_aggregate_1min', 'bucket_time',
            chunk_time_interval => INTERVAL '1 day',
            if_not_exists => TRUE);
            
        PERFORM create_hypertable('metrics_aggregate_hourly', 'bucket_time',
            chunk_time_interval => INTERVAL '7 days',
            if_not_exists => TRUE);
            
        -- Add retention policies (keep raw data for 7 days, 1min for 30 days, hourly for 1 year)
        PERFORM add_retention_policy('metrics_raw', INTERVAL '7 days', if_not_exists => TRUE);
        PERFORM add_retention_policy('metrics_aggregate_1min', INTERVAL '30 days', if_not_exists => TRUE);
        PERFORM add_retention_policy('metrics_aggregate_hourly', INTERVAL '365 days', if_not_exists => TRUE);
    END IF;
END $$;

-- ========================================
-- 7. Functions for Metrics Aggregation
-- ========================================

-- Function to aggregate metrics into 1-minute buckets
CREATE OR REPLACE FUNCTION aggregate_metrics_1min(start_time TIMESTAMP WITH TIME ZONE, end_time TIMESTAMP WITH TIME ZONE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO metrics_aggregate_1min (
        organization_id, bucket_time, route, method,
        total_requests, total_errors, avg_duration_ms,
        p50_duration_ms, p95_duration_ms, p99_duration_ms,
        total_request_bytes, total_response_bytes,
        unique_users, error_breakdown
    )
    SELECT 
        organization_id,
        date_trunc('minute', created_at) as bucket_time,
        route,
        method,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as total_errors,
        AVG(duration_ms) as avg_duration_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as p50_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_duration_ms,
        SUM(request_size) as total_request_bytes,
        SUM(response_size) as total_response_bytes,
        COUNT(DISTINCT user_id) as unique_users,
        jsonb_object_agg(
            COALESCE(error_type, 'none'),
            COUNT(*) FILTER (WHERE error_type IS NOT NULL)
        ) as error_breakdown
    FROM metrics_raw
    WHERE created_at >= start_time AND created_at < end_time
    GROUP BY organization_id, date_trunc('minute', created_at), route, method
    ON CONFLICT (organization_id, bucket_time, route, method) 
    DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        total_errors = EXCLUDED.total_errors,
        avg_duration_ms = EXCLUDED.avg_duration_ms,
        p50_duration_ms = EXCLUDED.p50_duration_ms,
        p95_duration_ms = EXCLUDED.p95_duration_ms,
        p99_duration_ms = EXCLUDED.p99_duration_ms,
        total_request_bytes = EXCLUDED.total_request_bytes,
        total_response_bytes = EXCLUDED.total_response_bytes,
        unique_users = EXCLUDED.unique_users,
        error_breakdown = EXCLUDED.error_breakdown;
END;
$$ LANGUAGE plpgsql;

-- Function to rollup 1-minute metrics to hourly
CREATE OR REPLACE FUNCTION rollup_metrics_hourly(start_time TIMESTAMP WITH TIME ZONE, end_time TIMESTAMP WITH TIME ZONE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO metrics_aggregate_hourly (
        organization_id, bucket_time, route, method,
        total_requests, total_errors, avg_duration_ms,
        p50_duration_ms, p95_duration_ms, p99_duration_ms,
        total_request_bytes, total_response_bytes,
        unique_users, error_breakdown
    )
    SELECT 
        organization_id,
        date_trunc('hour', bucket_time) as bucket_time,
        route,
        method,
        SUM(total_requests) as total_requests,
        SUM(total_errors) as total_errors,
        AVG(avg_duration_ms) as avg_duration_ms,
        AVG(p50_duration_ms) as p50_duration_ms,
        AVG(p95_duration_ms) as p95_duration_ms,
        AVG(p99_duration_ms) as p99_duration_ms,
        SUM(total_request_bytes) as total_request_bytes,
        SUM(total_response_bytes) as total_response_bytes,
        SUM(unique_users) as unique_users,
        jsonb_object_agg(
            key,
            SUM((value::text)::integer)
        ) as error_breakdown
    FROM metrics_aggregate_1min,
         jsonb_each(error_breakdown)
    WHERE bucket_time >= start_time AND bucket_time < end_time
    GROUP BY organization_id, date_trunc('hour', bucket_time), route, method
    ON CONFLICT (organization_id, bucket_time, route, method) 
    DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        total_errors = EXCLUDED.total_errors,
        avg_duration_ms = EXCLUDED.avg_duration_ms,
        p50_duration_ms = EXCLUDED.p50_duration_ms,
        p95_duration_ms = EXCLUDED.p95_duration_ms,
        p99_duration_ms = EXCLUDED.p99_duration_ms,
        total_request_bytes = EXCLUDED.total_request_bytes,
        total_response_bytes = EXCLUDED.total_response_bytes,
        unique_users = EXCLUDED.unique_users,
        error_breakdown = EXCLUDED.error_breakdown;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. Assign Default Permissions to Roles
-- ========================================

-- Helper function to assign permissions to roles
CREATE OR REPLACE FUNCTION assign_permissions_to_role(role_name VARCHAR, permission_names TEXT[])
RETURNS VOID AS $$
DECLARE
    role_record RECORD;
    perm_name TEXT;
    perm_id UUID;
BEGIN
    -- Find all roles with this name across organizations
    FOR role_record IN SELECT id FROM roles WHERE name = role_name
    LOOP
        -- Assign each permission
        FOREACH perm_name IN ARRAY permission_names
        LOOP
            -- Get permission ID
            SELECT id INTO perm_id FROM permissions WHERE name = perm_name;
            
            IF perm_id IS NOT NULL THEN
                INSERT INTO role_permissions (role_id, permission_id, granted_at)
                VALUES (role_record.id, perm_id, NOW())
                ON CONFLICT (role_id, permission_id) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Assign permissions to default roles
SELECT assign_permissions_to_role('admin', ARRAY[
    'chat.message:create', 'chat.message:read', 'chat.message:update', 'chat.message:delete',
    'chat.thread:create', 'chat.thread:manage',
    'document:create', 'document:read', 'document:update', 'document:delete', 
    'document:search', 'document:download',
    'admin.audit:view', 'admin.audit:export', 'admin.metrics:view',
    'admin.api_key:manage', 'admin.webhook:manage', 'admin.user:manage',
    'admin.role:manage', 'admin.org:manage'
]);

SELECT assign_permissions_to_role('manager', ARRAY[
    'chat.message:create', 'chat.message:read', 'chat.message:update',
    'chat.thread:create', 'chat.thread:manage',
    'document:create', 'document:read', 'document:update', 'document:search', 'document:download',
    'admin.audit:view', 'admin.metrics:view', 'admin.user:manage'
]);

SELECT assign_permissions_to_role('member', ARRAY[
    'chat.message:create', 'chat.message:read', 'chat.message:update',
    'chat.thread:create',
    'document:create', 'document:read', 'document:search', 'document:download'
]);

SELECT assign_permissions_to_role('viewer', ARRAY[
    'chat.message:read',
    'document:read', 'document:search'
]);

-- Create Support Agent role with read-only chat access
INSERT INTO roles (id, organization_id, name, display_name, description, is_system_role, is_active, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    id,
    'support_agent',
    'Support Agent',
    'Read-only access to chat for support purposes',
    true,
    true,
    NOW(),
    NOW()
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

-- Assign read-only permissions to Support Agent
SELECT assign_permissions_to_role('support_agent', ARRAY[
    'chat.message:read',
    'chat.thread:read'
]);

-- ========================================
-- 9. RLS Policies for New Tables
-- ========================================

-- Enable RLS on new tables
ALTER TABLE permission_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_aggregate_1min ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_aggregate_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_violation_metrics ENABLE ROW LEVEL SECURITY;

-- Permission cache policies
CREATE POLICY permission_cache_policy ON permission_cache
    FOR ALL USING (
        user_id = auth.uid() OR
        organization_id IN (SELECT unnest(user_organization_ids()))
    );

-- Webhook deliveries policies
CREATE POLICY webhook_deliveries_policy ON webhook_deliveries
    FOR ALL USING (
        webhook_id IN (
            SELECT id FROM webhooks 
            WHERE organization_id IN (SELECT unnest(user_organization_ids()))
        )
    );

-- Metrics policies (organization-scoped)
CREATE POLICY metrics_raw_policy ON metrics_raw
    FOR ALL USING (
        organization_id IN (SELECT unnest(user_organization_ids())) OR
        organization_id IS NULL  -- Platform-wide metrics
    );

CREATE POLICY metrics_agg_1min_policy ON metrics_aggregate_1min
    FOR ALL USING (
        organization_id IN (SELECT unnest(user_organization_ids())) OR
        organization_id IS NULL
    );

CREATE POLICY metrics_agg_hourly_policy ON metrics_aggregate_hourly
    FOR ALL USING (
        organization_id IN (SELECT unnest(user_organization_ids())) OR
        organization_id IS NULL
    );

CREATE POLICY policy_violations_policy ON policy_violation_metrics
    FOR ALL USING (
        organization_id IN (SELECT unnest(user_organization_ids()))
    );

-- ========================================
-- 10. Indexes for Performance
-- ========================================

-- RBAC performance indexes
CREATE INDEX IF NOT EXISTS user_roles_user_org_idx ON user_roles (user_id, organization_id);
CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions (role_id);

-- API key lookup performance
CREATE INDEX IF NOT EXISTS api_keys_org_active_idx ON api_keys (organization_id, is_active);

-- Webhook event filtering
CREATE INDEX IF NOT EXISTS webhooks_org_events_idx ON webhooks USING gin (organization_id, events);

-- Audit log search performance
CREATE INDEX IF NOT EXISTS audit_logs_org_action_idx ON audit_logs (organization_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_user_id, created_at DESC);

-- Metrics query performance
CREATE INDEX IF NOT EXISTS metrics_raw_duration_idx ON metrics_raw (duration_ms);
CREATE INDEX IF NOT EXISTS metrics_raw_error_idx ON metrics_raw (error_type) WHERE error_type IS NOT NULL;

-- Cleanup old permission cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_permission_cache()
RETURNS VOID AS $$
BEGIN
    DELETE FROM permission_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;