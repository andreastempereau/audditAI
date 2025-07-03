-- CrossAudit Core Schema Migration
-- Creates comprehensive database schema for all application features
-- Compatible with Supabase and PostgreSQL 15+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- CORE FOUNDATION TABLES (USER AND ORGANIZATION MANAGEMENT)
-- =============================================================================

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    picture_url TEXT,
    first_time BOOLEAN DEFAULT true,
    mfa_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tier VARCHAR(50) DEFAULT 'free',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User organization memberships
CREATE TABLE IF NOT EXISTS public.user_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, org_id)
);

-- =============================================================================
-- RBAC SYSTEM TABLES
-- =============================================================================

-- System permissions registry
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT permissions_name_format CHECK (name ~ '^[a-z][a-z0-9_]*[a-z0-9]$'),
    CONSTRAINT permissions_resource_action UNIQUE (resource, action)
);

-- Organizational roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Organizational departments/teams
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    default_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT departments_no_self_parent CHECK (id != parent_department_id)
);

-- User role assignments with department context
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_roles_expiry_check CHECK (expires_at IS NULL OR expires_at > granted_at)
);

-- =============================================================================
-- CHAT SYSTEM TABLES
-- =============================================================================

-- Chat conversation threads
CREATE TABLE IF NOT EXISTS public.chat_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    is_private BOOLEAN NOT NULL DEFAULT false,
    participants UUID[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    message_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chat_threads_message_count_positive CHECK (message_count >= 0)
);

-- Individual chat messages with threading support
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    parent_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL DEFAULT 'text',
    message_type VARCHAR(20) NOT NULL DEFAULT 'user',
    sequence_number INTEGER NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chat_messages_content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT chat_messages_content_type_valid CHECK (content_type IN ('text', 'markdown', 'html', 'code')),
    CONSTRAINT chat_messages_message_type_valid CHECK (message_type IN ('user', 'assistant', 'system', 'bot'))
);

-- =============================================================================
-- DOCUMENT MANAGEMENT TABLES
-- =============================================================================

-- Core document registry
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    document_type VARCHAR(50) NOT NULL DEFAULT 'general',
    current_version INTEGER NOT NULL DEFAULT 1,
    total_versions INTEGER NOT NULL DEFAULT 1,
    file_size BIGINT,
    mime_type VARCHAR(200),
    checksum VARCHAR(64),
    storage_path TEXT,
    sensitivity_level VARCHAR(20) NOT NULL DEFAULT 'restricted',
    encryption_key_id UUID,
    retention_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT documents_version_positive CHECK (current_version > 0 AND total_versions > 0),
    CONSTRAINT documents_current_version_valid CHECK (current_version <= total_versions),
    CONSTRAINT documents_file_size_positive CHECK (file_size IS NULL OR file_size >= 0),
    CONSTRAINT documents_sensitivity_valid CHECK (sensitivity_level IN ('public', 'internal', 'restricted', 'confidential', 'secret')),
    CONSTRAINT documents_checksum_format CHECK (checksum IS NULL OR checksum ~ '^[a-f0-9]{64}$')
);

-- Document version history with content tracking
CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(200) NOT NULL,
    storage_path TEXT NOT NULL,
    change_type VARCHAR(20) NOT NULL DEFAULT 'update',
    change_description TEXT,
    diff_data JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    parent_version_id UUID REFERENCES public.document_versions(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_versions_unique UNIQUE (document_id, version_number),
    CONSTRAINT document_versions_positive_version CHECK (version_number > 0),
    CONSTRAINT document_versions_positive_size CHECK (file_size >= 0),
    CONSTRAINT document_versions_change_type_valid CHECK (change_type IN ('create', 'update', 'delete', 'restore', 'merge')),
    CONSTRAINT document_versions_hash_format CHECK (content_hash ~ '^[a-f0-9]{64}$')
);

-- Text fragments for vector search and content analysis
CREATE TABLE IF NOT EXISTS public.fragments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_preview TEXT NOT NULL,
    page_number INTEGER,
    paragraph_number INTEGER,
    line_start INTEGER,
    line_end INTEGER,
    char_start INTEGER,
    char_end INTEGER,
    fragment_type VARCHAR(50) NOT NULL DEFAULT 'paragraph',
    language VARCHAR(10),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    sensitivity_level VARCHAR(20) NOT NULL DEFAULT 'restricted',
    embedding vector(1536), -- OpenAI embedding dimension
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_deprecated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fragments_content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT fragments_confidence_range CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT fragments_sensitivity_valid CHECK (sensitivity_level IN ('public', 'internal', 'restricted', 'confidential', 'secret')),
    CONSTRAINT fragments_fragment_type_valid CHECK (fragment_type IN ('paragraph', 'sentence', 'table', 'list', 'header', 'code', 'quote')),
    CONSTRAINT fragments_position_valid CHECK ((line_start IS NULL AND line_end IS NULL) OR (line_start <= line_end)),
    CONSTRAINT fragments_char_position_valid CHECK ((char_start IS NULL AND char_end IS NULL) OR (char_start <= char_end))
);

-- =============================================================================
-- API MANAGEMENT TABLES
-- =============================================================================

-- API keys for external integrations
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    key_hash VARCHAR(128) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    rate_limit_rpm INTEGER,
    rate_limit_rph INTEGER,
    usage_count BIGINT NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT api_keys_hash_format CHECK (key_hash ~ '^[a-f0-9]{64,128}$'),
    CONSTRAINT api_keys_prefix_format CHECK (key_prefix ~ '^[a-z0-9_-]{4,20}$'),
    CONSTRAINT api_keys_rate_limits_positive CHECK ((rate_limit_rpm IS NULL OR rate_limit_rpm > 0) AND (rate_limit_rph IS NULL OR rate_limit_rph > 0)),
    CONSTRAINT api_keys_usage_positive CHECK (usage_count >= 0)
);

-- Webhook endpoint configurations
CREATE TABLE IF NOT EXISTS public.webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    url TEXT NOT NULL,
    secret_hash VARCHAR(128) NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    content_type VARCHAR(50) NOT NULL DEFAULT 'application/json',
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    retry_config JSONB NOT NULL DEFAULT '{"max_attempts": 3, "backoff_seconds": [1, 5, 25]}'::jsonb,
    headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    total_deliveries BIGINT NOT NULL DEFAULT 0,
    successful_deliveries BIGINT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT webhooks_url_format CHECK (url ~ '^https?://'),
    CONSTRAINT webhooks_timeout_positive CHECK (timeout_seconds > 0 AND timeout_seconds <= 300),
    CONSTRAINT webhooks_content_type_valid CHECK (content_type IN ('application/json', 'application/x-www-form-urlencoded')),
    CONSTRAINT webhooks_delivery_counts_valid CHECK (successful_deliveries <= total_deliveries),
    CONSTRAINT webhooks_events_not_empty CHECK (array_length(events, 1) > 0)
);

-- Webhook delivery attempts and logs
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    http_status INTEGER,
    response_body TEXT,
    response_headers JSONB,
    delivery_duration_ms INTEGER,
    error_message TEXT,
    is_successful BOOLEAN NOT NULL DEFAULT false,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT webhook_events_attempt_positive CHECK (attempt_number > 0),
    CONSTRAINT webhook_events_http_status_valid CHECK (http_status IS NULL OR (http_status >= 100 AND http_status < 600)),
    CONSTRAINT webhook_events_duration_positive CHECK (delivery_duration_ms IS NULL OR delivery_duration_ms >= 0),
    CONSTRAINT webhook_events_timestamps_logical CHECK (
        (attempted_at IS NULL OR attempted_at >= scheduled_at) AND
        (completed_at IS NULL OR (attempted_at IS NOT NULL AND completed_at >= attempted_at))
    )
);

-- =============================================================================
-- AI GOVERNANCE TABLES
-- =============================================================================

-- AI governance policies
CREATE TABLE IF NOT EXISTS public.policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    policy_type VARCHAR(50) NOT NULL DEFAULT 'content_filter',
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    actions JSONB NOT NULL DEFAULT '{}'::jsonb,
    priority INTEGER NOT NULL DEFAULT 100,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    applies_to TEXT[] NOT NULL DEFAULT '{"all"}',
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT policies_priority_positive CHECK (priority > 0),
    CONSTRAINT policies_policy_type_valid CHECK (policy_type IN ('content_filter', 'bias_detection', 'safety_check', 'compliance', 'quality_gate')),
    CONSTRAINT policies_version_format CHECK (version ~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$')
);

-- AI model evaluators and configurations
CREATE TABLE IF NOT EXISTS public.evaluators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    evaluator_type VARCHAR(50) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    prompt_template TEXT,
    threshold_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    cost_per_evaluation DECIMAL(10,6),
    avg_response_time_ms INTEGER,
    success_rate DECIMAL(5,4) DEFAULT 1.0,
    total_evaluations BIGINT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT evaluators_type_valid CHECK (evaluator_type IN ('toxicity', 'bias', 'factuality', 'relevance', 'safety', 'compliance', 'custom')),
    CONSTRAINT evaluators_cost_positive CHECK (cost_per_evaluation IS NULL OR cost_per_evaluation >= 0),
    CONSTRAINT evaluators_response_time_positive CHECK (avg_response_time_ms IS NULL OR avg_response_time_ms >= 0),
    CONSTRAINT evaluators_success_rate_range CHECK (success_rate >= 0.0 AND success_rate <= 1.0),
    CONSTRAINT evaluators_evaluations_positive CHECK (total_evaluations >= 0)
);

-- =============================================================================
-- AUDIT AND METRICS TABLES
-- =============================================================================

-- Comprehensive audit logging for all system actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_type VARCHAR(50) NOT NULL DEFAULT 'user',
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changes JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(200),
    correlation_id UUID,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_logs_actor_type_valid CHECK (actor_type IN ('user', 'system', 'api_key', 'webhook', 'scheduled_job')),
    CONSTRAINT audit_logs_severity_valid CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical'))
);

-- Time-series metrics data for analytics and monitoring
CREATE TABLE IF NOT EXISTS public.metrics_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric_name VARCHAR(200) NOT NULL,
    metric_type VARCHAR(50) NOT NULL DEFAULT 'counter',
    value DECIMAL(20,6) NOT NULL,
    unit VARCHAR(50),
    dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retention_days INTEGER NOT NULL DEFAULT 90,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT metrics_data_type_valid CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'summary')),
    CONSTRAINT metrics_data_retention_positive CHECK (retention_days > 0)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Core foundation indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON public.user_organizations(org_id);

-- RBAC indexes
CREATE INDEX IF NOT EXISTS idx_roles_organization_id ON public.roles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_departments_organization_id ON public.departments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_departments_parent ON public.departments(parent_department_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id) WHERE is_active = true;

-- RBAC unique constraints as partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_org_name_unique ON public.roles(organization_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_org_name_unique ON public.departments(organization_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_active_unique ON public.user_roles(user_id, role_id, department_id) WHERE is_active = true;

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_threads_organization_id ON public.chat_threads(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_threads_created_by ON public.chat_threads(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_sequence ON public.chat_messages(thread_id, sequence_number) WHERE deleted_at IS NULL;

-- Chat unique constraints as partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_thread_sequence_unique ON public.chat_messages(thread_id, sequence_number) WHERE deleted_at IS NULL;

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON public.documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON public.documents(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_sensitivity ON public.documents(sensitivity_level) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tags ON public.documents USING GIN(tags) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_active ON public.document_versions(document_id, version_number) WHERE is_active = true;

-- Fragment indexes for search
CREATE INDEX IF NOT EXISTS idx_fragments_document_id ON public.fragments(document_id);
CREATE INDEX IF NOT EXISTS idx_fragments_embedding ON public.fragments USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_fragments_content_trgm ON public.fragments USING GIN(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fragments_tags ON public.fragments USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_fragments_type ON public.fragments(fragment_type) WHERE is_deprecated = false;

-- API management indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON public.api_keys(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webhooks_organization_id ON public.webhooks(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON public.webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_scheduled ON public.webhook_events(scheduled_at) WHERE is_successful = false;

-- API management unique constraints as partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_org_name_unique ON public.api_keys(organization_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhooks_org_name_unique ON public.webhooks(organization_id, name) WHERE deleted_at IS NULL;

-- Policy and evaluator indexes
CREATE INDEX IF NOT EXISTS idx_policies_organization_id ON public.policies(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_policies_enabled ON public.policies(organization_id, priority) WHERE is_enabled = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evaluators_organization_id ON public.evaluators(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evaluators_enabled ON public.evaluators(organization_id) WHERE is_enabled = true AND deleted_at IS NULL;

-- Policy and evaluator unique constraints as partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_org_name_unique ON public.policies(organization_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluators_org_name_unique ON public.evaluators(organization_id, name) WHERE deleted_at IS NULL;

-- Audit and metrics indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_metrics_data_organization_id ON public.metrics_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_metrics_data_name_timestamp ON public.metrics_data(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_data_dimensions ON public.metrics_data USING GIN(dimensions);

-- JSONB indexes for search performance
CREATE INDEX IF NOT EXISTS idx_roles_permissions ON public.roles USING GIN(permissions);
CREATE INDEX IF NOT EXISTS idx_departments_metadata ON public.departments USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_fragments_metadata ON public.fragments USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_policies_rules ON public.policies USING GIN(rules);
CREATE INDEX IF NOT EXISTS idx_evaluators_config ON public.evaluators USING GIN(model_config);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON public.audit_logs USING GIN(metadata);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_data ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION public.user_organization_ids()
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT uo.org_id 
        FROM public.user_organizations uo 
        WHERE uo.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Basic RLS policies
-- Profiles - users can read/update their own profile
CREATE POLICY "profiles_own_access" ON public.profiles 
    FOR ALL USING (id = auth.uid());

-- Organizations - users can access organizations they belong to
CREATE POLICY "organizations_member_access" ON public.organizations 
    FOR ALL USING (id = ANY(public.user_organization_ids()));

-- User organizations - users can see memberships for their organizations
CREATE POLICY "user_organizations_access" ON public.user_organizations 
    FOR ALL USING (org_id = ANY(public.user_organization_ids()));

-- Permissions are global/system-wide
CREATE POLICY "permissions_readable" ON public.permissions FOR SELECT USING (true);

-- Organization-scoped access for most entities
CREATE POLICY "roles_organization_access" ON public.roles 
    FOR ALL USING (organization_id = ANY(public.user_organization_ids()));

CREATE POLICY "departments_organization_access" ON public.departments 
    FOR ALL USING (organization_id = ANY(public.user_organization_ids()));

CREATE POLICY "user_roles_organization_access" ON public.user_roles 
    FOR ALL USING (role_id IN (SELECT id FROM public.roles WHERE organization_id = ANY(public.user_organization_ids())));

CREATE POLICY "chat_threads_organization_access" ON public.chat_threads 
    FOR ALL USING (organization_id = ANY(public.user_organization_ids()));

CREATE POLICY "chat_messages_organization_access" ON public.chat_messages 
    FOR ALL USING (thread_id IN (SELECT id FROM public.chat_threads WHERE organization_id = ANY(public.user_organization_ids())));

CREATE POLICY "documents_organization_access" ON public.documents 
    FOR ALL USING (organization_id = ANY(public.user_organization_ids()));

CREATE POLICY "document_versions_organization_access" ON public.document_versions 
    FOR ALL USING (document_id IN (SELECT id FROM public.documents WHERE organization_id = ANY(public.user_organization_ids())));

CREATE POLICY "fragments_organization_access" ON public.fragments 
    FOR ALL USING (document_id IN (SELECT id FROM public.documents WHERE organization_id = ANY(public.user_organization_ids())));

CREATE POLICY "api_keys_organization_access" ON public.api_keys 
    FOR ALL USING (organization_id = ANY(public.user_organization_ids()));

CREATE POLICY "webhooks_organization_access" ON public.webhooks 
    FOR ALL USING (organization_id = ANY(public.user_organization_ids()));

CREATE POLICY "webhook_events_organization_access" ON public.webhook_events 
    FOR ALL USING (webhook_id IN (SELECT id FROM public.webhooks WHERE organization_id = ANY(public.user_organization_ids())));

CREATE POLICY "policies_organization_access" ON public.policies 
    FOR ALL USING (organization_id = ANY(public.user_organization_ids()));

CREATE POLICY "evaluators_organization_access" ON public.evaluators 
    FOR ALL USING (organization_id = ANY(public.user_organization_ids()));

CREATE POLICY "audit_logs_organization_access" ON public.audit_logs 
    FOR SELECT USING (organization_id = ANY(public.user_organization_ids()));

CREATE POLICY "metrics_data_organization_access" ON public.metrics_data 
    FOR SELECT USING (organization_id = ANY(public.user_organization_ids()));

-- =============================================================================
-- TRIGGERS AND AUTOMATION
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_chat_threads_updated_at BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_fragments_updated_at BEFORE UPDATE ON public.fragments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_webhooks_updated_at BEFORE UPDATE ON public.webhooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_policies_updated_at BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trigger_evaluators_updated_at BEFORE UPDATE ON public.evaluators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to auto-assign sequence numbers to chat messages
CREATE OR REPLACE FUNCTION public.assign_chat_message_sequence()
RETURNS TRIGGER AS $$
BEGIN
    -- Assign next sequence number for the thread
    SELECT COALESCE(MAX(sequence_number), 0) + 1
    INTO NEW.sequence_number
    FROM public.chat_messages
    WHERE thread_id = NEW.thread_id AND deleted_at IS NULL;
    
    -- Update thread message count and last message time
    UPDATE public.chat_threads
    SET message_count = message_count + 1,
        last_message_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.thread_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_chat_message_sequence 
    BEFORE INSERT ON public.chat_messages 
    FOR EACH ROW EXECUTE FUNCTION public.assign_chat_message_sequence();

-- Audit logging trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    old_data JSONB;
    new_data JSONB;
    changes JSONB;
BEGIN
    -- Determine organization_id
    org_id := COALESCE(
        (NEW ->> 'organization_id')::UUID,
        (OLD ->> 'organization_id')::UUID
    );
    
    -- Prepare data for logging
    IF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        changes := new_data - old_data;
    ELSIF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        new_data := to_jsonb(NEW);
    END IF;
    
    -- Insert audit log
    INSERT INTO public.audit_logs (
        organization_id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        changes,
        metadata
    ) VALUES (
        org_id,
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE((NEW ->> 'id')::UUID, (OLD ->> 'id')::UUID),
        changes,
        jsonb_build_object(
            'table_name', TG_TABLE_NAME,
            'schema_name', TG_TABLE_SCHEMA
        )
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_chat_messages AFTER INSERT OR UPDATE OR DELETE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_document_versions AFTER INSERT OR UPDATE OR DELETE ON public.document_versions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_api_keys AFTER INSERT OR UPDATE OR DELETE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_policies AFTER INSERT OR UPDATE OR DELETE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================================================
-- SEED DATA FOR SYSTEM DEFAULTS
-- =============================================================================

-- Insert system permissions
INSERT INTO public.permissions (name, description, resource, action) VALUES
    ('read_documents', 'Read documents and files', 'document', 'read'),
    ('write_documents', 'Create and modify documents', 'document', 'write'),
    ('delete_documents', 'Delete documents and files', 'document', 'delete'),
    ('manage_users', 'Manage organization users', 'user', 'manage'),
    ('manage_roles', 'Manage roles and permissions', 'role', 'manage'),
    ('view_audit_logs', 'View audit logs and system events', 'audit', 'read'),
    ('manage_integrations', 'Manage API keys and webhooks', 'integration', 'manage'),
    ('manage_policies', 'Manage AI governance policies', 'policy', 'manage'),
    ('admin_access', 'Full administrative access', 'system', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Table comments for documentation
COMMENT ON TABLE public.profiles IS 'User profiles extending auth.users with additional metadata';
COMMENT ON TABLE public.organizations IS 'Organizations/companies using the platform';
COMMENT ON TABLE public.user_organizations IS 'User membership in organizations';
COMMENT ON TABLE public.permissions IS 'System-wide permissions registry for RBAC';
COMMENT ON TABLE public.roles IS 'Organization-specific roles with assigned permissions';
COMMENT ON TABLE public.departments IS 'Organizational departments/teams with hierarchical structure';
COMMENT ON TABLE public.user_roles IS 'User role assignments with department context and expiration';
COMMENT ON TABLE public.chat_threads IS 'Chat conversation threads with participant management';
COMMENT ON TABLE public.chat_messages IS 'Individual chat messages with threading and sequencing';
COMMENT ON TABLE public.documents IS 'Core document registry with metadata and versioning';
COMMENT ON TABLE public.document_versions IS 'Document version history with change tracking';
COMMENT ON TABLE public.fragments IS 'Text fragments for vector search and content analysis';
COMMENT ON TABLE public.api_keys IS 'API keys for external integrations with rate limiting';
COMMENT ON TABLE public.webhooks IS 'Webhook configurations for event notifications';
COMMENT ON TABLE public.webhook_events IS 'Webhook delivery attempts and status tracking';
COMMENT ON TABLE public.policies IS 'AI governance policies with rules and conditions';
COMMENT ON TABLE public.evaluators IS 'AI model evaluators and configurations';
COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail for all system actions';
COMMENT ON TABLE public.metrics_data IS 'Time-series metrics for analytics and monitoring';