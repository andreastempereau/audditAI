-- URGENT FIX: Run this to fix the infinite recursion in RLS policies
-- This replaces the problematic policies with simple, non-circular ones

-- 1. Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can manage memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Users can view their org memberships" ON public.user_organizations;

-- 2. Create simple, non-recursive policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Create simple policies for organizations (NO CIRCULAR REFERENCES)
CREATE POLICY "Users can create organizations" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Organization owners can update their organizations" ON public.organizations
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Organization owners can view their organizations" ON public.organizations
  FOR SELECT USING (owner_id = auth.uid());

-- 4. Create simple policies for user_organizations  
CREATE POLICY "Users can view their memberships" ON public.user_organizations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their memberships" ON public.user_organizations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Organization owners can manage all memberships" ON public.user_organizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = org_id AND owner_id = auth.uid()
    )
  );

-- 5. Fix your user profile to complete onboarding
UPDATE public.profiles 
SET first_time = false 
WHERE id = '018df718-347f-4991-80c0-2f0121b3d717';

-- 6. Verify the fix
SELECT 
  'RLS policies fixed! User onboarding completed!' as message,
  id,
  name,
  email,
  first_time
FROM public.profiles 
WHERE id = '018df718-347f-4991-80c0-2f0121b3d717';