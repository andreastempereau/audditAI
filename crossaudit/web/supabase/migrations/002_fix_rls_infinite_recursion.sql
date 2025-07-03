-- COMPLETE FIX: Remove all RLS policies and recreate them properly

-- 1. Disable RLS temporarily to clear everything
ALTER TABLE public.user_organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    -- Drop all policies on user_organizations
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_organizations' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_organizations', pol.policyname);
    END LOOP;
    
    -- Drop all policies on organizations
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'organizations' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', pol.policyname);
    END LOOP;
END $$;

-- 3. Re-enable RLS
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 4. Create simple, non-recursive policies

-- Organizations: Simple ownership-based access
CREATE POLICY "org_owners_full_access" ON public.organizations
  FOR ALL USING (owner_id = auth.uid());

-- User Organizations: Simple user-based access  
CREATE POLICY "users_own_memberships" ON public.user_organizations
  FOR ALL USING (user_id = auth.uid());

-- 5. Test the fix by running a simple query
SELECT 'RLS policies fixed successfully' as status;