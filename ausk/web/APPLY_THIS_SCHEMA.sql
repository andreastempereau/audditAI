-- CRITICAL: Apply this schema in your Supabase SQL Editor to fix the authentication issue
-- This will create the missing tables, triggers, and policies

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  picture_url TEXT,
  first_time BOOLEAN DEFAULT true,
  mfa_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create user_organizations table
CREATE TABLE IF NOT EXISTS public.user_organizations (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, org_id)
);

-- 4. Create organization_invitations table
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create audit_log_auth table
CREATE TABLE IF NOT EXISTS public.audit_log_auth (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_auth ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 8. Create RLS Policies for organizations
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Organization owners can update" ON public.organizations;
CREATE POLICY "Organization owners can update" ON public.organizations
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
CREATE POLICY "Users can view their organizations" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT org_id FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- 9. Create RLS Policies for user_organizations
DROP POLICY IF EXISTS "Organization owners can manage memberships" ON public.user_organizations;
CREATE POLICY "Organization owners can manage memberships" ON public.user_organizations
  FOR ALL USING (
    org_id IN (
      SELECT id FROM public.organizations 
      WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view their org memberships" ON public.user_organizations;
CREATE POLICY "Users can view their org memberships" ON public.user_organizations
  FOR SELECT USING (user_id = auth.uid());

-- 10. Create automatic profile creation function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles with better error handling
  INSERT INTO public.profiles (id, name, email, picture_url, first_time, mfa_enabled)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name', 
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'picture',
      NEW.raw_user_meta_data->>'avatar_url'
    ),
    true,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name',
      profiles.name
    ),
    email = COALESCE(NEW.email, profiles.email),
    picture_url = COALESCE(
      NEW.raw_user_meta_data->>'picture',
      NEW.raw_user_meta_data->>'avatar_url',
      profiles.picture_url
    );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- 11. Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Create auth logging function
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_user_id UUID,
  p_action TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_log_auth (user_id, action, ip_address, user_agent, metadata)
  VALUES (p_user_id, p_action, p_ip_address, p_user_agent, p_metadata)
  RETURNING id INTO log_id;
  RETURN log_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail
    RAISE WARNING 'Error logging auth event: %', SQLERRM;
    RETURN NULL;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- 13. Create a profile for existing user (your current user)
-- Replace 'YOUR_USER_ID' with the actual user ID from the logs
INSERT INTO public.profiles (id, name, email, picture_url, first_time, mfa_enabled)
VALUES (
  '018df718-347f-4991-80c0-2f0121b3d717',
  'Andreas',
  'andreastempereau@gmail.com',
  'https://lh3.googleusercontent.com/a/ACg8ocL5dXWck6tenZIyZ5_lkfQdMYv9tzJ-SFoLOy4UQviP92Ia13tf=s96-c',
  true,
  false
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  picture_url = EXCLUDED.picture_url;

-- Success message
SELECT 'Database schema applied successfully! Try logging in again.' as message;