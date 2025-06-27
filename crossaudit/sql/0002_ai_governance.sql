-- AI Governance Tables for CrossAudit
-- This schema supports the AI governance gateway functionality

-- Extend existing audit_ledger with additional fields
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS evaluation_scores JSONB;
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS policy_decision TEXT;
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS violations TEXT[];
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS rewrite_applied BOOLEAN DEFAULT FALSE;
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS confidence_score REAL;
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS request_hash TEXT;
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS response_hash TEXT;
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS chain_hash TEXT;
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE audit_ledger ADD COLUMN IF NOT EXISTS signature TEXT;

-- LLM Providers Configuration
CREATE TABLE IF NOT EXISTS llm_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    provider_type TEXT NOT NULL, -- 'openai', 'anthropic', 'google', 'cohere'
    provider_name TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    base_url TEXT,
    default_model TEXT,
    rate_limits JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Policy Rules
CREATE TABLE IF NOT EXISTS policy_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    rule_name TEXT NOT NULL,
    description TEXT NOT NULL,
    condition_dsl TEXT NOT NULL, -- DSL for rule conditions
    action TEXT NOT NULL CHECK (action IN ('PASS', 'REWRITE', 'BLOCK', 'FLAG')),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    rewrite_template TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    global_rule BOOLEAN DEFAULT FALSE, -- Global rules apply to all orgs
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Document Store (for context retrieval)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    filename TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    department TEXT,
    sensitivity TEXT CHECK (sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
    metadata JSONB,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Document Chunks (for vector search)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimension
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(document_id, chunk_index)
);

-- Evaluator Configurations
CREATE TABLE IF NOT EXISTS evaluator_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    evaluator_type TEXT NOT NULL, -- 'toxicity', 'compliance', 'factual', 'brand'
    config JSONB NOT NULL, -- Evaluator-specific configuration
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, evaluator_type)
);

-- Brand Guidelines
CREATE TABLE IF NOT EXISTS brand_guidelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    tone_preferred TEXT[],
    tone_forbidden TEXT[],
    values_core TEXT[],
    values_forbidden TEXT[],
    key_phrases TEXT[],
    avoid_phrases TEXT[],
    voice_style TEXT,
    personality_traits TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Compliance Rules (organization-specific)
CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    rule_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'dataPrivacy', 'financial', 'healthcare', etc.
    pattern TEXT NOT NULL, -- Regex pattern
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- LLM Request/Response Cache
CREATE TABLE IF NOT EXISTS llm_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_hash TEXT NOT NULL UNIQUE,
    provider_type TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    response_data JSONB NOT NULL,
    token_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

-- Statistics and Analytics
CREATE TABLE IF NOT EXISTS audit_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    blocked_requests INTEGER DEFAULT 0,
    rewritten_requests INTEGER DEFAULT 0,
    flagged_requests INTEGER DEFAULT 0,
    avg_evaluation_time REAL DEFAULT 0,
    avg_toxicity_score REAL DEFAULT 0,
    avg_compliance_score REAL DEFAULT 0,
    avg_accuracy_score REAL DEFAULT 0,
    avg_brand_score REAL DEFAULT 0,
    total_violations INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_ledger_org_ts ON audit_ledger(org_id, ts_start);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_request_hash ON audit_ledger(request_hash);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_chain_hash ON audit_ledger(chain_hash);

CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_hash ON document_chunks(content_hash);

CREATE INDEX IF NOT EXISTS idx_policy_rules_org_id ON policy_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_enabled ON policy_rules(enabled);

CREATE INDEX IF NOT EXISTS idx_llm_providers_org_id ON llm_providers(org_id);
CREATE INDEX IF NOT EXISTS idx_llm_providers_enabled ON llm_providers(enabled);

CREATE INDEX IF NOT EXISTS idx_llm_cache_hash ON llm_cache(request_hash);
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_stats_org_date ON audit_statistics(org_id, date);

-- Install vector extension if not exists (for pgvector)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector similarity search index
-- CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_llm_providers_updated_at BEFORE UPDATE ON llm_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_policy_rules_updated_at BEFORE UPDATE ON policy_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_evaluator_configs_updated_at BEFORE UPDATE ON evaluator_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_brand_guidelines_updated_at BEFORE UPDATE ON brand_guidelines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_rules_updated_at BEFORE UPDATE ON compliance_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM llm_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Add some default global policy rules
INSERT INTO policy_rules (id, org_id, rule_name, description, condition_dsl, action, severity, global_rule, enabled)
VALUES 
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Critical Toxicity Block', 'Block responses with critical toxicity violations', 'toxicity < 0.2', 'BLOCK', 'CRITICAL', true, true),
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'High Toxicity Rewrite', 'Rewrite responses with high toxicity', 'toxicity < 0.5', 'REWRITE', 'HIGH', true, true),
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Compliance Violation Block', 'Block responses with critical compliance violations', 'policyCompliance < 0.3', 'BLOCK', 'CRITICAL', true, true),
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Low Accuracy Flag', 'Flag responses with low factual accuracy', 'factualAccuracy < 0.6', 'FLAG', 'MEDIUM', true, true)
ON CONFLICT DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO crossaudit_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crossaudit_app;