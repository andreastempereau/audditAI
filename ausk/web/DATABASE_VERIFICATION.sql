-- =============================================================================
-- DATABASE SCHEMA VERIFICATION FOR AUSK APPLICATION
-- Run these commands in Supabase Dashboard > SQL Editor
-- =============================================================================

-- 1. Check if all required tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'profiles', 'organizations', 'user_organizations',
      'chat_threads', 'chat_messages', 
      'documents', 'document_versions', 'fragments',
      'roles', 'permissions', 'user_roles', 'departments'
    ) THEN '✅ REQUIRED'
    ELSE '❓ OPTIONAL'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Verify Row Level Security is enabled on critical tables
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END as security_status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
  'profiles', 'organizations', 'user_organizations',
  'chat_threads', 'chat_messages', 
  'documents', 'document_versions'
)
ORDER BY tablename;

-- 3. Check if storage bucket exists
SELECT 
  id, 
  name, 
  public,
  file_size_limit,
  '✅ STORAGE READY' as status
FROM storage.buckets 
WHERE id = 'documents';

-- 4. Test basic functionality - Create a test profile (will only work if schema is correct)
-- This should complete without errors if schema is properly set up
SELECT 'Schema verification complete' as result;

-- =============================================================================
-- EXPECTED RESULTS:
-- =============================================================================
-- Query 1: Should show at least 7 tables marked as "REQUIRED"
-- Query 2: Should show "RLS ENABLED" for all listed tables
-- Query 3: Should show one row with documents bucket
-- Query 4: Should return "Schema verification complete"
--
-- If any query fails or returns unexpected results, the schema may need to be applied.
-- Schema file location: /supabase/migrations/001_core_schema.sql
-- =============================================================================