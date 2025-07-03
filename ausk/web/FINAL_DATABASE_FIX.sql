-- FINAL DATABASE FIX - Run this in Supabase SQL Editor
-- URL: https://app.supabase.com/project/xziqnrsppwqtxmxpswhi/sql

-- 1. Fix RLS infinite recursion by removing all policies and recreating simple ones
ALTER TABLE public.user_organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Drop all existing problematic policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename IN ('user_organizations', 'organizations') 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, 
          CASE WHEN pol.tablename = 'user_organizations' THEN 'user_organizations' 
               ELSE 'organizations' END);
    END LOOP;
END $$;

-- Re-enable RLS with simple, non-recursive policies
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Simple policies that don't cause recursion
CREATE POLICY "org_owners_access" ON public.organizations
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "user_memberships_access" ON public.user_organizations
  FOR ALL USING (user_id = auth.uid());

-- 2. Update your profile for testing (optional - remove first_time flag)
-- Uncomment if you want to test as existing user:
-- UPDATE public.profiles 
-- SET first_time = false 
-- WHERE id = '018df718-347f-4991-80c0-2f0121b3d717';

-- 3. Test queries
SELECT 'Database fix applied successfully!' as status;

-- Verify the policies work
SELECT COUNT(*) as profile_count FROM public.profiles WHERE id = auth.uid();
SELECT COUNT(*) as org_count FROM public.user_organizations WHERE user_id = auth.uid();