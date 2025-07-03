-- Fixed Database Schema for OAuth Users
-- Run this in your Supabase SQL editor to fix the OAuth issue

-- First, drop the existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create a more robust function to handle new users
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

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also update the log_auth_event function to be more robust
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