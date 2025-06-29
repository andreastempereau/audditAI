-- CrossAudit Core Schema Rollback Migration
-- Drops all tables and functions created by 001_core_schema.sql
-- WARNING: This will permanently delete all data in these tables

-- Drop all triggers first
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
DROP TRIGGER IF EXISTS audit_policies ON public.policies;
DROP TRIGGER IF EXISTS audit_api_keys ON public.api_keys;
DROP TRIGGER IF EXISTS audit_document_versions ON public.document_versions;
DROP TRIGGER IF EXISTS audit_documents ON public.documents;
DROP TRIGGER IF EXISTS audit_chat_messages ON public.chat_messages;

DROP TRIGGER IF EXISTS trigger_evaluators_updated_at ON public.evaluators;
DROP TRIGGER IF EXISTS trigger_policies_updated_at ON public.policies;
DROP TRIGGER IF EXISTS trigger_webhooks_updated_at ON public.webhooks;
DROP TRIGGER IF EXISTS trigger_api_keys_updated_at ON public.api_keys;
DROP TRIGGER IF EXISTS trigger_fragments_updated_at ON public.fragments;
DROP TRIGGER IF EXISTS trigger_documents_updated_at ON public.documents;
DROP TRIGGER IF EXISTS trigger_chat_messages_updated_at ON public.chat_messages;
DROP TRIGGER IF EXISTS trigger_chat_threads_updated_at ON public.chat_threads;
DROP TRIGGER IF EXISTS trigger_user_roles_updated_at ON public.user_roles;
DROP TRIGGER IF EXISTS trigger_departments_updated_at ON public.departments;
DROP TRIGGER IF EXISTS trigger_roles_updated_at ON public.roles;

DROP TRIGGER IF EXISTS trigger_chat_message_sequence ON public.chat_messages;

-- Drop all functions
DROP FUNCTION IF EXISTS public.audit_trigger();
DROP FUNCTION IF EXISTS public.assign_chat_message_sequence();
DROP FUNCTION IF EXISTS public.update_updated_at();
DROP FUNCTION IF EXISTS auth.user_organization_ids();

-- Drop unique indexes (constraints)
DROP INDEX IF EXISTS public.idx_roles_org_name_unique;
DROP INDEX IF EXISTS public.idx_departments_org_name_unique;
DROP INDEX IF EXISTS public.idx_user_roles_active_unique;
DROP INDEX IF EXISTS public.idx_chat_messages_thread_sequence_unique;
DROP INDEX IF EXISTS public.idx_api_keys_org_name_unique;
DROP INDEX IF EXISTS public.idx_webhooks_org_name_unique;
DROP INDEX IF EXISTS public.idx_policies_org_name_unique;
DROP INDEX IF EXISTS public.idx_evaluators_org_name_unique;

-- Remove columns that were added to existing tables (if they exist)
DO $$
BEGIN
    -- Remove foreign key constraints and organization_id columns from existing tables if they exist
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'roles_organization_fk' AND table_schema = 'public') THEN
        ALTER TABLE public.roles DROP CONSTRAINT roles_organization_fk;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'roles' AND column_name = 'organization_id' AND table_schema = 'public') THEN
        ALTER TABLE public.roles DROP COLUMN organization_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'chat_threads_organization_fk' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP CONSTRAINT chat_threads_organization_fk;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'organization_id' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN organization_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'documents_organization_fk' AND table_schema = 'public') THEN
        ALTER TABLE public.documents DROP CONSTRAINT documents_organization_fk;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'documents' AND column_name = 'organization_id' AND table_schema = 'public') THEN
        ALTER TABLE public.documents DROP COLUMN organization_id;
    END IF;

    -- Remove deleted_at columns from existing tables if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'roles' AND column_name = 'deleted_at' AND table_schema = 'public') THEN
        ALTER TABLE public.roles DROP COLUMN deleted_at;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'departments' AND column_name = 'deleted_at' AND table_schema = 'public') THEN
        ALTER TABLE public.departments DROP COLUMN deleted_at;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'deleted_at' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN deleted_at;
    END IF;
    
    -- Remove chat_threads columns that were added
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'chat_threads_created_by_fk' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP CONSTRAINT chat_threads_created_by_fk;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'created_by' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN created_by;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'name' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN name;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'description' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN description;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'is_private' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN is_private;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'participants' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN participants;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'metadata' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN metadata;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'message_count' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN message_count;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_threads' AND column_name = 'last_message_at' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_threads DROP COLUMN last_message_at;
    END IF;
    
    -- Remove chat_messages columns that were added
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'chat_messages_parent_fk' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_messages DROP CONSTRAINT chat_messages_parent_fk;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_messages' AND column_name = 'parent_message_id' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_messages DROP COLUMN parent_message_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_messages' AND column_name = 'edited_at' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_messages DROP COLUMN edited_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_messages' AND column_name = 'metadata' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_messages DROP COLUMN metadata;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_messages' AND column_name = 'message_type' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_messages DROP COLUMN message_type;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_messages' AND column_name = 'content_type' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_messages DROP COLUMN content_type;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_messages' AND column_name = 'sequence_number' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_messages DROP COLUMN sequence_number;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'chat_messages' AND column_name = 'deleted_at' AND table_schema = 'public') THEN
        ALTER TABLE public.chat_messages DROP COLUMN deleted_at;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'documents' AND column_name = 'deleted_at' AND table_schema = 'public') THEN
        ALTER TABLE public.documents DROP COLUMN deleted_at;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'api_keys' AND column_name = 'deleted_at' AND table_schema = 'public') THEN
        ALTER TABLE public.api_keys DROP COLUMN deleted_at;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'webhooks' AND column_name = 'deleted_at' AND table_schema = 'public') THEN
        ALTER TABLE public.webhooks DROP COLUMN deleted_at;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'policies' AND column_name = 'deleted_at' AND table_schema = 'public') THEN
        ALTER TABLE public.policies DROP COLUMN deleted_at;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'evaluators' AND column_name = 'deleted_at' AND table_schema = 'public') THEN
        ALTER TABLE public.evaluators DROP COLUMN deleted_at;
    END IF;
END $$;

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS public.metrics_data;
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.evaluators;
DROP TABLE IF EXISTS public.policies;
DROP TABLE IF EXISTS public.webhook_events;
DROP TABLE IF EXISTS public.webhooks;
DROP TABLE IF EXISTS public.api_keys;
DROP TABLE IF EXISTS public.fragments;
DROP TABLE IF EXISTS public.document_versions;
DROP TABLE IF EXISTS public.documents;
DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.chat_threads;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.departments;
DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.permissions;

-- Drop extensions (only if they're not used elsewhere)
-- Note: Be careful with these as other parts of the system might depend on them
-- DROP EXTENSION IF EXISTS "pg_trgm";
-- DROP EXTENSION IF EXISTS "vector";
-- DROP EXTENSION IF EXISTS "pgcrypto";
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- Note: Extensions are preserved as they may be used by other parts of the system
-- Extensions that were created: uuid-ossp, pgcrypto, vector, pg_trgm

COMMENT ON SCHEMA public IS 'Core schema rollback completed - all CrossAudit tables removed';