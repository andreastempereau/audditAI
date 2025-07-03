-- Migration: Enable pgvector extension and create vector search infrastructure
-- File: 002_vector_search.sql

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to fragments table
ALTER TABLE fragments 
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Create HNSW index for fast approximate nearest neighbor search
-- HNSW (Hierarchical Navigable Small World) is optimal for high-dimensional vectors
CREATE INDEX IF NOT EXISTS fragments_embedding_hnsw_idx 
ON fragments USING hnsw (embedding vector_cosine_ops);

-- Create additional index for metadata filtering during search
CREATE INDEX IF NOT EXISTS fragments_document_classification_idx 
ON fragments (document_id, classification_level);

-- Create index for fragment content search (full text search backup)
CREATE INDEX IF NOT EXISTS fragments_content_gin_idx 
ON fragments USING gin (to_tsvector('english', content));

-- Add performance optimization indexes
CREATE INDEX IF NOT EXISTS fragments_organization_created_idx 
ON fragments (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS document_versions_document_version_idx 
ON document_versions (document_id, version_number DESC);

-- Create materialized view for search performance optimization
CREATE MATERIALIZED VIEW IF NOT EXISTS fragment_search_view AS
SELECT 
    f.id,
    f.document_id,
    f.version_number,
    f.content,
    f.content_preview,
    f.start_page,
    f.end_page,
    f.fragment_type,
    f.classification_level,
    f.embedding,
    f.created_at,
    d.title as document_title,
    d.document_type,
    d.organization_id,
    dv.title as version_title,
    dv.change_description
FROM fragments f
JOIN documents d ON f.document_id = d.id
JOIN document_versions dv ON f.document_id = dv.document_id AND f.version_number = dv.version_number
WHERE f.embedding IS NOT NULL;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS fragment_search_view_embedding_idx 
ON fragment_search_view USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS fragment_search_view_org_idx 
ON fragment_search_view (organization_id);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_fragment_search_view()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY fragment_search_view;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-refresh materialized view when fragments are updated
DROP TRIGGER IF EXISTS refresh_fragment_search_trigger ON fragments;
CREATE TRIGGER refresh_fragment_search_trigger
    AFTER INSERT OR UPDATE OR DELETE ON fragments
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_fragment_search_view();

-- Add quota tracking table for organization limits
CREATE TABLE IF NOT EXISTS organization_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    storage_used_bytes BIGINT DEFAULT 0,
    version_count INTEGER DEFAULT 0,
    fragment_count INTEGER DEFAULT 0,
    storage_limit_bytes BIGINT DEFAULT 21474836480, -- 20 GB default
    version_limit INTEGER DEFAULT 10000,
    fragment_limit INTEGER DEFAULT 100000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Create index for quota lookups
CREATE INDEX IF NOT EXISTS organization_quotas_org_idx 
ON organization_quotas (organization_id);

-- Create function to update organization quotas
CREATE OR REPLACE FUNCTION update_organization_quotas()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    storage_delta BIGINT := 0;
    version_delta INTEGER := 0;
    fragment_delta INTEGER := 0;
BEGIN
    -- Determine organization ID based on table
    IF TG_TABLE_NAME = 'documents' THEN
        org_id := COALESCE(NEW.organization_id, OLD.organization_id);
        IF TG_OP = 'INSERT' THEN
            storage_delta := COALESCE(NEW.file_size, 0);
        ELSIF TG_OP = 'UPDATE' THEN
            storage_delta := COALESCE(NEW.file_size, 0) - COALESCE(OLD.file_size, 0);
        ELSIF TG_OP = 'DELETE' THEN
            storage_delta := -COALESCE(OLD.file_size, 0);
        END IF;
    ELSIF TG_TABLE_NAME = 'document_versions' THEN
        SELECT d.organization_id INTO org_id 
        FROM documents d 
        WHERE d.id = COALESCE(NEW.document_id, OLD.document_id);
        
        IF TG_OP = 'INSERT' THEN
            version_delta := 1;
        ELSIF TG_OP = 'DELETE' THEN
            version_delta := -1;
        END IF;
    ELSIF TG_TABLE_NAME = 'fragments' THEN
        SELECT d.organization_id INTO org_id 
        FROM documents d 
        WHERE d.id = COALESCE(NEW.document_id, OLD.document_id);
        
        IF TG_OP = 'INSERT' THEN
            fragment_delta := 1;
        ELSIF TG_OP = 'DELETE' THEN
            fragment_delta := -1;
        END IF;
    END IF;

    -- Update or insert quota record
    INSERT INTO organization_quotas (organization_id, storage_used_bytes, version_count, fragment_count)
    VALUES (org_id, storage_delta, version_delta, fragment_delta)
    ON CONFLICT (organization_id) 
    DO UPDATE SET
        storage_used_bytes = organization_quotas.storage_used_bytes + EXCLUDED.storage_used_bytes,
        version_count = organization_quotas.version_count + EXCLUDED.version_count,
        fragment_count = organization_quotas.fragment_count + EXCLUDED.fragment_count,
        updated_at = NOW();

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for quota tracking
DROP TRIGGER IF EXISTS documents_quota_trigger ON documents;
CREATE TRIGGER documents_quota_trigger
    AFTER INSERT OR UPDATE OF file_size OR DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_quotas();

DROP TRIGGER IF EXISTS document_versions_quota_trigger ON document_versions;
CREATE TRIGGER document_versions_quota_trigger
    AFTER INSERT OR DELETE ON document_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_quotas();

DROP TRIGGER IF EXISTS fragments_quota_trigger ON fragments;
CREATE TRIGGER fragments_quota_trigger
    AFTER INSERT OR DELETE ON fragments
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_quotas();

-- Function to calculate cosine similarity (backup for when pgvector is not available)
CREATE OR REPLACE FUNCTION cosine_similarity(vec1 vector, vec2 vector)
RETURNS FLOAT AS $$
BEGIN
    RETURN (vec1 <=> vec2);
END;
$$ LANGUAGE plpgsql;

-- Function to search fragments with vector similarity
CREATE OR REPLACE FUNCTION search_fragments_vector(
    query_embedding vector(384),
    org_id UUID,
    doc_id UUID DEFAULT NULL,
    dept_filter TEXT DEFAULT NULL,
    classification_filter TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    content_preview TEXT,
    similarity FLOAT,
    start_page INTEGER,
    end_page INTEGER,
    document_title TEXT,
    version_number INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.document_id,
        f.content,
        f.content_preview,
        1 - (f.embedding <=> query_embedding) as similarity,
        f.start_page,
        f.end_page,
        f.document_title,
        f.version_number
    FROM fragment_search_view f
    WHERE f.organization_id = org_id
        AND f.embedding IS NOT NULL
        AND (doc_id IS NULL OR f.document_id = doc_id)
        AND (classification_filter IS NULL OR f.classification_level = classification_filter)
        AND (1 - (f.embedding <=> query_embedding)) >= 0.5  -- Minimum similarity threshold
    ORDER BY f.embedding <=> query_embedding ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to initialize quotas for existing organizations
CREATE OR REPLACE FUNCTION initialize_organization_quotas()
RETURNS VOID AS $$
DECLARE
    org_record RECORD;
    storage_used BIGINT;
    version_cnt INTEGER;
    fragment_cnt INTEGER;
BEGIN
    FOR org_record IN SELECT id FROM organizations LOOP
        -- Calculate current usage
        SELECT COALESCE(SUM(file_size), 0) INTO storage_used
        FROM documents 
        WHERE organization_id = org_record.id;
        
        SELECT COUNT(*) INTO version_cnt
        FROM document_versions dv
        JOIN documents d ON dv.document_id = d.id
        WHERE d.organization_id = org_record.id;
        
        SELECT COUNT(*) INTO fragment_cnt
        FROM fragments f
        JOIN documents d ON f.document_id = d.id
        WHERE d.organization_id = org_record.id;
        
        -- Insert quota record
        INSERT INTO organization_quotas (
            organization_id, 
            storage_used_bytes, 
            version_count, 
            fragment_count
        )
        VALUES (org_record.id, storage_used, version_cnt, fragment_cnt)
        ON CONFLICT (organization_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Initialize quotas for existing organizations
SELECT initialize_organization_quotas();

-- Add RLS policies for new tables
ALTER TABLE organization_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_quotas_policy ON organization_quotas
    FOR ALL USING (organization_id IN (SELECT unnest(user_organization_ids())));

-- Refresh the materialized view initially
REFRESH MATERIALIZED VIEW fragment_search_view;