-- Migration 004: Governance, Billing, and Security Tables
-- Description: Tables for AI governance engine, billing, and enhanced security features

-- Enable additional extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- SECRETS MANAGER TABLES
-- =============================================

-- Encryption keys for customer data
CREATE TABLE encryption_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    encrypted_key BYTEA NOT NULL, -- Encrypted with master key
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(organization_id, key_name, key_version)
);

-- Encrypted secrets storage
CREATE TABLE secrets_manager (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    secret_name VARCHAR(255) NOT NULL,
    secret_type VARCHAR(50) NOT NULL, -- 'api_key', 'oauth_token', 'webhook_secret'
    encrypted_value BYTEA NOT NULL,
    encryption_key_id UUID NOT NULL REFERENCES encryption_keys(id),
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(organization_id, secret_name)
);

-- =============================================
-- EVALUATOR FRAMEWORK TABLES
-- =============================================

-- LLM Evaluator configurations
CREATE TABLE evaluators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    evaluator_type VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'gemini', 'local_llm'
    model_name VARCHAR(255) NOT NULL,
    endpoint_url VARCHAR(500),
    api_key_secret_id UUID REFERENCES secrets_manager(id),
    configuration JSONB NOT NULL DEFAULT '{}', -- model params, system prompts
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Evaluator pool configurations
CREATE TABLE evaluator_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    evaluator_ids UUID[] NOT NULL, -- Array of evaluator IDs
    load_balancing_strategy VARCHAR(50) DEFAULT 'round_robin', -- 'round_robin', 'weighted', 'fastest'
    timeout_ms INTEGER NOT NULL DEFAULT 800,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- =============================================
-- POLICY FRAMEWORK TABLES
-- =============================================

-- AI Governance Policies
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    policy_yaml TEXT NOT NULL, -- YAML policy definition
    parsed_config JSONB NOT NULL, -- Parsed YAML for fast access
    priority INTEGER NOT NULL DEFAULT 100, -- Lower number = higher priority
    is_active BOOLEAN NOT NULL DEFAULT true,
    evaluator_pool_id UUID REFERENCES evaluator_pools(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Policy evaluation results
CREATE TABLE policy_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES policies(id),
    user_id UUID REFERENCES users(id),
    thread_id UUID REFERENCES chat_threads(id),
    message_id UUID REFERENCES chat_messages(id),
    input_text TEXT NOT NULL,
    generated_text TEXT,
    final_text TEXT,
    action_taken VARCHAR(50) NOT NULL, -- 'allow', 'block', 'rewrite', 'redact'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    evaluator_scores JSONB NOT NULL DEFAULT '{}', -- Individual evaluator scores
    metadata JSONB DEFAULT '{}',
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX (organization_id, created_at),
    INDEX (policy_id, action_taken)
);

-- Policy violation tracking
CREATE TABLE policy_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    policy_evaluation_id UUID NOT NULL REFERENCES policy_evaluations(id),
    violation_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    rule_matched TEXT NOT NULL,
    confidence_score DECIMAL(5,4),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX (organization_id, severity, created_at)
);

-- =============================================
-- BILLING AND SUBSCRIPTIONS
-- =============================================

-- Subscription plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE, -- 'starter', 'business', 'enterprise'
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    quotas JSONB NOT NULL DEFAULT '{}', -- storage_gb, tokens_monthly, evaluator_calls
    features JSONB NOT NULL DEFAULT '{}', -- feature flags
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'incomplete'
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Usage tracking for billing
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    usage_type VARCHAR(100) NOT NULL, -- 'tokens', 'storage', 'evaluator_calls', 'api_calls'
    quantity DECIMAL(15,4) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'tokens', 'bytes', 'calls'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}',
    stripe_usage_record_id VARCHAR(255),
    INDEX (organization_id, usage_type, period_start),
    INDEX (subscription_id, timestamp)
);

-- Quota limits and current usage
CREATE TABLE quota_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    usage_type VARCHAR(100) NOT NULL,
    current_usage DECIMAL(15,4) NOT NULL DEFAULT 0,
    quota_limit DECIMAL(15,4) NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, usage_type, period_start)
);

-- =============================================
-- ENHANCED AUTHENTICATION
-- =============================================

-- Email verification tokens
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX (token),
    INDEX (user_id, expires_at)
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX (token),
    INDEX (user_id, expires_at)
);

-- TOTP MFA settings
CREATE TABLE user_mfa_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    secret_key VARCHAR(255), -- Base32 encoded TOTP secret
    backup_codes TEXT[], -- Array of recovery codes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- MFA verification attempts
CREATE TABLE mfa_verification_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_type VARCHAR(50) NOT NULL, -- 'totp', 'backup_code'
    success BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX (user_id, created_at)
);

-- OAuth provider configurations
CREATE TABLE oauth_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    provider_name VARCHAR(100) NOT NULL, -- 'google', 'okta', 'azure'
    client_id VARCHAR(255) NOT NULL,
    client_secret_id UUID REFERENCES secrets_manager(id),
    configuration JSONB NOT NULL DEFAULT '{}', -- provider-specific config
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, provider_name)
);

-- =============================================
-- ALERTING AND MONITORING
-- =============================================

-- Alert rules configuration
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50) NOT NULL, -- 'threshold', 'anomaly', 'trend'
    threshold_value DECIMAL(15,4),
    comparison_operator VARCHAR(10), -- '>', '<', '>=', '<=', '='
    evaluation_window_minutes INTEGER NOT NULL DEFAULT 5,
    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
    notification_channels JSONB NOT NULL DEFAULT '[]', -- webhook URLs, emails
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Alert instances (fired alerts)
CREATE TABLE alert_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alert_rule_id UUID NOT NULL REFERENCES alert_rules(id),
    fired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    severity VARCHAR(20) NOT NULL,
    metric_value DECIMAL(15,4),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    notification_status JSONB DEFAULT '{}', -- delivery status per channel
    INDEX (organization_id, fired_at),
    INDEX (alert_rule_id, fired_at)
);

-- =============================================
-- CACHING AND PERFORMANCE
-- =============================================

-- Response cache for identical prompts
CREATE TABLE response_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    prompt_hash VARCHAR(64) NOT NULL, -- SHA-256 of prompt + context
    context_hash VARCHAR(64) NOT NULL, -- SHA-256 of data room context
    cached_response TEXT NOT NULL,
    policy_evaluation_id UUID REFERENCES policy_evaluations(id),
    hit_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    INDEX (organization_id, prompt_hash, context_hash),
    INDEX (expires_at)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Policies indexes
CREATE INDEX idx_policies_org_active ON policies(organization_id, is_active);
CREATE INDEX idx_policies_priority ON policies(organization_id, priority, is_active);

-- Policy evaluations indexes
CREATE INDEX idx_evaluations_thread ON policy_evaluations(thread_id, created_at);
CREATE INDEX idx_evaluations_user ON policy_evaluations(user_id, created_at);
CREATE INDEX idx_evaluations_action ON policy_evaluations(organization_id, action_taken, created_at);

-- Usage records indexes for billing queries
CREATE INDEX idx_usage_records_org_period ON usage_records(organization_id, usage_type, period_start, period_end);
CREATE INDEX idx_usage_records_subscription ON usage_records(subscription_id, timestamp);

-- Alert instances for monitoring
CREATE INDEX idx_alert_instances_rule ON alert_instances(alert_rule_id, fired_at);
CREATE INDEX idx_alert_instances_unresolved ON alert_instances(organization_id, fired_at) WHERE resolved_at IS NULL;

-- =============================================
-- SEED DATA
-- =============================================

-- Default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, quotas, features) VALUES
('starter', 'Starter', 'Perfect for small teams getting started', 29.00, 290.00, 
 '{"storage_gb": 10, "tokens_monthly": 100000, "evaluator_calls": 1000, "api_calls": 10000}',
 '{"basic_policies": true, "email_support": true}'),
('business', 'Business', 'Advanced features for growing organizations', 99.00, 990.00,
 '{"storage_gb": 100, "tokens_monthly": 1000000, "evaluator_calls": 10000, "api_calls": 100000}',
 '{"advanced_policies": true, "custom_evaluators": true, "priority_support": true, "sso": true}'),
('enterprise', 'Enterprise', 'Full-featured solution for large enterprises', 499.00, 4990.00,
 '{"storage_gb": 1000, "tokens_monthly": 10000000, "evaluator_calls": 100000, "api_calls": 1000000}',
 '{"unlimited_policies": true, "custom_models": true, "dedicated_support": true, "advanced_analytics": true, "compliance_features": true}');

-- Default alert rules for system monitoring
INSERT INTO alert_rules (organization_id, name, description, metric_name, condition_type, threshold_value, comparison_operator, severity, notification_channels) 
SELECT 
    id as organization_id,
    'High Error Rate',
    'Alert when error rate exceeds 5%',
    'error_rate',
    'threshold',
    0.05,
    '>',
    'warning',
    '[]'::jsonb
FROM organizations
WHERE name = 'system'; -- Assuming there's a system org for defaults

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_secrets_manager_updated_at BEFORE UPDATE ON secrets_manager FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_evaluators_updated_at BEFORE UPDATE ON evaluators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_evaluator_pools_updated_at BEFORE UPDATE ON evaluator_pools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_mfa_settings_updated_at BEFORE UPDATE ON user_mfa_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_oauth_providers_updated_at BEFORE UPDATE ON oauth_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean up expired email verification tokens
    DELETE FROM email_verification_tokens WHERE expires_at < NOW() AND verified_at IS NULL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up expired password reset tokens
    DELETE FROM password_reset_tokens WHERE expires_at < NOW() AND used_at IS NULL;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Clean up expired response cache
    DELETE FROM response_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update quota usage
CREATE OR REPLACE FUNCTION update_quota_usage(
    org_id UUID,
    usage_type_param VARCHAR(100),
    usage_amount DECIMAL(15,4),
    period_start_param TIMESTAMP WITH TIME ZONE DEFAULT date_trunc('month', NOW()),
    period_end_param TIMESTAMP WITH TIME ZONE DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month')
)
RETURNS BOOLEAN AS $$
DECLARE
    current_quota_limit DECIMAL(15,4);
    new_usage DECIMAL(15,4);
BEGIN
    -- Get current quota limit from subscription
    SELECT COALESCE((sp.quotas ->> usage_type_param)::DECIMAL, 0)
    INTO current_quota_limit
    FROM subscriptions s
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.organization_id = org_id AND s.status = 'active';
    
    -- Insert or update quota usage
    INSERT INTO quota_usage (organization_id, usage_type, current_usage, quota_limit, period_start, period_end)
    VALUES (org_id, usage_type_param, usage_amount, COALESCE(current_quota_limit, 0), period_start_param, period_end_param)
    ON CONFLICT (organization_id, usage_type, period_start)
    DO UPDATE SET
        current_usage = quota_usage.current_usage + usage_amount,
        quota_limit = COALESCE(current_quota_limit, quota_usage.quota_limit),
        last_updated = NOW()
    RETURNING current_usage INTO new_usage;
    
    -- Return true if under quota (with 10% grace)
    RETURN new_usage <= (current_quota_limit * 1.1);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- GRANTS AND SECURITY
-- =============================================

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO crossaudit_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crossaudit_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO crossaudit_app;

-- Row Level Security for multi-tenancy
ALTER TABLE secrets_manager ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluators ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluator_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (will be enforced at application level for now)
-- These would be activated when using database-level multi-tenancy

COMMENT ON SCHEMA public IS 'CrossAudit AI Governance Platform - Migration 004: Governance, Billing, and Security';