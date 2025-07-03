-- URGENT: Fix your user profile and RLS policies
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/xziqnrsppwqtxmxpswhi/sql

-- 1. First fix RLS policies to stop infinite recursion
ALTER TABLE public.user_organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_organizations' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_organizations', pol.policyname);
    END LOOP;
    
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'organizations' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', pol.policyname);
    END LOOP;
END $$;

-- Re-enable with simple policies
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_owners_full_access" ON public.organizations
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "users_own_memberships" ON public.user_organizations
  FOR ALL USING (user_id = auth.uid());

-- 2. Update your profile to mark as not first-time (since you're testing)
UPDATE public.profiles 
SET first_time = false 
WHERE id = '018df718-347f-4991-80c0-2f0121b3d717';

-- 3. Check if you have any organizations
SELECT 'Profile updated, checking organizations...' as status;

SELECT COUNT(*) as org_count 
FROM public.user_organizations 
WHERE user_id = '018df718-347f-4991-80c0-2f0121b3d717';

-- 4. If you need to create a test organization (run this if org_count = 0)
-- Uncomment the lines below if needed:

-- INSERT INTO public.organizations (name, tier, owner_id)
-- VALUES ('Test Organization', 'free', '018df718-347f-4991-80c0-2f0121b3d717')
-- ON CONFLICT DO NOTHING;

-- INSERT INTO public.user_organizations (user_id, org_id, role)
-- SELECT '018df718-347f-4991-80c0-2f0121b3d717', id, 'owner'
-- FROM public.organizations 
-- WHERE owner_id = '018df718-347f-4991-80c0-2f0121b3d717'
-- ON CONFLICT DO NOTHING;