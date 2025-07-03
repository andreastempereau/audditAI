-- Fix RLS policies to prevent infinite recursion

-- 1. Drop the problematic policies
DROP POLICY IF EXISTS "Organization owners can manage memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Users can view their org memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;

-- 2. Create fixed policies without recursion

-- For user_organizations table
CREATE POLICY "Users can view their own org memberships" ON public.user_organizations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own org memberships" ON public.user_organizations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Separate policy for org owners to manage OTHER users' memberships
CREATE POLICY "Org owners can manage other users memberships" ON public.user_organizations
  FOR ALL USING (
    org_id IN (
      SELECT id FROM public.organizations 
      WHERE owner_id = auth.uid()
    )
    AND user_id != auth.uid()  -- Prevent recursion by excluding self
  );

-- For organizations table - simplified
CREATE POLICY "Users can view orgs they belong to" ON public.organizations
  FOR SELECT USING (
    auth.uid() = owner_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = organizations.id 
      AND uo.user_id = auth.uid()
    )
  );

-- 3. Also ensure the user can create their membership when creating an org
CREATE POLICY "Users can join orgs when creating them" ON public.user_organizations
  FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    AND 
    org_id IN (
      SELECT id FROM public.organizations 
      WHERE owner_id = auth.uid()
    )
  );

-- 4. Check if policies are working
SELECT * FROM public.user_organizations WHERE user_id = '018df718-347f-4991-80c0-2f0121b3d717';
SELECT * FROM public.organizations WHERE owner_id = '018df718-347f-4991-80c0-2f0121b3d717';